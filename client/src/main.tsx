import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import { CollegeProtectedRoute } from "./components/CollegeProtectedRoute";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./hooks/useAuth";
import {
  AdminDashboard,
  AdminHome,
  AdminPlaceholder,
} from "./pages/AdminDashboard";
import { CandidatesPage } from "./pages/CandidatesPage";
import { CollegeDashboard } from "./pages/CollegeDashboard";
import { CollegeLoginPage } from "./pages/CollegeLoginPage";
import { HomePage } from "./pages/HomePage";
import { LiveDisplay } from "./pages/LiveDisplay";
import { LiveCounselingPanel } from "./pages/LiveCounselingPanel";
import { LoginPage } from "./pages/LoginPage";
import { ReportsPage } from "./pages/ReportsPage";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "college/login",
        element: <CollegeLoginPage />,
      },
      {
        path: "college/dashboard",
        element: (
          <CollegeProtectedRoute>
            <CollegeDashboard />
          </CollegeProtectedRoute>
        ),
      },
      {
        path: "admin",
        element: (
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <AdminHome />,
          },
          {
            path: "candidates",
            element: <CandidatesPage />,
          },
          {
            path: "seat-matrix",
            element: <AdminPlaceholder title="Seat Matrix" />,
          },
          {
            path: "counseling-control",
            element: <LiveCounselingPanel />,
          },
          {
            path: "reports",
            element: <ReportsPage />,
          },
        ],
      },
      {
        path: "live-display",
        element: <LiveDisplay />,
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
