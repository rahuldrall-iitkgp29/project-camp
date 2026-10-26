import mongoose, { Schema } from "mongoose";
import { AvailableUserRole } from "../utils/constants.js";

const projectInvitationSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    email: { type: String, required: true, trim: true },
    role: { type: String, enum: AvailableUserRole, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "user", required: true },
    tokenHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

projectInvitationSchema.index({ project: 1, email: 1 }, { unique: true });
projectInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const ProjectInvitation = mongoose.model(
  "ProjectInvitation",
  projectInvitationSchema,
);
