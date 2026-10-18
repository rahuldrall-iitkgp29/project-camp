import { Router } from "express";
import { getTasks, createTask, getTaskById, updateTask, deleteTask, createSubTask, UpdateSubTask, deleteSubTask } from "../controllers/task.controler.js";
import { verifyJWT, requireVerifiedEmail, validateProjectPermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validtor.middleware.js";
import { taskUpload } from "../middlewares/multer.middleware.js";
import { validateIds, taskValidator, subtaskValidator } from "../validators/index.validatorts.js";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";

const router = Router();
const taskRoles = [UserRolesEnum.ADMIN, UserRolesEnum.PROJECT_ADMIN];
router.use(verifyJWT, requireVerifiedEmail);
router.route("/:projectId")
    .get(validateProjectPermission(AvailableUserRole), getTasks)
    .post(validateProjectPermission(taskRoles), taskUpload, taskValidator(), validate, createTask);
router.route("/:projectId/t/:taskId")
    .all(validateIds("projectId", "taskId"))
    .get(validateProjectPermission(AvailableUserRole), getTaskById)
    .put(validateProjectPermission(taskRoles), taskUpload, taskValidator(true), validate, updateTask)
    .delete(validateProjectPermission(taskRoles), deleteTask);
router.route("/:projectId/t/:taskId/subtasks")
    .post(validateIds("projectId", "taskId"), validateProjectPermission(taskRoles), subtaskValidator(), validate, createSubTask);
router.route("/:projectId/st/:subTaskId")
    .all(validateIds("projectId", "subTaskId"))
    .put(validateProjectPermission(AvailableUserRole), subtaskValidator(true), validate, UpdateSubTask)
    .delete(validateProjectPermission(taskRoles), deleteSubTask);
export default router;
