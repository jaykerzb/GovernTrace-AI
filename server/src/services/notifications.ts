import type { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { sendEmail } from "./emailService.js";
import { getEmailTemplate, type EmailTemplateKind } from "./emailTemplates.js";
import { renderTemplate } from "./emailRender.js";
import { buildEmailHtml, formatEmailBody } from "./emailLayout.js";

export interface EmailTemplateContext {
  kind: EmailTemplateKind;
  variables: Record<string, string>;
}

// Renders the admin-customized template for `kind` (falling back to the
// plain in-app `message` as the subject, with no CTA button, if no template
// row exists yet — e.g. mid-migration) so email content can diverge from the
// terser in-app text. `recipientName` is merged in per-recipient (not part
// of the shared EmailTemplateContext) so a template can address each
// recipient by their own name even when the same notification fans out to
// several people.
async function renderEmail(
  message: string,
  link: string | undefined,
  recipientName: string,
  email?: EmailTemplateContext
) {
  if (!email) return { subject: message, html: await buildEmailHtml({ bodyHtml: formatEmailBody(message), link }) };
  const template = await getEmailTemplate(email.kind);
  if (!template) return { subject: message, html: await buildEmailHtml({ bodyHtml: formatEmailBody(message), link }) };
  const variables = { ...email.variables, recipientName };
  const subject = renderTemplate(template.subject, variables);
  const body = renderTemplate(template.body, variables);
  const html = await buildEmailHtml({ bodyHtml: formatEmailBody(body), ctaLabel: template.ctaLabel, link });
  return { subject, html };
}

async function emailUsers(
  users: { name: string; email: string; emailNotificationsEnabled: boolean }[],
  message: string,
  link?: string,
  email?: EmailTemplateContext
) {
  await Promise.all(
    users
      .filter((u) => u.emailNotificationsEnabled)
      .map(async (u) => {
        const { subject, html } = await renderEmail(message, link, u.name, email);
        const result = await sendEmail(u.email, subject, html);
        // sendEmail never throws (by design — a delivery failure must never
        // break the governance action that triggered it), so a failure would
        // otherwise vanish silently. Logging it is the only way an admin can
        // ever find out a notification didn't actually arrive.
        if (!result.ok) {
          console.error(`Failed to email ${u.email} ("${subject}"): ${result.error}`);
        }
      })
  );
}

export async function notifyUser(userId: string, message: string, link?: string, email?: EmailTemplateContext) {
  await prisma.notification.create({ data: { userId, message, link } });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, emailNotificationsEnabled: true },
  });
  if (user) await emailUsers([user], message, link, email);
}

export async function notifyRoles(roles: Role[], message: string, link?: string, email?: EmailTemplateContext) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles }, isActive: true },
    select: { id: true, name: true, email: true, emailNotificationsEnabled: true },
  });
  if (users.length === 0) return;
  await prisma.notification.createMany({
    data: users.map((u) => ({ userId: u.id, message, link })),
  });
  await emailUsers(users, message, link, email);
}
