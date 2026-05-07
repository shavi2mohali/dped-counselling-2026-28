import type { Timestamp } from "firebase/firestore";

export const categoryColumns = [
  "General",
  "EWS",
  "BC",
  "SC (RO)",
  "SC(MB)",
  "Ex serviceman (Gen)",
  "Ex serviceman (BC)",
  "Ex serviceman (SC)",
  "General (FF)",
  "Gen (Sports)",
  "SC (Sports)",
  "Physically Handicapped",
] as const;

export type CategoryColumn = (typeof categoryColumns)[number];

export type CandidateStatus =
  | "pending"
  | "registered"
  | "eligible"
  | "called"
  | "waiting"
  | "absent"
  | "skipped"
  | "allotted"
  | "reported"
  | "cancelled";

export interface Candidate {
  RegistrationId?: string;
  registrationId?: string;
  candidateName?: string;
  Name?: string;
  name?: string;
  originalCategoryName?: string;
  Category_Name?: string;
  categoryName?: string;
  category?: string;
  effectiveCategoryName?: string;
  effectiveCategory?: string;
  percentage12?: number;
  Percentage12?: number;
  district?: string;
  District?: string;
  isPunjabDomicile?: boolean;
  eligibleForReservation?: boolean;
  meritRank?: number;
  rank?: number;
  status?: CandidateStatus;
  calledAt?: Timestamp;
  updatedAt?: Timestamp;
  allottedCollegeId?: string;
  allottedCategory?: CategoryColumn;
}

export interface SeatMatrixEntry {
  id: string;
  collegeName: string;
  seats: Record<CategoryColumn, number>;
  filled?: Partial<Record<CategoryColumn, number>>;
  remaining?: Partial<Record<CategoryColumn, number>>;
  total: number;
}

export interface LiveCounselingState {
  currentCandidateRegistrationId?: string;
  updatedAt?: Timestamp;
}

export function getCandidateId(candidate: Candidate) {
  return candidate.RegistrationId ?? candidate.registrationId ?? "";
}

export function getCandidateName(candidate: Candidate) {
  return candidate.candidateName ?? candidate.Name ?? candidate.name ?? "Unnamed Candidate";
}

export function getCandidateRank(candidate: Candidate) {
  return candidate.meritRank ?? candidate.rank ?? Number.MAX_SAFE_INTEGER;
}

export function getOriginalCategory(candidate: Candidate) {
  return candidate.originalCategoryName ?? candidate.Category_Name ?? candidate.categoryName ?? candidate.category ?? "General";
}

export function getEffectiveCategory(candidate: Candidate) {
  return candidate.effectiveCategoryName ?? candidate.effectiveCategory ?? candidate.category ?? "General";
}

function normalizeCategory(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function mapToOfficialCategory(category: string): CategoryColumn {
  const normalized = normalizeCategory(category);

  if (!normalized || normalized === "general" || normalized === "gen") return "General";
  if (normalized.includes("ews")) return "EWS";
  if (normalized === "bc" || normalized.includes("backwardclass")) return "BC";
  if (normalized.includes("sc") && normalized.includes("sports")) return "SC (Sports)";
  if ((normalized.includes("gen") || normalized.includes("general")) && normalized.includes("sports")) {
    return "Gen (Sports)";
  }
  if (normalized.includes("sc") && normalized.includes("ro")) return "SC (RO)";
  if (normalized.includes("sc") && normalized.includes("mb")) return "SC(MB)";
  if (normalized.includes("ex") && normalized.includes("bc")) return "Ex serviceman (BC)";
  if (normalized.includes("ex") && normalized.includes("sc")) return "Ex serviceman (SC)";
  if (normalized.includes("ex")) return "Ex serviceman (Gen)";
  if (normalized.includes("ff") || normalized.includes("freedomfighter")) return "General (FF)";
  if (normalized.includes("handicapped") || normalized.includes("pwd") || normalized.includes("physically")) {
    return "Physically Handicapped";
  }

  return "General";
}

export function getPercentage12(candidate: Candidate) {
  return candidate.percentage12 ?? candidate.Percentage12;
}

export function getCandidateDistrict(candidate: Candidate) {
  return candidate.district ?? candidate.District ?? "";
}

export function isPendingForCall(candidate: Candidate) {
  const status = candidate.status ?? "pending";
  return status === "pending";
}

export function isDeferredForCall(candidate: Candidate) {
  const status = candidate.status ?? "pending";
  return status === "waiting" || status === "skipped";
}

export function getNextCandidateForCall(candidates: Candidate[]) {
  return candidates.find(isPendingForCall) ?? candidates.find(isDeferredForCall) ?? null;
}

export function sortByMeritRank(candidates: Candidate[]) {
  return [...candidates].sort((left, right) => getCandidateRank(left) - getCandidateRank(right));
}

export function getSeatRemaining(college: SeatMatrixEntry, category: CategoryColumn) {
  if (category === "Physically Handicapped") {
    return college.remaining?.[category] ?? college.remaining?.["Phy Handicapped" as CategoryColumn] ?? college.seats?.[category] ?? college.seats?.["Phy Handicapped" as CategoryColumn] ?? 0;
  }

  return college.remaining?.[category] ?? college.seats?.[category] ?? 0;
}

export function getSeatFilled(college: SeatMatrixEntry, category: CategoryColumn) {
  if (category === "Physically Handicapped") {
    return college.filled?.[category] ?? college.filled?.["Phy Handicapped" as CategoryColumn] ?? 0;
  }

  return college.filled?.[category] ?? 0;
}

export function getEligibleCategories(candidate: Candidate | null): CategoryColumn[] {
  if (!candidate) {
    return [];
  }

  if (candidate.isPunjabDomicile === false) {
    return ["General"];
  }

  const candidateCategory = mapToOfficialCategory(getEffectiveCategory(candidate) || getOriginalCategory(candidate));
  const eligibleCategories = new Set<CategoryColumn>(["General"]);

  if (candidateCategory !== "General") {
    eligibleCategories.add(candidateCategory);
  }

  return Array.from(eligibleCategories);
}

export function getAvailableEligibleCategories(candidate: Candidate | null, college: SeatMatrixEntry | null): CategoryColumn[] {
  if (!candidate || !college) {
    return [];
  }

  return getEligibleCategories(candidate).filter((category) => getSeatRemaining(college, category) > 0);
}

export function formatPercent(value: number | undefined) {
  return value === undefined || Number.isNaN(value) ? "-" : `${value.toFixed(2)}%`;
}
