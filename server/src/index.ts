import "dotenv/config";
import express from "express";
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

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173", credentials: true }));
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

app.listen(port, () => {
  console.log(`GovernTrace AI server listening on http://localhost:${port}`);
});
