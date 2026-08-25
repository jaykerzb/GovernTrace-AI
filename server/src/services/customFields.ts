import { prisma } from "../lib/prisma.js";

export function getCustomFieldDefs() {
  return prisma.customFieldDef.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
}
