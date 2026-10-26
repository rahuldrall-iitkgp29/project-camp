import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import jwt from "jsonwebtoken";
import User from "../../src/models/user.models.js";
import { Project } from "../../src/models/project.models.js";
import { ProjectMember } from "../../src/models/projectmember.models.js";
import { ProjectInvitation } from "../../src/models/projectInvitation.models.js";
import { Task } from "../../src/models/task.models.js";
import { Subtask } from "../../src/models/subtask.models.js";
import { ProjectNote } from "../../src/models/note.models.js";
import { FileDeletion } from "../../src/models/fileDeletion.models.js";
import { uploadDirectory } from "../../src/utils/attachment.utils.js";

// Invoked only inside the parent fixture AFTER URI/server verification and exclusive
// ownership of all application collections. No connection or cleanup of its own.
export async function runLifecycle(t, { base, mail, ownedFiles }) {
  const password = "fixture-password";
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  const send = async (method, route, body, token, headers = {}) => {
    const multipart = body instanceof FormData;
    const response = await fetch(base + route, {
      method,
      headers: {
        ...(body !== undefined && !multipart
          ? { "Content-Type": "application/json" }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: multipart
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    assert.equal(result.statuscode ?? result.statusCode, response.status);
    return {
      status: response.status,
      data: result.data,
      result,
      headers: response.headers,
    };
  };
  const expect = async (status, ...args) => {
    const response = await send(...args);
    // Never include bodies/headers with passwords or JWTs in assertion output.
    assert.equal(
      response.status,
      status,
      `${args[0]} ${args[1].replace(/[a-f0-9]{40}/g, "[token]")}`,
    );
    return response;
  };
  const mailToken = (email, kind) => {
    const text = mail.findLast((message) => message.to === email).text;
    const pattern =
      kind === "invitation"
        ? /\/invitations\/([a-f0-9]{24})\/([a-f0-9]{40})/
        : new RegExp(`/${kind}/([a-f0-9]{40})`);
    const match = text.match(pattern);
    assert.ok(match, `Expected captured ${kind} URL`);
    return match.at(-1);
  };
  const login = async (email) =>
    (await expect(200, "POST", "/api/v1/auth/login", { email, password })).data;
  const register = async (username, email, verified = true) => {
    const { data } = await expect(201, "POST", "/api/v1/auth/register", {
      username,
      email,
      password,
    });
    assert.equal(data.user.password, undefined);
    assert.equal(data.user.emailVerficationToken, undefined);
    const verification = mailToken(email, "verify-email");
    if (verified) {
      await expect(200, "GET", `/api/v1/auth/verify-email/${verification}`);
      await expect(400, "GET", `/api/v1/auth/verify-email/${verification}`);
    }
    return { id: data.user._id, email, verification, ...(await login(email)) };
  };
  const form = (fields, count = 1) => {
    const body = new FormData();
    Object.entries(fields).forEach(([key, value]) => body.append(key, value));
    for (let i = 0; i < count; i++)
      body.append(
        "attachements",
        new Blob([png], { type: "image/png" }),
        "../../fixture.png",
      );
    return body;
  };
  const absentFile = async (filename) =>
    assert.rejects(access(path.join(uploadDirectory, filename)), {
      code: "ENOENT",
    });
  let owner, existing, newcomer, projectId, otherId, taskId, subId, noteId;
  let projectPath, tasksPath, notesPath;

  await t.test(
    "real onboarding, verification expiry/resend and authenticated project creation",
    async () => {
      owner = await register("flowowner", "flowowner@bücher.test", false);
      await expect(
        403,
        "POST",
        "/api/v1/projects",
        { name: "Unverified denial" },
        owner.accessToken,
      );
      await User.updateOne(
        { _id: owner.id },
        { $set: { emailVerficationTokenExpiry: new Date(0) } },
      );
      await expect(
        400,
        "GET",
        `/api/v1/auth/verify-email/${owner.verification}`,
      );
      await expect(
        200,
        "POST",
        "/api/v1/auth/resend-email-verification",
        undefined,
        owner.accessToken,
      );
      const verification = mailToken(owner.email, "verify-email");
      await expect(200, "GET", `/api/v1/auth/verify-email/${verification}`);
      await expect(400, "GET", `/api/v1/auth/verify-email/${verification}`);
      await expect(
        409,
        "POST",
        "/api/v1/auth/resend-email-verification",
        undefined,
        owner.accessToken,
      );
      projectId = (
        await expect(
          201,
          "POST",
          "/api/v1/projects",
          { name: "Lifecycle project" },
          owner.accessToken,
        )
      ).data._id;
      otherId = (
        await expect(
          201,
          "POST",
          "/api/v1/projects",
          { name: "Other lifecycle project" },
          owner.accessToken,
        )
      ).data._id;
      projectPath = `/api/v1/projects/${projectId}`;
      tasksPath = `/api/v1/tasks/${projectId}`;
      notesPath = `/api/v1/notes/${projectId}`;
      assert.equal(
        (await ProjectMember.findOne({ project: projectId, user: owner.id }))
          .role,
        "admin",
      );
      await expect(
        409,
        "POST",
        "/api/v1/projects",
        { name: "Lifecycle project" },
        owner.accessToken,
      );
      assert.equal(
        await Project.countDocuments({ name: "Lifecycle project" }),
        1,
      );
      existing = await register("flowexisting", "flowexisting@example.test");
    },
  );

  await t.test(
    "existing/new recipient invitations, expiry, rotation, acceptance and role boundaries",
    async () => {
      const invite = async (email) => {
        const result = await expect(
          201,
          "POST",
          projectPath + "/members",
          { email, role: "member" },
          owner.accessToken,
        );
        assert.equal(result.data.invitation.status, "pending");
        assert.ok(
          mail.at(-1).text.includes("http://localhost:5173/invitations/"),
        );
        return mailToken(email, "invitation");
      };
      const accept = (token, user) =>
        send(
          "POST",
          `${projectPath}/invitations/${token}/accept`,
          undefined,
          user.accessToken,
        );
      const old = await invite(existing.email);
      const expired = await invite(existing.email);
      assert.equal((await accept(old, existing)).status, 400);
      await ProjectInvitation.updateOne(
        { project: projectId, email: existing.email },
        { $set: { expiresAt: new Date(0) } },
      );
      assert.equal((await accept(expired, existing)).status, 400);
      const token = await invite(existing.email);
      assert.equal((await accept(token, owner)).status, 400);
      await expect(403, "GET", projectPath, undefined, existing.accessToken);
      const winners = await Promise.all([
        accept(token, existing),
        accept(token, existing),
      ]);
      assert.deepEqual(winners.map((r) => r.status).sort(), [200, 400]);
      assert.equal(
        await ProjectMember.countDocuments({
          project: projectId,
          user: existing.id,
        }),
        1,
      );
      const futureEmail = "newcomer@bücher.test";
      const futureToken = await invite(futureEmail);
      newcomer = await register("flownewcomer", futureEmail, false);
      assert.equal((await accept(futureToken, newcomer)).status, 403);
      await expect(
        200,
        "GET",
        `/api/v1/auth/verify-email/${newcomer.verification}`,
      );
      assert.equal((await accept(futureToken, newcomer)).status, 200);
      assert.equal((await accept(futureToken, newcomer)).status, 400);
      await expect(
        403,
        "PUT",
        projectPath + `/members/${existing.id}`,
        { newRole: "admin" },
        newcomer.accessToken,
      );
      await expect(
        422,
        "PUT",
        projectPath + `/members/${existing.id}`,
        { newRole: "owner" },
        owner.accessToken,
      );
      await expect(
        200,
        "PUT",
        projectPath + `/members/${existing.id}`,
        { newRole: "project_admin" },
        owner.accessToken,
      );
      for (const user of [existing, newcomer]) {
        await expect(
          403,
          "PUT",
          projectPath,
          { name: "Forbidden" },
          user.accessToken,
        );
        await expect(
          403,
          "POST",
          notesPath,
          { content: "Forbidden" },
          user.accessToken,
        );
        await expect(
          403,
          "GET",
          `/api/v1/projects/${otherId}`,
          undefined,
          user.accessToken,
        );
      }
      await expect(
        409,
        "DELETE",
        projectPath + `/members/${owner.id}`,
        undefined,
        owner.accessToken,
      );
    },
  );

  await t.test(
    "persisted task/subtask/note and attachment lifecycle across all project roles",
    async () => {
      await expect(
        403,
        "POST",
        tasksPath,
        { title: "Forbidden" },
        newcomer.accessToken,
      );
      const task = (
        await expect(
          201,
          "POST",
          tasksPath,
          form({ title: "Persistent uploads", assignedTo: newcomer.id }, 2),
          existing.accessToken,
        )
      ).data;
      taskId = task._id;
      assert.equal(task.attachements.length, 2);
      const persisted = await Task.findById(taskId).lean();
      for (const attachment of persisted.attachements) {
        assert.equal(attachment.mimeTypes, "image/png");
        assert.equal(attachment.size, png.length);
        const url = new URL(attachment.url);
        assert.equal(url.origin, base);
        const download = await fetch(url, {
          headers: { Origin: "http://localhost:5173" },
        });
        assert.equal(download.status, 200);
        assert.equal(download.headers.get("content-disposition"), "attachment");
        assert.equal(
          download.headers.get("access-control-allow-origin"),
          "http://localhost:5173",
        );
        assert.deepEqual(Buffer.from(await download.arrayBuffer()), png);
      }
      await expect(
        200,
        "PUT",
        `${tasksPath}/t/${taskId}`,
        form({ status: "in_progress" }),
        existing.accessToken,
      );
      assert.equal((await Task.findById(taskId)).attachements.length, 3);
      subId = (
        await expect(
          201,
          "POST",
          `${tasksPath}/t/${taskId}/subtasks`,
          { title: "Child" },
          existing.accessToken,
        )
      ).data._id;
      await expect(
        403,
        "PUT",
        `${tasksPath}/st/${subId}`,
        { title: "Forbidden" },
        newcomer.accessToken,
      );
      await expect(
        422,
        "PUT",
        `${tasksPath}/st/${subId}`,
        { isCompleted: "true" },
        newcomer.accessToken,
      );
      await expect(
        200,
        "PUT",
        `${tasksPath}/st/${subId}`,
        { isCompleted: true },
        newcomer.accessToken,
      );
      assert.equal((await Subtask.findById(subId)).isCompleted, true);
      noteId = (
        await expect(
          201,
          "POST",
          notesPath,
          { content: "Initial note" },
          owner.accessToken,
        )
      ).data._id;
      for (const user of [owner, existing, newcomer]) {
        const detail = (
          await expect(
            200,
            "GET",
            `${tasksPath}/t/${taskId}`,
            undefined,
            user.accessToken,
          )
        ).data;
        assert.equal(detail.assignedTo._id, newcomer.id);
        assert.equal(detail.assignedTo.password, undefined);
        assert.equal(detail.subtasks[0]._id, subId);
        await expect(200, "GET", tasksPath, undefined, user.accessToken);
        await expect(200, "GET", notesPath, undefined, user.accessToken);
        await expect(
          200,
          "GET",
          `${notesPath}/n/${noteId}`,
          undefined,
          user.accessToken,
        );
      }
      await expect(
        200,
        "PUT",
        `${notesPath}/n/${noteId}`,
        { content: "Updated note" },
        owner.accessToken,
      );
      assert.equal(
        (await ProjectNote.findById(noteId)).content,
        "Updated note",
      );
      await expect(
        200,
        "PUT",
        `${tasksPath}/t/${taskId}`,
        { assignedTo: null, status: "done" },
        owner.accessToken,
      );
      assert.equal((await Task.findById(taskId)).assignedTo, undefined);
      await expect(
        200,
        "PUT",
        `${tasksPath}/t/${taskId}`,
        { assignedTo: newcomer.id },
        owner.accessToken,
      );
    },
  );

  await t.test(
    "cross-project denial and real rollback retain records/files until successful cleanup",
    async () => {
      for (const [route, method, body] of [
        [`/api/v1/tasks/${otherId}/t/${taskId}`, "GET"],
        [`/api/v1/tasks/${otherId}/t/${taskId}`, "PUT", { title: "Foreign" }],
        [`/api/v1/tasks/${otherId}/st/${subId}`, "PUT", { isCompleted: false }],
        [`/api/v1/notes/${otherId}/n/${noteId}`, "GET"],
        [`/api/v1/notes/${otherId}/n/${noteId}`, "DELETE"],
      ])
        await expect(404, method, route, body, owner.accessToken);
      const before = (await Project.findById(projectId)).__v;
      const filesBefore = new Set(ownedFiles);
      await expect(
        422,
        "POST",
        tasksPath,
        form({ title: "Rolled back", assignedTo: "507f1f77bcf86cd799439011" }),
        owner.accessToken,
      );
      assert.equal(await Task.countDocuments({ project: projectId }), 1);
      assert.equal((await Project.findById(projectId)).__v, before);
      for (const file of ownedFiles)
        if (!filesBefore.has(file)) await absentFile(file);
      const deletion = t.mock.method(ProjectNote, "deleteMany", () => {
        throw new Error("Injected cascade failure");
      });
      try {
        await expect(500, "DELETE", projectPath, undefined, owner.accessToken);
      } finally {
        deletion.mock.restore();
      }
      assert.ok(await Project.exists({ _id: projectId }));
      assert.ok(await Task.exists({ _id: taskId }));
      assert.ok(await Subtask.exists({ _id: subId }));
      assert.ok(await ProjectNote.exists({ _id: noteId }));
      assert.equal(await FileDeletion.countDocuments(), 0);
      for (const attachment of (await Task.findById(taskId)).attachements)
        await access(
          path.join(
            uploadDirectory,
            path.basename(new URL(attachment.url).pathname),
          ),
        );
      await expect(
        200,
        "DELETE",
        projectPath + `/members/${newcomer.id}`,
        undefined,
        owner.accessToken,
      );
      assert.equal((await Task.findById(taskId)).assignedTo, undefined);
      await expect(403, "GET", tasksPath, undefined, newcomer.accessToken);
      await expect(
        200,
        "DELETE",
        `${tasksPath}/st/${subId}`,
        undefined,
        existing.accessToken,
      );
      await expect(
        404,
        "DELETE",
        `${tasksPath}/st/${subId}`,
        undefined,
        existing.accessToken,
      );
      await expect(
        200,
        "DELETE",
        `${notesPath}/n/${noteId}`,
        undefined,
        owner.accessToken,
      );
      await expect(
        200,
        "DELETE",
        `${tasksPath}/t/${taskId}`,
        undefined,
        existing.accessToken,
      );
      for (const file of ownedFiles) await absentFile(file);
      // Also exercise the successful project cascade with fresh children and files.
      const fresh = (
        await expect(
          201,
          "POST",
          tasksPath,
          form({ title: "Cascade upload" }),
          owner.accessToken,
        )
      ).data;
      await expect(
        201,
        "POST",
        `${tasksPath}/t/${fresh._id}/subtasks`,
        { title: "Cascade child" },
        owner.accessToken,
      );
      await expect(
        201,
        "POST",
        notesPath,
        { content: "Cascade note" },
        owner.accessToken,
      );
      await expect(200, "DELETE", projectPath, undefined, owner.accessToken);
      await expect(
        200,
        "DELETE",
        `/api/v1/projects/${otherId}`,
        undefined,
        owner.accessToken,
      );
      for (const model of [
        Project,
        ProjectMember,
        ProjectInvitation,
        Task,
        Subtask,
        ProjectNote,
        FileDeletion,
      ])
        assert.equal(await model.countDocuments(), 0);
      for (const file of ownedFiles) await absentFile(file);
    },
  );

  await t.test(
    "cookie/CORS contracts, refresh/logout, password recovery, expiry and replay with real users",
    async () => {
      let session = await login(owner.email);
      const preflight = await fetch(base + "/api/v1/auth/refresh-token", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5173",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type",
        },
      });
      assert.equal(preflight.status, 204);
      assert.equal(
        preflight.headers.get("access-control-allow-origin"),
        "http://localhost:5173",
      );
      assert.equal(
        preflight.headers.get("access-control-allow-credentials"),
        "true",
      );
      await expect(
        403,
        "POST",
        "/api/v1/auth/refresh-token",
        undefined,
        undefined,
        {
          Cookie: `refreshToken=${session.refreshToken}`,
          Origin: "https://untrusted.example.test",
        },
      );
      const refreshed = await expect(
        200,
        "POST",
        "/api/v1/auth/refresh-token",
        undefined,
        undefined,
        {
          Cookie: `refreshToken=${session.refreshToken}`,
          Origin: "http://localhost:5173",
        },
      );
      assert.ok(
        refreshed.headers
          .getSetCookie()
          .every(
            (c) =>
              c.includes("HttpOnly") &&
              c.includes("SameSite=Lax") &&
              !c.includes("Secure"),
          ),
      );
      await expect(401, "POST", "/api/v1/auth/refresh-token", {
        refreshToken: session.refreshToken,
      });
      session = refreshed.data;
      await expect(
        200,
        "GET",
        "/api/v1/auth/current-user",
        undefined,
        undefined,
        { Cookie: `accessToken=${session.accessToken}` },
      );
      await expect(
        200,
        "POST",
        "/api/v1/auth/logout",
        undefined,
        session.accessToken,
      );
      await expect(
        401,
        "GET",
        "/api/v1/auth/current-user",
        undefined,
        session.accessToken,
      );
      await expect(401, "POST", "/api/v1/auth/refresh-token", {
        refreshToken: session.refreshToken,
      });
      session = await login(owner.email);
      await expect(200, "POST", "/api/v1/auth/forgot-password", {
        email: owner.email,
      });
      const expiredReset = mailToken(owner.email, "reset-password");
      assert.ok(
        mail.at(-1).text.includes("http://localhost:5173/reset-password/"),
      );
      await User.updateOne(
        { _id: owner.id },
        { $set: { forgotPasswordTokenExpiry: new Date(0) } },
      );
      await expect(400, "POST", `/api/v1/auth/reset-password/${expiredReset}`, {
        newPassword: "updated-fixture-password",
      });
      await expect(200, "POST", "/api/v1/auth/forgot-password", {
        email: owner.email,
      });
      const reset = mailToken(owner.email, "reset-password");
      await expect(200, "POST", `/api/v1/auth/reset-password/${reset}`, {
        newPassword: "updated-fixture-password",
      });
      await expect(400, "POST", `/api/v1/auth/reset-password/${reset}`, {
        newPassword: "other-fixture-password",
      });
      await expect(
        401,
        "GET",
        "/api/v1/auth/current-user",
        undefined,
        session.accessToken,
      );
      await expect(401, "POST", "/api/v1/auth/refresh-token", {
        refreshToken: session.refreshToken,
      });
      await expect(401, "POST", "/api/v1/auth/login", {
        email: owner.email,
        password,
      });
      session = (
        await expect(200, "POST", "/api/v1/auth/login", {
          email: owner.email,
          password: "updated-fixture-password",
        })
      ).data;
      await expect(
        200,
        "POST",
        "/api/v1/auth/change-password",
        {
          oldPassword: "updated-fixture-password",
          newPassword: "final-fixture-password",
        },
        session.accessToken,
      );
      await expect(
        401,
        "GET",
        "/api/v1/auth/current-user",
        undefined,
        session.accessToken,
      );
      await expect(401, "POST", "/api/v1/auth/refresh-token", {
        refreshToken: session.refreshToken,
      });
      const current = await User.findById(owner.id);
      const expiredAccess = jwt.sign(
        { _id: owner.id, tokenVersion: current.tokenVersion },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: -1 },
      );
      const expiredRefresh = jwt.sign(
        { _id: owner.id, tokenVersion: current.tokenVersion },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: -1 },
      );
      await expect(
        401,
        "GET",
        "/api/v1/auth/current-user",
        undefined,
        expiredAccess,
      );
      await expect(401, "POST", "/api/v1/auth/refresh-token", {
        refreshToken: expiredRefresh,
      });
      await expect(200, "POST", "/api/v1/auth/login", {
        email: owner.email,
        password: "final-fixture-password",
      });
    },
  );
}
