import fs from "fs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission, type AuthedRequest } from "../middleware/requireAuth.js";
import { logAudit } from "../services/auditLog.js";
import { systemUploadDir } from "../lib/uploads.js";

export const systemsRouter = Router();

systemsRouter.use(requireAuth);

const SYSTEM_STATUSES = [
  "DRAFT",
  "INTAKE",
  "RISK_ASSESSMENT",
  "UNDER_REVIEW",
  "APPROVED",
  "DEPLOYED",
  "MONITORING",
  "RETIRED",
] as const;

const systemInputSchema = z.object({
  useCaseId: z.string().optional().nullable(),
  // ISO date string (e.g. "2026-09-01") from an HTML <input type="date">.
  dateSubmitted: z.string().optional().nullable(),
  // Intentionally not .min(1): intake starts as a blank draft and gets
  // filled in over time, so nothing here is required up front.
  name: z.string(),
  description: z.string(),
  capabilityCategory: z.string().optional().nullable(),
  businessUnit: z.string(),
  aitoCoordinator: z.string().optional().nullable(),
  sponsorName: z.string().optional().nullable(),
  ownerId: z.string().min(1),
  applicationName: z.string().optional().nullable(),
  // References AiTypeOption.key — an org-editable list, so this stays a
  // plain non-empty string rather than a fixed enum.
  aiType: z.string().min(1),
  vendorName: z.string().optional().nullable(),
  projectedCost: z.number().nonnegative().optional().nullable(),
  // ISO date string (e.g. "2026-09-01") from an HTML <input type="date">.
  targetDeploymentDate: z.string().optional().nullable(),
  // Optional so a system can be created at the start of the intake wizard
  // (step 1: Basics) before these are filled in during step 2.
  purpose: z.string().optional().nullable(),
  businessJustification: z.string().optional().nullable(),
  dataTypesUsed: z.string().optional().nullable(),
  deploymentContext: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Org-defined custom intake fields, keyed by CustomFieldDef.key.
  customFieldValues: z.record(z.string(), z.any()).optional(),
});

// Converts the validated input into Prisma create/update data, turning the
// target deployment date / date submitted strings into real Dates (or
// leaving them null/undefined). Generic so it preserves whichever
// required/optional shape the caller passed in (the full schema for create,
// a Partial for update) instead of collapsing both into one looser union type.
function toPrismaData<
  T extends { targetDeploymentDate?: string | null; dateSubmitted?: string | null; customFieldValues?: Record<string, unknown> }
>(
  input: T
): Omit<T, "targetDeploymentDate" | "dateSubmitted" | "customFieldValues"> & {
  targetDeploymentDate?: Date | null;
  dateSubmitted?: Date | null;
  customFieldValues?: string;
} {
  const { targetDeploymentDate, dateSubmitted, customFieldValues, ...rest } = input;
  return {
    ...rest,
    ...(targetDeploymentDate !== undefined
      ? { targetDeploymentDate: targetDeploymentDate ? new Date(targetDeploymentDate) : null }
      : {}),
    ...(dateSubmitted !== undefined ? { dateSubmitted: dateSubmitted ? new Date(dateSubmitted) : null } : {}),
    ...(customFieldValues !== undefined ? { customFieldValues: JSON.stringify(customFieldValues) } : {}),
  };
}

// A draft counts as "abandoned" only if literally nothing was ever entered —
// still has the placeholder name from intake start, and no description or
// business unit. Anything the user actually typed opts it out permanently.
const ABANDONED_DRAFT_WHERE = {
  status: "DRAFT" as const,
  name: "Untitled Use Case",
  description: "",
  businessUnit: "",
  OR: [{ notes: null }, { notes: "" }],
  documents: { none: {} },
  riskAssessments: { none: {} },
};

async function cascadeDeleteSystem(systemId: string) {
  await prisma.$transaction([
    prisma.document.deleteMany({ where: { aiSystemId: systemId } }),
    prisma.functionWorkPaper.deleteMany({ where: { aiSystemId: systemId } }),
    prisma.committeeReview.deleteMany({ where: { aiSystemId: systemId } }),
    prisma.riskAssessment.deleteMany({ where: { aiSystemId: systemId } }),
    prisma.approvalStep.deleteMany({ where: { aiSystemId: systemId } }),
    prisma.comment.deleteMany({ where: { aiSystemId: systemId } }),
    prisma.auditLog.deleteMany({ where: { aiSystemId: systemId } }),
    prisma.aiSystem.delete({ where: { id: systemId } }),
  ]);
  fs.rm(systemUploadDir(systemId), { recursive: true, force: true }, () => {});
}

// Best-effort garbage collection for drafts the user opened and then walked
// away from without typing anything — the client also tries to clean these
// up immediately on navigating away from the intake wizard, but this sweep
// catches the cases that misses (closed tab, crashed browser, etc.). Only
// sweeps drafts old enough that the user isn't still actively on the page.
async function sweepAbandonedDrafts() {
  const staleCutoff = new Date(Date.now() - 30 * 60 * 1000);
  const stale = await prisma.aiSystem.findMany({
    where: { ...ABANDONED_DRAFT_WHERE, createdAt: { lt: staleCutoff } },
    select: { id: true },
  });
  for (const s of stale) {
    await cascadeDeleteSystem(s.id);
  }
}

systemsRouter.get("/", async (req, res) => {
  const { status, approvalAuthority, ownerId, q, aiType, businessUnit } = req.query as Record<string, string | undefined>;

  await sweepAbandonedDrafts();

  // Narrowed to exactly what the list view, the calendar's use-case picker,
  // and global search actually render — this is the most frequently loaded
  // endpoint in the app, and it was previously returning every column
  // (description, purpose, businessJustification, customFieldValues, the
  // full owner relation, etc.) for every row regardless of how many of them
  // any caller used. GET /systems/:id still returns the full record for the
  // detail page, which is where all of that actually gets read.
  const systems = await prisma.aiSystem.findMany({
    where: {
      status: status ? (status as any) : undefined,
      currentApprovalAuthority: approvalAuthority ? (approvalAuthority as any) : undefined,
      ownerId: ownerId || undefined,
      aiType: aiType || undefined,
      businessUnit: businessUnit ? { contains: businessUnit } : undefined,
      name: q ? { contains: q } : undefined,
    },
    select: {
      id: true,
      name: true,
      businessUnit: true,
      aiType: true,
      ownerId: true,
      status: true,
      currentScore: true,
      currentReviewTriggered: true,
      notes: true,
      createdAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json(systems);
});

systemsRouter.get("/:id", async (req, res) => {
  const system = await prisma.aiSystem.findUnique({
    where: { id: req.params.id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      riskAssessments: { orderBy: { version: "desc" }, include: { assessedBy: { select: { name: true } } } },
    },
  });
  if (!system) return res.status(404).json({ error: "Not found" });
  res.json(system);
});

systemsRouter.post("/", requirePermission("CREATE_SYSTEM"), async (req: AuthedRequest, res) => {
  const parsed = systemInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const system = await prisma.aiSystem.create({
    data: { ...toPrismaData(parsed.data), status: "DRAFT" },
  });
  await logAudit({
    entityType: "AiSystem",
    entityId: system.id,
    aiSystemId: system.id,
    action: "CREATED",
    actorId: req.user!.userId,
    summary: `Intake started for system "${system.name}".`,
  });
  res.status(201).json(system);
});

// Called by the client when the intake wizard unmounts. Deletes the draft
// only if it's still completely untouched — no user-visible error either
// way, since this is invisible housekeeping, not a user-facing action.
systemsRouter.post("/:id/abandon", async (req: AuthedRequest, res) => {
  const existing = await prisma.aiSystem.findUnique({ where: { id: req.params.id } });
  if (
    existing &&
    existing.status === "DRAFT" &&
    existing.name === "Untitled Use Case" &&
    existing.description === "" &&
    existing.businessUnit === "" &&
    !existing.notes
  ) {
    const [documentCount, assessmentCount] = await Promise.all([
      prisma.document.count({ where: { aiSystemId: existing.id } }),
      prisma.riskAssessment.count({ where: { aiSystemId: existing.id } }),
    ]);
    if (documentCount === 0 && assessmentCount === 0) {
      await cascadeDeleteSystem(existing.id);
    }
  }
  res.status(204).end();
});

const bulkUpdateSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  ownerId: z.string().min(1).optional(),
  status: z.enum(SYSTEM_STATUSES).optional(),
  businessUnit: z.string().min(1).optional(),
});

// Bulk routes are registered before "/:id" so "bulk" is never captured as an id param.
systemsRouter.patch("/bulk", requirePermission("BULK_MANAGE_SYSTEMS"), async (req: AuthedRequest, res) => {
  const parsed = bulkUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!parsed.data.ownerId && !parsed.data.status && !parsed.data.businessUnit) {
    return res.status(400).json({ error: "Nothing to update." });
  }

  const systems = await prisma.aiSystem.findMany({ where: { id: { in: parsed.data.ids } } });
  const data: { ownerId?: string; status?: (typeof SYSTEM_STATUSES)[number]; businessUnit?: string } = {};
  if (parsed.data.ownerId) data.ownerId = parsed.data.ownerId;
  if (parsed.data.status) data.status = parsed.data.status;
  if (parsed.data.businessUnit) data.businessUnit = parsed.data.businessUnit;

  await prisma.$transaction(systems.map((s) => prisma.aiSystem.update({ where: { id: s.id }, data })));

  // One batched insert instead of N sequential round-trips — same audit
  // history, just not a query-per-row on the hot path of a bulk action
  // that's specifically meant to be fast for a large selection.
  await prisma.auditLog.createMany({
    data: systems.map((s) => ({
      entityType: "AiSystem",
      entityId: s.id,
      aiSystemId: s.id,
      action: "BULK_UPDATE",
      actorId: req.user!.userId,
      summary: `Bulk update on "${s.name}"${data.ownerId ? ` (owner reassigned)` : ""}${
        data.status ? ` (status changed to ${data.status})` : ""
      }${data.businessUnit ? ` (business unit changed to ${data.businessUnit})` : ""}.`,
    })),
  });

  res.json({ updated: systems.length });
});

const bulkDeleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1) });

systemsRouter.delete("/bulk", requirePermission("BULK_MANAGE_SYSTEMS"), async (req: AuthedRequest, res) => {
  const parsed = bulkDeleteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const systems = await prisma.aiSystem.findMany({ where: { id: { in: parsed.data.ids } } });
  // Each cascade is its own multi-table transaction plus a filesystem
  // removal, so these stay sequential rather than Promise.all'd — SQLite
  // only ever executes one write at a time anyway, and interleaving several
  // independent cascades wouldn't be faster, just riskier to reason about.
  // The audit entries don't share that constraint, so those still batch
  // into one insert after the loop instead of one per row inside it.
  for (const s of systems) {
    await cascadeDeleteSystem(s.id);
  }
  await prisma.auditLog.createMany({
    data: systems.map((s) => ({
      entityType: "AiSystem",
      entityId: s.id,
      aiSystemId: null,
      action: "SYSTEM_DELETED",
      actorId: req.user!.userId,
      summary: `Deleted AI use case "${s.name}" and all its associated records (bulk delete).`,
    })),
  });

  res.json({ deleted: systems.length });
});

systemsRouter.patch("/:id", requirePermission("EDIT_SYSTEM"), async (req: AuthedRequest, res) => {
  const existing = await prisma.aiSystem.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (req.user!.role === "SYSTEM_OWNER" && existing.ownerId !== req.user!.userId) {
    return res.status(403).json({ error: "You can only edit systems you own" });
  }

  const parsed = systemInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const system = await prisma.aiSystem.update({
    where: { id: req.params.id },
    data: toPrismaData(parsed.data),
  });
  await logAudit({
    entityType: "AiSystem",
    entityId: system.id,
    aiSystemId: system.id,
    action: "UPDATED",
    actorId: req.user!.userId,
    summary: `System "${system.name}" details were updated.`,
  });
  res.json(system);
});

systemsRouter.delete("/:id", requirePermission("DELETE_SYSTEM"), async (req: AuthedRequest, res) => {
  const existing = await prisma.aiSystem.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (req.user!.role === "SYSTEM_OWNER" && existing.ownerId !== req.user!.userId) {
    return res.status(403).json({ error: "You can only delete systems you own" });
  }

  // Cascade-clean everything scoped to this system — documents (rows + the
  // files themselves), work papers, assessments, approval steps, and its own
  // audit history — before removing the system row itself. The deletion
  // itself is then logged as a system-level (aiSystemId: null) entry since
  // there's no longer a system to attach it to.
  await cascadeDeleteSystem(existing.id);

  await logAudit({
    entityType: "AiSystem",
    entityId: existing.id,
    aiSystemId: null,
    action: "SYSTEM_DELETED",
    actorId: req.user!.userId,
    summary: `Deleted AI use case "${existing.name}" and all its associated records.`,
  });

  res.status(204).end();
});

systemsRouter.post("/:id/complete-intake", async (req: AuthedRequest, res) => {
  const existing = await prisma.aiSystem.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.status !== "DRAFT") {
    return res.status(400).json({ error: "This system's intake has already been completed" });
  }

  const role = req.user!.role;
  const isOwner = existing.ownerId === req.user!.userId;
  if (role !== "ADMIN" && !(role === "SYSTEM_OWNER" && isOwner)) {
    return res.status(403).json({ error: "Only the system's owner or an admin can complete intake" });
  }

  const system = await prisma.aiSystem.update({
    where: { id: req.params.id },
    data: { status: "INTAKE" },
  });
  await logAudit({
    entityType: "AiSystem",
    entityId: system.id,
    aiSystemId: system.id,
    action: "INTAKE_COMPLETED",
    actorId: req.user!.userId,
    summary: `Intake completed for system "${system.name}".`,
  });
  res.json(system);
});

const statusSchema = z.object({
  status: z.enum(SYSTEM_STATUSES),
});

systemsRouter.patch(
  "/:id/status",
  requirePermission("CHANGE_SYSTEM_STATUS"),
  async (req: AuthedRequest, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid status" });

    const existing = await prisma.aiSystem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const system = await prisma.aiSystem.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status },
    });
    await logAudit({
      entityType: "AiSystem",
      entityId: system.id,
      aiSystemId: system.id,
      action: "STATUS_CHANGED",
      actorId: req.user!.userId,
      summary: `Status changed from ${existing.status} to ${system.status}.`,
    });
    res.json(system);
  }
);
