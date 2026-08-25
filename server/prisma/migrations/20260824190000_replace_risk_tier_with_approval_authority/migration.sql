-- Replace the old 4-tier RiskTier (LOW/MEDIUM/HIGH/CRITICAL) scoring model
-- with the org's real Dimension 2 approval-authority model (AIGA/AISC).
-- Existing data is backfilled with a one-time approximate mapping
-- (LOW/MEDIUM -> AIGA, HIGH/CRITICAL -> AISC) since the underlying question
-- set changed; new assessments are scored under the new methodology.

-- AiSystem: currentRiskTier -> currentApprovalAuthority, + currentReviewTriggered
ALTER TABLE "AiSystem" RENAME COLUMN "currentRiskTier" TO "currentApprovalAuthority";
ALTER TABLE "AiSystem" ADD COLUMN "currentReviewTriggered" BOOLEAN;
UPDATE "AiSystem" SET "currentApprovalAuthority" = CASE
  WHEN "currentApprovalAuthority" IN ('LOW', 'MEDIUM') THEN 'AIGA'
  WHEN "currentApprovalAuthority" IN ('HIGH', 'CRITICAL') THEN 'AISC'
  ELSE "currentApprovalAuthority"
END;

-- RiskAssessment: riskTier -> approvalAuthority, + reviewTriggered
ALTER TABLE "RiskAssessment" RENAME COLUMN "riskTier" TO "approvalAuthority";
ALTER TABLE "RiskAssessment" ADD COLUMN "reviewTriggered" BOOLEAN;
UPDATE "RiskAssessment" SET "approvalAuthority" = CASE
  WHEN "approvalAuthority" IN ('LOW', 'MEDIUM') THEN 'AIGA'
  WHEN "approvalAuthority" IN ('HIGH', 'CRITICAL') THEN 'AISC'
  ELSE "approvalAuthority"
END;

-- RegulatoryObligation: minRiskTier -> minApprovalAuthority (still NOT NULL)
ALTER TABLE "RegulatoryObligation" RENAME COLUMN "minRiskTier" TO "minApprovalAuthority";
UPDATE "RegulatoryObligation" SET "minApprovalAuthority" = CASE
  WHEN "minApprovalAuthority" IN ('LOW', 'MEDIUM') THEN 'AIGA'
  WHEN "minApprovalAuthority" IN ('HIGH', 'CRITICAL') THEN 'AISC'
  ELSE "minApprovalAuthority"
END;
