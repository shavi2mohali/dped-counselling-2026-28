import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { StatusBadge } from "../components/common/StatusBadge";
import { useCounsellingData } from "../hooks/useCounsellingData";
import { formatNumber } from "../utils/counselling";

export function CandidatesManagement() {
  const { candidates } = useCounsellingData();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [domicile, setDomicile] = useState("all");

  const filteredCandidates = useMemo(() => {
    const query = search.toLowerCase().trim();

    return candidates.filter((candidate) => {
      const matchesSearch =
        !query ||
        candidate.candidateName.toLowerCase().includes(query) ||
        candidate.RegistrationId.toLowerCase().includes(query) ||
        String(candidate.meritRank ?? "").includes(query);
      const matchesCategory = category === "all" || candidate.effectiveCategoryName === category;
      const matchesStatus = status === "all" || candidate.status === status;
      const matchesDomicile =
        domicile === "all" ||
        (domicile === "punjab" && candidate.isPunjabDomicile) ||
        (domicile === "non-punjab" && !candidate.isPunjabDomicile);

      return matchesSearch && matchesCategory && matchesStatus && matchesDomicile;
    });
  }, [candidates, category, domicile, search, status]);

  const categories = [...new Set(candidates.map((candidate) => candidate.effectiveCategoryName).filter(Boolean))];
  const statuses = [...new Set(candidates.map((candidate) => candidate.status).filter(Boolean))];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-950">Candidates Management</h2>
        <p className="mt-1 text-sm text-slate-600">Search and verify imported candidates before live counseling.</p>
      </div>

      <section className="panel p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_180px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-slate-400" aria-hidden="true" />
            <input
              className="field w-full pl-10"
              placeholder="Search by name, RegistrationId, rank"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select className="field" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="field" value={domicile} onChange={(event) => setDomicile(event.target.value)}>
            <option value="all">All domicile</option>
            <option value="punjab">Punjab only</option>
            <option value="non-punjab">Non-Punjab only</option>
          </select>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Percentage12</th>
                <th className="px-4 py-3">Punjab Domicile</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-sm">
              {filteredCandidates.map((candidate) => (
                <tr key={candidate.RegistrationId} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-950">{candidate.meritRank ?? "-"}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-950">{candidate.candidateName}</p>
                    <p className="text-xs text-slate-500">{candidate.RegistrationId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{candidate.originalCategoryName}</p>
                    <p className="text-xs text-slate-500">Effective: {candidate.effectiveCategoryName}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                    {formatNumber(candidate.percentage12)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        candidate.isPunjabDomicile ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {candidate.isPunjabDomicile ? "Punjab" : "Non-Punjab"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge status={candidate.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
