import type { ReactNode } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getFirebaseFirestore } from "../lib/firebase";

const adminEmails = new Set(["admin@dpedpunjab.in", "counselling@dpedpunjab.in", "shavi2me@admin.com"]);

async function isAdminUser(user: NonNullable<ReturnType<typeof useAuth>["user"]>) {
  const token = await user.getIdTokenResult();
  const email = user.email?.toLowerCase() ?? "";
  const role = token.claims.role;

  return token.claims.admin === true || role === "admin" || email.endsWith("@dpedpunjab.in") || adminEmails.has(email);
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  const location = useLocation();
  const [checkingRole, setCheckingRole] = useState(true);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [isCollegeUser, setIsCollegeUser] = useState(false);

  useEffect(() => {
    if (loading) {
      return undefined;
    }

    if (!user) {
      setCheckingRole(false);
      setHasAdminAccess(false);
      setIsCollegeUser(false);
      return undefined;
    }

    let active = true;

    Promise.all([getDoc(doc(getFirebaseFirestore(), "colleges", user.uid)), isAdminUser(user)])
      .then(([snapshot, adminAccess]) => {
        if (!active) {
          return;
        }

        setIsCollegeUser(snapshot.exists());
        setHasAdminAccess(adminAccess);
        setCheckingRole(false);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setIsCollegeUser(false);
        setHasAdminAccess(false);
        setCheckingRole(false);
      });

    return () => {
      active = false;
    };
  }, [loading, user]);

  if (loading || checkingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-lg border border-blue-100 bg-white px-6 py-4 text-sm font-semibold text-slate-700 shadow-sm">
          Checking admin session...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isCollegeUser) {
    return <Navigate to="/college/dashboard" replace />;
  }

  if (!hasAdminAccess) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
