import { Router } from "express";
import { getNotes, getNoteById, createNote, updateNote, deleteNote } from "../controllers/note.controler.js";
import { verifyJWT, requireVerifiedEmail, validateProjectPermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validtor.middleware.js";
import { validateIds, noteValidator } from "../validators/index.validatorts.js";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";

const router = Router();
router.use(verifyJWT, requireVerifiedEmail);
router.route("/:projectId")
    .get(validateProjectPermission(AvailableUserRole), getNotes)
    .post(validateProjectPermission([UserRolesEnum.ADMIN]), noteValidator(), validate, createNote);
router.route("/:projectId/n/:noteId")
    .all(validateIds("projectId", "noteId"))
    .get(validateProjectPermission(AvailableUserRole), getNoteById)
    .put(validateProjectPermission([UserRolesEnum.ADMIN]), noteValidator(), validate, updateNote)
    .delete(validateProjectPermission([UserRolesEnum.ADMIN]), deleteNote);
export default router;
