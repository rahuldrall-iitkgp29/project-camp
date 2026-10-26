import mongoose from "mongoose";

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid")
    throw new Error(
      "MongoDB transactions require a replica set or sharded cluster",
    );
  // Includes the declared membership/invitation unique indexes. Do not serve with failed indexes.
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init()),
  );
  console.log("✅ mongodb connected");
};

export default connectDB;
