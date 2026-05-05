import { Link } from "react-router-dom";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950">
      <header className="border-b border-blue-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-govt-700">
              Government Counseling Portal
            </p>
            <h1 className="text-xl font-bold text-slate-950">
              DPEd 2026-28 Counseling System - Punjab
            </h1>
          </div>
          <div className="hidden rounded-md bg-govt-50 px-4 py-2 text-sm font-semibold text-govt-800 sm:block">
            Physical Counseling Mode
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center">
        <section className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-govt-700">
              Session 2026-28 · Punjab D.P.Ed Counseling
            </div>
            <h2 className="max-w-4xl text-4xl font-bold leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Admin control and live public display for room-based counseling.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Import candidates, manage seat availability, call candidates by merit, and operate the
              counseling hall from one clean dashboard.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                to="/login"
                className="inline-flex min-h-14 items-center justify-center rounded-md bg-govt-700 px-8 text-base font-bold text-white shadow-sm transition hover:bg-govt-800"
              >
                Admin Login
              </Link>
              <Link
                to="/live-display"
                className="inline-flex min-h-14 items-center justify-center rounded-md border border-govt-200 bg-white px-8 text-base font-bold text-govt-800 shadow-sm transition hover:bg-govt-50"
              >
                Live Display Screen
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
            <div className="rounded-md bg-govt-900 p-6 text-white">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-100">
                Counseling Room Workflow
              </p>
              <div className="mt-6 space-y-4">
                {["Upload Excel", "Verify Candidates", "Call by Merit Rank", "Allot Seat", "Update Live Display"].map(
                  (item, index) => (
                    <div key={item} className="flex items-center gap-4 rounded-md bg-white/10 p-4">
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white font-bold text-govt-900">
                        {index + 1}
                      </span>
                      <span className="font-semibold">{item}</span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-5 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-slate-700">DPEd 2026-28 Counseling System - Punjab</p>
          <p>Built for physical counseling operations and public display coordination.</p>
        </div>
      </footer>
    </div>
  );
}
