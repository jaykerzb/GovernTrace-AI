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

// Server-Sent Events rather than a single JSON response — this can take a
// minute or two (full npm install, two builds, a migration), and the admin
// panel shows the output live as each line arrives instead of one silent
// wait followed by a wall of text at the end.
systemRouter.post("/system/updates/install", async (req: AuthedRequest, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const result = await installUpdate((event) => send(event));

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

  send({ type: "done", result });
  res.end();

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
