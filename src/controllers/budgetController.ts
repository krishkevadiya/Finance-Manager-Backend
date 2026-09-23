import { Request, Response } from "express";
import { AppDataSource } from "../config/database";
import { Budget } from "../entities/Budget";
import { Category } from "../entities/Category";
import { getBudgetStatusForBudget } from "../services/budgetAlertService";

interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

const getNumber = (value: unknown): number => {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
};

const validateMonthYear = (
  month: unknown,
  year: unknown
): { month: number; year: number } | null => {
  const parsedMonth = Number(month);
  const parsedYear = Number(year);

  if (
    !Number.isInteger(parsedMonth) ||
    parsedMonth < 1 ||
    parsedMonth > 12
  ) {
    return null;
  }

  if (
    !Number.isInteger(parsedYear) ||
    parsedYear < 2000 ||
    parsedYear > 2100
  ) {
    return null;
  }

  return {
    month: parsedMonth,
    year: parsedYear,
  };
};

export const createBudget = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    const { categoryId, amount, month, year } = req.body;

    const parsedCategoryId = Number(categoryId);
    const parsedAmount = getNumber(amount);

    if (
      !Number.isInteger(parsedCategoryId) ||
      parsedCategoryId <= 0
    ) {
      res.status(400).json({
        message: "Valid category is required.",
      });
      return;
    }

    if (parsedAmount <= 0) {
      res.status(400).json({
        message: "Budget amount must be greater than 0.",
      });
      return;
    }

    const parsedDate = validateMonthYear(month, year);

    if (!parsedDate) {
      res.status(400).json({
        message: "Valid month and year are required.",
      });
      return;
    }

    const categoryRepository =
      AppDataSource.getRepository(Category);

    const category = await categoryRepository.findOne({
      where: {
        id: parsedCategoryId,
        userId,
      },
    });

    if (!category) {
      res.status(404).json({
        message: "Category not found.",
      });
      return;
    }

    if (category.type !== "expense") {
      res.status(400).json({
        message: "Budgets can only be created for expense categories.",
      });
      return;
    }

    const budgetRepository =
      AppDataSource.getRepository(Budget);

    const existingBudget =
      await budgetRepository.findOne({
        where: {
          userId,
          categoryId: parsedCategoryId,
          month: parsedDate.month,
          year: parsedDate.year,
        },
      });

    if (existingBudget) {
      res.status(409).json({
        message:
          "A budget already exists for this category and month.",
      });
      return;
    }

    const budget = budgetRepository.create({
      amount: parsedAmount,
      month: parsedDate.month,
      year: parsedDate.year,
      userId,
      categoryId: parsedCategoryId,
    });

    const savedBudget =
      await budgetRepository.save(budget);

    const createdBudget =
      await budgetRepository.findOne({
        where: {
          id: savedBudget.id,
          userId,
        },
        relations: {
          category: true,
        },
      });

    const budgetStatus = createdBudget
      ? await getBudgetStatusForBudget(createdBudget)
      : null;

    res.status(201).json({
      message: "Budget created successfully.",
      budget: createdBudget,
      budgetStatus,
    });
  } catch (error) {
    console.error("Create budget error:", error);

    res.status(500).json({
      message: "Unable to create budget.",
    });
  }
};

export const getBudgets = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    const month = req.query.month;
    const year = req.query.year;

    const budgetRepository =
      AppDataSource.getRepository(Budget);

    const query =
      budgetRepository
        .createQueryBuilder("budget")
        .leftJoinAndSelect(
          "budget.category",
          "category"
        )
        .where("budget.userId = :userId", {
          userId,
        })
        .orderBy("budget.year", "DESC")
        .addOrderBy("budget.month", "DESC")
        .addOrderBy("category.name", "ASC");

    if (month !== undefined) {
      const parsedMonth = Number(month);

      if (
        !Number.isInteger(parsedMonth) ||
        parsedMonth < 1 ||
        parsedMonth > 12
      ) {
        res.status(400).json({
          message: "Invalid month.",
        });
        return;
      }

      query.andWhere("budget.month = :month", {
        month: parsedMonth,
      });
    }

    if (year !== undefined) {
      const parsedYear = Number(year);

      if (
        !Number.isInteger(parsedYear) ||
        parsedYear < 2000 ||
        parsedYear > 2100
      ) {
        res.status(400).json({
          message: "Invalid year.",
        });
        return;
      }

      query.andWhere("budget.year = :year", {
        year: parsedYear,
      });
    }

    const budgets = await query.getMany();

    const budgetsWithStatus = await Promise.all(
      budgets.map(async (budget) => ({
        ...budget,
        budgetStatus: await getBudgetStatusForBudget(budget),
      }))
    );

    res.status(200).json({
      budgets: budgetsWithStatus,
    });
  } catch (error) {
    console.error("Get budgets error:", error);

    res.status(500).json({
      message: "Unable to load budgets.",
    });
  }
};

export const getBudgetById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    const budgetId = Number(req.params.id);

    if (!Number.isInteger(budgetId) || budgetId <= 0) {
      res.status(400).json({
        message: "Invalid budget ID.",
      });
      return;
    }

    const budgetRepository =
      AppDataSource.getRepository(Budget);

    const budget = await budgetRepository.findOne({
      where: {
        id: budgetId,
        userId,
      },
      relations: {
        category: true,
      },
    });

    if (!budget) {
      res.status(404).json({
        message: "Budget not found.",
      });
      return;
    }

    const budgetStatus = await getBudgetStatusForBudget(budget);

    res.status(200).json({
      budget,
      budgetStatus,
    });
  } catch (error) {
    console.error("Get budget error:", error);

    res.status(500).json({
      message: "Unable to load budget.",
    });
  }
};

export const updateBudget = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    const budgetId = Number(req.params.id);

    if (!Number.isInteger(budgetId) || budgetId <= 0) {
      res.status(400).json({
        message: "Invalid budget ID.",
      });
      return;
    }

    const { categoryId, amount, month, year } = req.body;

    const parsedCategoryId = Number(categoryId);
    const parsedAmount = getNumber(amount);

    if (
      !Number.isInteger(parsedCategoryId) ||
      parsedCategoryId <= 0
    ) {
      res.status(400).json({
        message: "Valid category is required.",
      });
      return;
    }

    if (parsedAmount <= 0) {
      res.status(400).json({
        message: "Budget amount must be greater than 0.",
      });
      return;
    }

    const parsedDate = validateMonthYear(month, year);

    if (!parsedDate) {
      res.status(400).json({
        message: "Valid month and year are required.",
      });
      return;
    }

    const budgetRepository =
      AppDataSource.getRepository(Budget);

    const budget = await budgetRepository.findOne({
      where: {
        id: budgetId,
        userId,
      },
    });

    if (!budget) {
      res.status(404).json({
        message: "Budget not found.",
      });
      return;
    }

    const categoryRepository =
      AppDataSource.getRepository(Category);

    const category = await categoryRepository.findOne({
      where: {
        id: parsedCategoryId,
        userId,
      },
    });

    if (!category) {
      res.status(404).json({
        message: "Category not found.",
      });
      return;
    }

    if (category.type !== "expense") {
      res.status(400).json({
        message: "Budgets can only be created for expense categories.",
      });
      return;
    }

    const duplicateBudget =
      await budgetRepository
        .createQueryBuilder("budget")
        .where("budget.userId = :userId", {
          userId,
        })
        .andWhere("budget.categoryId = :categoryId", {
          categoryId: parsedCategoryId,
        })
        .andWhere("budget.month = :month", {
          month: parsedDate.month,
        })
        .andWhere("budget.year = :year", {
          year: parsedDate.year,
        })
        .andWhere("budget.id != :budgetId", {
          budgetId,
        })
        .getOne();

    if (duplicateBudget) {
      res.status(409).json({
        message:
          "A budget already exists for this category and month.",
      });
      return;
    }

    budget.amount = parsedAmount;
    budget.categoryId = parsedCategoryId;
    budget.month = parsedDate.month;
    budget.year = parsedDate.year;

    await budgetRepository.save(budget);

    const updatedBudget =
      await budgetRepository.findOne({
        where: {
          id: budgetId,
          userId,
        },
        relations: {
          category: true,
        },
      });

    const budgetStatus = updatedBudget
      ? await getBudgetStatusForBudget(updatedBudget)
      : null;

    res.status(200).json({
      message: "Budget updated successfully.",
      budget: updatedBudget,
      budgetStatus,
    });
  } catch (error) {
    console.error("Update budget error:", error);

    res.status(500).json({
      message: "Unable to update budget.",
    });
  }
};

export const deleteBudget = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    const budgetId = Number(req.params.id);

    if (!Number.isInteger(budgetId) || budgetId <= 0) {
      res.status(400).json({
        message: "Invalid budget ID.",
      });
      return;
    }

    const budgetRepository =
      AppDataSource.getRepository(Budget);

    const budget = await budgetRepository.findOne({
      where: {
        id: budgetId,
        userId,
      },
    });

    if (!budget) {
      res.status(404).json({
        message: "Budget not found.",
      });
      return;
    }

    await budgetRepository.remove(budget);

    res.status(200).json({
      message: "Budget deleted successfully.",
    });
  } catch (error) {
    console.error("Delete budget error:", error);

    res.status(500).json({
      message: "Unable to delete budget.",
    });
  }
};