import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { validateEnvironment } from "../src/utils/env.utils.js";
import { verifyLocalServer } from "./lib/mongodb-test.js";

// Explicit local launcher: preserve .env's application/Atlas URI on disk. Never
// select the destructive integration-test database for an interactive server.
dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
const uri =
  "mongodb://127.0.0.1:27018/pcb_development?replicaSet=rs0&directConnection=true";
process.env.MONGO_URI = uri;
process.env.NODE_ENV = "development";

try {
  validateEnvironment();
  const client = new mongoose.mongo.MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    // Read-only check precedes app model initialization and the cleanup worker.
    await verifyLocalServer(client);
  } finally {
    await client.close();
  }
  console.log(
    "Local development: verified project rs0 PRIMARY; database pcb_development (separate from pcb_test).",
  );
  if (!process.argv.includes("--check")) await import("../src/index.js");
} catch (error) {
  console.error(
    error.message?.startsWith("Invalid or missing configuration:")
      ? error.message
      : "Local development startup failed: check project MongoDB status and local configuration.",
  );
  process.exitCode = 1;
}
