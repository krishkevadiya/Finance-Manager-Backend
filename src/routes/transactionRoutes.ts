import { Router } from "express";

import {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
} from "../controllers/transactionController";

import { authMiddleware } from "../middlewares/authMiddleware";
import { asyncHandler } from "../middlewares/asyncHandler";

const router = Router();

// Create transaction
router.post(
  "/",
  authMiddleware,
  asyncHandler(createTransaction)
);

// Get all transactions
router.get(
  "/",
  authMiddleware,
  asyncHandler(getTransactions)
);

// Get single transaction
router.get(
  "/:id",
  authMiddleware,
  asyncHandler(getTransactionById)
);

// Update transaction
router.put(
  "/:id",
  authMiddleware,
  asyncHandler(updateTransaction)
);

// Delete transaction
router.delete(
  "/:id",
  authMiddleware,
  asyncHandler(deleteTransaction)
);

export default router;