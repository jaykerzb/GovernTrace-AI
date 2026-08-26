#!/usr/bin/env node
// One-command local setup: creates server/.env with a real random JWT
// secret (never the placeholder from .env.example), installs dependencies,
// applies the Prisma schema, and seeds the 5 demo accounts. Plain Node with
// no extra dependencies, so it runs the same on Windows/macOS/Linux with
// nothing but Node itself — the one thing already required to run the app.

const { execSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, "server", ".env");
const ENV_EXAMPLE_PATH = path.join(ROOT, "server", ".env.example");

function run(command) {
  console.log(`\n> ${command}`);
  execSync(command, { cwd: ROOT, stdio: "inherit" });
}

function ensureEnvFile() {
  if (fs.existsSync(ENV_PATH)) {
    console.log("server/.env already exists — leaving it as-is.");
    return;
  }
  const template = fs.readFileSync(ENV_EXAMPLE_PATH, "utf8");
  const secret = randomBytes(32).toString("hex");
  const filled = template.replace(
    /JWT_SECRET=".*"/,
    `JWT_SECRET="${secret}"`
  );
  fs.writeFileSync(ENV_PATH, filled);
  console.log("Created server/.env with a freshly generated JWT secret.");
}

console.log("Setting up GovernTrace AI...");

ensureEnvFile();
run("npm install");
run("npm run prisma:migrate");
run("npm run prisma:seed");

console.log(`
Setup complete.

Run "npm run dev" to start the server (http://localhost:4000) and client (http://localhost:5173).

Demo accounts (password: governance123):
  Admin               admin@example.com
  Compliance Officer  compliance@example.com
  System Owner        owner@example.com
  Approver            approver@example.com
  Viewer              viewer@example.com

Want a fuller demo instead of an empty registry? Run:
  npm run prisma:seed:samples -w server
to add a handful of sample AI use cases across different statuses.
`);
