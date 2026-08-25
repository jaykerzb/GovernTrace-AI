import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const documentSearchRouter = Router();
documentSearchRouter.use(requireAuth);

const SNIPPET_RADIUS = 80;

function buildSnippet(text: string | null, q: string): string | null {
  if (!text) return null;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(text.length, idx + q.length + SNIPPET_RADIUS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

documentSearchRouter.get("/documents/search", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim() ?? "";
  if (q.length < 2) return res.json([]);

  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { originalName: { contains: q } },
        { description: { contains: q } },
        { extractedText: { contains: q } },
      ],
    },
    include: { aiSystem: { select: { id: true, name: true } } },
    take: 8,
  });

  res.json(
    documents.map((d) => ({
      id: d.id,
      originalName: d.originalName,
      category: d.category,
      aiSystemId: d.aiSystem.id,
      aiSystemName: d.aiSystem.name,
      snippet: buildSnippet(d.extractedText, q),
    }))
  );
});
