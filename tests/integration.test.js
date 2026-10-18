import assert from "node:assert/strict";
import { it, mock } from "node:test";
import { once } from "node:events";
import crypto from "node:crypto";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import User from "../src/models/user.models.js";
import { Project } from "../src/models/project.models.js";
import { ProjectMember } from "../src/models/projectmember.models.js";
import { Task } from "../src/models/task.models.js";
import { Subtask } from "../src/models/subtask.models.js";
import { ProjectNote } from "../src/models/note.models.js";
import { runTransaction } from "../src/utils/project.utils.js";

// Never load .env or use MONGO_URI here. Only an explicitly supplied test URI is eligible.
it("isolated MongoDB replica-set integration: real indexes, transactions, races and HTTP flows", {
  skip: !process.env.MONGO_TEST_URI ? "MONGO_TEST_URI is not configured; no live database tested" : false,
  timeout: 90000,
}, async () => {
  const uri = process.env.MONGO_TEST_URI;
  const parsed = new URL(uri);
  assert.match(parsed.protocol, /^mongodb(?:\+srv)?:$/);
  assert.match(parsed.pathname, /^\/pcb_test_[a-z0-9_-]+$/i, "Test URI must explicitly name a pcb_test_ database");
  const databaseName = `pcb_test_${crypto.randomUUID().replaceAll("-", "")}`;
  let server;
  Object.assign(process.env, { NODE_ENV: "test", ACCESS_TOKEN_SECRET: "isolated-test-access", REFRESH_TOKEN_SECRET: "isolated-test-refresh",
    ACCESS_TOKEN_EXPIRY: "15m", REFRESH_TOKEN_EXPIRY: "1d", SERVER_URL: "https://api.example.test", FORGOT_PASSWORD_REDIRECT_URL: "https://client.example.test/reset" });
  mock.method(nodemailer, "createTransport", () => ({ sendMail: async mail => ({ accepted: [mail.to] }) }));
  try {
    const { default: app } = await import("../src/app.js");
    await mongoose.connect(uri, { dbName: databaseName, serverSelectionTimeoutMS: 5000 });
    assert.equal(mongoose.connection.name, databaseName);
    const topology = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.ok(topology.setName || topology.msg === "isdbgrid", "Transactions need a replica set");
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));
    const admin = await User.create({ username: "admin", email: "admin@example.test", password: "test-password", isEmailVerified: true });
    const member = await User.create({ username: "member", email: "member@example.test", password: "test-password", isEmailVerified: true });
    server = app.listen(0, "127.0.0.1"); await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
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
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === databaseName && /^pcb_test_[a-f0-9]+$/.test(databaseName)) await mongoose.connection.dropDatabase();
    await mongoose.disconnect(); mock.restoreAll();
  }
});
