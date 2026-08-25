import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/requireAuth.js";
import { logAudit } from "../services/auditLog.js";
import { getAllReviewFunctions } from "../services/functionWorkPapers.js";

export const adminReviewFunctionsRouter = Router();
adminReviewFunctionsRouter.use(requireAuth, requireRole("ADMIN"));

const triggersSchema = z.object({
  deliveryModels: z.array(z.number().int()),
  capabilityTiers: z.array(z.number().int()),
  riskFactors: z.array(z.number().int()),
});

function slugifyKey(prefix: string, text: string): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `${prefix}_${base || "item"}`;
}

async function uniqueKey(candidate: string, exists: (key: string) => Promise<boolean>): Promise<string> {
  let key = candidate;
  let suffix = 2;
  while (await exists(key)) {
    key = `${candidate}_${suffix}`;
    suffix += 1;
  }
  return key;
}

// --- Review functions --------------------------------------------------------

adminReviewFunctionsRouter.get("/review-functions", async (_req, res) => {
  res.json(await getAllReviewFunctions());
});

const createFunctionSchema = z.object({ label: z.string().min(1), triggers: triggersSchema.optional() });

adminReviewFunctionsRouter.post("/review-functions", async (req: AuthedRequest, res) => {
  const parsed = createFunctionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  await getAllReviewFunctions(); // ensure defaults are seeded first

  const key = await uniqueKey(slugifyKey("fn", parsed.data.label), async (k) => !!(await prisma.reviewFunctionDef.findUnique({ where: { key: k } })));
  const maxSortOrder = await prisma.reviewFunctionDef.aggregate({ _max: { sortOrder: true } });
  const triggers = parsed.data.triggers ?? { deliveryModels: [], capabilityTiers: [], riskFactors: [] };

  const fn = await prisma.reviewFunctionDef.create({
    data: {
      key,
      label: parsed.data.label,
      triggerDeliveryModels: JSON.stringify(triggers.deliveryModels),
      triggerCapabilityTiers: JSON.stringify(triggers.capabilityTiers),
      triggerRiskFactors: JSON.stringify(triggers.riskFactors),
      sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
    },
  });

  await logAudit({
    entityType: "ReviewFunctionDef",
    entityId: fn.id,
    aiSystemId: null,
    action: "REVIEW_FUNCTION_CREATED",
    actorId: req.user!.userId,
    summary: `Added review function "${fn.label}".`,
  });

  res.status(201).json(fn);
});

const updateFunctionSchema = z.object({
  label: z.string().min(1).optional(),
  triggers: triggersSchema.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// :key is ReviewFunctionDef.key (same value stored on FunctionWorkPaper.functionKey).
adminReviewFunctionsRouter.patch("/review-functions/:key", async (req: AuthedRequest, res) => {
  const parsed = updateFunctionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.reviewFunctionDef.findUnique({ where: { key: req.params.key } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const fn = await prisma.reviewFunctionDef.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.label !== undefined && { label: parsed.data.label }),
      ...(parsed.data.triggers !== undefined && {
        triggerDeliveryModels: JSON.stringify(parsed.data.triggers.deliveryModels),
        triggerCapabilityTiers: JSON.stringify(parsed.data.triggers.capabilityTiers),
        triggerRiskFactors: JSON.stringify(parsed.data.triggers.riskFactors),
      }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
      ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
    },
  });

  await logAudit({
    entityType: "ReviewFunctionDef",
    entityId: fn.id,
    aiSystemId: null,
    action: "REVIEW_FUNCTION_UPDATED",
    actorId: req.user!.userId,
    summary: `Updated review function "${fn.label}"${
      parsed.data.isActive === false ? " (deactivated)" : parsed.data.isActive === true ? " (reactivated)" : ""
    }.`,
  });

  res.json(fn);
});

// --- Sections ------------------------------------------------------------

const createSectionSchema = z.object({
  title: z.string().min(1),
  triggerLabel: z.string().optional().default(""),
  triggers: triggersSchema,
});

// :key is the parent ReviewFunctionDef.key.
adminReviewFunctionsRouter.post("/review-functions/:key/sections", async (req: AuthedRequest, res) => {
  const parsed = createSectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const fn = await prisma.reviewFunctionDef.findUnique({ where: { key: req.params.key } });
  if (!fn) return res.status(404).json({ error: "Review function not found" });

  const key = await uniqueKey(slugifyKey("sec", parsed.data.title), async (k) => !!(await prisma.workPaperSectionDef.findUnique({ where: { key: k } })));
  const maxSortOrder = await prisma.workPaperSectionDef.aggregate({ _max: { sortOrder: true }, where: { functionId: fn.id } });

  const section = await prisma.workPaperSectionDef.create({
    data: {
      functionId: fn.id,
      key,
      title: parsed.data.title,
      triggerLabel: parsed.data.triggerLabel,
      triggerDeliveryModels: JSON.stringify(parsed.data.triggers.deliveryModels),
      triggerCapabilityTiers: JSON.stringify(parsed.data.triggers.capabilityTiers),
      triggerRiskFactors: JSON.stringify(parsed.data.triggers.riskFactors),
      sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
    },
  });

  await logAudit({
    entityType: "WorkPaperSectionDef",
    entityId: section.id,
    aiSystemId: null,
    action: "WORK_PAPER_SECTION_CREATED",
    actorId: req.user!.userId,
    summary: `Added section "${section.title}" to ${fn.label}.`,
  });

  res.status(201).json(section);
});

const updateSectionSchema = z.object({
  title: z.string().min(1).optional(),
  triggerLabel: z.string().optional(),
  triggers: triggersSchema.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// :key is WorkPaperSectionDef.key.
adminReviewFunctionsRouter.patch("/review-functions/sections/:key", async (req: AuthedRequest, res) => {
  const parsed = updateSectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.workPaperSectionDef.findUnique({ where: { key: req.params.key } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const section = await prisma.workPaperSectionDef.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.triggerLabel !== undefined && { triggerLabel: parsed.data.triggerLabel }),
      ...(parsed.data.triggers !== undefined && {
        triggerDeliveryModels: JSON.stringify(parsed.data.triggers.deliveryModels),
        triggerCapabilityTiers: JSON.stringify(parsed.data.triggers.capabilityTiers),
        triggerRiskFactors: JSON.stringify(parsed.data.triggers.riskFactors),
      }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
      ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
    },
  });

  await logAudit({
    entityType: "WorkPaperSectionDef",
    entityId: section.id,
    aiSystemId: null,
    action: "WORK_PAPER_SECTION_UPDATED",
    actorId: req.user!.userId,
    summary: `Updated section "${section.title}"${
      parsed.data.isActive === false ? " (deactivated)" : parsed.data.isActive === true ? " (reactivated)" : ""
    }.`,
  });

  res.json(section);
});

// --- Questions -----------------------------------------------------------

const createQuestionSchema = z.object({ text: z.string().min(1), citation: z.string().optional().default("") });

// :key is the parent WorkPaperSectionDef.key.
adminReviewFunctionsRouter.post("/review-functions/sections/:key/questions", async (req: AuthedRequest, res) => {
  const parsed = createQuestionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const section = await prisma.workPaperSectionDef.findUnique({ where: { key: req.params.key } });
  if (!section) return res.status(404).json({ error: "Section not found" });

  const key = await uniqueKey(slugifyKey("q", parsed.data.text), async (k) => !!(await prisma.workPaperQuestionDef.findUnique({ where: { key: k } })));
  const maxSortOrder = await prisma.workPaperQuestionDef.aggregate({ _max: { sortOrder: true }, where: { sectionId: section.id } });

  const question = await prisma.workPaperQuestionDef.create({
    data: {
      sectionId: section.id,
      key,
      text: parsed.data.text,
      citation: parsed.data.citation,
      sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
    },
  });

  await logAudit({
    entityType: "WorkPaperQuestionDef",
    entityId: question.id,
    aiSystemId: null,
    action: "WORK_PAPER_QUESTION_CREATED",
    actorId: req.user!.userId,
    summary: `Added a question to "${section.title}".`,
  });

  res.status(201).json(question);
});

const updateQuestionSchema = z.object({
  text: z.string().min(1).optional(),
  citation: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// No DELETE anywhere in this file — a function/section/question's key may
// already appear inside some work paper's answers/sectionData JSON.
// Deactivating removes it from new work papers while keeping history intact.
adminReviewFunctionsRouter.patch("/review-functions/questions/:key", async (req: AuthedRequest, res) => {
  const parsed = updateQuestionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.workPaperQuestionDef.findUnique({ where: { key: req.params.key } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const question = await prisma.workPaperQuestionDef.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.text !== undefined && { text: parsed.data.text }),
      ...(parsed.data.citation !== undefined && { citation: parsed.data.citation }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
      ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
    },
  });

  await logAudit({
    entityType: "WorkPaperQuestionDef",
    entityId: question.id,
    aiSystemId: null,
    action: "WORK_PAPER_QUESTION_UPDATED",
    actorId: req.user!.userId,
    summary: `Updated a work paper question${
      parsed.data.isActive === false ? " (deactivated)" : parsed.data.isActive === true ? " (reactivated)" : ""
    }.`,
  });

  res.json(question);
});
