import { Router } from "express";

import {
  createAccount,
  getAccounts,
  getAccountById,
  updateAccount,
  deleteAccount,
} from "../controllers/accountController";

import { authMiddleware } from "../middlewares/authMiddleware";
import { asyncHandler } from "../middlewares/asyncHandler";

const router = Router();

// Create account
router.post(
  "/",
  authMiddleware,
  asyncHandler(createAccount)
);

// Get all accounts
router.get(
  "/",
  authMiddleware,
  asyncHandler(getAccounts)
);

// Get single account
router.get(
  "/:id",
  authMiddleware,
  asyncHandler(getAccountById)
);

// Update account
router.put(
  "/:id",
  authMiddleware,
  asyncHandler(updateAccount)
);

// Delete account
router.delete(
  "/:id",
  authMiddleware,
  asyncHandler(deleteAccount)
);

export default router;