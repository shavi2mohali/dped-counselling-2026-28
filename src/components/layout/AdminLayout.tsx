import {
  LayoutDashboard,
  ListChecks,
  LogOut,
  MonitorUp,
  TableProperties,
  UsersRound,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/candidates", label: "Candidates", icon: UsersRound },
  { to: "/seat-matrix", label: "Seat Matrix", icon: TableProperties },
  { to: "/live-counseling", label: "Live Counseling", icon: MonitorUp },
];

export function AdminLayout() {
  const { logout, user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-govt-900 text-white lg:block">
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-white text-govt-800">
              <ListChecks className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-blue-100">Punjab DPEd</p>
              <h1 className="text-lg font-bold">Counseling Admin</h1>
            </div>
          </div>
        </div>

        <nav className="space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold transition",
                  isActive ? "bg-white text-govt-900" : "text-blue-50 hover:bg-white/10",
                ].join(" ")
              }
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-govt-700">
                DPEd Session 2026-28
              </p>
              <p className="text-sm text-slate-600">Physical counseling room control system</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-slate-900">Admin</p>
                <p className="max-w-48 truncate text-xs text-slate-500">{user?.email}</p>
              </div>
              <button type="button" className="btn-secondary" onClick={logout} title="Sign out">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2 lg:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  [
                    "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold",
                    isActive ? "bg-govt-700 text-white" : "text-slate-700",
                  ].join(" ")
                }
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
