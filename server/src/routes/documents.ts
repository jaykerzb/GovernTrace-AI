import fs from "fs";
import path from "path";
import { Router, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";
import { upload, systemUploadDir } from "../lib/uploads.js";
import { logAudit } from "../services/auditLog.js";
import { extractText, convertToPreviewHtml, wrapPreviewHtml } from "../services/textExtraction.js";
import { hasPermission } from "../services/permissions.js";

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

async function canManageSystemDocuments(req: AuthedRequest, res: Response, next: NextFunction) {
  const system = await prisma.aiSystem.findUnique({ where: { id: req.params.systemId } });
  if (!system) return res.status(404).json({ error: "System not found" });

  const role = req.user!.role;
  const isOwner = system.ownerId === req.user!.userId;
  const allowed = (await hasPermission(role, "MANAGE_DOCUMENTS")) && (role !== "SYSTEM_OWNER" || isOwner);
  if (!allowed) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  next();
}

function uploadSingle(req: AuthedRequest, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      return res.status(400).json({ error: message });
    }
    next();
  });
}

documentsRouter.get("/systems/:systemId/documents", async (req, res) => {
  const documents = await prisma.document.findMany({
    where: { aiSystemId: req.params.systemId },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(documents);
});

const uploadMetaSchema = z.object({
  category: z.enum(["SOC_REPORT", "WHITEPAPER", "POLICY", "CONTRACT", "OTHER"]),
  description: z.string().optional(),
});

documentsRouter.post(
  "/systems/:systemId/documents",
  canManageSystemDocuments,
  uploadSingle,
  async (req: AuthedRequest, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "A file is required" });

    const parsed = uploadMetaSchema.safeParse(req.body);
    if (!parsed.success) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const extractedText = await extractText(file.path, file.mimetype);

    const document = await prisma.document.create({
      data: {
        aiSystemId: req.params.systemId,
        category: parsed.data.category,
        description: parsed.data.description || null,
        originalName: file.originalname,
        storedFileName: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedById: req.user!.userId,
        extractedText,
      },
    });

    await logAudit({
      entityType: "Document",
      entityId: document.id,
      aiSystemId: req.params.systemId,
      action: "DOCUMENT_UPLOADED",
      actorId: req.user!.userId,
      summary: `Uploaded document "${file.originalname}" (${parsed.data.category.replace("_", " ")}).`,
    });

    res.status(201).json(document);
  }
);

documentsRouter.get("/documents/:id/download", async (req, res) => {
  const document = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!document) return res.status(404).json({ error: "Not found" });

  const filePath = path.join(systemUploadDir(document.aiSystemId), document.storedFileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing on disk" });

  res.download(filePath, document.originalName);
});

// Same file, but rendered in-browser (Content-Disposition: inline) instead of
// forcing a download — used for the "View" action so PDFs/images can be
// previewed in a new tab. Types the browser can't render natively (Word,
// Excel, etc.) just fall back to a download, same as the browser would do
// with any inline link to a non-renderable type.
documentsRouter.get("/documents/:id/view", async (req, res) => {
  const document = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!document) return res.status(404).json({ error: "Not found" });

  const filePath = path.join(systemUploadDir(document.aiSystemId), document.storedFileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing on disk" });

  res.setHeader("Content-Type", document.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(document.originalName)}"`);
  res.sendFile(filePath);
});

// Converts a .docx to an HTML preview on the fly (no caching — this app's
// scale/volume doesn't warrant persisting a rendered copy) so it can render
// inline in the preview modal instead of falling back to "download to view".
documentsRouter.get("/documents/:id/preview-html", async (req, res) => {
  const document = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!document) return res.status(404).json({ error: "Not found" });

  const filePath = path.join(systemUploadDir(document.aiSystemId), document.storedFileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing on disk" });

  const html = await convertToPreviewHtml(filePath, document.mimeType);
  if (!html) return res.status(415).json({ error: "No HTML preview available for this file type." });

  res.setHeader("Content-Type", "text/html");
  res.send(wrapPreviewHtml(html));
});

documentsRouter.delete("/documents/:id", async (req: AuthedRequest, res) => {
  const document = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { aiSystem: true },
  });
  if (!document) return res.status(404).json({ error: "Not found" });

  const role = req.user!.role;
  const isOwner = document.aiSystem.ownerId === req.user!.userId;
  const allowed = (await hasPermission(role, "MANAGE_DOCUMENTS")) && (role !== "SYSTEM_OWNER" || isOwner);
  if (!allowed) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  await prisma.document.delete({ where: { id: document.id } });
  const filePath = path.join(systemUploadDir(document.aiSystemId), document.storedFileName);
  fs.unlink(filePath, () => {});

  await logAudit({
    entityType: "Document",
    entityId: document.id,
    aiSystemId: document.aiSystemId,
    action: "DOCUMENT_DELETED",
    actorId: req.user!.userId,
    summary: `Deleted document "${document.originalName}".`,
  });

  res.status(204).end();
});
