import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useOrgSettings } from "../api/orgSettings";
import { ApiError } from "../api/client";

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@example.com" },
  { role: "Compliance Officer", email: "compliance@example.com" },
  { role: "System Owner", email: "owner@example.com" },
  { role: "Approver", email: "approver@example.com" },
  { role: "Viewer", email: "viewer@example.com" },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const { data: orgSettings } = useOrgSettings();
  const orgName = orgSettings?.orgName ?? "GovernTrace AI";
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <img
          src={orgSettings?.logoUrl || "/governtrace-logo-vertical.png"}
          alt={orgName}
          className={
            orgSettings?.logoUrl
              ? "mx-auto mb-3 h-12 w-12 rounded-md object-cover"
              : "mx-auto mb-3 h-40 w-auto object-contain"
          }
        />
        <h1 className="mb-1 text-center text-2xl font-semibold text-slate-900 dark:text-slate-100">{orgName}</h1>
        <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">Sign in to manage your AI use case registry</p>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            style={{ backgroundColor: orgSettings?.primaryColor ?? "#0f172a" }}
            className="w-full rounded-md px-3 py-2 text-sm font-medium text-white opacity-100 hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-xs text-slate-500 dark:text-slate-400">
          <p className="mb-2 font-medium text-slate-600 dark:text-slate-400">Seeded demo accounts (password: governance123)</p>
          <ul className="space-y-1">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email} className="flex justify-between">
                <span>{a.role}</span>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword("governance123");
                  }}
                  className="font-mono text-slate-700 dark:text-slate-300 underline decoration-dotted hover:text-slate-900 dark:hover:text-slate-100"
                >
                  {a.email}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
