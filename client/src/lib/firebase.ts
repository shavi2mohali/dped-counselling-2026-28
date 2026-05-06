import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, type Functions } from "firebase/functions";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyASbH5IpceQsLGQmgbSg6uP1r4ANhfZbXg",
  authDomain: "dped-counselling-2026-28.firebaseapp.com",
  projectId: "dped-counselling-2026-28",
  storageBucket: "dped-counselling-2026-28.firebasestorage.app",
  messagingSenderId: "768702347725",
  appId: "1:768702347725:web:08889083c96e0fe07c6c84",
  measurementId: "G-8ZGFZV3XH0",
};

let firebaseApp: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let functions: Functions | null = null;
let storage: FirebaseStorage | null = null;
let firebaseInitializationError: string | null = null;

try {
  firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  firestore = getFirestore(firebaseApp);
  functions = getFunctions(firebaseApp);
  storage = getStorage(firebaseApp);
} catch (error) {
  firebaseInitializationError =
    error instanceof Error ? error.message : "Firebase failed to initialize.";
}

const requireFirebaseService = <T>(service: T | null, serviceName: string): T => {
  if (!service) {
    throw new Error(
      firebaseInitializationError ?? `${serviceName} is unavailable because Firebase is not initialized.`,
    );
  }

  return service;
};

export {
  auth,
  firebaseApp,
  firebaseConfig,
  firebaseInitializationError,
  functions,
  firestore,
  storage,
};

export const db = firestore;

export function getFirebaseAuth() {
  return requireFirebaseService(auth, "Firebase Auth");
}

export function getFirebaseFirestore() {
  return requireFirebaseService(firestore, "Firestore");
}

export function getFirebaseFunctions() {
  return requireFirebaseService(functions, "Cloud Functions");
}

export function getFirebaseStorage() {
  return requireFirebaseService(storage, "Firebase Storage");
}
