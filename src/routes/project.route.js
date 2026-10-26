import { Router } from "express";
import {
  addMemberToProject,
  createProject,
  deleteMember,
  getProjects,
  getProjectById,
  getsProjectMembers,
  updateProject,
  deleteProject,
  updateMemberRole,
  acceptProjectInvitation,
} from "../controllers/project.controlers.js";

import { validate } from "../middlewares/validtor.middleware.js";

import {
  createProjectValidator,
  addMemberToProjectValidator,
  updateProjectValidator,
  updateMemberRoleValidator,
  validateIds,
  invitationValidator,
} from "../validators/index.validatorts.js";

import {
  verifyJWT,
  requireVerifiedEmail,
  validateProjectPermission,
} from "../middlewares/auth.middleware.js";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";

const router = Router();

router.use(verifyJWT, requireVerifiedEmail); // Project access requires an authenticated, verified account.

router
  .route("/:projectId/invitations/:invitationToken/accept")
  .post(
    validateIds("projectId"),
    invitationValidator(),
    validate,
    acceptProjectInvitation,
  );

router //to create project
  .route("/")
  .get(getProjects)
  .post(createProjectValidator(), validate, createProject);

router // to upadate and delete project
  .route("/:projectId") //for params -> we fetch this everywhere in req.params
  .get(validateProjectPermission(AvailableUserRole), getProjectById) //availableuserRole -> is the array which contain all the roles => passing this means evryone allow to access getPeojectId contoroller
  .put(
    validateProjectPermission([UserRolesEnum.ADMIN]), //similar to ["ADMIN"]
    updateProjectValidator(),
    validate,
    updateProject,
  )
  .delete(validateProjectPermission([UserRolesEnum.ADMIN]), deleteProject);

router //to add member
  .route(["/:projectId/members", "/:projectId/member"]) // Keep the singular legacy alias.
  .get(validateProjectPermission(AvailableUserRole), getsProjectMembers)
  .post(
    validateProjectPermission([UserRolesEnum.ADMIN]),
    addMemberToProjectValidator(),
    validate,
    addMemberToProject,
  );

router
  .route("/:projectId/members/:userId")
  .put(
    validateIds("projectId", "userId"),
    validateProjectPermission([UserRolesEnum.ADMIN]),
    updateMemberRoleValidator(),
    validate,
    updateMemberRole,
  )
  .delete(
    validateIds("projectId", "userId"),
    validateProjectPermission([UserRolesEnum.ADMIN]),
    deleteMember,
  );

export default router;
