import { useState } from "react";
import { assignMeritRanks, type AssignMeritRanksSummary } from "../services/rankService";

export function RecalculateRanksButton({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<AssignMeritRanksSummary | null>(null);
  const [error, setError] = useState("");

  const handleClick = async () => {
    setLoading(true);
    setError("");
    setSummary(null);

    try {
      const result = await assignMeritRanks();
      setSummary(result);
    } catch (rankError) {
      setError(rankError instanceof Error ? rankError.message : "Unable to recalculate ranks.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={compact ? "space-y-2" : "rounded-xl border border-blue-100 bg-blue-50 p-5"}>
      <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"}>
        <div>
          {!compact ? <p className="text-sm font-black uppercase tracking-wide text-govt-700">Merit Rank Utility</p> : null}
          {!compact ? (
            <p className="mt-1 text-sm font-semibold text-govt-900">
              Sorts all candidates by Percentage12, older DOB, then Percentage10.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="min-h-11 rounded-lg bg-govt-700 px-5 text-sm font-black text-white transition hover:bg-govt-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? "Re-calculating..." : "Re-calculate All Ranks"}
        </button>
      </div>

      {summary ? (
        <p className="text-sm font-bold text-emerald-800">
          Updated {summary.totalUpdated} candidates. Top rank: {summary.top5Candidates[0]?.name ?? "-"}
        </p>
      ) : null}
      {error ? <p className="text-sm font-bold text-red-700">{error}</p> : null}
    </div>
  );
}
