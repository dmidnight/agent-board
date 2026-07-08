import { model, models, Schema, type InferSchemaType } from "mongoose";

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    name: {
      type: String,
      trim: true,
      default: ""
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      default: null,
      index: true
    },
    teamRole: {
      type: String,
      enum: ["owner", "member"],
      default: "member"
    }
  },
  {
    timestamps: true
  }
);

export type UserDocument = InferSchemaType<typeof UserSchema>;

export const User = models.User || model("User", UserSchema);
