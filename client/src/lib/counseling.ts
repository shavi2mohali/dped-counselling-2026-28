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
  "Phy Handicapped",
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
  category?: string;
  effectiveCategoryName?: string;
  percentage12?: number;
  Percentage12?: number;
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
  return candidate.originalCategoryName ?? candidate.Category_Name ?? candidate.category ?? "General";
}

export function getEffectiveCategory(candidate: Candidate) {
  return candidate.effectiveCategoryName ?? candidate.category ?? "General";
}

export function getPercentage12(candidate: Candidate) {
  return candidate.percentage12 ?? candidate.Percentage12;
}

export function isPendingForCall(candidate: Candidate) {
  const status = candidate.status ?? "pending";
  return ["pending", "registered", "eligible", "waiting", "skipped"].includes(status);
}

export function sortByMeritRank(candidates: Candidate[]) {
  return [...candidates].sort((left, right) => getCandidateRank(left) - getCandidateRank(right));
}

export function getSeatRemaining(college: SeatMatrixEntry, category: CategoryColumn) {
  return college.remaining?.[category] ?? college.seats?.[category] ?? 0;
}

export function getSeatFilled(college: SeatMatrixEntry, category: CategoryColumn) {
  return college.filled?.[category] ?? 0;
}

export function getEligibleCategories(candidate: Candidate | null, college: SeatMatrixEntry | null) {
  if (!candidate || !college) {
    return [];
  }

  const availableCategories = categoryColumns.filter((category) => getSeatRemaining(college, category) > 0);

  // Reservation rule: non-Punjab domicile candidates can only be allotted General seats.
  if (candidate.isPunjabDomicile === false) {
    return availableCategories.filter((category) => category === "General");
  }

  const effectiveCategory = getEffectiveCategory(candidate);
  const allowed = new Set<CategoryColumn>(["General"]);

  if (categoryColumns.includes(effectiveCategory as CategoryColumn)) {
    allowed.add(effectiveCategory as CategoryColumn);
  }

  return availableCategories.filter((category) => allowed.has(category));
}

export function formatPercent(value: number | undefined) {
  return value === undefined || Number.isNaN(value) ? "-" : `${value.toFixed(2)}%`;
}
