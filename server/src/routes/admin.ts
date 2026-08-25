import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/requireAuth.js";
import { logAudit } from "../services/auditLog.js";
import { wouldRemoveLastActiveAdmin } from "../services/adminGuards.js";
import { getAiTypeOptions } from "../services/aiTypeOptions.js";
import { getAllRiskQuestions, toWireQuestion } from "../services/riskQuestions.js";
import { getCustomFieldDefs } from "../services/customFields.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

const ROLES = ["ADMIN", "COMPLIANCE_OFFICER", "SYSTEM_OWNER", "APPROVER", "VIEWER"] as const;

// --- Users -----------------------------------------------------------------

adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { name: "asc" },
  });
  res.json(users);
});

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(ROLES),
  password: z.string().min(8),
});

adminRouter.post("/users", async (req: AuthedRequest, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return res.status(400).json({ error: "That email is already in use" });

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: { name: parsed.data.name, email: parsed.data.email, role: parsed.data.role, passwordHash },
  });

  await logAudit({
    entityType: "User",
    entityId: user.id,
    aiSystemId: null,
    action: "USER_CREATED",
    actorId: req.user!.userId,
    summary: `Created user "${user.name}" (${user.role.replace("_", " ")}).`,
  });

  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive });
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
});

adminRouter.patch("/users/:id", async (req: AuthedRequest, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const demotingFromAdmin = parsed.data.role !== undefined && parsed.data.role !== "ADMIN";
  const deactivating = parsed.data.isActive === false;
  if ((demotingFromAdmin || deactivating) && (await wouldRemoveLastActiveAdmin(existing.id))) {
    return res.status(400).json({
      error: "This is the last active Admin. Promote another user to Admin first.",
    });
  }

  if (parsed.data.email) {
    const existingWithEmail = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existingWithEmail && existingWithEmail.id !== existing.id) {
      return res.status(400).json({ error: "That email is already in use" });
    }
  }

  const user = await prisma.user.update({ where: { id: existing.id }, data: parsed.data });

  await logAudit({
    entityType: "User",
    entityId: user.id,
    aiSystemId: null,
    action: "USER_UPDATED",
    actorId: req.user!.userId,
    summary: `Updated user "${user.name}"${deactivating ? " (deactivated)" : ""}${
      parsed.data.isActive === true ? " (reactivated)" : ""
    }.`,
  });

  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive });
});

const resetPasswordSchema = z.object({ newPassword: z.string().min(8) });

adminRouter.post("/users/:id/reset-password", async (req: AuthedRequest, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } });

  await logAudit({
    entityType: "User",
    entityId: existing.id,
    aiSystemId: null,
    action: "USER_PASSWORD_RESET",
    actorId: req.user!.userId,
    summary: `Reset the password for "${existing.name}".`,
  });

  res.status(204).end();
});

// --- AI Type options ---------------------------------------------------------

function slugifyKey(label: string): string {
  const base = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || "OPTION";
}

adminRouter.get("/ai-type-options", async (_req, res) => {
  res.json(await getAiTypeOptions());
});

const createAiTypeOptionSchema = z.object({ label: z.string().min(1), definition: z.string().optional() });

adminRouter.post("/ai-type-options", async (req: AuthedRequest, res) => {
  const parsed = createAiTypeOptionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  await getAiTypeOptions(); // ensure defaults are seeded before computing sortOrder/key uniqueness

  let key = slugifyKey(parsed.data.label);
  let suffix = 2;
  while (await prisma.aiTypeOption.findUnique({ where: { key } })) {
    key = `${slugifyKey(parsed.data.label)}_${suffix}`;
    suffix += 1;
  }

  const maxSortOrder = await prisma.aiTypeOption.aggregate({ _max: { sortOrder: true } });
  const option = await prisma.aiTypeOption.create({
    data: {
      key,
      label: parsed.data.label,
      definition: parsed.data.definition || null,
      sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
    },
  });

  await logAudit({
    entityType: "AiTypeOption",
    entityId: option.id,
    aiSystemId: null,
    action: "AI_TYPE_OPTION_CREATED",
    actorId: req.user!.userId,
    summary: `Added AI type "${option.label}".`,
  });

  res.status(201).json(option);
});

const updateAiTypeOptionSchema = z.object({
  label: z.string().min(1).optional(),
  definition: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

adminRouter.patch("/ai-type-options/:id", async (req: AuthedRequest, res) => {
  const parsed = updateAiTypeOptionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.aiTypeOption.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const option = await prisma.aiTypeOption.update({ where: { id: existing.id }, data: parsed.data });

  await logAudit({
    entityType: "AiTypeOption",
    entityId: option.id,
    aiSystemId: null,
    action: "AI_TYPE_OPTION_UPDATED",
    actorId: req.user!.userId,
    summary: `Updated AI type "${option.label}"${
      parsed.data.isActive === false ? " (deactivated)" : parsed.data.isActive === true ? " (reactivated)" : ""
    }.`,
  });

  res.json(option);
});

adminRouter.delete("/ai-type-options/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.aiTypeOption.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const inUseCount = await prisma.aiSystem.count({ where: { aiType: existing.key } });
  if (inUseCount > 0) {
    return res.status(409).json({
      error: `${inUseCount} AI use case(s) still use "${existing.label}". Deactivate it instead of deleting.`,
    });
  }

  await prisma.aiTypeOption.delete({ where: { id: existing.id } });

  await logAudit({
    entityType: "AiTypeOption",
    entityId: existing.id,
    aiSystemId: null,
    action: "AI_TYPE_OPTION_DELETED",
    actorId: req.user!.userId,
    summary: `Deleted unused AI type "${existing.label}".`,
  });

  res.status(204).end();
});

// --- Risk questionnaire (Dimension 1 trigger + Dimension 2 scored questions) --

function slugifyQuestionKey(dimension: number, text: string): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `d${dimension}_${base || "question"}`;
}

adminRouter.get("/risk-questions", async (_req, res) => {
  res.json(await getAllRiskQuestions());
});

const optionSchema = z.object({ label: z.string().min(1), points: z.number().int().min(0) });

const createRiskQuestionSchema = z.object({
  dimension: z.union([z.literal(1), z.literal(2)]),
  text: z.string().min(1),
  helpText: z.string().optional().default(""),
  options: z.array(optionSchema).min(2),
});

adminRouter.post("/risk-questions", async (req: AuthedRequest, res) => {
  const parsed = createRiskQuestionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  await getAllRiskQuestions(); // ensure defaults are seeded before computing key uniqueness/order

  let key = slugifyQuestionKey(parsed.data.dimension, parsed.data.text);
  let suffix = 2;
  while (await prisma.riskQuestion.findUnique({ where: { key } })) {
    key = `${slugifyQuestionKey(parsed.data.dimension, parsed.data.text)}_${suffix}`;
    suffix += 1;
  }

  const maxOrder = await prisma.riskQuestion.aggregate({
    _max: { order: true },
    where: { dimension: parsed.data.dimension },
  });

  const question = await prisma.riskQuestion.create({
    data: {
      key,
      dimension: parsed.data.dimension,
      order: (maxOrder._max.order ?? 0) + 1,
      text: parsed.data.text,
      helpText: parsed.data.helpText,
      options: JSON.stringify(parsed.data.options),
    },
  });

  await logAudit({
    entityType: "RiskQuestion",
    entityId: question.id,
    aiSystemId: null,
    action: "RISK_QUESTION_CREATED",
    actorId: req.user!.userId,
    summary: `Added Dimension ${question.dimension} question "${question.text}".`,
  });

  res.status(201).json(toWireQuestion(question));
});

const updateRiskQuestionSchema = z.object({
  text: z.string().min(1).optional(),
  helpText: z.string().optional(),
  options: z.array(optionSchema).min(2).optional(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// No DELETE — a question's key may already appear inside some assessment's
// answers JSON. Deactivating removes it from new assessments while keeping
// history attributable.
// :id here is actually the question's `key` — the wire Question shape uses
// `key` as its `id` (it's what answers are keyed by in a RiskAssessment's
// answers JSON), so the admin UI has no other identifier to send.
adminRouter.patch("/risk-questions/:id", async (req: AuthedRequest, res) => {
  const parsed = updateRiskQuestionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.riskQuestion.findUnique({ where: { key: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const question = await prisma.riskQuestion.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.text !== undefined && { text: parsed.data.text }),
      ...(parsed.data.helpText !== undefined && { helpText: parsed.data.helpText }),
      ...(parsed.data.options !== undefined && { options: JSON.stringify(parsed.data.options) }),
      ...(parsed.data.order !== undefined && { order: parsed.data.order }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
    },
  });

  await logAudit({
    entityType: "RiskQuestion",
    entityId: question.id,
    aiSystemId: null,
    action: "RISK_QUESTION_UPDATED",
    actorId: req.user!.userId,
    summary: `Updated Dimension ${question.dimension} question "${question.text}"${
      parsed.data.isActive === false ? " (deactivated)" : parsed.data.isActive === true ? " (reactivated)" : ""
    }.`,
  });

  res.json(toWireQuestion(question));
});

// --- Custom intake fields ----------------------------------------------------

const FIELD_TYPES = ["TEXT", "TEXTAREA", "NUMBER", "DATE", "SELECT"] as const;

adminRouter.get("/custom-fields", async (_req, res) => {
  res.json(await getCustomFieldDefs());
});

const createCustomFieldSchema = z.object({
  label: z.string().min(1),
  fieldType: z.enum(FIELD_TYPES),
  options: z.array(z.string().min(1)).optional(),
  required: z.boolean().optional().default(false),
});

adminRouter.post("/custom-fields", async (req: AuthedRequest, res) => {
  const parsed = createCustomFieldSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.fieldType === "SELECT" && (!parsed.data.options || parsed.data.options.length < 2)) {
    return res.status(400).json({ error: "A select field needs at least 2 options." });
  }

  let key = slugifyKey(parsed.data.label);
  let suffix = 2;
  while (await prisma.customFieldDef.findUnique({ where: { key } })) {
    key = `${slugifyKey(parsed.data.label)}_${suffix}`;
    suffix += 1;
  }

  const maxSortOrder = await prisma.customFieldDef.aggregate({ _max: { sortOrder: true } });
  const field = await prisma.customFieldDef.create({
    data: {
      key,
      label: parsed.data.label,
      fieldType: parsed.data.fieldType,
      options: parsed.data.fieldType === "SELECT" ? JSON.stringify(parsed.data.options) : null,
      required: parsed.data.required,
      sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
    },
  });

  await logAudit({
    entityType: "CustomFieldDef",
    entityId: field.id,
    aiSystemId: null,
    action: "CUSTOM_FIELD_CREATED",
    actorId: req.user!.userId,
    summary: `Added custom intake field "${field.label}".`,
  });

  res.status(201).json(field);
});

const updateCustomFieldSchema = z.object({
  label: z.string().min(1).optional(),
  options: z.array(z.string().min(1)).optional(),
  required: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

adminRouter.patch("/custom-fields/:id", async (req: AuthedRequest, res) => {
  const parsed = updateCustomFieldSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.customFieldDef.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.fieldType === "SELECT" && parsed.data.options && parsed.data.options.length < 2) {
    return res.status(400).json({ error: "A select field needs at least 2 options." });
  }

  const field = await prisma.customFieldDef.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.label !== undefined && { label: parsed.data.label }),
      ...(parsed.data.options !== undefined && { options: JSON.stringify(parsed.data.options) }),
      ...(parsed.data.required !== undefined && { required: parsed.data.required }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
      ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
    },
  });

  await logAudit({
    entityType: "CustomFieldDef",
    entityId: field.id,
    aiSystemId: null,
    action: "CUSTOM_FIELD_UPDATED",
    actorId: req.user!.userId,
    summary: `Updated custom intake field "${field.label}"${
      parsed.data.isActive === false ? " (deactivated)" : parsed.data.isActive === true ? " (reactivated)" : ""
    }.`,
  });

  res.json(field);
});

adminRouter.delete("/custom-fields/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.customFieldDef.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const systems = await prisma.aiSystem.findMany({ select: { customFieldValues: true } });
  const inUseCount = systems.filter((s) => {
    try {
      const values = JSON.parse(s.customFieldValues) as Record<string, unknown>;
      return values[existing.key] !== undefined && values[existing.key] !== "" && values[existing.key] !== null;
    } catch {
      return false;
    }
  }).length;

  // A field with historical values can't be hard-deleted — its key is still
  // sitting inside those systems' customFieldValues JSON, and the label
  // shown there comes from this row. Deactivating instead removes it from
  // new intakes while keeping past use cases showing their real value.
  if (inUseCount > 0) {
    const field = await prisma.customFieldDef.update({ where: { id: existing.id }, data: { isActive: false } });
    await logAudit({
      entityType: "CustomFieldDef",
      entityId: field.id,
      aiSystemId: null,
      action: "CUSTOM_FIELD_DEACTIVATED",
      actorId: req.user!.userId,
      summary: `Deactivated custom intake field "${field.label}" instead of deleting it — ${inUseCount} AI use case(s) still have a value for it.`,
    });
    return res.json(field);
  }

  await prisma.customFieldDef.delete({ where: { id: existing.id } });

  await logAudit({
    entityType: "CustomFieldDef",
    entityId: existing.id,
    aiSystemId: null,
    action: "CUSTOM_FIELD_DELETED",
    actorId: req.user!.userId,
    summary: `Deleted unused custom intake field "${existing.label}".`,
  });

  res.status(204).end();
});

// --- System-level activity log ----------------------------------------------

adminRouter.get("/activity", async (_req, res) => {
  const logs = await prisma.auditLog.findMany({
    where: { aiSystemId: null },
    include: { actor: { select: { name: true, role: true } } },
    orderBy: { timestamp: "desc" },
    take: 100,
  });
  res.json(logs);
});
