import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useOrgSettings } from "../api/orgSettings";
import { ApiError } from "../api/client";
import { inputClass } from "../lib/ui";

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
              className={inputClass}
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
              className={inputClass}
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
      </div>
    </div>
  );
}
