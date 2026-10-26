import assert from "node:assert/strict";
import {
  after,
  before,
  beforeEach,
  afterEach,
  describe,
  it,
  mock,
} from "node:test";
import { once } from "node:events";
import { readdir, unlink } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import User from "../src/models/user.models.js";
import { Project } from "../src/models/project.models.js";
import { ProjectMember } from "../src/models/projectmember.models.js";
import { Task } from "../src/models/task.models.js";
import { Subtask } from "../src/models/subtask.models.js";
import { ProjectNote } from "../src/models/note.models.js";
import { ProjectInvitation } from "../src/models/projectInvitation.models.js";
import { FileDeletion } from "../src/models/fileDeletion.models.js";
import {
  uploadDirectory,
  drainAttachmentDeletions,
} from "../src/utils/attachment.utils.js";
import { installDatabase, clone } from "./helpers/database.js";

const models = [
  User,
  Project,
  ProjectMember,
  Task,
  Subtask,
  ProjectNote,
  ProjectInvitation,
  FileDeletion,
];
const roles = ["admin", "project_admin", "member"];
const id = () => new mongoose.Types.ObjectId().toString();
let db,
  server,
  baseUrl,
  initialFiles,
  users,
  projectId,
  otherProjectId,
  taskId,
  subTaskId,
  noteId;
const mail = [];
let mailFails = false;
const docs = (model) => db.tables[model.collection.name];
const insert = (model, values) => {
  const doc = clone(new model(values).toObject());
  docs(model).push(doc);
  return doc;
};
const tokenFor = (role) => User.hydrate(users[role]).generateAccessToken();
const projectPath = () => `/api/v1/projects/${projectId}`;
const taskPath = () => `/api/v1/tasks/${projectId}`;
const notePath = () => `/api/v1/notes/${projectId}`;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
const form = (
  fields = { title: "Uploaded task" },
  count = 2,
  bytes = png,
  type = "image/png",
  field = "attachements",
) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  for (let index = 0; index < count; index++)
    body.append(field, new Blob([bytes], { type }), "../../same name.png");
  return body;
};
async function request(
  url,
  { method = "GET", role = "admin", body, headers = {} } = {},
) {
  const multipart = body instanceof FormData;
  const response = await fetch(baseUrl + url, {
    method,
    headers: {
      ...(role ? { Authorization: `Bearer ${tokenFor(role)}` } : {}),
      ...(body !== undefined && !multipart
        ? { "Content-Type": "application/json" }
        : {}),
      ...headers,
    },
    body: multipart
      ? body
      : body !== undefined
        ? JSON.stringify(body)
        : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  assert.equal(result.statuscode ?? result.statusCode, response.status);
  return { status: response.status, body: result };
}
const expect = async (status, url, options) => {
  const result = await request(url, options);
  assert.equal(
    result.status,
    status,
    `${options?.method || "GET"} ${url}: ${JSON.stringify(result.body)}`,
  );
  return result.body.data;
};
const invitationToken = () =>
  mail.at(-1).text.match(/\/invitations\/([a-f0-9]{40})\/accept/)[1];
const acceptPath = (token) => `${projectPath()}/invitations/${token}/accept`;

describe(
  "project/task/subtask/note HTTP regressions (collection and transactions mocked)",
  { concurrency: false },
  () => {
    before(async () => {
      Object.assign(process.env, {
        NODE_ENV: "test",
        ACCESS_TOKEN_SECRET: "test-only-access",
        REFRESH_TOKEN_SECRET: "test-only-refresh",
        ACCESS_TOKEN_EXPIRY: "15m",
        REFRESH_TOKEN_EXPIRY: "1d",
        SERVER_URL: "http://127.0.0.1",
        CORS_ORIGIN: "https://client.example.test",
      });
      mongoose.set("bufferCommands", false);
      db = installDatabase(mock, models);
      mock.method(nodemailer, "createTransport", () => ({
        sendMail: async (message) => {
          if (mailFails) throw new Error("SMTP unavailable");
          mail.push(message);
          return { accepted: [message.to] };
        },
      }));
      const { default: app } = await import("../src/app.js");
      server = app.listen(0, "127.0.0.1");
      await once(server, "listening");
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      process.env.SERVER_URL = baseUrl;
      initialFiles = new Set(await readdir(uploadDirectory));
    });
    beforeEach(() => {
      for (const name of Object.keys(db.tables)) db.tables[name] = [];
      db.calls.length = 0;
      db.failNext = null;
      db.beforeTransaction = null;
      db.transactions = 0;
      mail.length = 0;
      mailFails = false;
      users = {};
      for (const role of [...roles, "outsider", "unverified"])
        users[role] = insert(User, {
          username: role,
          email: `${role}@example.test`,
          password: "test-hash",
          isEmailVerified: role !== "unverified",
          avatar: {
            url: "https://example.test/avatar.png",
            localPath: "internal-profile-path",
          },
        });
      projectId = insert(Project, {
        name: "Alpha",
        description: "Project A",
        createdBy: users.admin._id,
      })._id;
      otherProjectId = insert(Project, {
        name: "Beta",
        createdBy: users.outsider._id,
      })._id;
      for (const role of roles)
        insert(ProjectMember, {
          project: projectId,
          user: users[role]._id,
          role,
        });
      insert(ProjectMember, {
        project: otherProjectId,
        user: users.outsider._id,
        role: "admin",
      });
      taskId = insert(Task, {
        project: projectId,
        title: "Task A",
        assignedTo: users.member._id,
        assignedBy: users.admin._id,
      })._id;
      subTaskId = insert(Subtask, {
        task: taskId,
        title: "Subtask A",
        createdBy: users.admin._id,
      })._id;
      noteId = insert(ProjectNote, {
        project: projectId,
        content: "Note A",
        createdBy: users.admin._id,
      })._id;
    });
    afterEach(async () => {
      // Only UUID uploads created by these isolated tests; preserve initial repository files.
      for (const filename of await readdir(uploadDirectory))
        if (
          !initialFiles.has(filename) &&
          /^[a-f0-9-]{36}\.(png|jpg|gif|webp|pdf)$/.test(filename)
        )
          await unlink(path.join(uploadDirectory, filename));
    });
    after(async () => {
      if (server) await new Promise((resolve) => server.close(resolve));
      mock.restoreAll();
      assert.equal(mongoose.connection.readyState, 0);
    });

    it("joins zero, one and multiple projects with accurate member counts and safe profiles", async () => {
      let data = await expect(200, "/api/v1/projects");
      assert.equal(data.length, 1);
      assert.equal(data[0].project.name, "Alpha");
      assert.equal(data[0].project.members, 3);
      insert(ProjectMember, {
        project: otherProjectId,
        user: users.admin._id,
        role: "member",
      });
      data = await expect(200, "/api/v1/projects");
      assert.deepEqual(data.map((item) => item.project.members).sort(), [2, 3]);
      docs(ProjectMember).splice(0, docs(ProjectMember).length);
      assert.deepEqual(await expect(200, "/api/v1/projects"), []);
    });

    it("creates projects and creator memberships atomically, preserves names and handles duplicate names", async () => {
      const project = await expect(201, "/api/v1/projects", {
        method: "POST",
        role: "member",
        body: { name: "New project", description: "Details" },
      });
      assert.equal(
        docs(ProjectMember).find((member) => member.project === project._id)
          .role,
        "admin",
      );
      await expect(409, "/api/v1/projects", {
        method: "POST",
        body: { name: "Alpha" },
      });
      db.failNext = { name: "projectmembers", method: "insertOne" };
      await expect(500, "/api/v1/projects", {
        method: "POST",
        body: { name: "Rolled back" },
      });
      assert.equal(
        docs(Project).some((project) => project.name === "Rolled back"),
        false,
      );
      assert.equal((await expect(200, projectPath())).name, "Alpha");
      assert.equal(
        (
          await expect(200, projectPath(), {
            method: "PUT",
            body: { description: "Changed" },
          })
        ).description,
        "Changed",
      );
    });

    it("protects every project resource family from unauthenticated, unverified and unrelated users", async () => {
      const paths = [
        projectPath(),
        `${projectPath()}/members`,
        taskPath(),
        `${taskPath()}/t/${taskId}`,
        notePath(),
        `${notePath()}/n/${noteId}`,
      ];
      for (const role of [null, "unverified", "outsider"])
        for (const url of paths)
          await expect(role === null ? 401 : 403, url, { role });
      for (const role of roles) {
        const members = await expect(200, `${projectPath()}/members`, { role });
        assert.equal(members.length, 3);
        assert.equal(JSON.stringify(members).includes("test-hash"), false);
        assert.equal(
          JSON.stringify(members).includes("internal-profile-path"),
          false,
        );
        assert.deepEqual(
          await expect(200, `${projectPath()}/member`, { role }),
          members,
        );
        await expect(200, taskPath(), { role });
        await expect(200, notePath(), { role });
      }
    });

    it("enforces Admin-only project, member and note mutations for both lower roles", async () => {
      for (const role of ["project_admin", "member"])
        for (const [url, method, body] of [
          [projectPath(), "PUT", { name: "Forbidden" }],
          [projectPath(), "DELETE"],
          [
            `${projectPath()}/members`,
            "POST",
            { email: "new@example.test", role: "member" },
          ],
          [
            `${projectPath()}/members/${users.member._id}`,
            "PUT",
            { newRole: "admin" },
          ],
          [`${projectPath()}/members/${users.member._id}`, "DELETE"],
          [notePath(), "POST", { content: "Forbidden" }],
          [`${notePath()}/n/${noteId}`, "PUT", { content: "Forbidden" }],
          [`${notePath()}/n/${noteId}`, "DELETE"],
        ])
          await expect(403, url, { role, method, body });
      assert.equal(db.transactions, 0);
    });

    it("authenticates and verifies every mounted project/task/subtask/note mutation", async () => {
      const mutations = [
        ["/api/v1/projects", "POST"],
        [projectPath(), "PUT"],
        [projectPath(), "DELETE"],
        [`${projectPath()}/members`, "POST"],
        [`${projectPath()}/members/${users.member._id}`, "PUT"],
        [`${projectPath()}/members/${users.member._id}`, "DELETE"],
        [taskPath(), "POST"],
        [`${taskPath()}/t/${taskId}`, "PUT"],
        [`${taskPath()}/t/${taskId}`, "DELETE"],
        [`${taskPath()}/t/${taskId}/subtasks`, "POST"],
        [`${taskPath()}/st/${subTaskId}`, "PUT"],
        [`${taskPath()}/st/${subTaskId}`, "DELETE"],
        [notePath(), "POST"],
        [`${notePath()}/n/${noteId}`, "PUT"],
        [`${notePath()}/n/${noteId}`, "DELETE"],
      ];
      for (const role of [null, "unverified"])
        for (const [url, method] of mutations)
          await expect(role ? 403 : 401, url, { role, method, body: {} });
      for (const [url, method] of mutations.slice(1))
        await expect(403, url, { role: "outsider", method, body: {} });
      assert.equal(db.transactions, 0);
    });

    it("validates missing, null, typed, malformed and forbidden fields before writes", async () => {
      for (const name of [null, "", "   ", [], {}, 4, "x".repeat(201)])
        await expect(422, "/api/v1/projects", {
          method: "POST",
          body: { name },
        });
      for (const body of [
        {},
        { title: null },
        { title: " " },
        { title: [] },
        { title: "Ok", status: "invalid" },
        { title: "Ok", assignedTo: {} },
        { title: "Ok", project: otherProjectId },
      ])
        await expect(422, taskPath(), { method: "POST", body });
      for (const content of [null, "", "   ", [], {}, 1])
        await expect(422, notePath(), { method: "POST", body: { content } });
      for (const isCompleted of ["false", null, 0, [], {}])
        await expect(422, `${taskPath()}/st/${subTaskId}`, {
          method: "PUT",
          body: { isCompleted },
        });
      for (const newRole of [null, "owner", [], {}])
        await expect(422, `${projectPath()}/members/${users.member._id}`, {
          method: "PUT",
          body: { newRole },
        });
      for (const url of [
        "/api/v1/tasks/bad",
        `${taskPath()}/t/bad`,
        `${taskPath()}/st/bad`,
        `${notePath()}/n/bad`,
        `${projectPath()}/members/bad`,
      ])
        await expect(400, url, {
          method:
            url.includes("/st/") || url.includes("/members/")
              ? "DELETE"
              : "GET",
        });
      assert.equal(db.transactions, 0);
    });

    it("implements privileged task CRUD, member completion and safe assignee population", async () => {
      for (const role of ["admin", "project_admin"]) {
        const task = await expect(201, taskPath(), {
          method: "POST",
          role,
          body: {
            title: "New",
            description: "Body",
            assignedTo: users.member._id,
          },
        });
        assert.equal(task.status, "todo");
        for (const status of ["in_progress", "done", "todo"])
          assert.equal(
            (
              await expect(200, `${taskPath()}/t/${task._id}`, {
                method: "PUT",
                role,
                body: { status },
              })
            ).status,
            status,
          );
        const subtask = await expect(
          201,
          `${taskPath()}/t/${task._id}/subtasks`,
          { method: "POST", role, body: { title: "Step" } },
        );
        for (const viewer of roles) {
          const details = await expect(200, `${taskPath()}/t/${task._id}`, {
            role: viewer,
          });
          assert.equal(details.assignedTo.username, "member");
          assert.equal(details.assignedTo.password, undefined);
          assert.equal(
            JSON.stringify(details).includes("internal-profile-path"),
            false,
          );
          assert.equal(details.subtasks[0]._id, subtask._id);
          assert.equal(
            (
              await expect(200, `${taskPath()}/st/${subtask._id}`, {
                method: "PUT",
                role: viewer,
                body: { isCompleted: true },
              })
            ).isCompleted,
            true,
          );
        }
        await expect(200, `${taskPath()}/st/${subtask._id}`, {
          method: "PUT",
          role,
          body: { title: "Renamed", isCompleted: false },
        });
        await expect(200, `${taskPath()}/st/${subtask._id}`, {
          method: "DELETE",
          role,
        });
        await expect(200, `${taskPath()}/t/${task._id}`, {
          method: "DELETE",
          role,
        });
        await expect(404, `${taskPath()}/t/${task._id}`);
      }
      const tasks = await expect(200, taskPath());
      assert.equal(tasks[0].assignedTo.username, "member");
      assert.equal(tasks[0].assignedTo.password, undefined);
      for (const [url, method, body] of [
        [taskPath(), "POST", { title: "Forbidden" }],
        [`${taskPath()}/t/${taskId}`, "PUT", { status: "done" }],
        [`${taskPath()}/t/${taskId}`, "DELETE"],
        [`${taskPath()}/t/${taskId}/subtasks`, "POST", { title: "Forbidden" }],
        [`${taskPath()}/st/${subTaskId}`, "DELETE"],
        [`${taskPath()}/st/${subTaskId}`, "PUT", { title: "Forbidden" }],
      ])
        await expect(403, url, { method, role: "member", body });
    });

    it("rejects missing or unrelated assignees and clears explicit null assignments", async () => {
      for (const assignedTo of [id(), users.outsider._id]) {
        await expect(422, taskPath(), {
          method: "POST",
          body: { title: "Invalid", assignedTo },
        });
        await expect(422, `${taskPath()}/t/${taskId}`, {
          method: "PUT",
          body: { assignedTo },
        });
      }
      const task = await expect(200, `${taskPath()}/t/${taskId}`, {
        method: "PUT",
        body: { assignedTo: null },
      });
      assert.equal(task.assignedTo, undefined);
      assert.equal(
        (
          await expect(201, taskPath(), {
            method: "POST",
            body: { title: "Unassigned" },
          })
        ).assignedTo,
        undefined,
      );
    });

    it("prevents ID substitution across projects for every task/subtask/note operation", async () => {
      const otherTask = insert(Task, {
        project: otherProjectId,
        title: "Other",
      });
      const otherSubtask = insert(Subtask, {
        task: otherTask._id,
        title: "Other",
        createdBy: users.outsider._id,
      });
      const otherNote = insert(ProjectNote, {
        project: otherProjectId,
        content: "Secret",
        createdBy: users.outsider._id,
      });
      for (const resource of [otherTask._id, id()])
        for (const [suffix, method, body] of [
          ["", "GET"],
          ["", "PUT", { title: "Attack" }],
          ["", "DELETE"],
          ["/subtasks", "POST", { title: "Attack" }],
        ])
          await expect(404, `${taskPath()}/t/${resource}${suffix}`, {
            method,
            body,
          });
      for (const resource of [otherSubtask._id, id()])
        for (const method of ["PUT", "DELETE"])
          await expect(404, `${taskPath()}/st/${resource}`, {
            method,
            body: method === "PUT" ? { isCompleted: true } : undefined,
          });
      for (const resource of [otherNote._id, id()])
        for (const method of ["GET", "PUT", "DELETE"])
          await expect(404, `${notePath()}/n/${resource}`, {
            method,
            body: method === "PUT" ? { content: "Attack" } : undefined,
          });
      assert.equal(
        docs(Task).find((task) => task._id === otherTask._id).title,
        "Other",
      );
      assert.equal(
        docs(ProjectNote).find((note) => note._id === otherNote._id).content,
        "Secret",
      );
    });

    it("handles missing project parents and membership revoked after the route gate", async () => {
      docs(Project).splice(
        docs(Project).findIndex((project) => project._id === projectId),
        1,
      );
      for (const url of [
        projectPath(),
        `${projectPath()}/members`,
        taskPath(),
        notePath(),
        `${taskPath()}/t/${taskId}`,
        `${notePath()}/n/${noteId}`,
      ])
        await expect(404, url);
      await expect(404, taskPath(), {
        method: "POST",
        body: { title: "Orphan" },
      });
      insert(Project, {
        _id: projectId,
        name: "Restored",
        createdBy: users.admin._id,
      });
      db.beforeTransaction = () => {
        db.tables.projectmembers = docs(ProjectMember).filter(
          (member) => member.user !== users.admin._id,
        );
      };
      await expect(403, taskPath(), {
        method: "POST",
        body: { title: "Revoked" },
      });
      assert.equal(docs(Task).length, 1);
    });

    it("implements Admin note CRUD and all-role reads without internal user fields", async () => {
      const note = await expect(201, notePath(), {
        method: "POST",
        body: { content: " Note text " },
      });
      assert.equal(note.content, "Note text");
      for (const role of roles) {
        const data = await expect(200, `${notePath()}/n/${note._id}`, { role });
        assert.equal(data.createdBy.username, "admin");
        assert.equal(data.createdBy.password, undefined);
        assert.equal(data.createdBy.avatar.localPath, undefined);
        assert.equal((await expect(200, notePath(), { role })).length, 2);
      }
      assert.equal(
        (
          await expect(200, `${notePath()}/n/${note._id}`, {
            method: "PUT",
            body: { content: "Updated" },
          })
        ).content,
        "Updated",
      );
      await expect(200, `${notePath()}/n/${note._id}`, { method: "DELETE" });
      await expect(404, `${notePath()}/n/${note._id}`);
    });

    it("protects the last Admin, handles concurrent demotions and clears removed-member assignments", async () => {
      await expect(409, `${projectPath()}/members/${users.admin._id}`, {
        method: "DELETE",
      });
      await expect(409, `${projectPath()}/members/${users.admin._id}`, {
        method: "PUT",
        body: { newRole: "member" },
      });
      await expect(200, `${projectPath()}/members/${users.project_admin._id}`, {
        method: "PUT",
        body: { newRole: "admin" },
      });
      const results = await Promise.all([
        request(`${projectPath()}/members/${users.admin._id}`, {
          method: "PUT",
          body: { newRole: "member" },
        }),
        request(`${projectPath()}/members/${users.project_admin._id}`, {
          method: "PUT",
          role: "project_admin",
          body: { newRole: "member" },
        }),
      ]);
      assert.deepEqual(
        results.map((result) => result.status).sort(),
        [200, 409],
      );
      const remainingRole =
        docs(ProjectMember).find(
          (member) => member.project === projectId && member.role === "admin",
        ).user === users.admin._id
          ? "admin"
          : "project_admin";
      await expect(200, `${projectPath()}/members/${users.member._id}`, {
        method: "DELETE",
        role: remainingRole,
      });
      assert.equal(docs(Task)[0].assignedTo, undefined);
      await expect(403, taskPath(), { role: "member" });
      await expect(404, `${projectPath()}/members/${id()}`, {
        method: "DELETE",
        role: remainingRole,
      });
    });

    it("enforces the declared membership unique index and rolls back failed removal/cascade writes", async () => {
      const insertions = await Promise.allSettled(
        [1, 2].map(() =>
          ProjectMember.create({
            user: users.outsider._id,
            project: projectId,
            role: "member",
          }),
        ),
      );
      assert.equal(
        insertions.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assert.equal(
        insertions.find((result) => result.status === "rejected").reason.code,
        11000,
      );
      db.failNext = { name: "projectmembers", method: "deleteOne" };
      await expect(500, `${projectPath()}/members/${users.member._id}`, {
        method: "DELETE",
      });
      assert.equal(docs(Task)[0].assignedTo, users.member._id);
      assert.ok(
        docs(ProjectMember).some((member) => member.user === users.member._id),
      );
      db.failNext = { name: "tasks", method: "deleteOne" };
      await expect(500, `${taskPath()}/t/${taskId}`, { method: "DELETE" });
      assert.equal(docs(Subtask).length, 1);
      assert.equal(docs(Task).length, 1);
      await expect(200, `${taskPath()}/t/${taskId}`, { method: "DELETE" });
      assert.equal(docs(Subtask).length, 0);
    });

    it("invites existing and future accounts, binds email, consumes once and enforces verification", async () => {
      const invitation = await expect(201, `${projectPath()}/members`, {
        method: "POST",
        body: { email: users.outsider.email, role: "project_admin" },
      });
      assert.equal(invitation.invitation.status, "pending");
      assert.equal(docs(ProjectMember).length, 4);
      let token = invitationToken();
      assert.notEqual(docs(ProjectInvitation)[0].tokenHash, token);
      await expect(400, acceptPath(token), { method: "POST", role: "member" });
      await expect(403, acceptPath(token), {
        method: "POST",
        role: "unverified",
      });
      const results = await Promise.all([
        request(acceptPath(token), { method: "POST", role: "outsider" }),
        request(acceptPath(token), { method: "POST", role: "outsider" }),
      ]);
      assert.deepEqual(
        results.map((result) => result.status).sort(),
        [200, 400],
      );
      assert.equal(
        docs(ProjectMember).filter(
          (member) =>
            member.user === users.outsider._id && member.project === projectId,
        ).length,
        1,
      );
      await expect(409, `${projectPath()}/member`, {
        method: "POST",
        body: { email: users.outsider.email, role: "admin" },
      });
      await expect(201, `${projectPath()}/member`, {
        method: "POST",
        body: { email: "future@example.test", role: "member" },
      });
      token = invitationToken();
      users.future = insert(User, {
        username: "future",
        email: "future@example.test",
        password: "test-hash",
        isEmailVerified: true,
      });
      await expect(200, acceptPath(token), { method: "POST", role: "future" });
    });

    it("rotates/rejects expired invitations and reports mail failures without granting membership", async () => {
      const invite = () =>
        expect(201, `${projectPath()}/members`, {
          method: "POST",
          body: { email: users.outsider.email, role: "member" },
        });
      await invite();
      const old = invitationToken();
      await invite();
      const current = invitationToken();
      await expect(400, acceptPath(old), { method: "POST", role: "outsider" });
      docs(ProjectInvitation)[0].expiresAt = new Date(0).toISOString();
      await expect(400, acceptPath(current), {
        method: "POST",
        role: "outsider",
      });
      mailFails = true;
      await expect(502, `${projectPath()}/members`, {
        method: "POST",
        body: { email: users.outsider.email, role: "member" },
      });
      assert.equal(docs(ProjectMember).length, 4);
      mailFails = false;
      await invite();
      await expect(200, acceptPath(invitationToken()), {
        method: "POST",
        role: "outsider",
      });
    });

    it("uploads multiple collision-safe files, serves the stored URLs and appends metadata", async () => {
      const task = await expect(201, taskPath(), {
        method: "POST",
        body: form(),
      });
      assert.equal(task.attachements.length, 2);
      assert.notEqual(task.attachements[0].url, task.attachements[1].url);
      for (const file of task.attachements) {
        assert.equal(file.mimeTypes, "image/png");
        assert.equal(file.size, png.length);
        const response = await fetch(file.url, {
          headers: { Origin: "https://client.example.test" },
        });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("x-content-type-options"), "nosniff");
        assert.equal(response.headers.get("content-disposition"), "attachment");
        assert.equal(
          response.headers.get("access-control-allow-origin"),
          "https://client.example.test",
        );
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
      }
      const updated = await expect(200, `${taskPath()}/t/${task._id}`, {
        method: "PUT",
        body: form({}, 3),
      });
      assert.equal(updated.attachements.length, 5);
      await expect(422, `${taskPath()}/t/${task._id}`, {
        method: "PUT",
        body: form({}, 1),
      });
      await expect(200, `${taskPath()}/t/${task._id}`, { method: "DELETE" });
      assert.equal((await fetch(task.attachements[0].url)).status, 404);
      assert.equal(docs(FileDeletion).length, 0);
    });

    it("rejects unauthorized, spoofed, active, oversized, excess and malformed uploads and cleans disk", async () => {
      const baseline = (await readdir(uploadDirectory)).sort();
      await expect(403, taskPath(), {
        method: "POST",
        role: "member",
        body: form(),
      });
      await expect(415, taskPath(), {
        method: "POST",
        body: form(
          { title: "Bad" },
          1,
          Buffer.from("<script>bad</script>"),
          "image/png",
        ),
      });
      await expect(415, taskPath(), {
        method: "POST",
        body: form({ title: "Bad" }, 1, Buffer.from("<svg/>"), "image/svg+xml"),
      });
      await expect(413, taskPath(), {
        method: "POST",
        body: form(
          { title: "Big" },
          1,
          Buffer.alloc(1000001),
          "application/pdf",
        ),
      });
      await expect(413, taskPath(), {
        method: "POST",
        body: form({ title: "Many" }, 6),
      });
      await expect(400, taskPath(), {
        method: "POST",
        body: form({ title: "Field" }, 1, png, "image/png", "wrong"),
      });
      await expect(422, taskPath(), {
        method: "POST",
        body: form({ title: " " }),
      });
      db.failNext = { name: "tasks", method: "insertOne" };
      await expect(500, taskPath(), { method: "POST", body: form() });
      const malformed = await fetch(baseUrl + taskPath(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenFor("admin")}`,
          "Content-Type": "multipart/form-data; boundary=unfinished",
        },
        body: "--unfinished\r\n",
      });
      assert.equal(malformed.status, 400);
      await malformed.json();
      assert.deepEqual((await readdir(uploadDirectory)).sort(), baseline);
    });

    it("rolls back cascades on failure and deletes all children, invitations and files on retry", async () => {
      const task = await expect(201, taskPath(), {
        method: "POST",
        body: form(),
      });
      await expect(201, `${projectPath()}/members`, {
        method: "POST",
        body: { email: "pending@example.test", role: "member" },
      });
      db.failNext = { name: "projectnotes", method: "deleteMany" };
      await expect(500, projectPath(), { method: "DELETE" });
      assert.equal(docs(Task).length, 2);
      assert.equal(docs(Subtask).length, 1);
      assert.equal(docs(ProjectNote).length, 1);
      assert.equal(docs(FileDeletion).length, 0);
      assert.equal((await fetch(task.attachements[0].url)).status, 200);
      await expect(200, projectPath(), { method: "DELETE" });
      for (const model of [
        Task,
        Subtask,
        ProjectNote,
        ProjectInvitation,
        FileDeletion,
      ])
        assert.equal(docs(model).length, 0);
      assert.equal(docs(Project).length, 1);
      assert.equal(docs(ProjectMember).length, 1);
      assert.equal((await fetch(task.attachements[0].url)).status, 404);
    });

    it("retains committed file deletion jobs when acknowledgement fails and retries safely", async () => {
      const task = await expect(201, taskPath(), {
        method: "POST",
        body: form({ title: "Queued" }, 1),
      });
      db.failNext = { name: "filedeletions", method: "deleteOne" };
      await expect(200, `${taskPath()}/t/${task._id}`, { method: "DELETE" });
      assert.equal(docs(FileDeletion).length, 1);
      await drainAttachmentDeletions();
      assert.equal(docs(FileDeletion).length, 0);
    });
  },
);
