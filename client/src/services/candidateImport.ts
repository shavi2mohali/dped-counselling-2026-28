import { ref, uploadBytesResumable } from "firebase/storage";
import { getFirebaseAuth, getFirebaseStorage } from "../lib/firebase";

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
  parsingErrors: Array<{
    rowNumber: number;
    registrationId?: string;
    message: string;
  }>;
}

export interface UploadAndImportOptions {
  file: File;
  dryRun?: boolean;
  onProgress?: (progress: number) => void;
}

const buildStoragePath = (file: File) => {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `candidate-imports/${Date.now()}-${safeName}`;
};

const importCandidatesUrl =
  "https://asia-southeast2-dped-counselling-2026-28.cloudfunctions.net/importCandidates";

export async function uploadCandidateExcelAndImport({
  file,
  dryRun = false,
  onProgress,
}: UploadAndImportOptions): Promise<ImportCandidatesSummary> {
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    throw new Error("Please upload a valid Excel file with .xlsx or .xls extension.");
  }

  const storagePath = buildStoragePath(file);
  const uploadTask = uploadBytesResumable(ref(getFirebaseStorage(), storagePath), file, {
    contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = snapshot.totalBytes > 0 ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0;
        onProgress?.(progress);
      },
      (error) => reject(error),
      () => resolve(),
    );
  });

  const currentUser = getFirebaseAuth().currentUser;

  if (!currentUser) {
    throw new Error("You must be logged in as an admin before importing candidates.");
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch(importCandidatesUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ storagePath, dryRun }),
  });

  const responseBody = (await response.json().catch(() => ({}))) as {
    data?: ImportCandidatesSummary;
    error?: string;
    details?: unknown;
  };

  if (!response.ok) {
    throw new Error(responseBody.error ?? `Import failed with HTTP ${response.status}.`);
  }

  if (!responseBody.data) {
    throw new Error("Import function returned an unexpected response.");
  }

  return responseBody.data;
}
