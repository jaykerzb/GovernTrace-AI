import type { Request, Response, NextFunction } from "express";
import type { Role } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { hasPermission } from "../services/permissions.js";

export interface AuthedRequest extends Request {
  user?: { userId: string; role: Role };
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const payload = verifySession(token);
    // Look the user up fresh on every request (rather than trusting the JWT's
    // role claim) so a deactivation or role change takes effect immediately
    // instead of waiting out the token's lifetime.
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Account not found or deactivated" });
    }
    req.user = { userId: user.id, role: user.role };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

// Gates a route by an admin-configurable privilege (see
// services/permissions.ts) rather than a hardcoded role list — used for
// governance-workflow actions whose allowed roles an admin can change from
// the Roles tab. ADMIN always passes (enforced inside hasPermission, not
// here) regardless of what's in the RolePermission table.
export function requirePermission(key: string) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!(await hasPermission(req.user.role, key))) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}
