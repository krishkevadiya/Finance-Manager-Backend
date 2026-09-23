import { Router } from "express";

import {
  createBudget,
  deleteBudget,
  getBudgetById,
  getBudgets,
  updateBudget,
} from "../controllers/budgetController";

import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.post("/", authMiddleware, createBudget);

router.get("/", authMiddleware, getBudgets);

router.get("/:id", authMiddleware, getBudgetById);

router.put("/:id", authMiddleware, updateBudget);

router.delete("/:id", authMiddleware, deleteBudget);

export default router;