import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  getCandidateId,
  getCandidateName,
  getCandidateRank,
  getEffectiveCategory,
  getOriginalCategory,
  sortByMeritRank,
  type Candidate,
  type CollegeProfile,
} from "../lib/counseling";
import { getFirebaseFirestore } from "../lib/firebase";

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "joined"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "notJoined"
        ? "bg-red-50 text-red-700 ring-red-200"
        : status === "allotted"
          ? "bg-blue-50 text-blue-700 ring-blue-200"
          : "bg-slate-50 text-slate-700 ring-slate-200";

  const label = status === "notJoined" ? "Not Joined" : status.charAt(0).toUpperCase() + status.slice(1);

  return <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${tone}`}>{label}</span>;
}

export function CollegeDashboard() {
  const { logout, user } = useAuth();
  const [college, setCollege] = useState<CollegeProfile | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");
  const firestore = getFirebaseFirestore();

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const unsubscribeCollege = onSnapshot(
      doc(firestore, "colleges", user.uid),
      (snapshot) => {
        if (!snapshot.exists()) {
          setError("College profile was not found for this login.");
          setLoading(false);
          return;
        }

        const profile = { id: snapshot.id, ...(snapshot.data() as Omit<CollegeProfile, "id">) };
        setCollege(profile);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      },
    );

    return unsubscribeCollege;
  }, [firestore, user]);

  useEffect(() => {
    if (!college?.collegeName) {
      return undefined;
    }

    setLoading(true);
    const unsubscribeCandidates = onSnapshot(
      query(collection(firestore, "candidates"), where("allottedCollegeId", "==", college.collegeName)),
      (snapshot) => {
        setCandidates(snapshot.docs.map((candidateDoc) => candidateDoc.data() as Candidate));
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      },
    );

    return unsubscribeCandidates;
  }, [college?.collegeName, firestore]);

  const sortedCandidates = useMemo(() => sortByMeritRank(candidates), [candidates]);
  const stats = useMemo(() => {
    const joined = candidates.filter((candidate) => candidate.status === "joined").length;
    const notJoined = candidates.filter((candidate) => candidate.status === "notJoined").length;
    const pending = candidates.filter((candidate) => candidate.status === "allotted").length;
    return { joined, notJoined, pending, total: candidates.length };
  }, [candidates]);

  const updateJoiningStatus = async (candidate: Candidate, status: "joined" | "notJoined") => {
    const candidateId = getCandidateId(candidate);

    if (!candidateId || !user) {
      setError("Candidate record is missing RegistrationId.");
      return;
    }

    setUpdatingId(candidateId);
    setError("");

    try {
      await updateDoc(doc(firestore, "candidates", candidateId), {
        status,
        joinedStatus: status,
        joinedUpdatedAt: serverTimestamp(),
        joinedUpdatedByUid: user.uid,
        joinedUpdatedByEmail: user.email ?? "",
        updatedAt: serverTimestamp(),
      });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update joining status.");
    } finally {
      setUpdatingId("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-blue-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-govt-700">College Dashboard</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">{college?.collegeName ?? "College Portal"}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="h-11 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">Allotted</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{stats.total}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-blue-700">Pending Joining</p>
            <p className="mt-2 text-3xl font-black text-blue-900">{stats.pending}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-emerald-700">Joined</p>
            <p className="mt-2 text-3xl font-black text-emerald-900">{stats.joined}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-red-700">Not Joined</p>
            <p className="mt-2 text-3xl font-black text-red-900">{stats.notJoined}</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-xl font-black text-slate-950">Allotted Candidates</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Mark final joining status after candidate reports to the college.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[980px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Rank", "Name", "Category", "Allotted Seat", "Current Status", "Action"].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left font-black uppercase tracking-wide text-slate-600">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-lg font-black text-slate-500">
                      Loading allotted candidates...
                    </td>
                  </tr>
                ) : null}

                {!loading && sortedCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-lg font-black text-slate-500">
                      No candidates are allotted to this college yet.
                    </td>
                  </tr>
                ) : null}

                {sortedCandidates.map((candidate) => {
                  const candidateId = getCandidateId(candidate);
                  return (
                    <tr key={candidateId} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-lg font-black text-slate-950">
                        {getCandidateRank(candidate)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-black text-slate-950">{getCandidateName(candidate)}</p>
                        <p className="text-xs font-semibold text-slate-500">{candidateId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-black text-slate-950">{getOriginalCategory(candidate)}</p>
                        <p className="text-xs font-semibold text-slate-500">Effective: {getEffectiveCategory(candidate)}</p>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800">{candidate.allottedCategory ?? "-"}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={candidate.status ?? "allotted"} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={updatingId === candidateId}
                            onClick={() => updateJoiningStatus(candidate, "joined")}
                            className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
                          >
                            Mark Joined
                          </button>
                          <button
                            type="button"
                            disabled={updatingId === candidateId}
                            onClick={() => updateJoiningStatus(candidate, "notJoined")}
                            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:text-slate-300"
                          >
                            Not Joined
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
