import { prisma } from "../lib/prisma.js";

const DEFAULTS = [
  {
    key: "IN_HOUSE",
    label: "In-House Built",
    sortOrder: 0,
    definition: "Designed, developed, and maintained internally by this organization's own team.",
  },
  {
    key: "VENDOR",
    label: "Vendor / Third-Party",
    sortOrder: 1,
    definition: "A commercial product or service licensed from an external vendor.",
  },
  {
    key: "EMBEDDED",
    label: "Embedded in Another Product",
    sortOrder: 2,
    definition: "AI functionality bundled inside a broader platform or product the organization already uses, rather than adopted on its own.",
  },
  {
    key: "AGENT",
    label: "Autonomous Agent",
    sortOrder: 3,
    definition: "Operates with a meaningful degree of independence, taking multi-step actions toward a goal with limited human review of each step.",
  },
];

// Guards against a race where several concurrent requests each see an empty
// table and all try to insert the same defaults (unique constraint crash).
let seedPromise: Promise<void> | null = null;

function seedDefaultsIfEmpty(): Promise<void> {
  if (!seedPromise) seedPromise = doSeedDefaultsIfEmpty();
  return seedPromise;
}

async function doSeedDefaultsIfEmpty() {
  const count = await prisma.aiTypeOption.count();
  if (count > 0) return;
  await prisma.aiTypeOption.createMany({ data: DEFAULTS });
}

// Lazily seeds the four shipped defaults the first time they're needed,
// mirroring the OrgSettings singleton pattern — no separate seed step to
// remember to run.
export async function getAiTypeOptions() {
  await seedDefaultsIfEmpty();
  return prisma.aiTypeOption.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
}
