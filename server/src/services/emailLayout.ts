import { getOrgSettings } from "./orgSettings.js";

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

// Rendered template text is already HTML-escaped at the variable-interpolation
// step (see emailRender.ts) — this only applies the light markdown-lite an
// admin can use when authoring a template: **bold** and line breaks.
export function formatEmailBody(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .split(/\n+/)
    .map((line) => `<p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6;">${line}</p>`)
    .join("");
}

export interface EmailLayoutInput {
  bodyHtml: string;
  ctaLabel?: string;
  link?: string;
}

// The single shared visual shell every outgoing email renders through —
// branded header ("{org name} | GovernTrace AI" on the org's primary color),
// the rendered template body, an optional styled CTA button, and a footer.
// Used by both the real notification send path (notifications.ts) and the
// admin's "Send Test Email" path, so a test send looks exactly like a real
// one. No logo image — an org-configured logo URL is a separate piece of
// work to revisit later (a relative/local dev asset can't be hotlinked into
// a real email, since mail clients can't reach localhost).
export async function buildEmailHtml({ bodyHtml, ctaLabel, link }: EmailLayoutInput): Promise<string> {
  const org = await getOrgSettings();
  const primaryColor = org.primaryColor || "#0f172a";
  const absoluteLink = link ? `${CLIENT_ORIGIN}${link}` : CLIENT_ORIGIN;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: ${primaryColor}; padding: 20px 28px;">
        <span style="color: #ffffff; font-size: 16px; font-weight: 600;">${org.orgName} | GovernTrace AI</span>
      </div>
      <div style="padding: 28px; color: #1e293b;">
        ${bodyHtml}
        ${
          ctaLabel
            ? `<div style="margin-top: 20px;">
                 <a href="${absoluteLink}" style="display: inline-block; background: ${primaryColor}; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 10px 20px; border-radius: 6px;">${ctaLabel} &rarr;</a>
               </div>`
            : ""
        }
      </div>
      <div style="padding: 16px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">This is an automated notification from GovernTrace AI, ${org.orgName}'s AI Governance platform.</p>
      </div>
    </div>
  `;
}
