import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { ref, uploadBytes } from "firebase/storage";
import { db, functions, storage } from "../firebase/app";
import type { Candidate, CategoryColumn, SeatMatrixEntry, Settings } from "../models/counselling";

export interface ImportCandidatesPayload {
  file: File;
  sheetName?: string;
  dryRun?: boolean;
  columnMap?: Record<string, string | string[]>;
}

export interface ImportCandidatesSummary {
  dryRun: boolean;
  storagePath: string;
  sheetName: string;
  totalRowsRead: number;
  totalCandidatesImported: number;
  punjabDomicileCount: number;
  nonPunjabDomicileCount: number;
  categoryChangedToGeneralDueToNonDomicile: number;
  initializedSeatMatrixColleges: number;
  totalSeats: number;
  top5Candidates: Array<{
    RegistrationId: string;
    name: string;
    meritRank: number;
    percentage12: number;
    percentage10: number;
    category: string;
    originalCategoryName: string;
    isPunjabDomicile: boolean;
  }>;
  parsingErrors: Array<{ rowNumber: number; registrationId?: string; message: string }>;
}

export function listenToCandidates(callback: (candidates: Candidate[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, "candidates"), orderBy("meritRank", "asc")), (snapshot) => {
    callback(snapshot.docs.map((item) => item.data() as Candidate));
  });
}

export function listenToSeatMatrix(callback: (seatMatrix: SeatMatrixEntry[]) => void): Unsubscribe {
  return onSnapshot(collection(db, "seatMatrix"), (snapshot) => {
    callback(
      snapshot.docs
        .map((item) => item.data() as SeatMatrixEntry)
        .sort((left, right) => left.collegeName.localeCompare(right.collegeName)),
    );
  });
}

export function listenToSettings(callback: (settings: Settings | null) => void): Unsubscribe {
  return onSnapshot(doc(db, "settings", "global"), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.data() as Settings) : null);
  });
}

export async function uploadCandidateExcelAndImport({
  file,
  sheetName,
  dryRun = false,
  columnMap,
}: ImportCandidatesPayload): Promise<ImportCandidatesSummary> {
  const storagePath = `candidate-imports/${Date.now()}-${file.name}`;
  await uploadBytes(ref(storage, storagePath), file);

  const importCandidates = httpsCallable(functions, "importCandidates");
  const result = await importCandidates({ storagePath, sheetName, dryRun, columnMap });
  return result.data as ImportCandidatesSummary;
}

export async function callNextCandidate(candidates: Candidate[]): Promise<Candidate | null> {
  const nextCandidate = candidates
    .filter((candidate) => ["registered", "eligible", "waiting"].includes(candidate.status))
    .sort((left, right) => (left.meritRank ?? Number.MAX_SAFE_INTEGER) - (right.meritRank ?? Number.MAX_SAFE_INTEGER))[0];

  if (!nextCandidate) {
    return null;
  }

  await updateDoc(doc(db, "candidates", nextCandidate.RegistrationId), {
    status: "called",
    calledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(
    doc(db, "settings", "liveCounseling"),
    {
      currentCandidateRegistrationId: nextCandidate.RegistrationId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return { ...nextCandidate, status: "called" };
}

export async function updateCandidateStatus(candidate: Candidate, status: "absent" | "waiting") {
  await updateDoc(doc(db, "candidates", candidate.RegistrationId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function allotSeat(params: {
  candidate: Candidate;
  collegeName: string;
  category: CategoryColumn;
  performedByUid: string;
}) {
  const { candidate, collegeName, category, performedByUid } = params;
  const seatRef = doc(db, "seatMatrix", collegeName);
  const candidateRef = doc(db, "candidates", candidate.RegistrationId);
  const allotmentRef = doc(collection(db, "allotments"));

  await runTransaction(db, async (transaction) => {
    const seatSnapshot = await transaction.get(seatRef);
    if (!seatSnapshot.exists()) {
      throw new Error("Selected college was not found.");
    }

    const seatEntry = seatSnapshot.data() as SeatMatrixEntry;
    const remaining = seatEntry.remaining?.[category] ?? 0;

    if (remaining <= 0) {
      throw new Error(`No remaining ${category} seats at ${collegeName}.`);
    }

    if (!candidate.isPunjabDomicile && category !== "General") {
      throw new Error("Non-Punjab candidates can only be allotted General seats.");
    }

    transaction.update(seatRef, {
      [`remaining.${category}`]: remaining - 1,
      [`filled.${category}`]: (seatEntry.filled?.[category] ?? 0) + 1,
      updatedAt: serverTimestamp(),
    });

    transaction.update(candidateRef, {
      status: "allotted",
      allottedCollegeId: collegeName,
      allottedCategory: category,
      updatedAt: serverTimestamp(),
    });

    transaction.set(allotmentRef, {
      candidateRegistrationId: candidate.RegistrationId,
      collegeName,
      category,
      round: 1,
      action: "allotted",
      performedByUid,
      createdAt: serverTimestamp(),
    });
  });
}

export async function getLiveCandidate(): Promise<string | null> {
  const snapshot = await getDoc(doc(db, "settings", "liveCounseling"));
  return snapshot.exists() ? String(snapshot.data().currentCandidateRegistrationId ?? "") || null : null;
}

export function listenToLiveCandidateId(callback: (registrationId: string | null) => void): Unsubscribe {
  return onSnapshot(doc(db, "settings", "liveCounseling"), (snapshot) => {
    callback(snapshot.exists() ? String(snapshot.data().currentCandidateRegistrationId ?? "") || null : null);
  });
}

export function listenToCalledCandidates(callback: (candidates: Candidate[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, "candidates"), where("status", "==", "called")), (snapshot) => {
    callback(snapshot.docs.map((item) => item.data() as Candidate));
  });
}
