import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function getLoginErrorMessage(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";

  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Invalid email or password. Please check the admin credentials.";
  }

  if (code.includes("too-many-requests")) {
    return "Too many login attempts. Please wait and try again.";
  }

  return "Unable to sign in. Please try again.";
}

export function LoginPage() {
  const { configError, loading, login, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname ?? "/admin";

  if (!loading && user) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (loginError) {
      setError(getLoginErrorMessage(loginError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="bg-govt-900 p-8 text-white">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-100">Punjab DPEd Admin</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight">DPEd 2026-28 Counseling System</h1>
          <p className="mt-4 text-sm leading-6 text-blue-100">
            Secure access for counselors managing Excel imports, candidate verification, seat matrix
            availability, and live counseling controls.
          </p>
          <div className="mt-8 rounded-md border border-white/15 bg-white/10 p-4">
            <p className="text-sm font-semibold text-white">Admin-only access</p>
            <p className="mt-1 text-sm text-blue-100">Use Firebase Email/Password credentials.</p>
          </div>
        </aside>

        <main className="p-8">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-govt-700">Login</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Sign in to Admin Dashboard</h2>
            <p className="mt-2 text-sm text-slate-600">Enter admin credentials to continue.</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {configError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                Firebase configuration error: {configError}
              </div>
            ) : null}

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-govt-700 focus:ring-2 focus:ring-blue-100"
                placeholder="admin email"
                autoComplete="email"
                required
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-govt-700 focus:ring-2 focus:ring-blue-100"
                placeholder="Password"
                autoComplete="current-password"
                required
              />
            </label>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting || Boolean(configError)}
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-govt-700 font-bold text-white transition hover:bg-govt-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? "Signing in..." : "Login"}
            </button>
          </form>

          <Link to="/" className="mt-6 inline-block text-sm font-semibold text-govt-700 hover:text-govt-900">
            Back to home
          </Link>
        </main>
      </div>
    </div>
  );
}
