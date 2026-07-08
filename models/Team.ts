import { model, models, Schema, type InferSchemaType } from "mongoose";

export type TeamRole = "owner" | "member";

const TeamMemberSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    role: {
      type: String,
      enum: ["owner", "member"],
      required: true,
      default: "member"
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const TeamInvitationSchema = new Schema(
  {
    tokenHash: {
      type: String,
      required: true
    },
    invitedEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: ""
    },
    role: {
      type: String,
      enum: ["member"],
      required: true,
      default: "member"
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    acceptedAt: {
      type: Date,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const TeamSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80
    },
    nameKey: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    members: {
      type: [TeamMemberSchema],
      default: []
    },
    invitations: {
      type: [TeamInvitationSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

TeamSchema.index({ nameKey: 1 }, { unique: true });
TeamSchema.index({ "members.userId": 1 });
TeamSchema.index({ "invitations.tokenHash": 1 });

export type TeamDocument = InferSchemaType<typeof TeamSchema>;

export const Team = models.Team || model("Team", TeamSchema);
