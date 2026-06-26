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
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
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

  return "border-emerald-300 bg-emerald-50 text-emerald-800";
}

function getSeatMatrixCategoryKey(seatData: SeatMatrixEntry, category: CategoryColumn): CategoryColumn {
  if (
    category === "Physically Handicapped" &&
    seatData.remaining?.["Physically Handicapped"] === undefined &&
    seatData.seats?.["Physically Handicapped"] === undefined
  ) {
    return "Phy Handicapped" as CategoryColumn;
  }

  return category;
}

function CandidateSpecificVacancyPanel({
  currentCandidate,
  displaySeatCategories,
  relevantRemainingSeats,
  seatMatrix,
}: {
  currentCandidate: Candidate | null;
  displaySeatCategories: CategoryColumn[];
  relevantRemainingSeats: number;
  seatMatrix: SeatMatrixEntry[];
}) {
  return (
    <section className="rounded-xl border border-blue-100 bg-blue-50 p-4">
      <div className="mb-3 flex flex-col gap-1 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h3 className="text-xl font-black text-govt-900">Available Seats for this Candidate</h3>
          <p className="text-sm font-bold text-govt-700">
            {currentCandidate
              ? `${getCandidateName(currentCandidate)} · ${displaySeatCategories.join(", ")}`
              : "Call a candidate to show eligible categories."}
          </p>
        </div>
        <p className="rounded-full bg-white px-3 py-1 text-sm font-black text-govt-800">
          Total: {currentCandidate ? relevantRemainingSeats : "-"}
        </p>
      </div>

      {currentCandidate ? (
        <div className="max-h-[640px] overflow-auto rounded-lg border border-blue-100 bg-white">
          <table className="min-w-[620px] divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-black uppercase tracking-wide text-slate-600">
                  College
                </th>
                {displaySeatCategories.map((category) => (
                  <th key={category} className="px-3 py-2 text-center text-xs font-black uppercase tracking-wide text-slate-600">
                    {category}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {seatMatrix.map((college) => (
                <tr key={college.id}>
                  <td className="max-w-72 px-3 py-1.5 text-sm font-black text-slate-950">{college.collegeName}</td>
                  {displaySeatCategories.map((category) => {
                    const remaining = getSeatRemaining(college, category);
                    return (
                      <td key={category} className="px-3 py-1.5 text-center">
                        <div
                          className={[
                            "mx-auto min-w-16 rounded-lg border px-3 py-1",
                            getSeatTone(remaining),
                          ].join(" ")}
                        >
                          <p className="text-2xl font-black">{remaining}</p>
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
        <div className="flex min-h-32 items-center justify-center rounded-lg border-2 border-dashed border-blue-200 bg-white text-center">
          <p className="px-4 text-sm font-bold text-slate-500">
            Candidate-specific vacancies will appear here after pressing Call Next Candidate.
          </p>
        </div>
      )}
    </section>
  );
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

  const eligibleCategories = useMemo(() => {
    const availableCategories = getAvailableEligibleCategories(currentCandidate, selectedCollege);

    if (
      currentCandidate?.allottedCategory &&
      selectedCollege &&
      (currentCandidate.allottedCollegeId === selectedCollege.id ||
        currentCandidate.allottedCollegeId === selectedCollege.collegeName ||
        currentCandidate.allottedCollegeName === selectedCollege.collegeName)
    ) {
      return Array.from(new Set([...availableCategories, currentCandidate.allottedCategory]));
    }

    return availableCategories;
  }, [currentCandidate, selectedCollege]);

  const candidateEligibleCategories = useMemo(
    () => getEligibleCategories(currentCandidate),
    [currentCandidate],
  );

  const displaySeatCategories = useMemo(
    () => (currentCandidate ? getEligibleCategories(currentCandidate) : []),
    [currentCandidate],
  );

  const collegesWithAvailableSeats = useMemo(
    () =>
      currentCandidate
        ? seatMatrix.filter(
            (college) =>
              getAvailableEligibleCategories(currentCandidate, college).length > 0 ||
              currentCandidate.allottedCollegeId === college.id ||
              currentCandidate.allottedCollegeId === college.collegeName ||
              currentCandidate.allottedCollegeName === college.collegeName,
          )
        : seatMatrix.filter(hasAnyRemainingSeat),
    [currentCandidate, seatMatrix],
  );

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

  const candidateRelevantRemainingSeats = useMemo(
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

  const currentCandidateAccent =
    currentCandidate?.isPunjabDomicile === false
      ? {
          card: "border-blue-300 bg-blue-50",
          header: "bg-govt-900",
          pill: "bg-white text-govt-800",
        }
      : {
          card: "border-emerald-300 bg-emerald-50",
          header: "bg-emerald-800",
          pill: "bg-white text-emerald-800",
        };

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

        const newSeatRef = doc(firestore, "seatMatrix", selectedCollege.id);
        const candidateRef = doc(firestore, "candidates", candidateId);
        const liveStateRef = doc(firestore, "settings", "liveCounseling");
        const allotmentRef = doc(collection(firestore, "allotments"));

        await runTransaction(firestore, async (transaction) => {
          const candidateSnapshot = await transaction.get(candidateRef);
          const newSeatSnapshot = await transaction.get(newSeatRef);

          if (!candidateSnapshot.exists()) {
            throw new Error("Current candidate record was not found.");
          }

          if (!newSeatSnapshot.exists()) {
            throw new Error("Selected college was not found in seatMatrix.");
          }

          const candidateData = candidateSnapshot.data() as Candidate;
          const storedPreviousCollegeId = candidateData.allottedCollegeId ?? "";
          const previousCollegeName = candidateData.allottedCollegeName ?? "";
          const previousCategory = candidateData.allottedCategory;
          const previousCollegeId =
            seatMatrix.find(
              (college) =>
                college.id === storedPreviousCollegeId ||
                college.collegeName === storedPreviousCollegeId ||
                college.id === previousCollegeName ||
                college.collegeName === previousCollegeName,
            )?.id ?? storedPreviousCollegeId;
          const oldCollegeRef =
            previousCollegeId && previousCategory && previousCollegeId !== selectedCollege.id
              ? doc(firestore, "seatMatrix", previousCollegeId)
              : null;
          const oldSeatSnapshot = oldCollegeRef ? await transaction.get(oldCollegeRef) : null;
          const newSeatData = {
            id: newSeatSnapshot.id,
            ...(newSeatSnapshot.data() as Omit<SeatMatrixEntry, "id">),
          } as SeatMatrixEntry;
          const newCategoryKey = getSeatMatrixCategoryKey(newSeatData, selectedCategory);
          const isSameAllotment = previousCollegeId === selectedCollege.id && previousCategory === selectedCategory;
          const isSameCollegeTransfer =
            previousCollegeId === selectedCollege.id && Boolean(previousCategory) && previousCategory !== selectedCategory;
          const newRemaining = newSeatData.remaining?.[newCategoryKey] ?? newSeatData.seats?.[newCategoryKey] ?? 0;
          const newFilled = newSeatData.filled?.[newCategoryKey] ?? 0;

          if (!isSameAllotment && newRemaining <= 0) {
            throw new Error(`${selectedCategory} seats are full at ${selectedCollege.collegeName}.`);
          }

          if (!isSameAllotment) {
            const newSeatUpdates: Record<string, unknown> = {
              [`remaining.${newCategoryKey}`]: newRemaining - 1,
              [`filled.${newCategoryKey}`]: newFilled + 1,
              updatedAt: serverTimestamp(),
            };

            if (isSameCollegeTransfer && previousCategory) {
              const previousCategoryKey = getSeatMatrixCategoryKey(newSeatData, previousCategory);
              const oldRemaining = newSeatData.remaining?.[previousCategoryKey] ?? newSeatData.seats?.[previousCategoryKey] ?? 0;
              const oldFilled = newSeatData.filled?.[previousCategoryKey] ?? 0;

              newSeatUpdates[`remaining.${previousCategoryKey}`] = oldRemaining + 1;
              newSeatUpdates[`filled.${previousCategoryKey}`] = Math.max(0, oldFilled - 1);
            }

            transaction.update(newSeatRef, newSeatUpdates);

            if (oldCollegeRef && oldSeatSnapshot && previousCategory) {
              if (!oldSeatSnapshot.exists()) {
                throw new Error("Previously allotted college was not found in seatMatrix.");
              }

              const oldSeatData = {
                id: oldSeatSnapshot.id,
                ...(oldSeatSnapshot.data() as Omit<SeatMatrixEntry, "id">),
              } as SeatMatrixEntry;
              const previousCategoryKey = getSeatMatrixCategoryKey(oldSeatData, previousCategory);
              const oldRemaining = oldSeatData.remaining?.[previousCategoryKey] ?? oldSeatData.seats?.[previousCategoryKey] ?? 0;
              const oldFilled = oldSeatData.filled?.[previousCategoryKey] ?? 0;

              transaction.update(oldCollegeRef, {
                [`remaining.${previousCategoryKey}`]: oldRemaining + 1,
                [`filled.${previousCategoryKey}`]: Math.max(0, oldFilled - 1),
                updatedAt: serverTimestamp(),
              });
            }
          }

          transaction.update(candidateRef, {
            status: "allotted",
            allottedCollegeId: selectedCollege.id,
            allottedCollegeName: selectedCollege.collegeName,
            allottedCategory: selectedCategory,
            allotmentStatus: "allotted",
            allotmentUpdatedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          transaction.set(allotmentRef, {
            candidateRegistrationId: candidateId,
            candidateName: getCandidateName(currentCandidate),
            collegeId: selectedCollege.id,
            collegeName: selectedCollege.collegeName,
            category: selectedCategory,
            seatMatrixCategoryKey: newCategoryKey,
            action: previousCollegeId && !isSameAllotment ? "upgraded" : "allotted",
            previousCollegeId: previousCollegeId || null,
            previousCollegeName: previousCollegeName || null,
            previousCategory: previousCategory || null,
            isTransfer: Boolean(previousCollegeId && !isSameAllotment),
            isDuplicateAllotment: isSameAllotment,
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
            <p className="text-sm font-black uppercase tracking-wide text-govt-700">Live Counseling Control</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950 md:text-4xl">
              DPEd 2026-28 Counseling - Live Session
            </h1>
            <p className="mt-2 text-base font-semibold text-slate-600">
              Call candidates by merit rank, allot seats, and update the public workflow in real time.
            </p>
          </div>

          <button
            type="button"
            onClick={callNextCandidate}
            disabled={actionInProgress}
            className="min-h-16 rounded-xl bg-govt-700 px-8 text-xl font-black text-white shadow-sm transition hover:bg-govt-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {actionState === "calling" ? "Calling..." : "Call Next Candidate"}
          </button>
        </div>
      </header>

      {dataError ? <StatusMessage tone="error" message={`Firestore error: ${dataError}`} /> : null}
      {error ? <StatusMessage tone="error" message={error} /> : null}
      {message ? <StatusMessage tone="success" message={message} /> : null}

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,0.72fr)_minmax(600px,1.28fr)]">
        <div className={`min-h-[850px] rounded-xl border p-5 shadow-sm ${currentCandidateAccent.card}`}>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-black text-slate-950">Current Candidate</h2>
            <div className={`rounded-full px-4 py-2 text-sm font-black ${currentCandidateAccent.pill}`}>
              Remaining Seats: {totalRemainingSeats}
            </div>
          </div>

          {currentCandidate ? (
            <div className="space-y-4">
              <div className={`rounded-xl p-5 text-white ${currentCandidateAccent.header}`}>
                <p className="text-base font-bold uppercase tracking-wide text-blue-100">
                  Rank {getCandidateRank(currentCandidate)}
                </p>
                <h3 className="mt-2 text-4xl font-black leading-tight">{getCandidateName(currentCandidate)}</h3>
                <p className="mt-2 text-lg font-semibold text-blue-100">
                  Registration ID: {getCandidateId(currentCandidate)}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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

        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black text-slate-950">Allotment Form</h2>
          <div className="grid gap-5 2xl:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)]">
            <div className="space-y-5">
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

            <CandidateSpecificVacancyPanel
              currentCandidate={currentCandidate}
              displaySeatCategories={displaySeatCategories}
              relevantRemainingSeats={candidateRelevantRemainingSeats}
              seatMatrix={seatMatrix}
            />
          </div>
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
