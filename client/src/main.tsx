import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./hooks/useAuth";
import {
  AdminDashboard,
  AdminHome,
  AdminPlaceholder,
} from "./pages/AdminDashboard";
import { HomePage } from "./pages/HomePage";
import { LiveDisplay } from "./pages/LiveDisplay";
import { LoginPage } from "./pages/LoginPage";
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
            element: <AdminPlaceholder title="Candidates" />,
          },
          {
            path: "seat-matrix",
            element: <AdminPlaceholder title="Seat Matrix" />,
          },
          {
            path: "counseling-control",
            element: <AdminPlaceholder title="Counseling Control" />,
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
