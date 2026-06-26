import { getFirebaseAuth } from "../lib/firebase";

export interface ResetCounselingSummary {
  success: boolean;
  resetId: string;
  candidatesResetCount: number;
  seatMatrixResetCount: number;
  allotmentsArchivedCount: number;
  timeTakenMs: number;
  message: string;
}

const resetCounselingUrl =
  "https://asia-south2-dped-counselling-2026-28.cloudfunctions.net/resetCounseling";

export async function resetCounseling(): Promise<ResetCounselingSummary> {
  const currentUser = getFirebaseAuth().currentUser;

  if (!currentUser) {
    throw new Error("You must be logged in as an admin before resetting counseling.");
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch(resetCounselingUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const responseBody = (await response.json().catch(() => ({}))) as {
    data?: ResetCounselingSummary;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(responseBody.error ?? `Reset counseling failed with HTTP ${response.status}.`);
  }

  if (!responseBody.data) {
    throw new Error("Reset counseling returned an unexpected response.");
  }

  return responseBody.data;
}
