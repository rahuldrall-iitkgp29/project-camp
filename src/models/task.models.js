import mongoose, { Schema } from "mongoose"; 

import {AvailableTaskStatus , TaskStatusEnum} from "../utils/constants.js";

const taskSchema = new Schema({
    title : {
        type : String,
        required : true,
        trim : true
    },
    description : String , // shortcut
    project : {
        type : Schema.Types.ObjectId,
        ref : "Project",
        required : true,
    },
    assignedTo : {
        type : Schema.Types.ObjectId,
        ref : "user",
    },
    assignedBy : {
        type : Schema.Types.ObjectId,
        ref : "user",
    },
    status : {
        type : String,
        enum : AvailableTaskStatus,
        default : TaskStatusEnum.TODO
    },
    attachements : {
        type : [{
            url:String,
            mimeTypes : String,
            size : Number 
        }],
        default : []
    }
},
    {timestamps : true},
)

taskSchema.index({ project: 1, assignedTo: 1 });
export const Task = mongoose.model("Task",taskSchema);
