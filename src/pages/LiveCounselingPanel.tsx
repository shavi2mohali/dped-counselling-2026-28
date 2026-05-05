import { CheckCircle2, Clock3, Megaphone, UserX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "../components/common/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import { useCounsellingData } from "../hooks/useCounsellingData";
import type { Candidate, CategoryColumn } from "../models/counselling";
import {
  allotSeat,
  callNextCandidate,
  listenToLiveCandidateId,
  updateCandidateStatus,
} from "../services/firebaseService";
import { formatNumber, getCandidateEligibleCategories } from "../utils/counselling";

export function LiveCounselingPanel() {
  const { user } = useAuth();
  const { candidates, seatMatrix } = useCounsellingData();
  const [liveCandidateId, setLiveCandidateId] = useState<string | null>(null);
  const [selectedCollegeName, setSelectedCollegeName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryColumn | "">("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => listenToLiveCandidateId(setLiveCandidateId), []);

  const currentCandidate = useMemo<Candidate | null>(() => {
    if (liveCandidateId) {
      return candidates.find((candidate) => candidate.RegistrationId === liveCandidateId) ?? null;
    }

    return candidates.find((candidate) => candidate.status === "called") ?? null;
  }, [candidates, liveCandidateId]);

  const selectedCollege = useMemo(
    () => seatMatrix.find((college) => college.collegeName === selectedCollegeName) ?? null,
    [seatMatrix, selectedCollegeName],
  );

  const eligibleCategories = useMemo(
    () => getCandidateEligibleCategories(currentCandidate, selectedCollege),
    [currentCandidate, selectedCollege],
  );

  const upcomingCandidates = useMemo(
    () =>
      candidates
        .filter((candidate) => ["registered", "eligible", "waiting"].includes(candidate.status))
        .sort((left, right) => (left.meritRank ?? 999999) - (right.meritRank ?? 999999))
        .slice(0, 8),
    [candidates],
  );

  useEffect(() => {
    setSelectedCategory("");
  }, [currentCandidate?.RegistrationId, selectedCollegeName]);

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await action();
      setMessage(successMessage);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleCallNext = () =>
    runAction(async () => {
      const called = await callNextCandidate(candidates);
      if (!called) {
        throw new Error("No registered or waiting candidate is available to call.");
      }
      setSelectedCollegeName("");
      setSelectedCategory("");
    }, "Next candidate called.");

  const handleAllotSeat = () =>
    runAction(async () => {
      if (!currentCandidate || !selectedCollegeName || !selectedCategory || !user) {
        throw new Error("Select a candidate, college, and available category before allotment.");
      }

      await allotSeat({
        candidate: currentCandidate,
        collegeName: selectedCollegeName,
        category: selectedCategory,
        performedByUid: user.uid,
      });
    }, "Seat allotted and availability updated.");

  const handleStatus = (status: "absent" | "waiting") =>
    runAction(async () => {
      if (!currentCandidate) {
        throw new Error("No candidate is currently called.");
      }

      await updateCandidateStatus(currentCandidate, status);
    }, status === "absent" ? "Candidate marked absent." : "Candidate moved to waiting.");

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Live Counseling Control Panel</h2>
          <p className="mt-1 text-sm text-slate-600">Large controls for physical counseling and public calling.</p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-16 items-center justify-center gap-3 rounded-md bg-govt-700 px-8 text-lg font-bold text-white shadow-panel transition hover:bg-govt-800 disabled:bg-slate-300"
          onClick={handleCallNext}
          disabled={busy}
          title="Call the next candidate by overall merit rank"
        >
          <Megaphone className="h-7 w-7" aria-hidden="true" />
          Call Next Candidate
        </button>
      </div>

      {message ? <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <section className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-950">Currently Called Candidate</h3>
            {currentCandidate ? <StatusBadge status={currentCandidate.status} /> : null}
          </div>

          {currentCandidate ? (
            <div className="grid gap-5 lg:grid-cols-[160px_1fr]">
              <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                {currentCandidate.photoUrl ? (
                  <img
                    className="h-full w-full object-cover"
                    src={currentCandidate.photoUrl}
                    alt={currentCandidate.candidateName}
                  />
                ) : (
                  <span className="text-5xl font-bold text-govt-700">
                    {currentCandidate.candidateName.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-normal text-govt-700">
                  Rank {currentCandidate.meritRank ?? "-"} · {currentCandidate.RegistrationId}
                </p>
                <h3 className="mt-1 text-4xl font-bold text-slate-950">{currentCandidate.candidateName}</h3>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Original Category</p>
                    <p className="mt-1 font-bold text-slate-950">{currentCandidate.originalCategoryName}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Effective Category</p>
                    <p className="mt-1 font-bold text-slate-950">{currentCandidate.effectiveCategoryName}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Percentage12</p>
                    <p className="mt-1 font-bold text-slate-950">{formatNumber(currentCandidate.percentage12)}</p>
                  </div>
                </div>
                {!currentCandidate.isPunjabDomicile ? (
                  <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                    Non-Punjab domicile: eligible for General seats only.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex min-h-72 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-center">
              <div>
                <p className="text-lg font-bold text-slate-800">No candidate called</p>
                <p className="mt-1 text-sm text-slate-500">Use Call Next Candidate to begin or continue the round.</p>
              </div>
            </div>
          )}
        </section>

        <section className="panel p-5">
          <h3 className="text-lg font-bold text-slate-950">Allotment Form</h3>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">College</span>
              <select
                className="field w-full"
                value={selectedCollegeName}
                onChange={(event) => setSelectedCollegeName(event.target.value)}
                disabled={!currentCandidate}
              >
                <option value="">Select college</option>
                {seatMatrix.map((college) => (
                  <option key={college.collegeName} value={college.collegeName}>
                    {college.collegeName}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Available Category</span>
              <select
                className="field w-full"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value as CategoryColumn)}
                disabled={!currentCandidate || !selectedCollegeName}
              >
                <option value="">Select category</option>
                {eligibleCategories.map((category) => (
                  <option key={category} value={category}>
                    {category} · Remaining {selectedCollege?.remaining?.[category] ?? 0}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn-primary min-h-12 w-full text-base"
              disabled={busy || !currentCandidate || !selectedCollegeName || !selectedCategory}
              onClick={handleAllotSeat}
              title="Allot selected seat"
            >
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              Allot Seat
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="btn-danger min-h-11"
                disabled={busy || !currentCandidate}
                onClick={() => handleStatus("absent")}
                title="Mark candidate absent"
              >
                <UserX className="h-5 w-5" aria-hidden="true" />
                Mark Absent
              </button>
              <button
                type="button"
                className="btn-secondary min-h-11"
                disabled={busy || !currentCandidate}
                onClick={() => handleStatus("waiting")}
                title="Move candidate to waiting"
              >
                <Clock3 className="h-5 w-5" aria-hidden="true" />
                Mark Waiting
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="panel p-5">
        <h3 className="text-lg font-bold text-slate-950">Next in Overall Merit</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {upcomingCandidates.map((candidate) => (
            <div key={candidate.RegistrationId} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-normal text-govt-700">Rank {candidate.meritRank}</p>
              <p className="mt-1 truncate font-bold text-slate-950">{candidate.candidateName}</p>
              <p className="text-xs text-slate-500">{candidate.RegistrationId}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
