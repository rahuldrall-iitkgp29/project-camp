import assert from "node:assert/strict";
import { it, mock } from "node:test";
import { readFile } from "node:fs/promises";
import mongoose from "mongoose";
import app from "../src/app.js";
import authRouter from "../src/routes/auth.route.js";
import projectRouter from "../src/routes/project.route.js";
import taskRouter from "../src/routes/task.route.js";
import noteRouter from "../src/routes/note.route.js";
import healthRouter from "../src/routes/healthCheck_route.js";
import { createRateLimiter } from "../src/middlewares/rateLimit.middleware.js";
import { validateEnvironment } from "../src/utils/env.utils.js";
import { runTransaction, withProjectWrite } from "../src/utils/project.utils.js";

it("registers all 33 PRD method/path contracts through the mounted application routers", async () => {
  const normalize = path => path.toLowerCase().replace(/:[^/]+/g, ":id").replace(/\/$/, "");
  const registrations = new Set();
  for (const [prefix, router] of [["auth", authRouter], ["projects", projectRouter], ["tasks", taskRouter], ["notes", noteRouter], ["healthcheck", healthRouter]]) {
    const mount = `/api/v1/${prefix}`;
    const layer = app.router.stack.find(layer => layer.handle === router);
    assert.ok(layer && layer.match(mount), `Missing mount ${mount}`);
    for (const { route } of router.stack) if (route) {
      for (const path of [route.path].flat()) for (const method of Object.keys(route.methods).filter(method => method !== "_all")) {
        registrations.add(`${method.toUpperCase()} ${normalize(mount + path)}`);
      }
    }
  }
  const prd = await readFile(new URL("../PRD.md", import.meta.url), "utf8");
  let prefix;
  const required = [];
  for (const line of prd.split(/\r?\n/)) {
    const heading = line.match(/\*\*.*Routes.*\(`(\/api\/v1\/[^`]+)`\)/) || line.match(/\*\*Health Check\*\* \(`([^`]+)`\)/);
    if (heading) prefix = heading[1].replace(/\/$/, "");
    const route = line.match(/^- `(GET|POST|PUT|DELETE) ([^`]+)`/);
    if (route) required.push(`${route[1]} ${normalize(prefix + route[2])}`);
  }
  assert.equal(required.length, 33);
  required.forEach(route => assert.ok(registrations.has(route), `Missing ${route}`));
  assert.ok(registrations.has("GET /api/v1/projects/:id/member"));
  assert.ok(registrations.has("POST /api/v1/projects/:id/member"));
  assert.ok(registrations.has("POST /api/v1/projects/:id/invitations/:id/accept"));
  assert.equal(mongoose.connection.readyState, 0);
});

it("throttles by endpoint/IP and normalized account, expires limits and bounds storage", () => {
  let time = 0;
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000, maxKeys: 3, now: () => time });
  const run = (ip = "one", email = "one@example.test") => {
    const headers = {};
    let result;
    limiter({ path: "/login", ip, body: { email } }, { setHeader: (key, value) => headers[key] = value }, error => result = error);
    return { result, headers };
  };
  assert.equal(run().result, undefined);
  assert.equal(run().result, undefined);
  assert.equal(run().result.statusCode, 429);
  assert.equal(run("two", "ONE@example.test").result.statusCode, 429);
  assert.equal(run("three").result.statusCode, 429);
  time = 1000;
  assert.equal(run().result, undefined);
});

it("validates operational configuration without disclosing values", () => {
  const env = { MONGO_URI: "mongodb://127.0.0.1/pcb_test_config", ACCESS_TOKEN_SECRET: "test-access", REFRESH_TOKEN_SECRET: "test-refresh",
    ACCESS_TOKEN_EXPIRY: "15m", REFRESH_TOKEN_EXPIRY: "1d", SERVER_URL: "https://api.example.test", FORGOT_PASSWORD_REDIRECT_URL: "https://client.example.test/reset",
    MAILTRAP_SMTP_HOST: "smtp.example.test", MAILTRAP_SMTP_PORT: "587", MAILTRAP_SMTP_USER: "test", MAILTRAP_SMTP_PASS: "test" };
  assert.doesNotThrow(() => validateEnvironment(env));
  for (const changes of [{ ACCESS_TOKEN_EXPIRY: "900" }, { REFRESH_TOKEN_SECRET: "test-access" }, { PORT: "bad" }, { SERVER_URL: "https://user:secret@example.test" }, { NODE_ENV: "production" }]) {
    assert.throws(() => validateEnvironment({ ...env, ...changes }), /Invalid or missing configuration/);
  }
});

it("fails closed on unsupported transactions and preserves uploads after an uncertain commit", async () => {
  let ended = 0;
  let error = Object.assign(new Error("unsupported"), { code: 20 });
  const mocked = mock.method(mongoose, "startSession", async () => ({
    withTransaction: async () => { throw error; }, endSession: async () => { ended++; },
  }));
  try {
    await assert.rejects(runTransaction(() => {}), failure => failure.statusCode === 503);
    error = Object.assign(new Error("unknown commit"), { hasErrorLabel: label => label === "UnknownTransactionCommitResult" });
    const req = { files: [{ filename: "committed-file.png" }] };
    await assert.rejects(withProjectWrite(req, [], () => {}), failure => failure.statusCode === 503);
    assert.deepEqual(req.files, []); assert.equal(ended, 2);
  } finally { mocked.mock.restore(); }
});
