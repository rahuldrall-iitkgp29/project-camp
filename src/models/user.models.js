import mongoose, { Schema } from "mongoose"; // we import mongoose and schema
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const userSchema = new Schema(
  {
    //we give object as schema
    avatar: {
      //image
      type: {
        url: String,
        localPath: String,
      },
      default: {
        // if user not give an avatar
        url: `https://placehold.co/200x200`,
        localPath: "",
      },
    },
    username: {
      type: String, //username is of type
      required: true, // mongodb do this , means this thing is required to move further
      unique: true, // mdb search in our database for uniqueness of this thing
      lowercase: true, //this save in lower case
      trim: true, // remove extra spaces
      index: true, //we give index to username to make easy in searching
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    fullName: {
      type: String,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, "password is required"], // we pass custom error if someone not enter poassword
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    refreshToken: {
      type: String,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    forgotPasswordToken: {
      type: String,
    },
    forgotPasswordTokenExpiry: {
      // we dont want to store reset pass token for all time in our db , they are custom generated each time
      type: Date,
    },
    emailVerficationToken: {
      type: String,
    },
    emailVerficationTokenExpiry: {
      type: Date,
    },
  }, //first object contains all the fields
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return ; //if smt else then pass is change so dont hash our pass again and again , just on click save
  this.password = await bcrypt.hash(this.password, 10);
  //now auto its go to next operation
});

userSchema.methods.isPasswordCorrect = async function (password) {
  //we just add an method isPasswordCorrect to userSchema
  return await bcrypt.compare(password, this.password);
  //now this hash inpuit pass same no of time and compare the hash from db and input , then return boolean to us [its take some time to done so await]
};

//tokens with data(refresh and access tokens)
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    //this data is come with token as digital sign(payload)
    {
      _id: this._id, //id is gen by mongodb
      email: this.email,
      username: this.username,
      tokenVersion: this.tokenVersion ?? 0,
    },
    process.env.ACCESS_TOKEN_SECRET, //this is method in which token gen
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY },
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    // payload
    {
      _id: this._id,
      tokenVersion: this.tokenVersion ?? 0,
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY, jwtid: crypto.randomUUID() },
  );
};

// temp tokens (for pass reset , forgot type of things) - using inbuilt crypto of node.js
userSchema.methods.genrateTemporaryToken = function () {
  const unhashedToken = crypto.randomBytes(20).toString("hex");
  //gen 20 random bytes -> then make them to string in hex format

  const hashedToken = crypto
    .createHash("sha256")
    .update(unhashedToken)
    .digest("hex");
  //we just hashed that toke in sha256 manner

  const tokenExpiry = Date.now() + 20 * 60 * 1000; // 20 minutes
  return { unhashedToken, hashedToken, tokenExpiry };
};

const user = mongoose.model("user", userSchema);
export default user;
//store user in userSchema form in mongodb and then export it as object:user to use

