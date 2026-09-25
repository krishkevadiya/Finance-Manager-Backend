import { Response } from "express";
import { In } from "typeorm";

import { AppDataSource } from "../config/database";
import { Category } from "../entities/Category";
import { DeletedItem } from "../entities/DeletedItem";
import { AuthRequest } from "../middlewares/authMiddleware";

const categoryRepository =
  AppDataSource.getRepository(Category);

type CategoryType =
  | "income"
  | "expense"
  | "both";

const isValidType = (
  type: unknown
): type is CategoryType => {
  return (
    type === "income" ||
    type === "expense" ||
    type === "both"
  );
};

// GET ALL CATEGORIES
export const getCategories = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { type } = req.query;

    const userId = req.user!.userId;

    /*
     * No type filter:
     * Return all categories.
     */
    if (type === undefined) {
      const categories =
        await categoryRepository.find({
          where: {
            userId,
          },
          order: {
            name: "ASC",
          },
        });

      res.status(200).json({
        categories,
      });

      return;
    }

    /*
     * Income filter:
     *
     * Income categories
     * +
     * Income & Expense categories
     */
    if (type === "income") {
      const categories =
        await categoryRepository.find({
          where: {
            userId,
            type: In([
              "income",
              "both",
            ]),
          },
          order: {
            name: "ASC",
          },
        });

      res.status(200).json({
        categories,
      });

      return;
    }

    /*
     * Expense filter:
     *
     * Expense categories
     * +
     * Income & Expense categories
     */
    if (type === "expense") {
      const categories =
        await categoryRepository.find({
          where: {
            userId,
            type: In([
              "expense",
              "both",
            ]),
          },
          order: {
            name: "ASC",
          },
        });

      res.status(200).json({
        categories,
      });

      return;
    }

    /*
     * Explicit "both" filter.
     *
     * Return only categories configured
     * for both income and expense.
     */
    if (type === "both") {
      const categories =
        await categoryRepository.find({
          where: {
            userId,
            type: "both",
          },
          order: {
            name: "ASC",
          },
        });

      res.status(200).json({
        categories,
      });

      return;
    }

    res.status(400).json({
      message:
        "Type must be income, expense, or both",
    });
  } catch (error) {
    console.error(
      "Get categories error:",
      error
    );

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

// CREATE CATEGORY
export const createCategory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const name =
      typeof req.body?.name === "string"
        ? req.body.name.trim()
        : "";

    const type = req.body?.type;

    if (!name || !type) {
      res.status(400).json({
        message: "Name and type are required",
      });

      return;
    }

    if (
      name.length < 2 ||
      name.length > 100
    ) {
      res.status(400).json({
        message:
          "Category name must be between 2 and 100 characters",
      });

      return;
    }

    if (!isValidType(type)) {
      res.status(400).json({
        message:
          "Type must be income, expense, or both",
      });

      return;
    }

    /*
     * Category names must remain unique
     * for the same user.
     *
     * Example:
     *
     * Food = expense
     *
     * Creating another "Food" category
     * is not allowed.
     *
     * Instead, edit Food and change it
     * to "both".
     */
    const existingCategory =
      await categoryRepository.findOne({
        where: {
          userId: req.user!.userId,
          name,
        },
      });

    if (existingCategory) {
      res.status(409).json({
        message:
          "A category with this name already exists. Edit the existing category if you want it to support both income and expense.",
      });

      return;
    }

    const category =
      categoryRepository.create({
        name,
        type,
        userId: req.user!.userId,
      });

    await categoryRepository.save(category);

    res.status(201).json({
      message:
        "Category created successfully",
      category,
    });
  } catch (error) {
    console.error(
      "Create category error:",
      error
    );

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

// UPDATE CATEGORY
export const updateCategory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const categoryId = Number(
      req.params.id
    );

    if (
      !Number.isInteger(categoryId) ||
      categoryId <= 0
    ) {
      res.status(400).json({
        message:
          "Category ID must be a positive whole number",
      });

      return;
    }

    const category =
      await categoryRepository.findOne({
        where: {
          id: categoryId,
          userId: req.user!.userId,
        },
      });

    if (!category) {
      res.status(404).json({
        message: "Category not found",
      });

      return;
    }

    const name =
      typeof req.body?.name === "string"
        ? req.body.name.trim()
        : "";

    const type = req.body?.type;

    if (!name || !type) {
      res.status(400).json({
        message: "Name and type are required",
      });

      return;
    }

    if (
      name.length < 2 ||
      name.length > 100
    ) {
      res.status(400).json({
        message:
          "Category name must be between 2 and 100 characters",
      });

      return;
    }

    if (!isValidType(type)) {
      res.status(400).json({
        message:
          "Type must be income, expense, or both",
      });

      return;
    }

    /*
     * Check duplicate category name
     * for the same user.
     */
    const duplicate =
      await categoryRepository.findOne({
        where: {
          userId: req.user!.userId,
          name,
        },
      });

    if (
      duplicate &&
      duplicate.id !== category.id
    ) {
      res.status(409).json({
        message:
          "A category with this name already exists",
      });

      return;
    }

    category.name = name;
    category.type = type;

    await categoryRepository.save(category);

    res.status(200).json({
      message:
        "Category updated successfully",
      category,
    });
  } catch (error) {
    console.error(
      "Update category error:",
      error
    );

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

// DELETE CATEGORY
export const deleteCategory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const categoryId = Number(
      req.params.id
    );

    if (
      !Number.isInteger(categoryId) ||
      categoryId <= 0
    ) {
      res.status(400).json({
        message:
          "Category ID must be a positive whole number",
      });

      return;
    }

    const category =
      await categoryRepository.findOne({
        where: {
          id: categoryId,
          userId: req.user!.userId,
        },
      });

    if (!category) {
      res.status(404).json({
        message: "Category not found",
      });

      return;
    }

    const deletedItemRepo = AppDataSource.getRepository(DeletedItem);
    await deletedItemRepo.save(
      deletedItemRepo.create({
        userId: req.user!.userId,
        itemType: "category",
        title: `${category.name} (${category.type})`,
        data: {
          id: category.id,
          name: category.name,
          type: category.type,
        },
      })
    );

    await categoryRepository.remove(
      category
    );

    res.status(200).json({
      message:
        "Category deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete category error:",
      error
    );

    res.status(500).json({
      message: "Internal server error",
    });
  }
};