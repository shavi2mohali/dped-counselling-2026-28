import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { firebaseInitializationError, getFirebaseAuth } from "../lib/firebase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!firebaseInitializationError);
  const [configError, setConfigError] = useState<string | null>(firebaseInitializationError);

  useEffect(() => {
    if (firebaseInitializationError) {
      setLoading(false);
      return undefined;
    }

    try {
      return onAuthStateChanged(getFirebaseAuth(), (nextUser) => {
        setUser(nextUser);
        setLoading(false);
      });
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : "Firebase Auth is unavailable.");
      setLoading(false);
      return undefined;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configError,
      login: async (email: string, password: string) => {
        await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      },
      logout: () => signOut(getFirebaseAuth()),
    }),
    [configError, loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
