import type { Candidate, CategoryColumn, SeatMatrixEntry } from "../models/counselling";

export const categoryColumns: CategoryColumn[] = [
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
];

export function getCandidateEligibleCategories(candidate: Candidate | null, selectedCollege?: SeatMatrixEntry | null) {
  if (!candidate) {
    return [];
  }

  const available = categoryColumns.filter((category) => (selectedCollege?.remaining?.[category] ?? 0) > 0);

  if (!candidate.isPunjabDomicile) {
    return available.filter((category) => category === "General");
  }

  const preferred = new Set<CategoryColumn>(["General"]);
  if (categoryColumns.includes(candidate.effectiveCategoryName as CategoryColumn)) {
    preferred.add(candidate.effectiveCategoryName as CategoryColumn);
  }

  return available.filter((category) => preferred.has(category));
}

export function sumSeats(seatMatrix: SeatMatrixEntry[], field: "total" | "filled" | "remaining") {
  if (field === "total") {
    return seatMatrix.reduce((sum, college) => sum + college.total, 0);
  }

  return seatMatrix.reduce(
    (sum, college) => sum + categoryColumns.reduce((innerSum, category) => innerSum + (college[field]?.[category] ?? 0), 0),
    0,
  );
}

export function statusBadgeClass(status: string) {
  switch (status) {
    case "allotted":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "called":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "waiting":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "absent":
      return "bg-red-50 text-red-700 ring-red-200";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-200";
  }
}

export function formatNumber(value: number | undefined, digits = 2) {
  if (value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return value.toFixed(digits);
}
