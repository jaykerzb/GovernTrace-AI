import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/requireAuth.js";
import { logAudit } from "../services/auditLog.js";
import { getOrgSettings, updateOrgSettings } from "../services/orgSettings.js";

export const orgSettingsRouter = Router();

// Public (no auth) — the login page and sidebar need branding before a
// session exists. Nothing here is sensitive.
orgSettingsRouter.get("/org-settings", async (_req, res) => {
  res.json(await getOrgSettings());
});

const updateSchema = z
  .object({
    orgName: z.string().min(1).optional(),
    logoUrl: z.string().url().optional().nullable(),
    primaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #0f172a")
      .optional(),
    approvalAuthorityLowLabel: z.string().min(1).optional(),
    approvalAuthorityHighLabel: z.string().min(1).optional(),
    showApprovalAuthorityLabels: z.boolean().optional(),
    approvalThreshold: z.number().int().min(9).max(45).optional(),
    reassessmentCadenceDays: z.number().int().min(1).optional(),
    riskBandLowMax: z.number().int().min(9).max(45).optional(),
    riskBandModerateMax: z.number().int().min(9).max(45).optional(),
    riskBandHighMax: z.number().int().min(9).max(45).optional(),
  })
  .refine(
    (d) => {
      // Only enforce ordering when at least one band edge is present in this
      // request — validated against whichever edges were actually sent
      // together. Full three-way ordering is enforced below once we know
      // the resulting values (see the merge check in the route handler).
      if (d.riskBandLowMax !== undefined && d.riskBandModerateMax !== undefined && d.riskBandLowMax >= d.riskBandModerateMax) {
        return false;
      }
      if (d.riskBandModerateMax !== undefined && d.riskBandHighMax !== undefined && d.riskBandModerateMax >= d.riskBandHighMax) {
        return false;
      }
      return true;
    },
    { message: "Risk band cutoffs must increase: Low < Moderate < High." }
  );

orgSettingsRouter.patch("/org-settings", requireAuth, requireRole("ADMIN"), async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Re-validate ordering against the values that will actually be in effect
  // after this partial update (a request might only touch one field).
  const current = await getOrgSettings();
  const effective = { ...current, ...parsed.data };
  if (effective.riskBandLowMax >= effective.riskBandModerateMax || effective.riskBandModerateMax >= effective.riskBandHighMax) {
    return res.status(400).json({ error: "Risk band cutoffs must increase: Low < Moderate < High." });
  }

  const settings = await updateOrgSettings(parsed.data);

  await logAudit({
    entityType: "OrgSettings",
    entityId: settings.id,
    aiSystemId: null,
    action: "ORG_SETTINGS_UPDATED",
    actorId: req.user!.userId,
    summary: "Updated organization branding and governance settings.",
  });

  res.json(settings);
});
