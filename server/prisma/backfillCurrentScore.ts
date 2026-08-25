// One-off backfill: populates AiSystem.currentScore (added after
// currentApprovalAuthority already existed) from each system's latest
// finalized assessment. Safe to re-run.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const systems = await prisma.aiSystem.findMany({
    where: { currentApprovalAuthority: { not: null } },
    select: { id: true },
  });

  let updated = 0;
  for (const system of systems) {
    const latestFinalized = await prisma.riskAssessment.findFirst({
      where: { aiSystemId: system.id, status: "FINALIZED" },
      orderBy: { version: "desc" },
      select: { score: true },
    });
    if (latestFinalized?.score != null) {
      await prisma.aiSystem.update({ where: { id: system.id }, data: { currentScore: latestFinalized.score } });
      updated++;
    }
  }

  console.log(`Backfilled currentScore for ${updated} system(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
