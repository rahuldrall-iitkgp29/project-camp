import User from "../models/user.models.js";
import { Project } from "../models/project.models.js";
import { ProjectMember } from "../models/projectmember.models.js";
import { ApiRespones} from "../utils/apiResponse.js"
import { Task } from "../models/task.models.js";
import { Subtask } from "../models/subtask.models.js";
import { ProjectNote } from "../models/note.models.js";
import { ApiError } from "../utils/apiError.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import mongoose from "mongoose";
import {AvailableUserRole , UserRolesEnum} from "../utils/constants.js";
import crypto from "node:crypto";
import { ProjectInvitation } from "../models/projectInvitation.models.js";
import { runTransaction, withProjectWrite } from "../utils/project.utils.js";
import { queueAttachmentDeletion, drainAttachmentDeletions } from "../utils/attachment.utils.js";
import { sendingEmail } from "../utils/mail.utils.js";

// so now our auth work is done , means our user is already logged in 
// means we can fetch any req data from req.user , whenever we want

const getProjects = asyncHandler(async(req,res) => {
    const projects = await ProjectMember.aggregate([ // aggregation pipeline
        {
            $match : {
                user : new mongoose.Types.ObjectId(req.user._id), //to find all the user with that id(getting all the project)
            },
        },
        {
            $lookup : {
                from : "projects",
                localField : "project",
                foreignField : "_id",
                as : "project",
                pipeline : [ //we are adding further pipeline in those selected document only
                    {
                        $lookup : {
                            from : "projectmembers",
                            localField : "_id",
                            foreignField : "project",
                            as : "projectmembers"
                        }
                    },
                    {
                        $addFields : {
                            members : {
                                $size : "$projectmembers"
                            }
                        }
                    }
                ]
            },
        },
        {
            $unwind : "$project"
        },
        {
            $project : {
                project : {
                    _id : 1,
                    name : 1,
                    description : 1,
                    members : 1,
                    createdAt : 1,
                    createdBy : 1
                },
                role : 1,
                _id : 0
            }
        }
    ]);

    return res.status(200).json(new ApiRespones(200 , projects , "project fetch successfully"))
})

const getProjectById = asyncHandler(async(req,res) => {
    const {projectId} = req.params
    const project = await Project.findById(projectId)

    if(!project){
        throw new ApiError(404 , "project not found");
    }

    return res
        .status(200)
        .json(new ApiRespones(200 , project , "project fetched successfully"));
})

const createProject = asyncHandler(async(req,res) => {
    const {name , description} = req.body ; // we fetch name and desc of project from frontend
    const project = await runTransaction(async (session) => {
        const [project] = await Project.create([{ name, description, createdBy: req.user._id }], { session });
        await ProjectMember.create([{ user: req.user._id, project: project._id, role: UserRolesEnum.ADMIN }], { session });
        return project;
    });

    return res 
            .status(201)
            .json(
                new ApiRespones(
                    201,
                    project,
                    "Project Created Successfully"
                )
            )
})

const updateProject = asyncHandler(async(req,res) => {
    const {name , description} = req.body
    const {projectId} = req.params 

    const project = await withProjectWrite(req, [UserRolesEnum.ADMIN], async (session) =>
        Project.findByIdAndUpdate(projectId, { $set: {
            ...(name !== undefined ? { name } : {}),
            ...(description !== undefined ? { description } : {}),
        } }, { returnDocument: "after", runValidators: true, session })
    );

    if(!project){
        throw new ApiError(404 , "project not found")
    }
    return res 
            .status(200)
            .json(
                new ApiRespones(
                    200,
                    project,
                    "project updated successfully"
                )
            )
})

const deleteProject = asyncHandler(async(req,res) => {
    const {projectId} = req.params

    const project = await withProjectWrite(req, [UserRolesEnum.ADMIN], async (session, project) => {
        const tasks = await Task.find({ project: projectId }).session(session);
        const taskIds = tasks.map(t => t._id);
        await queueAttachmentDeletion(tasks.flatMap(t => t.attachements), session);
        await Subtask.deleteMany({ task: { $in: taskIds } }, { session });
        await Task.deleteMany({ project: projectId }, { session });
        await ProjectNote.deleteMany({ project: projectId }, { session });
        await ProjectInvitation.deleteMany({ project: projectId }, { session });
        await ProjectMember.deleteMany({ project: projectId }, { session });
        await Project.deleteOne({ _id: projectId }, { session });
        return project;
    });
    await drainAttachmentDeletions().catch(() => {}); // Committed jobs remain retryable.

    return res 
            .status(200)
            .json(
                new ApiRespones(
                    200,
                    project,
                    "project deleted successfully"
                )
            )
})

const addMemberToProject = asyncHandler(async(req,res) => {
    const {email , role} = req.body
    const {projectId} = req.params
    const token = crypto.randomBytes(20).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    let invitationUrl;
    try {
        invitationUrl = new URL(process.env.PROJECT_INVITATION_REDIRECT_URL || process.env.SERVER_URL);
        if (!["http:", "https:"].includes(invitationUrl.protocol) || invitationUrl.username || invitationUrl.password || invitationUrl.search || invitationUrl.hash) throw new Error();
        invitationUrl.pathname = process.env.PROJECT_INVITATION_REDIRECT_URL
            ? `${invitationUrl.pathname.replace(/\/$/, "")}/${projectId}/${token}`
            : `/api/v1/projects/${projectId}/invitations/${token}/accept`;
    } catch { throw new ApiError(500, "Invitation URL is not configured correctly"); }
    const invitation = await withProjectWrite(req, [UserRolesEnum.ADMIN], async (session) => {
        const user = await User.findOne({ email }).session(session);
        if (user && await ProjectMember.exists({ user: user._id, project: projectId }).session(session)) {
            throw new ApiError(409, "User is already a project member; use the role update endpoint");
        }
        return ProjectInvitation.findOneAndUpdate({ project: projectId, email }, { $set: {
            role, tokenHash, invitedBy: req.user._id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        } }, { upsert: true, runValidators: true, returnDocument: "after", session });
    });
    await sendingEmail({ email, subject: "Project Camp invitation", mailgenContent: { body: {
        intro: "You have been invited to a Project Camp project. Register or log in and verify this email address before accepting.",
        action: { instructions: "Open the invitation in your client to accept. API clients submit an authenticated POST to the acceptance URL.",
            button: { color: "#22BC66", text: "Project invitation", link: invitationUrl.toString() } },
    } } });
    return res.status(201).json(new ApiRespones(201, {
        invitation: { email, role, project: projectId, expiresAt: invitation.expiresAt, status: "pending" },
    }, "Project invitation sent; acceptance required"));
})

const acceptProjectInvitation = asyncHandler(async (req, res) => {
    const { projectId, invitationToken } = req.params;
    const tokenHash = crypto.createHash("sha256").update(invitationToken).digest("hex");
    const projectMember = await withProjectWrite(req, null, async (session) => {
        const invitation = await ProjectInvitation.findOne({ project: projectId, tokenHash,
            email: req.user.email, expiresAt: { $gt: new Date() } }).session(session);
        if (!invitation) throw new ApiError(400, "Invalid or expired invitation");
        if (await ProjectMember.exists({ project: projectId, user: req.user._id }).session(session)) {
            throw new ApiError(409, "You are already a project member");
        }
        const [projectMember] = await ProjectMember.create([{ project: projectId, user: req.user._id, role: invitation.role }], { session });
        await ProjectInvitation.deleteOne({ _id: invitation._id }, { session });
        return projectMember;
    });
    return res.status(200).json(new ApiRespones(200, projectMember, "Project invitation accepted"));
});

const requireRemainingAdmin = async (projectId, projectMember, newRole, session) => {
    if (projectMember.role === UserRolesEnum.ADMIN && newRole !== UserRolesEnum.ADMIN
        && await ProjectMember.countDocuments({ project: projectId, role: UserRolesEnum.ADMIN }).session(session) <= 1) {
        throw new ApiError(409, "A project must retain at least one Admin");
    }
};

const getsProjectMembers = asyncHandler(async(req,res) => {
    const {projectId} = req.params
    const project = await Project.findById(projectId)

    if(!project){
        throw new ApiError(404,"project not found")
    }

    const projectmembers = await ProjectMember.aggregate([
        {
            $match : {
                project : new mongoose.Types.ObjectId(projectId),
            },
        },
        {
            $lookup : {
                from : "users",
                localField : "user",
                foreignField : "_id",
                as : "user",
                pipeline: [
                    {
                        $project : {
                            _id : 1,
                            username : 1,
                            fullName : 1,
                            "avatar.url" : 1
                        },
                    },
                ],
            },
        },
        {
            $addFields : {
                user : {
                    $arrayElemAt : ["$user" , 0]
                }
            }
        },
        {
            $project : {
                project : 1,
                user : 1,
                role : 1,
                createdAt : 1,
                updatedAt : 1,
                _id : 0
            }
        }
    ])

    return res.status(200).json(new ApiRespones(200,projectmembers,"project members fetched"))
})

const updateMemberRole = asyncHandler(async(req,res) => {
    const {projectId , userId} = req.params
    const {newRole} = req.body

    if(!AvailableUserRole.includes(newRole)){
        throw new ApiError(400 ,"role not found/invalid role")
    }

    const projectMember = await withProjectWrite(req, [UserRolesEnum.ADMIN], async (session) => {
        const projectMember = await ProjectMember.findOne({ project: projectId, user: userId }).session(session);
        if (!projectMember) throw new ApiError(404, "project member not found");
        await requireRemainingAdmin(projectId, projectMember, newRole, session);
        return ProjectMember.findByIdAndUpdate(projectMember._id, { $set: { role: newRole } },
            { returnDocument: "after", runValidators: true, session });
    });

    return res.status(200).json(new ApiRespones(200,projectMember,"project member role updated"));
})

const deleteMember = asyncHandler(async(req,res) => {
    const { projectId, userId } = req.params;

    const projectMember = await withProjectWrite(req, [UserRolesEnum.ADMIN], async (session) => {
        const projectMember = await ProjectMember.findOne({ project: projectId, user: userId }).session(session);
        if (!projectMember) throw new ApiError(404, "project member not found");
        await requireRemainingAdmin(projectId, projectMember, null, session);
        await Task.updateMany({ project: projectId, assignedTo: userId }, { $unset: { assignedTo: 1 } }, { session });
        await ProjectMember.deleteOne({ _id: projectMember._id }, { session });
        return projectMember;
    });

    return res
      .status(200)
      .json(new ApiRespones(200, projectMember, "project member deleted successfully"));
})


export {
    acceptProjectInvitation,
    addMemberToProject,
    createProject,
    deleteMember,
    getProjects,
    getProjectById,
    getsProjectMembers,
    updateProject,
    deleteProject,
    updateMemberRole,
}
