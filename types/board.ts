export type Priority = "P0" | "P1" | "P2" | "P3";

export type ApprovalStatus =
  | "not_requested"
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

export type TeamRole = "owner" | "member";

export type TeamRepository = {
  id: string;
  name: string;
  url: string;
};

export type TeamPayload = {
  id: string;
  name: string;
  role: TeamRole;
  repositories: TeamRepository[];
};

export type BoardColumn = {
  id: string;
  title: string;
  order: number;
};

export type AcceptanceCriterion = {
  text: string;
  done: boolean;
};

export type TicketRunApproval = {
  status: ApprovalStatus;
  requestedBy: string;
  requestedAt: string | null;
  approvedBy: string;
  approvedAt: string | null;
  rejectedBy: string;
  rejectedAt: string | null;
  rejectionReason: string;
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
  repositoryId: string | null;
  columnId: string;
  order: number;
  priority: Priority;
  agent: string;
  acceptanceCriteria: AcceptanceCriterion[];
  runApproval: TicketRunApproval;
  attachmentsCount: number;
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
