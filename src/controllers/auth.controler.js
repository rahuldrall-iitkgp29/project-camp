import User from "../models/user.models.js";
import { ApiRespones } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  emailVerficationMailgenContent,
  forgotPasswordMailgenContent,
  sendingEmail,
} from "../utils/mail.utils.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
const dummyPasswordHash = bcrypt.hash(
  "PCB invalid account timing placeholder",
  10,
);

const publicUserFields =
  "-password -refreshToken -emailVerficationToken -emailVerficationTokenExpiry -forgotPasswordToken -forgotPasswordTokenExpiry -tokenVersion -__v -avatar.localPath";

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
});

// Existing accounts/JWTs without a version remain valid until their first revocation.
const tokenVersionFilter = (version = 0) =>
  version === 0
    ? { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] }
    : { tokenVersion: version };

const getTokenUrl = (baseUrl, path) => {
  try {
    const url = new URL(baseUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error("Invalid public URL");
    }
    url.pathname = path.startsWith("/")
      ? path
      : `${url.pathname.replace(/\/$/, "")}/${path}`;
    return url.toString();
  } catch {
    throw new ApiError(500, "Email link URL is not configured correctly");
  }
};

const hashTemporaryToken = (token) => {
  if (typeof token !== "string" || !/^[a-f0-9]{40}$/i.test(token)) {
    throw new ApiError(400, "Invalid or expired token");
  }
  return crypto.createHash("sha256").update(token).digest("hex");
};

const genAccessAndRefreshToken = async (
  userId,
  { incomingRefreshToken, expectedPassword, expectedTokenVersion } = {},
) => {
  const user = await User.findById(userId);
  if (
    !user ||
    (expectedPassword !== undefined && user.password !== expectedPassword) ||
    (expectedTokenVersion !== undefined &&
      (user.tokenVersion ?? 0) !== expectedTokenVersion) ||
    (incomingRefreshToken !== undefined &&
      user.refreshToken !== incomingRefreshToken)
  ) {
    throw new ApiError(401, "Invalid or expired session");
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  // Compare and replace in one operation: reset/logout/another refresh must win safely.
  const updatedUser = await User.findOneAndUpdate(
    {
      _id: user._id,
      password: user.password,
      ...tokenVersionFilter(user.tokenVersion ?? 0),
      ...(incomingRefreshToken !== undefined
        ? { refreshToken: incomingRefreshToken }
        : {}),
    },
    { $set: { refreshToken } },
    { returnDocument: "after" },
  );
  if (!updatedUser) {
    throw new ApiError(401, "Invalid or expired session");
  }
  return { accessToken, refreshToken };
};

const registerUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  const existedUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existedUser) {
    throw new ApiError(409, "Username or email already exists");
  }

  const user = new User({ email, password, username, isEmailVerified: false });
  const { unhashedToken, hashedToken, tokenExpiry } =
    user.genrateTemporaryToken();
  const verificationUrl = getTokenUrl(
    process.env.SERVER_URL,
    `/api/v1/auth/verify-email/${unhashedToken}`,
  );
  user.emailVerficationToken = hashedToken;
  user.emailVerficationTokenExpiry = tokenExpiry;
  // One save applies the password hook and persists verification state together.
  await user.save();

  try {
    await sendingEmail({
      email: user.email,
      subject: "Please verify your email",
      mailgenContent: emailVerficationMailgenContent(
        user.username,
        verificationUrl,
      ),
    });
  } catch {
    throw new ApiError(
      502,
      "Account created, but verification email could not be sent. Log in to resend verification.",
    );
  }

  const createdUser = await User.findById(user._id).select(publicUserFields);
  return res
    .status(201)
    .json(
      new ApiRespones(
        201,
        { user: createdUser },
        "User registered successfully and verification email has been sent",
      ),
    );
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  const passwordMatches = user
    ? await user.isPasswordCorrect(password)
    : await bcrypt.compare(password, await dummyPasswordHash);
  if (!user || !passwordMatches) {
    throw new ApiError(401, "Invalid email or password");
  }

  const { accessToken, refreshToken } = await genAccessAndRefreshToken(
    user._id,
    {
      expectedPassword: user.password,
      expectedTokenVersion: user.tokenVersion ?? 0,
    },
  );
  const loggedInUser = await User.findById(user._id).select(publicUserFields);
  if (!loggedInUser) {
    throw new ApiError(401, "Invalid email or password");
  }
  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions())
    .cookie("refreshToken", refreshToken, cookieOptions())
    .json(
      new ApiRespones(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User login successfully",
      ),
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $set: { refreshToken: "" },
    $inc: { tokenVersion: 1 },
  });
  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions())
    .clearCookie("refreshToken", cookieOptions())
    .json(new ApiRespones(200, {}, "User is logout successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiRespones(200, req.user, "Current user successfully"));
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { verficationToken } = req.params;
  const hashedToken = hashTemporaryToken(verficationToken);
  const user = await User.findOneAndUpdate(
    {
      emailVerficationToken: hashedToken,
      emailVerficationTokenExpiry: { $gt: new Date() },
      isEmailVerified: false,
    },
    {
      $set: { isEmailVerified: true },
      $unset: { emailVerficationToken: 1, emailVerficationTokenExpiry: 1 },
    },
    { returnDocument: "after" },
  );
  if (!user) {
    throw new ApiError(400, "Invalid or expired token");
  }
  return res
    .status(200)
    .json(new ApiRespones(200, { isEmailVerified: true }, "Email is verified"));
});

const resendEmailVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(401, "Invalid access token");
  }
  if (user.isEmailVerified) {
    throw new ApiError(409, "Email is already verified");
  }
  const { unhashedToken, hashedToken, tokenExpiry } =
    user.genrateTemporaryToken();
  const verificationUrl = getTokenUrl(
    process.env.SERVER_URL,
    `/api/v1/auth/verify-email/${unhashedToken}`,
  );
  const updatedUser = await User.findOneAndUpdate(
    { _id: user._id, isEmailVerified: false },
    {
      $set: {
        emailVerficationToken: hashedToken,
        emailVerficationTokenExpiry: tokenExpiry,
      },
    },
    { returnDocument: "after" },
  );
  if (!updatedUser) {
    throw new ApiError(409, "Email is already verified");
  }
  await sendingEmail({
    email: user.email,
    subject: "Please verify your email",
    mailgenContent: emailVerficationMailgenContent(
      user.username,
      verificationUrl,
    ),
  });
  return res
    .status(200)
    .json(new ApiRespones(200, {}, "Verification email has been sent"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;
  if (typeof incomingRefreshToken !== "string" || !incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized access");
  }
  let decodedRefreshToken;
  try {
    decodedRefreshToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      {
        algorithms: ["HS256"],
      },
    );
  } catch {
    throw new ApiError(401, "Invalid refresh token");
  }
  if (!mongoose.isObjectIdOrHexString(decodedRefreshToken?._id)) {
    throw new ApiError(401, "Invalid refresh token");
  }
  const { accessToken, refreshToken: newRefreshToken } =
    await genAccessAndRefreshToken(decodedRefreshToken._id, {
      incomingRefreshToken,
      expectedTokenVersion: decodedRefreshToken.tokenVersion ?? 0,
    });
  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions())
    .cookie("refreshToken", newRefreshToken, cookieOptions())
    .json(
      new ApiRespones(
        200,
        {
          accessToken,
          refreshToken: newRefreshToken,
          // Keep the existing key for clients already using it.
          refrershToken: newRefreshToken,
        },
        "Access token refreshed",
      ),
    );
});

const forgotPasswordRequest = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const response = new ApiRespones(
    200,
    {},
    "If an account exists for this email, a password reset email has been sent",
  );
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(200).json(response);
  }
  const { unhashedToken, hashedToken, tokenExpiry } =
    user.genrateTemporaryToken();
  const resetUrl = getTokenUrl(
    process.env.FORGOT_PASSWORD_REDIRECT_URL,
    unhashedToken,
  );
  const updatedUser = await User.findOneAndUpdate(
    { _id: user._id, password: user.password },
    {
      $set: {
        forgotPasswordToken: hashedToken,
        forgotPasswordTokenExpiry: tokenExpiry,
      },
    },
    { returnDocument: "after" },
  );
  if (updatedUser) {
    await sendingEmail({
      email: user.email,
      subject: "Password reset request",
      mailgenContent: forgotPasswordMailgenContent(user.username, resetUrl),
    });
  }
  return res.status(200).json(response);
});

const resetForgotPassword = asyncHandler(async (req, res) => {
  const { resetToken } = req.params;
  const { newPassword } = req.body;
  const hashedToken = hashTemporaryToken(resetToken);
  // Atomic updates do not run the model's save hook, so hash before replacing.
  const password = await bcrypt.hash(newPassword, 10);
  const user = await User.findOneAndUpdate(
    {
      forgotPasswordToken: hashedToken,
      forgotPasswordTokenExpiry: { $gt: new Date() },
    },
    {
      $set: { password, refreshToken: "" },
      $unset: { forgotPasswordToken: 1, forgotPasswordTokenExpiry: 1 },
      $inc: { tokenVersion: 1 },
    },
    { returnDocument: "after", runValidators: true },
  );
  if (!user) {
    throw new ApiError(400, "Invalid or expired token");
  }
  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions())
    .clearCookie("refreshToken", cookieOptions())
    .json(new ApiRespones(200, {}, "Password reset successfully"));
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(401, "Invalid access token");
  }
  if (!(await user.isPasswordCorrect(oldPassword))) {
    throw new ApiError(400, "Invalid old password");
  }
  const password = await bcrypt.hash(newPassword, 10);
  const updatedUser = await User.findOneAndUpdate(
    {
      _id: user._id,
      password: user.password,
      ...tokenVersionFilter(user.tokenVersion ?? 0),
    },
    {
      $set: { password, refreshToken: "" },
      $unset: { forgotPasswordToken: 1, forgotPasswordTokenExpiry: 1 },
      $inc: { tokenVersion: 1 },
    },
    { returnDocument: "after", runValidators: true },
  );
  if (!updatedUser) {
    throw new ApiError(401, "Invalid or expired session");
  }
  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions())
    .clearCookie("refreshToken", cookieOptions())
    .json(new ApiRespones(200, {}, "Password changed successfully"));
});

export {
  login,
  registerUser,
  logoutUser,
  getCurrentUser,
  verifyEmail,
  resendEmailVerification,
  forgotPasswordRequest,
  resetForgotPassword,
  changeCurrentPassword,
  refreshAccessToken,
};
