import mongoose from "mongoose";

const email = process.argv[2];
const uri = "mongodb://127.0.0.1:27018/pcb_development?replicaSet=rs0&directConnection=true";

try {
  const conn = await mongoose.connect(uri);
  const users = conn.connection.collection("users");

  if (!email) {
    // If no email provided, list all unverified users or verify all
    const result = await users.updateMany(
      { isEmailVerified: false },
      { $set: { isEmailVerified: true }, $unset: { emailVerficationToken: 1, emailVerficationTokenExpiry: 1 } }
    );
    console.log(`✅ Marked ${result.modifiedCount} unverified account(s) as verified in pcb_development!`);
  } else {
    const result = await users.updateOne(
      { email: email.trim() },
      { $set: { isEmailVerified: true }, $unset: { emailVerficationToken: 1, emailVerficationTokenExpiry: 1 } }
    );
    if (result.matchedCount === 0) {
      console.log(`⚠️ No user found with email: ${email}`);
    } else {
      console.log(`✅ User ${email} is now verified in pcb_development!`);
    }
  }
} catch (error) {
  console.error("❌ Failed to verify user:", error.message);
} finally {
  await mongoose.disconnect();
  process.exit(0);
}
