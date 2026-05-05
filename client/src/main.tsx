import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import { AdminLayout } from "./pages/AdminLayout";
import { LiveDisplay } from "./pages/LiveDisplay";
import { LoginPage } from "./pages/LoginPage";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/admin",
    element: <AdminLayout />,
  },
  {
    path: "/live-display",
    element: <LiveDisplay />,
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
