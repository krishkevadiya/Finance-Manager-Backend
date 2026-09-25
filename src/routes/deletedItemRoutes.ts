import { Router } from "express";
import {
  getDeletedItems,
  restoreDeletedItem,
  restoreAllDeletedItems,
  deletePermanently,
  clearAllDeleted,
} from "../controllers/deletedItemController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { asyncHandler } from "../middlewares/asyncHandler";

const router = Router();

router.use(authMiddleware);

router.get("/", asyncHandler(getDeletedItems));
router.post("/:id/restore", asyncHandler(restoreDeletedItem));
router.post("/restore-all", asyncHandler(restoreAllDeletedItems));
router.delete("/:id", asyncHandler(deletePermanently));
router.delete("/", asyncHandler(clearAllDeleted));

export default router;
