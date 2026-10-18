import mongoose, { Schema } from "mongoose"; 

import {AvailableUserRole , UserRolesEnum} from "../utils/constants.js"

const projectMemberSchema = new Schema({
    user : {
        type : Schema.Types.ObjectId,
        ref : "user",
        required : true, 
    },
    project : {
        type : Schema.Types.ObjectId,
        ref : "Project",
        required : true,
    },
    role : {
        type : String,
        enum : AvailableUserRole,
        default : UserRolesEnum.MEMBER
    }
},{timestamps:true})

projectMemberSchema.index({ project: 1, user: 1 }, { unique: true });
projectMemberSchema.index({ user: 1, project: 1 });
export const ProjectMember = mongoose.model("ProjectMember" , projectMemberSchema);
