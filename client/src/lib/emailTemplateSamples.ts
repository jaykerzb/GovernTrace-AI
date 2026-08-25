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

export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateKind, string> = {
  COMMENT_POSTED: "Comment Posted",
  APPROVAL_STEP_REJECTED: "Approval Step Rejected",
  APPROVAL_FULLY_APPROVED: "Fully Approved",
  APPROVAL_PENDING: "Approval Pending",
  ASSESSMENT_FINALIZED: "Risk Assessment Finalized",
  ASSESSMENT_ADDITIONAL_APPROVAL: "Additional Approval Required",
  COMMITTEE_DECISION: "Committee Decision",
  WORK_PAPER_COMPLETED: "Work Paper Completed",
};

export const EMAIL_TEMPLATE_DESCRIPTIONS: Record<EmailTemplateKind, string> = {
  COMMENT_POSTED: "Sent to a system's owner when someone else comments on it.",
  APPROVAL_STEP_REJECTED: "Sent to the owner and to Compliance/Admins when an approval step is rejected.",
  APPROVAL_FULLY_APPROVED: "Sent to the owner when the last approval step is approved.",
  APPROVAL_PENDING: "Sent to the role responsible for the next approval step.",
  ASSESSMENT_FINALIZED: "Sent to the owner when a risk assessment is finalized.",
  ASSESSMENT_ADDITIONAL_APPROVAL: "Sent to Compliance/Admins when a finalized assessment requires additional approval.",
  COMMITTEE_DECISION: "Sent to the owner when a committee review is finalized.",
  WORK_PAPER_COMPLETED: "Sent to the owner when a function work paper is marked complete.",
};

// Mirrors server/src/routes/emailTemplates.ts's SAMPLE_VARIABLES so the
// preview shown while editing matches what a "Send Test Email" produces.
// recipientName is available on every kind — it's filled in per-recipient by
// notifications.ts, not passed by the call site, so every template gets it
// here rather than only the kinds that originally listed it.
export const SAMPLE_VARIABLES: Record<EmailTemplateKind, Record<string, string>> = {
  COMMENT_POSTED: { recipientName: "Jake Burke", authorName: "Jane Doe", systemName: "Acme Fraud Detection Model" },
  APPROVAL_STEP_REJECTED: { recipientName: "Jake Burke", systemName: "Acme Fraud Detection Model" },
  APPROVAL_FULLY_APPROVED: { recipientName: "Jake Burke", systemName: "Acme Fraud Detection Model" },
  APPROVAL_PENDING: { recipientName: "Jake Burke", systemName: "Acme Fraud Detection Model" },
  ASSESSMENT_FINALIZED: {
    recipientName: "Jake Burke",
    systemName: "Acme Fraud Detection Model",
    approvalDescription: "standard approval required",
    score: "27",
  },
  ASSESSMENT_ADDITIONAL_APPROVAL: { recipientName: "Jake Burke", systemName: "Acme Fraud Detection Model", score: "34" },
  COMMITTEE_DECISION: { recipientName: "Jake Burke", systemName: "Acme Fraud Detection Model", disposition: "APPROVED" },
  WORK_PAPER_COMPLETED: {
    recipientName: "Jake Burke",
    functionLabel: "Privacy",
    systemName: "Acme Fraud Detection Model",
    riskRating: "Moderate",
  },
};

// Client-side preview render — same-origin, never sent anywhere, so no
// HTML-escaping is needed here (the server escapes on the real send path).
export function renderTemplatePreview(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = variables[key];
    return value === undefined ? match : value;
  });
}

// Mirrors server/src/services/emailLayout.ts's formatEmailBody so the
// preview's **bold**/line-break rendering matches the real email exactly.
export function formatEmailBodyPreview(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .split(/\n+/)
    .map((line) => `<p style="margin: 0 0 12px;">${line}</p>`)
    .join("");
}
