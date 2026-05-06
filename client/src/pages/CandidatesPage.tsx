import { useState, type ChangeEvent } from "react";
import {
  uploadCandidateExcelAndImport,
  type ImportCandidatesSummary,
} from "../services/candidateImport";

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

export function CandidatesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<ImportCandidatesSummary | null>(null);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [dryRun, setDryRun] = useState(true);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    setProgress(0);
    setSummary(null);
    setError("");
  };

  const handleImport = async () => {
    if (!file) {
      setError("Please choose an Excel file first.");
      return;
    }

    setImporting(true);
    setError("");
    setSummary(null);
    setProgress(0);

    try {
      const result = await uploadCandidateExcelAndImport({
        file,
        dryRun,
        onProgress: setProgress,
      });
      setSummary(result);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Excel import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-govt-700">Candidates</p>
        <h2 className="mt-1 text-3xl font-black text-slate-950">Excel Candidate Import</h2>
        <p className="mt-2 max-w-3xl text-base font-medium text-slate-600">
          Upload the DPEd merit list Excel file. The import validates rows, applies Punjab domicile
          reservation rules, assigns merit rank, writes candidates, and initializes the seat matrix.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
          <label className="block">
            <span className="mb-2 block text-base font-black text-slate-700">Excel File</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800 file:mr-4 file:rounded-md file:border-0 file:bg-govt-700 file:px-4 file:py-2 file:font-bold file:text-white"
            />
            {file ? <p className="mt-2 text-sm font-semibold text-slate-600">Selected: {file.name}</p> : null}
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex min-h-12 items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 text-sm font-bold text-govt-900">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(event) => setDryRun(event.target.checked)}
                className="h-4 w-4"
              />
              Dry run first
            </label>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || !file}
              className="min-h-12 rounded-lg bg-govt-700 px-6 text-base font-black text-white transition hover:bg-govt-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {importing ? "Processing..." : dryRun ? "Validate Excel" : "Import Candidates"}
            </button>
          </div>
        </div>

        {importing ? (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm font-bold text-slate-700">
              <span>Upload progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-govt-700 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {error}
          </div>
        ) : null}
      </section>

      {summary ? (
        <section className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label={summary.dryRun ? "Valid Candidates" : "Imported Candidates"} value={summary.totalCandidatesImported} />
            <SummaryCard label="Punjab Domicile" value={summary.punjabDomicileCount} />
            <SummaryCard label="Non-Punjab" value={summary.nonPunjabDomicileCount} />
            <SummaryCard label="Seat Matrix Colleges" value={summary.initializedSeatMatrixColleges} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-950">Import Summary</h3>
                <p className="text-sm font-semibold text-slate-500">
                  Rows read: {summary.totalRowsRead} · Total seats initialized: {summary.totalSeats}
                </p>
              </div>
              <div className="rounded-full bg-amber-50 px-4 py-2 text-sm font-black text-amber-800">
                Category changed to General: {summary.categoryChangedToGeneralDueToNonDomicile}
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-3 text-left font-black uppercase text-slate-600">Rank</th>
                    <th className="px-3 py-3 text-left font-black uppercase text-slate-600">RegistrationId</th>
                    <th className="px-3 py-3 text-left font-black uppercase text-slate-600">Name</th>
                    <th className="px-3 py-3 text-left font-black uppercase text-slate-600">Percentage12</th>
                    <th className="px-3 py-3 text-left font-black uppercase text-slate-600">Domicile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.top5Candidates.map((candidate) => (
                    <tr key={candidate.RegistrationId}>
                      <td className="px-3 py-3 font-bold">{candidate.meritRank}</td>
                      <td className="px-3 py-3 font-bold">{candidate.RegistrationId}</td>
                      <td className="px-3 py-3">{candidate.name}</td>
                      <td className="px-3 py-3">{candidate.percentage12?.toFixed?.(2) ?? "-"}</td>
                      <td className="px-3 py-3">{candidate.isPunjabDomicile ? "Punjab" : "Non-Punjab"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {summary.parsingErrors.length > 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
              <h3 className="text-lg font-black text-red-900">Parsing Errors ({summary.parsingErrors.length})</h3>
              <div className="mt-4 max-h-80 overflow-auto rounded-lg bg-white">
                {summary.parsingErrors.slice(0, 50).map((item) => (
                  <div key={`${item.rowNumber}-${item.registrationId ?? "missing"}`} className="border-b border-red-100 px-4 py-3 text-sm text-red-800">
                    <span className="font-black">Row {item.rowNumber}</span>
                    {item.registrationId ? ` · ${item.registrationId}` : ""}: {item.message}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
