import assert from "node:assert/strict";
import { it, mock } from "node:test";
import { once } from "node:events";
import { mkdir, open, unlink } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import User from "../src/models/user.models.js";
import { Project } from "../src/models/project.models.js";
import { ProjectMember } from "../src/models/projectmember.models.js";
import { Task } from "../src/models/task.models.js";
import { Subtask } from "../src/models/subtask.models.js";
import { ProjectNote } from "../src/models/note.models.js";
import { runTransaction } from "../src/utils/project.utils.js";
import { loadTestUri, runtimeDirectory, verifyTestConnection } from "../scripts/lib/mongodb-test.js";
import { upload } from "../src/middlewares/multer.middleware.js";
import { uploadDirectory } from "../src/utils/attachment.utils.js";
import { runLifecycle } from "./helpers/integration-lifecycle.js";

// Read only MONGODB_TEST_URI; missing/unsafe configuration fails before connecting.
it("isolated MongoDB replica-set integration: real indexes, transactions, races and HTTP flows", {
  timeout: 90000,
}, async (t) => {
  const uri = loadTestUri();
  const parsed = new URL(uri);
  const databaseName = parsed.pathname.slice(1);
  await mkdir(runtimeDirectory, { recursive: true });
  const lockPath = path.join(runtimeDirectory, "integration.lock");
  let lock;
  try { lock = await open(lockPath, "wx"); }
  catch (error) {
    if (error.code === "EEXIST") throw new Error("Integration lock exists. Check for an active test process before removing a stale .local/mongodb-runtime/integration.lock.");
    throw error;
  }
  const createdCollections = [];
  const ownedFiles = new Set();
  const mail = [];
  let server;
  Object.assign(process.env, { NODE_ENV: "test", ACCESS_TOKEN_SECRET: "isolated-test-access", REFRESH_TOKEN_SECRET: "isolated-test-refresh",
    ACCESS_TOKEN_EXPIRY: "15m", REFRESH_TOKEN_EXPIRY: "1d", SERVER_URL: "https://api.example.test",
    CORS_ORIGIN: "http://localhost:5173", FORGOT_PASSWORD_REDIRECT_URL: "http://localhost:5173/reset-password",
    PROJECT_INVITATION_REDIRECT_URL: "http://localhost:5173/invitations" });
  mock.method(nodemailer, "createTransport", () => ({ sendMail: async message => {
    mail.push(message);
    return { accepted: new MailComposer(message).compile().getEnvelope().to };
  } }));
  const getFilename = upload.storage.getFilename;
  mock.method(upload.storage, "getFilename", function (req, file, callback) {
    getFilename.call(this, req, file, (error, filename) => {
      if (!error) ownedFiles.add(filename);
      callback(error, filename);
    });
  });
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    const { default: app } = await import("../src/app.js");
    // Prevent implicit collection/index writes until both URI and server are checked.
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, autoCreate: false, autoIndex: false });
    assert.equal(mongoose.connection.name, databaseName);
    await verifyTestConnection(mongoose.connection, uri);
    const topology = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.equal(topology.setName, "rs0");
    assert.equal(topology.isWritablePrimary, true);
    const models = Object.values(mongoose.models);
    const existingCollections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
    assert.ok(!existingCollections.some(collection => models.some(model => model.collection.name === collection.name)),
      "pcb_test already has application collections. Refusing to overwrite or clean existing data; inspect it manually.");
    for (const model of models) {
      await mongoose.connection.db.createCollection(model.collection.name);
      createdCollections.push(model.collection.name);
      await model.createIndexes();
    }
    console.log("Verified integration target: pcb_test on 127.0.0.1:27018, rs0 PRIMARY");
    const admin = await User.create({ username: "admin", email: "admin@example.test", password: "test-password", isEmailVerified: true });
    const member = await User.create({ username: "member", email: "member@example.test", password: "test-password", isEmailVerified: true });
    server = app.listen(0, "127.0.0.1"); await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    process.env.SERVER_URL = base;
    const call = async (method, path, body, user = admin) => {
      const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.generateAccessToken()}` },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
      return { status: response.status, body: await response.json() };
    };
    const created = await call("POST", "/api/v1/projects", { name: "Integration" });
    assert.equal(created.status, 201);
    const projectId = created.body.data._id;
    const projectPath = `/api/v1/projects/${projectId}`;
    const tasksPath = `/api/v1/tasks/${projectId}`;
    const insertions = await Promise.allSettled([1, 2].map(() => ProjectMember.create({ project: projectId, user: member._id, role: "member" })));
    assert.equal(insertions.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(insertions.find(result => result.status === "rejected").reason.code, 11000);
    assert.equal((await call("GET", "/api/v1/projects")).body.data[0].project.members, 2);
    await assert.rejects(runTransaction(async session => {
      await ProjectNote.create([{ project: projectId, createdBy: admin._id, content: "rollback" }], { session });
      throw new Error("forced rollback");
    }), /forced rollback/);
    assert.equal(await ProjectNote.countDocuments(), 0);
    const task = await call("POST", tasksPath, { title: "Real task", assignedTo: String(member._id) });
    assert.equal(task.status, 201);
    const taskId = task.body.data._id;
    const subtask = await call("POST", `${tasksPath}/t/${taskId}/subtasks`, { title: "Real child" });
    assert.equal(subtask.status, 201);
    assert.equal((await call("PUT", `${tasksPath}/st/${subtask.body.data._id}`, { isCompleted: true }, member)).status, 200);
    assert.equal((await call("DELETE", `${tasksPath}/t/${taskId}`, undefined, member)).status, 403);
    assert.equal((await call("DELETE", `${projectPath}/members/${admin._id}`)).status, 409);
    const session = await call("POST", "/api/v1/auth/login", { email: admin.email, password: "test-password" });
    const refreshToken = session.body.data.refreshToken;
    const rotations = await Promise.all([1, 2].map(() => call("POST", "/api/v1/auth/refresh-token", { refreshToken })));
    assert.deepEqual(rotations.map(result => result.status).sort(), [200, 401]);
    // Serialize a child creation against project deletion; either order must leave no orphans.
    const race = await Promise.all([call("POST", tasksPath, { title: "Racing child" }), call("DELETE", projectPath)]);
    assert.equal(race[1].status, 200);
    assert.ok([201, 403, 404].includes(race[0].status));
    for (const model of [Project, ProjectMember, Task, Subtask, ProjectNote]) assert.equal(await model.countDocuments(), 0);
    await runLifecycle(t, { base, mail, ownedFiles });
  } finally {
    try {
      if (server) await new Promise(resolve => server.close(resolve));
      if (createdCollections.length) {
        await verifyTestConnection(mongoose.connection, uri);
        // Only collections successfully created by this run can be removed.
        for (const name of createdCollections) await mongoose.connection.db.dropCollection(name);
      }
    } finally {
      try { await mongoose.disconnect(); }
      finally {
        try {
          // Filenames captured from this fixture's Multer callback only, never a directory sweep.
          for (const filename of ownedFiles) {
            assert.match(filename, /^[a-f0-9-]{36}\.(png|jpg|gif|webp|pdf)$/);
            await unlink(path.join(uploadDirectory, filename)).catch(error => { if (error.code !== "ENOENT") throw error; });
          }
        } finally {
          mock.restoreAll();
          await lock.close();
          await unlink(lockPath);
        }
      }
    }
  }
});
