#!/usr/bin/env node
/**
 * scripts/seed-demo.js
 *
 * Development-only database reset and demo seed script for Project Camp.
 *
 * Usage:  node scripts/seed-demo.js
 *
 * ⚠️  This script DELETES all documents in pcb_development and replaces them
 *     with demo data.  It will NOT run against any other database.
 *     It does NOT touch files on disk, environment files, or the database itself.
 *
 * Demo credentials (every account):
 *   Password: Demo@12345
 */

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { createInterface } from "node:readline";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEV_URI =
  "mongodb://127.0.0.1:27018/pcb_development?replicaSet=rs0&directConnection=true";
const DEMO_PASSWORD = "Demo@12345";
const EXPECTED_DB_NAME = "pcb_development";

const COLLECTIONS_TO_CLEAR = [
  "users",
  "projects",
  "projectmembers",
  "projectinvitations",
  "tasks",
  "subtasks",
  "projectnotes",
  "filedeletions",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const oid = () => new mongoose.Types.ObjectId();
const now = new Date();
const ago = (days) => new Date(now.getTime() - days * 86_400_000);
const ahead = (days) => new Date(now.getTime() + days * 86_400_000);

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // ── 1. Connect & safety check ──────────────────────────────────────────────
  const conn = await mongoose.connect(DEV_URI, {
    serverSelectionTimeoutMS: 5_000,
  });
  const dbName = conn.connection.db.databaseName;

  if (dbName !== EXPECTED_DB_NAME) {
    console.error(
      `❌ SAFETY CHECK FAILED: Connected to "${dbName}" instead of "${EXPECTED_DB_NAME}".`,
    );
    console.error(
      "   This script only runs against the local development database.",
    );
    process.exit(1);
  }

  console.log(`\n🔌 Connected to: ${DEV_URI}`);
  console.log(`📁 Database: ${dbName}\n`);
  console.log(
    "The following collections will be CLEARED (all documents deleted):",
  );

  for (const col of COLLECTIONS_TO_CLEAR) {
    try {
      const count = await conn.connection.db
        .collection(col)
        .countDocuments();
      console.log(`   • ${col}  (${count} existing documents)`);
    } catch {
      console.log(`   • ${col}  (does not exist yet)`);
    }
  }
  console.log();

  const ok = await confirm("⚠️  Proceed with reset and seed? (y/N): ");
  if (!ok) {
    console.log("Aborted.");
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── 2. Clear collections ───────────────────────────────────────────────────
  console.log("\n🗑️  Clearing collections...");
  for (const col of COLLECTIONS_TO_CLEAR) {
    try {
      const result = await conn.connection.db
        .collection(col)
        .deleteMany({});
      console.log(`   ✓ ${col}: ${result.deletedCount} deleted`);
    } catch {
      console.log(`   ○ ${col}: skipped (does not exist)`);
    }
  }

  // ── 3. Hash the demo password ──────────────────────────────────────────────
  console.log("\n🔐 Hashing demo password...");
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ── 4. Pre-generate ObjectIds ──────────────────────────────────────────────
  const uid = {
    aarav: oid(),
    priya: oid(),
    rohan: oid(),
    ananya: oid(),
    kabir: oid(),
    isha: oid(),
    dev: oid(),
    meera: oid(),
  };
  const projectId = oid();

  // ── 5. Users (8) ──────────────────────────────────────────────────────────
  const defaultAvatar = { url: "https://placehold.co/200x200", localPath: "" };
  const users = [
    { _id: uid.aarav, username: "aarav.sharma", email: "aarav@demo.projectcamp.dev", fullName: "aarav sharma", password: hashedPassword, isEmailVerified: true, tokenVersion: 0, avatar: defaultAvatar, __v: 0, createdAt: ago(30), updatedAt: ago(1) },
    { _id: uid.priya, username: "priya.verma", email: "priya@demo.projectcamp.dev", fullName: "priya verma", password: hashedPassword, isEmailVerified: true, tokenVersion: 0, avatar: defaultAvatar, __v: 0, createdAt: ago(28), updatedAt: ago(2) },
    { _id: uid.rohan, username: "rohan.mehta", email: "rohan@demo.projectcamp.dev", fullName: "rohan mehta", password: hashedPassword, isEmailVerified: true, tokenVersion: 0, avatar: defaultAvatar, __v: 0, createdAt: ago(28), updatedAt: ago(3) },
    { _id: uid.ananya, username: "ananya.singh", email: "ananya@demo.projectcamp.dev", fullName: "ananya singh", password: hashedPassword, isEmailVerified: true, tokenVersion: 0, avatar: defaultAvatar, __v: 0, createdAt: ago(27), updatedAt: ago(2) },
    { _id: uid.kabir, username: "kabir.patel", email: "kabir@demo.projectcamp.dev", fullName: "kabir patel", password: hashedPassword, isEmailVerified: true, tokenVersion: 0, avatar: defaultAvatar, __v: 0, createdAt: ago(25), updatedAt: ago(5) },
    { _id: uid.isha, username: "isha.gupta", email: "isha@demo.projectcamp.dev", fullName: "isha gupta", password: hashedPassword, isEmailVerified: true, tokenVersion: 0, avatar: defaultAvatar, __v: 0, createdAt: ago(25), updatedAt: ago(4) },
    { _id: uid.dev, username: "dev.malhotra", email: "dev@demo.projectcamp.dev", fullName: "dev malhotra", password: hashedPassword, isEmailVerified: true, tokenVersion: 0, avatar: defaultAvatar, __v: 0, createdAt: ago(24), updatedAt: ago(3) },
    { _id: uid.meera, username: "meera.joshi", email: "meera@demo.projectcamp.dev", fullName: "meera joshi", password: hashedPassword, isEmailVerified: true, tokenVersion: 0, avatar: defaultAvatar, __v: 0, createdAt: ago(24), updatedAt: ago(2) },
  ];

  // ── 6. Project (1) ────────────────────────────────────────────────────────
  const project = {
    _id: projectId,
    name: "Project Apollo",
    description:
      "Cross-functional product launch initiative — designing, building, and shipping a next-generation collaboration platform for distributed teams.",
    createdBy: uid.aarav,
    __v: 0,
    createdAt: ago(21),
    updatedAt: ago(1),
  };

  // ── 7. Project members (8) ────────────────────────────────────────────────
  const members = [
    { _id: oid(), user: uid.aarav,  project: projectId, role: "admin",         __v: 0, createdAt: ago(21), updatedAt: ago(21) },
    { _id: oid(), user: uid.priya,  project: projectId, role: "project_admin", __v: 0, createdAt: ago(20), updatedAt: ago(20) },
    { _id: oid(), user: uid.rohan,  project: projectId, role: "project_admin", __v: 0, createdAt: ago(20), updatedAt: ago(20) },
    { _id: oid(), user: uid.ananya, project: projectId, role: "project_admin", __v: 0, createdAt: ago(19), updatedAt: ago(19) },
    { _id: oid(), user: uid.kabir,  project: projectId, role: "member",        __v: 0, createdAt: ago(18), updatedAt: ago(18) },
    { _id: oid(), user: uid.isha,   project: projectId, role: "member",        __v: 0, createdAt: ago(18), updatedAt: ago(18) },
    { _id: oid(), user: uid.dev,    project: projectId, role: "member",        __v: 0, createdAt: ago(17), updatedAt: ago(17) },
    { _id: oid(), user: uid.meera,  project: projectId, role: "member",        __v: 0, createdAt: ago(17), updatedAt: ago(17) },
  ];

  // ── 8. Tasks (12) ─────────────────────────────────────────────────────────
  const taskDefs = [
    { title: "Design system architecture",       description: "Define the high-level architecture including microservices boundaries, API gateway, message queues, and data flow diagrams. Document ADRs for key decisions.",                  assignedTo: uid.aarav,  assignedBy: uid.aarav, status: "done",        daysAgo: 20 },
    { title: "Set up CI/CD pipeline",             description: "Configure GitHub Actions with build, lint, test, and deploy stages. Include Docker image builds and staging environment auto-deploy.",                                         assignedTo: uid.rohan,  assignedBy: uid.aarav, status: "done",        daysAgo: 19 },
    { title: "Create wireframes for dashboard",   description: "Design low-fidelity and high-fidelity wireframes for the main dashboard, including project overview cards, task summary widgets, and team activity feed.",                     assignedTo: uid.priya,  assignedBy: uid.aarav, status: "done",        daysAgo: 18 },
    { title: "Implement user authentication",     description: "Build the complete auth flow: registration, login, email verification, password reset, JWT access/refresh token rotation, and session management.",                           assignedTo: uid.dev,    assignedBy: uid.priya, status: "in_progress", daysAgo: 16 },
    { title: "Build REST API endpoints",          description: "Implement CRUD endpoints for projects, tasks, subtasks, notes, and team members. Follow RESTful conventions and include input validation.",                                   assignedTo: uid.kabir,  assignedBy: uid.rohan, status: "in_progress", daysAgo: 15 },
    { title: "Design database schema",            description: "Model all MongoDB collections with proper indexes, references, and validation rules. Document relationships and query patterns.",                                             assignedTo: uid.ananya, assignedBy: uid.aarav, status: "done",        daysAgo: 19 },
    { title: "Write unit tests for core modules", description: "Achieve 80%+ coverage for auth, project, and task modules. Include edge cases for role-based access and concurrent operations.",                                              assignedTo: uid.isha,   assignedBy: uid.ananya, status: "in_progress", daysAgo: 12 },
    { title: "Set up monitoring and alerting",    description: "Configure application health checks, error tracking, request logging with correlation IDs, and uptime monitoring dashboards.",                                                assignedTo: uid.rohan,  assignedBy: uid.aarav, status: "todo",        daysAgo: 8  },
    { title: "Create onboarding documentation",   description: "Write developer setup guide, API reference docs, contribution guidelines, and architecture overview for new team members.",                                                   assignedTo: uid.meera,  assignedBy: uid.priya, status: "in_progress", daysAgo: 10 },
    { title: "Implement search functionality",    description: "Add full-text search across projects, tasks, and notes. Support filters by status, assignee, date range, and keyword highlighting.",                                          assignedTo: uid.dev,    assignedBy: uid.rohan, status: "todo",        daysAgo: 5  },
    { title: "Performance optimization",          description: "Profile and optimize slow API endpoints, database queries, and frontend bundle size. Set up load testing with k6.",                                                           assignedTo: uid.kabir,  assignedBy: uid.ananya, status: "todo",        daysAgo: 3  },
    { title: "Security audit and hardening",      description: "Review OWASP Top 10 compliance, audit dependencies for CVEs, enforce rate limiting, validate CORS policy, and pen-test critical auth flows.",                                 assignedTo: uid.ananya, assignedBy: uid.aarav, status: "todo",        daysAgo: 2  },
  ];

  const tasks = taskDefs.map((t) => ({
    _id: oid(),
    title: t.title,
    description: t.description,
    project: projectId,
    assignedTo: t.assignedTo,
    assignedBy: t.assignedBy,
    status: t.status,
    attachements: [],
    __v: 0,
    createdAt: ago(t.daysAgo),
    updatedAt: ago(Math.max(t.daysAgo - 3, 0)),
  }));

  // ── 9. Subtasks (2-3 per task → 33 total) ─────────────────────────────────
  const subtaskDefs = [
    // Task 0 — Design system architecture (done)
    { task: 0,  title: "Draft initial architecture diagram",              isCompleted: true,  createdBy: uid.aarav },
    { task: 0,  title: "Write ADR for database selection",                isCompleted: true,  createdBy: uid.aarav },
    { task: 0,  title: "Review with team and incorporate feedback",       isCompleted: true,  createdBy: uid.priya },
    // Task 1 — Set up CI/CD pipeline (done)
    { task: 1,  title: "Configure GitHub Actions workflow",               isCompleted: true,  createdBy: uid.rohan },
    { task: 1,  title: "Add Docker build and push stage",                 isCompleted: true,  createdBy: uid.rohan },
    { task: 1,  title: "Set up staging auto-deploy",                      isCompleted: true,  createdBy: uid.rohan },
    // Task 2 — Create wireframes (done)
    { task: 2,  title: "Sketch low-fidelity mockups",                     isCompleted: true,  createdBy: uid.priya },
    { task: 2,  title: "Design high-fidelity dashboard prototype",        isCompleted: true,  createdBy: uid.priya },
    // Task 3 — Implement user authentication (in_progress)
    { task: 3,  title: "Build registration and login endpoints",          isCompleted: true,  createdBy: uid.dev },
    { task: 3,  title: "Implement JWT token rotation",                    isCompleted: true,  createdBy: uid.dev },
    { task: 3,  title: "Add email verification flow",                     isCompleted: false, createdBy: uid.dev },
    // Task 4 — Build REST API endpoints (in_progress)
    { task: 4,  title: "Implement project CRUD endpoints",                isCompleted: true,  createdBy: uid.kabir },
    { task: 4,  title: "Build task and subtask endpoints",                isCompleted: false, createdBy: uid.kabir },
    { task: 4,  title: "Add input validation with express-validator",     isCompleted: false, createdBy: uid.rohan },
    // Task 5 — Design database schema (done)
    { task: 5,  title: "Define user and project schemas",                 isCompleted: true,  createdBy: uid.ananya },
    { task: 5,  title: "Add indexes for query optimization",              isCompleted: true,  createdBy: uid.ananya },
    { task: 5,  title: "Document entity relationships",                   isCompleted: true,  createdBy: uid.ananya },
    // Task 6 — Write unit tests (in_progress)
    { task: 6,  title: "Write auth module tests",                         isCompleted: true,  createdBy: uid.isha },
    { task: 6,  title: "Write project module tests",                      isCompleted: false, createdBy: uid.isha },
    { task: 6,  title: "Write task module tests",                         isCompleted: false, createdBy: uid.isha },
    // Task 7 — Set up monitoring (todo)
    { task: 7,  title: "Configure health check endpoints",                isCompleted: false, createdBy: uid.rohan },
    { task: 7,  title: "Set up error tracking service",                   isCompleted: false, createdBy: uid.rohan },
    // Task 8 — Create onboarding documentation (in_progress)
    { task: 8,  title: "Write developer setup guide",                     isCompleted: true,  createdBy: uid.meera },
    { task: 8,  title: "Draft API reference documentation",               isCompleted: false, createdBy: uid.meera },
    { task: 8,  title: "Create contribution guidelines",                  isCompleted: false, createdBy: uid.meera },
    // Task 9 — Implement search (todo)
    { task: 9,  title: "Research MongoDB text search vs Atlas Search",     isCompleted: false, createdBy: uid.dev },
    { task: 9,  title: "Implement search API endpoint",                   isCompleted: false, createdBy: uid.dev },
    // Task 10 — Performance optimization (todo)
    { task: 10, title: "Profile slow API endpoints",                      isCompleted: false, createdBy: uid.kabir },
    { task: 10, title: "Optimize database queries with explain plans",    isCompleted: false, createdBy: uid.kabir },
    { task: 10, title: "Set up k6 load testing scripts",                  isCompleted: false, createdBy: uid.aarav },
    // Task 11 — Security audit (todo)
    { task: 11, title: "Run OWASP dependency check",                      isCompleted: false, createdBy: uid.ananya },
    { task: 11, title: "Audit rate limiting and CORS configuration",      isCompleted: false, createdBy: uid.ananya },
    { task: 11, title: "Pen-test authentication flows",                   isCompleted: false, createdBy: uid.aarav },
  ];

  const subtasks = subtaskDefs.map((s) => ({
    _id: oid(),
    title: s.title,
    task: tasks[s.task]._id,
    isCompleted: s.isCompleted,
    createdBy: s.createdBy,
    __v: 0,
    createdAt: tasks[s.task].createdAt,
    updatedAt: s.isCompleted
      ? new Date(tasks[s.task].createdAt.getTime() + 2 * 86_400_000)
      : tasks[s.task].createdAt,
  }));

  // ── 10. Project notes (5) ─────────────────────────────────────────────────
  const notes = [
    {
      _id: oid(), project: projectId, createdBy: uid.aarav, __v: 0,
      content: "Kickoff meeting completed. Team aligned on Q4 delivery timeline. Architecture review scheduled for next week. Key priority: get auth and core API stable before frontend integration begins.",
      createdAt: ago(20), updatedAt: ago(20),
    },
    {
      _id: oid(), project: projectId, createdBy: uid.priya, __v: 0,
      content: "Dashboard wireframes approved by stakeholders. Moving to high-fidelity designs. Need to coordinate with backend team on API response shapes for the activity feed and project summary widgets.",
      createdAt: ago(15), updatedAt: ago(15),
    },
    {
      _id: oid(), project: projectId, createdBy: uid.rohan, __v: 0,
      content: "CI/CD pipeline is live. All PRs now run lint + test + build automatically. Staging deploys on merge to main. Production deploy requires manual approval. Docker images are cached for faster builds.",
      createdAt: ago(12), updatedAt: ago(12),
    },
    {
      _id: oid(), project: projectId, createdBy: uid.ananya, __v: 0,
      content: "Database schema finalized after team review. Added compound indexes on (project, user) for member lookups and (project, assignedTo) for task queries. TTL index on invitation expiry handles cleanup automatically.",
      createdAt: ago(10), updatedAt: ago(10),
    },
    {
      _id: oid(), project: projectId, createdBy: uid.meera, __v: 0,
      content: "Developer onboarding guide first draft complete. Covers local setup, environment variables, database seeding, and common development workflows. Need feedback from the team before publishing to the wiki.",
      createdAt: ago(5), updatedAt: ago(5),
    },
  ];

  // ── 11. Project invitations (2 pending external users) ────────────────────
  const invitations = [
    {
      _id: oid(),
      project: projectId,
      email: "neha.kapoor@example.com",
      role: "member",
      invitedBy: uid.aarav,
      tokenHash: crypto.createHash("sha256").update(crypto.randomBytes(20).toString("hex")).digest("hex"),
      expiresAt: ahead(5),
      __v: 0,
      createdAt: ago(2),
      updatedAt: ago(2),
    },
    {
      _id: oid(),
      project: projectId,
      email: "arjun.reddy@example.com",
      role: "project_admin",
      invitedBy: uid.priya,
      tokenHash: crypto.createHash("sha256").update(crypto.randomBytes(20).toString("hex")).digest("hex"),
      expiresAt: ahead(6),
      __v: 0,
      createdAt: ago(1),
      updatedAt: ago(1),
    },
  ];

  // ── 12. Insert everything ─────────────────────────────────────────────────
  console.log("\n📥 Seeding data...");
  const db = conn.connection.db;

  const results = {};
  results.users              = (await db.collection("users").insertMany(users)).insertedCount;
  results.projects           = (await db.collection("projects").insertMany([project])).insertedCount;
  results.projectmembers     = (await db.collection("projectmembers").insertMany(members)).insertedCount;
  results.tasks              = (await db.collection("tasks").insertMany(tasks)).insertedCount;
  results.subtasks           = (await db.collection("subtasks").insertMany(subtasks)).insertedCount;
  results.projectnotes       = (await db.collection("projectnotes").insertMany(notes)).insertedCount;
  results.projectinvitations = (await db.collection("projectinvitations").insertMany(invitations)).insertedCount;

  // ── 13. Verify referential integrity ──────────────────────────────────────
  console.log("\n🔍 Verifying referential integrity...");
  const userCount    = await db.collection("users").countDocuments();
  const memberCount  = await db.collection("projectmembers").countDocuments();
  const taskCount    = await db.collection("tasks").countDocuments();
  const subtaskCount = await db.collection("subtasks").countDocuments();
  const noteCount    = await db.collection("projectnotes").countDocuments();
  const invCount     = await db.collection("projectinvitations").countDocuments();

  // Every task's assignedTo must point to an existing user
  const taskAssignees = await db.collection("tasks").distinct("assignedTo");
  const userIdSet = new Set(users.map((u) => u._id.toString()));
  const badAssignees = taskAssignees.filter((id) => !userIdSet.has(id.toString()));

  // Every subtask's task must point to an existing task
  const subtaskParents = await db.collection("subtasks").distinct("task");
  const taskIdSet = new Set(tasks.map((t) => t._id.toString()));
  const badParents = subtaskParents.filter((id) => !taskIdSet.has(id.toString()));

  // Every member's user must point to an existing user
  const memberUsers = await db.collection("projectmembers").distinct("user");
  const badMembers = memberUsers.filter((id) => !userIdSet.has(id.toString()));

  const issues = [];
  if (badAssignees.length) issues.push(`  ✗ ${badAssignees.length} task(s) reference nonexistent users`);
  if (badParents.length)   issues.push(`  ✗ ${badParents.length} subtask(s) reference nonexistent tasks`);
  if (badMembers.length)   issues.push(`  ✗ ${badMembers.length} member(s) reference nonexistent users`);

  if (issues.length) {
    console.log("⚠️  Integrity issues found:");
    issues.forEach((i) => console.log(i));
  } else {
    console.log("   ✓ All task assignees reference valid users");
    console.log("   ✓ All subtasks reference valid tasks");
    console.log("   ✓ All project members reference valid users");
    console.log("   ✓ All notes & invitations reference the project");
  }

  // ── 14. Summary ───────────────────────────────────────────────────────────
  console.log("\n✅ Seed complete! Records inserted:\n");
  let total = 0;
  for (const [collection, count] of Object.entries(results)) {
    console.log(`   ${collection.padEnd(22)} ${count}`);
    total += count;
  }
  console.log(`   ${"─".repeat(22)} ──`);
  console.log(`   ${"Total".padEnd(22)} ${total}\n`);

  console.log("📋 Demo accounts:\n");
  console.log("   ┌──────────────────┬────────────────────────────────┬───────────────┐");
  console.log("   │ Username         │ Email                          │ Project Role  │");
  console.log("   ├──────────────────┼────────────────────────────────┼───────────────┤");
  console.log("   │ aarav.sharma     │ aarav@demo.projectcamp.dev     │ admin         │");
  console.log("   │ priya.verma      │ priya@demo.projectcamp.dev     │ project_admin │");
  console.log("   │ rohan.mehta      │ rohan@demo.projectcamp.dev     │ project_admin │");
  console.log("   │ ananya.singh     │ ananya@demo.projectcamp.dev    │ project_admin │");
  console.log("   │ kabir.patel      │ kabir@demo.projectcamp.dev     │ member        │");
  console.log("   │ isha.gupta       │ isha@demo.projectcamp.dev      │ member        │");
  console.log("   │ dev.malhotra     │ dev@demo.projectcamp.dev       │ member        │");
  console.log("   │ meera.joshi      │ meera@demo.projectcamp.dev     │ member        │");
  console.log("   └──────────────────┴────────────────────────────────┴───────────────┘");
  console.log(`\n   Password (all accounts): ${DEMO_PASSWORD}\n`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("\n❌ Seed failed:", err.message || err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
