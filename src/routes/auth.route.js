import { Router } from "express";
import {
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
} from "../controllers/auth.controler.js";

import { validate } from "../middlewares/validtor.middleware.js";

import {
  userRegistrationValidator,
  userLoginValidator,
  userChanggedCurrentPasswordValidator,
  userForgotPasswordValidtor,
  userRestForgotPasswordValidator,
} from "../validators/index.validatorts.js";

import { verifyJWT } from "../middlewares/auth.middleware.js";
import { createRateLimiter } from "../middlewares/rateLimit.middleware.js";

const router = Router();
router.use(createRateLimiter());

//unsecured routes
router
  .route("/register")
  .post(userRegistrationValidator(), validate, registerUser);
router.route("/login").post(userLoginValidator(), validate, login);

router.route("/verify-email/:verficationToken").get(verifyEmail);
//bcz we used vertificationToken in params extraction==> in verify email controller , so we need to write it inside url
router.route("/refresh-token").post(refreshAccessToken);
router
  .route("/forgot-Password")
  .post(userForgotPasswordValidtor(), validate, forgotPasswordRequest);
router
  .route("/reset-password/:resetToken")
  .post(userRestForgotPasswordValidator(), validate, resetForgotPassword);
//bcz we need to take resetToken from url ==> in controller(just like verfy email)

// we use post method because we are sending data to server and we want to create a new user in our database
// we use userRegistrationValidator() to validate our data and validate to check if there is any error in our data and if there is any error then it will throw an error and if there is no error then it will go to registerUser controller
// we transfer our logic of auth through route "/register" , rest route we add in app.js

//secure route-> required varify jwt
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router
  .route("/change-password")
  .post(
    verifyJWT,
    userChanggedCurrentPasswordValidator(),
    validate,
    changeCurrentPassword,
  );
router
  .route("/resend-email-verification")
  .post(verifyJWT, resendEmailVerification);

export default router;
