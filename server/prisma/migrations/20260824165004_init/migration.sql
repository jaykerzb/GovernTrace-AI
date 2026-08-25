-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AiSystem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "businessUnit" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "aiType" TEXT NOT NULL,
    "vendorName" TEXT,
    "purpose" TEXT NOT NULL,
    "dataTypesUsed" TEXT NOT NULL,
    "deploymentContext" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "currentRiskTier" TEXT,
    CONSTRAINT "AiSystem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aiSystemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "answers" TEXT NOT NULL,
    "riskTier" TEXT,
    "score" INTEGER,
    "assessedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" DATETIME,
    CONSTRAINT "RiskAssessment_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AiSystem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RiskAssessment_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegulatoryObligation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "framework" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "minRiskTier" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "SystemObligation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aiSystemId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "evidenceNotes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SystemObligation_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AiSystem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SystemObligation_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "RegulatoryObligation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aiSystemId" TEXT NOT NULL,
    "stepType" TEXT NOT NULL,
    "requiredRole" TEXT NOT NULL,
    "approverId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "actedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalStep_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AiSystem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalStep_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "aiSystemId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AiSystem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessment_aiSystemId_version_key" ON "RiskAssessment"("aiSystemId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RegulatoryObligation_framework_code_key" ON "RegulatoryObligation"("framework", "code");

-- CreateIndex
CREATE UNIQUE INDEX "SystemObligation_aiSystemId_obligationId_key" ON "SystemObligation"("aiSystemId", "obligationId");
