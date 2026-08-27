import { prisma } from "../lib/prisma.js";

// Used only when the option table is empty AND no AI use case exists yet to
// seed from (a genuinely fresh install) — a small generic starter list so
// intake isn't blocked by an empty dropdown on day one. Otherwise seeding
// prefers whatever business units are already in use (see below).
const STARTER_DEFAULTS = [
  "Information Technology",
  "Human Resources",
  "Finance",
  "Legal",
  "Compliance",
  "Operations",
  "Marketing",
  "Sales",
];

let seedPromise: Promise<void> | null = null;

function seedDefaultsIfEmpty(): Promise<void> {
  if (!seedPromise) seedPromise = doSeedDefaultsIfEmpty();
  return seedPromise;
}

async function doSeedDefaultsIfEmpty() {
  const count = await prisma.businessUnitOption.count();
  if (count > 0) return;

  // Business units, unlike AI Types, were free text before this list
  // existed — seeding from whatever's already on real AI use cases means
  // an org that's been using the app keeps every business unit already in
  // use as a selectable option, instead of starting from a generic list
  // that doesn't match their actual data.
  const existing = await prisma.aiSystem.findMany({ distinct: ["businessUnit"], select: { businessUnit: true }, orderBy: { businessUnit: "asc" } });
  const labels = existing.length > 0 ? existing.map((s) => s.businessUnit) : STARTER_DEFAULTS;

  // SQLite's createMany doesn't support skipDuplicates, and `distinct` above
  // already de-dupes exact matches — but business unit strings can differ
  // only by case/whitespace, so still dedupe defensively before inserting.
  const seen = new Set<string>();
  const unique = labels.filter((label) => {
    const key = label.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await prisma.businessUnitOption.createMany({
    data: unique.map((label, i) => ({ label, sortOrder: i })),
  });
}

// Lazily seeds the first time it's needed, mirroring the AiTypeOption
// pattern — no separate seed step to remember to run.
export async function getBusinessUnitOptions() {
  await seedDefaultsIfEmpty();
  return prisma.businessUnitOption.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
}
