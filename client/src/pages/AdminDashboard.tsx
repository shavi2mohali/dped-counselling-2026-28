import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { RecalculateRanksButton } from "../components/RecalculateRanksButton";
import { useAuth } from "../hooks/useAuth";

const navItems = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/candidates", label: "Candidates" },
  { to: "/admin/seat-matrix", label: "Seat Matrix" },
  { to: "/admin/counseling-control", label: "Live Counseling" },
  { to: "/admin/reports", label: "Reports" },
];

function DashboardStatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{note}</p>
    </div>
  );
}

export function AdminHome() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-govt-700">Dashboard</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-950">Counseling Overview</h2>
        <p className="mt-1 text-sm text-slate-600">
          Live statistics will connect to Firestore candidate and seat matrix data in the next step.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard label="Total Candidates" value="0" note="Imported from Excel" />
        <DashboardStatCard label="Punjab Domicile Candidates" value="0" note="Eligible for reservation" />
        <DashboardStatCard label="Seats Filled / Remaining" value="0 / 350" note="Official seat matrix" />
        <DashboardStatCard label="Current Status" value="Draft" note="Round not started" />
      </div>

      <div className="rounded-lg border border-blue-100 bg-govt-50 p-5">
        <p className="font-semibold text-govt-900">Admin foundation is ready</p>
        <p className="mt-1 text-sm text-govt-800">
          Authentication, protected routing, sidebar navigation, and dashboard shell are now in place.
        </p>
      </div>

      <RecalculateRanksButton />
    </div>
  );
}

export function AdminPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-govt-700">Admin Module</p>
      <h2 className="mt-2 text-3xl font-bold text-slate-950">{title}</h2>
      <p className="mt-3 max-w-2xl text-slate-600">
        This section is reserved for the next implementation step.
      </p>
    </div>
  );
}

export function AdminDashboard() {
  const { logout, user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100">
      <aside
        className={[
          "fixed inset-y-0 left-0 hidden bg-govt-900 text-white shadow-xl transition-all duration-300 ease-in-out lg:block",
          sidebarCollapsed ? "w-20 px-3 py-5" : "w-72 p-6",
        ].join(" ")}
      >
        <div className={["flex items-center", sidebarCollapsed ? "justify-center" : "justify-between gap-3"].join(" ")}>
          {!sidebarCollapsed ? (
            <div>
              <h1 className="text-xl font-bold">DPEd Admin</h1>
              <p className="mt-1 text-sm text-blue-100">Session 2026-28 - Punjab</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-2xl font-black text-white transition hover:bg-white/20"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span aria-hidden="true">&#9776;</span>
          </button>
        </div>

        <nav className="mt-8 space-y-2 text-sm font-semibold">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  "block rounded-md px-3 py-3 transition",
                  sidebarCollapsed ? "text-center" : "",
                  isActive ? "bg-white text-govt-900" : "text-blue-50 hover:bg-white/10",
                ].join(" ")
              }
              title={item.label}
            >
              {sidebarCollapsed ? item.label.charAt(0) : item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className={["transition-all duration-300 ease-in-out", sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"].join(" ")}>
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarCollapsed((current) => !current)}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-2xl font-black text-govt-800 transition hover:bg-govt-50 lg:flex"
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <span aria-hidden="true">&#9776;</span>
              </button>
              <div>
                <h2 className="text-xl font-bold text-slate-950">Admin Dashboard</h2>
                <p className="text-sm text-slate-600">DPEd 2026-28 Counseling System - Punjab</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-slate-900">Admin User</p>
                <p className="max-w-56 truncate text-xs text-slate-500">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Logout
              </button>
            </div>
          </div>

          <nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold",
                    isActive ? "bg-govt-700 text-white" : "bg-slate-100 text-slate-700",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <section className="p-6">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
