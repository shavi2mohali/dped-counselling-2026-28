import { Link, Outlet } from "react-router-dom";

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-72 bg-govt-900 p-6 text-white lg:block">
        <h1 className="text-xl font-bold">DPEd Admin</h1>
        <p className="mt-1 text-sm text-blue-100">Session 2026-28</p>
        <nav className="mt-8 space-y-2 text-sm font-semibold">
          <Link className="block rounded-md bg-white px-3 py-3 text-govt-900" to="/admin">
            Dashboard
          </Link>
          <Link className="block rounded-md px-3 py-3 text-blue-50 hover:bg-white/10" to="/live-display">
            Live Display
          </Link>
          <Link className="block rounded-md px-3 py-3 text-blue-50 hover:bg-white/10" to="/">
            Home
          </Link>
        </nav>
      </aside>

      <main className="lg:pl-72">
        <header className="border-b border-slate-200 bg-white px-6 py-5">
          <h2 className="text-xl font-bold text-slate-950">Admin Dashboard</h2>
          <p className="text-sm text-slate-600">Placeholder dashboard shell for upcoming counseling modules.</p>
        </header>
        <section className="p-6">
          <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-govt-700">Dashboard Placeholder</p>
            <h3 className="mt-2 text-3xl font-bold text-slate-950">Admin tools will appear here</h3>
            <p className="mt-3 max-w-2xl text-slate-600">
              Candidate import, seat matrix management, and live counseling controls will be connected in this area.
            </p>
          </div>
          <Outlet />
        </section>
      </main>
    </div>
  );
}
