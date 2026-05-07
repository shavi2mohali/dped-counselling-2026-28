import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLiveCounselingData } from "../hooks/useLiveCounselingData";
import {
  categoryColumns,
  formatPercent,
  getCandidateId,
  getCandidateName,
  getCandidateRank,
  getCandidateDistrict,
  getEffectiveCategory,
  getAvailableEligibleCategories,
  getEligibleCategories,
  getNextCandidateForCall,
  getOriginalCategory,
  getPercentage12,
  getSeatFilled,
  getSeatRemaining,
  isDeferredForCall,
  isPendingForCall,
  type Candidate,
  type CategoryColumn,
  type SeatMatrixEntry,
} from "../lib/counseling";
import { getFirebaseFirestore } from "../lib/firebase";

type ActionState = "idle" | "calling" | "allotting" | "absent" | "waiting" | "skipping";

function CandidateDetail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function StatusMessage({ message, tone }: { message: string; tone: "success" | "error" | "info" }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "error"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-blue-200 bg-blue-50 text-blue-800";

  return <div className={`rounded-lg border px-4 py-3 text-base font-bold ${toneClass}`}>{message}</div>;
}

function hasAnyRemainingSeat(college: SeatMatrixEntry) {
  return categoryColumns.some((category) => getSeatRemaining(college, category) > 0);
}

function getSeatTone(remaining: number) {
  if (remaining <= 0) {
    return "border-red-300 bg-red-50 text-red-800";
  }

  if (remaining <= 2) {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }

  return "border-emerald-300 bg-emerald-50 text-emerald-800";
}

export function LiveCounselingPanel() {
  const { user } = useAuth();
  const { candidates, error: dataError, liveState, loading, seatMatrix } = useLiveCounselingData();
  const [selectedCollegeId, setSelectedCollegeId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryColumn | "">("");
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const firestore = getFirebaseFirestore();

  const currentCandidate = useMemo(() => {
    const liveCandidateId = liveState?.currentCandidateRegistrationId;

    if (liveCandidateId) {
      return candidates.find((candidate) => getCandidateId(candidate) === liveCandidateId) ?? null;
    }

    return candidates.find((candidate) => candidate.status === "called") ?? null;
  }, [candidates, liveState]);

  const selectedCollege = useMemo(
    () => seatMatrix.find((college) => college.id === selectedCollegeId) ?? null,
    [seatMatrix, selectedCollegeId],
  );

  const eligibleCategories = useMemo(
    () => getAvailableEligibleCategories(currentCandidate, selectedCollege),
    [currentCandidate, selectedCollege],
  );

  const candidateEligibleCategories = useMemo(
    () => getEligibleCategories(currentCandidate),
    [currentCandidate],
  );

  const collegesWithAvailableSeats = useMemo(() => seatMatrix.filter(hasAnyRemainingSeat), [seatMatrix]);

  const nextCandidates = useMemo(
    () => {
      const pendingCandidates = candidates.filter(isPendingForCall);
      const deferredCandidates = pendingCandidates.length === 0 ? candidates.filter(isDeferredForCall) : [];
      return [...pendingCandidates, ...deferredCandidates].slice(0, 6);
    },
    [candidates],
  );

  const totalRemainingSeats = useMemo(
    () =>
      seatMatrix.reduce(
        (sum, college) =>
          sum + categoryColumns.reduce((categorySum, category) => categorySum + getSeatRemaining(college, category), 0),
        0,
      ),
    [seatMatrix],
  );

  useEffect(() => {
    setSelectedCategory("");
  }, [currentCandidate, selectedCollegeId]);

  const runAction = async (state: ActionState, action: () => Promise<void>, successMessage: string) => {
    setActionState(state);
    setError("");
    setMessage("");

    try {
      await action();
      setMessage(successMessage);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed. Please try again.");
    } finally {
      setActionState("idle");
    }
  };

  const callCandidate = async (candidate: Candidate) => {
    const candidateId = getCandidateId(candidate);

    if (!candidateId) {
      throw new Error("Next candidate does not have a valid RegistrationId.");
    }

    await updateDoc(doc(firestore, "candidates", candidateId), {
      status: "called",
      calledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(
      doc(firestore, "settings", "liveCounseling"),
      {
        currentCandidateRegistrationId: candidateId,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    setSelectedCollegeId("");
    setSelectedCategory("");
  };

  const callNextCandidate = () =>
    runAction(
      "calling",
      async () => {
        const nextCandidate = getNextCandidateForCall(candidates);

        if (!nextCandidate) {
          throw new Error("No pending, waiting, or skipped candidate is available to call.");
        }

        await callCandidate(nextCandidate);
      },
      "Next candidate called by overall merit rank.",
    );

  const updateCandidateStatus = (candidate: Candidate, status: "absent" | "waiting" | "skipped") =>
    runAction(
      status === "absent" ? "absent" : status === "waiting" ? "waiting" : "skipping",
      async () => {
        const candidateId = getCandidateId(candidate);

        if (!candidateId) {
          throw new Error("Current candidate does not have a valid RegistrationId.");
        }

        const nextCandidate =
          status === "skipped"
            ? getNextCandidateForCall(candidates.filter((queueCandidate) => getCandidateId(queueCandidate) !== candidateId))
            : null;

        if (nextCandidate) {
          const nextCandidateId = getCandidateId(nextCandidate);

          if (!nextCandidateId) {
            throw new Error("Next candidate does not have a valid RegistrationId.");
          }

          await runTransaction(firestore, async (transaction) => {
            transaction.update(doc(firestore, "candidates", candidateId), {
              status,
              updatedAt: serverTimestamp(),
            });

            transaction.update(doc(firestore, "candidates", nextCandidateId), {
              status: "called",
              calledAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            transaction.set(
              doc(firestore, "settings", "liveCounseling"),
              {
                currentCandidateRegistrationId: nextCandidateId,
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
          });
        } else {
          await updateDoc(doc(firestore, "candidates", candidateId), {
            status,
            updatedAt: serverTimestamp(),
          });

          await setDoc(
            doc(firestore, "settings", "liveCounseling"),
            {
              currentCandidateRegistrationId: null,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        }

        setSelectedCollegeId("");
        setSelectedCategory("");
      },
      status === "absent"
        ? "Candidate marked absent."
        : status === "waiting"
          ? "Candidate moved to waiting."
          : "Candidate skipped. Next candidate called automatically.",
    );

  const allotSeat = () =>
    runAction(
      "allotting",
      async () => {
        if (!currentCandidate) {
          throw new Error("No candidate is currently called.");
        }

        if (!selectedCollege || !selectedCategory) {
          throw new Error("Select a college and available category before allotment.");
        }

        if (currentCandidate.isPunjabDomicile === false && selectedCategory !== "General") {
          throw new Error("Non-Punjab candidates can only be allotted General seats.");
        }

        if (!eligibleCategories.includes(selectedCategory)) {
          throw new Error("Selected category is not available or not eligible for this candidate.");
        }

        const candidateId = getCandidateId(currentCandidate);

        if (!candidateId) {
          throw new Error("Current candidate does not have a valid RegistrationId.");
        }

        const seatRef = doc(firestore, "seatMatrix", selectedCollege.id);
        const candidateRef = doc(firestore, "candidates", candidateId);
        const liveStateRef = doc(firestore, "settings", "liveCounseling");
        const allotmentRef = doc(collection(firestore, "allotments"));

        await runTransaction(firestore, async (transaction) => {
          const seatSnapshot = await transaction.get(seatRef);

          if (!seatSnapshot.exists()) {
            throw new Error("Selected college was not found in seatMatrix.");
          }

          const seatData = seatSnapshot.data() as typeof selectedCollege;
          const categoryKey =
            selectedCategory === "Physically Handicapped" &&
            seatData.remaining?.["Physically Handicapped"] === undefined &&
            seatData.seats?.["Physically Handicapped"] === undefined
              ? ("Phy Handicapped" as CategoryColumn)
              : selectedCategory;
          const remaining = seatData.remaining?.[categoryKey] ?? seatData.seats?.[categoryKey] ?? 0;
          const filled = seatData.filled?.[categoryKey] ?? 0;

          if (remaining <= 0) {
            throw new Error(`${selectedCategory} seats are full at ${selectedCollege.collegeName}.`);
          }

          transaction.update(seatRef, {
            [`remaining.${categoryKey}`]: remaining - 1,
            [`filled.${categoryKey}`]: filled + 1,
            updatedAt: serverTimestamp(),
          });

          transaction.update(candidateRef, {
            status: "allotted",
            allottedCollegeId: selectedCollege.collegeName,
            allottedCategory: selectedCategory,
            updatedAt: serverTimestamp(),
          });

          transaction.set(allotmentRef, {
            candidateRegistrationId: candidateId,
            candidateName: getCandidateName(currentCandidate),
            collegeName: selectedCollege.collegeName,
            category: selectedCategory,
            seatMatrixCategoryKey: categoryKey,
            action: "allotted",
            performedByUid: user?.uid ?? "unknown",
            performedByEmail: user?.email ?? "",
            createdAt: serverTimestamp(),
          });

          transaction.set(
            liveStateRef,
            {
              currentCandidateRegistrationId: null,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        });

        setSelectedCollegeId("");
        setSelectedCategory("");
      },
      "Seat allotted successfully. Seat availability updated in real time.",
    );

  const actionInProgress = actionState !== "idle";

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-xl border border-blue-100 bg-white px-8 py-6 text-xl font-black text-govt-900 shadow-sm">
          Loading live counseling data...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-base font-black uppercase tracking-wide text-govt-700">Live Counseling Control</p>
            <h1 className="mt-1 text-4xl font-black text-slate-950 md:text-5xl">
              DPEd 2026-28 Counseling - Live Session
            </h1>
            <p className="mt-2 text-lg font-semibold text-slate-600">
              Call candidates by merit rank, allot seats, and update the public workflow in real time.
            </p>
          </div>

          <button
            type="button"
            onClick={callNextCandidate}
            disabled={actionInProgress}
            className="min-h-20 rounded-xl bg-govt-700 px-10 text-2xl font-black text-white shadow-sm transition hover:bg-govt-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {actionState === "calling" ? "Calling..." : "Call Next Candidate"}
          </button>
        </div>
      </header>

      {dataError ? <StatusMessage tone="error" message={`Firestore error: ${dataError}`} /> : null}
      {error ? <StatusMessage tone="error" message={error} /> : null}
      {message ? <StatusMessage tone="success" message={message} /> : null}

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-black text-slate-950">Current Candidate</h2>
            <div className="rounded-full bg-blue-50 px-4 py-2 text-base font-black text-govt-800">
              Remaining Seats: {totalRemainingSeats}
            </div>
          </div>

          {currentCandidate ? (
            <div className="space-y-5">
              <div className="rounded-xl bg-govt-900 p-6 text-white">
                <p className="text-lg font-bold uppercase tracking-wide text-blue-100">
                  Rank {getCandidateRank(currentCandidate)}
                </p>
                <h3 className="mt-2 text-5xl font-black leading-tight">{getCandidateName(currentCandidate)}</h3>
                <p className="mt-3 text-xl font-semibold text-blue-100">
                  Registration ID: {getCandidateId(currentCandidate)}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <CandidateDetail label="Category" value={getOriginalCategory(currentCandidate)} />
                <CandidateDetail label="Effective Category" value={getEffectiveCategory(currentCandidate)} />
                <CandidateDetail label="Percentage12" value={formatPercent(getPercentage12(currentCandidate))} />
                <CandidateDetail label="District" value={getCandidateDistrict(currentCandidate) || "-"} />
                <CandidateDetail
                  label="Domicile"
                  value={currentCandidate.isPunjabDomicile === false ? "Non-Punjab" : "Punjab"}
                />
              </div>

            {currentCandidate.isPunjabDomicile === false ? (
              <StatusMessage tone="info" message="Reservation validation active: Non-Punjab candidates can only get General seats." />
            ) : (
              <StatusMessage
                tone="info"
                message={`Eligible categories for this candidate: ${candidateEligibleCategories.join(", ")}`}
              />
            )}
            </div>
          ) : (
            <div className="flex min-h-80 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center">
              <div>
                <p className="text-3xl font-black text-slate-800">No candidate currently called</p>
                <p className="mt-2 text-lg font-semibold text-slate-500">
                  Press Call Next Candidate to begin the next counseling action.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black text-slate-950">Allotment Form</h2>
          <div className="mt-5 space-y-5">
            <label className="block">
              <span className="mb-2 block text-base font-black text-slate-700">Select College</span>
              <select
                value={selectedCollegeId}
                onChange={(event) => setSelectedCollegeId(event.target.value)}
                disabled={!currentCandidate || actionInProgress}
                className="h-14 w-full rounded-lg border border-slate-300 bg-white px-4 text-lg font-bold text-slate-950 outline-none focus:border-govt-700 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              >
                <option value="">Choose college</option>
                {collegesWithAvailableSeats.map((college) => (
                  <option key={college.id} value={college.id}>
                    {college.collegeName}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-base font-black text-slate-700">Select Eligible Category</span>
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value as CategoryColumn)}
                disabled={!currentCandidate || !selectedCollege || actionInProgress}
                className="h-14 w-full rounded-lg border border-slate-300 bg-white px-4 text-lg font-bold text-slate-950 outline-none focus:border-govt-700 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              >
                <option value="">Choose category</option>
                {eligibleCategories.map((category) => (
                  <option key={category} value={category}>
                    {category} - Remaining {selectedCollege ? getSeatRemaining(selectedCollege, category) : 0}
                  </option>
                ))}
              </select>
            </label>

            {selectedCollege && currentCandidate && eligibleCategories.length === 0 ? (
              <StatusMessage tone="error" message="No eligible seats are available for this candidate in the selected college." />
            ) : null}

            <button
              type="button"
              onClick={allotSeat}
              disabled={!currentCandidate || !selectedCollege || !selectedCategory || actionInProgress}
              className="min-h-16 w-full rounded-xl bg-emerald-600 px-6 text-2xl font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {actionState === "allotting" ? "Allotting..." : "Allot Seat"}
            </button>

            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => currentCandidate && updateCandidateStatus(currentCandidate, "absent")}
                disabled={!currentCandidate || actionInProgress}
                className="min-h-14 rounded-lg bg-red-600 px-4 text-lg font-black text-white transition hover:bg-red-700 disabled:bg-slate-300"
              >
                Mark Absent
              </button>
              <button
                type="button"
                onClick={() => currentCandidate && updateCandidateStatus(currentCandidate, "waiting")}
                disabled={!currentCandidate || actionInProgress}
                className="min-h-14 rounded-lg bg-amber-500 px-4 text-lg font-black text-white transition hover:bg-amber-600 disabled:bg-slate-300"
              >
                Mark Waiting
              </button>
              <button
                type="button"
                onClick={() => currentCandidate && updateCandidateStatus(currentCandidate, "skipped")}
                disabled={!currentCandidate || actionInProgress}
                className="min-h-14 rounded-lg border border-slate-300 bg-white px-4 text-lg font-black text-slate-800 transition hover:bg-slate-50 disabled:text-slate-400"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Real-Time Seat Availability</h2>
            <p className="text-base font-semibold text-slate-600">
              Green = available, Yellow = low seats, Red = full.
            </p>
          </div>
          <div className="text-base font-black text-slate-700">Colleges: {seatMatrix.length}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1500px] divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-sm font-black uppercase tracking-wide text-slate-600">
                  College
                </th>
                {categoryColumns.map((category) => (
                  <th key={category} className="px-3 py-3 text-center text-sm font-black uppercase tracking-wide text-slate-600">
                    {category}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {seatMatrix.map((college) => (
                <tr key={college.id}>
                  <td className="sticky left-0 max-w-96 bg-white px-4 py-4 text-base font-black text-slate-950">
                    {college.collegeName}
                  </td>
                  {categoryColumns.map((category) => {
                    const remaining = getSeatRemaining(college, category);
                    const filled = getSeatFilled(college, category);
                    return (
                      <td key={category} className="px-3 py-4 text-center">
                        <div
                          className={[
                            "mx-auto min-w-20 rounded-lg border px-3 py-2",
                            getSeatTone(remaining),
                          ].join(" ")}
                        >
                          <p className="text-2xl font-black">{remaining}</p>
                          <p className="text-xs font-bold">Filled {filled}</p>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-black text-slate-950">Next Candidates in Merit Queue</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {nextCandidates.map((candidate) => (
            <div key={getCandidateId(candidate)} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black uppercase tracking-wide text-govt-700">Rank {getCandidateRank(candidate)}</p>
              <p className="mt-1 truncate text-xl font-black text-slate-950">{getCandidateName(candidate)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{getCandidateId(candidate)}</p>
            </div>
          ))}
          {nextCandidates.length === 0 ? (
            <p className="text-base font-semibold text-slate-500">No pending candidates in the queue.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
