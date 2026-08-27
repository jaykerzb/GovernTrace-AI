import "dotenv/config";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { systemsRouter } from "./routes/systems.js";
import { assessmentsRouter } from "./routes/assessments.js";
import { auditRouter } from "./routes/audit.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { documentsRouter } from "./routes/documents.js";
import { adminRouter } from "./routes/admin.js";
import { workPapersRouter } from "./routes/workPapers.js";
import { committeeReviewRouter } from "./routes/committeeReview.js";
import { notificationsRouter } from "./routes/notifications.js";
import { myQueueRouter } from "./routes/myQueue.js";
import { analyticsRouter } from "./routes/analytics.js";
import { orgSettingsRouter } from "./routes/orgSettings.js";
import { aiTypeOptionsRouter } from "./routes/aiTypeOptions.js";
import { businessUnitOptionsRouter } from "./routes/businessUnitOptions.js";
import { adminReviewFunctionsRouter } from "./routes/adminReviewFunctions.js";
import { approvalsRouter } from "./routes/approvals.js";
import { customFieldsRouter } from "./routes/customFields.js";
import { meetingsRouter } from "./routes/meetings.js";
import { calendarRouter } from "./routes/calendar.js";
import { commentsRouter } from "./routes/comments.js";
import { documentSearchRouter } from "./routes/documentSearch.js";
import { policiesRouter } from "./routes/policies.js";
import { policySearchRouter } from "./routes/policySearch.js";
import { emailSettingsRouter } from "./routes/emailSettings.js";
import { emailTemplatesRouter } from "./routes/emailTemplates.js";
import { adminRolesRouter } from "./routes/adminRoles.js";
import { permissionsRouter } from "./routes/permissions.js";
import { systemRouter } from "./routes/system.js";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

// Trust the first hop's X-Forwarded-* headers — needed so req.secure and the
// client's real IP resolve correctly when this sits behind a reverse proxy
// or tunnel (Cloudflare Tunnel, nginx, etc.), which terminates TLS itself
// and forwards to this server over plain HTTP.
app.set("trust proxy", 1);

// Adds a handful of low-risk security headers — most importantly
// X-Content-Type-Options: nosniff, which stops a browser from ignoring an
// uploaded document's stored MIME type and rendering it as something more
// dangerous (e.g. HTML) than what it was served as. Deliberately narrow
// rather than helmet's full defaults:
//   - contentSecurityPolicy: off. The office-preview HTML response (see
//     services/textExtraction.ts) ships its own inline <style> block, and a
//     default CSP would silently break that; the XSS surface it would guard
//     against is already covered by server-side sanitization plus the
//     preview iframe's own empty `sandbox` attribute.
//   - hsts: off. This app explicitly supports plain-HTTP deployments (see
//     COOKIE_SECURE's documented default in server/.env.example) — no
//     reason to push browsers toward requiring HTTPS on every visit.
app.use(helmet({ contentSecurityPolicy: false, hsts: false }));

// CLIENT_ORIGIN accepts a comma-separated list so this can be reached from
// more than one origin at once (e.g. http://localhost:5173 during local dev
// plus a Cloudflare Tunnel / real domain) without a code change — just add
// the extra origin(s) to the .env value.
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173").split(",").map((o) => o.trim());

// A per-request delegate (rather than a static options object) so this can
// compare the request's Origin against the request's own host — since the
// compiled server serves its own frontend, a same-origin request should
// never be blocked by a stale/missing CLIENT_ORIGIN entry, no matter what's
// configured. Vite's built output loads as ES modules, which browsers fetch
// in CORS mode (sending an Origin header) even for a plain
// <script type="module">, so this isn't just an API concern — getting it
// wrong breaks the app's own JS/CSS from loading at all.
app.use(
  cors((req, callback) => {
    const origin = req.header("Origin");
    const selfOrigin = `${req.protocol}://${req.get("host")}`;
    const allowed = !origin || origin === selfOrigin || allowedOrigins.includes(origin);
    // `origin: false` (not an Error) — cors then just omits the CORS
    // headers instead of throwing into Express's default error handler,
    // which otherwise turns any disallowed origin into an opaque 500 for
    // every asset/API request from that origin instead of a clean CORS
    // block the browser itself reports.
    if (!allowed) console.warn(`Blocked CORS request from origin: ${origin}`);
    callback(null, { origin: allowed, credentials: true });
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Mounted first: its GET is intentionally public (no session yet on the
// login page), and every other router below gates ALL paths reaching it
// with an unconditional requireAuth — mounting this after them would let
// their blanket auth-gate intercept /org-settings before it's ever reached.
app.use("/api", orgSettingsRouter);

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/systems", systemsRouter);
app.use("/api", assessmentsRouter);
app.use("/api", auditRouter);
app.use("/api", dashboardRouter);
app.use("/api", documentsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/admin", adminReviewFunctionsRouter);
app.use("/api", workPapersRouter);
app.use("/api", committeeReviewRouter);
app.use("/api", notificationsRouter);
app.use("/api", myQueueRouter);
app.use("/api", analyticsRouter);
app.use("/api", aiTypeOptionsRouter);
app.use("/api", businessUnitOptionsRouter);
app.use("/api", approvalsRouter);
app.use("/api", customFieldsRouter);
app.use("/api", meetingsRouter);
app.use("/api", calendarRouter);
app.use("/api", commentsRouter);
app.use("/api", documentSearchRouter);
app.use("/api", policiesRouter);
app.use("/api", policySearchRouter);
app.use("/api/admin", emailSettingsRouter);
app.use("/api/admin", emailTemplatesRouter);
app.use("/api/admin", adminRolesRouter);
app.use("/api", permissionsRouter);
app.use("/api/admin", systemRouter);

// Serves the built client (client/dist, copied alongside this file's compiled
// output at deploy time) so the whole app ships as one process/container —
// no separate static host, no cross-origin cookies to configure. Only kicks
// in when that folder actually exists, so local dev (client served by Vite
// on its own port) is unaffected.
const clientDist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../client");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`GovernTrace AI server listening on http://localhost:${port}`);
});
