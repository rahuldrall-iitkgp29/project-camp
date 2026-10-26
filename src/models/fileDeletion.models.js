import mongoose, { Schema } from "mongoose";

const fileDeletionSchema = new Schema(
  {
    filename: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export const FileDeletion = mongoose.model("FileDeletion", fileDeletionSchema);
