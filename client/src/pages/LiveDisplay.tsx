import { collection, doc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  categoryColumns,
  formatPercent,
  getCandidateDistrict,
  getCandidateId,
  getCandidateName,
  getCandidateRank,
  getEffectiveCategory,
  getEligibleCategories,
  getOriginalCategory,
  getPercentage12,
  getSeatRemaining,
  type Candidate,
  type LiveCounselingState,
  type SeatMatrixEntry,
} from "../lib/counseling";
import { getFirebaseFirestore } from "../lib/firebase";

function seatColor(remaining: number) {
  if (remaining <= 0) return "border-red-400 bg-red-100 text-red-900";
  return "border-emerald-400 bg-emerald-100 text-emerald-900";
}

function CandidateMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-5">
      <p className="text-lg font-black uppercase tracking-wide text-blue-100">{label}</p>
      <p className="mt-2 text-4xl font-black text-white">{value}</p>
    </div>
  );
}

export function LiveDisplay() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [seatMatrix, setSeatMatrix] = useState<SeatMatrixEntry[]>([]);
  const [liveState, setLiveState] = useState<LiveCounselingState | null>(null);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    const firestore = getFirebaseFirestore();

    const unsubscribeCandidates = onSnapshot(
      collection(firestore, "candidates"),
      (snapshot) => {
        setCandidates(snapshot.docs.map((candidateDoc) => candidateDoc.data() as Candidate));
        setLastUpdated(new Date());
      },
      (snapshotError) => setError(snapshotError.message),
    );

    const unsubscribeSeats = onSnapshot(
      collection(firestore, "seatMatrix"),
      (snapshot) => {
        setSeatMatrix(
          snapshot.docs
            .map((seatDoc) => ({ id: seatDoc.id, ...(seatDoc.data() as Omit<SeatMatrixEntry, "id">) }))
            .sort((left, right) => left.collegeName.localeCompare(right.collegeName)),
        );
        setLastUpdated(new Date());
      },
      (snapshotError) => setError(snapshotError.message),
    );

    const unsubscribeLiveState = onSnapshot(
      doc(firestore, "settings", "liveCounseling"),
      (snapshot) => {
        setLiveState(snapshot.exists() ? (snapshot.data() as LiveCounselingState) : null);
        setLastUpdated(new Date());
      },
      (snapshotError) => setError(snapshotError.message),
    );

    return () => {
      unsubscribeCandidates();
      unsubscribeSeats();
      unsubscribeLiveState();
    };
  }, []);

  const currentCandidate = useMemo(() => {
    const liveCandidateId = liveState?.currentCandidateRegistrationId;

    if (liveCandidateId) {
      return candidates.find((candidate) => getCandidateId(candidate) === liveCandidateId) ?? null;
    }

    return candidates.find((candidate) => candidate.status === "called") ?? null;
  }, [candidates, liveState]);

  const totalRemaining = useMemo(
    () =>
      seatMatrix.reduce(
        (sum, college) =>
          sum + categoryColumns.reduce((innerSum, category) => innerSum + getSeatRemaining(college, category), 0),
        0,
      ),
    [seatMatrix],
  );

  const displaySeatCategories = useMemo(
    () => (currentCandidate ? getEligibleCategories(currentCandidate) : []),
    [currentCandidate],
  );

  const candidateRelevantRemaining = useMemo(
    () =>
      seatMatrix.reduce(
        (sum, college) =>
          sum +
          displaySeatCategories.reduce(
            (categorySum, category) => categorySum + getSeatRemaining(college, category),
            0,
          ),
        0,
      ),
    [displaySeatCategories, seatMatrix],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-govt-900 px-10 py-6">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-xl font-black uppercase tracking-wide text-blue-100">Public Display</p>
            <h1 className="mt-1 text-5xl font-black leading-tight">DPEd 2026-28 Counseling - Live</h1>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-blue-100">Remaining Seats</p>
            <p className="text-5xl font-black text-white">{currentCandidate ? candidateRelevantRemaining : totalRemaining}</p>
          </div>
        </div>
      </header>

      <main className="space-y-8 p-8">
        {error ? (
          <div className="rounded-xl border border-red-400 bg-red-100 px-6 py-4 text-2xl font-black text-red-900">
            Live display error: {error}
          </div>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-govt-900 p-8 shadow-2xl">
          <div className="mb-6 flex items-center justify-between gap-6">
            <h2 className="text-4xl font-black text-white">Currently Called Candidate</h2>
            <div className="rounded-full bg-emerald-400 px-6 py-2 text-xl font-black text-emerald-950">
              LIVE
            </div>
          </div>

          {currentCandidate ? (
            <div className="space-y-7">
              <div className="rounded-2xl bg-white p-8 text-slate-950">
                <p className="text-3xl font-black uppercase tracking-wide text-govt-700">
                  Rank {getCandidateRank(currentCandidate)}
                </p>
                <h3 className="mt-3 text-7xl font-black leading-tight">{getCandidateName(currentCandidate)}</h3>
                <p className="mt-4 text-3xl font-bold text-slate-600">
                  Registration ID: {getCandidateId(currentCandidate)}
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
                <CandidateMetric label="Category" value={getOriginalCategory(currentCandidate)} />
                <CandidateMetric label="Percentage12" value={formatPercent(getPercentage12(currentCandidate))} />
                <CandidateMetric label="District" value={getCandidateDistrict(currentCandidate) || "-"} />
                <CandidateMetric
                  label="Domicile"
                  value={currentCandidate.isPunjabDomicile === false ? "Non-Punjab" : "Punjab"}
                />
                <CandidateMetric label="Status" value={currentCandidate.status ?? "called"} />
              </div>
            </div>
          ) : (
            <div className="flex min-h-80 items-center justify-center rounded-2xl border-4 border-dashed border-white/20 bg-white/5 text-center">
              <div>
                <p className="text-6xl font-black text-white">Please Wait</p>
                <p className="mt-4 text-3xl font-bold text-blue-100">No candidate is currently called.</p>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white p-6 text-slate-950 shadow-2xl">
          <div className="mb-5 flex items-end justify-between gap-6">
            <div>
              <h2 className="text-4xl font-black">
                {currentCandidate
                  ? `Available Seats for ${getCandidateName(currentCandidate)} (${getEffectiveCategory(currentCandidate)})`
                  : "Candidate-Specific Seat Availability"}
              </h2>
              <p className="mt-1 text-xl font-bold text-slate-600">
                {currentCandidate
                  ? `Showing only: ${displaySeatCategories.join(", ")}`
                  : "Call a candidate to show only their eligible seat categories."}
              </p>
            </div>
            <p className="text-lg font-black text-slate-500">
              Updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>

          {currentCandidate ? (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] divide-y divide-slate-200">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-100 px-4 py-4 text-left text-base font-black uppercase text-slate-700">
                      College
                    </th>
                    {displaySeatCategories.map((category) => (
                      <th key={category} className="px-5 py-4 text-center text-base font-black uppercase text-slate-700">
                        {category}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {seatMatrix.map((college) => (
                    <tr key={college.id}>
                      <td className="sticky left-0 max-w-[420px] bg-white px-4 py-4 text-xl font-black">
                        {college.collegeName}
                      </td>
                      {displaySeatCategories.map((category) => {
                        const remaining = getSeatRemaining(college, category);

                        return (
                          <td key={category} className="px-5 py-4 text-center">
                            <div className={`mx-auto min-w-28 rounded-xl border px-4 py-3 ${seatColor(remaining)}`}>
                              <p className="text-6xl font-black">{remaining}</p>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-60 items-center justify-center rounded-2xl border-4 border-dashed border-slate-300 bg-slate-50 text-center">
              <div>
                <p className="text-5xl font-black text-slate-800">Waiting for Candidate</p>
                <p className="mt-4 text-2xl font-bold text-slate-500">
                  Eligible seat availability will appear here after the next candidate is called.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
