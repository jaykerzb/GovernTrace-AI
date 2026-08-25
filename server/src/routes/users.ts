import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const usersRouter = Router();

// Used to populate "assign an owner" pickers, so only active users are
// offered. The admin panel's user management uses GET /api/admin/users
// instead, which includes inactive accounts.
usersRouter.get("/", requireAuth, async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  res.json(users);
});
