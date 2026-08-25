// Populates ~15 semi-realistic AI use cases spanning every status, delivery
// model, and risk band, so the dashboard/analytics/queue features have
// something to show. Safe to re-run: skips any use case whose name already
// exists.
import { PrismaClient } from "@prisma/client";
import { scoreToApprovalAuthority } from "../src/services/riskQuestionnaire.js";
import { getActiveRiskQuestions, computeScore, computeReviewTriggered, type Question } from "../src/services/riskQuestions.js";
import { syncWorkPapersForSystem } from "../src/services/workPaperSync.js";

const prisma = new PrismaClient();

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// Builds a Dimension 2 answers object that scores near `targetAvgPoints`
// (1, 3, or 5) per question, using each question's actual option labels.
function buildD2Answers(dimension2Questions: Question[], targetAvgPoints: 1 | 3 | 5): Record<string, string> {
  const optionIndex = targetAvgPoints === 1 ? 0 : targetAvgPoints === 3 ? 1 : 2;
  const answers: Record<string, string> = {};
  for (const q of dimension2Questions) {
    answers[q.id] = q.options[optionIndex].label;
  }
  return answers;
}

interface WorkPaperSpec {
  functionKey: "INFOSEC" | "MRM" | "COMPLIANCE" | "FIU" | "PRIVACY";
  compositeRiskRating: "Low" | "Moderate" | "High" | "Critical";
  overallRecommendation: "NO_OBJECTION" | "APPROVE_WITH_CONDITIONS" | "OBJECTION" | "DEFERRED";
}

interface UseCaseSpec {
  name: string;
  description: string;
  businessUnit: string;
  aiType: "IN_HOUSE" | "VENDOR" | "EMBEDDED" | "AGENT";
  vendorName?: string;
  status: "DRAFT" | "INTAKE" | "RISK_ASSESSMENT" | "UNDER_REVIEW" | "APPROVED" | "DEPLOYED" | "MONITORING" | "RETIRED";
  ownerEmail: string;
  createdDaysAgo: number;
  purpose?: string;
  businessJustification?: string;
  capabilityCategory?: string;
  assessment?: {
    targetAvgPoints: 1 | 3 | 5;
    triggerYes: boolean;
    deliveryModel: string;
    capabilityTier: string;
    riskFactors: number[];
    finalizedDaysAgo: number;
  };
  workPapers?: WorkPaperSpec[];
  committee?: {
    finalDisposition: "APPROVED" | "APPROVED_WITH_CONDITIONS" | "NOT_APPROVED" | "DEFERRED" | "REMANDED";
    decisionJustification: string;
    finalizedDaysAgo: number;
  };
}

const USE_CASES: UseCaseSpec[] = [
  {
    name: "Loan Origination Copilot",
    description: "Assists retail loan officers by pre-filling application data and surfacing underwriting guideline references.",
    businessUnit: "Retail Lending",
    aiType: "VENDOR",
    vendorName: "Nova Lending Systems",
    status: "DEPLOYED",
    ownerEmail: "owner@example.com",
    createdDaysAgo: 172,
    purpose: "Speed up loan origination while keeping underwriters in the loop.",
    capabilityCategory: "Document processing / decision support",
    assessment: { targetAvgPoints: 5, triggerYes: true, deliveryModel: "D3", capabilityTier: "T3", riskFactors: [1, 2, 10], finalizedDaysAgo: 160 },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
      { functionKey: "MRM", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
      { functionKey: "COMPLIANCE", compositeRiskRating: "Critical", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
    ],
    committee: { finalDisposition: "APPROVED_WITH_CONDITIONS", decisionJustification: "Approved with quarterly fair-lending monitoring and enhanced underwriter override logging.", finalizedDaysAgo: 150 },
  },
  {
    name: "Fraud Detection Monitoring",
    description: "Real-time transaction monitoring model that scores and flags potentially fraudulent card transactions.",
    businessUnit: "Fraud & AML",
    aiType: "IN_HOUSE",
    status: "MONITORING",
    ownerEmail: "owner@example.com",
    createdDaysAgo: 210,
    purpose: "Reduce card fraud losses via real-time scoring.",
    capabilityCategory: "Anomaly detection",
    assessment: { targetAvgPoints: 5, triggerYes: true, deliveryModel: "D4", capabilityTier: "T3", riskFactors: [1, 5, 10], finalizedDaysAgo: 200 },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
      { functionKey: "COMPLIANCE", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
      { functionKey: "FIU", compositeRiskRating: "Critical", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
      { functionKey: "PRIVACY", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
    ],
    committee: { finalDisposition: "APPROVED_WITH_CONDITIONS", decisionJustification: "Approved with monthly model drift review by MRM and quarterly FIU false-positive rate reporting.", finalizedDaysAgo: 190 },
  },
  {
    name: "Customer Support Chatbot",
    description: "Vendor chatbot embedded in online banking that answers common account and product questions.",
    businessUnit: "Digital Banking",
    aiType: "VENDOR",
    vendorName: "Helio AI",
    status: "DEPLOYED",
    ownerEmail: "owner@example.com",
    createdDaysAgo: 140,
    purpose: "Deflect routine support calls to a self-service chatbot.",
    capabilityCategory: "Conversational AI",
    assessment: { targetAvgPoints: 3, triggerYes: true, deliveryModel: "D3", capabilityTier: "T2", riskFactors: [1, 2, 7], finalizedDaysAgo: 130 },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "COMPLIANCE", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "PRIVACY", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
    ],
    committee: { finalDisposition: "APPROVED", decisionJustification: "Low incremental risk given existing vendor due diligence; approved as-is.", finalizedDaysAgo: 120 },
  },
  {
    name: "Internal Document Summarizer",
    description: "Summarizes long internal policy and procedure documents for staff reference.",
    businessUnit: "Operations",
    aiType: "VENDOR",
    vendorName: "Concise AI",
    status: "APPROVED",
    ownerEmail: "compliance@example.com",
    createdDaysAgo: 95,
    purpose: "Reduce time staff spend reading long internal documents.",
    capabilityCategory: "Summarization",
    assessment: { targetAvgPoints: 1, triggerYes: false, deliveryModel: "D1", capabilityTier: "T1", riskFactors: [3], finalizedDaysAgo: 85 },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Low", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "Low", overallRecommendation: "NO_OBJECTION" },
    ],
    committee: { finalDisposition: "APPROVED", decisionJustification: "Minimal risk, internal-only use, no customer or regulated data.", finalizedDaysAgo: 75 },
  },
  {
    name: "Contract Review Assistant",
    description: "Flags non-standard clauses in vendor contracts for legal review before signature.",
    businessUnit: "Legal",
    aiType: "IN_HOUSE",
    status: "UNDER_REVIEW",
    ownerEmail: "compliance@example.com",
    createdDaysAgo: 45,
    purpose: "Speed up contract review by flagging deviations from standard terms.",
    capabilityCategory: "Document analysis",
    assessment: { targetAvgPoints: 3, triggerYes: false, deliveryModel: "D4", capabilityTier: "T2", riskFactors: [3], finalizedDaysAgo: 30 },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
    ],
  },
  {
    name: "Employee HR Chatbot",
    description: "Answers employee questions about benefits, PTO policy, and HR procedures.",
    businessUnit: "Human Resources",
    aiType: "VENDOR",
    vendorName: "PeopleFlow",
    status: "RISK_ASSESSMENT",
    ownerEmail: "owner@example.com",
    createdDaysAgo: 20,
    purpose: "Reduce routine HR ticket volume.",
    capabilityCategory: "Conversational AI",
  },
  {
    name: "Marketing Content Generator",
    description: "Drafts first-pass marketing copy and social posts for the marketing team to edit.",
    businessUnit: "Marketing",
    aiType: "VENDOR",
    vendorName: "Copygen",
    status: "DEPLOYED",
    ownerEmail: "owner@example.com",
    createdDaysAgo: 110,
    purpose: "Speed up first-draft content creation.",
    capabilityCategory: "Content generation",
    assessment: { targetAvgPoints: 1, triggerYes: false, deliveryModel: "D1", capabilityTier: "T1", riskFactors: [], finalizedDaysAgo: 100 },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Low", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "Low", overallRecommendation: "NO_OBJECTION" },
    ],
    committee: { finalDisposition: "APPROVED", decisionJustification: "No sensitive data, human-reviewed before publication.", finalizedDaysAgo: 90 },
  },
  {
    name: "Code Review Assistant",
    description: "Vendor coding assistant that suggests code completions and flags common bugs in pull requests.",
    businessUnit: "Technology",
    aiType: "VENDOR",
    vendorName: "DevMate",
    status: "MONITORING",
    ownerEmail: "admin@example.com",
    createdDaysAgo: 130,
    purpose: "Improve developer productivity and catch bugs earlier.",
    capabilityCategory: "Code generation",
    assessment: { targetAvgPoints: 3, triggerYes: false, deliveryModel: "D3", capabilityTier: "T2", riskFactors: [8], finalizedDaysAgo: 120 },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "Low", overallRecommendation: "NO_OBJECTION" },
    ],
    committee: { finalDisposition: "APPROVED", decisionJustification: "Standard vendor tool, no production code execution without human review.", finalizedDaysAgo: 110 },
  },
  {
    name: "AML Transaction Scoring Agent",
    description: "Agentic workflow that scores transactions for AML risk and auto-files low-risk alerts as reviewed.",
    businessUnit: "Fraud & AML",
    aiType: "AGENT",
    status: "UNDER_REVIEW",
    ownerEmail: "compliance@example.com",
    createdDaysAgo: 38,
    purpose: "Reduce AML analyst backlog by auto-clearing clearly low-risk alerts.",
    capabilityCategory: "Autonomous agent",
    assessment: { targetAvgPoints: 5, triggerYes: true, deliveryModel: "D4", capabilityTier: "T4", riskFactors: [5, 9, 10], finalizedDaysAgo: 25 },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
      { functionKey: "MRM", compositeRiskRating: "Critical", overallRecommendation: "OBJECTION" },
      { functionKey: "COMPLIANCE", compositeRiskRating: "Critical", overallRecommendation: "OBJECTION" },
      { functionKey: "FIU", compositeRiskRating: "Critical", overallRecommendation: "OBJECTION" },
    ],
  },
  {
    name: "Credit Risk Scoring Model",
    description: "Internally developed model supplementing traditional credit scoring for small business lending.",
    businessUnit: "Credit Risk",
    aiType: "IN_HOUSE",
    status: "APPROVED",
    ownerEmail: "owner@example.com",
    createdDaysAgo: 240,
    purpose: "Improve credit risk assessment accuracy for small business loans.",
    capabilityCategory: "Predictive scoring",
    assessment: { targetAvgPoints: 5, triggerYes: true, deliveryModel: "D4", capabilityTier: "T2", riskFactors: [1, 10], finalizedDaysAgo: 225 },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
      { functionKey: "COMPLIANCE", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
    ],
    committee: { finalDisposition: "APPROVED_WITH_CONDITIONS", decisionJustification: "Approved with annual disparate-impact testing requirement.", finalizedDaysAgo: 215 },
  },
  {
    name: "Vendor Onboarding Bot",
    description: "Guides new vendors through document submission during procurement onboarding.",
    businessUnit: "Procurement",
    aiType: "EMBEDDED",
    vendorName: "ProcureFlow",
    status: "INTAKE",
    ownerEmail: "owner@example.com",
    createdDaysAgo: 8,
    purpose: "Streamline vendor onboarding document collection.",
    capabilityCategory: "Workflow assistant",
  },
  {
    name: "Meeting Notes Summarizer",
    description: "Summarizes internal meeting recordings into action items.",
    businessUnit: "Operations",
    aiType: "VENDOR",
    vendorName: "NoteWise",
    status: "DRAFT",
    ownerEmail: "viewer@example.com",
    createdDaysAgo: 2,
    purpose: "Reduce time spent on manual meeting notes.",
    capabilityCategory: "Summarization",
  },
  {
    name: "Sanctions Screening Assistant",
    description: "Legacy tool that pre-screened wire transfers against sanctions lists; replaced by a newer vendor platform.",
    businessUnit: "Compliance",
    aiType: "VENDOR",
    vendorName: "ScreenGuard (legacy)",
    status: "RETIRED",
    ownerEmail: "compliance@example.com",
    createdDaysAgo: 400,
    purpose: "Screen outbound wires against OFAC and sanctions lists.",
    capabilityCategory: "Screening",
    assessment: { targetAvgPoints: 5, triggerYes: true, deliveryModel: "D3", capabilityTier: "T2", riskFactors: [10], finalizedDaysAgo: 390 },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "COMPLIANCE", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
      { functionKey: "FIU", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
    ],
    committee: { finalDisposition: "APPROVED_WITH_CONDITIONS", decisionJustification: "Approved historically; superseded and retired in favor of a newer platform.", finalizedDaysAgo: 380 },
  },
  {
    name: "Data Analytics Insight Agent",
    description: "Answers natural-language questions over internal analytics dashboards for business teams.",
    businessUnit: "Data & Analytics",
    aiType: "IN_HOUSE",
    status: "DEPLOYED",
    ownerEmail: "admin@example.com",
    createdDaysAgo: 60,
    purpose: "Let non-technical staff query dashboards in plain English.",
    capabilityCategory: "Analytics assistant",
    assessment: { targetAvgPoints: 1, triggerYes: false, deliveryModel: "D4", capabilityTier: "T3", riskFactors: [3], finalizedDaysAgo: 50 },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Low", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "Low", overallRecommendation: "NO_OBJECTION" },
    ],
    committee: { finalDisposition: "APPROVED", decisionJustification: "Read-only internal analytics tool, no customer data exposure.", finalizedDaysAgo: 40 },
  },
  {
    name: "Branch Chat Assistant",
    description: "In-branch tablet assistant that helps customers navigate product options while waiting for a banker.",
    businessUnit: "Retail Banking",
    aiType: "VENDOR",
    vendorName: "Helio AI",
    status: "DEPLOYED",
    ownerEmail: "owner@example.com",
    createdDaysAgo: 75,
    purpose: "Improve the in-branch wait experience with self-service product info.",
    capabilityCategory: "Conversational AI",
    assessment: { targetAvgPoints: 3, triggerYes: true, deliveryModel: "D3", capabilityTier: "T2", riskFactors: [2], finalizedDaysAgo: 65 },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "COMPLIANCE", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
    ],
    committee: { finalDisposition: "APPROVED", decisionJustification: "Informational only, no account access or transactions.", finalizedDaysAgo: 55 },
  },
];

async function main() {
  const users = await prisma.user.findMany();
  const byEmail = new Map(users.map((u) => [u.email, u]));
  const activeQuestions = await getActiveRiskQuestions();
  const dimension1Questions = activeQuestions.filter((q) => q.dimension === 1);
  const dimension2Questions = activeQuestions.filter((q) => q.dimension === 2);

  for (const spec of USE_CASES) {
    const existing = await prisma.aiSystem.findFirst({ where: { name: spec.name } });
    if (existing) {
      console.log(`Skipping "${spec.name}" (already exists).`);
      continue;
    }

    const owner = byEmail.get(spec.ownerEmail);
    if (!owner) throw new Error(`Seed user not found: ${spec.ownerEmail}. Run "npx prisma db seed" first.`);

    const createdAt = daysAgo(spec.createdDaysAgo);

    const system = await prisma.aiSystem.create({
      data: {
        name: spec.name,
        description: spec.description,
        businessUnit: spec.businessUnit,
        aiType: spec.aiType,
        vendorName: spec.vendorName,
        ownerId: owner.id,
        status: spec.status,
        purpose: spec.purpose,
        businessJustification: spec.businessJustification,
        capabilityCategory: spec.capabilityCategory,
        dateSubmitted: createdAt,
        createdAt,
        updatedAt: spec.assessment ? daysAgo(spec.assessment.finalizedDaysAgo) : createdAt,
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: "AiSystem",
        entityId: system.id,
        aiSystemId: system.id,
        action: "CREATED",
        actorId: owner.id,
        summary: `Intake started for system "${system.name}".`,
        timestamp: createdAt,
      },
    });

    if (spec.assessment) {
      const { targetAvgPoints, triggerYes, deliveryModel, capabilityTier, riskFactors, finalizedDaysAgo } = spec.assessment;
      const d1Answers: Record<string, string> = {
        d1_customer_facing: triggerYes ? "Yes" : "No",
        d1_regulated_decisions: triggerYes && targetAvgPoints >= 3 ? "Yes" : "No",
        d1_vendor_training_data: "No",
        d1_full_autonomy: capabilityTier === "T4" ? "Yes" : "No",
      };
      const answers = { ...d1Answers, ...buildD2Answers(dimension2Questions, targetAvgPoints) };
      const score = computeScore(answers, dimension2Questions);
      const approvalAuthority = scoreToApprovalAuthority(score);
      const reviewTriggered = computeReviewTriggered(answers, dimension1Questions);
      const finalizedAt = daysAgo(finalizedDaysAgo);

      await prisma.riskAssessment.create({
        data: {
          aiSystemId: system.id,
          version: 1,
          status: "FINALIZED",
          answers: JSON.stringify(answers),
          score,
          approvalAuthority,
          reviewTriggered,
          deliveryModel,
          capabilityTier,
          riskFactors: JSON.stringify(riskFactors),
          assessedById: owner.id,
          createdAt,
          finalizedAt,
        },
      });

      await prisma.aiSystem.update({
        where: { id: system.id },
        data: { currentApprovalAuthority: approvalAuthority, currentReviewTriggered: reviewTriggered },
      });

      await prisma.auditLog.create({
        data: {
          entityType: "RiskAssessment",
          entityId: system.id,
          aiSystemId: system.id,
          action: "FINALIZED",
          actorId: owner.id,
          summary: `Finalized risk assessment v1: ${approvalAuthority} required (score ${score}).`,
          timestamp: finalizedAt,
        },
      });

      await syncWorkPapersForSystem(system.id, deliveryModel, capabilityTier, riskFactors);

      if (spec.workPapers) {
        const compliance = byEmail.get("compliance@example.com")!;
        for (const wp of spec.workPapers) {
          await prisma.functionWorkPaper.updateMany({
            where: { aiSystemId: system.id, functionKey: wp.functionKey },
            data: {
              status: "COMPLETE",
              compositeRiskRating: wp.compositeRiskRating,
              overallRecommendation: wp.overallRecommendation,
              keyFindings: `${wp.compositeRiskRating} risk identified during review; see section notes for detail.`,
              rationale: `Recommendation reflects the ${wp.compositeRiskRating.toLowerCase()} composite risk rating across in-scope sections.`,
              reviewerName: compliance.name,
              reviewerTitle: "Compliance Officer",
              reviewerDate: finalizedAt,
              reviewedById: compliance.id,
              completedAt: finalizedAt,
              updatedAt: finalizedAt,
            },
          });
        }
      }

      if (spec.committee) {
        const admin = byEmail.get("admin@example.com")!;
        const committeeFinalizedAt = daysAgo(spec.committee.finalizedDaysAgo);
        await prisma.committeeReview.create({
          data: {
            aiSystemId: system.id,
            status: "FINALIZED",
            finalDisposition: spec.committee.finalDisposition,
            decisionJustification: spec.committee.decisionJustification,
            finalizedById: admin.id,
            finalizedAt: committeeFinalizedAt,
            createdAt: finalizedAt,
            updatedAt: committeeFinalizedAt,
          },
        });

        await prisma.auditLog.create({
          data: {
            entityType: "CommitteeReview",
            entityId: system.id,
            aiSystemId: system.id,
            action: "FINALIZED",
            actorId: admin.id,
            summary: `Finalized the committee summary: ${spec.committee.finalDisposition}.`,
            timestamp: committeeFinalizedAt,
          },
        });
      }
    }

    console.log(`Created "${spec.name}" (${spec.status}).`);
  }

  console.log("Demo data seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
