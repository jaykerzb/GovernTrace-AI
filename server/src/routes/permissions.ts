import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";
import { PERMISSIONS, getRolePermissions } from "../services/permissions.js";

export const permissionsRouter = Router();
permissionsRouter.use(requireAuth);

// The current user's own effective permission set — this is what the client
// uses to decide what to show/enable, so a privilege change an admin makes
// takes effect immediately (same "fetch fresh, don't trust stale state"
// posture requireAuth already uses for role/active-status).
permissionsRouter.get("/my-permissions", async (req: AuthedRequest, res) => {
  const role = req.user!.role;
  if (role === "ADMIN") {
    return res.json({ permissions: PERMISSIONS.map((p) => p.key) });
  }
  const grants = await getRolePermissions();
  const permissions = grants.filter((g) => g.role === role).map((g) => g.permission);
  res.json({ permissions });
});
