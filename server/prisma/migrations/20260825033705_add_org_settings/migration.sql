-- CreateTable
CREATE TABLE "OrgSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "orgName" TEXT NOT NULL DEFAULT 'GovernTrace AI',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f172a',
    "approvalAuthorityLowLabel" TEXT NOT NULL DEFAULT 'AIGA',
    "approvalAuthorityHighLabel" TEXT NOT NULL DEFAULT 'AISC',
    "approvalThreshold" INTEGER NOT NULL DEFAULT 30,
    "reassessmentCadenceDays" INTEGER NOT NULL DEFAULT 365,
    "updatedAt" DATETIME NOT NULL
);
