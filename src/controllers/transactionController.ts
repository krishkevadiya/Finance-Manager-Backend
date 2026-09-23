import { Response } from "express";
import { AppDataSource } from "../config/database";
import { Transaction } from "../entities/Transaction";
import { Account } from "../entities/Account";
import { AuthRequest } from "../middlewares/authMiddleware";
import { getBudgetStatusForTransaction } from "../services/budgetAlertService";

const transactionRepository =
  AppDataSource.getRepository(Transaction);

const accountRepository =
  AppDataSource.getRepository(Account);

// Validate transaction date
const isValidTransactionDate = (date: unknown): boolean => {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return false;
  }

  const parsedDate = new Date(`${date}T00:00:00.000Z`);

  return (
    !isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === date
  );
};

// CREATE TRANSACTION
export const createTransaction = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const {
    type,
    amount,
    category,
    description,
    accountId,
    transactionDate,
  } = req.body;

  if (!type || !amount || !category || !accountId) {
    res.status(400).json({
      message: "Type, amount, category and accountId are required",
    });
    return;
  }

  if (type !== "income" && type !== "expense") {
    res.status(400).json({
      message: "Type must be income or expense",
    });
    return;
  }

  if (Number(amount) <= 0) {
    res.status(400).json({
      message: "Amount must be greater than 0",
    });
    return;
  }

  if (
    transactionDate !== undefined &&
    !isValidTransactionDate(transactionDate)
  ) {
    res.status(400).json({
      message:
        "Transaction date must be a valid date in YYYY-MM-DD format",
    });
    return;
  }

  const parsedAccountId = Number(accountId);

  if (
    !Number.isInteger(parsedAccountId) ||
    parsedAccountId <= 0
  ) {
    res.status(400).json({
      message: "Account ID must be a positive whole number",
    });
    return;
  }

  const account = await accountRepository.findOne({
    where: {
      id: parsedAccountId,
      user: {
        id: req.user!.userId,
      },
    },
  });

  if (!account) {
    res.status(404).json({
      message: "Account not found",
    });
    return;
  }

  const transaction = transactionRepository.create({
    type,
    amount: Number(amount),
    category,
    description: description ?? null,
    transactionDate: transactionDate ?? undefined,
    account,
  });

  await AppDataSource.transaction(async (manager) => {
    await manager.save(transaction);

    // Update account balance
    if (type === "income") {
      account.balance =
        Number(account.balance) + Number(amount);
    } else {
      account.balance =
        Number(account.balance) - Number(amount);
    }

    await manager.save(account);
  });

  const budgetStatus =
    type === "expense"
      ? await getBudgetStatusForTransaction(
          req.user!.userId,
          String(category).trim(),
          transaction.transactionDate
        )
      : null;

  res.status(201).json({
    message: "Transaction created successfully",
    transaction,
    updatedBalance: account.balance,
    budgetStatus,
  });
};

// GET ALL TRANSACTIONS WITH FILTERS AND PAGINATION
export const getTransactions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const {
    type,
    accountId,
    category,
    startDate,
    endDate,
    page = "1",
    limit = "10",
  } = req.query;

  // Validate page
  if (
    typeof page !== "string" ||
    !/^\d+$/.test(page) ||
    Number(page) < 1
  ) {
    res.status(400).json({
      message: "Page must be a positive whole number",
    });
    return;
  }

  // Validate limit
  if (
    typeof limit !== "string" ||
    !/^\d+$/.test(limit) ||
    Number(limit) < 1 ||
    Number(limit) > 100
  ) {
    res.status(400).json({
      message: "Limit must be a whole number between 1 and 100",
    });
    return;
  }

  const parsedPage = Number(page);
  const parsedLimit = Number(limit);
  const skip = (parsedPage - 1) * parsedLimit;

  // Validate transaction type
  if (
    type !== undefined &&
    type !== "income" &&
    type !== "expense"
  ) {
    res.status(400).json({
      message: "Type must be income or expense",
    });
    return;
  }

  // Validate account ID
  let parsedAccountId: number | undefined;

  if (accountId !== undefined) {
    if (
      typeof accountId !== "string" ||
      !/^\d+$/.test(accountId)
    ) {
      res.status(400).json({
        message: "Account ID must be a positive whole number",
      });
      return;
    }

    parsedAccountId = Number(accountId);

    if (parsedAccountId <= 0) {
      res.status(400).json({
        message: "Account ID must be a positive whole number",
      });
      return;
    }
  }

  // Validate category
  let categoryFilter: string | undefined;

  if (category !== undefined) {
    if (
      typeof category !== "string" ||
      !category.trim()
    ) {
      res.status(400).json({
        message: "Category must be a non-empty value",
      });
      return;
    }

    categoryFilter = category.trim();
  }

  // Validate start date
  let startDateFilter: string | undefined;

  if (startDate !== undefined) {
    if (
      typeof startDate !== "string" ||
      !isValidTransactionDate(startDate)
    ) {
      res.status(400).json({
        message:
          "Start date must be a valid date in YYYY-MM-DD format",
      });
      return;
    }

    startDateFilter = startDate;
  }

  // Validate end date
  let endDateFilter: string | undefined;

  if (endDate !== undefined) {
    if (
      typeof endDate !== "string" ||
      !isValidTransactionDate(endDate)
    ) {
      res.status(400).json({
        message:
          "End date must be a valid date in YYYY-MM-DD format",
      });
      return;
    }

    endDateFilter = endDate;
  }

  // Validate date range
  if (
    startDateFilter &&
    endDateFilter &&
    startDateFilter > endDateFilter
  ) {
    res.status(400).json({
      message: "Start date cannot be after end date",
    });
    return;
  }

  const query = transactionRepository
    .createQueryBuilder("transaction")
    .leftJoinAndSelect("transaction.account", "account")
    .where("account.userId = :userId", {
      userId: req.user!.userId,
    });

  // Apply type filter
  if (type !== undefined) {
    query.andWhere("transaction.type = :type", {
      type,
    });
  }

  // Apply account filter
  if (parsedAccountId !== undefined) {
    query.andWhere("account.id = :accountId", {
      accountId: parsedAccountId,
    });
  }

  // Apply category filter
  if (categoryFilter !== undefined) {
    query.andWhere(
      "LOWER(transaction.category) = LOWER(:category)",
      {
        category: categoryFilter,
      }
    );
  }

  // Apply start date filter
  if (startDateFilter !== undefined) {
    query.andWhere(
      "transaction.transactionDate >= :startDate",
      {
        startDate: startDateFilter,
      }
    );
  }

  // Apply end date filter
  if (endDateFilter !== undefined) {
    query.andWhere(
      "transaction.transactionDate <= :endDate",
      {
        endDate: endDateFilter,
      }
    );
  }

  // Get total matching records before pagination
  const totalRecords = await query.getCount();

  // Get paginated transactions
  const transactions = await query
    .orderBy("transaction.transactionDate", "DESC")
    .addOrderBy("transaction.createdAt", "DESC")
    .skip(skip)
    .take(parsedLimit)
    .getMany();

  const totalPages =
    totalRecords === 0
      ? 0
      : Math.ceil(totalRecords / parsedLimit);

  res.status(200).json({
    transactions,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      totalRecords,
      totalPages,
    },
  });
};

// GET SINGLE TRANSACTION
export const getTransactionById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({
      message: "Invalid transaction ID",
    });
    return;
  }

  const transaction = await transactionRepository
    .createQueryBuilder("transaction")
    .leftJoinAndSelect("transaction.account", "account")
    .where("transaction.id = :id", { id })
    .andWhere("account.userId = :userId", {
      userId: req.user!.userId,
    })
    .getOne();

  if (!transaction) {
    res.status(404).json({
      message: "Transaction not found",
    });
    return;
  }

  res.status(200).json({
    transaction,
  });
};

// DELETE TRANSACTION
export const deleteTransaction = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({
      message: "Invalid transaction ID",
    });
    return;
  }

  const transaction = await transactionRepository
    .createQueryBuilder("transaction")
    .leftJoinAndSelect("transaction.account", "account")
    .where("transaction.id = :id", { id })
    .andWhere("account.userId = :userId", {
      userId: req.user!.userId,
    })
    .getOne();

  if (!transaction) {
    res.status(404).json({
      message: "Transaction not found",
    });
    return;
  }

  const account = transaction.account;

  await AppDataSource.transaction(async (manager) => {
    // Reverse balance change before deleting
    if (transaction.type === "income") {
      account.balance =
        Number(account.balance) -
        Number(transaction.amount);
    } else {
      account.balance =
        Number(account.balance) +
        Number(transaction.amount);
    }

    await manager.save(account);
    await manager.remove(transaction);
  });

  const budgetStatus =
    transaction.type === "expense"
      ? await getBudgetStatusForTransaction(
          req.user!.userId,
          transaction.category,
          transaction.transactionDate
        )
      : null;

  res.status(200).json({
    message: "Transaction deleted successfully",
    updatedBalance: account.balance,
    budgetStatus,
  });
};

// UPDATE TRANSACTION
export const updateTransaction = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({
      message: "Invalid transaction ID",
    });
    return;
  }

  const transaction = await transactionRepository
    .createQueryBuilder("transaction")
    .leftJoinAndSelect("transaction.account", "account")
    .where("transaction.id = :id", { id })
    .andWhere("account.userId = :userId", {
      userId: req.user!.userId,
    })
    .getOne();

  if (!transaction) {
    res.status(404).json({
      message: "Transaction not found",
    });
    return;
  }

  const {
    type,
    amount,
    category,
    description,
    accountId,
    transactionDate,
  } = req.body;

  if (type && type !== "income" && type !== "expense") {
    res.status(400).json({
      message: "Type must be income or expense",
    });
    return;
  }

  if (
    amount !== undefined &&
    (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
  ) {
    res.status(400).json({
      message: "Amount must be greater than 0",
    });
    return;
  }

  if (
    transactionDate !== undefined &&
    !isValidTransactionDate(transactionDate)
  ) {
    res.status(400).json({
      message:
        "Transaction date must be a valid date in YYYY-MM-DD format",
    });
    return;
  }

  if (
    accountId !== undefined &&
    (!Number.isInteger(Number(accountId)) || Number(accountId) <= 0)
  ) {
    res.status(400).json({
      message: "Account ID must be a positive whole number",
    });
    return;
  }

  const oldType = transaction.type;
  const oldAmount = Number(transaction.amount);
  const oldAccount = transaction.account;

  let newAccount = oldAccount;

  if (
    accountId !== undefined &&
    Number(accountId) !== oldAccount.id
  ) {
    const account = await accountRepository.findOne({
      where: {
        id: Number(accountId),
        user: {
          id: req.user!.userId,
        },
      },
    });

    if (!account) {
      res.status(404).json({
        message: "New account not found",
      });
      return;
    }

    newAccount = account;
  }

  await AppDataSource.transaction(async (manager) => {
    // Reverse old transaction balance
    if (oldType === "income") {
      oldAccount.balance =
        Number(oldAccount.balance) - oldAmount;
    } else {
      oldAccount.balance =
        Number(oldAccount.balance) + oldAmount;
    }

    await manager.save(oldAccount);

    // Update transaction fields
    transaction.type = type ?? transaction.type;

    transaction.amount =
      amount !== undefined
        ? Number(amount)
        : oldAmount;

    transaction.category =
      category ?? transaction.category;

    transaction.description =
      description !== undefined
        ? description
        : transaction.description;

    transaction.transactionDate =
      transactionDate !== undefined
        ? transactionDate
        : transaction.transactionDate;

    transaction.account = newAccount;

    // Apply new transaction balance
    const newAmount = Number(transaction.amount);

    if (transaction.type === "income") {
      newAccount.balance =
        Number(newAccount.balance) + newAmount;
    } else {
      newAccount.balance =
        Number(newAccount.balance) - newAmount;
    }

    await manager.save(newAccount);
    await manager.save(transaction);
  });

  const budgetStatus =
    transaction.type === "expense"
      ? await getBudgetStatusForTransaction(
          req.user!.userId,
          transaction.category,
          transaction.transactionDate
        )
      : null;

  res.status(200).json({
    message: "Transaction updated successfully",
    transaction,
    updatedBalance: newAccount.balance,
    budgetStatus,
  });
};