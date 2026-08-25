-- CreateTable
CREATE TABLE "FunctionWorkPaper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aiSystemId" TEXT NOT NULL,
    "functionKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "answers" TEXT NOT NULL DEFAULT '{}',
    "reviewerNotes" TEXT,
    "reviewedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "FunctionWorkPaper_aiSystemId_fkey" FOREIGN KEY ("aiSystemId") REFERENCES "AiSystem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FunctionWorkPaper_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FunctionWorkPaper_aiSystemId_functionKey_key" ON "FunctionWorkPaper"("aiSystemId", "functionKey");
