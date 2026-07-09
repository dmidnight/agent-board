import { model, models, Schema, Types, type InferSchemaType } from "mongoose";

const AcceptanceCriterionSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    done: { type: Boolean, default: false }
  },
  { _id: false }
);

const AutomationHookSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: false }
  },
  { _id: false }
);

const ExecutionApprovalSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["not_requested", "pending", "approved", "rejected", "expired"],
      default: "not_requested"
    },
    executionMode: {
      type: String,
      enum: ["plan_only", "local_agent", "ci_runner"],
      default: "plan_only"
    },
    requestedBy: { type: String, default: "" },
    requestedAt: { type: Date, default: null },
    approvedBy: { type: String, default: "" },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: String, default: "" },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
    allowedWorkspace: { type: String, default: "" },
    allowedFileGlobs: { type: [String], default: [] },
    allowedCommands: { type: [String], default: [] },
    networkAccess: {
      type: String,
      enum: ["none", "allowlisted", "full"],
      default: "none"
    },
    secretAccess: {
      type: String,
      enum: ["none", "allowlisted"],
      default: "none"
    },
    approvalNonce: { type: String, default: "" },
    planSummary: { type: String, default: "" },
    promptInjectionReview: { type: String, default: "" },
    resultSummary: { type: String, default: "" }
  },
  { _id: false }
);

const ColumnSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
    agentStage: { type: String, default: "human-review" },
    wipLimit: { type: Number, default: null }
  },
  { timestamps: true }
);

const TicketSchema = new Schema(
  {
    publicId: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    repositoryId: { type: Schema.Types.ObjectId, default: null },
    columnId: { type: Schema.Types.ObjectId, required: true },
    order: { type: Number, required: true },
    priority: {
      type: String,
      enum: ["P0", "P1", "P2", "P3"],
      default: "P2"
    },
    agent: { type: String, default: "Unassigned" },
    objective: { type: String, default: "" },
    acceptanceCriteria: { type: [AcceptanceCriterionSchema], default: [] },
    agentNotes: { type: String, default: "" },
    automationHooks: { type: [AutomationHookSchema], default: [] },
    executionApproval: { type: ExecutionApprovalSchema, default: () => ({}) },
    attachmentsCount: { type: Number, default: 0 },
    apiId: { type: String, required: true, trim: true },
    labels: { type: [String], default: [] }
  },
  { timestamps: true }
);

const BoardSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      default: null,
      index: true
    },
    title: { type: String, required: true, default: "Agent Board" },
    columns: { type: [ColumnSchema], default: [] },
    tickets: { type: [TicketSchema], default: [] },
    ticketCounter: { type: Number, default: 100 }
  },
  {
    timestamps: true
  }
);

BoardSchema.index({ ownerId: 1, title: 1 });
BoardSchema.index({ teamId: 1, title: 1 });

export type BoardDocument = InferSchemaType<typeof BoardSchema>;

export const Board = models.Board || model("Board", BoardSchema);

export function createObjectId() {
  return new Types.ObjectId();
}
