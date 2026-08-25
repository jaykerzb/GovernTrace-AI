import { prisma } from "../lib/prisma.js";

export const EMAIL_TEMPLATE_KINDS = [
  "COMMENT_POSTED",
  "APPROVAL_STEP_REJECTED",
  "APPROVAL_FULLY_APPROVED",
  "APPROVAL_PENDING",
  "ASSESSMENT_FINALIZED",
  "ASSESSMENT_ADDITIONAL_APPROVAL",
  "COMMITTEE_DECISION",
  "WORK_PAPER_COMPLETED",
] as const;

export type EmailTemplateKind = (typeof EMAIL_TEMPLATE_KINDS)[number];

// Defaults mirror the exact wording each kind's call site used before this
// feature existed (see server/src/services/notifications.ts callers) —
// subject is a short summary, body is the original in-app message text.
const DEFAULTS: { kind: EmailTemplateKind; subject: string; body: string; ctaLabel: string }[] = [
  {
    kind: "COMMENT_POSTED",
    subject: "New comment on {{systemName}}",
    body: "Heads up, {{recipientName}} — **{{authorName}}** commented on \"{{systemName}}\".",
    ctaLabel: "View Comment",
  },
  {
    kind: "APPROVAL_STEP_REJECTED",
    subject: "Approval step rejected for {{systemName}}",
    body: "An approval step for **\"{{systemName}}\"** was rejected.",
    ctaLabel: "View System",
  },
  {
    kind: "APPROVAL_FULLY_APPROVED",
    subject: "{{systemName}} has been fully approved",
    body: "**\"{{systemName}}\"** has been fully approved.",
    ctaLabel: "View System",
  },
  {
    kind: "APPROVAL_PENDING",
    subject: "Your approval is needed for {{systemName}}",
    body: "**\"{{systemName}}\"** is awaiting your approval.",
    ctaLabel: "Review Approval",
  },
  {
    kind: "ASSESSMENT_FINALIZED",
    subject: "Risk assessment finalized for {{systemName}}",
    body: "Risk assessment finalized for **\"{{systemName}}\"**: {{approvalDescription}} (score {{score}}).",
    ctaLabel: "View Assessment",
  },
  {
    kind: "ASSESSMENT_ADDITIONAL_APPROVAL",
    subject: "{{systemName}} requires additional approval",
    body: "**\"{{systemName}}\"** requires additional approval (score {{score}}).",
    ctaLabel: "Review System",
  },
  {
    kind: "COMMITTEE_DECISION",
    subject: "Committee decision for {{systemName}}",
    body: "Committee decision for **\"{{systemName}}\"**: {{disposition}}.",
    ctaLabel: "View System",
  },
  {
    kind: "WORK_PAPER_COMPLETED",
    subject: "{{functionLabel}} work paper completed for {{systemName}}",
    body: "{{functionLabel}} work paper completed for **\"{{systemName}}\"** ({{riskRating}} risk).",
    ctaLabel: "View System",
  },
];

let seedPromise: Promise<void> | null = null;

function seedDefaultsIfEmpty(): Promise<void> {
  if (!seedPromise) seedPromise = doSeedDefaultsIfEmpty();
  return seedPromise;
}

async function doSeedDefaultsIfEmpty() {
  const count = await prisma.emailTemplate.count();
  if (count > 0) return;
  await prisma.emailTemplate.createMany({ data: DEFAULTS });
}

export async function getEmailTemplates() {
  await seedDefaultsIfEmpty();
  return prisma.emailTemplate.findMany({ orderBy: { kind: "asc" } });
}

export async function getEmailTemplate(kind: string) {
  await seedDefaultsIfEmpty();
  return prisma.emailTemplate.findUnique({ where: { kind } });
}

export async function updateEmailTemplate(kind: string, data: { subject: string; body: string; ctaLabel: string }) {
  await seedDefaultsIfEmpty();
  return prisma.emailTemplate.update({ where: { kind }, data });
}
