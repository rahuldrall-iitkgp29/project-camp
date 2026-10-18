import mongoose, { Schema } from "mongoose"; 

const projectNotedSchema = new Schema({
    project : {
        type : Schema.Types.ObjectId,
        ref : "Project",
        required : true
    },
    createdBy : {
        type : Schema.Types.ObjectId,
        ref : "user",
        required : true
    },
    content : {
        type : String,
        required : true
    }
} , {timestamps : true});

projectNotedSchema.index({ project: 1 });
export const ProjectNote = mongoose.model("ProjectNote" , projectNotedSchema)
