import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "../lib/auth.js";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";
import { logAudit } from "../services/auditLog.js";
import { wouldRemoveLastActiveAdmin } from "../services/adminGuards.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid email or password format" });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (!user.isActive) {
    return res.status(401).json({ error: "This account has been deactivated. Contact an administrator." });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signSession({ userId: user.id, role: user.role });
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(8 * 60 * 60 * 1000));
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailNotificationsEnabled: user.emailNotificationsEnabled,
  });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailNotificationsEnabled: user.emailNotificationsEnabled,
  });
});

const updateProfileSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  emailNotificationsEnabled: z.boolean().optional(),
});

authRouter.patch("/me", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existingWithEmail = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existingWithEmail && existingWithEmail.id !== req.user!.userId) {
    return res.status(400).json({ error: "That email is already in use" });
  }

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: parsed.data,
  });
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailNotificationsEnabled: user.emailNotificationsEnabled,
  });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

authRouter.post("/change-password", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return res.status(400).json({ error: "Current password is incorrect" });

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.status(204).end();
});

authRouter.post("/deactivate", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.userId;
  if (await wouldRemoveLastActiveAdmin(userId)) {
    return res.status(400).json({
      error: "You are the last active Admin. Promote another user to Admin before deactivating your account.",
    });
  }

  const user = await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
  await logAudit({
    entityType: "User",
    entityId: user.id,
    aiSystemId: null,
    action: "USER_DEACTIVATED",
    actorId: user.id,
    summary: `${user.name} deactivated their own account.`,
  });

  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  res.status(204).end();
});
