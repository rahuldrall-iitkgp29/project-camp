import mongoose from "mongoose";
import { Project } from "../models/project.models.js";
import { ProjectMember } from "../models/projectmember.models.js";
import { ApiError } from "./apiError.js";

export const runTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } catch (error) {
    if (error.code === 20 || error.codeName === "IllegalOperation") {
      throw new ApiError(503, "Project writes require a MongoDB replica set with transactions");
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

// Every writer touches the same document before reading membership or children.
// Snapshot isolation alone would otherwise permit deletion/assignment write skew.
export const withProjectWrite = (req, roles, work) => runTransaction(async (session) => {
  const project = await Project.findOneAndUpdate(
    { _id: req.params.projectId },
    { $inc: { __v: 1 } },
    { session, returnDocument: "after", timestamps: false },
  );
  if (!project) throw new ApiError(404, "project not found");
  if (roles) {
    const projectMember = await ProjectMember.findOne({ project: project._id, user: req.user._id }).session(session);
    if (!projectMember || !roles.includes(projectMember.role)) {
      throw new ApiError(403, "You are not allowed to perform this action");
    }
    req.user.role = projectMember.role;
  }
  return work(session, project);
}).catch(error => {
  // An uncertain commit may already reference the files. Keep them until reconciliation.
  if (error.hasErrorLabel?.("UnknownTransactionCommitResult")) {
    req.files = [];
    throw new ApiError(503, "Write outcome is uncertain; check the resource before retrying");
  }
  throw error;
});

export const requireProject = async (projectId) => {
  if (!await Project.exists({ _id: projectId })) throw new ApiError(404, "project not found");
};
