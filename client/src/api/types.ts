export type Role = "ADMIN" | "COMPLIANCE_OFFICER" | "SYSTEM_OWNER" | "APPROVER" | "VIEWER";

// References AiTypeOption.key — an org-editable list (see api/aiTypeOptions.ts).
export type AiType = string;

export type SystemStatus =
  | "DRAFT"
  | "INTAKE"
  | "RISK_ASSESSMENT"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "DEPLOYED"
  | "MONITORING"
  | "RETIRED";

export type AssessmentStatus = "DRAFT" | "FINALIZED";

// Dimension 2 approval routing: AIGA may approve below the AISC threshold,
// AISC approval is required at/above it.
export type ApprovalAuthority = "AIGA" | "AISC";

export type DocumentCategory = "SOC_REPORT" | "WHITEPAPER" | "POLICY" | "CONTRACT" | "OTHER";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive?: boolean;
  emailNotificationsEnabled?: boolean;
  createdAt?: string;
}

export interface AiSystem {
  id: string;
  useCaseId: string | null;
  dateSubmitted: string | null;
  name: string;
  description: string;
  capabilityCategory: string | null;
  businessUnit: string;
  aitoCoordinator: string | null;
  sponsorName: string | null;
  ownerId: string;
  owner: { id: string; name: string; email: string };
  applicationName: string | null;
  aiType: AiType;
  vendorName: string | null;
  projectedCost: number | null;
  targetDeploymentDate: string | null;
  purpose: string | null;
  businessJustification: string | null;
  dataTypesUsed: string | null;
  deploymentContext: string | null;
  notes: string | null;
  customFieldValues: string;
  status: SystemStatus;
  currentApprovalAuthority: ApprovalAuthority | null;
  currentScore: number | null;
  currentReviewTriggered: boolean | null;
  nextReviewDue: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiSystemDetail extends AiSystem {
  riskAssessments: RiskAssessment[];
}

export interface RiskAssessment {
  id: string;
  aiSystemId: string;
  version: number;
  status: AssessmentStatus;
  answers: string;
  approvalAuthority: ApprovalAuthority | null;
  reviewTriggered: boolean | null;
  score: number | null;
  deliveryModel: string | null;
  capabilityTier: string | null;
  riskFactors: string | null; // JSON array of RF numbers (1-10)
  assessedById: string;
  assessedBy?: { name: string };
  createdAt: string;
  finalizedAt: string | null;
  // JSON array of the active questions (text/options) at the moment this
  // was finalized. Null for draft assessments or ones finalized before this
  // existed — the report falls back to the live questionnaire in that case.
  questionsSnapshot: string | null;
}

export interface ClassificationOption {
  id: string;
  label: string;
}

export interface RiskFactorOption {
  id: number;
  label: string;
  description: string;
}

export interface ClassificationOptions {
  deliveryModels: ClassificationOption[];
  capabilityTiers: ClassificationOption[];
  riskFactors: RiskFactorOption[];
}

// References ReviewFunctionDef.key — an org-editable list of review teams
// (see api/reviewFunctions.ts), not a fixed set.
export type ReviewFunctionKey = string;

export type WorkPaperStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";

export type SectionRiskRating = "Low" | "Moderate" | "High" | "Critical" | "N/A";
export type CompositeRiskRating = "Low" | "Moderate" | "High" | "Critical";
export type OverallRecommendation = "NO_OBJECTION" | "APPROVE_WITH_CONDITIONS" | "OBJECTION" | "DEFERRED";

export interface SectionData {
  findings?: string;
  identifiedRisks?: string;
  mitigatingControls?: string;
  requiredActions?: string;
  riskRating?: SectionRiskRating;
}

export interface FunctionWorkPaper {
  id: string;
  aiSystemId: string;
  functionKey: ReviewFunctionKey;
  label: string;
  status: WorkPaperStatus;
  answers: string; // JSON: { [questionId]: "Yes" | "No" | "N/A" }
  questionNotes: string; // JSON: { [questionId]: string }
  sectionData: string; // JSON: { [sectionId]: SectionData }
  compositeRiskRating: CompositeRiskRating | null;
  overallRecommendation: OverallRecommendation | null;
  keyFindings: string | null;
  rationale: string | null;
  reviewerName: string | null;
  reviewerTitle: string | null;
  reviewerDate: string | null;
  reviewedById: string | null;
  reviewedBy?: { name: string };
  totalQuestions: number;
  answeredCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface WorkPaperQuestion {
  id: string;
  text: string;
  citation: string;
}

export interface WorkPaperSection {
  id: string;
  title: string;
  triggerLabel: string;
  questions: WorkPaperQuestion[];
}

export interface FunctionWorkPaperDetail extends FunctionWorkPaper {
  sections: WorkPaperSection[];
}

export type CommitteeReviewStatus = "DRAFT" | "FINALIZED";

export type FinalDisposition = "APPROVED" | "APPROVED_WITH_CONDITIONS" | "NOT_APPROVED" | "DEFERRED" | "REMANDED";

export interface CommitteeReviewWorkPaperSummary {
  id: string;
  functionKey: ReviewFunctionKey;
  label: string;
  status: WorkPaperStatus;
  compositeRiskRating: CompositeRiskRating | null;
  overallRecommendation: OverallRecommendation | null;
  reviewerName: string | null;
  reviewedBy?: { name: string };
}

export interface CommitteeReview {
  id: string;
  aiSystemId: string;
  status: CommitteeReviewStatus;
  crossFunctionalConflicts: string | null;
  committeeDiscussion: string | null;
  finalDisposition: FinalDisposition | null;
  decisionJustification: string | null;
  finalizedById: string | null;
  finalizedBy?: { name: string };
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  workPapers: CommitteeReviewWorkPaperSummary[];
}

export interface Document {
  id: string;
  aiSystemId: string;
  category: DocumentCategory;
  description: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  uploadedBy?: { name: string };
  createdAt: string;
}

export interface QuestionOption {
  label: string;
  points: number;
}

export interface Question {
  id: string;
  dimension: 1 | 2;
  order: number;
  text: string;
  helpText: string;
  options: QuestionOption[];
  isActive: boolean;
}

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  aiSystemId: string | null;
  action: string;
  actorId: string;
  actor: { name: string; role: Role };
  summary: string;
  timestamp: string;
}

export interface DashboardData {
  totalSystems: number;
  byStatus: Record<string, number>;
  byRiskRating: Record<string, number>;
  needsAssessmentCount: number;
  needsAssessment: { id: string; name: string; status: SystemStatus; businessUnit: string }[];
  reviewTriggeredCount: number;
  trends: { month: string; registrations: number; avgRiskScore: number | null }[];
}

export type CalendarEventType = "MEETING" | "REASSESSMENT" | "DEPLOYMENT";

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  date: string;
  systemId: string | null;
  systemName: string | null;
  link: string | null;
}

export interface Comment {
  id: string;
  aiSystemId: string;
  authorId: string;
  author: { name: string; role: Role };
  body: string;
  createdAt: string;
  editedAt: string | null;
}

export type PolicyCategory = "POLICY" | "STANDARD" | "PROCEDURE" | "GUIDELINE" | "OTHER";

export interface Policy {
  id: string;
  title: string;
  description: string | null;
  category: PolicyCategory;
  version: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  isActive: boolean;
  uploadedById: string;
  uploadedBy?: { name: string };
  createdAt: string;
  updatedAt: string;
}

export interface Meeting {
  id: string;
  title: string;
  description: string | null;
  date: string;
  aiSystemId: string | null;
  aiSystem: { id: string; name: string } | null;
  createdById: string;
  createdAt: string;
}
