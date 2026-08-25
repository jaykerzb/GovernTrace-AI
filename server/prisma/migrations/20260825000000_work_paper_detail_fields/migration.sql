-- Add per-question notes, per-section risk data, and the work paper's
-- overall assessment summary fields. Drops the old free-form reviewerNotes
-- field, superseded by the structured summary fields below.
ALTER TABLE "FunctionWorkPaper" ADD COLUMN "questionNotes" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "FunctionWorkPaper" ADD COLUMN "sectionData" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "FunctionWorkPaper" ADD COLUMN "compositeRiskRating" TEXT;
ALTER TABLE "FunctionWorkPaper" ADD COLUMN "overallRecommendation" TEXT;
ALTER TABLE "FunctionWorkPaper" ADD COLUMN "keyFindings" TEXT;
ALTER TABLE "FunctionWorkPaper" ADD COLUMN "rationale" TEXT;
ALTER TABLE "FunctionWorkPaper" ADD COLUMN "reviewerName" TEXT;
ALTER TABLE "FunctionWorkPaper" ADD COLUMN "reviewerTitle" TEXT;
ALTER TABLE "FunctionWorkPaper" ADD COLUMN "reviewerDate" DATETIME;
ALTER TABLE "FunctionWorkPaper" DROP COLUMN "reviewerNotes";
