import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/requireAuth.js";
import { logAudit } from "../services/auditLog.js";
import { EMAIL_TEMPLATE_KINDS, getEmailTemplates, getEmailTemplate, updateEmailTemplate } from "../services/emailTemplates.js";
import { renderTemplate } from "../services/emailRender.js";
import { buildEmailHtml, formatEmailBody } from "../services/emailLayout.js";
import { sendEmail } from "../services/emailService.js";
import { prisma } from "../lib/prisma.js";

export const emailTemplatesRouter = Router();
emailTemplatesRouter.use(requireAuth, requireRole("ADMIN"));

// Sample data used to render a test send — mirrors the client's preview
// samples so what an admin tests matches what they previewed while editing.
const SAMPLE_VARIABLES: Record<string, Record<string, string>> = {
  COMMENT_POSTED: { authorName: "Jane Doe", systemName: "Acme Fraud Detection Model" },
  APPROVAL_STEP_REJECTED: { systemName: "Acme Fraud Detection Model" },
  APPROVAL_FULLY_APPROVED: { systemName: "Acme Fraud Detection Model" },
  APPROVAL_PENDING: { systemName: "Acme Fraud Detection Model" },
  ASSESSMENT_FINALIZED: { systemName: "Acme Fraud Detection Model", approvalDescription: "standard approval required", score: "27" },
  ASSESSMENT_ADDITIONAL_APPROVAL: { systemName: "Acme Fraud Detection Model", score: "34" },
  COMMITTEE_DECISION: { systemName: "Acme Fraud Detection Model", disposition: "APPROVED" },
  WORK_PAPER_COMPLETED: { functionLabel: "Privacy", systemName: "Acme Fraud Detection Model", riskRating: "Moderate" },
};

emailTemplatesRouter.get("/email-templates", async (_req, res) => {
  res.json(await getEmailTemplates());
});

const updateSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  ctaLabel: z.string().min(1),
});

emailTemplatesRouter.patch("/email-templates/:kind", async (req: AuthedRequest, res) => {
  if (!EMAIL_TEMPLATE_KINDS.includes(req.params.kind as (typeof EMAIL_TEMPLATE_KINDS)[number])) {
    return res.status(404).json({ error: "Unknown template kind." });
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const template = await updateEmailTemplate(req.params.kind, parsed.data);

  await logAudit({
    entityType: "EmailTemplate",
    entityId: template.id,
    aiSystemId: null,
    action: "EMAIL_TEMPLATE_UPDATED",
    actorId: req.user!.userId,
    summary: `Updated the "${template.kind}" email template.`,
  });

  res.json(template);
});

emailTemplatesRouter.post("/email-templates/:kind/test", async (req: AuthedRequest, res) => {
  const kind = req.params.kind;
  if (!EMAIL_TEMPLATE_KINDS.includes(kind as (typeof EMAIL_TEMPLATE_KINDS)[number])) {
    return res.status(404).json({ error: "Unknown template kind." });
  }
  const template = await getEmailTemplate(kind);
  if (!template) return res.status(404).json({ error: "Not found" });

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true, email: true } });
  if (!user) return res.status(404).json({ error: "Not found" });

  // recipientName uses the real requesting admin's name (not a sample) so a
  // test send reads naturally — every other placeholder still uses sample data.
  const variables = { ...(SAMPLE_VARIABLES[kind] ?? {}), recipientName: user.name };
  const subject = renderTemplate(template.subject, variables);
  const body = renderTemplate(template.body, variables);
  // Renders through the exact same branded shell (header/CTA button/footer)
  // a real notification email uses, so a test send is a true preview of
  // production output — no sample link exists yet, so the button points at
  // the app root.
  const html = await buildEmailHtml({ bodyHtml: formatEmailBody(body), ctaLabel: template.ctaLabel });

  const result = await sendEmail(user.email, subject, html);
  res.json(result);
});
