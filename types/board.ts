export type Priority = "P0" | "P1" | "P2" | "P3";

export type ApprovalStatus =
  | "not_requested"
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

export type ExecutionMode = "plan_only" | "local_agent" | "ci_runner";

export type NetworkAccess = "none" | "allowlisted" | "full";

export type SecretAccess = "none" | "allowlisted";

export type TeamRole = "owner" | "member";

export type TeamPayload = {
  id: string;
  name: string;
  role: TeamRole;
};

export type BoardColumn = {
  id: string;
  title: string;
  order: number;
  agentStage: string;
  wipLimit: number | null;
};

export type AcceptanceCriterion = {
  text: string;
  done: boolean;
};

export type AutomationHook = {
  name: string;
  enabled: boolean;
};

export type ExecutionApproval = {
  status: ApprovalStatus;
  executionMode: ExecutionMode;
  requestedBy: string;
  requestedAt: string | null;
  approvedBy: string;
  approvedAt: string | null;
  rejectedBy: string;
  rejectedAt: string | null;
  rejectionReason: string;
  allowedWorkspace: string;
  allowedFileGlobs: string[];
  allowedCommands: string[];
  networkAccess: NetworkAccess;
  secretAccess: SecretAccess;
  approvalNonce: string;
  planSummary: string;
  promptInjectionReview: string;
  resultSummary: string;
};

export type Ticket = {
  id: string;
  publicId: string;
  apiId: string;
  title: string;
  description: string;
  columnId: string;
  order: number;
  priority: Priority;
  agent: string;
  objective: string;
  acceptanceCriteria: AcceptanceCriterion[];
  agentNotes: string;
  automationHooks: AutomationHook[];
  executionApproval: ExecutionApproval;
  attachmentsCount: number;
  labels: string[];
  updatedAt: string;
};

export type AttachmentPayload = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  source: "human" | "agent";
  uploadedBy: string;
  approvalNonce: string;
  createdAt: string;
};

export type BoardPayload = {
  id: string;
  title: string;
  columns: BoardColumn[];
  tickets: Ticket[];
};
