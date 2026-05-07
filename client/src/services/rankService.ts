import { getFirebaseAuth } from "../lib/firebase";

export interface AssignMeritRanksSummary {
  success: boolean;
  totalCandidates: number;
  totalUpdated: number;
  message: string;
  top5Candidates: Array<{
    registrationId: string;
    name: string;
    rank: number;
    percentage12: number;
    percentage10: number;
    dob: string;
  }>;
}

const assignMeritRanksUrl =
  "https://asia-south2-dped-counselling-2026-28.cloudfunctions.net/assignMeritRanks";

export async function assignMeritRanks(): Promise<AssignMeritRanksSummary> {
  const currentUser = getFirebaseAuth().currentUser;

  if (!currentUser) {
    throw new Error("You must be logged in before recalculating ranks.");
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch(assignMeritRanksUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const responseBody = (await response.json().catch(() => ({}))) as {
    data?: AssignMeritRanksSummary;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(responseBody.error ?? `Rank recalculation failed with HTTP ${response.status}.`);
  }

  if (!responseBody.data) {
    throw new Error("Rank recalculation returned an unexpected response.");
  }

  return responseBody.data;
}
