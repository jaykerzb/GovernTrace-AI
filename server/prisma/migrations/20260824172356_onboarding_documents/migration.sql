-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aiSystemId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "originalName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AiSystem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiSystem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "businessUnit" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "aiType" TEXT NOT NULL,
    "vendorName" TEXT,
    "purpose" TEXT,
    "dataTypesUsed" TEXT,
    "deploymentContext" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "currentRiskTier" TEXT,
    CONSTRAINT "AiSystem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AiSystem" ("aiType", "businessUnit", "createdAt", "currentRiskTier", "dataTypesUsed", "deploymentContext", "description", "id", "name", "ownerId", "purpose", "status", "updatedAt", "vendorName") SELECT "aiType", "businessUnit", "createdAt", "currentRiskTier", "dataTypesUsed", "deploymentContext", "description", "id", "name", "ownerId", "purpose", "status", "updatedAt", "vendorName" FROM "AiSystem";
DROP TABLE "AiSystem";
ALTER TABLE "new_AiSystem" RENAME TO "AiSystem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
