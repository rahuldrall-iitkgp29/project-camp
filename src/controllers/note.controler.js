import { ProjectNote } from "../models/note.models.js";
import { ApiRespones } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { UserRolesEnum } from "../utils/constants.js";
import { withProjectWrite, requireProject } from "../utils/project.utils.js";

const getNotes = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  await requireProject(projectId);
  const notes = await ProjectNote.find({ project: projectId }).populate(
    "createdBy",
    "avatar.url username fullName",
  );
  return res
    .status(200)
    .json(new ApiRespones(200, notes, "notes fetched successfully"));
});

const getNoteById = asyncHandler(async (req, res) => {
  const { projectId, noteId } = req.params;
  await requireProject(projectId);
  const note = await ProjectNote.findOne({
    _id: noteId,
    project: projectId,
  }).populate("createdBy", "avatar.url username fullName");
  if (!note) throw new ApiError(404, "note not found");
  return res
    .status(200)
    .json(new ApiRespones(200, note, "note fetched successfully"));
});

const createNote = asyncHandler(async (req, res) => {
  const note = await withProjectWrite(
    req,
    [UserRolesEnum.ADMIN],
    async (session) => {
      const [note] = await ProjectNote.create(
        [
          {
            project: req.params.projectId,
            createdBy: req.user._id,
            content: req.body.content,
          },
        ],
        { session },
      );
      return note;
    },
  );
  return res
    .status(201)
    .json(new ApiRespones(201, note, "note created successfully"));
});

const updateNote = asyncHandler(async (req, res) => {
  const note = await withProjectWrite(
    req,
    [UserRolesEnum.ADMIN],
    async (session) => {
      const note = await ProjectNote.findOneAndUpdate(
        { _id: req.params.noteId, project: req.params.projectId },
        { $set: { content: req.body.content } },
        { returnDocument: "after", runValidators: true, session },
      );
      if (!note) throw new ApiError(404, "note not found");
      return note;
    },
  );
  return res
    .status(200)
    .json(new ApiRespones(200, note, "note updated successfully"));
});

const deleteNote = asyncHandler(async (req, res) => {
  const note = await withProjectWrite(
    req,
    [UserRolesEnum.ADMIN],
    async (session) => {
      const note = await ProjectNote.findOneAndDelete(
        { _id: req.params.noteId, project: req.params.projectId },
        { session },
      );
      if (!note) throw new ApiError(404, "note not found");
      return note;
    },
  );
  return res
    .status(200)
    .json(new ApiRespones(200, note, "note deleted successfully"));
});

export { getNotes, getNoteById, createNote, updateNote, deleteNote };
