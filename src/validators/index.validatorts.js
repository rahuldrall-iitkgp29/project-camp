import { body, param } from "express-validator";
import { ApiError } from "../utils/apiError.js";
// as of now our most of data is come from body itself
import { AvailableUserRole, AvailableTaskStatus } from "../utils/constants.js";

const passwordValidator = (field, minimumLength = 6) =>
    body(field)
        .isString().withMessage("Password must be a string").bail()
        .isLength({ min: minimumLength }).withMessage(`Password must be at least ${minimumLength} characters`)
        .custom((value) => Buffer.byteLength(value, "utf8") <= 72)
        .withMessage("Password must not exceed 72 UTF-8 bytes");

const userRegistrationValidator = () => {//user registratioin validator
    return [
        body("email") //inbuild fn express-validators
            .isString().withMessage("Email must be a string").bail()
            .trim()
            .notEmpty()
            .withMessage("Email is required")//if submitted empty then this messaage go with an error
            .isEmail()//there was a format of email , if that not followed then below message go with an error 
            .withMessage("Email is invalid"),
        body("username") //now validators for username
            .isString().withMessage("Username must be a string").bail()
            .trim()
            .notEmpty()
            .withMessage("Username is required")
            .isLowercase()
            .withMessage("Username must be in lowercase")
            .isLength({ min: 3, max: 20 })
            .withMessage("Username must be between 3 and 20 characters"),
        passwordValidator("password")
    ]
}

const userLoginValidator = ()=>{
    return [
        body("email")
            .isString().withMessage("Email must be a string").bail()
            .trim()
            .isEmail()
            .withMessage("email not valide"),
        passwordValidator("password", 1)
    ]
}

const userChanggedCurrentPasswordValidator = () => {
    return[
        passwordValidator("oldPassword", 1),
        passwordValidator("newPassword"),

    ]
};

const userForgotPasswordValidtor = () => {
    return[
        body("email")
            .isString().withMessage("Email must be a string").bail()
            .trim()
            .notEmpty()
            .withMessage("email is required")
            .isEmail()
            .withMessage("invalid email")
    ]
};


const userRestForgotPasswordValidator = () => {
    return[
        passwordValidator("newPassword")
    ]
}

const createProjectValidator = ()=>{
    return [
        textField("name", 200),
        textField("description", 10000, true, true),
    ]
};

const addMemberToProjectValidator = ()=>{
    return[
        body("email")
            .isString().withMessage("Email must be a string").bail()
            .trim()
            .notEmpty().withMessage("email is required")
            .isEmail().withMessage("invalid email"),
        body("role")
            .isString().withMessage("Role must be a string").bail()
            .notEmpty().withMessage("should not be empty")
            .isIn(AvailableUserRole).withMessage(`role is invalid`), //here we pass an array of available roles and check if input role is in that array or not
        ]
}

const textField = (field, max, optional = false, allowEmpty = false) => {
    const validator = body(field);
    if (optional) validator.optional();
    return validator.isString().withMessage(`${field} must be a string`).bail()
        .trim().isLength({ min: allowEmpty ? 0 : 1, max }).withMessage(`${field} has an invalid length`);
};

export const validateIds = (...fields) => (req, res, next) => {
    if (fields.some(field => !/^[a-f0-9]{24}$/i.test(req.params[field] || ""))) {
        return next(new ApiError(400, "Invalid resource identifier"));
    }
    next();
};

const updateBody = (fields, uploads = false) => body().custom((value, { req }) => {
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("An object body is required");
    if (Object.keys(value).some(key => !fields.includes(key))) throw new Error("Unsupported field");
    if (!fields.some(field => Object.hasOwn(value, field)) && !(uploads && req.files?.length)) throw new Error("No update fields supplied");
    return true;
});

export const updateProjectValidator = () => [
    updateBody(["name", "description"]), textField("name", 200, true), textField("description", 10000, true, true),
];

export const updateMemberRoleValidator = () => [body("newRole").isString().bail().isIn(AvailableUserRole)];
export const invitationValidator = () => [param("invitationToken").matches(/^[a-f0-9]{40}$/)];
export const taskValidator = (update = false) => [
    updateBody(["title", "description", "assignedTo", "status"], update),
    textField("title", 200, update), textField("description", 10000, true, true),
    body("assignedTo").optional({ values: "null" }).isString().bail().isMongoId(),
    body("status").optional().isString().bail().isIn(AvailableTaskStatus),
];
export const subtaskValidator = (update = false) => [
    updateBody(update ? ["title", "isCompleted"] : ["title"]), textField("title", 200, update),
    body("isCompleted").optional().custom(value => typeof value === "boolean").withMessage("isCompleted must be a boolean"),
];
export const noteValidator = () => [updateBody(["content"]), textField("content", 10000)];

export {
  userRegistrationValidator,
  userLoginValidator,
  userChanggedCurrentPasswordValidator,
  userForgotPasswordValidtor,
  userRestForgotPasswordValidator,
  createProjectValidator,
  addMemberToProjectValidator,
};
