import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  categoryColumns,
  getCandidateDistrict,
  getCandidateId,
  getCandidateName,
  getCandidateRank,
  getEffectiveCategory,
  getOriginalCategory,
  getPercentage12,
  getSeatFilled,
  getSeatRemaining,
  type Candidate,
  type SeatMatrixEntry,
} from "../lib/counseling";
import { getFirebaseFirestore } from "../lib/firebase";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function csvValue(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number | boolean | undefined>>) {
  const csv = rows.map((row) => row.map(csvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [seatMatrix, setSeatMatrix] = useState<SeatMatrixEntry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const firestore = getFirebaseFirestore();
    const unsubscribeCandidates = onSnapshot(
      collection(firestore, "candidates"),
      (snapshot) => setCandidates(snapshot.docs.map((candidateDoc) => candidateDoc.data() as Candidate)),
      (snapshotError) => setError(snapshotError.message),
    );
    const unsubscribeSeats = onSnapshot(
      collection(firestore, "seatMatrix"),
      (snapshot) =>
        setSeatMatrix(
          snapshot.docs
            .map((seatDoc) => ({ id: seatDoc.id, ...(seatDoc.data() as Omit<SeatMatrixEntry, "id">) }))
            .sort((left, right) => left.collegeName.localeCompare(right.collegeName)),
        ),
      (snapshotError) => setError(snapshotError.message),
    );

    return () => {
      unsubscribeCandidates();
      unsubscribeSeats();
    };
  }, []);

  const stats = useMemo(() => {
    const allotted = candidates.filter((candidate) => candidate.status === "allotted").length;
    const pending = candidates.filter((candidate) => (candidate.status ?? "pending") === "pending").length;
    const absent = candidates.filter((candidate) => candidate.status === "absent").length;
    const punjab = candidates.filter((candidate) => candidate.isPunjabDomicile).length;

    return { absent, allotted, pending, punjab, total: candidates.length };
  }, [candidates]);

  const collegeSummary = useMemo(
    () =>
      seatMatrix.map((college) => {
        const filled = categoryColumns.reduce((sum, category) => sum + getSeatFilled(college, category), 0);
        const remaining = categoryColumns.reduce((sum, category) => sum + getSeatRemaining(college, category), 0);
        return { collegeName: college.collegeName, filled, remaining, total: college.total };
      }),
    [seatMatrix],
  );

  const categorySummary = useMemo(
    () =>
      categoryColumns.map((category) => {
        const filled = seatMatrix.reduce((sum, college) => sum + getSeatFilled(college, category), 0);
        const remaining = seatMatrix.reduce((sum, college) => sum + getSeatRemaining(college, category), 0);
        return { category, filled, remaining, total: filled + remaining };
      }),
    [seatMatrix],
  );

  const exportFullCandidates = () => {
    downloadCsv("full-candidate-list.csv", [
      ["Rank", "RegistrationId", "Name", "District", "Original Category", "Effective Category", "Percentage12", "Status"],
      ...candidates
        .slice()
        .sort((left, right) => getCandidateRank(left) - getCandidateRank(right))
        .map((candidate) => [
          getCandidateRank(candidate),
          getCandidateId(candidate),
          getCandidateName(candidate),
          getCandidateDistrict(candidate),
          getOriginalCategory(candidate),
          getEffectiveCategory(candidate),
          getPercentage12(candidate),
          candidate.status ?? "pending",
        ]),
    ]);
  };

  const exportFinalAllotment = () => {
    downloadCsv("final-allotment-list.csv", [
      ["Rank", "RegistrationId", "Name", "College", "Category", "Status"],
      ...candidates
        .filter((candidate) => candidate.status === "allotted")
        .sort((left, right) => getCandidateRank(left) - getCandidateRank(right))
        .map((candidate) => [
          getCandidateRank(candidate),
          getCandidateId(candidate),
          getCandidateName(candidate),
          candidate.allottedCollegeId ?? "",
          candidate.allottedCategory ?? getEffectiveCategory(candidate),
          candidate.status ?? "",
        ]),
    ]);
  };

  const exportSeatStatus = () => {
    downloadCsv("college-wise-seat-status.csv", [
      ["College", "Category", "Filled", "Remaining", "Total"],
      ...seatMatrix.flatMap((college) =>
        categoryColumns.map((category) => [
          college.collegeName,
          category,
          getSeatFilled(college, category),
          getSeatRemaining(college, category),
          getSeatFilled(college, category) + getSeatRemaining(college, category),
        ]),
      ),
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-govt-700">Reports</p>
          <h2 className="mt-1 text-3xl font-black text-slate-950">Counseling Reports</h2>
          <p className="mt-2 text-base font-medium text-slate-600">
            Live summaries and export files for candidate, allotment, and seat status records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg bg-govt-700 px-4 py-3 text-sm font-black text-white" type="button" onClick={exportFullCandidates}>
            Full Candidate List
          </button>
          <button className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white" type="button" onClick={exportFinalAllotment}>
            Final Allotment List
          </button>
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700" type="button" onClick={exportSeatStatus}>
            College-wise Seat Status
          </button>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Candidates" value={stats.total} />
        <StatCard label="Pending" value={stats.pending} />
        <StatCard label="Allotted" value={stats.allotted} />
        <StatCard label="Absent" value={stats.absent} />
        <StatCard label="Punjab Domicile" value={stats.punjab} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-black text-slate-950">College-wise Allotment Summary</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["College", "Filled", "Remaining", "Total"].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left font-black uppercase text-slate-600">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {collegeSummary.map((college) => (
                <tr key={college.collegeName}>
                  <td className="px-4 py-3 font-bold">{college.collegeName}</td>
                  <td className="px-4 py-3">{college.filled}</td>
                  <td className="px-4 py-3">{college.remaining}</td>
                  <td className="px-4 py-3">{college.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-black text-slate-950">Category-wise Summary</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {categorySummary.map((item) => (
            <div key={item.category} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-black text-slate-950">{item.category}</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Filled {item.filled} · Remaining {item.remaining} · Total {item.total}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
