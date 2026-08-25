-- AlterTable
ALTER TABLE "RiskAssessment" ADD COLUMN "questionsSnapshot" TEXT;

-- CreateTable
CREATE TABLE "RiskQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "dimension" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,
    "helpText" TEXT NOT NULL DEFAULT '',
    "options" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "RiskQuestion_key_key" ON "RiskQuestion"("key");
