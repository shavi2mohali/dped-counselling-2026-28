import { collection, doc, onSnapshot, orderBy, query, type Unsubscribe } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { getFirebaseFirestore } from "../lib/firebase";
import {
  type Candidate,
  type LiveCounselingState,
  type SeatMatrixEntry,
  sortByMeritRank,
} from "../lib/counseling";

export function useLiveCounselingData() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [seatMatrix, setSeatMatrix] = useState<SeatMatrixEntry[]>([]);
  const [liveState, setLiveState] = useState<LiveCounselingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let unsubscribeCandidates: Unsubscribe = () => undefined;
    let unsubscribeSeats: Unsubscribe = () => undefined;
    let unsubscribeLiveState: Unsubscribe = () => undefined;

    try {
      const firestore = getFirebaseFirestore();

      unsubscribeCandidates = onSnapshot(
        query(collection(firestore, "candidates"), orderBy("rank", "asc")),
        (snapshot) => {
          setCandidates(snapshot.docs.map((candidateDoc) => candidateDoc.data() as Candidate));
          setLoading(false);
        },
        (snapshotError) => {
          setError(snapshotError.message);
          setLoading(false);
        },
      );

      unsubscribeSeats = onSnapshot(
        collection(firestore, "seatMatrix"),
        (snapshot) => {
          setSeatMatrix(
            snapshot.docs
              .map((seatDoc) => ({ id: seatDoc.id, ...(seatDoc.data() as Omit<SeatMatrixEntry, "id">) }))
              .sort((left, right) => left.collegeName.localeCompare(right.collegeName)),
          );
        },
        (snapshotError) => {
          setError(snapshotError.message);
        },
      );

      unsubscribeLiveState = onSnapshot(
        doc(firestore, "settings", "liveCounseling"),
        (snapshot) => {
          setLiveState(snapshot.exists() ? (snapshot.data() as LiveCounselingState) : null);
        },
        (snapshotError) => {
          setError(snapshotError.message);
        },
      );
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : "Unable to connect to Firestore.");
      setLoading(false);
    }

    return () => {
      unsubscribeCandidates();
      unsubscribeSeats();
      unsubscribeLiveState();
    };
  }, []);

  return useMemo(
    () => ({
      candidates: sortByMeritRank(candidates),
      seatMatrix,
      liveState,
      loading,
      error,
    }),
    [candidates, error, liveState, loading, seatMatrix],
  );
}
