import fs from "fs";
import path from "path";
import { Router, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, requirePermission, type AuthedRequest } from "../middleware/requireAuth.js";
import { policyUpload, policyUploadDir } from "../lib/uploads.js";
import { logAudit } from "../services/auditLog.js";
import { extractText, convertToPreviewHtml, wrapPreviewHtml } from "../services/textExtraction.js";

export const policiesRouter = Router();
policiesRouter.use(requireAuth);

const CATEGORIES = ["POLICY", "STANDARD", "PROCEDURE", "GUIDELINE", "OTHER"] as const;

function uploadSingle(req: AuthedRequest, res: Response, next: NextFunction) {
  policyUpload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      return res.status(400).json({ error: message });
    }
    next();
  });
}

policiesRouter.get("/policies", async (req, res) => {
  const { category, q } = req.query as Record<string, string | undefined>;
  const policies = await prisma.policy.findMany({
    where: {
      category: category ? (category as any) : undefined,
      OR: q
        ? [{ title: { contains: q } }, { description: { contains: q } }]
        : undefined,
    },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });
  res.json(policies);
});

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(CATEGORIES),
});

policiesRouter.post(
  "/policies",
  requirePermission("MANAGE_POLICIES"),
  uploadSingle,
  async (req: AuthedRequest, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "A file is required" });

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const extractedText = await extractText(file.path, file.mimetype);

    const policy = await prisma.policy.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description || null,
        category: parsed.data.category,
        originalName: file.originalname,
        storedFileName: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedById: req.user!.userId,
        extractedText,
      },
      include: { uploadedBy: { select: { name: true } } },
    });

    await logAudit({
      entityType: "Policy",
      entityId: policy.id,
      aiSystemId: null,
      action: "POLICY_UPLOADED",
      actorId: req.user!.userId,
      summary: `Uploaded policy "${policy.title}" (${policy.category}).`,
    });

    res.status(201).json(policy);
  }
);

policiesRouter.get("/policies/:id/download", async (req, res) => {
  const policy = await prisma.policy.findUnique({ where: { id: req.params.id } });
  if (!policy) return res.status(404).json({ error: "Not found" });

  const filePath = path.join(policyUploadDir(), policy.storedFileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing on disk" });

  res.download(filePath, policy.originalName);
});

policiesRouter.get("/policies/:id/view", async (req, res) => {
  const policy = await prisma.policy.findUnique({ where: { id: req.params.id } });
  if (!policy) return res.status(404).json({ error: "Not found" });

  const filePath = path.join(policyUploadDir(), policy.storedFileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing on disk" });

  res.setHeader("Content-Type", policy.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(policy.originalName)}"`);
  res.sendFile(filePath);
});

// Converts a .docx to an HTML preview on the fly, mirroring documents.ts's
// equivalent route.
policiesRouter.get("/policies/:id/preview-html", async (req, res) => {
  const policy = await prisma.policy.findUnique({ where: { id: req.params.id } });
  if (!policy) return res.status(404).json({ error: "Not found" });

  const filePath = path.join(policyUploadDir(), policy.storedFileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing on disk" });

  const html = await convertToPreviewHtml(filePath, policy.mimeType);
  if (!html) return res.status(415).json({ error: "No HTML preview available for this file type." });

  res.setHeader("Content-Type", "text/html");
  res.send(wrapPreviewHtml(html));
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category: z.enum(CATEGORIES).optional(),
  isActive: z.boolean().optional(),
});

policiesRouter.patch("/policies/:id", requirePermission("MANAGE_POLICIES"), async (req: AuthedRequest, res) => {
  const existing = await prisma.policy.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const policy = await prisma.policy.update({
    where: { id: existing.id },
    data: parsed.data,
    include: { uploadedBy: { select: { name: true } } },
  });

  await logAudit({
    entityType: "Policy",
    entityId: policy.id,
    aiSystemId: null,
    action: "POLICY_UPDATED",
    actorId: req.user!.userId,
    summary: `Updated policy "${policy.title}"${
      parsed.data.isActive === false ? " (deactivated)" : parsed.data.isActive === true ? " (reactivated)" : ""
    }.`,
  });

  res.json(policy);
});

policiesRouter.delete("/policies/:id", requireRole("ADMIN"), async (req: AuthedRequest, res) => {
  const existing = await prisma.policy.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  await prisma.policy.delete({ where: { id: existing.id } });
  const filePath = path.join(policyUploadDir(), existing.storedFileName);
  fs.unlink(filePath, () => {});

  await logAudit({
    entityType: "Policy",
    entityId: existing.id,
    aiSystemId: null,
    action: "POLICY_DELETED",
    actorId: req.user!.userId,
    summary: `Deleted policy "${existing.title}".`,
  });

  res.status(204).end();
});
