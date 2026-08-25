import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/requireAuth.js";
import { logAudit } from "../services/auditLog.js";
import { getEmailSettings, updateEmailSettings } from "../services/emailSettings.js";
import { sendEmail } from "../services/emailService.js";
import { prisma } from "../lib/prisma.js";

export const emailSettingsRouter = Router();
emailSettingsRouter.use(requireAuth, requireRole("ADMIN"));

// Secrets (smtpPassword/apiKey) are never sent to the client — only whether
// one is currently stored, so the form can show "unchanged" instead of
// re-displaying (or blanking) a real credential.
function toWireSettings(settings: Awaited<ReturnType<typeof getEmailSettings>>) {
  const { smtpPassword, apiKey, ...rest } = settings;
  return { ...rest, hasSmtpPassword: !!smtpPassword, hasApiKey: !!apiKey };
}

emailSettingsRouter.get("/email-settings", async (_req, res) => {
  res.json(toWireSettings(await getEmailSettings()));
});

const PROVIDERS = ["DISABLED", "SMTP", "API"] as const;

const updateSchema = z.object({
  provider: z.enum(PROVIDERS).optional(),
  fromName: z.string().min(1).optional(),
  fromAddress: z.string().email().optional().nullable(),
  smtpHost: z.string().optional().nullable(),
  smtpPort: z.number().int().min(1).max(65535).optional().nullable(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().optional().nullable(),
  // Empty string means "leave unchanged" — filtered out below before hitting the DB.
  smtpPassword: z.string().optional(),
  apiKey: z.string().optional(),
});

emailSettingsRouter.patch("/email-settings", async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data = { ...parsed.data };
  if (!data.smtpPassword) delete data.smtpPassword;
  if (!data.apiKey) delete data.apiKey;

  const current = await getEmailSettings();
  const effective = { ...current, ...data };
  if (effective.provider === "SMTP" && (!effective.smtpHost || !effective.smtpPort || !effective.smtpUser || !effective.smtpPassword)) {
    return res.status(400).json({ error: "SMTP host, port, username, and password are all required." });
  }
  if (effective.provider === "API" && !effective.apiKey) {
    return res.status(400).json({ error: "An API key is required." });
  }
  if (effective.provider !== "DISABLED" && !effective.fromAddress) {
    return res.status(400).json({ error: "A from address is required." });
  }

  const settings = await updateEmailSettings(data);

  await logAudit({
    entityType: "EmailSettings",
    entityId: settings.id,
    aiSystemId: null,
    action: "EMAIL_SETTINGS_UPDATED",
    actorId: req.user!.userId,
    summary: `Updated email delivery settings (provider: ${settings.provider}).`,
  });

  res.json(toWireSettings(settings));
});

emailSettingsRouter.post("/email-settings/test", async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { email: true } });
  if (!user) return res.status(404).json({ error: "Not found" });

  const result = await sendEmail(
    user.email,
    "GovernTrace AI test email",
    "<p>This is a test email from your GovernTrace AI instance. If you're reading this, email delivery is working.</p>"
  );

  res.json(result);
});
