import { Router } from "express";

import {
  getDashboardSummary,
  getExpensesByCategory,
  getIncomeByCategory,
  getMonthlySummary,
  getAccountsSummary,
} from "../controllers/dashboardController";

import { authMiddleware } from "../middlewares/authMiddleware";
import { asyncHandler } from "../middlewares/asyncHandler";

const router = Router();

// Dashboard summary
router.get(
  "/summary",
  authMiddleware,
  asyncHandler(getDashboardSummary)
);

// Expenses by category
router.get(
  "/expenses-by-category",
  authMiddleware,
  asyncHandler(getExpensesByCategory)
);

// Income by category
router.get(
  "/income-by-category",
  authMiddleware,
  asyncHandler(getIncomeByCategory)
);

// Monthly summary
router.get(
  "/monthly-summary",
  authMiddleware,
  asyncHandler(getMonthlySummary)
);

// Accounts summary
router.get(
  "/accounts-summary",
  authMiddleware,
  asyncHandler(getAccountsSummary)
);

export default router;