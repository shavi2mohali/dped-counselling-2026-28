import { getAuth } from "firebase-admin/auth";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type WriteBatch } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";
import { onRequest } from "firebase-functions/v2/https";
import * as XLSX from "xlsx";
import { emptySeatCounts, SEAT_MATRIX, TOTAL_SEATS } from "./seatMatrix.js";

initializeApp();

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

type ExcelRow = Record<string, unknown>;

interface ImportCandidatesRequest {
  fileUrl?: string;
  storagePath?: string;
  bucketName?: string;
  sheetName?: string;
  dryRun?: boolean;
}

interface CleanCandidate {
  registrationId: string;
  district: string;
  name: string;
  dob: string;
  fatherName: string;
  motherName: string;
  gender: string;
  categoryName: string;
  effectiveCategory: string;
  percentage10: number;
  percentage12: number;
  pinCode: string;
  result: string;
  isPunjabDomicile: boolean;
  eligibleForReservation: boolean;
  rank: number | null;
  status: "pending";
  createdAt: FieldValue;
  updatedAt: FieldValue;
}

interface ParsingError {
  rowNumber: number;
  registrationId?: string;
  message: string;
}

class ImportError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

const robustCorsOptions = {
  origin: true,
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAgeSeconds: 3600,
};

const setCorsHeaders = (res: { set: (name: string, value: string) => void }) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Max-Age", "3600");
};

const cleanString = (value: unknown): string => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
};

const cleanNumber = (value: unknown): number => {
  const cleaned = cleanString(value).replace(/,/g, "");

  if (!cleaned) {
    return 0;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeHeader = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const buildColumnLookup = (row: ExcelRow): Map<string, string> => {
  const lookup = new Map<string, string>();

  for (const key of Object.keys(row)) {
    lookup.set(normalizeHeader(key), key);
  }

  return lookup;
};

const getCell = (row: ExcelRow, lookup: Map<string, string>, columnName: string): unknown => {
  const actualKey = lookup.get(normalizeHeader(columnName));
  return actualKey ? row[actualKey] : "";
};

const parseDob = (value: unknown): string => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString().slice(0, 10);
    }
  }

  return cleanString(value);
};

const isPunjabDomicileDistrict = (district: string): boolean => {
  const cleanedDistrict = district.trim().toUpperCase();
  return cleanedDistrict !== "" && cleanedDistrict !== "OTHER";
};

const requireSignedInUser = async (req: { headers: { authorization?: string } }) => {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

  if (!token) {
    throw new ImportError(401, "You must be signed in before importing candidates.");
  }

  try {
    return await getAuth().verifyIdToken(token);
  } catch {
    throw new ImportError(401, "Invalid or expired Firebase Auth token.");
  }
};

const downloadExcelFile = async ({
  bucketName,
  fileUrl,
  storagePath,
}: Pick<ImportCandidatesRequest, "bucketName" | "fileUrl" | "storagePath">): Promise<{
  buffer: Buffer;
  source: string;
}> => {
  if (fileUrl) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(fileUrl);
    } catch {
      throw new ImportError(400, "fileUrl must be a valid URL.");
    }

    logger.info("Downloading Excel file from fileUrl", {
      host: parsedUrl.host,
      pathname: parsedUrl.pathname,
    });

    const response = await fetch(fileUrl, {
      method: "GET",
      headers: {
        Accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, application/octet-stream",
      },
    });

    if (!response.ok) {
      throw new ImportError(response.status, `Failed to download Excel file. HTTP ${response.status}.`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new ImportError(400, "Downloaded Excel file is empty.");
    }

    return {
      buffer: Buffer.from(arrayBuffer),
      source: fileUrl,
    };
  }

  if (!storagePath) {
    throw new ImportError(400, "fileUrl or storagePath is required.");
  }

  const file = bucketName ? getStorage().bucket(bucketName).file(storagePath) : getStorage().bucket().file(storagePath);
  const [exists] = await file.exists();

  if (!exists) {
    throw new ImportError(404, `Excel file not found in Firebase Storage: ${storagePath}`);
  }

  const [buffer] = await file.download();
  return {
    buffer,
    source: storagePath,
  };
};

const mapCandidateRow = (row: ExcelRow, rowNumber: number): { candidate?: CleanCandidate; error?: ParsingError } => {
  const lookup = buildColumnLookup(row);

  const registrationId = cleanString(getCell(row, lookup, "RegistrationId"));
  const district = cleanString(getCell(row, lookup, "District"));
  const name = cleanString(getCell(row, lookup, "Name"));
  const categoryName = cleanString(getCell(row, lookup, "CategoryName")) || "General";
  const percentage10 = cleanNumber(getCell(row, lookup, "Percentage10"));
  const percentage12 = cleanNumber(getCell(row, lookup, "Percentage12"));
  const isPunjabDomicile = isPunjabDomicileDistrict(district);

  if (!registrationId) {
    return { error: { rowNumber, message: "Missing RegistrationId." } };
  }

  if (!name) {
    return { error: { rowNumber, registrationId, message: "Missing Name." } };
  }

  if (percentage12 <= 0) {
    return { error: { rowNumber, registrationId, message: "Missing or invalid Percentage12." } };
  }

  return {
    candidate: {
      registrationId,
      district,
      name,
      dob: parseDob(getCell(row, lookup, "DOB")),
      fatherName: cleanString(getCell(row, lookup, "FatherName")),
      motherName: cleanString(getCell(row, lookup, "MotherName")),
      gender: cleanString(getCell(row, lookup, "Gender")),
      categoryName,
      effectiveCategory: isPunjabDomicile ? categoryName : "General",
      percentage10,
      percentage12,
      pinCode: cleanString(getCell(row, lookup, "PinCode")),
      result: cleanString(getCell(row, lookup, "Result")),
      isPunjabDomicile,
      eligibleForReservation: isPunjabDomicile,
      rank: null,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
  };
};

const assignRanks = (candidates: CleanCandidate[]): CleanCandidate[] =>
  [...candidates]
    .sort((left, right) => {
      const percentage12Difference = right.percentage12 - left.percentage12;
      if (percentage12Difference !== 0) {
        return percentage12Difference;
      }

      return right.percentage10 - left.percentage10;
    })
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
    }));

const commitInChunks = async (writes: Array<(batch: WriteBatch) => void>) => {
  const chunkSize = 450;

  for (let index = 0; index < writes.length; index += chunkSize) {
    const batch = db.batch();
    for (const write of writes.slice(index, index + chunkSize)) {
      write(batch);
    }
    await batch.commit();
  }
};

export const importCandidates = onRequest(
  {
    cors: robustCorsOptions as unknown as true,
    region: "asia-south2",
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (req, res) => {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
      return;
    }

    try {
      const decodedToken = await requireSignedInUser(req);
      const requestBody = (req.body?.data ?? req.body ?? {}) as ImportCandidatesRequest;
      const { fileUrl, storagePath, bucketName, sheetName, dryRun = false } = requestBody;

      logger.info("Starting candidate import", {
        uid: decodedToken.uid,
        email: decodedToken.email,
        hasFileUrl: Boolean(fileUrl),
        storagePath,
        bucketName,
        sheetName,
        dryRun,
      });

      const downloaded = await downloadExcelFile({ bucketName, fileUrl, storagePath });
      logger.info("Excel file downloaded", {
        source: downloaded.source,
        bytes: downloaded.buffer.length,
      });

      const workbook = XLSX.read(downloaded.buffer, { type: "buffer", cellDates: true });
      const selectedSheetName = sheetName ?? workbook.SheetNames[0];
      const worksheet = workbook.Sheets[selectedSheetName];

      if (!worksheet) {
        throw new ImportError(400, `Sheet not found: ${selectedSheetName}`);
      }

      const rows = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, { defval: "", raw: true });
      if (rows.length === 0) {
        throw new ImportError(400, "Excel sheet has no candidate rows.");
      }

      const parsingErrors: ParsingError[] = [];
      const seenRegistrationIds = new Set<string>();
      const mappedCandidates: CleanCandidate[] = [];

      rows.forEach((row, index) => {
        const result = mapCandidateRow(row, index + 2);

        if (result.error) {
          parsingErrors.push(result.error);
          return;
        }

        if (!result.candidate) {
          return;
        }

        if (seenRegistrationIds.has(result.candidate.registrationId)) {
          parsingErrors.push({
            rowNumber: index + 2,
            registrationId: result.candidate.registrationId,
            message: "Duplicate RegistrationId. Row skipped.",
          });
          return;
        }

        seenRegistrationIds.add(result.candidate.registrationId);
        mappedCandidates.push(result.candidate);
      });

      const rankedCandidates = assignRanks(mappedCandidates);
      const punjabDomicile = rankedCandidates.filter((candidate) => candidate.isPunjabDomicile).length;
      const nonPunjab = rankedCandidates.length - punjabDomicile;

      const summary = {
        success: true,
        dryRun,
        sheetName: selectedSheetName,
        totalRows: rows.length,
        totalRowsRead: rows.length,
        totalImported: rankedCandidates.length,
        totalCandidatesImported: rankedCandidates.length,
        punjabDomicile,
        punjabDomicileCount: punjabDomicile,
        nonPunjab,
        nonPunjabDomicileCount: nonPunjab,
        categoryChangedToGeneralDueToNonDomicile: nonPunjab,
        initializedSeatMatrixColleges: SEAT_MATRIX.length,
        totalSeats: TOTAL_SEATS,
        parsingErrors,
        top5Candidates: rankedCandidates.slice(0, 5).map((candidate) => ({
          RegistrationId: candidate.registrationId,
          registrationId: candidate.registrationId,
          name: candidate.name,
          rank: candidate.rank,
          meritRank: candidate.rank,
          percentage12: candidate.percentage12,
          percentage10: candidate.percentage10,
          district: candidate.district,
          category: candidate.effectiveCategory,
          originalCategoryName: candidate.categoryName,
          isPunjabDomicile: candidate.isPunjabDomicile,
          effectiveCategory: candidate.effectiveCategory,
        })),
        message: dryRun ? "Dry run completed successfully" : "Import completed successfully",
      };

      if (dryRun) {
        logger.info("Dry run completed", summary);
        res.status(200).json({ data: summary });
        return;
      }

      const writes: Array<(batch: WriteBatch) => void> = [];

      rankedCandidates.forEach((candidate) => {
        writes.push((batch) => {
          batch.set(db.collection("candidates").doc(candidate.registrationId), candidate, { merge: true });
        });
      });

      SEAT_MATRIX.forEach((college) => {
        writes.push((batch) => {
          batch.set(
            db.collection("seatMatrix").doc(college.collegeName),
            {
              ...college,
              filled: emptySeatCounts(),
              remaining: college.seats,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        });
      });

      writes.push((batch) => {
        batch.set(
          db.collection("settings").doc("global"),
          {
            counsellingSession: "2026-28",
            currentRound: 1,
            allotmentStatus: "draft",
            candidateImportEnabled: true,
            totalSeats: TOTAL_SEATS,
            lastCandidateImport: {
              importedByUid: decodedToken.uid,
              importedByEmail: decodedToken.email ?? "",
              totalImported: rankedCandidates.length,
              punjabDomicile,
              nonPunjab,
              parsingErrorCount: parsingErrors.length,
              importedAt: FieldValue.serverTimestamp(),
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      });

      await commitInChunks(writes);

      logger.info("Import completed successfully", {
        totalImported: rankedCandidates.length,
        punjabDomicile,
        nonPunjab,
        parsingErrors: parsingErrors.length,
      });

      res.status(200).json({ data: summary });
    } catch (error) {
      logger.error("Import failed", error);

      if (error instanceof ImportError) {
        res.status(error.status).json({
          success: false,
          error: error.message,
          details: error.details,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Import failed",
      });
    }
  },
);
