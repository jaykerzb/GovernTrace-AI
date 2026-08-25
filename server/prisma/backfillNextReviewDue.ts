// One-off backfill: sets nextReviewDue for systems whose committee review was
// already finalized as approved before the re-assessment scheduling feature
// existed. Safe to re-run.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const reviews = await prisma.committeeReview.findMany({
    where: {
      status: "FINALIZED",
      finalDisposition: { in: ["APPROVED", "APPROVED_WITH_CONDITIONS"] },
      finalizedAt: { not: null },
    },
    select: { aiSystemId: true, finalizedAt: true },
  });

  for (const r of reviews) {
    const nextReviewDue = new Date(r.finalizedAt!.getTime() + 365 * 24 * 60 * 60 * 1000);
    await prisma.aiSystem.update({ where: { id: r.aiSystemId }, data: { nextReviewDue } });
  }

  console.log(`Backfilled nextReviewDue for ${reviews.length} system(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
