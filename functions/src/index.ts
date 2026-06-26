import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { initializeApp } from "firebase-admin/app";
import { FieldPath, FieldValue, getFirestore, type QueryDocumentSnapshot, type WriteBatch } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";
import { onRequest } from "firebase-functions/v2/https";
import * as XLSX from "xlsx";
import { CATEGORY_COLUMNS, type CategoryColumn, type SeatCounts } from "./models.js";
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

interface ImportSeatMatrixRequest {
  fileUrl?: string;
  storagePath?: string;
  bucketName?: string;
  sheetName?: string;
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

interface StoredCandidate {
  registrationId?: string;
  RegistrationId?: string;
  name?: string;
  candidateName?: string;
  percentage10?: number;
  Percentage10?: number;
  percentage12?: number;
  Percentage12?: number;
  dob?: string;
  DOB?: string;
  dateOfBirth?: string;
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

const getFirstCell = (row: ExcelRow, lookup: Map<string, string>, columnNames: string[]): unknown => {
  for (const columnName of columnNames) {
    const value = getCell(row, lookup, columnName);
    if (cleanString(value) !== "") {
      return value;
    }
  }

  return "";
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

const getDobTime = (value: unknown): number => {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.getTime();
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return Date.UTC(parsed.y, parsed.m - 1, parsed.d);
    }
  }

  const dob = cleanString(value);
  if (!dob) {
    return Number.MAX_SAFE_INTEGER;
  }

  const normalized = dob.replace(/\./g, "/").replace(/-/g, "/");
  const parts = normalized.split("/").map((part) => Number(part));

  if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
    const [first, second, third] = parts;
    const year = third < 100 ? 2000 + third : third;

    if (first > 31) {
      return Date.UTC(first, second - 1, third);
    }

    if (year > 1900) {
      return Date.UTC(year, second - 1, first);
    }
  }

  const parsed = new Date(dob).getTime();
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

const isPunjabDomicileDistrict = (district: string): boolean => {
  const cleanedDistrict = district.trim().toUpperCase();
  return cleanedDistrict !== "" && cleanedDistrict !== "OTHER";
};

const seatMatrixColumnAliases: Record<CategoryColumn, string[]> = {
  General: ["General"],
  EWS: ["EWS"],
  BC: ["BC"],
  "SC (RO)": ["SC (RO)", "SC(RO)", "SC RO"],
  "SC(MB)": ["SC(MB)", "SC (MB)", "SC MB"],
  "Ex serviceman (Gen)": ["Ex serviceman (Gen)", "Ex(Gen)", "Ex Gen", "Ex serviceman Gen"],
  "Ex serviceman (BC)": ["Ex serviceman (BC)", "Ex(BC)", "Ex BC", "Ex serviceman BC"],
  "Ex serviceman (SC)": ["Ex serviceman (SC)", "Ex(SC)", "Ex SC", "Ex serviceman SC"],
  "General (FF)": ["General (FF)", "Gen(FF)", "Gen (FF)", "Freedom Fighter"],
  "Gen (Sports)": ["Gen (Sports)", "General(Sports)", "General (Sports)", "Gen Sports"],
  "SC (Sports)": ["SC (Sports)", "SC(Sports)", "SC Sports"],
  "Phy Handicapped": ["Phy Handicapped", "Phy.Handi", "Phy Handi", "Physically Handicapped", "PH"],
};

const getSeatMatrixCollegeName = (row: ExcelRow, lookup: Map<string, string>): string =>
  cleanString(getFirstCell(row, lookup, ["Name of College", "College", "College Name", "Name"]));

const getSeatMatrixTotal = (row: ExcelRow, lookup: Map<string, string>): number =>
  cleanNumber(getFirstCell(row, lookup, ["Total", "Total Seats"]));

const mapSeatMatrixRow = (row: ExcelRow, rowNumber: number) => {
  const lookup = buildColumnLookup(row);
  const collegeName = getSeatMatrixCollegeName(row, lookup);

  if (!collegeName) {
    return { error: { rowNumber, message: "Missing Name of College." } };
  }

  const seats = emptySeatCounts();
  CATEGORY_COLUMNS.forEach((category) => {
    seats[category] = cleanNumber(getFirstCell(row, lookup, seatMatrixColumnAliases[category]));
  });

  const computedTotal = CATEGORY_COLUMNS.reduce((sum, category) => sum + seats[category], 0);
  const declaredTotal = getSeatMatrixTotal(row, lookup);

  if (computedTotal <= 0) {
    return { error: { rowNumber, message: `${collegeName}: category seat total is zero.` } };
  }

  if (declaredTotal > 0 && declaredTotal !== computedTotal) {
    return {
      error: {
        rowNumber,
        message: `${collegeName}: Total column (${declaredTotal}) does not match category sum (${computedTotal}).`,
      },
    };
  }

  return {
    entry: {
      collegeName,
      seats,
      total: computedTotal,
      isActive: true as const,
      sourceSession: "2025-27" as const,
      counsellingSession: "2026-28" as const,
    },
  };
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

const adminEmails = new Set(["admin@dpedpunjab.in", "counselling@dpedpunjab.in", "shavi2me@admin.com"]);

const isAdminToken = (decodedToken: DecodedIdToken): boolean => {
  const email = cleanString(decodedToken.email).toLowerCase();
  const role = decodedToken.role;
  const adminClaim = decodedToken.admin;

  return (
    adminClaim === true ||
    role === "admin" ||
    email.endsWith("@dpedpunjab.in") ||
    adminEmails.has(email)
  );
};

const requireAdminUser = async (req: { headers: { authorization?: string } }) => {
  const decodedToken = await requireSignedInUser(req);

  if (!isAdminToken(decodedToken)) {
    throw new ImportError(403, "Only admin users can perform this action.");
  }

  return decodedToken;
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

      const dobDifference = getDobTime(left.dob) - getDobTime(right.dob);
      if (dobDifference !== 0) {
        return dobDifference;
      }

      return right.percentage10 - left.percentage10;
    })
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
    }));

const getStoredCandidatePercentage10 = (candidate: StoredCandidate): number =>
  cleanNumber(candidate.percentage10 ?? candidate.Percentage10);

const getStoredCandidatePercentage12 = (candidate: StoredCandidate): number =>
  cleanNumber(candidate.percentage12 ?? candidate.Percentage12);

const getStoredCandidateDobTime = (candidate: StoredCandidate): number => {
  return getDobTime(candidate.dob ?? candidate.DOB ?? candidate.dateOfBirth);
};

const getStoredCandidateRegistrationId = (candidate: StoredCandidate): string =>
  cleanString(candidate.registrationId ?? candidate.RegistrationId);

const getStoredCandidateName = (candidate: StoredCandidate): string =>
  cleanString(candidate.name ?? candidate.candidateName);

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

const pageDocumentsById = async (
  collectionPath: string,
  handlePage: (docs: QueryDocumentSnapshot[]) => Promise<void>,
) => {
  const pageSize = 400;
  let lastDocument: QueryDocumentSnapshot | undefined;

  while (true) {
    let query = db.collection(collectionPath).orderBy(FieldPath.documentId()).limit(pageSize);

    if (lastDocument) {
      query = query.startAfter(lastDocument);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      break;
    }

    await handlePage(snapshot.docs);
    lastDocument = snapshot.docs[snapshot.docs.length - 1];
  }
};

const archiveAndDeleteAllotments = async (resetId: string): Promise<number> => {
  let archivedCount = 0;

  while (true) {
    const snapshot = await db.collection("allotments").orderBy(FieldPath.documentId()).limit(200).get();

    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach((allotmentDoc) => {
      batch.set(db.collection("archivedAllotments").doc(resetId).collection("records").doc(allotmentDoc.id), {
        ...allotmentDoc.data(),
        originalAllotmentId: allotmentDoc.id,
        resetId,
        archivedAt: FieldValue.serverTimestamp(),
      });
      batch.delete(allotmentDoc.ref);
    });

    await batch.commit();
    archivedCount += snapshot.docs.length;
  }

  return archivedCount;
};

const resetSeatMatrixVacancies = async (): Promise<number> => {
  let resetCount = 0;

  await pageDocumentsById("seatMatrix", async (seatDocs) => {
    const batch = db.batch();

    seatDocs.forEach((seatDoc) => {
      const data = seatDoc.data();
      const seats = (data.seats ?? {}) as Record<string, number>;
      const categories = Object.keys(seats).length > 0 ? Object.keys(seats) : [...CATEGORY_COLUMNS];
      const filled = Object.fromEntries(categories.map((category) => [category, 0]));
      const remaining = Object.fromEntries(
        categories.map((category) => [category, cleanNumber(seats[category])]),
      );

      batch.set(
        seatDoc.ref,
        {
          filled,
          remaining,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      resetCount += 1;
    });

    await batch.commit();
  });

  return resetCount;
};

const resetCandidateCounselingFields = async (): Promise<number> => {
  let resetCount = 0;

  await pageDocumentsById("candidates", async (candidateDocs) => {
    const batch = db.batch();

    candidateDocs.forEach((candidateDoc) => {
      batch.set(
        candidateDoc.ref,
        {
          status: "pending",
          allottedCollegeId: FieldValue.delete(),
          allottedCollegeName: FieldValue.delete(),
          allottedCategory: FieldValue.delete(),
          allotmentStatus: FieldValue.delete(),
          allotmentUpdatedAt: FieldValue.delete(),
          allotmentRound: FieldValue.delete(),
          counsellingStatus: FieldValue.delete(),
          calledAt: FieldValue.delete(),
          joinedStatus: FieldValue.delete(),
          joinedUpdatedAt: FieldValue.delete(),
          joinedUpdatedByUid: FieldValue.delete(),
          joinedUpdatedByEmail: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      resetCount += 1;
    });

    await batch.commit();
  });

  return resetCount;
};

export const resetCounseling = onRequest(
  {
    cors: robustCorsOptions as unknown as true,
    region: "asia-south2",
    timeoutSeconds: 540,
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

    const resetRef = db.collection("resetLogs").doc();
    const resetId = resetRef.id;

    try {
      const startedAt = Date.now();
      const decodedToken = await requireAdminUser(req);

      logger.warn("Reset counseling requested", {
        resetId,
        uid: decodedToken.uid,
        email: decodedToken.email,
      });

      await resetRef.set({
        resetId,
        resetByUid: decodedToken.uid,
        resetByEmail: decodedToken.email ?? "",
        resetAt: FieldValue.serverTimestamp(),
        candidatesResetCount: 0,
        seatMatrixResetCount: 0,
        allotmentsArchivedCount: 0,
        status: "started",
      });

      const allotmentsArchivedCount = await archiveAndDeleteAllotments(resetId);
      const seatMatrixResetCount = await resetSeatMatrixVacancies();
      const candidatesResetCount = await resetCandidateCounselingFields();

      await commitInChunks([
        (batch) =>
          batch.set(
            db.collection("settings").doc("liveCounseling"),
            {
              currentCandidateRegistrationId: null,
              currentCandidateId: null,
              currentCandidateName: null,
              liveStatus: "not_started",
              currentRound: 1,
              lastAllotment: null,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          ),
        (batch) =>
          batch.set(
            db.collection("settings").doc("global"),
            {
              currentRound: 1,
              allotmentStatus: "draft",
              lastAllotment: null,
              lastReset: {
                resetId,
                resetByUid: decodedToken.uid,
                resetByEmail: decodedToken.email ?? "",
                resetAt: FieldValue.serverTimestamp(),
              },
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          ),
        (batch) =>
          batch.set(
            resetRef,
            {
              resetId,
              resetByUid: decodedToken.uid,
              resetByEmail: decodedToken.email ?? "",
              resetAt: FieldValue.serverTimestamp(),
              candidatesResetCount,
              seatMatrixResetCount,
              allotmentsArchivedCount,
              status: "success",
              timeTakenMs: Date.now() - startedAt,
            },
            { merge: true },
          ),
      ]);

      const summary = {
        success: true,
        resetId,
        candidatesResetCount,
        seatMatrixResetCount,
        allotmentsArchivedCount,
        timeTakenMs: Date.now() - startedAt,
        message: "Counseling reset completed successfully.",
      };

      logger.info("Reset counseling completed", summary);
      res.status(200).json({ data: summary });
    } catch (error) {
      logger.error("Reset counseling failed", { resetId, error });

      await resetRef
        .set(
          {
            resetId,
            resetAt: FieldValue.serverTimestamp(),
            status: "failed",
            error: error instanceof Error ? error.message : "Reset counseling failed",
          },
          { merge: true },
        )
        .catch((logError) => logger.error("Unable to write failed reset log", { resetId, logError }));

      if (error instanceof ImportError) {
        res.status(error.status).json({
          success: false,
          error: error.message,
          resetId,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Reset counseling failed",
        resetId,
      });
    }
  },
);

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

export const importSeatMatrix = onRequest(
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
      const startedAt = Date.now();
      const requestBody = (req.body?.data ?? req.body ?? {}) as ImportSeatMatrixRequest;
      const { fileUrl, storagePath, bucketName, sheetName } = requestBody;

      logger.info("Starting seat matrix import", {
        uid: decodedToken.uid,
        email: decodedToken.email,
        hasFileUrl: Boolean(fileUrl),
        storagePath,
        bucketName,
        sheetName,
      });

      const downloaded = await downloadExcelFile({ bucketName, fileUrl, storagePath });
      const workbook = XLSX.read(downloaded.buffer, { type: "buffer", cellDates: true });
      const selectedSheetName = sheetName ?? workbook.SheetNames[0];
      const worksheet = workbook.Sheets[selectedSheetName];

      if (!worksheet) {
        throw new ImportError(400, `Sheet not found: ${selectedSheetName}`);
      }

      const rows = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, { defval: "", raw: true });
      if (rows.length === 0) {
        throw new ImportError(400, "Excel sheet has no seat matrix rows.");
      }

      const parsingErrors: ParsingError[] = [];
      const seenCollegeNames = new Set<string>();
      const entries: Array<{
        collegeName: string;
        seats: SeatCounts;
        total: number;
        isActive: true;
        sourceSession: "2025-27";
        counsellingSession: "2026-28";
      }> = [];

      rows.forEach((row, index) => {
        const mapped = mapSeatMatrixRow(row, index + 2);

        if ("error" in mapped && mapped.error) {
          const lookup = buildColumnLookup(row);
          const hasAnySeatValue = CATEGORY_COLUMNS.some((category) =>
            cleanString(getFirstCell(row, lookup, seatMatrixColumnAliases[category])) !== "",
          );
          const hasCollege = getSeatMatrixCollegeName(row, lookup) !== "";

          if (hasAnySeatValue || hasCollege) {
            parsingErrors.push(mapped.error);
          }
          return;
        }

        if (!("entry" in mapped) || !mapped.entry) {
          return;
        }

        const normalizedCollegeName = normalizeHeader(mapped.entry.collegeName);
        if (seenCollegeNames.has(normalizedCollegeName)) {
          parsingErrors.push({
            rowNumber: index + 2,
            message: `${mapped.entry.collegeName}: duplicate college row.`,
          });
          return;
        }

        seenCollegeNames.add(normalizedCollegeName);
        entries.push(mapped.entry);
      });

      if (parsingErrors.length > 0) {
        throw new ImportError(400, "Seat matrix import has validation errors.", parsingErrors);
      }

      if (entries.length !== 11) {
        throw new ImportError(400, `Expected 11 colleges, found ${entries.length}.`);
      }

      const totalSeats = entries.reduce((sum, entry) => sum + entry.total, 0);
      const existingSnapshot = await db.collection("seatMatrix").get();
      const deleteWrites: Array<(batch: WriteBatch) => void> = [];
      existingSnapshot.docs.forEach((seatDoc) => {
        deleteWrites.push((batch) => batch.delete(seatDoc.ref));
      });

      await commitInChunks(deleteWrites);

      const writes: Array<(batch: WriteBatch) => void> = [];
      entries.forEach((entry) => {
        writes.push((batch) => {
          batch.set(db.collection("seatMatrix").doc(entry.collegeName), {
            ...entry,
            filled: emptySeatCounts(),
            remaining: entry.seats,
            importedFrom: downloaded.source,
            importedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
      });

      writes.push((batch) => {
        batch.set(
          db.collection("settings").doc("global"),
          {
            totalSeats,
            lastSeatMatrixImport: {
              importedByUid: decodedToken.uid,
              importedByEmail: decodedToken.email ?? "",
              importedAt: FieldValue.serverTimestamp(),
              sheetName: selectedSheetName,
              source: downloaded.source,
              totalColleges: entries.length,
              totalSeats,
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      });

      await commitInChunks(writes);

      const summary = {
        success: true,
        sheetName: selectedSheetName,
        totalRowsRead: rows.length,
        totalCollegesUpdated: entries.length,
        totalSeats,
        colleges: entries.map((entry) => ({
          collegeName: entry.collegeName,
          total: entry.total,
        })),
        timeTakenMs: Date.now() - startedAt,
        message: `Updated ${entries.length} colleges successfully`,
      };

      logger.info("Seat matrix import completed", summary);
      res.status(200).json({ data: summary });
    } catch (error) {
      logger.error("Seat matrix import failed", error);

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
        error: error instanceof Error ? error.message : "Seat matrix import failed",
      });
    }
  },
);

export const assignMeritRanks = onRequest(
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
      const startedAt = Date.now();
      const decodedToken = await requireSignedInUser(req);
      logger.info("Starting merit rank recalculation", {
        uid: decodedToken.uid,
        email: decodedToken.email,
      });

      const snapshot = await db.collection("candidates").get();
      const rankedCandidates = snapshot.docs
        .map((candidateDoc) => ({
          id: candidateDoc.id,
          data: candidateDoc.data() as StoredCandidate,
        }))
        .sort((left, right) => {
          const percentage12Difference =
            getStoredCandidatePercentage12(right.data) - getStoredCandidatePercentage12(left.data);
          if (percentage12Difference !== 0) {
            return percentage12Difference;
          }

          const dobDifference = getStoredCandidateDobTime(left.data) - getStoredCandidateDobTime(right.data);
          if (dobDifference !== 0) {
            return dobDifference;
          }

          return getStoredCandidatePercentage10(right.data) - getStoredCandidatePercentage10(left.data);
        })
        .map((candidate, index) => ({
          ...candidate,
          rank: index + 1,
        }));

      const writes: Array<(batch: WriteBatch) => void> = [];
      rankedCandidates.forEach((candidate) => {
        writes.push((batch) => {
          batch.set(
            db.collection("candidates").doc(candidate.id),
            {
              rank: candidate.rank,
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
            lastRankCalculation: {
              totalCandidates: rankedCandidates.length,
              calculatedByUid: decodedToken.uid,
              calculatedByEmail: decodedToken.email ?? "",
              sortOrder: "Percentage12 DESC, DOB older first, Percentage10 DESC",
              calculatedAt: FieldValue.serverTimestamp(),
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      });

      await commitInChunks(writes);

      const timeTakenMs = Date.now() - startedAt;
      const summary = {
        success: true,
        totalCandidates: rankedCandidates.length,
        totalUpdated: rankedCandidates.length,
        timeTakenMs,
        top5Candidates: rankedCandidates.slice(0, 5).map((candidate) => ({
          registrationId: getStoredCandidateRegistrationId(candidate.data) || candidate.id,
          name: getStoredCandidateName(candidate.data),
          rank: candidate.rank,
          percentage12: getStoredCandidatePercentage12(candidate.data),
          percentage10: getStoredCandidatePercentage10(candidate.data),
          dob: cleanString(candidate.data.dob ?? candidate.data.DOB ?? candidate.data.dateOfBirth),
        })),
        message: `Merit ranks recalculated successfully in ${timeTakenMs} ms`,
      };

      logger.info("Merit rank recalculation completed", summary);
      res.status(200).json({ data: summary });
    } catch (error) {
      logger.error("Merit rank recalculation failed", error);

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
        error: error instanceof Error ? error.message : "Rank recalculation failed",
      });
    }
  },
);
