import multer from "multer";
import crypto from "node:crypto";
import { mkdir } from "node:fs/promises";
import { uploadDirectory, fileTypes, MAX_FILES, MAX_FILE_SIZE } from "../utils/attachment.utils.js";
import { ApiError } from "../utils/apiError.js";

const storage = multer.diskStorage({
    destination(req, file, cb) {
        mkdir(uploadDirectory, { recursive: true }).then(() => cb(null, uploadDirectory), cb);
    },
    filename(req, file, cb) {
        cb(null, `${crypto.randomUUID()}.${fileTypes[file.mimetype]}`);
    },
});

export const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES, fields: 4, fieldSize: 16000, parts: 10, fieldNameSize: 100 },
    fileFilter(req, file, cb) {
        if (!Object.hasOwn(fileTypes, file.mimetype)) return cb(new ApiError(415, "Unsupported file type"));
        cb(null, true);
    },
});

const receiveFiles = upload.array("attachements", MAX_FILES);
export const taskUpload = (req, res, next) => receiveFiles(req, res, error => {
    if (!error) return next();
    if (error instanceof ApiError || error instanceof multer.MulterError) return next(error);
    if (/Unexpected end|Malformed|Boundary not found/i.test(error.message || "")) return next(new ApiError(400, "Malformed multipart body"));
    next(error);
});
