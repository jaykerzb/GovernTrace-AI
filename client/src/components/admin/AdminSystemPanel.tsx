import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  useSystemStatus,
  useCheckForUpdates,
  installUpdateStreaming,
  useUpdateNetworkSettings,
  type UpdateCheckResult,
  type UpdateInstallResult,
} from "../../api/system";
import { ApiError } from "../../api/client";
import { primaryButtonBase, inputClass } from "../../lib/ui";

// Polls /api/health until the server answers again (or gives up), used
// after both "Install Update" and "Save Network Settings" — both restart
// the process, so the browser needs to wait out that gap rather than
// immediately erroring on the dropped connection.
async function waitForReconnect(onTick: (attempt: number) => void): Promise<boolean> {
  const MAX_ATTEMPTS = 30;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    onTick(attempt);
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch("/api/health");
      if (res.ok) return true;
    } catch {
      // Expected while the old process is down and the new one hasn't
      // bound the port yet — keep polling.
    }
  }
  return false;
}

// Streamed output chunks don't align with line boundaries (a single chunk
// can be a partial line, span several lines, or both), so each chunk gets
// appended onto the last log entry until a newline forces a new one —
// otherwise every chunk would render as its own line no matter where it
// actually broke.
function appendToLastChunk(lines: string[], chunk: string): string[] {
  const parts = chunk.split("\n");
  const result = lines.length > 0 ? [...lines] : [""];
  result[result.length - 1] += parts[0];
  result.push(...parts.slice(1));
  return result;
}

type RestartPhase = { kind: "idle" } | { kind: "restarting"; attempt: number } | { kind: "reconnected" } | { kind: "timed-out" };

function RestartStatus({ phase }: { phase: RestartPhase }) {
  if (phase.kind === "idle") return null;
  if (phase.kind === "restarting") {
    return <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">Restarting server... (checking connection, attempt {phase.attempt})</p>;
  }
  if (phase.kind === "reconnected") {
    return (
      <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
        Server is back online.{" "}
        <button onClick={() => window.location.reload()} className="underline">
          Reload the page
        </button>{" "}
        to continue.
      </p>
    );
  }
  return (
    <p className="mt-3 text-sm text-red-600">
      The server didn't come back within a minute. It may still need a moment — try reloading the page — or the restart itself may have
      failed (see "Restart requires sudo access" below).
    </p>
  );
}

function UpdatesSection() {
  const { data: status } = useSystemStatus();
  const checkForUpdates = useCheckForUpdates();
  const [checkResult, setCheckResult] = useState<UpdateCheckResult | null>(null);
  const [installResult, setInstallResult] = useState<UpdateInstallResult | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [installing, setInstalling] = useState(false);
  const [restartPhase, setRestartPhase] = useState<RestartPhase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  async function handleCheck() {
    setError(null);
    setInstallResult(null);
    setLogLines([]);
    try {
      setCheckResult(await checkForUpdates.mutateAsync());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not check for updates.");
    }
  }

  async function handleInstall() {
    setError(null);
    setInstallResult(null);
    setLogLines([]);
    setInstalling(true);
    try {
      const result = await installUpdateStreaming((event) => {
        if (event.type === "step-start") setLogLines((lines) => [...lines, `$ ${event.command}`]);
        else if (event.type === "step-output") setLogLines((lines) => appendToLastChunk(lines, event.chunk));
        else if (event.type === "step-failed") setLogLines((lines) => [...lines, `✗ ${event.command} failed: ${event.error}`]);
      });
      setInstallResult(result);
      if (result.success) {
        setLogLines((lines) => [...lines, "", "Update installed. Restarting..."]);
        setRestartPhase({ kind: "restarting", attempt: 0 });
        const ok = await waitForReconnect((attempt) => setRestartPhase({ kind: "restarting", attempt }));
        setRestartPhase(ok ? { kind: "reconnected" } : { kind: "timed-out" });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed.");
    } finally {
      setInstalling(false);
    }
  }

  const busy = installing || restartPhase.kind === "restarting";

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Updates</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Checks GitHub for new commits on <code>master</code>. Installing pulls the latest code, rebuilds the app, applies any new
        database migrations, and restarts the server — this takes a minute or two, during which the app is briefly unreachable. The log
        below streams live as each step runs.
      </p>

      {status && (
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          Currently running <code className="font-mono">{status.commit.sha}</code>: {status.commit.message}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleCheck}
          disabled={checkForUpdates.isPending || busy}
          className={`${primaryButtonBase} px-4 py-2 text-sm`}
        >
          {checkForUpdates.isPending ? "Checking..." : "Check for Updates"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {checkResult && logLines.length === 0 && (
        <div className="mt-4">
          {checkResult.upToDate ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">Already up to date.</p>
          ) : (
            <>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                {checkResult.commits.length} new commit{checkResult.commits.length === 1 ? "" : "s"} available:
              </p>
              <ul className="mb-4 space-y-1 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-600 dark:text-slate-400">
                {checkResult.commits.map((c) => (
                  <li key={c.sha}>
                    <span className="font-mono text-slate-400 dark:text-slate-500">{c.sha}</span> {c.message}
                  </li>
                ))}
              </ul>
              <button onClick={handleInstall} disabled={busy} className={`${primaryButtonBase} px-4 py-2 text-sm`}>
                {installing ? "Installing..." : "Install Update"}
              </button>
            </>
          )}
        </div>
      )}

      {logLines.length > 0 && (
        <div className="mt-4">
          {installResult && !installResult.success && <p className="mb-2 text-sm text-red-600">Update failed: {installResult.error}</p>}
          <pre
            ref={logRef}
            className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-600 dark:text-slate-400"
          >
            {logLines.join("\n")}
          </pre>
        </div>
      )}

      <RestartStatus phase={restartPhase} />
    </div>
  );
}

function NetworkSection() {
  const { data: status } = useSystemStatus();
  const updateNetwork = useUpdateNetworkSettings();
  const [port, setPort] = useState("");
  const [clientOrigin, setClientOrigin] = useState("");
  const [cookieSecure, setCookieSecure] = useState(false);
  const [restartPhase, setRestartPhase] = useState<RestartPhase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status) {
      setPort(status.network.port ? String(status.network.port) : "");
      setClientOrigin(status.network.clientOrigin);
      setCookieSecure(status.network.cookieSecure);
    }
  }, [status]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await updateNetwork.mutateAsync({
        port: port ? Number(port) : undefined,
        clientOrigin: clientOrigin || undefined,
        cookieSecure,
      });
      setRestartPhase({ kind: "restarting", attempt: 0 });
      const ok = await waitForReconnect((attempt) => setRestartPhase({ kind: "restarting", attempt }));
      setRestartPhase(ok ? { kind: "reconnected" } : { kind: "timed-out" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save network settings.");
    }
  }

  const saving = updateNetwork.isPending || restartPhase.kind === "restarting";

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Network</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Saving any of these restarts the server immediately, since they're only read once at startup.
      </p>

      <form onSubmit={handleSave} className="mt-4 space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Port</label>
          <p className="mb-1 text-xs text-slate-400 dark:text-slate-500">
            The port the server listens on inside this machine. Changing it doesn't change how you reach the app from outside — that's
            controlled by your reverse proxy, tunnel, or port forwarding — but whatever's pointing at this server needs to match.
          </p>
          <input
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className={`${inputClass} w-32`}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">CORS Allowed Origins</label>
          <p className="mb-1 text-xs text-slate-400 dark:text-slate-500">
            Comma-separated list of the exact origins (scheme + host + port, e.g. <code>https://demo.example.com</code>) allowed to make
            API requests to this server. This is a browser security rule: your own frontend's origin must be listed here or the browser
            will block logins and every other API call as cross-origin. Add a new one here whenever you put this app behind a new domain
            or tunnel.
          </p>
          <input value={clientOrigin} onChange={(e) => setClientOrigin(e.target.value)} className={inputClass} />
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={cookieSecure}
            onChange={(e) => setCookieSecure(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Cookie Secure flag
            <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-500">
              Turn this ON once the app is reached over real HTTPS with a valid certificate — browsers refuse to store a non-Secure
              cookie from an HTTPS page, which breaks login. Turn it OFF for plain HTTP access (a bare IP, or a domain without a
              certificate yet). Getting this backwards is the most common cause of "login doesn't stick" — the session cookie gets set
              but the browser silently discards it.
            </span>
          </span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={saving} className={`${primaryButtonBase} px-4 py-2 text-sm`}>
          {updateNetwork.isPending ? "Saving..." : "Save Network Settings"}
        </button>
      </form>

      <RestartStatus phase={restartPhase} />
    </div>
  );
}

export function AdminSystemPanel() {
  return (
    <div className="space-y-6">
      <UpdatesSection />
      <NetworkSection />
      <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-4 text-xs text-amber-800 dark:text-amber-300">
        <strong>Restart requires sudo access.</strong> Installing an update or saving network settings both restart the server via{" "}
        <code>systemctl</code>, which needs a narrow passwordless sudo rule configured on the host for exactly that command. See{" "}
        <code>deploy/README.md</code> in the repo for the one-line setup. Without it, the update/settings still save correctly — only
        the automatic restart step fails, and you'll need to restart the service yourself.
      </div>
    </div>
  );
}
