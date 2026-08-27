import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/requireAuth.js";
import { logAudit } from "../services/auditLog.js";
import {
  getCurrentCommit,
  checkForUpdates,
  installUpdate,
  restartService,
  getNetworkSettings,
  updateNetworkSettings,
} from "../services/systemControl.js";

// Hardcoded Admin-only, not gated through the configurable RolePermission
// system — this controls the server process and its own network config,
// not a governance-workflow action an org should be able to hand to
// another role.
export const systemRouter = Router();
systemRouter.use(requireAuth, requireRole("ADMIN"));

systemRouter.get("/system/status", async (_req, res) => {
  try {
    const [commit, network] = await Promise.all([getCurrentCommit(), getNetworkSettings()]);
    res.json({ commit, network });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not read system status." });
  }
});

systemRouter.get("/system/updates", async (_req, res) => {
  try {
    res.json(await checkForUpdates());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not check for updates." });
  }
});

systemRouter.post("/system/updates/install", async (req: AuthedRequest, res) => {
  const result = await installUpdate();

  if (result.success) {
    const commit = await getCurrentCommit();
    await logAudit({
      entityType: "System",
      entityId: "system",
      aiSystemId: null,
      action: "UPDATE_INSTALLED",
      actorId: req.user!.userId,
      summary: `Installed update, now at ${commit.sha}: ${commit.message}.`,
    });
  }

  res.json(result);
  if (result.success) {
    // Only after the response is flushed — this kills the very process
    // handling the request.
    res.on("finish", restartService);
  }
});

const networkSchema = z.object({
  port: z.number().int().min(1).max(65535).optional(),
  clientOrigin: z
    .string()
    .min(1)
    .refine(
      (val) => val.split(",").every((origin) => /^https?:\/\/\S+$/.test(origin.trim())),
      "Each origin must be a full URL starting with http:// or https://, comma-separated for more than one."
    )
    .optional(),
  cookieSecure: z.boolean().optional(),
});

systemRouter.patch("/system/network", async (req: AuthedRequest, res) => {
  const parsed = networkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (Object.keys(parsed.data).length === 0) return res.status(400).json({ error: "Nothing to update." });

  await updateNetworkSettings(parsed.data);

  await logAudit({
    entityType: "System",
    entityId: "system",
    aiSystemId: null,
    action: "NETWORK_SETTINGS_UPDATED",
    actorId: req.user!.userId,
    summary: "Updated network settings.",
  });

  res.json({ success: true });
  res.on("finish", restartService);
});
