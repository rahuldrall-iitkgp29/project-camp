import "dotenv/config";
import app from "./app.js";
import connectDB from "./db/database.js";
import mongoose from "mongoose";
import { validateEnvironment } from "./utils/env.utils.js";
import { drainAttachmentDeletions } from "./utils/attachment.utils.js";

const port = process.env.PORT || 3000; // if our port not work then run it on 3000

Promise.resolve().then(() => validateEnvironment()).then(() => connectDB())
  .then(() => {
    const server = app.listen(port, () => {
      console.log(`Project Camp listening on port ${port}`);
    });
    server.on("error", () => { console.error("HTTP server failed to listen"); process.exit(1); });
    const cleanup = () => drainAttachmentDeletions().catch(() => console.error("Attachment cleanup worker failed; queued jobs retained"));
    void cleanup();
    const timer = setInterval(cleanup, 60000);
    timer.unref();
    const shutdown = () => {
      clearInterval(timer);
      const deadline = setTimeout(() => process.exit(1), 10000);
      deadline.unref();
      server.close(() => mongoose.disconnect().then(() => process.exit(0), () => process.exit(1)));
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  })
  .catch((err) => {
    // Never log driver errors containing connection strings or credentials.
    console.error(err.message?.startsWith("Invalid or missing configuration:") ? err.message : "Startup failed: check MongoDB connectivity, replica set and unique indexes");
    process.exit(1);
  });
// if our db is run properly -> then , othere if there was any error -> catch
