// Backs the Admin > System panel: checking for and installing updates from
// GitHub, and editing the network-related .env settings. Deliberately kept
// out of the admin-configurable RolePermission system (see permissions.ts)
// — this is infrastructure control, not a governance-workflow action, so
// it's hardcoded Admin-only at the route level instead.
//
// Assumes the deployment layout documented in deploy/governtrace-ai.service:
// this process's cwd is <repo>/server, so the repo root is one level up.
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(process.cwd(), "..");
const ENV_PATH = path.join(process.cwd(), ".env");
const SERVICE_NAME = "governtrace-ai";

interface StepResult {
  command: string;
  output: string;
}

// `npm`/`npx` are `.cmd` shims on Windows, which spawn/execFile can't run
// directly without a shell — irrelevant on the Linux deployment target
// (where they're real executables on PATH) but breaks running any of this
// on a Windows dev machine otherwise.
const NEEDS_SHELL = process.platform === "win32";

async function run(command: string, args: string[], cwd = REPO_ROOT): Promise<StepResult> {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd,
    timeout: 5 * 60 * 1000,
    maxBuffer: 10 * 1024 * 1024,
    shell: NEEDS_SHELL,
  });
  return { command: [command, ...args].join(" "), output: (stdout + stderr).trim() };
}

// Like `run`, but calls `onOutput` with each chunk of stdout/stderr as it
// arrives (via spawn, not execFile, which only ever hands back output after
// the process has already exited) — used by installUpdate so the admin
// panel can show the build/migration output live instead of one silent
// multi-minute wait followed by a wall of text at the end.
function runStreaming(command: string, args: string[], onOutput: (chunk: string) => void, cwd = REPO_ROOT): Promise<StepResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: NEEDS_SHELL });
    let output = "";
    const onChunk = (data: Buffer) => {
      const text = data.toString();
      output += text;
      onOutput(text);
    };
    child.stdout.on("data", onChunk);
    child.stderr.on("data", onChunk);
    child.on("error", reject);
    child.on("close", (code) => {
      const result = { command: [command, ...args].join(" "), output: output.trim() };
      if (code === 0) resolve(result);
      else reject(Object.assign(new Error(`${result.command} exited with code ${code}`), { partialResult: result }));
    });
  });
}

export async function getCurrentCommit(): Promise<{ sha: string; message: string }> {
  const sha = (await run("git", ["rev-parse", "--short", "HEAD"])).output;
  const message = (await run("git", ["log", "-1", "--pretty=%s"])).output;
  return { sha, message };
}

export interface PendingCommit {
  sha: string;
  message: string;
}

export async function checkForUpdates(): Promise<{ upToDate: boolean; commits: PendingCommit[] }> {
  await run("git", ["fetch", "origin", "master", "--quiet"]);

  // Deliberately `HEAD..origin/master` (commits on the remote not yet in
  // local), not a simple SHA-equality check — this VM's checkout can be
  // ahead of the remote too (e.g. commits made and pushed from elsewhere
  // after this one), and equality would misreport that as "not up to
  // date" while listing zero pending commits.
  const { output } = await run("git", ["log", "--pretty=format:%h%x09%s", "HEAD..origin/master"]);
  const commits = output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, ...rest] = line.split("\t");
      return { sha, message: rest.join("\t") };
    });
  return { upToDate: commits.length === 0, commits };
}

// Restarts the service via systemd. Requires a scoped passwordless sudo rule
// for exactly this command — see deploy/README.md. Called after the HTTP
// response has already been sent, since this kills the very process
// handling the request.
export function restartService(): void {
  execFile("sudo", ["systemctl", "restart", SERVICE_NAME], () => {
    // No callback handling needed: if this fails, systemd's own status
    // (or the fact that the app never comes back) is the signal — there's
    // no live process left to report back to once the restart succeeds,
    // and if it fails due to a missing sudo rule the admin panel's
    // "reconnecting..." check will simply time out, which is diagnostic
    // enough to point them at deploy/README.md.
  });
}

export interface UpdateInstallResult {
  success: boolean;
  steps: StepResult[];
  error?: string;
}

// Emitted live as the update runs, so the admin panel can render real
// progress instead of a single silent wait (this can take a minute or two
// — full npm install, two builds, and a migration).
export type UpdateProgressEvent =
  | { type: "step-start"; command: string }
  | { type: "step-output"; chunk: string }
  | { type: "step-done"; command: string }
  | { type: "step-failed"; command: string; error: string };

export async function installUpdate(onEvent: (event: UpdateProgressEvent) => void): Promise<UpdateInstallResult> {
  const steps: StepResult[] = [];

  async function runStep(command: string, args: string[]): Promise<void> {
    const label = [command, ...args].join(" ");
    onEvent({ type: "step-start", command: label });
    try {
      const result = await runStreaming(command, args, (chunk) => onEvent({ type: "step-output", chunk }));
      steps.push(result);
      onEvent({ type: "step-done", command: label });
    } catch (err) {
      const partial = err && typeof err === "object" && "partialResult" in err ? (err as { partialResult: StepResult }).partialResult : undefined;
      if (partial) steps.push(partial);
      const message = err instanceof Error ? err.message : String(err);
      onEvent({ type: "step-failed", command: label, error: message });
      throw err;
    }
  }

  try {
    await runStep("git", ["pull", "origin", "master"]);
    await runStep("npm", ["install"]);
    await runStep("npm", ["run", "build", "-w", "client"]);
    await runStep("npm", ["run", "build", "-w", "server"]);

    // The compiled server (server/src/index.ts) looks for the built client
    // at server/client — copy it into place explicitly.
    onEvent({ type: "step-start", command: "copy client build to server/client" });
    const clientDist = path.join(REPO_ROOT, "client", "dist");
    const serverClient = path.join(REPO_ROOT, "server", "client");
    await fs.rm(serverClient, { recursive: true, force: true });
    await fs.cp(clientDist, serverClient, { recursive: true });
    onEvent({ type: "step-done", command: "copy client build to server/client" });

    await runStep("npx", ["prisma", "generate", "--schema", "server/prisma/schema.prisma"]);
    await runStep("npx", ["prisma", "migrate", "deploy", "--schema", "server/prisma/schema.prisma"]);

    return { success: true, steps };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, steps, error: message };
  }
}

export interface NetworkSettings {
  port: number | null;
  clientOrigin: string;
  cookieSecure: boolean;
}

function parseEnvValue(content: string, key: string): string | undefined {
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match) return undefined;
  return match[1].trim().replace(/^"(.*)"$/, "$1");
}

export async function getNetworkSettings(): Promise<NetworkSettings> {
  const content = await fs.readFile(ENV_PATH, "utf8");
  const port = parseEnvValue(content, "PORT");
  const clientOrigin = parseEnvValue(content, "CLIENT_ORIGIN");
  const cookieSecure = parseEnvValue(content, "COOKIE_SECURE");
  return {
    port: port ? Number(port) : null,
    clientOrigin: clientOrigin ?? "",
    cookieSecure: cookieSecure === "true",
  };
}

function setEnvValue(content: string, key: string, value: string): string {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^#?\\s*${key}=.*$`, "m");
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  return `${content.trimEnd()}\n${line}\n`;
}

export async function updateNetworkSettings(update: Partial<NetworkSettings>): Promise<void> {
  let content = await fs.readFile(ENV_PATH, "utf8");
  if (update.port !== undefined && update.port !== null) {
    content = setEnvValue(content, "PORT", String(update.port));
  }
  if (update.clientOrigin !== undefined) {
    content = setEnvValue(content, "CLIENT_ORIGIN", update.clientOrigin);
  }
  if (update.cookieSecure !== undefined) {
    content = setEnvValue(content, "COOKIE_SECURE", update.cookieSecure ? "true" : "false");
  }
  await fs.writeFile(ENV_PATH, content, "utf8");
}
