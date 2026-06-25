import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { getFirebaseAuth, getFirebaseStorage } from "../lib/firebase";

export interface ImportSeatMatrixSummary {
  success: boolean;
  sheetName: string;
  totalRowsRead: number;
  totalCollegesUpdated: number;
  totalSeats: number;
  timeTakenMs: number;
  message: string;
  colleges: Array<{
    collegeName: string;
    total: number;
  }>;
}

interface UploadSeatMatrixOptions {
  file: File;
  onProgress?: (progress: number) => void;
}

const importSeatMatrixUrl =
  "https://asia-south2-dped-counselling-2026-28.cloudfunctions.net/importSeatMatrix";

const buildStoragePath = (file: File) => {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `seat-matrix-imports/${Date.now()}-${safeName}`;
};

export async function uploadSeatMatrixExcelAndImport({
  file,
  onProgress,
}: UploadSeatMatrixOptions): Promise<ImportSeatMatrixSummary> {
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    throw new Error("Please upload a valid Excel file with .xlsx or .xls extension.");
  }

  const currentUser = getFirebaseAuth().currentUser;

  if (!currentUser) {
    throw new Error("You must be logged in as an admin before importing the seat matrix.");
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

  const fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
  const idToken = await currentUser.getIdToken();
  const response = await fetch(importSeatMatrixUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileUrl, storagePath }),
  });

  const responseBody = (await response.json().catch(() => ({}))) as {
    data?: ImportSeatMatrixSummary;
    error?: string;
    details?: unknown;
  };

  if (!response.ok) {
    const details =
      Array.isArray(responseBody.details)
        ? ` ${responseBody.details
            .map((item) =>
              typeof item === "object" && item !== null && "message" in item ? String(item.message) : String(item),
            )
            .join(" ")}`
        : "";
    throw new Error(`${responseBody.error ?? `Seat matrix import failed with HTTP ${response.status}.`}${details}`);
  }

  if (!responseBody.data) {
    throw new Error("Seat matrix import returned an unexpected response.");
  }

  return responseBody.data;
}
