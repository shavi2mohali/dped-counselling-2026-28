import { Link } from "react-router-dom";

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-govt-700">Admin Login</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">DPEd Counseling Admin</h1>
        <p className="mt-2 text-sm text-slate-600">Email/password login placeholder for Firebase Auth.</p>

        <form className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Email</span>
            <input
              type="email"
              className="h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-govt-700 focus:ring-2 focus:ring-blue-100"
              placeholder="admin@example.com"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Password</span>
            <input
              type="password"
              className="h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-govt-700 focus:ring-2 focus:ring-blue-100"
              placeholder="Password"
            />
          </label>
          <Link
            to="/admin"
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-govt-700 font-bold text-white transition hover:bg-govt-800"
          >
            Continue to Dashboard
          </Link>
        </form>

        <Link to="/" className="mt-6 inline-block text-sm font-semibold text-govt-700 hover:text-govt-900">
          Back to home
        </Link>
      </div>
    </div>
  );
}
