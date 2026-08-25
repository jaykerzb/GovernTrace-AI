-- CreateTable
CREATE TABLE "ReviewFunctionDef" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "triggerDeliveryModels" TEXT NOT NULL DEFAULT '[]',
    "triggerCapabilityTiers" TEXT NOT NULL DEFAULT '[]',
    "triggerRiskFactors" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WorkPaperSectionDef" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "functionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "triggerLabel" TEXT NOT NULL DEFAULT '',
    "triggerDeliveryModels" TEXT NOT NULL DEFAULT '[]',
    "triggerCapabilityTiers" TEXT NOT NULL DEFAULT '[]',
    "triggerRiskFactors" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkPaperSectionDef_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "ReviewFunctionDef" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkPaperQuestionDef" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "citation" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkPaperQuestionDef_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "WorkPaperSectionDef" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewFunctionDef_key_key" ON "ReviewFunctionDef"("key");

-- CreateIndex
CREATE UNIQUE INDEX "WorkPaperSectionDef_key_key" ON "WorkPaperSectionDef"("key");

-- CreateIndex
CREATE UNIQUE INDEX "WorkPaperQuestionDef_key_key" ON "WorkPaperQuestionDef"("key");
