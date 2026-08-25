import fs from "fs/promises";
import { parseOffice, OfficeConverter } from "officeparser";

const MAX_CHARS = 200_000;

// Formats we can render as an inline HTML preview (via officeparser's
// document converter) rather than falling back to "download to view".
const HTML_PREVIEWABLE_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
]);

export function isHtmlPreviewable(mimeType: string): boolean {
  return HTML_PREVIEWABLE_MIME_TYPES.has(mimeType);
}

// Converts a .docx/.pptx/.xlsx file to HTML for inline preview. Returns null
// on failure — the caller falls back to "download to view".
export async function convertToPreviewHtml(filePath: string, mimeType: string): Promise<string | null> {
  if (!isHtmlPreviewable(mimeType)) return null;
  try {
    const { value } = await OfficeConverter.convert(filePath, "html");
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

// officeparser's HTML converter already returns a complete standalone
// document (its own <html>/<head>/<style>), not a bare fragment — serve it
// as-is. Only wrap it if it's ever given a bare fragment instead, so this
// stays safe either way.
export function wrapPreviewHtml(html: string): string {
  if (/^\s*(<!doctype|<html)/i.test(html)) return html;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1e293b; max-width: 800px; margin: 2rem auto; padding: 0 1.5rem; line-height: 1.6; }
  img { max-width: 100%; }
  table { border-collapse: collapse; }
  td, th { border: 1px solid #cbd5e1; padding: 4px 8px; }
</style>
</head>
<body>${html}</body>
</html>`;
}

const PLAIN_TEXT_MIME_TYPES = new Set(["text/plain", "text/csv"]);

// Types officeparser can meaningfully extract from. Legacy binary Office
// formats (.doc/.xls/.ppt) and images are excluded — best-effort extraction
// on those would either throw or come back empty, so we skip trying.
const PARSEABLE_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

// Best-effort text extraction for search indexing. Never throws — a failed
// or unsupported extraction just means the document isn't searchable by
// content (its filename still is), which shouldn't block the upload itself.
export async function extractText(filePath: string, mimeType: string): Promise<string | null> {
  try {
    if (PLAIN_TEXT_MIME_TYPES.has(mimeType)) {
      const text = await fs.readFile(filePath, "utf8");
      return text.slice(0, MAX_CHARS);
    }

    if (PARSEABLE_MIME_TYPES.has(mimeType)) {
      const ast = await parseOffice(filePath);
      const text = ast.toText();
      return text ? text.slice(0, MAX_CHARS) : null;
    }

    return null;
  } catch {
    return null;
  }
}
