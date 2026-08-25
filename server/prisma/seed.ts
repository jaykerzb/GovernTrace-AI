import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_PASSWORD = "governance123";

const USERS: { name: string; email: string; role: Role }[] = [
  { name: "Ada Admin", email: "admin@example.com", role: "ADMIN" },
  { name: "Cara Compliance", email: "compliance@example.com", role: "COMPLIANCE_OFFICER" },
  { name: "Owen Owner", email: "owner@example.com", role: "SYSTEM_OWNER" },
  { name: "Amir Approver", email: "approver@example.com", role: "APPROVER" },
  { name: "Vera Viewer", email: "viewer@example.com", role: "VIEWER" },
];

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash },
    });
  }

  console.log("Seed complete.");
  console.log(`All seeded users share the password: ${SEED_PASSWORD}`);
  USERS.forEach((u) => console.log(`  ${u.role.padEnd(20)} ${u.email}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
