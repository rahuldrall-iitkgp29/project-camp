import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

export const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
export const testUri =
  "mongodb://127.0.0.1:27018/pcb_test?replicaSet=rs0&directConnection=true";
export const runtimeDirectory = path.join(
  projectRoot,
  ".local/mongodb-runtime",
);

export function validateTestUri(uri) {
  if (typeof uri !== "string" || !uri) {
    throw new Error(
      "MONGODB_TEST_URI is required for integration tests; MONGO_URI is never a fallback.",
    );
  }
  // Deliberately accept only this literal IP, port, database and these two options.
  // No DNS, SRV discovery, credentials, multiple seeds, encoding or extra options.
  if (
    ![
      testUri,
      "mongodb://127.0.0.1:27018/pcb_test?directConnection=true&replicaSet=rs0",
    ].includes(uri)
  ) {
    throw new Error(
      "Unsafe MONGODB_TEST_URI: expected 127.0.0.1:27018, pcb_test, replicaSet=rs0 and directConnection=true only.",
    );
  }
  return uri;
}

export function loadTestUri({
  env = process.env,
  envPath = path.join(projectRoot, ".env"),
} = {}) {
  // Read only the dedicated key; never load application secrets into process.env.
  let uri = env.MONGODB_TEST_URI;
  if (uri === undefined) {
    if (fs.existsSync(envPath))
      uri = dotenv.parse(fs.readFileSync(envPath)).MONGODB_TEST_URI;
  }
  return validateTestUri(uri);
}

export async function verifyLocalServer(client, { primary = true } = {}) {
  const admin = client.db("admin");
  const { parsed } = await admin.command({ getCmdLineOpts: 1 });
  const expectedData = path.join(projectRoot, ".local/mongodb-data");
  const expectedLog = path.join(projectRoot, ".local/mongodb-logs/mongod.log");
  const samePath = (actual, expected) =>
    typeof actual === "string" &&
    path.resolve(actual).toLowerCase() === path.resolve(expected).toLowerCase();
  if (
    parsed.net?.bindIp !== "127.0.0.1" ||
    parsed.net?.port !== 27018 ||
    parsed.replication?.replSetName !== "rs0" ||
    !samePath(parsed.storage?.dbPath, expectedData) ||
    !samePath(parsed.systemLog?.path, expectedLog)
  ) {
    throw new Error(
      "MongoDB runtime configuration is not this project's isolated loopback replica set.",
    );
  }
  if (primary) {
    const hello = await admin.command({ hello: 1 });
    const { config } = await admin.command({ replSetGetConfig: 1 });
    if (
      hello.setName !== "rs0" ||
      !hello.isWritablePrimary ||
      config._id !== "rs0" ||
      config.members.length !== 1 ||
      config.members[0].host !== "127.0.0.1:27018"
    ) {
      throw new Error("Expected single-member rs0 PRIMARY at 127.0.0.1:27018.");
    }
  }
  return parsed;
}

export async function verifyTestConnection(connection, uri) {
  validateTestUri(uri);
  if (connection.readyState !== 1 || connection.name !== "pcb_test") {
    throw new Error(
      "Cleanup refused: connection must target the dedicated pcb_test database.",
    );
  }
  await verifyLocalServer(connection.getClient());
}
