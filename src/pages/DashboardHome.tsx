import { UploadCloud } from "lucide-react";
import { useMemo, useState, type ChangeEvent } from "react";
import { useCounsellingData } from "../hooks/useCounsellingData";
import { uploadCandidateExcelAndImport, type ImportCandidatesSummary } from "../services/firebaseService";
import { sumSeats } from "../utils/counselling";

function StatCard({ label, value, subtext }: { label: string; value: string | number; subtext?: string }) {
  return (
    <div className="panel p-5">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
      {subtext ? <p className="mt-1 text-sm text-slate-500">{subtext}</p> : null}
    </div>
  );
}

export function DashboardHome() {
  const { candidates, seatMatrix, settings } = useCounsellingData();
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportCandidatesSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  const stats = useMemo(() => {
    const punjab = candidates.filter((candidate) => candidate.isPunjabDomicile).length;
    const nonPunjab = candidates.length - punjab;
    const filled = sumSeats(seatMatrix, "filled");
    const remaining = sumSeats(seatMatrix, "remaining");

    return { punjab, nonPunjab, filled, remaining };
  }, [candidates, seatMatrix]);

  const handleImport = async (dryRun: boolean) => {
    if (!file) return;
    setImporting(true);
    setError("");

    try {
      const result = await uploadCandidateExcelAndImport({ file, dryRun });
      setSummary(result);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Candidate import failed.");
    } finally {
      setImporting(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    setSummary(null);
    setError("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Dashboard Home</h2>
          <p className="mt-1 text-sm text-slate-600">
            Import candidates, monitor seat availability, and prepare the live counseling room.
          </p>
        </div>
        <div className="rounded-md border border-govt-100 bg-govt-50 px-4 py-3 text-sm font-semibold text-govt-900">
          Current Round: {settings?.currentRound ?? 1} · Status: {settings?.allotmentStatus ?? "draft"}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Candidates" value={candidates.length} subtext="Imported registrations" />
        <StatCard label="Punjab Domicile" value={stats.punjab} subtext={`Non-Punjab: ${stats.nonPunjab}`} />
        <StatCard label="Seats Filled" value={stats.filled} subtext={`${stats.remaining} remaining`} />
        <StatCard label="Total Seat Matrix" value={sumSeats(seatMatrix, "total")} subtext="Official 2025-27 structure" />
      </section>

      <section className="panel p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-950">Candidate Excel Import</h3>
            <p className="mt-1 text-sm text-slate-600">
              Upload the admin-provided Excel file. Dry run checks parsing before writing to Firestore.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="btn-secondary cursor-pointer">
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              Choose Excel
              <input className="hidden" type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
            </label>
            <button className="btn-secondary" type="button" disabled={!file || importing} onClick={() => handleImport(true)}>
              Dry run
            </button>
            <button className="btn-primary" type="button" disabled={!file || importing} onClick={() => handleImport(false)}>
              Import candidates
            </button>
          </div>
        </div>

        {file ? <p className="mt-4 text-sm font-medium text-slate-700">Selected file: {file.name}</p> : null}
        {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}
        {summary ? (
          <div className="mt-5 grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Imported</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{summary.totalCandidatesImported}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Domicile</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                Punjab {summary.punjabDomicileCount} · Non-Punjab {summary.nonPunjabDomicileCount}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Parsing Errors</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{summary.parsingErrors.length}</p>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
