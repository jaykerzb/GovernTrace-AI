// Optional, separate from seed.ts on purpose: a fresh deploy should start
// with just the 5 demo accounts and an empty registry, so anyone standing
// this up for real doesn't have to clean out fictional use cases first. Run
// this afterward (`npm run prisma:seed:samples`) only if you want a fuller
// demo — a few AI use cases spread across statuses and risk levels so the
// dashboard, registry, and analytics pages have something to show.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SAMPLE_SYSTEMS = [
  {
    name: "Meeting Notes Summarizer",
    description: "Vendor tool that transcribes and summarizes internal meetings, surfacing action items.",
    businessUnit: "Operations",
    aiType: "VENDOR",
    status: "UNDER_REVIEW" as const,
    vendorName: "Notely Inc.",
  },
  {
    name: "Vendor Onboarding Assistant",
    description: "Embedded chatbot in the procurement platform that answers vendor setup questions.",
    businessUnit: "Procurement",
    aiType: "EMBEDDED",
    status: "RISK_ASSESSMENT" as const,
  },
  {
    name: "Support Ticket Triage Agent",
    description: "Autonomous agent that reads incoming support tickets and routes them to the right queue.",
    businessUnit: "Customer Support",
    aiType: "AGENT",
    status: "DRAFT" as const,
  },
  {
    name: "Internal Document Search",
    description: "In-house semantic search over internal policy and procedure documents.",
    businessUnit: "Information Technology",
    aiType: "IN_HOUSE",
    status: "APPROVED" as const,
  },
  {
    name: "Marketing Copy Generator",
    description: "Vendor tool used by the marketing team to draft first-pass campaign copy.",
    businessUnit: "Marketing",
    aiType: "VENDOR",
    status: "DEPLOYED" as const,
    vendorName: "Copyworks AI",
  },
  {
    name: "Code Review Assistant",
    description: "Embedded code-review suggestions inside the team's existing pull request workflow.",
    businessUnit: "Engineering",
    aiType: "EMBEDDED",
    status: "MONITORING" as const,
  },
];

async function main() {
  const owner = await prisma.user.findUnique({ where: { email: "admin@example.com" } });
  if (!owner) {
    console.error('No seeded users found — run "npm run prisma:seed" first.');
    process.exit(1);
  }

  for (const s of SAMPLE_SYSTEMS) {
    const existing = await prisma.aiSystem.findFirst({ where: { name: s.name } });
    if (existing) continue;
    await prisma.aiSystem.create({
      data: { ...s, ownerId: owner.id },
    });
  }

  console.log("Sample AI use cases seeded.");
  SAMPLE_SYSTEMS.forEach((s) => console.log(`  ${s.status.padEnd(16)} ${s.name}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
