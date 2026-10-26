import User from "../models/user.models.js";
import { Project } from "../models/project.models.js";
import { Task } from "../models/task.models.js";
import { Subtask } from "../models/subtask.models.js";
import { ApiRespones } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";
import { ProjectMember } from "../models/projectmember.models.js";
import { withProjectWrite, requireProject } from "../utils/project.utils.js";
import {
  attachmentMetadata,
  MAX_FILES,
  queueAttachmentDeletion,
  drainAttachmentDeletions,
} from "../utils/attachment.utils.js";

const taskRoles = [UserRolesEnum.ADMIN, UserRolesEnum.PROJECT_ADMIN];
const validateAssignee = async (assignedTo, projectId, session) => {
  if (!assignedTo) return;
  const user = await User.exists({ _id: assignedTo }).session(session);
  const projectMember = await ProjectMember.findOne({
    user: assignedTo,
    project: projectId,
  }).session(session);
  if (
    !user ||
    !projectMember ||
    !AvailableUserRole.includes(projectMember.role)
  ) {
    throw new ApiError(
      422,
      "Assignee must be an existing member of this project",
    );
  }
};

const getTasks = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "project not found");
  }

  const tasks = await Task.find({
    project: new mongoose.Types.ObjectId(projectId),
  }).populate("assignedTo", "avatar.url username fullName");

  return res
    .status(200)
    .json(new ApiRespones(200, tasks, "task fetched successfully"));
});

const createTask = asyncHandler(async (req, res) => {
  const { title, description, assignedTo, status } = req.body;
  const { projectId } = req.params;
  const files = req.files || [];
  const attachements = await attachmentMetadata(files);
  const task = await withProjectWrite(req, taskRoles, async (session) => {
    await validateAssignee(assignedTo, projectId, session);
    const [task] = await Task.create(
      [
        {
          title,
          description,
          project: projectId,
          assignedTo: assignedTo || undefined,
          status,
          assignedBy: req.user._id,
          attachements,
        },
      ],
      { session },
    );
    return task;
  });
  req.files = []; // Ownership passed to the committed task.

  return res
    .status(201)
    .json(new ApiRespones(201, task, "task created successfully"));
});

const getTaskById = asyncHandler(async (req, res) => {
  const { taskId, projectId } = req.params;
  await requireProject(projectId);
  const task = await Task.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(taskId),
        project: new mongoose.Types.ObjectId(projectId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "assignedTo",
        foreignField: "_id",
        as: "assignedTo",
        pipeline: [
          {
            $project: {
              _id: 1,
              username: 1,
              fullName: 1,
              "avatar.url": 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "subtasks",
        localField: "_id",
        foreignField: "task",
        as: "subtasks",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "createdBy",
              foreignField: "_id",
              as: "createdBy",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    "avatar.url": 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              createdBy: {
                $arrayElemAt: ["$createdBy", 0],
              },
            },
          },
        ],
      },
    },
    {
      $addFields: {
        assignedTo: {
          $arrayElemAt: ["$assignedTo", 0],
        },
      },
    },
  ]);

  if (!task || task.length == 0) {
    throw new ApiError(404, "task not found");
  }

  return res
    .status(200)
    .json(new ApiRespones(200, task[0], "task fetched successfully"));
});

const updateTask = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  const { title, description, assignedTo, status } = req.body;
  const attachements = await attachmentMetadata(req.files || []);
  const task = await withProjectWrite(req, taskRoles, async (session) => {
    const task = await Task.findOne({
      _id: taskId,
      project: projectId,
    }).session(session);
    if (!task) throw new ApiError(404, "task not found");
    await validateAssignee(assignedTo, projectId, session);
    if (task.attachements.length + attachements.length > MAX_FILES)
      throw new ApiError(
        422,
        `A task supports at most ${MAX_FILES} attachments`,
      );
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;
    if (assignedTo !== undefined) {
      task.assignedTo = assignedTo === null ? undefined : assignedTo;
      task.assignedBy = req.user._id;
    }
    task.attachements.push(...attachements);
    await task.save({ session });
    return task;
  });
  req.files = [];
  return res
    .status(200)
    .json(new ApiRespones(200, task, "task updated successfully"));
});

const deleteTask = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  const task = await withProjectWrite(req, taskRoles, async (session) => {
    const task = await Task.findOne({
      _id: taskId,
      project: projectId,
    }).session(session);
    if (!task) throw new ApiError(404, "task not found");
    await queueAttachmentDeletion(task.attachements, session);
    await Subtask.deleteMany({ task: taskId }, { session });
    await Task.deleteOne({ _id: taskId, project: projectId }, { session });
    return task;
  });
  await drainAttachmentDeletions().catch(() => {});
  return res
    .status(200)
    .json(new ApiRespones(200, task, "task deleted successfully"));
});

const createSubTask = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  const { title } = req.body;
  const subtask = await withProjectWrite(req, taskRoles, async (session) => {
    if (
      !(await Task.exists({ _id: taskId, project: projectId }).session(session))
    )
      throw new ApiError(404, "task not found");
    const [subtask] = await Subtask.create(
      [{ title, task: taskId, createdBy: req.user._id }],
      { session },
    );
    return subtask;
  });
  return res
    .status(201)
    .json(new ApiRespones(201, subtask, "subtask created successfully"));
});

const UpdateSubTask = asyncHandler(async (req, res) => {
  const { projectId, subTaskId } = req.params;
  const { title, isCompleted } = req.body;
  const subtask = await withProjectWrite(
    req,
    AvailableUserRole,
    async (session) => {
      if (title !== undefined && req.user.role === UserRolesEnum.MEMBER)
        throw new ApiError(403, "Members may update subtask completion only");
      const subtask = await Subtask.findById(subTaskId).session(session);
      if (
        !subtask ||
        !(await Task.exists({ _id: subtask.task, project: projectId }).session(
          session,
        ))
      )
        throw new ApiError(404, "subtask not found");
      if (title !== undefined) subtask.title = title;
      if (isCompleted !== undefined) subtask.isCompleted = isCompleted;
      await subtask.save({ session });
      return subtask;
    },
  );
  return res
    .status(200)
    .json(new ApiRespones(200, subtask, "subtask updated successfully"));
});

const deleteSubTask = asyncHandler(async (req, res) => {
  const { projectId, subTaskId } = req.params;
  const subtask = await withProjectWrite(req, taskRoles, async (session) => {
    const subtask = await Subtask.findById(subTaskId).session(session);
    if (
      !subtask ||
      !(await Task.exists({ _id: subtask.task, project: projectId }).session(
        session,
      ))
    )
      throw new ApiError(404, "subtask not found");
    await Subtask.deleteOne({ _id: subTaskId }, { session });
    return subtask;
  });
  return res
    .status(200)
    .json(new ApiRespones(200, subtask, "subtask deleted successfully"));
});

export {
  getTasks,
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
  createSubTask,
  UpdateSubTask,
  deleteSubTask,
};
