import type { Timestamp } from "firebase-admin/firestore";

export const CATEGORY_COLUMNS = [
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

export type CategoryColumn = (typeof CATEGORY_COLUMNS)[number];
export type SeatCounts = Record<CategoryColumn, number>;

export type CandidateStatus =
  | "registered"
  | "eligible"
  | "called"
  | "waiting"
  | "absent"
  | "withheld"
  | "allotted"
  | "reported"
  | "cancelled";

export interface Candidate {
  RegistrationId: string;
  candidateName: string;
  fatherName?: string;
  motherName?: string;
  dateOfBirth?: string;
  dobTimestamp?: Timestamp;
  gender?: string;
  mobile?: string;
  email?: string;
  pinCode?: string;
  result?: string;
  photoUrl?: string;
  category: CategoryColumn | string;
  originalCategoryName: string;
  effectiveCategoryName: CategoryColumn | "General";
  isPunjabDomicile: boolean;
  eligibleForReservation: boolean;
  categoryChangedDueToDomicile: boolean;
  district?: string;
  state?: string;
  marksObtained10?: number;
  totalMarks10?: number;
  percentage10?: number;
  marksObtained12?: number;
  totalMarks12?: number;
  percentage12?: number;
  meritRank?: number;
  meritScore?: number;
  preferences?: string[];
  status: CandidateStatus;
  allottedCollegeId?: string;
  allottedCategory?: CategoryColumn;
  allotmentRound?: number;
  remarks?: string;
  importedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SeatMatrixEntry {
  collegeName: string;
  seats: SeatCounts;
  total: number;
  filled: SeatCounts;
  remaining: SeatCounts;
  isActive: boolean;
  sourceSession: "2025-27";
  counsellingSession: "2026-28";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AllotmentLog {
  candidateRegistrationId: string;
  collegeName: string;
  category: CategoryColumn;
  round: number;
  action: "allotted" | "upgraded" | "cancelled" | "reported" | "manual_adjustment";
  previousCollegeName?: string;
  previousCategory?: CategoryColumn;
  performedByUid: string;
  performedByName?: string;
  reason?: string;
  createdAt: Timestamp;
}

export interface Settings {
  counsellingSession: "2026-28";
  sourceSeatMatrixSession: "2025-27";
  currentRound: number;
  allotmentStatus: "draft" | "locked" | "published";
  liveDisplayEnabled: boolean;
  candidateImportEnabled: boolean;
  totalSeats: 350;
  updatedByUid?: string;
  updatedAt: Timestamp;
}
