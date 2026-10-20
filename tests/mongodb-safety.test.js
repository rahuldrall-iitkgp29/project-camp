import assert from "node:assert/strict";
import { it } from "node:test";
import { testUri, validateTestUri, loadTestUri, verifyLocalServer, verifyTestConnection } from "../scripts/lib/mongodb-test.js";

it("rejects remote, disguised, credentialed and unintended MongoDB test targets", () => {
  assert.equal(validateTestUri(testUri), testUri);
  const unsafe = [undefined, "", "mongodb+srv://cluster.example.test/pcb_test", testUri.replace("127.0.0.1", "localhost"),
    testUri.replace("127.0.0.1", "127.0.0.1.example.test"), testUri.replace("127.0.0.1", "127.1"),
    testUri.replace("127.0.0.1", "user:password@127.0.0.1"), testUri.replace("27018", "27017"),
    testUri.replace("pcb_test", "pcb"), testUri.replace("pcb_test", "pcb_test_disposable"),
    testUri.replace("pcb_test", "%70cb_test"), testUri.replace("rs0", "production"),
    testUri.replace("directConnection=true", "directConnection=false"), testUri + "&proxyHost=remote.example.test",
    testUri + "&replicaSet=other", testUri.replace("127.0.0.1:27018", "127.0.0.1:27018,remote.example.test:27017")];
  for (const uri of unsafe) assert.throws(() => validateTestUri(uri), /MONGODB_TEST_URI/);
});

it("fails closed without the dedicated test variable and never uses either legacy URI", () => {
  const env = { MONGO_URI: "mongodb+srv://secret:secret@production.example.test/pcb", MONGO_TEST_URI: testUri };
  const envPath = new URL("./nonexistent-test-env", import.meta.url);
  assert.throws(() => loadTestUri({ env, envPath }), /MONGODB_TEST_URI is required/);
  assert.throws(() => loadTestUri({ env: { ...env, MONGODB_TEST_URI: "" } }), /MONGODB_TEST_URI is required/);
  assert.equal(loadTestUri({ env: { MONGODB_TEST_URI: testUri } }), testUri);
});

it("refuses cleanup on the wrong database or an unverified server", async () => {
  let contacted = false;
  const connection = { readyState: 1, name: "pcb", getClient: () => { contacted = true; } };
  await assert.rejects(verifyTestConnection(connection, testUri), /Cleanup refused/);
  assert.equal(contacted, false);
  const client = { db: () => ({ command: async () => ({ parsed: {
    net: { bindIp: "0.0.0.0", port: 27018 }, replication: { replSetName: "rs0" },
  } }) }) };
  await assert.rejects(verifyLocalServer(client), /runtime configuration/);
});
