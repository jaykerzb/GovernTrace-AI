// Populates ~15 semi-realistic AI use cases spanning every status, delivery
// model, and risk band, so the dashboard/analytics/queue features have
// something to show. Safe to re-run: skips any use case whose name already
// exists. Pair with removeDemoData.ts to undo this cleanly.
//
// Every question on every finalized risk assessment and "complete" work
// paper is answered (not just a top-level summary), currentScore/
// currentApprovalAuthority/nextReviewDue are set exactly like the real
// finalize-assessment/finalize-committee routes do, and approval chains are
// created and (for systems already past approval) marked decided — so the
// Dashboard, My Queue, Calendar, and each system's own Audit Log all reflect
// the same story a real user's workflow would have produced.
import { PrismaClient } from "@prisma/client";
import { scoreToApprovalAuthority } from "../src/services/riskQuestionnaire.js";
import { getActiveRiskQuestions, computeScore, computeReviewTriggered, type Question } from "../src/services/riskQuestions.js";
import { syncWorkPapersForSystem } from "../src/services/workPaperSync.js";
import { getInScopeSections, getFunctionLabel } from "../src/services/functionWorkPapers.js";
import { createApprovalSteps } from "../src/services/approvalSteps.js";

const prisma = new PrismaClient();

// Matches the shipped OrgSettings default (see services/orgSettings.ts) —
// good enough for seed purposes without importing/parsing the live setting.
const REASSESSMENT_CADENCE_DAYS = 365;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// Stable per-run-input hash (not Math.random()) so re-running the seed
// against records it's about to skip anyway never changes previously
// generated answers, and so a given system's demo data doesn't shuffle
// every time this file is edited elsewhere.
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
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

// Dimension 1 covers whichever questions are actually active — not just the
// 4 shipped defaults — so this still answers every question even if the
// questionnaire's been customized. Known default keys get a spec-driven
// answer; anything else gets whichever option scores 0 (the safe answer),
// so a custom question the spec doesn't know about still ends up answered
// rather than left blank.
function buildD1Answers(dimension1Questions: Question[], gates: AssessmentGates): Record<string, string> {
  const KNOWN: Record<string, boolean> = {
    d1_customer_facing: gates.customerFacing,
    d1_regulated_decisions: gates.regulatedDecisions,
    d1_vendor_training_data: gates.vendorTrainingData,
    d1_full_autonomy: gates.fullAutonomy,
  };
  const answers: Record<string, string> = {};
  for (const q of dimension1Questions) {
    if (q.id in KNOWN) {
      answers[q.id] = KNOWN[q.id] ? "Yes" : "No";
    } else {
      const safeOption = q.options.find((o) => o.points === 0) ?? q.options[0];
      answers[q.id] = safeOption.label;
    }
  }
  return answers;
}

const RATING_ORDER = ["Low", "Moderate", "High", "Critical"] as const;
type Rating = (typeof RATING_ORDER)[number];

// Biases each question's Yes/No/N/A toward the work paper's target
// composite rating, so a "Critical" work paper's answers read differently
// from a "Low" one — deterministic per system+question.
function pickAnswer(seedKey: string, rating: Rating): "Yes" | "No" | "N/A" {
  const h = hash(seedKey) % 100;
  if (h < 5) return "N/A";
  const riskyChance = { Low: 10, Moderate: 30, High: 55, Critical: 75 }[rating];
  return h - 5 < riskyChance ? "Yes" : "No";
}

function evidenceNote(answer: "Yes" | "No" | "N/A", systemName: string): string {
  if (answer === "N/A") return "Not applicable to this use case's current configuration.";
  if (answer === "Yes") return `Confirmed during review of ${systemName}'s documentation and configuration.`;
  return `No evidence of this found during review of ${systemName}'s documentation and configuration.`;
}

// 70% of sections match the work paper's overall rating, the rest land one
// band on either side — enough variation that every section isn't
// identically rated, without needing per-question risk semantics this
// script has no way to know generically.
function pickSectionRating(seedKey: string, overall: Rating): Rating {
  const idx = RATING_ORDER.indexOf(overall);
  const h = hash(seedKey) % 100;
  let newIdx = idx;
  if (h >= 70 && h < 85) newIdx = Math.max(0, idx - 1);
  else if (h >= 85) newIdx = Math.min(RATING_ORDER.length - 1, idx + 1);
  return RATING_ORDER[newIdx];
}

function sectionSummary(rating: Rating, sectionTitle: string) {
  return {
    findings: `Reviewed all in-scope questions for ${sectionTitle}; overall risk assessed as ${rating.toLowerCase()}.`,
    identifiedRisks:
      rating === "Low" ? "No material risks identified." : `Risk exposure consistent with a ${rating.toLowerCase()} rating; see individual question notes.`,
    mitigatingControls: rating === "Low" ? "Standard controls in place are sufficient." : "Existing controls partially mitigate the identified risk.",
    requiredActions:
      rating === "Critical" || rating === "High" ? "Follow-up remediation tracked per the work paper's overall recommendation." : "None required at this time.",
    riskRating: rating,
  };
}

interface GeneratedWorkPaperContent {
  answers: string;
  questionNotes: string;
  sectionData: string;
}

// Fully answers every in-scope question/section — what a genuinely
// completed work paper looks like.
async function populateCompleteWorkPaper(
  systemId: string,
  systemName: string,
  functionKey: string,
  rating: Rating,
  deliveryModel: string,
  capabilityTier: string,
  riskFactors: number[]
): Promise<GeneratedWorkPaperContent> {
  const sections = await getInScopeSections(functionKey, deliveryModel, capabilityTier, riskFactors);
  const answers: Record<string, string> = {};
  const questionNotes: Record<string, string> = {};
  const sectionData: Record<string, ReturnType<typeof sectionSummary>> = {};
  for (const section of sections) {
    for (const q of section.questions) {
      const a = pickAnswer(`${systemId}:${q.id}`, rating);
      answers[q.id] = a;
      questionNotes[q.id] = evidenceNote(a, systemName);
    }
    sectionData[section.id] = sectionSummary(pickSectionRating(`${systemId}:${section.id}`, rating), section.title);
  }
  return { answers: JSON.stringify(answers), questionNotes: JSON.stringify(questionNotes), sectionData: JSON.stringify(sectionData) };
}

// Only the first half of in-scope sections answered — a work paper that's
// genuinely mid-review, feeding the reviewer "open work papers" queue with
// something that looks like real partial progress rather than an empty shell.
async function populateInProgressWorkPaper(
  systemId: string,
  systemName: string,
  functionKey: string,
  rating: Rating,
  deliveryModel: string,
  capabilityTier: string,
  riskFactors: number[]
): Promise<GeneratedWorkPaperContent> {
  const sections = await getInScopeSections(functionKey, deliveryModel, capabilityTier, riskFactors);
  const cutoff = Math.max(1, Math.ceil(sections.length / 2));
  const answers: Record<string, string> = {};
  const questionNotes: Record<string, string> = {};
  const sectionData: Record<string, ReturnType<typeof sectionSummary>> = {};
  for (const section of sections.slice(0, cutoff)) {
    for (const q of section.questions) {
      const a = pickAnswer(`${systemId}:${q.id}`, rating);
      answers[q.id] = a;
      questionNotes[q.id] = evidenceNote(a, systemName);
    }
    sectionData[section.id] = sectionSummary(pickSectionRating(`${systemId}:${section.id}`, rating), section.title);
  }
  return { answers: JSON.stringify(answers), questionNotes: JSON.stringify(questionNotes), sectionData: JSON.stringify(sectionData) };
}

interface WorkPaperSpec {
  functionKey: "INFOSEC" | "MRM" | "COMPLIANCE" | "FIU" | "PRIVACY";
  compositeRiskRating: Rating;
  overallRecommendation: "NO_OBJECTION" | "APPROVE_WITH_CONDITIONS" | "OBJECTION" | "DEFERRED";
  // Defaults to COMPLETE. IN_PROGRESS/NOT_STARTED let a use case show real
  // mid-review state instead of every work paper always being finished.
  status?: "COMPLETE" | "IN_PROGRESS" | "NOT_STARTED";
}

// The 4 shipped Dimension 1 questions, expressed as booleans per use case
// rather than one flattened "triggerYes" — lets each use case's answers
// actually reflect its own narrative (e.g. a loan copilot used BY loan
// officers isn't "customer-facing" even though it affects customers).
interface AssessmentGates {
  customerFacing: boolean;
  regulatedDecisions: boolean;
  vendorTrainingData: boolean;
  fullAutonomy: boolean;
}

interface AssessmentSpec extends AssessmentGates {
  targetAvgPoints: 1 | 3 | 5;
  deliveryModel: string;
  capabilityTier: string;
  riskFactors: number[];
  finalizedDaysAgo: number;
}

interface CommitteeSpec {
  finalDisposition: "APPROVED" | "APPROVED_WITH_CONDITIONS" | "NOT_APPROVED" | "DEFERRED" | "REMANDED";
  decisionJustification: string;
  finalizedDaysAgo: number;
  // When true, the approval chain this creates is marked fully APPROVED
  // (for systems already past approval); when false/omitted, the chain is
  // left PENDING — a real "action needed" item on the system's own
  // Approval Chain tab.
  approvalDecided?: boolean;
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
  assessment?: AssessmentSpec;
  workPapers?: WorkPaperSpec[];
  committee?: CommitteeSpec;
  // A committee that's met and leans a direction but hasn't finalized —
  // populates the reviewer "ready committee reviews" queue with something
  // real instead of every committee being either absent or finalized.
  draftCommitteeDisposition?: CommitteeSpec["finalDisposition"];
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
    assessment: {
      targetAvgPoints: 5,
      customerFacing: false,
      regulatedDecisions: true,
      vendorTrainingData: false,
      fullAutonomy: false,
      deliveryModel: "D3",
      capabilityTier: "T3",
      riskFactors: [1, 2, 10],
      finalizedDaysAgo: 160,
    },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
      { functionKey: "MRM", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
      { functionKey: "COMPLIANCE", compositeRiskRating: "Critical", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
      { functionKey: "PRIVACY", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "FIU", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
    ],
    committee: {
      finalDisposition: "APPROVED_WITH_CONDITIONS",
      decisionJustification: "Approved with quarterly fair-lending monitoring and enhanced underwriter override logging.",
      finalizedDaysAgo: 150,
      approvalDecided: true,
    },
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
    assessment: {
      targetAvgPoints: 5,
      customerFacing: false,
      regulatedDecisions: true,
      vendorTrainingData: false,
      fullAutonomy: false,
      deliveryModel: "D4",
      capabilityTier: "T3",
      riskFactors: [1, 5, 10],
      finalizedDaysAgo: 200,
    },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
      { functionKey: "COMPLIANCE", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
      { functionKey: "FIU", compositeRiskRating: "Critical", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
      { functionKey: "PRIVACY", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
    ],
    committee: {
      finalDisposition: "APPROVED_WITH_CONDITIONS",
      decisionJustification: "Approved with monthly model drift review by MRM and quarterly FIU false-positive rate reporting.",
      finalizedDaysAgo: 190,
      approvalDecided: true,
    },
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
    assessment: {
      targetAvgPoints: 3,
      customerFacing: true,
      regulatedDecisions: false,
      vendorTrainingData: false,
      fullAutonomy: false,
      deliveryModel: "D3",
      capabilityTier: "T2",
      riskFactors: [1, 2, 7],
      finalizedDaysAgo: 130,
    },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "COMPLIANCE", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "PRIVACY", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
    ],
    committee: {
      finalDisposition: "APPROVED",
      decisionJustification: "Low incremental risk given existing vendor due diligence; approved as-is.",
      finalizedDaysAgo: 120,
      approvalDecided: true,
    },
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
    assessment: {
      targetAvgPoints: 1,
      customerFacing: false,
      regulatedDecisions: false,
      vendorTrainingData: false,
      fullAutonomy: false,
      // New, distinctly-named vendor product — not an existing vendor
      // relationship's feature activation.
      deliveryModel: "D3",
      capabilityTier: "T1",
      riskFactors: [3],
      finalizedDaysAgo: 85,
    },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Low", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "Low", overallRecommendation: "NO_OBJECTION" },
    ],
    committee: {
      finalDisposition: "APPROVED",
      decisionJustification: "Minimal risk, internal-only use, no customer or regulated data.",
      finalizedDaysAgo: 75,
      approvalDecided: true,
    },
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
    assessment: {
      targetAvgPoints: 3,
      customerFacing: false,
      regulatedDecisions: false,
      vendorTrainingData: false,
      fullAutonomy: false,
      deliveryModel: "D4",
      capabilityTier: "T2",
      riskFactors: [3],
      finalizedDaysAgo: 30,
    },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
    ],
    // Committee has decided, but the approval chain hasn't been acted on
    // yet — a real pending item on this system's own Approval Chain tab.
    committee: {
      finalDisposition: "APPROVED_WITH_CONDITIONS",
      decisionJustification: "Approved with a requirement that legal spot-checks 10% of flagged contracts monthly for the first quarter.",
      finalizedDaysAgo: 15,
      approvalDecided: false,
    },
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
    assessment: {
      targetAvgPoints: 3,
      customerFacing: false,
      regulatedDecisions: true,
      vendorTrainingData: false,
      fullAutonomy: false,
      deliveryModel: "D3",
      capabilityTier: "T2",
      riskFactors: [1, 10],
      finalizedDaysAgo: 10,
    },
    // Mid-review on purpose: INFOSEC/MRM done, COMPLIANCE in progress,
    // FIU/PRIVACY not started yet — real work still open for reviewers.
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION", status: "COMPLETE" },
      { functionKey: "MRM", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION", status: "COMPLETE" },
      { functionKey: "COMPLIANCE", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS", status: "IN_PROGRESS" },
      { functionKey: "FIU", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION", status: "NOT_STARTED" },
      { functionKey: "PRIVACY", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION", status: "NOT_STARTED" },
    ],
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
    assessment: {
      targetAvgPoints: 1,
      customerFacing: false,
      regulatedDecisions: false,
      vendorTrainingData: false,
      fullAutonomy: false,
      deliveryModel: "D3",
      capabilityTier: "T1",
      riskFactors: [],
      finalizedDaysAgo: 100,
    },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Low", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "Low", overallRecommendation: "NO_OBJECTION" },
    ],
    committee: {
      finalDisposition: "APPROVED",
      decisionJustification: "No sensitive data, human-reviewed before publication.",
      finalizedDaysAgo: 90,
      approvalDecided: true,
    },
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
    assessment: {
      targetAvgPoints: 3,
      customerFacing: false,
      regulatedDecisions: false,
      vendorTrainingData: false,
      fullAutonomy: false,
      deliveryModel: "D3",
      capabilityTier: "T2",
      riskFactors: [8],
      finalizedDaysAgo: 120,
    },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "Low", overallRecommendation: "NO_OBJECTION" },
    ],
    committee: {
      finalDisposition: "APPROVED",
      decisionJustification: "Standard vendor tool, no production code execution without human review.",
      finalizedDaysAgo: 110,
      approvalDecided: true,
    },
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
    assessment: {
      targetAvgPoints: 5,
      customerFacing: false,
      regulatedDecisions: true,
      vendorTrainingData: false,
      fullAutonomy: true,
      deliveryModel: "D4",
      capabilityTier: "T4",
      riskFactors: [5, 9, 10],
      finalizedDaysAgo: 25,
    },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
      { functionKey: "MRM", compositeRiskRating: "Critical", overallRecommendation: "OBJECTION" },
      { functionKey: "COMPLIANCE", compositeRiskRating: "Critical", overallRecommendation: "OBJECTION" },
      { functionKey: "FIU", compositeRiskRating: "Critical", overallRecommendation: "OBJECTION" },
    ],
    // Committee has met and is leaning against approval given the objections
    // above, but hasn't finalized — a real "ready for committee" queue item.
    draftCommitteeDisposition: "DEFERRED",
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
    assessment: {
      targetAvgPoints: 5,
      customerFacing: false,
      regulatedDecisions: true,
      vendorTrainingData: false,
      fullAutonomy: false,
      deliveryModel: "D4",
      capabilityTier: "T2",
      riskFactors: [1, 10],
      finalizedDaysAgo: 225,
    },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
      { functionKey: "COMPLIANCE", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
      { functionKey: "PRIVACY", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "FIU", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
    ],
    committee: {
      finalDisposition: "APPROVED_WITH_CONDITIONS",
      decisionJustification: "Approved with annual disparate-impact testing requirement.",
      finalizedDaysAgo: 215,
      approvalDecided: true,
    },
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
    assessment: {
      targetAvgPoints: 5,
      customerFacing: false,
      regulatedDecisions: true,
      vendorTrainingData: false,
      fullAutonomy: false,
      deliveryModel: "D3",
      capabilityTier: "T2",
      riskFactors: [10],
      finalizedDaysAgo: 390,
    },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "COMPLIANCE", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
      { functionKey: "FIU", compositeRiskRating: "High", overallRecommendation: "APPROVE_WITH_CONDITIONS" },
    ],
    committee: {
      finalDisposition: "APPROVED_WITH_CONDITIONS",
      decisionJustification: "Approved historically; superseded and retired in favor of a newer platform.",
      finalizedDaysAgo: 380,
      approvalDecided: true,
    },
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
    assessment: {
      targetAvgPoints: 1,
      customerFacing: false,
      regulatedDecisions: false,
      vendorTrainingData: false,
      fullAutonomy: false,
      deliveryModel: "D4",
      capabilityTier: "T3",
      riskFactors: [3],
      finalizedDaysAgo: 50,
    },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Low", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "Low", overallRecommendation: "NO_OBJECTION" },
    ],
    committee: {
      finalDisposition: "APPROVED",
      decisionJustification: "Read-only internal analytics tool, no customer data exposure.",
      finalizedDaysAgo: 40,
      approvalDecided: true,
    },
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
    assessment: {
      targetAvgPoints: 3,
      customerFacing: true,
      regulatedDecisions: false,
      vendorTrainingData: false,
      fullAutonomy: false,
      deliveryModel: "D3",
      capabilityTier: "T2",
      riskFactors: [2],
      finalizedDaysAgo: 65,
    },
    workPapers: [
      { functionKey: "INFOSEC", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "MRM", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
      { functionKey: "COMPLIANCE", compositeRiskRating: "Moderate", overallRecommendation: "NO_OBJECTION" },
    ],
    committee: {
      finalDisposition: "APPROVED",
      decisionJustification: "Informational only, no account access or transactions.",
      finalizedDaysAgo: 55,
      approvalDecided: true,
    },
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
    const compliance = byEmail.get("compliance@example.com")!;
    const admin = byEmail.get("admin@example.com")!;
    const approver = byEmail.get("approver@example.com")!;

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

    if (spec.status !== "DRAFT" && spec.status !== "INTAKE") {
      const intakeCompletedAt = new Date(createdAt.getTime() + 60 * 60 * 1000);
      await prisma.auditLog.create({
        data: {
          entityType: "AiSystem",
          entityId: system.id,
          aiSystemId: system.id,
          action: "INTAKE_COMPLETED",
          actorId: owner.id,
          summary: `Intake completed for system "${system.name}".`,
          timestamp: intakeCompletedAt,
        },
      });
    }

    if (spec.assessment) {
      const { targetAvgPoints, deliveryModel, capabilityTier, riskFactors, finalizedDaysAgo } = spec.assessment;
      const d1Answers = buildD1Answers(dimension1Questions, spec.assessment);
      const answers = { ...d1Answers, ...buildD2Answers(dimension2Questions, targetAvgPoints) };
      const score = computeScore(answers, dimension2Questions);
      const approvalAuthority = scoreToApprovalAuthority(score);
      const reviewTriggered = computeReviewTriggered(answers, dimension1Questions);
      const finalizedAt = daysAgo(finalizedDaysAgo);
      const startedAt = new Date(finalizedAt.getTime() - 2 * 24 * 60 * 60 * 1000);

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
          createdAt: startedAt,
          finalizedAt,
        },
      });

      await prisma.aiSystem.update({
        where: { id: system.id },
        // Mirrors exactly what POST /assessments/:id/finalize sets, so the
        // Dashboard/Registry's denormalized-field queries (currentScore,
        // currentApprovalAuthority, currentReviewTriggered) see the same
        // shape of data a real finalize would have produced.
        data: { currentApprovalAuthority: approvalAuthority, currentScore: score, currentReviewTriggered: reviewTriggered },
      });

      await prisma.auditLog.create({
        data: {
          entityType: "RiskAssessment",
          entityId: system.id,
          aiSystemId: system.id,
          action: "CREATED",
          actorId: owner.id,
          summary: "Started risk assessment v1.",
          timestamp: startedAt,
        },
      });

      const approvalDescription = `${approvalAuthority === "AISC" ? "additional" : "standard"} approval required`;
      await prisma.auditLog.create({
        data: {
          entityType: "RiskAssessment",
          entityId: system.id,
          aiSystemId: system.id,
          action: "FINALIZED",
          actorId: owner.id,
          summary: `Finalized risk assessment v1: ${approvalDescription} (score ${score})${reviewTriggered ? "; flagged for additional review" : ""}.`,
          timestamp: finalizedAt,
        },
      });

      await syncWorkPapersForSystem(system.id, deliveryModel, capabilityTier, riskFactors);

      if (spec.workPapers) {
        for (const wp of spec.workPapers) {
          const wpStatus = wp.status ?? "COMPLETE";
          if (wpStatus === "NOT_STARTED") continue;

          const label = await getFunctionLabel(wp.functionKey);

          if (wpStatus === "COMPLETE") {
            const content = await populateCompleteWorkPaper(system.id, system.name, wp.functionKey, wp.compositeRiskRating, deliveryModel, capabilityTier, riskFactors);
            await prisma.functionWorkPaper.updateMany({
              where: { aiSystemId: system.id, functionKey: wp.functionKey },
              data: {
                status: "COMPLETE",
                ...content,
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

            await prisma.auditLog.create({
              data: {
                entityType: "FunctionWorkPaper",
                entityId: system.id,
                aiSystemId: system.id,
                action: "COMPLETED",
                actorId: compliance.id,
                summary: `Completed the ${label} work paper (composite risk rating: ${wp.compositeRiskRating}).`,
                timestamp: finalizedAt,
              },
            });
          } else {
            // IN_PROGRESS: partially answered, no reviewer/completion yet.
            const content = await populateInProgressWorkPaper(system.id, system.name, wp.functionKey, wp.compositeRiskRating, deliveryModel, capabilityTier, riskFactors);
            await prisma.functionWorkPaper.updateMany({
              where: { aiSystemId: system.id, functionKey: wp.functionKey },
              data: { status: "IN_PROGRESS", ...content, updatedAt: finalizedAt },
            });
          }
        }
      }

      if (spec.committee) {
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

        // Matches the real committee-finalize route: sets nextReviewDue and
        // creates the approval chain for a positive disposition.
        if (spec.committee.finalDisposition === "APPROVED" || spec.committee.finalDisposition === "APPROVED_WITH_CONDITIONS") {
          await prisma.aiSystem.update({
            where: { id: system.id },
            data: { nextReviewDue: new Date(committeeFinalizedAt.getTime() + REASSESSMENT_CADENCE_DAYS * 24 * 60 * 60 * 1000) },
          });

          const steps = await createApprovalSteps(system.id, approvalAuthority);
          if (spec.committee.approvalDecided) {
            const decidedAt = new Date(committeeFinalizedAt.getTime() + 24 * 60 * 60 * 1000);
            for (const step of steps) {
              const stepApprover = step.requiredRole === "ADMIN" ? admin : approver;
              await prisma.approvalStep.update({
                where: { id: step.id },
                data: { status: "APPROVED", approverId: stepApprover.id, actedAt: decidedAt },
              });
              await prisma.auditLog.create({
                data: {
                  entityType: "ApprovalStep",
                  entityId: step.id,
                  aiSystemId: system.id,
                  action: "APPROVAL_STEP_APPROVED",
                  actorId: stepApprover.id,
                  summary: `Approved the "${step.stepType.replace(/_/g, " ")}" step.`,
                  timestamp: decidedAt,
                },
              });
            }
          }
        }
      } else if (spec.draftCommitteeDisposition) {
        // Met but not finalized — deliberately no audit entry, since the
        // real app only logs a committee action on finalize/reopen.
        await prisma.committeeReview.create({
          data: {
            aiSystemId: system.id,
            status: "DRAFT",
            finalDisposition: spec.draftCommitteeDisposition,
            decisionJustification: "Preliminary — pending final committee sign-off.",
            createdAt: finalizedAt,
            updatedAt: finalizedAt,
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
