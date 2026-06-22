import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getFirebaseFirestore } from "../lib/firebase";

export function CollegeProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  const location = useLocation();
  const [checkingCollege, setCheckingCollege] = useState(true);
  const [hasCollegeProfile, setHasCollegeProfile] = useState(false);

  useEffect(() => {
    if (loading) {
      return undefined;
    }

    if (!user) {
      setCheckingCollege(false);
      setHasCollegeProfile(false);
      return undefined;
    }

    let active = true;

    getDoc(doc(getFirebaseFirestore(), "colleges", user.uid))
      .then((snapshot) => {
        if (!active) {
          return;
        }

        setHasCollegeProfile(snapshot.exists() && snapshot.data().isActive !== false);
        setCheckingCollege(false);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setHasCollegeProfile(false);
        setCheckingCollege(false);
      });

    return () => {
      active = false;
    };
  }, [loading, user]);

  if (loading || checkingCollege) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-lg border border-blue-100 bg-white px-6 py-4 text-sm font-semibold text-slate-700 shadow-sm">
          Checking college session...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/college/login" replace state={{ from: location }} />;
  }

  if (!hasCollegeProfile) {
    return <Navigate to="/college/login" replace state={{ from: location, error: "College profile not found." }} />;
  }

  return children;
}
