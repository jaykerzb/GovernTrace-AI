import type { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

// Fixed catalog of configurable governance-workflow privileges — the set
// itself isn't admin-editable, only which roles hold each one. Deliberately
// excludes meta-administration (managing users, org/email settings, the risk
// questionnaire, review-function definitions, AI type options, custom
// fields) — those stay hardcoded ADMIN-only; reconfiguring who can
// administer the admin panel is out of scope here.
export const PERMISSIONS = [
  { key: "CREATE_SYSTEM", label: "Register new AI use cases", group: "Systems" },
  { key: "EDIT_SYSTEM", label: "Edit AI use case details", group: "Systems" },
  { key: "DELETE_SYSTEM", label: "Delete AI use cases", group: "Systems" },
  { key: "BULK_MANAGE_SYSTEMS", label: "Bulk update/delete AI use cases from the registry", group: "Systems" },
  { key: "CHANGE_SYSTEM_STATUS", label: "Change an AI use case's status", group: "Systems" },
  { key: "RUN_ASSESSMENT", label: "Start / re-run a risk assessment", group: "Assessments" },
  { key: "FINALIZE_ASSESSMENT", label: "Finalize a risk assessment", group: "Assessments" },
  { key: "DELETE_ASSESSMENT", label: "Delete a risk assessment", group: "Assessments" },
  { key: "MANAGE_WORK_PAPERS", label: "Edit, complete, or reopen function work papers", group: "Work Papers & Committee" },
  { key: "MANAGE_COMMITTEE_REVIEW", label: "Edit, finalize, or reopen the committee summary", group: "Work Papers & Committee" },
  { key: "DECIDE_APPROVAL", label: "Approve or reject an approval step", group: "Approvals" },
  { key: "MANAGE_DOCUMENTS", label: "Upload or delete supporting documents", group: "Documents & Policies" },
  { key: "MANAGE_POLICIES", label: "Upload or edit policy repository documents", group: "Documents & Policies" },
  { key: "SCHEDULE_MEETING", label: "Schedule calendar meetings", group: "Meetings & Comments" },
  { key: "DELETE_ANY_COMMENT", label: "Delete another user's comment", group: "Meetings & Comments" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

// Reproduces exactly what each role could already do before this table
// existed, so seeding it changes nothing until an admin edits a grant.
const DEFAULT_GRANTS: Record<PermissionKey, Role[]> = {
  CREATE_SYSTEM: ["ADMIN", "SYSTEM_OWNER"],
  EDIT_SYSTEM: ["ADMIN", "SYSTEM_OWNER"],
  DELETE_SYSTEM: ["ADMIN", "SYSTEM_OWNER"],
  BULK_MANAGE_SYSTEMS: ["ADMIN"],
  CHANGE_SYSTEM_STATUS: ["ADMIN", "COMPLIANCE_OFFICER", "APPROVER"],
  RUN_ASSESSMENT: ["ADMIN", "COMPLIANCE_OFFICER", "SYSTEM_OWNER"],
  FINALIZE_ASSESSMENT: ["ADMIN", "COMPLIANCE_OFFICER"],
  DELETE_ASSESSMENT: ["ADMIN", "COMPLIANCE_OFFICER", "SYSTEM_OWNER"],
  MANAGE_WORK_PAPERS: ["ADMIN", "COMPLIANCE_OFFICER"],
  MANAGE_COMMITTEE_REVIEW: ["ADMIN", "COMPLIANCE_OFFICER"],
  DECIDE_APPROVAL: ["ADMIN", "APPROVER"],
  MANAGE_DOCUMENTS: ["ADMIN", "COMPLIANCE_OFFICER", "SYSTEM_OWNER"],
  MANAGE_POLICIES: ["ADMIN", "COMPLIANCE_OFFICER"],
  SCHEDULE_MEETING: ["ADMIN", "COMPLIANCE_OFFICER", "SYSTEM_OWNER", "APPROVER"],
  DELETE_ANY_COMMENT: ["ADMIN"],
};

let seedPromise: Promise<void> | null = null;

function seedDefaultsIfEmpty(): Promise<void> {
  if (!seedPromise) seedPromise = doSeedDefaultsIfEmpty();
  return seedPromise;
}

async function doSeedDefaultsIfEmpty() {
  const count = await prisma.rolePermission.count();
  if (count > 0) return;
  const data = Object.entries(DEFAULT_GRANTS).flatMap(([permission, roles]) =>
    roles.map((role) => ({ role, permission }))
  );
  await prisma.rolePermission.createMany({ data });
}

export async function getRolePermissions() {
  await seedDefaultsIfEmpty();
  return prisma.rolePermission.findMany();
}

// ADMIN is never gated through the DB — this is the actual lockout-safety
// guarantee (not just a UI convention), so a bad seed or a bug in the admin
// UI can never lock every admin out of the app.
export async function hasPermission(role: Role, key: string): Promise<boolean> {
  if (role === "ADMIN") return true;
  await seedDefaultsIfEmpty();
  const grant = await prisma.rolePermission.findUnique({
    where: { role_permission: { role, permission: key } },
  });
  return !!grant;
}

export async function setPermission(role: Role, permission: string, granted: boolean) {
  if (role === "ADMIN") {
    throw new Error("Admins always have full access and can't be changed.");
  }
  await seedDefaultsIfEmpty();
  if (granted) {
    await prisma.rolePermission.upsert({
      where: { role_permission: { role, permission } },
      update: {},
      create: { role, permission },
    });
  } else {
    await prisma.rolePermission.deleteMany({ where: { role, permission } });
  }
}
