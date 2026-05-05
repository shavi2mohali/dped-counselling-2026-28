import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as XLSX from "xlsx";
import { emptySeatCounts, SEAT_MATRIX, TOTAL_SEATS } from "./seatMatrix.js";
import type { Candidate, CategoryColumn } from "./models.js";

admin.initializeApp();

const db = getFirestore();

type CandidateImportRow = Record<string, unknown>;

type CandidateColumnKey =
  | "RegistrationId"
  | "Name"
  | "DOB"
  | "Father_Name"
  | "Mother_Name"
  | "Category_Name"
  | "MarksObtained10"
  | "TotalMarks10"
  | "Percentage10"
  | "MarksObtained12"
  | "TotalMarks12"
  | "Percentage12"
  | "District"
  | "State";

type ColumnMap = Partial<Record<CandidateColumnKey, string | string[]>>;

interface ImportCandidatesRequest {
  storagePath: string;
  bucketName?: string;
  sheetName?: string;
  dryRun?: boolean;
  columnMap?: ColumnMap;
}

interface ParsingError {
  rowNumber: number;
  registrationId?: string;
  message: string;
}

const DEFAULT_COLUMN_ALIASES: Record<CandidateColumnKey, string[]> = {
  RegistrationId: ["RegistrationId", "Registration ID", "Registration_Id", "RegId", "Reg ID", "Application No"],
  Name: ["Name", "Candidate Name", "CandidateName", "Student Name", "Applicant Name"],
  DOB: ["DOB", "Date of Birth", "DateOfBirth", "Birth Date"],
  Father_Name: ["Father_Name", "Father Name", "FatherName", "Father's Name"],
  Mother_Name: ["Mother_Name", "Mother Name", "MotherName", "Mother's Name"],
  Category_Name: ["Category_Name", "Category Name", "CategoryName", "Category"],
  MarksObtained10: ["MarksObtained10", "Marks Obtained 10", "10th Marks Obtained", "Matric Marks Obtained"],
  TotalMarks10: ["TotalMarks10", "Total Marks 10", "10th Total Marks", "Matric Total Marks"],
  Percentage10: ["Percentage10", "Percentage 10", "10th Percentage", "Matric Percentage"],
  MarksObtained12: ["MarksObtained12", "Marks Obtained 12", "12th Marks Obtained", "Senior Secondary Marks Obtained"],
  TotalMarks12: ["TotalMarks12", "Total Marks 12", "12th Total Marks", "Senior Secondary Total Marks"],
  Percentage12: ["Percentage12", "Percentage 12", "12th Percentage", "Senior Secondary Percentage"],
  District: ["District", "District Name", "Domicile District"],
  State: ["State", "State Name", "Domicile State"],
};

function normalizeLocationName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bdistrict\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const PUNJAB_DISTRICTS = new Set([
  "amritsar",
  "barnala",
  "bathinda",
  "faridkot",
  "fatehgarh sahib",
  "fazilka",
  "ferozepur",
  "firozpur",
  "gurdaspur",
  "hoshiarpur",
  "jalandhar",
  "kapurthala",
  "ludhiana",
  "malerkotla",
  "mansa",
  "moga",
  "pathankot",
  "patiala",
  "rupnagar",
  "ropar",
  "sahibzada ajit singh nagar",
  "sas nagar",
  "mohali",
  "sangrur",
  "shaheed bhagat singh nagar",
  "sbs nagar",
  "nawanshahr",
  "sri muktsar sahib",
  "muktsar",
  "tarn taran",
].map(normalizeLocationName));

const RESERVED_CATEGORY_TOKENS = [
  "bc",
  "ews",
  "sc",
  "sports",
  "ex serviceman",
  "ex-serviceman",
  "freedom fighter",
  "ff",
  "handicapped",
  "physically handicapped",
  "phy",
];

const requireAdmin = (request: { auth?: { token?: Record<string, unknown> } }) => {
  if (request.auth?.token?.admin !== true) {
    throw new HttpsError("permission-denied", "Only Admin users can import candidates.");
  }
};

const normalizeHeader = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeString = (value: unknown): string => String(value ?? "").trim();

const normalizeNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : undefined;
};

const roundPercentage = (value: number): number => Math.round(value * 10000) / 10000;

const calculatePercentage = (marks?: number, total?: number, provided?: number): number | undefined => {
  if (provided !== undefined) {
    return roundPercentage(provided);
  }

  if (marks === undefined || total === undefined || total <= 0) {
    return undefined;
  }

  return roundPercentage((marks / total) * 100);
};

const toAliasList = (value: string | string[] | undefined): string[] => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const buildColumnLookup = (row: CandidateImportRow): Map<string, string> => {
  const lookup = new Map<string, string>();

  for (const key of Object.keys(row)) {
    lookup.set(normalizeHeader(key), key);
  }

  return lookup;
};

const getCell = (
  row: CandidateImportRow,
  lookup: Map<string, string>,
  key: CandidateColumnKey,
  columnMap?: ColumnMap,
): unknown => {
  const aliases = [...toAliasList(columnMap?.[key]), ...DEFAULT_COLUMN_ALIASES[key]];

  for (const alias of aliases) {
    const actualKey = lookup.get(normalizeHeader(alias));
    if (actualKey !== undefined) {
      return row[actualKey];
    }
  }

  return undefined;
};

const parseDob = (value: unknown): { display?: string; date?: Date } => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { display: value.toISOString().slice(0, 10), date: value };
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      return { display: date.toISOString().slice(0, 10), date };
    }
  }

  const text = normalizeString(value);
  if (!text) {
    return {};
  }

  const match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3].length === 2 ? `19${match[3]}` : match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (!Number.isNaN(date.getTime())) {
      return { display: date.toISOString().slice(0, 10), date };
    }
  }

  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) {
    return { display: direct.toISOString().slice(0, 10), date: direct };
  }

  return { display: text };
};

const isPunjabDomicile = (district: string, state: string): boolean => {
  const normalizedDistrict = normalizeLocationName(district);
  const normalizedState = state.toLowerCase();

  return normalizedState.includes("punjab") || PUNJAB_DISTRICTS.has(normalizedDistrict);
};

const isReservedCategory = (category: string): boolean => {
  const normalized = category.toLowerCase();
  return RESERVED_CATEGORY_TOKENS.some((token) => normalized.includes(token));
};

const mapEffectiveCategory = (category: string, punjabDomicile: boolean): CategoryColumn | "General" => {
  if (!punjabDomicile) {
    return "General";
  }

  const normalized = category.toLowerCase().replace(/\s+/g, " ").trim();

  if (normalized.includes("sc") && normalized.includes("sports")) return "SC (Sports)";
  if (normalized.includes("general") && normalized.includes("sports")) return "Gen (Sports)";
  if (normalized.includes("sports")) return "Gen (Sports)";
  if (normalized.includes("ews")) return "EWS";
  if (normalized === "bc" || normalized.includes("backward")) return "BC";
  if (normalized.includes("sc") && normalized.includes("ro")) return "SC (RO)";
  if (normalized.includes("sc") && normalized.includes("mb")) return "SC(MB)";
  if (normalized.includes("freedom") || normalized.includes("ff")) return "General (FF)";
  if (normalized.includes("handicapped") || normalized.includes("pwd") || normalized.includes("phy")) {
    return "Phy Handicapped";
  }
  if (normalized.includes("ex") && normalized.includes("bc")) return "Ex serviceman (BC)";
  if (normalized.includes("ex") && normalized.includes("sc")) return "Ex serviceman (SC)";
  if (normalized.includes("ex")) return "Ex serviceman (Gen)";

  return "General";
};

const commitInChunks = async (writes: Array<(batch: admin.firestore.WriteBatch) => void>) => {
  const chunkSize = 450;

  for (let index = 0; index < writes.length; index += chunkSize) {
    const batch = db.batch();
    for (const write of writes.slice(index, index + chunkSize)) {
      write(batch);
    }
    await batch.commit();
  }
};

const mapCandidateRow = (
  row: CandidateImportRow,
  rowNumber: number,
  now: admin.firestore.Timestamp,
  columnMap?: ColumnMap,
): { candidate?: Candidate; error?: ParsingError } => {
  const lookup = buildColumnLookup(row);
  const RegistrationId = normalizeString(getCell(row, lookup, "RegistrationId", columnMap));
  const candidateName = normalizeString(getCell(row, lookup, "Name", columnMap));
  const dob = parseDob(getCell(row, lookup, "DOB", columnMap));
  const originalCategoryName = normalizeString(getCell(row, lookup, "Category_Name", columnMap)) || "General";
  const district = normalizeString(getCell(row, lookup, "District", columnMap));
  const state = normalizeString(getCell(row, lookup, "State", columnMap));

  if (!RegistrationId) {
    return { error: { rowNumber, message: "Missing required RegistrationId." } };
  }

  if (!candidateName) {
    return { error: { rowNumber, registrationId: RegistrationId, message: "Missing required Name." } };
  }

  if (!dob.date) {
    return { error: { rowNumber, registrationId: RegistrationId, message: "Missing or invalid DOB." } };
  }

  if (!district && !state) {
    return {
      error: {
        rowNumber,
        registrationId: RegistrationId,
        message: "Missing District and State. At least one is required for Punjab domicile check.",
      },
    };
  }

  const marksObtained10 = normalizeNumber(getCell(row, lookup, "MarksObtained10", columnMap));
  const totalMarks10 = normalizeNumber(getCell(row, lookup, "TotalMarks10", columnMap));
  const percentage10 = calculatePercentage(
    marksObtained10,
    totalMarks10,
    normalizeNumber(getCell(row, lookup, "Percentage10", columnMap)),
  );
  const marksObtained12 = normalizeNumber(getCell(row, lookup, "MarksObtained12", columnMap));
  const totalMarks12 = normalizeNumber(getCell(row, lookup, "TotalMarks12", columnMap));
  const percentage12 = calculatePercentage(
    marksObtained12,
    totalMarks12,
    normalizeNumber(getCell(row, lookup, "Percentage12", columnMap)),
  );

  if (percentage10 === undefined) {
    return {
      error: {
        rowNumber,
        registrationId: RegistrationId,
        message: "Missing Percentage10 or valid MarksObtained10/TotalMarks10.",
      },
    };
  }

  if (percentage12 === undefined) {
    return {
      error: {
        rowNumber,
        registrationId: RegistrationId,
        message: "Missing Percentage12 or valid MarksObtained12/TotalMarks12.",
      },
    };
  }

  const punjabDomicile = isPunjabDomicile(district, state);
  const reservedCategory = isReservedCategory(originalCategoryName);
  const effectiveCategoryName = mapEffectiveCategory(originalCategoryName, punjabDomicile);
  const categoryChangedDueToDomicile = !punjabDomicile && reservedCategory && effectiveCategoryName === "General";

  return {
    candidate: {
      RegistrationId,
      candidateName,
      fatherName: normalizeString(getCell(row, lookup, "Father_Name", columnMap)) || undefined,
      motherName: normalizeString(getCell(row, lookup, "Mother_Name", columnMap)) || undefined,
      dateOfBirth: dob.display,
      dobTimestamp: admin.firestore.Timestamp.fromDate(dob.date),
      category: effectiveCategoryName,
      originalCategoryName,
      effectiveCategoryName,
      isPunjabDomicile: punjabDomicile,
      eligibleForReservation: punjabDomicile && reservedCategory,
      categoryChangedDueToDomicile,
      district: district || undefined,
      state: state || undefined,
      marksObtained10,
      totalMarks10,
      percentage10,
      marksObtained12,
      totalMarks12,
      percentage12,
      meritScore: percentage12,
      preferences: [],
      status: "registered",
      importedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  };
};

const assignMeritRanks = (candidates: Candidate[]): Candidate[] =>
  [...candidates]
    .sort((left, right) => {
      const percentage12Diff = (right.percentage12 ?? -1) - (left.percentage12 ?? -1);
      if (percentage12Diff !== 0) return percentage12Diff;

      const percentage10Diff = (right.percentage10 ?? -1) - (left.percentage10 ?? -1);
      if (percentage10Diff !== 0) return percentage10Diff;

      const leftDob = left.dobTimestamp?.toMillis() ?? Number.MAX_SAFE_INTEGER;
      const rightDob = right.dobTimestamp?.toMillis() ?? Number.MAX_SAFE_INTEGER;
      return leftDob - rightDob;
    })
    .map((candidate, index) => ({
      ...candidate,
      meritRank: index + 1,
    }));

export const importCandidates = onCall<ImportCandidatesRequest>(async (request) => {
  requireAdmin(request);

  const { storagePath, bucketName, sheetName, dryRun = false, columnMap } = request.data;

  if (!storagePath) {
    throw new HttpsError("invalid-argument", "storagePath is required.");
  }

  const file = bucketName ? getStorage().bucket(bucketName).file(storagePath) : getStorage().bucket().file(storagePath);
  const [exists] = await file.exists();

  if (!exists) {
    throw new HttpsError("not-found", `Excel file not found in Firebase Storage: ${storagePath}`);
  }

  let fileBuffer: Buffer;
  try {
    [fileBuffer] = await file.download();
  } catch (error) {
    throw new HttpsError("internal", "Failed to download Excel file from Firebase Storage.", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
  } catch (error) {
    throw new HttpsError("invalid-argument", "Uploaded file could not be read as an Excel workbook.", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const selectedSheetName = sheetName ?? workbook.SheetNames[0];
  const worksheet = workbook.Sheets[selectedSheetName];

  if (!worksheet) {
    throw new HttpsError("invalid-argument", `Sheet not found: ${selectedSheetName}`);
  }

  const rows = XLSX.utils.sheet_to_json<CandidateImportRow>(worksheet, { defval: "", raw: true });

  if (rows.length === 0) {
    throw new HttpsError("invalid-argument", `Sheet has no candidate rows: ${selectedSheetName}`);
  }

  const now = admin.firestore.Timestamp.now();
  const parsingErrors: ParsingError[] = [];
  const parsedCandidates: Candidate[] = [];
  const seenRegistrationIds = new Set<string>();

  rows.forEach((row, index) => {
    const result = mapCandidateRow(row, index + 2, now, columnMap);
    if (result.error) {
      parsingErrors.push(result.error);
      return;
    }

    if (result.candidate) {
      if (seenRegistrationIds.has(result.candidate.RegistrationId)) {
        parsingErrors.push({
          rowNumber: index + 2,
          registrationId: result.candidate.RegistrationId,
          message: "Duplicate RegistrationId in Excel file. This row was skipped.",
        });
        return;
      }

      seenRegistrationIds.add(result.candidate.RegistrationId);
      parsedCandidates.push(result.candidate);
    }
  });

  const candidates = assignMeritRanks(parsedCandidates);
  const punjabDomicileCount = candidates.filter((candidate) => candidate.isPunjabDomicile).length;
  const nonPunjabDomicileCount = candidates.length - punjabDomicileCount;
  const categoryChangedToGeneralDueToNonDomicile = candidates.filter(
    (candidate) => candidate.categoryChangedDueToDomicile,
  ).length;
  const top5Candidates = candidates.slice(0, 5).map((candidate) => ({
    RegistrationId: candidate.RegistrationId,
    name: candidate.candidateName,
    meritRank: candidate.meritRank,
    percentage12: candidate.percentage12,
    percentage10: candidate.percentage10,
    category: candidate.category,
    originalCategoryName: candidate.originalCategoryName,
    isPunjabDomicile: candidate.isPunjabDomicile,
  }));

  const summary = {
    dryRun,
    storagePath,
    sheetName: selectedSheetName,
    totalRowsRead: rows.length,
    totalCandidatesImported: candidates.length,
    punjabDomicileCount,
    nonPunjabDomicileCount,
    categoryChangedToGeneralDueToNonDomicile,
    initializedSeatMatrixColleges: SEAT_MATRIX.length,
    totalSeats: TOTAL_SEATS,
    top5Candidates,
    parsingErrors,
  };

  if (dryRun) {
    return summary;
  }

  const writes: Array<(batch: admin.firestore.WriteBatch) => void> = [];

  for (const candidate of candidates) {
    writes.push((batch) => {
      batch.set(db.collection("candidates").doc(candidate.RegistrationId), candidate, { merge: true });
    });
  }

  for (const college of SEAT_MATRIX) {
    writes.push((batch) => {
      batch.set(
        db.collection("seatMatrix").doc(college.collegeName),
        {
          ...college,
          filled: emptySeatCounts(),
          remaining: college.seats,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true },
      );
    });
  }

  writes.push((batch) => {
    batch.set(
      db.collection("settings").doc("global"),
      {
        counsellingSession: "2026-28",
        sourceSeatMatrixSession: "2025-27",
        currentRound: 1,
        allotmentStatus: "draft",
        liveDisplayEnabled: false,
        candidateImportEnabled: true,
        totalSeats: TOTAL_SEATS,
        lastCandidateImport: {
          storagePath,
          sheetName: selectedSheetName,
          importedCandidates: candidates.length,
          parsingErrorCount: parsingErrors.length,
          importedByUid: request.auth?.uid,
          importedAt: now,
        },
        updatedByUid: request.auth?.uid,
        updatedAt: now,
      },
      { merge: true },
    );
  });

  await commitInChunks(writes);

  return summary;
});
