import { useEffect, useState } from "react";
import type { Candidate, SeatMatrixEntry, Settings } from "../models/counselling";
import { listenToCandidates, listenToSeatMatrix, listenToSettings } from "../services/firebaseService";

export function useCounsellingData() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [seatMatrix, setSeatMatrix] = useState<SeatMatrixEntry[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubCandidates = listenToCandidates((nextCandidates) => {
      setCandidates(nextCandidates);
      setLoading(false);
    });
    const unsubSeats = listenToSeatMatrix(setSeatMatrix);
    const unsubSettings = listenToSettings(setSettings);

    return () => {
      unsubCandidates();
      unsubSeats();
      unsubSettings();
    };
  }, []);

  return { candidates, seatMatrix, settings, loading };
}
