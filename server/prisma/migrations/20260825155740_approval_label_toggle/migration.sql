-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrgSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "orgName" TEXT NOT NULL DEFAULT 'GovernTrace AI',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f172a',
    "approvalAuthorityLowLabel" TEXT NOT NULL DEFAULT 'AIGA',
    "approvalAuthorityHighLabel" TEXT NOT NULL DEFAULT 'AISC',
    "showApprovalAuthorityLabels" BOOLEAN NOT NULL DEFAULT true,
    "approvalThreshold" INTEGER NOT NULL DEFAULT 30,
    "reassessmentCadenceDays" INTEGER NOT NULL DEFAULT 365,
    "riskBandLowMax" INTEGER NOT NULL DEFAULT 15,
    "riskBandModerateMax" INTEGER NOT NULL DEFAULT 30,
    "riskBandHighMax" INTEGER NOT NULL DEFAULT 38,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_OrgSettings" ("approvalAuthorityHighLabel", "approvalAuthorityLowLabel", "approvalThreshold", "id", "logoUrl", "orgName", "primaryColor", "reassessmentCadenceDays", "riskBandHighMax", "riskBandLowMax", "riskBandModerateMax", "updatedAt") SELECT "approvalAuthorityHighLabel", "approvalAuthorityLowLabel", "approvalThreshold", "id", "logoUrl", "orgName", "primaryColor", "reassessmentCadenceDays", "riskBandHighMax", "riskBandLowMax", "riskBandModerateMax", "updatedAt" FROM "OrgSettings";
DROP TABLE "OrgSettings";
ALTER TABLE "new_OrgSettings" RENAME TO "OrgSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
