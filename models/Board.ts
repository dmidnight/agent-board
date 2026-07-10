import { model, models, Schema, Types, type InferSchemaType } from "mongoose";

const AcceptanceCriterionSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    done: { type: Boolean, default: false }
  },
  { _id: false }
);

const TicketRunApprovalSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["not_requested", "pending", "approved", "rejected", "expired"],
      default: "not_requested"
    },
    requestedBy: { type: String, default: "" },
    requestedAt: { type: Date, default: null },
    approvedBy: { type: String, default: "" },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: String, default: "" },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
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
    order: { type: Number, required: true }
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
    acceptanceCriteria: { type: [AcceptanceCriterionSchema], default: [] },
    runApproval: { type: TicketRunApprovalSchema, default: () => ({}) },
    attachmentsCount: { type: Number, default: 0 },
    apiId: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

const BoardSchema = new Schema(
  {
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true
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

BoardSchema.index({ teamId: 1 }, { unique: true });

export type BoardDocument = InferSchemaType<typeof BoardSchema>;

export const Board = models.Board || model("Board", BoardSchema);

export function createObjectId() {
  return new Types.ObjectId();
}
