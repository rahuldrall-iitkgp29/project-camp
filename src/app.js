import express from "express";
import cors from "cors";

import cookieParser from "cookie-parser";
import { ApiError } from "./utils/apiError.js";
import { fileURLToPath } from "node:url";
import { cleanupUploads } from "./utils/attachment.utils.js";
import { constants as zlibConstants } from "node:zlib";

const app = express();

// Keep parser provenance so a database/internal zlib error cannot become a 400.
const requestParsingErrors = new WeakSet();
const brotliFormatErrors = new Set(
  Object.entries(zlibConstants)
    .filter(([name]) => name.startsWith("BROTLI_DECODER_ERROR_FORMAT_"))
    .map(([, value]) => value),
);
const parseBody = (parser) => (req, res, next) =>
  parser(req, res, (error) => {
    if (error) requestParsingErrors.add(error);
    next(error);
  });

app.use(cookieParser()); // now we have access to cookies in our request object and we can set cookies in our response object

// SameSite cookies plus an Origin check protect browser cookie-authenticated writes.
app.use((req, res, next) => {
  const origin = req.get("Origin");
  const allowed = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((value) => value.trim());
  if (
    origin &&
    (req.cookies?.accessToken || req.cookies?.refreshToken) &&
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    !allowed.includes(origin)
  ) {
    return next(
      new ApiError(
        403,
        "Origin is not allowed for cookie-authenticated writes",
      ),
    );
  }
  next();
});

//cors configurations
app.use(
  cors({
    origin:
      process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()) ||
      "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  }),
);

// CORS must also be present on parser-error responses to the approved client.
app.use(parseBody(express.json({ limit: "16kb" })));
app.use(parseBody(express.urlencoded({ extended: true, limit: "16kb" })));

app.use(
  express.static(fileURLToPath(new URL("../public/", import.meta.url)), {
    dotfiles: "deny",
    setHeaders(res) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      res.setHeader("Content-Disposition", "attachment");
    },
  }),
);

// import routes
import healthCheckRouter from "./routes/healthCheck_route.js";
import authRouter from "./routes/auth.route.js";

import projectRouter from "./routes/project.route.js";
import taskRouter from "./routes/task.route.js";
import noteRouter from "./routes/note.route.js";

app.use("/api/v1/healthcheck", healthCheckRouter);
// we just add extra routing to our healthcheck
// from "/" to "/api/v1/healthcheck/" and if add smt further route in router lets say we make an another router there with "/insta" then its become "/api/v1/healthcheck/insta"

app.use("/api/v1/auth", authRouter); //our auth router handler

app.use("/api/v1/projects", projectRouter); //our project router handler
app.use("/api/v1/tasks", taskRouter);
app.use("/api/v1/notes", noteRouter);

app.get("/", (req, res) => {
  res.send("this is the instagram page");
});

app.use((req, res, next) => next(new ApiError(404, "Route not found")));

// centralized error configuration for our app

app.use(async (err, req, res, next) => {
  await cleanupUploads(req.files || []).catch(() => {
    console.error("Uploaded file cleanup failed; disk reconciliation required");
  });
  if (res.headersSent) return next(err);

  let statusCode = err instanceof ApiError ? err.statusCode : 500;
  let message = err instanceof ApiError ? err.message : "Internal server error";
  let errors = err instanceof ApiError ? err.errors : [];

  if (err.name === "MulterError") {
    statusCode = [
      "LIMIT_FILE_SIZE",
      "LIMIT_FILE_COUNT",
      "LIMIT_PART_COUNT",
      "LIMIT_FIELD_COUNT",
      "LIMIT_FIELD_VALUE",
    ].includes(err.code)
      ? 413
      : 400;
    message =
      "Upload exceeds the allowed size/count or uses an unsupported field";
  } else if (err instanceof URIError) {
    statusCode = 400;
    message = "Malformed URL";
  } else if (err.code === 11000) {
    statusCode = 409;
    message = "A record with these details already exists";
  } else if (err.name === "CastError" || err.name === "BSONError") {
    statusCode = 400;
    message = "Invalid identifier or field value";
  } else if (err.name === "ValidationError") {
    statusCode = 422;
    message = "Received data is not valid";
  } else if (err.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Invalid JSON body";
  } else if (err.type === "entity.too.large") {
    statusCode = 413;
    message = "Request body is too large";
  } else if (
    requestParsingErrors.has(err) &&
    ["charset.unsupported", "encoding.unsupported"].includes(err.type)
  ) {
    statusCode = 415;
    message = "Unsupported request charset or content encoding";
  } else if (
    requestParsingErrors.has(err) &&
    err.status === 400 &&
    (["Z_DATA_ERROR", "Z_BUF_ERROR"].includes(err.code) ||
      (req.get("Content-Encoding")?.toLowerCase() === "br" &&
        brotliFormatErrors.has(err.errno)) ||
      ["request.aborted", "request.size.invalid"].includes(err.type))
  ) {
    statusCode = 400;
    message = "Invalid or incomplete request body";
  }

  return res.status(statusCode).json({
    statusCode,
    data: null,
    success: false,
    message,
    errors,
  });
});

export default app;
