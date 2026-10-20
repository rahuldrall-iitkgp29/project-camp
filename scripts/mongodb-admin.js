import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import mongoose from "mongoose";
import { runtimeDirectory, loadTestUri, verifyLocalServer, verifyTestConnection } from "./lib/mongodb-test.js";

const action = process.argv[2];
if (!["init", "status", "stop", "smoke"].includes(action)) throw new Error("Expected init, status, stop or smoke.");
const client = new mongoose.mongo.MongoClient("mongodb://127.0.0.1:27018/pcb_test?directConnection=true", {
  serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, socketTimeoutMS: 10000,
});
try {
  await client.connect();
  const admin = client.db("admin");
  const parsed = await verifyLocalServer(client, { primary: false });
  const state = JSON.parse(fs.readFileSync(path.join(runtimeDirectory, "instance.json"), "utf8").replace(/^\uFEFF/, ""));
  const serverStatus = await admin.command({ serverStatus: 1 });
  assert.equal(serverStatus.pid, state.pid, "Server PID does not match the instance started by mongodb.ps1");
  if (action === "init") {
    try {
      const { config } = await admin.command({ replSetGetConfig: 1 });
      assert.equal(config._id, "rs0");
      assert.equal(config.members.length, 1);
      assert.equal(config.members[0].host, "127.0.0.1:27018");
      console.log("Existing rs0 configuration retained.");
    } catch (error) {
      if (error.code !== 94) throw error; // Only NotYetInitialized permits initiation.
      await admin.command({ replSetInitiate: { _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27018" }] } });
      console.log("Initialized single-member rs0.");
    }
    const deadline = Date.now() + 60000;
    while (!(await admin.command({ hello: 1 })).isWritablePrimary) {
      if (Date.now() > deadline) throw new Error("PRIMARY election timed out; inspect mongod.log. Data has been retained.");
      await delay(500);
    }
  }
  if (action === "stop") {
    // The PowerShell owner checks and this PID/config check must both pass.
    try { await admin.command({ shutdown: 1, timeoutSecs: 10 }); }
    catch (error) {
      // A successful shutdown closes the socket before it can return a response.
      if (!(error instanceof mongoose.mongo.MongoNetworkError)) throw error;
    }
    console.log("Shutdown requested for the verified project instance.");
  } else {
    await verifyLocalServer(client);
    const status = await admin.command({ replSetGetStatus: 1 });
    console.log(JSON.stringify({ version: serverStatus.version, pid: serverStatus.pid,
      dbPath: parsed.storage.dbPath, logPath: parsed.systemLog.path, bindIp: parsed.net.bindIp,
      port: parsed.net.port, replicaSet: status.set, state: status.members[0].stateStr }, null, 2));
    if (action === "smoke") {
      const uri = loadTestUri();
      const connection = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 });
      const collectionName = `pcb_smoke_${crypto.randomUUID().replaceAll("-", "")}`;
      let created = false;
      try {
        await connection.asPromise();
        await verifyTestConnection(connection, uri);
        await connection.db.createCollection(collectionName);
        created = true;
        const collection = connection.db.collection(collectionName);
        const { insertedId } = await collection.insertOne({ purpose: "PCB local smoke test" });
        assert.equal((await collection.findOne({ _id: insertedId })).purpose, "PCB local smoke test");
        assert.equal((await collection.deleteOne({ _id: insertedId })).deletedCount, 1);
        assert.equal(await collection.countDocuments(), 0);
        console.log(`Mongoose ${mongoose.version}: insert/read/delete passed against ${uri}`);
      } finally {
        try {
          if (created) {
            await verifyTestConnection(connection, uri);
            await connection.db.dropCollection(collectionName);
          }
        } finally { await connection.close(); }
      }
    }
  }
} catch (error) {
  console.error(`Local MongoDB ${action} failed: ${error.message}`);
  process.exitCode = 1;
} finally { await client.close(); }
