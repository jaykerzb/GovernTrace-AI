import { Router } from "express";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/requireAuth.js";
import { logAudit } from "../services/auditLog.js";
import { PERMISSIONS, getRolePermissions, setPermission } from "../services/permissions.js";

export const adminRolesRouter = Router();
adminRolesRouter.use(requireAuth, requireRole("ADMIN"));

const ROLES = ["ADMIN", "COMPLIANCE_OFFICER", "SYSTEM_OWNER", "APPROVER", "VIEWER"] as const;
const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as [string, ...string[]];

adminRolesRouter.get("/role-permissions", async (_req, res) => {
  const grants = await getRolePermissions();
  const byRole: Record<string, string[]> = Object.fromEntries(ROLES.map((r) => [r, []]));
  // ADMIN always holds every permission — reflected here for display even
  // though it's never actually stored or checked via the table.
  byRole.ADMIN = PERMISSIONS.map((p) => p.key);
  for (const g of grants) {
    if (g.role === "ADMIN") continue;
    byRole[g.role].push(g.permission);
  }
  res.json({ permissions: PERMISSIONS, grants: byRole });
});

const updateSchema = z.object({
  role: z.enum(ROLES),
  permission: z.enum(PERMISSION_KEYS),
  granted: z.boolean(),
});

adminRolesRouter.patch("/role-permissions", async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.role === "ADMIN") {
    return res.status(400).json({ error: "Admins always have full access and can't be changed." });
  }

  await setPermission(parsed.data.role as Role, parsed.data.permission, parsed.data.granted);

  await logAudit({
    entityType: "RolePermission",
    entityId: `${parsed.data.role}:${parsed.data.permission}`,
    aiSystemId: null,
    action: "ROLE_PERMISSION_UPDATED",
    actorId: req.user!.userId,
    summary: `${parsed.data.granted ? "Granted" : "Revoked"} "${parsed.data.permission}" ${
      parsed.data.granted ? "to" : "from"
    } ${parsed.data.role.replace("_", " ")}.`,
  });

  res.status(204).end();
});
