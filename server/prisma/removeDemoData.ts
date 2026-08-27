// Removes exactly the AI use cases seedDemoData.ts creates, along with
// everything that cascades from them (risk assessments, work papers,
// committee reviews, approval steps, audit log entries, documents) — the 5
// demo accounts and anything else in the database are left untouched.
// Matches by name, so it's safe to run even if seedDemoData.ts has been
// edited since — it just won't find (and won't touch) anything renamed.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_USE_CASE_NAMES = [
  "Loan Origination Copilot",
  "Fraud Detection Monitoring",
  "Customer Support Chatbot",
  "Internal Document Summarizer",
  "Contract Review Assistant",
  "Employee HR Chatbot",
  "Marketing Content Generator",
  "Code Review Assistant",
  "AML Transaction Scoring Agent",
  "Credit Risk Scoring Model",
  "Vendor Onboarding Bot",
  "Meeting Notes Summarizer",
  "Sanctions Screening Assistant",
  "Data Analytics Insight Agent",
  "Branch Chat Assistant",
];

async function main() {
  const systems = await prisma.aiSystem.findMany({
    where: { name: { in: DEMO_USE_CASE_NAMES } },
    select: { id: true, name: true },
  });

  if (systems.length === 0) {
    console.log("No demo AI use cases found — nothing to remove.");
    return;
  }

  const ids = systems.map((s) => s.id);

  // Deleted in dependency order — AiSystem's own relations don't cascade at
  // the DB level (see schema.prisma), so each child table needs clearing
  // before the parent AiSystem row itself.
  await prisma.approvalStep.deleteMany({ where: { aiSystemId: { in: ids } } });
  await prisma.committeeReview.deleteMany({ where: { aiSystemId: { in: ids } } });
  await prisma.functionWorkPaper.deleteMany({ where: { aiSystemId: { in: ids } } });
  await prisma.riskAssessment.deleteMany({ where: { aiSystemId: { in: ids } } });
  await prisma.document.deleteMany({ where: { aiSystemId: { in: ids } } });
  await prisma.comment.deleteMany({ where: { aiSystemId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { aiSystemId: { in: ids } } });
  await prisma.meeting.deleteMany({ where: { aiSystemId: { in: ids } } });
  await prisma.aiSystem.deleteMany({ where: { id: { in: ids } } });

  for (const s of systems) console.log(`Removed "${s.name}".`);
  console.log(`Demo data removed (${systems.length} use case${systems.length === 1 ? "" : "s"}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
