import { useState, type ChangeEvent } from "react";
import {
  uploadSeatMatrixExcelAndImport,
  type ImportSeatMatrixSummary,
} from "../services/seatMatrixImport";

export function ImportSeatMatrixButton() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<ImportSeatMatrixSummary | null>(null);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    setProgress(0);
    setSummary(null);
    setError("");
  };

  const handleImport = async () => {
    if (!file) {
      setError("Please choose a seat matrix Excel file first.");
      return;
    }

    const confirmed = window.confirm(
      "Import seat matrix from this Excel file?\n\nThis will overwrite the existing Firestore seatMatrix and reset filled seats to zero.",
    );

    if (!confirmed) {
      return;
    }

    setImporting(true);
    setError("");
    setSummary(null);
    setProgress(0);

    try {
      const result = await uploadSeatMatrixExcelAndImport({
        file,
        onProgress: setProgress,
      });
      setSummary(result);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Seat matrix import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="rounded-xl border border-emerald-100 bg-emerald-50 p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-emerald-700">Seat Matrix Utility</p>
          <h3 className="mt-1 text-xl font-black text-slate-950">Import Seat Matrix</h3>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-emerald-900">
            Upload Excel with columns like S.No, Name of College, General, EWS, BC, SC(RO), SC(MB), and other categories.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="max-w-sm rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="min-h-11 rounded-lg bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {importing ? "Importing..." : "Import Seat Matrix"}
          </button>
        </div>
      </div>

      {importing ? (
        <div className="mt-4">
          <div className="h-3 overflow-hidden rounded-full bg-white">
            <div className="h-full bg-emerald-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm font-bold text-emerald-800">Upload progress: {progress}%</p>
        </div>
      ) : null}

      {summary ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-800">
          {summary.message}. Total seats: {summary.totalSeats}. Time: {(summary.timeTakenMs / 1000).toFixed(2)} seconds.
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}
    </section>
  );
}
