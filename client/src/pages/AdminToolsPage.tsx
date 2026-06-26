import { useState } from "react";
import { resetCounseling, type ResetCounselingSummary } from "../services/resetCounselingService";

const confirmationText = "RESET COUNSELLING";

export function AdminToolsPage() {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ResetCounselingSummary | null>(null);

  const closeModal = () => {
    if (resetting) {
      return;
    }

    setConfirmationOpen(false);
    setTypedConfirmation("");
  };

  const runReset = async () => {
    if (typedConfirmation !== confirmationText) {
      return;
    }

    setResetting(true);
    setError("");
    setSummary(null);

    try {
      const result = await resetCounseling();
      setSummary(result);
      setConfirmationOpen(false);
      setTypedConfirmation("");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Reset counseling failed.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-govt-700">Admin Tools</p>
        <h2 className="mt-1 text-3xl font-black text-slate-950">System Tools</h2>
        <p className="mt-2 max-w-3xl text-base font-medium text-slate-600">
          Restricted actions for managing the live counseling workflow.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          {summary.message} Candidates reset: {summary.candidatesResetCount}. Seat matrix reset:{" "}
          {summary.seatMatrixResetCount}. Allotments archived: {summary.allotmentsArchivedCount}. Reset ID:{" "}
          {summary.resetId}.
        </div>
      ) : null}

      <section className="rounded-xl border border-red-200 bg-white p-6 shadow-sm">
        <div className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-center">
          <div>
            <h3 className="text-2xl font-black text-red-900">Reset Counselling</h3>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              Clears live allotment state, archives allotment records, restores all sanctioned vacancies, and returns
              candidates to the unallotted counseling queue. Candidate basic data and college master data are preserved.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError("");
              setSummary(null);
              setConfirmationOpen(true);
            }}
            className="min-h-12 rounded-lg bg-red-700 px-6 text-base font-black text-white transition hover:bg-red-800"
          >
            Reset Counselling
          </button>
        </div>
      </section>

      {confirmationOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
          <div className="w-full max-w-xl rounded-xl border border-red-200 bg-white p-6 shadow-2xl">
            <p className="text-sm font-black uppercase tracking-wide text-red-700">Danger Zone</p>
            <h3 className="mt-2 text-2xl font-black text-slate-950">This will clear all allotments and restore full vacancy.</h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              Existing allotments will be archived before deletion. Candidate registration, merit, category,
              eligibility, and imported data will remain intact.
            </p>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-black text-slate-700">
                Type {confirmationText} to confirm
              </span>
              <input
                value={typedConfirmation}
                onChange={(event) => setTypedConfirmation(event.target.value)}
                disabled={resetting}
                className="h-12 w-full rounded-lg border border-slate-300 px-4 text-base font-black text-slate-950 outline-none focus:border-red-600 focus:ring-4 focus:ring-red-100 disabled:bg-slate-100"
                autoFocus
              />
            </label>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                disabled={resetting}
                className="h-11 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runReset}
                disabled={resetting || typedConfirmation !== confirmationText}
                className="h-11 rounded-lg bg-red-700 px-5 text-sm font-black text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {resetting ? "Resetting..." : "Confirm Reset Counselling"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
