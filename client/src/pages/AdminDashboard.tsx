import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const navItems = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/candidates", label: "Candidates" },
  { to: "/admin/seat-matrix", label: "Seat Matrix" },
  { to: "/admin/counseling-control", label: "Counseling Control" },
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

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-72 bg-govt-900 p-6 text-white lg:block">
        <h1 className="text-xl font-bold">DPEd Admin</h1>
        <p className="mt-1 text-sm text-blue-100">Session 2026-28 - Punjab</p>

        <nav className="mt-8 space-y-2 text-sm font-semibold">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  "block rounded-md px-3 py-3 transition",
                  isActive ? "bg-white text-govt-900" : "text-blue-50 hover:bg-white/10",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Admin Dashboard</h2>
              <p className="text-sm text-slate-600">DPEd 2026-28 Counseling System - Punjab</p>
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
