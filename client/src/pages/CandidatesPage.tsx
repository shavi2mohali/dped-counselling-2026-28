import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { RecalculateRanksButton } from "../components/RecalculateRanksButton";
import {
  getCandidateDistrict,
  getCandidateId,
  getCandidateName,
  getCandidateRank,
  getEffectiveCategory,
  getOriginalCategory,
  getPercentage12,
  sortByMeritRank,
  type Candidate,
} from "../lib/counseling";
import { getFirebaseFirestore } from "../lib/firebase";
import {
  uploadCandidateExcelAndImport,
  type ImportCandidatesSummary,
} from "../services/candidateImport";

const pageSize = 25;

function SummaryCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "green" | "amber" | "red" }) {
  const toneClass =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : tone === "red"
          ? "border-red-200 bg-red-50"
          : "border-slate-200 bg-white";

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${toneClass}`}>
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "allotted"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "absent"
        ? "bg-red-50 text-red-700 ring-red-200"
        : status === "waiting"
          ? "bg-amber-50 text-amber-700 ring-amber-200"
          : status === "called"
            ? "bg-blue-50 text-blue-700 ring-blue-200"
            : "bg-slate-50 text-slate-700 ring-slate-200";

  return <span className={`rounded-full px-2 py-1 text-xs font-black capitalize ring-1 ${className}`}>{status}</span>;
}

function toCsvValue(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function CandidatesPage() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [candidateError, setCandidateError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<ImportCandidatesSummary | null>(null);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [domicileFilter, setDomicileFilter] = useState("all");
  const [rankFrom, setRankFrom] = useState("");
  const [rankTo, setRankTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const firestore = getFirebaseFirestore();

    return onSnapshot(
      query(collection(firestore, "candidates"), orderBy("rank", "asc")),
      (snapshot) => {
        setCandidates(snapshot.docs.map((candidateDoc) => candidateDoc.data() as Candidate));
        setLoadingCandidates(false);
      },
      (error) => {
        setCandidateError(error.message);
        setLoadingCandidates(false);
      },
    );
  }, []);

  const stats = useMemo(() => {
    const total = candidates.length;
    const allotted = candidates.filter((candidate) => candidate.status === "allotted").length;
    const absent = candidates.filter((candidate) => candidate.status === "absent").length;
    const pending = candidates.filter((candidate) => (candidate.status ?? "pending") === "pending").length;
    const punjab = candidates.filter((candidate) => candidate.isPunjabDomicile).length;

    return { absent, allotted, pending, punjab, total };
  }, [candidates]);

  const categories = useMemo(
    () => [...new Set(candidates.map((candidate) => getOriginalCategory(candidate)).filter(Boolean))].sort(),
    [candidates],
  );

  const filteredCandidates = useMemo(() => {
    const text = search.trim().toLowerCase();
    const minRank = rankFrom ? Number(rankFrom) : undefined;
    const maxRank = rankTo ? Number(rankTo) : undefined;

    return sortByMeritRank(candidates).filter((candidate) => {
      const candidateStatus = candidate.status ?? "pending";
      const rank = getCandidateRank(candidate);
      const haystack = [
        getCandidateName(candidate),
        getCandidateId(candidate),
        getCandidateDistrict(candidate),
        getOriginalCategory(candidate),
        getEffectiveCategory(candidate),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !text || haystack.includes(text);
      const matchesStatus = statusFilter === "all" || candidateStatus === statusFilter;
      const matchesCategory = categoryFilter === "all" || getOriginalCategory(candidate) === categoryFilter;
      const matchesDomicile =
        domicileFilter === "all" ||
        (domicileFilter === "punjab" && candidate.isPunjabDomicile) ||
        (domicileFilter === "non-punjab" && candidate.isPunjabDomicile === false);
      const matchesRankFrom = minRank === undefined || rank >= minRank;
      const matchesRankTo = maxRank === undefined || rank <= maxRank;

      return matchesSearch && matchesStatus && matchesCategory && matchesDomicile && matchesRankFrom && matchesRankTo;
    });
  }, [candidates, categoryFilter, domicileFilter, rankFrom, rankTo, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / pageSize));
  const visibleCandidates = filteredCandidates.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, domicileFilter, rankFrom, rankTo, search, statusFilter]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    setProgress(0);
    setSummary(null);
    setImportError("");
  };

  const handleImport = async () => {
    if (!file) {
      setImportError("Please choose an Excel file first.");
      return;
    }

    setImporting(true);
    setImportError("");
    setSummary(null);
    setProgress(0);

    try {
      const result = await uploadCandidateExcelAndImport({
        file,
        dryRun,
        onProgress: setProgress,
      });
      setSummary(result);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Excel import failed.");
    } finally {
      setImporting(false);
    }
  };

  const sendToLivePanel = async (candidate: Candidate) => {
    const firestore = getFirebaseFirestore();
    const candidateId = getCandidateId(candidate);

    if (!candidateId) {
      setCandidateError("Candidate does not have a valid RegistrationId.");
      return;
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

    navigate("/admin/counseling-control");
  };

  const exportToExcelCsv = () => {
    const header = [
      "Rank",
      "RegistrationId",
      "Name",
      "District",
      "Original Category",
      "Effective Category",
      "Percentage12",
      "Status",
      "Punjab Domicile",
    ];

    const rows = filteredCandidates.map((candidate) => [
      getCandidateRank(candidate),
      getCandidateId(candidate),
      getCandidateName(candidate),
      getCandidateDistrict(candidate),
      getOriginalCategory(candidate),
      getEffectiveCategory(candidate),
      getPercentage12(candidate) ?? "",
      candidate.status ?? "pending",
      candidate.isPunjabDomicile ? "Punjab" : "Non-Punjab",
    ]);

    const csv = [header, ...rows].map((row) => row.map(toCsvValue).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dped-candidates-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-govt-700">Candidates</p>
          <h2 className="mt-1 text-3xl font-black text-slate-950">Candidates Management</h2>
          <p className="mt-2 max-w-3xl text-base font-medium text-slate-600">
            Search, filter, export, and send candidates directly into the live counseling panel.
          </p>
        </div>
        <button
          type="button"
          onClick={exportToExcelCsv}
          className="min-h-11 rounded-lg border border-govt-200 bg-white px-5 text-sm font-black text-govt-800 transition hover:bg-govt-50"
        >
          Export to Excel
        </button>
      </div>

      <RecalculateRanksButton compact />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total Candidates" value={stats.total} />
        <SummaryCard label="Pending" value={stats.pending} tone="amber" />
        <SummaryCard label="Allotted" value={stats.allotted} tone="green" />
        <SummaryCard label="Absent" value={stats.absent} tone="red" />
        <SummaryCard label="Punjab Domicile" value={stats.punjab} />
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

        {importError ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {importError}
          </div>
        ) : null}

        {summary ? (
          <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-govt-900">
            Imported/valid: {summary.totalCandidatesImported} · Punjab: {summary.punjabDomicileCount} · Non-Punjab:{" "}
            {summary.nonPunjabDomicileCount} · Parsing errors: {summary.parsingErrors.length}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[1fr_170px_190px_170px_110px_110px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by Name, RegistrationId, District, Category"
            className="h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-govt-700 focus:ring-2 focus:ring-blue-100"
          />
          <select className="h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All status</option>
            <option value="pending">Pending</option>
            <option value="allotted">Allotted</option>
            <option value="absent">Absent</option>
            <option value="waiting">Waiting</option>
            <option value="called">Called</option>
          </select>
          <select className="h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select className="h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold" value={domicileFilter} onChange={(event) => setDomicileFilter(event.target.value)}>
            <option value="all">All domicile</option>
            <option value="punjab">Punjab</option>
            <option value="non-punjab">Non-Punjab</option>
          </select>
          <input className="h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold" value={rankFrom} onChange={(event) => setRankFrom(event.target.value)} placeholder="Rank from" type="number" />
          <input className="h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold" value={rankTo} onChange={(event) => setRankTo(event.target.value)} placeholder="Rank to" type="number" />
        </div>
      </section>

      {candidateError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {candidateError}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Rank", "RegistrationId", "Name", "District", "Category", "Percentage12", "Status", "Actions"].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left font-black uppercase tracking-wide text-slate-600">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingCandidates ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-lg font-black text-slate-500">
                    Loading candidates...
                  </td>
                </tr>
              ) : null}

              {!loadingCandidates && visibleCandidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-lg font-black text-slate-500">
                    No candidates match the selected filters.
                  </td>
                </tr>
              ) : null}

              {visibleCandidates.map((candidate) => (
                <tr key={getCandidateId(candidate)} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-lg font-black text-slate-950">{getCandidateRank(candidate)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-black text-slate-800">{getCandidateId(candidate)}</td>
                  <td className="px-4 py-3">
                    <p className="font-black text-slate-950">{getCandidateName(candidate)}</p>
                    <p className="text-xs font-semibold text-slate-500">{candidate.isPunjabDomicile ? "Punjab" : "Non-Punjab"}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{getCandidateDistrict(candidate) || "-"}</td>
                  <td className="px-4 py-3">
                    <p className="font-black text-slate-950">{getOriginalCategory(candidate)}</p>
                    <p className="text-xs font-semibold text-slate-500">Effective: {getEffectiveCategory(candidate)}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-black">{getPercentage12(candidate)?.toFixed(2) ?? "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge status={candidate.status ?? "pending"} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => sendToLivePanel(candidate)}
                        className="rounded-md bg-govt-700 px-3 py-2 text-xs font-black text-white hover:bg-govt-800"
                      >
                        View in Live Panel
                      </button>
                      <button
                        type="button"
                        onClick={() => sendToLivePanel(candidate)}
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                      >
                        Allot Manually
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-slate-600">
            Showing {visibleCandidates.length} of {filteredCandidates.length} filtered candidates
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-black text-slate-700 disabled:text-slate-300"
            >
              Previous
            </button>
            <span className="px-2 text-sm font-black text-slate-700">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-black text-slate-700 disabled:text-slate-300"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
