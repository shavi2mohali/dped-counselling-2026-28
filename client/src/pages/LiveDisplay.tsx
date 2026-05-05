import { Link } from "react-router-dom";

export function LiveDisplay() {
  return (
    <div className="flex min-h-screen flex-col bg-govt-900 text-white">
      <header className="border-b border-white/10 px-10 py-6">
        <p className="text-lg font-semibold text-blue-100">DPEd 2026-28 Counseling System - Punjab</p>
      </header>

      <main className="flex flex-1 items-center justify-center px-10 text-center">
        <div>
          <p className="text-xl font-semibold uppercase tracking-wide text-blue-100">Public Display</p>
          <h1 className="mt-5 text-6xl font-bold leading-tight lg:text-8xl">Live Counseling Screen</h1>
          <p className="mx-auto mt-6 max-w-3xl text-2xl text-blue-100">
            Candidate call details and seat allotment updates will be shown here.
          </p>
        </div>
      </main>

      <footer className="border-t border-white/10 px-10 py-5">
        <Link to="/" className="text-sm font-semibold text-blue-100 hover:text-white">
          Back to home
        </Link>
      </footer>
    </div>
  );
}
