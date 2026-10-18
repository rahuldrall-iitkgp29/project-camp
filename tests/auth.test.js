import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import { once } from "node:events";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import User from "../src/models/user.models.js";
import { Project } from "../src/models/project.models.js";
import { ProjectMember } from "../src/models/projectmember.models.js";

// Only the collection boundary is replaced. Express routing, validators,
// Mongoose casting/hooks, bcrypt, JWT and email templates run normally.
// This adapter exercises query intent; it is not a MongoDB integration test.
const users = new Map();
const sentMail = [];
let dbCalls = 0;
let membershipCalls = 0;
let membershipRole = null;
let mailFails = false;
let mailRejected = false;
let databaseFails = false;
let beforeUserUpdate = null;
let server;
let baseUrl;
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const matches = (doc, filter) => Object.entries(filter).every(([key, value]) => {
    if (key === "$or") return value.some((entry) => matches(doc, entry));
    if (value && typeof value === "object" && !mongoose.isObjectIdOrHexString(value)) {
        if ("$exists" in value) return (doc[key] !== undefined) === value.$exists;
        if ("$gt" in value) return new Date(doc[key]).getTime() > new Date(value.$gt).getTime();
        throw new Error("Unsupported test filter");
    }
    return value == null ? doc[key] == null : String(doc[key]) === String(value);
});
const findStored = (filter) => [...users.values()].find((doc) => matches(doc, filter));
const project = (doc, options = {}) => {
    const result = clone(doc);
    if (result) {
        for (const [key, included] of Object.entries(options.projection || {})) {
            if (!included) {
                const parts = key.split(".");
                const last = parts.pop();
                const target = parts.reduce((value, part) => value?.[part], result);
                if (target) delete target[last];
            }
        }
    }
    return result;
};
const credentials = { email: "alice@example.test", username: "alice", password: " secret pass " };
const sensitiveFields = ["password", "refreshToken", "emailVerficationToken", "emailVerficationTokenExpiry",
    "forgotPasswordToken", "forgotPasswordTokenExpiry", "tokenVersion", "__v"];
const assertPublic = (user) => {
    sensitiveFields.forEach((field) => assert.equal(field in user, false, field));
    assert.equal(user.avatar?.localPath, undefined);
};

async function request(path, { method = "POST", body, token, cookie, headers = {} } = {}) {
    const response = await fetch(baseUrl + path, {
        method,
        headers: {
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(cookie ? { Cookie: cookie } : {}),
            ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(5000),
    });
    return { status: response.status, body: await response.json(), cookies: response.headers.getSetCookie() };
}
const auth = (path, options) => request("/api/v1/auth" + path, options);
const registration = (overrides = {}) => auth("/register", { body: { ...credentials, ...overrides } });
const login = (password = credentials.password) => auth("/login", { body: { email: credentials.email, password } });
const verificationToken = () => sentMail.at(-1).text.match(/https:\/\/api\.example\.test\/api\/v1\/auth\/verify-email\/([a-f0-9]{40})/)[1];
const resetToken = () => sentMail.at(-1).text.match(/https:\/\/client\.example\.test\/reset-password\/([a-f0-9]{40})/)[1];
const storedUser = () => [...users.values()][0];

async function session(verified = false) {
    assert.equal((await registration()).status, 201);
    if (verified) assert.equal((await auth("/verify-email/" + verificationToken(), { method: "GET" })).status, 200);
    const result = await login();
    assert.equal(result.status, 200);
    return result.body.data;
}

describe("authentication HTTP regressions (database and SMTP mocked)", { concurrency: false }, () => {
    before(async () => {
        Object.assign(process.env, {
            NODE_ENV: "test",
            ACCESS_TOKEN_SECRET: "test-only-access-secret",
            REFRESH_TOKEN_SECRET: "test-only-refresh-secret",
            ACCESS_TOKEN_EXPIRY: "15m",
            REFRESH_TOKEN_EXPIRY: "1d",
            SERVER_URL: "https://api.example.test",
            FORGOT_PASSWORD_REDIRECT_URL: "https://client.example.test/reset-password",
            CORS_ORIGIN: "https://client.example.test",
        });
        mongoose.set("bufferCommands", false);
        mock.method(mongoose, "connect", () => { throw new Error("Database connections are forbidden in these tests"); });
        mock.method(User.collection, "insertOne", async (doc) => {
            dbCalls++;
            if ([...users.values()].some((user) => user.email === doc.email || user.username === doc.username)) {
                throw Object.assign(new Error("Duplicate"), { code: 11000 });
            }
            users.set(String(doc._id), clone(doc));
            return { acknowledged: true, insertedId: doc._id };
        });
        mock.method(User.collection, "findOne", async (filter, options) => {
            dbCalls++;
            if (databaseFails) throw new Error("Internal database detail must not escape");
            return project(findStored(filter), options);
        });
        mock.method(User.collection, "findOneAndUpdate", async (filter, update, options) => {
            dbCalls++;
            if (beforeUserUpdate) {
                const action = beforeUserUpdate;
                beforeUserUpdate = null;
                action();
            }
            const doc = findStored(filter);
            if (!doc) return null;
            const previous = clone(doc);
            Object.assign(doc, clone(update.$set || {}));
            for (const key of Object.keys(update.$unset || {})) delete doc[key];
            for (const [key, amount] of Object.entries(update.$inc || {})) doc[key] = (doc[key] ?? 0) + amount;
            return project(options.returnDocument === "after" ? doc : previous, options);
        });
        mock.method(ProjectMember.collection, "findOne", async (filter) => {
            membershipCalls++;
            return membershipRole ? { _id: new mongoose.Types.ObjectId(), ...filter, role: membershipRole } : null;
        });
        mock.method(Project.collection, "findOne", async () => ({ _id: new mongoose.Types.ObjectId(), name: "Private project" }));
        mock.method(ProjectMember.collection, "aggregate", () => ({ toArray: async () => [] }));
        mock.method(nodemailer, "createTransport", () => ({
            sendMail: async (mail) => {
                if (mailFails) throw new Error("SMTP credential details must not escape");
                sentMail.push(mail);
                return { accepted: mailRejected ? [] : [mail.to], rejected: mailRejected ? [mail.to] : [] };
            },
        }));
        const { default: app } = await import("../src/app.js");
        server = app.listen(0, "127.0.0.1");
        await once(server, "listening");
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    beforeEach(() => {
        users.clear();
        sentMail.length = 0;
        dbCalls = 0;
        membershipCalls = 0;
        membershipRole = null;
        mailFails = false;
        mailRejected = false;
        databaseFails = false;
        beforeUserUpdate = null;
        process.env.NODE_ENV = "test";
    });

    after(async () => {
        if (server) await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
        mock.restoreAll();
        assert.equal(mongoose.connection.readyState, 0);
    });

    it("loads the app and serves health, JSON 404s and CORS", async () => {
        assert.equal((await request("/api/v1/healthcheck", { method: "GET" })).status, 200);
        const missing = await request("/missing", { method: "GET" });
        assert.equal(missing.status, 404);
        assert.equal(missing.body.success, false);
        const cors = await fetch(baseUrl + "/api/v1/healthcheck", { headers: { Origin: "https://client.example.test" } });
        assert.equal(cors.headers.get("access-control-allow-origin"), "https://client.example.test");
        const denied = await fetch(baseUrl + "/api/v1/healthcheck", { headers: { Origin: "https://other.example.test" } });
        assert.equal(denied.headers.get("access-control-allow-origin"), null);
    });

    it("rejects malformed registration before any database/email operation", async () => {
        for (const body of [
            {}, { ...credentials, email: { $ne: null } }, { ...credentials, username: ["alice"] },
            { ...credentials, password: 123456 }, { ...credentials, password: "x" },
            { ...credentials, password: "🔒".repeat(19) }, { ...credentials, email: "invalid" },
        ]) {
            const result = await auth("/register", { body });
            assert.equal(result.status, 422);
            assert.ok(result.body.errors.length);
        }
        assert.equal(dbCalls, 0);
        assert.equal(sentMail.length, 0);
        assert.equal(users.size, 0);
    });

    it("registers once, hashes the exact password and uses the configured verification URL", async () => {
        const result = await auth("/register", {
            body: credentials, headers: { "X-Forwarded-Host": "attacker.example.test" },
        });
        assert.equal(result.status, 201);
        assert.equal(result.body.statuscode, 201);
        assertPublic(result.body.data.user);
        assert.equal(await bcrypt.compare(credentials.password, storedUser().password), true);
        assert.equal(await bcrypt.compare(credentials.password.trim(), storedUser().password), false);
        assert.equal(verificationToken().length, 40);
        assert.notEqual(storedUser().emailVerficationToken, verificationToken());
        assert.equal((await registration()).status, 409);
    });

    it("handles a duplicate-registration race without returning a 500", async () => {
        const results = await Promise.all([registration(), registration()]);
        assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
        assert.equal(users.size, 1);
    });

    it("logs in with email/password only and uses uniform invalid-credential errors", async () => {
        await registration();
        const result = await login();
        assert.equal(result.status, 200);
        assertPublic(result.body.data.user);
        const wrong = await login("wrong-password");
        const missing = await auth("/login", { body: { email: "unknown@example.test", password: "wrong-password" } });
        assert.equal(wrong.status, 401);
        assert.deepEqual(wrong.body, missing.body);
        const calls = dbCalls;
        assert.equal((await auth("/login", { body: { email: { $ne: null }, password: credentials.password } })).status, 422);
        assert.equal(dbCalls, calls);
    });

    it("allows unverified account actions but denies every project route before membership lookup", async () => {
        const { accessToken } = await session();
        assert.equal((await auth("/current-user", { method: "GET", token: accessToken })).status, 200);
        for (const [path, method] of [
            ["/api/v1/projects", "GET"], ["/api/v1/projects", "POST"],
            ["/api/v1/projects/507f1f77bcf86cd799439011", "GET"],
            ["/api/v1/projects/507f1f77bcf86cd799439011/member", "GET"],
        ]) {
            const result = await request(path, { method, token: accessToken });
            assert.equal(result.status, 403);
            assert.match(result.body.message, /Verify your email/);
        }
        assert.equal(membershipCalls, 0);
        assert.equal((await auth("/resend-email-verification", { token: accessToken })).status, 200);
    });

    it("consumes verification tokens once and enables project authorization only after verification", async () => {
        const { accessToken } = await session();
        const token = verificationToken();
        assert.equal((await auth("/verify-email/" + token, { method: "GET" })).status, 200);
        assert.equal(storedUser().isEmailVerified, true);
        assert.equal(storedUser().emailVerficationToken, undefined);
        assert.equal((await auth("/verify-email/" + token, { method: "GET" })).status, 400);
        const denied = await request("/api/v1/projects/507f1f77bcf86cd799439011/member", { method: "GET", token: accessToken });
        assert.equal(denied.status, 403);
        assert.equal(membershipCalls, 1);
        assert.equal((await auth("/resend-email-verification", { token: accessToken })).status, 409);
    });

    it("rejects expired and malformed verification tokens without verifying the account", async () => {
        await registration();
        const token = verificationToken();
        storedUser().emailVerficationTokenExpiry = new Date(0).toISOString();
        assert.equal((await auth("/verify-email/" + token, { method: "GET" })).status, 400);
        assert.equal((await auth("/verify-email/not-a-token", { method: "GET" })).status, 400);
        assert.equal(storedUser().isEmailVerified, false);
    });

    it("enforces membership roles and rejects malformed project/member IDs and roles", async () => {
        const { accessToken } = await session(true);
        const path = "/api/v1/projects/507f1f77bcf86cd799439011";
        membershipRole = "member";
        assert.equal((await request(path + "/member", { method: "GET", token: accessToken })).status, 200);
        assert.equal((await request(path, { method: "DELETE", token: accessToken })).status, 403);
        assert.equal((await request("/api/v1/projects/invalid", { method: "GET", token: accessToken })).status, 400);
        membershipRole = "admin";
        assert.equal((await request(path + "/members/invalid", { method: "PUT", token: accessToken, body: { newRole: "member" } })).status, 400);
        for (const role of ["owner", ["admin"], { $ne: null }]) {
            assert.equal((await request(path + "/member", {
                token: accessToken, body: { email: credentials.email, role },
            })).status, 422);
        }
    });

    it("never exposes reset fields or session versions through login/current-user", async () => {
        const { accessToken } = await session();
        await auth("/forgot-password", { body: { email: credentials.email } });
        assert.ok(storedUser().forgotPasswordToken);
        assertPublic((await login()).body.data.user);
        const current = await auth("/current-user", { method: "GET", token: accessToken });
        assert.equal(current.status, 200);
        assertPublic(current.body.data);
    });

    it("rejects absent, malformed, expired and wrong-purpose credentials", async () => {
        assert.equal((await auth("/refresh-token")).status, 401);
        for (const refreshToken of ["bad", { $ne: null }, [], 1]) {
            assert.equal((await auth("/refresh-token", { body: { refreshToken } })).status, 401);
        }
        const { accessToken, refreshToken } = await session();
        assert.equal((await auth("/refresh-token", { body: { refreshToken: accessToken } })).status, 401);
        assert.equal((await auth("/current-user", { method: "GET", token: refreshToken })).status, 401);
        const expired = jwt.sign({ _id: storedUser()._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: -1 });
        const invalidId = jwt.sign({ _id: "not-an-id" }, process.env.ACCESS_TOKEN_SECRET);
        for (const token of [undefined, "invalid", expired, invalidId]) {
            assert.equal((await auth("/current-user", { method: "GET", token })).status, 401);
        }
    });

    it("rotates refresh tokens via body and cookies, preserves the alias and rejects replay", async () => {
        const { refreshToken } = await session();
        const refreshed = await auth("/refresh-token", { body: { refreshToken } });
        assert.equal(refreshed.status, 200);
        const next = refreshed.body.data.refreshToken;
        assert.equal(next, refreshed.body.data.refrershToken);
        assert.notEqual(next, refreshToken);
        assert.equal((await auth("/refresh-token", { body: { refreshToken } })).status, 401);
        const cookieRefresh = await auth("/refresh-token", { cookie: "refreshToken=" + next });
        assert.equal(cookieRefresh.status, 200);
        assert.notEqual(cookieRefresh.body.data.refreshToken, next);
        assert.notEqual(jwt.decode(next).jti, jwt.decode(cookieRefresh.body.data.refreshToken).jti);
    });

    it("allows only one winner when two requests rotate the same refresh token", async () => {
        const { refreshToken } = await session();
        const results = await Promise.all([
            auth("/refresh-token", { body: { refreshToken } }),
            auth("/refresh-token", { body: { refreshToken } }),
        ]);
        assert.deepEqual(results.map((result) => result.status).sort(), [200, 401]);
        assert.equal(storedUser().refreshToken, results.find((result) => result.status === 200).body.data.refreshToken);
    });

    it("logout revokes access and refresh tokens and clears both cookies", async () => {
        const { accessToken, refreshToken } = await session();
        const result = await auth("/logout", { token: accessToken });
        assert.equal(result.status, 200);
        assert.equal(result.cookies.length, 2);
        assert.ok(result.cookies.every((cookie) => cookie.includes("Expires=")));
        assert.equal(storedUser().refreshToken, "");
        assert.equal((await auth("/current-user", { method: "GET", token: accessToken })).status, 401);
        assert.equal((await auth("/refresh-token", { body: { refreshToken } })).status, 401);
    });

    it("does not resurrect a session revoked between refresh lookup and replacement", async () => {
        const { accessToken, refreshToken } = await session();
        beforeUserUpdate = () => {
            storedUser().tokenVersion++;
            storedUser().refreshToken = "";
        };
        assert.equal((await auth("/refresh-token", { body: { refreshToken } })).status, 401);
        assert.equal(storedUser().refreshToken, "");
        assert.equal((await auth("/current-user", { method: "GET", token: accessToken })).status, 401);
    });

    it("changes passwords, clears pending resets, and revokes existing sessions", async () => {
        const { accessToken, refreshToken } = await session();
        await auth("/forgot-password", { body: { email: credentials.email } });
        const unchanged = storedUser().password;
        assert.equal((await auth("/change-password", { token: accessToken, body: { oldPassword: "wrong", newPassword: "new-password" } })).status, 400);
        assert.equal((await auth("/change-password", { token: accessToken, body: { oldPassword: credentials.password, newPassword: "x" } })).status, 422);
        assert.equal(storedUser().password, unchanged);
        const result = await auth("/change-password", { token: accessToken, body: { oldPassword: credentials.password, newPassword: "new-password" } });
        assert.equal(result.status, 200);
        assert.equal(result.cookies.length, 2);
        assert.equal(storedUser().forgotPasswordToken, undefined);
        assert.equal((await login()).status, 401);
        assert.equal((await login("new-password")).status, 200);
        assert.equal((await auth("/current-user", { method: "GET", token: accessToken })).status, 401);
        assert.equal((await auth("/refresh-token", { body: { refreshToken } })).status, 401);
    });

    it("returns the same normal forgot-password response for known and unknown accounts", async () => {
        await registration();
        const known = await auth("/forgot-password", { body: { email: credentials.email } });
        const unknown = await auth("/forgot-password", { body: { email: "unknown@example.test" } });
        assert.equal(known.status, 200);
        assert.deepEqual(known.body, unknown.body);
        assert.ok(resetToken());
        assert.equal(sentMail.length, 2);
    });

    it("atomically consumes reset tokens, hashes the new password and revokes sessions", async () => {
        const { accessToken, refreshToken } = await session();
        await auth("/forgot-password", { body: { email: credentials.email } });
        const token = resetToken();
        const results = await Promise.all([
            auth("/reset-password/" + token, { body: { newPassword: "reset-password" } }),
            auth("/reset-password/" + token, { body: { newPassword: "reset-password" } }),
        ]);
        assert.deepEqual(results.map((result) => result.status).sort(), [200, 400]);
        assert.equal(storedUser().tokenVersion, 1);
        assert.equal(storedUser().forgotPasswordToken, undefined);
        assert.equal(storedUser().forgotPasswordTokenExpiry, undefined);
        assert.equal(await bcrypt.compare("reset-password", storedUser().password), true);
        assert.equal((await login()).status, 401);
        assert.equal((await login("reset-password")).status, 200);
        assert.equal((await auth("/current-user", { method: "GET", token: accessToken })).status, 401);
        assert.equal((await auth("/refresh-token", { body: { refreshToken } })).status, 401);
    });

    it("rejects weak passwords and expired/invalid reset tokens without changing credentials", async () => {
        await session();
        await auth("/forgot-password", { body: { email: credentials.email } });
        const token = resetToken();
        const password = storedUser().password;
        for (const newPassword of ["", "x", 123456, { $ne: null }, "🔒".repeat(19)]) {
            assert.equal((await auth("/reset-password/" + token, { body: { newPassword } })).status, 422);
        }
        storedUser().forgotPasswordTokenExpiry = new Date(0).toISOString();
        assert.equal((await auth("/reset-password/" + token, { body: { newPassword: "new-password" } })).status, 400);
        assert.equal((await auth("/reset-password/invalid", { body: { newPassword: "new-password" } })).status, 400);
        assert.equal(storedUser().password, password);
    });

    it("reports mail failures truthfully and supports retry through the existing account", async () => {
        mailFails = true;
        const registered = await registration();
        assert.equal(registered.status, 502);
        assert.match(registered.body.message, /Account created/);
        assert.equal(users.size, 1);
        const { accessToken } = (await login()).body.data;
        assert.equal((await auth("/resend-email-verification", { token: accessToken })).status, 502);
        assert.equal((await auth("/forgot-password", { body: { email: credentials.email } })).status, 502);
        assert.equal(sentMail.length, 0);
        mailFails = false;
        assert.equal((await auth("/resend-email-verification", { token: accessToken })).status, 200);
        assert.ok(verificationToken());
    });

    it("handles legacy accounts/JWTs without tokenVersion and revokes them after logout", async () => {
        await registration();
        delete storedUser().tokenVersion;
        const payload = { _id: storedUser()._id };
        const legacyAccess = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
        const legacyRefresh = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "1d" });
        storedUser().refreshToken = legacyRefresh;
        assert.equal((await auth("/current-user", { method: "GET", token: legacyAccess })).status, 200);
        const refreshed = await auth("/refresh-token", { body: { refreshToken: legacyRefresh } });
        assert.equal(refreshed.status, 200);
        assert.equal((await auth("/logout", { token: legacyAccess })).status, 200);
        assert.equal((await auth("/current-user", { method: "GET", token: legacyAccess })).status, 401);
        assert.equal((await auth("/refresh-token", { body: { refreshToken: refreshed.body.data.refreshToken } })).status, 401);
    });

    it("sets HttpOnly/SameSite cookies and requires Secure cookies in production", async () => {
        await registration();
        process.env.NODE_ENV = "production";
        const result = await login();
        assert.ok(result.cookies.every((cookie) => cookie.includes("HttpOnly") && cookie.includes("Secure") && cookie.includes("SameSite=Lax")));
        const logout = await auth("/logout", { token: result.body.data.accessToken });
        assert.ok(logout.cookies.every((cookie) => cookie.includes("Secure") && cookie.includes("SameSite=Lax")));
    });

    it("sanitizes database errors and returns JSON for malformed request bodies", async () => {
        databaseFails = true;
        const failure = await login();
        assert.equal(failure.status, 500);
        assert.equal(failure.body.message, "Internal server error");
        assert.equal("stack" in failure.body, false);
        const malformed = await fetch(baseUrl + "/api/v1/auth/login", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: "{",
        });
        assert.equal(malformed.status, 400);
        assert.equal((await malformed.json()).message, "Invalid JSON body");
    });

    it("rejects SMTP recipient rejection even when the transport resolves", async () => {
        mailRejected = true;
        assert.equal((await registration()).status, 502);
        assert.equal(users.size, 1);
        mailRejected = false;
        const { accessToken } = (await login()).body.data;
        assert.equal((await auth("/resend-email-verification", { token: accessToken })).status, 200);
    });

    it("rejects untrusted browser origins for cookie writes and permits the configured origin", async () => {
        const { refreshToken } = await session();
        const cookie = "refreshToken=" + refreshToken;
        assert.equal((await auth("/refresh-token", { cookie, headers: { Origin: "https://other.example.test" } })).status, 403);
        assert.equal((await auth("/refresh-token", { cookie, headers: { Origin: "https://client.example.test" } })).status, 200);
    });

    it("fails before account creation when the configured email origin is invalid", async () => {
        const original = process.env.SERVER_URL;
        try {
            process.env.SERVER_URL = "not-a-url";
            const result = await registration();
            assert.equal(result.status, 500);
            assert.equal(users.size, 0);
            assert.equal(sentMail.length, 0);
        } finally {
            process.env.SERVER_URL = original;
        }
    });

    it("applies throttling through the mounted auth router before database operations", async () => {
        let status;
        for (let index = 0; index < 101; index++) {
            status = (await auth("/refresh-token", { body: { refreshToken: "invalid" } })).status;
            if (status === 429) break;
            assert.equal(status, 401);
        }
        assert.equal(status, 429);
        assert.equal(dbCalls, 0);
    });
});

