import { Response } from "express";
import { AppDataSource } from "../config/database";
import { DeletedItem } from "../entities/DeletedItem";
import { Transaction } from "../entities/Transaction";
import { Account } from "../entities/Account";
import { Budget } from "../entities/Budget";
import { Category } from "../entities/Category";
import { AuthRequest } from "../middlewares/authMiddleware";

const deletedItemRepository = AppDataSource.getRepository(DeletedItem);
const accountRepository = AppDataSource.getRepository(Account);
const categoryRepository = AppDataSource.getRepository(Category);
const budgetRepository = AppDataSource.getRepository(Budget);

// GET ALL RECENTLY DELETED ITEMS
export const getDeletedItems = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const items = await deletedItemRepository.find({
      where: { userId },
      order: { deletedAt: "DESC" },
    });

    res.status(200).json({
      success: true,
      data: items,
      total: items.length,
    });
  } catch (error) {
    console.error("Get deleted items error:", error);
    res.status(500).json({ message: "Failed to fetch recently deleted items" });
  }
};

// RESTORE A SINGLE DELETED ITEM
export const restoreDeletedItem = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const userId = req.user?.userId;
    const id = Number(req.params.id);

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: "Invalid item ID" });
      return;
    }

    const deletedItem = await queryRunner.manager.findOne(DeletedItem, {
      where: { id, userId },
    });

    if (!deletedItem) {
      res.status(404).json({ message: "Deleted item not found" });
      return;
    }

    const { itemType, data } = deletedItem;

    if (itemType === "transaction") {
      // Find or restore account
      let account = await queryRunner.manager.findOne(Account, {
        where: { id: data.accountId, user: { id: userId } },
      });

      if (!account) {
        // Try finding by name or pick first available account
        account = await queryRunner.manager.findOne(Account, {
          where: { user: { id: userId } },
          order: { id: "ASC" },
        });

        if (!account) {
          // Re-create default account if none exists
          account = queryRunner.manager.create(Account, {
            name: data.accountName || "Default Account",
            type: "bank",
            balance: 0,
            currency: "INR",
            user: { id: userId } as any,
          });
          account = await queryRunner.manager.save(account);
        }
      }

      // Re-create the transaction
      const transaction = queryRunner.manager.create(Transaction, {
        type: data.type,
        amount: Number(data.amount),
        category: data.category,
        description: data.description ?? null,
        transactionDate: data.transactionDate || new Date().toISOString().slice(0, 10),
        account,
      });

      await queryRunner.manager.save(transaction);

      // Adjust account balance
      const currentBalance = Number(account.balance);
      const amount = Number(data.amount);
      const newBalance =
        data.type === "income"
          ? currentBalance + amount
          : currentBalance - amount;

      account.balance = Number(newBalance.toFixed(2));
      await queryRunner.manager.save(account);
    } else if (itemType === "account") {
      // Re-create account
      let accountName = data.name;
      const existingAccount = await queryRunner.manager.findOne(Account, {
        where: { name: accountName, user: { id: userId } },
      });

      if (existingAccount) {
        accountName = `${accountName} (Restored)`;
      }

      const account = queryRunner.manager.create(Account, {
        name: accountName,
        type: data.type || "other",
        balance: Number(data.balance ?? 0),
        currency: data.currency || "INR",
        user: { id: userId } as any,
      });

      await queryRunner.manager.save(account);
    } else if (itemType === "category") {
      // Re-create category if doesn't exist
      const existingCategory = await queryRunner.manager.findOne(Category, {
        where: { name: data.name, user: { id: userId } },
      });

      if (!existingCategory) {
        const category = queryRunner.manager.create(Category, {
          name: data.name,
          type: data.type || "expense",
          user: { id: userId } as any,
        });
        await queryRunner.manager.save(category);
      }
    } else if (itemType === "budget") {
      // Find category
      let category = await queryRunner.manager.findOne(Category, {
        where: { id: data.categoryId, user: { id: userId } },
      });

      if (!category && data.categoryName) {
        category = await queryRunner.manager.findOne(Category, {
          where: { name: data.categoryName, user: { id: userId } },
        });
      }

      if (!category) {
        category = queryRunner.manager.create(Category, {
          name: data.categoryName || "General",
          type: "expense",
          user: { id: userId } as any,
        });
        category = await queryRunner.manager.save(category);
      }

      // Check if budget for month/year already exists
      const existingBudget = await queryRunner.manager.findOne(Budget, {
        where: {
          userId,
          categoryId: category.id,
          month: Number(data.month),
          year: Number(data.year),
        },
      });

      if (!existingBudget) {
        const budget = queryRunner.manager.create(Budget, {
          amount: Number(data.amount),
          month: Number(data.month),
          year: Number(data.year),
          categoryId: category.id,
          userId,
          category,
          user: { id: userId } as any,
        });
        await queryRunner.manager.save(budget);
      }
    }

    // Remove from deleted_items
    await queryRunner.manager.remove(deletedItem);

    await queryRunner.commitTransaction();

    res.status(200).json({
      success: true,
      message: `${deletedItem.itemType.charAt(0).toUpperCase() + deletedItem.itemType.slice(1)} restored successfully!`,
      restoredItem: deletedItem,
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error("Restore deleted item error:", error);
    res.status(500).json({ message: "Failed to restore item" });
  } finally {
    await queryRunner.release();
  }
};

// RESTORE ALL ITEMS
export const restoreAllDeletedItems = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const items = await deletedItemRepository.find({
      where: { userId },
      order: { deletedAt: "ASC" },
    });

    if (items.length === 0) {
      res.status(200).json({ success: true, message: "No items to restore" });
      return;
    }

    let restoredCount = 0;
    for (const item of items) {
      // Fake request to re-use restore logic safely
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const { itemType, data } = item;

        if (itemType === "category") {
          const existing = await queryRunner.manager.findOne(Category, {
            where: { name: data.name, user: { id: userId } },
          });
          if (!existing) {
            await queryRunner.manager.save(
              queryRunner.manager.create(Category, {
                name: data.name,
                type: data.type || "expense",
                user: { id: userId } as any,
              })
            );
          }
        } else if (itemType === "account") {
          let name = data.name;
          const existing = await queryRunner.manager.findOne(Account, {
            where: { name, user: { id: userId } },
          });
          if (existing) name = `${name} (Restored)`;

          await queryRunner.manager.save(
            queryRunner.manager.create(Account, {
              name,
              type: data.type || "other",
              balance: Number(data.balance ?? 0),
              currency: data.currency || "INR",
              user: { id: userId } as any,
            })
          );
        } else if (itemType === "transaction") {
          let account = await queryRunner.manager.findOne(Account, {
            where: { id: data.accountId, user: { id: userId } },
          });
          if (!account) {
            account = await queryRunner.manager.findOne(Account, {
              where: { user: { id: userId } },
            });
          }
          if (account) {
            const tx = queryRunner.manager.create(Transaction, {
              type: data.type,
              amount: Number(data.amount),
              category: data.category,
              description: data.description ?? null,
              transactionDate: data.transactionDate || new Date().toISOString().slice(0, 10),
              account,
            });
            await queryRunner.manager.save(tx);

            const curr = Number(account.balance);
            const amt = Number(data.amount);
            account.balance = Number(
              (data.type === "income" ? curr + amt : curr - amt).toFixed(2)
            );
            await queryRunner.manager.save(account);
          }
        } else if (itemType === "budget") {
          let category = await queryRunner.manager.findOne(Category, {
            where: { id: data.categoryId, user: { id: userId } },
          });
          if (!category && data.categoryName) {
            category = await queryRunner.manager.findOne(Category, {
              where: { name: data.categoryName, user: { id: userId } },
            });
          }
          if (category) {
            const b = queryRunner.manager.create(Budget, {
              amount: Number(data.amount),
              month: Number(data.month),
              year: Number(data.year),
              categoryId: category.id,
              userId,
              category,
              user: { id: userId } as any,
            });
            await queryRunner.manager.save(b);
          }
        }

        await queryRunner.manager.remove(item);
        await queryRunner.commitTransaction();
        restoredCount++;
      } catch (err) {
        await queryRunner.rollbackTransaction();
        console.error("Error restoring item during restoreAll:", err);
      } finally {
        await queryRunner.release();
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully restored ${restoredCount} items!`,
    });
  } catch (error) {
    console.error("Restore all error:", error);
    res.status(500).json({ message: "Failed to restore all items" });
  }
};

// DELETE PERMANENTLY (SINGLE)
export const deletePermanently = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const id = Number(req.params.id);

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const item = await deletedItemRepository.findOne({
      where: { id, userId },
    });

    if (!item) {
      res.status(404).json({ message: "Item not found" });
      return;
    }

    await deletedItemRepository.remove(item);

    res.status(200).json({
      success: true,
      message: "Item permanently deleted",
    });
  } catch (error) {
    console.error("Delete permanently error:", error);
    res.status(500).json({ message: "Failed to permanently delete item" });
  }
};

// EMPTY TRASH (DELETE ALL RECENTLY DELETED)
export const clearAllDeleted = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    await deletedItemRepository.delete({ userId });

    res.status(200).json({
      success: true,
      message: "Trash emptied successfully",
    });
  } catch (error) {
    console.error("Empty trash error:", error);
    res.status(500).json({ message: "Failed to empty trash" });
  }
};
