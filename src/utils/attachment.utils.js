import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFile, unlink } from "node:fs/promises";
import { FileDeletion } from "../models/fileDeletion.models.js";
import { ApiError } from "./apiError.js";

export const uploadDirectory = fileURLToPath(
  new URL("../../public/images/", import.meta.url),
);
export const MAX_FILES = 5;
export const MAX_FILE_SIZE = 1000000;
export const fileTypes = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const safeName = /^[a-f0-9-]{36}\.(?:png|jpg|gif|webp|pdf)$/;
const storedName = (url) => {
  try {
    const pathname = new URL(url).pathname;
    const filename = decodeURIComponent(
      pathname.slice(pathname.lastIndexOf("/") + 1),
    );
    return pathname.includes("/images/") && safeName.test(filename)
      ? filename
      : null;
  } catch {
    return null;
  }
};

const removeFile = async (filename) => {
  if (!safeName.test(filename)) throw new Error("Unsafe stored filename");
  try {
    await unlink(path.join(uploadDirectory, filename));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
};

export const cleanupUploads = async (files = []) => {
  await Promise.all(
    files.map(async (file) => {
      try {
        await removeFile(file.filename);
      } catch (error) {
        if (!safeName.test(file.filename)) throw error;
        await FileDeletion.updateOne(
          { filename: file.filename },
          { $setOnInsert: { filename: file.filename } },
          { upsert: true },
        );
      }
    }),
  );
};

export const attachmentMetadata = async (files = []) => {
  if (!files.length) return [];
  let base;
  try {
    base = new URL(process.env.SERVER_URL);
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    )
      throw new Error();
  } catch {
    throw new ApiError(500, "Public file URL is not configured correctly");
  }
  const attachements = [];
  for (const file of files) {
    const bytes = await readFile(path.join(uploadDirectory, file.filename));
    const matches = {
      "image/png": bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      "image/jpeg": bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
      "image/gif": ["GIF87a", "GIF89a"].includes(
        bytes.subarray(0, 6).toString(),
      ),
      "image/webp":
        bytes.subarray(0, 4).toString() === "RIFF" &&
        bytes.subarray(8, 12).toString() === "WEBP",
      "application/pdf": bytes.subarray(0, 5).toString() === "%PDF-",
    };
    if (!matches[file.mimetype])
      throw new ApiError(415, "File content does not match its MIME type");
    const url = new URL(base);
    url.pathname = `${url.pathname.replace(/\/$/, "")}/images/${encodeURIComponent(file.filename)}`;
    attachements.push({
      url: url.toString(),
      mimeTypes: file.mimetype,
      size: file.size,
    });
  }
  return attachements;
};

export const queueAttachmentDeletion = async (attachements, session) => {
  for (const attachment of attachements) {
    const filename = storedName(attachment.url);
    if (filename)
      await FileDeletion.updateOne(
        { filename },
        { $setOnInsert: { filename } },
        { upsert: true, session },
      );
  }
};

// Persisted jobs are only removed after successful unlink. Safe to retry after crashes.
export const drainAttachmentDeletions = async () => {
  const jobs = await FileDeletion.find().limit(100);
  for (const job of jobs) {
    try {
      await removeFile(job.filename);
      await FileDeletion.deleteOne({ _id: job._id });
    } catch {
      /* Retain the job for the next worker pass. */
    }
  }
};
