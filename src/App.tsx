import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AdminLayout } from "./components/layout/AdminLayout";
import { AuthProvider } from "./hooks/useAuth";
import { CandidatesManagement } from "./pages/CandidatesManagement";
import { DashboardHome } from "./pages/DashboardHome";
import { LiveCounselingPanel } from "./pages/LiveCounselingPanel";
import { LoginPage } from "./pages/LoginPage";
import { SeatMatrixManagement } from "./pages/SeatMatrixManagement";

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardHome />} />
          <Route path="candidates" element={<CandidatesManagement />} />
          <Route path="seat-matrix" element={<SeatMatrixManagement />} />
          <Route path="live-counseling" element={<LiveCounselingPanel />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
