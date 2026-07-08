import { model, models, Schema, type InferSchemaType } from "mongoose";

const AttachmentSchema = new Schema(
  {
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true
    },
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true
    },
    ticketId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    source: {
      type: String,
      enum: ["human", "agent"],
      required: true,
      default: "human"
    },
    provider: {
      type: String,
      enum: ["s3", "gcs"],
      required: true
    },
    bucket: {
      type: String,
      required: true
    },
    objectKey: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true,
      trim: true
    },
    contentType: {
      type: String,
      required: true,
      default: "application/octet-stream"
    },
    size: {
      type: Number,
      required: true
    },
    checksumSha256: {
      type: String,
      required: true
    },
    approvalNonce: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

AttachmentSchema.index({ teamId: 1, ticketId: 1, createdAt: -1 });
AttachmentSchema.index({ objectKey: 1 }, { unique: true });

export type AttachmentDocument = InferSchemaType<typeof AttachmentSchema>;

export const Attachment =
  models.Attachment || model("Attachment", AttachmentSchema);
