-- CreateTable
CREATE TABLE "CustomFieldDef" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "options" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiSystem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "useCaseId" TEXT,
    "dateSubmitted" DATETIME,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "capabilityCategory" TEXT,
    "businessUnit" TEXT NOT NULL,
    "aitoCoordinator" TEXT,
    "sponsorName" TEXT,
    "ownerId" TEXT NOT NULL,
    "applicationName" TEXT,
    "aiType" TEXT NOT NULL,
    "vendorName" TEXT,
    "projectedCost" REAL,
    "targetDeploymentDate" DATETIME,
    "purpose" TEXT,
    "businessJustification" TEXT,
    "dataTypesUsed" TEXT,
    "deploymentContext" TEXT,
    "notes" TEXT,
    "customFieldValues" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "currentApprovalAuthority" TEXT,
    "currentScore" INTEGER,
    "currentReviewTriggered" BOOLEAN,
    "nextReviewDue" DATETIME,
    CONSTRAINT "AiSystem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AiSystem" ("aiType", "aitoCoordinator", "applicationName", "businessJustification", "businessUnit", "capabilityCategory", "createdAt", "currentApprovalAuthority", "currentReviewTriggered", "currentScore", "dataTypesUsed", "dateSubmitted", "deploymentContext", "description", "id", "name", "nextReviewDue", "notes", "ownerId", "projectedCost", "purpose", "sponsorName", "status", "targetDeploymentDate", "updatedAt", "useCaseId", "vendorName") SELECT "aiType", "aitoCoordinator", "applicationName", "businessJustification", "businessUnit", "capabilityCategory", "createdAt", "currentApprovalAuthority", "currentReviewTriggered", "currentScore", "dataTypesUsed", "dateSubmitted", "deploymentContext", "description", "id", "name", "nextReviewDue", "notes", "ownerId", "projectedCost", "purpose", "sponsorName", "status", "targetDeploymentDate", "updatedAt", "useCaseId", "vendorName" FROM "AiSystem";
DROP TABLE "AiSystem";
ALTER TABLE "new_AiSystem" RENAME TO "AiSystem";
CREATE TABLE "new_ApprovalStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aiSystemId" TEXT NOT NULL,
    "stepType" TEXT NOT NULL,
    "requiredRole" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "approverId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "actedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalStep_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AiSystem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalStep_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ApprovalStep" ("actedAt", "aiSystemId", "approverId", "comment", "createdAt", "id", "requiredRole", "status", "stepType") SELECT "actedAt", "aiSystemId", "approverId", "comment", "createdAt", "id", "requiredRole", "status", "stepType" FROM "ApprovalStep";
DROP TABLE "ApprovalStep";
ALTER TABLE "new_ApprovalStep" RENAME TO "ApprovalStep";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDef_key_key" ON "CustomFieldDef"("key");
