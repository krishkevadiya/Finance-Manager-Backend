import { Response } from "express";
import { AppDataSource } from "../config/database";
import { Transaction } from "../entities/Transaction";
import { Account } from "../entities/Account";
import { AuthRequest } from "../middlewares/authMiddleware";

const isValidDate = (date: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsedDate = new Date(`${date}T00:00:00.000Z`);

  return (
    !isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === date
  );
};

const validateDateFilters = (
  req: AuthRequest,
  res: Response
): { startDate?: string; endDate?: string } | null => {
  const { startDate, endDate } = req.query;

  if (startDate && typeof startDate !== "string") {
    res.status(400).json({
      message: "startDate must be a valid date in YYYY-MM-DD format",
    });
    return null;
  }

  if (endDate && typeof endDate !== "string") {
    res.status(400).json({
      message: "endDate must be a valid date in YYYY-MM-DD format",
    });
    return null;
  }

  if (startDate && !isValidDate(startDate)) {
    res.status(400).json({
      message: "startDate must be a valid date in YYYY-MM-DD format",
    });
    return null;
  }

  if (endDate && !isValidDate(endDate)) {
    res.status(400).json({
      message: "endDate must be a valid date in YYYY-MM-DD format",
    });
    return null;
  }

  if (
    startDate &&
    endDate &&
    new Date(startDate) > new Date(endDate)
  ) {
    res.status(400).json({
      message: "startDate cannot be greater than endDate",
    });
    return null;
  }

  return {
    startDate: startDate as string | undefined,
    endDate: endDate as string | undefined,
  };
};

export const getDashboardSummary = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({
      message: "Unauthorized",
    });
    return;
  }

  const filters = validateDateFilters(req, res);

  if (!filters) {
    return;
  }

  const { startDate, endDate } = filters;

  const accountRepository = AppDataSource.getRepository(Account);
  const transactionRepository = AppDataSource.getRepository(Transaction);

  const accounts = await accountRepository.find({
    where: {
      user: {
        id: userId,
      },
    },
  });

  const transactionQuery = transactionRepository
    .createQueryBuilder("transaction")
    .leftJoinAndSelect("transaction.account", "account")
    .leftJoin("account.user", "user")
    .where("user.id = :userId", { userId });

  if (startDate) {
    transactionQuery.andWhere(
      "transaction.transactionDate >= :startDate",
      { startDate }
    );
  }

  if (endDate) {
    transactionQuery.andWhere(
      "transaction.transactionDate <= :endDate",
      { endDate }
    );
  }

  const transactions = await transactionQuery
    .orderBy("transaction.transactionDate", "DESC")
    .addOrderBy("transaction.createdAt", "DESC")
    .getMany();

  const totalIncome = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce(
      (total, transaction) => total + Number(transaction.amount),
      0
    );

  const totalExpense = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce(
      (total, transaction) => total + Number(transaction.amount),
      0
    );

  const totalBalance = accounts.reduce(
    (total, account) => total + Number(account.balance),
    0
  );

  res.status(200).json({
    filters: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
    summary: {
      totalBalance,
      totalIncome,
      totalExpense,
      transactionCount: transactions.length,
      accountCount: accounts.length,
    },
    recentTransactions: transactions.slice(0, 5),
  });
};

export const getExpensesByCategory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({
      message: "Unauthorized",
    });
    return;
  }

  const filters = validateDateFilters(req, res);

  if (!filters) {
    return;
  }

  const { startDate, endDate } = filters;

  const transactionRepository = AppDataSource.getRepository(Transaction);

  const transactionQuery = transactionRepository
    .createQueryBuilder("transaction")
    .leftJoin("transaction.account", "account")
    .leftJoin("account.user", "user")
    .where("user.id = :userId", { userId })
    .andWhere("transaction.type = :type", {
      type: "expense",
    });

  if (startDate) {
    transactionQuery.andWhere(
      "transaction.transactionDate >= :startDate",
      { startDate }
    );
  }

  if (endDate) {
    transactionQuery.andWhere(
      "transaction.transactionDate <= :endDate",
      { endDate }
    );
  }

  const transactions = await transactionQuery.getMany();

  const categoryTotals: Record<string, number> = {};

  transactions.forEach((transaction) => {
    const category = transaction.category || "Uncategorized";
    const amount = Number(transaction.amount);

    if (!categoryTotals[category]) {
      categoryTotals[category] = 0;
    }

    categoryTotals[category] += amount;
  });

  const categories = Object.entries(categoryTotals)
    .map(([category, total]) => ({
      category,
      total,
    }))
    .sort((a, b) => b.total - a.total);

  const totalExpense = categories.reduce(
    (total, item) => total + item.total,
    0
  );

  res.status(200).json({
    filters: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
    totalExpense,
    categories,
  });
};

export const getIncomeByCategory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({
      message: "Unauthorized",
    });
    return;
  }

  const filters = validateDateFilters(req, res);

  if (!filters) {
    return;
  }

  const { startDate, endDate } = filters;

  const transactionRepository = AppDataSource.getRepository(Transaction);

  const transactionQuery = transactionRepository
    .createQueryBuilder("transaction")
    .leftJoin("transaction.account", "account")
    .leftJoin("account.user", "user")
    .where("user.id = :userId", { userId })
    .andWhere("transaction.type = :type", {
      type: "income",
    });

  if (startDate) {
    transactionQuery.andWhere(
      "transaction.transactionDate >= :startDate",
      { startDate }
    );
  }

  if (endDate) {
    transactionQuery.andWhere(
      "transaction.transactionDate <= :endDate",
      { endDate }
    );
  }

  const transactions = await transactionQuery.getMany();

  const categoryTotals: Record<string, number> = {};

  transactions.forEach((transaction) => {
    const category = transaction.category || "Uncategorized";
    const amount = Number(transaction.amount);

    if (!categoryTotals[category]) {
      categoryTotals[category] = 0;
    }

    categoryTotals[category] += amount;
  });

  const categories = Object.entries(categoryTotals)
    .map(([category, total]) => ({
      category,
      total,
    }))
    .sort((a, b) => b.total - a.total);

  const totalIncome = categories.reduce(
    (total, item) => total + item.total,
    0
  );

  res.status(200).json({
    filters: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
    totalIncome,
    categories,
  });
};

export const getMonthlySummary = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({
      message: "Unauthorized",
    });
    return;
  }

  const filters = validateDateFilters(req, res);

  if (!filters) {
    return;
  }

  const { startDate, endDate } = filters;

  /*
   * Supported chart grouping:
   *
   * day   -> group transactions by date
   * week  -> group transactions by week
   * month -> group transactions by month
   * year  -> group transactions by year
   *
   * Default: month
   */
  const requestedGroupBy = req.query.groupBy;

  const groupBy =
    requestedGroupBy === "day" ||
    requestedGroupBy === "week" ||
    requestedGroupBy === "month" ||
    requestedGroupBy === "year"
      ? requestedGroupBy
      : "month";

  const transactionRepository =
    AppDataSource.getRepository(Transaction);

  const transactionQuery = transactionRepository
    .createQueryBuilder("transaction")
    .leftJoin("transaction.account", "account")
    .leftJoin("account.user", "user")
    .where("user.id = :userId", {
      userId,
    });

  if (startDate) {
    transactionQuery.andWhere(
      "transaction.transactionDate >= :startDate",
      {
        startDate,
      }
    );
  }

  if (endDate) {
    transactionQuery.andWhere(
      "transaction.transactionDate <= :endDate",
      {
        endDate,
      }
    );
  }

  const transactions = await transactionQuery
    .orderBy("transaction.transactionDate", "ASC")
    .getMany();

  interface PeriodTotals {
    income: number;
    expense: number;
  }

  const periodTotals: Record<string, PeriodTotals> = {};

  /*
   * Convert a transaction date into the requested
   * grouping key.
   */
  const getPeriodKey = (dateString: string): string => {
    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    // DAY
    // Example: 2026-09-22
    if (groupBy === "day") {
      return dateString;
    }

    // WEEK
    // ISO-style week starting Monday.
    if (groupBy === "week") {
      const dayOfWeek = date.getDay();

      const mondayOffset =
        dayOfWeek === 0
          ? -6
          : 1 - dayOfWeek;

      const monday = new Date(date);

      monday.setDate(
        date.getDate() + mondayOffset
      );

      return toIsoDate(monday);
    }

    // MONTH
    // Example: 2026-09
    if (groupBy === "month") {
      return dateString.substring(0, 7);
    }

    // YEAR
    // Example: 2026
    return dateString.substring(0, 4);
  };

  /*
   * Convert Date to YYYY-MM-DD.
   */
  const toIsoDate = (date: Date): string => {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

  transactions.forEach((transaction) => {
    const transactionDate =
      transaction.transactionDate;

    if (!transactionDate) {
      return;
    }

    const period = getPeriodKey(
      transactionDate
    );

    const amount = Number(
      transaction.amount
    );

    if (!periodTotals[period]) {
      periodTotals[period] = {
        income: 0,
        expense: 0,
      };
    }

    if (transaction.type === "income") {
      periodTotals[period].income += amount;
    }

    if (transaction.type === "expense") {
      periodTotals[period].expense += amount;
    }
  });

  const periods = Object.entries(periodTotals)
    .map(([period, totals]) => ({
      period,

      income: totals.income,

      expense: totals.expense,

      net:
        totals.income -
        totals.expense,
    }))
    .sort((a, b) =>
      a.period.localeCompare(b.period)
    );

  res.status(200).json({
    filters: {
      startDate: startDate || null,
      endDate: endDate || null,
    },

    groupBy,

    periods,
  });
};

export const getAccountsSummary = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({
      message: "Unauthorized",
    });
    return;
  }

  const accountRepository = AppDataSource.getRepository(Account);
  const transactionRepository = AppDataSource.getRepository(Transaction);

  const accounts = await accountRepository.find({
    where: {
      user: {
        id: userId,
      },
    },
    order: {
      id: "ASC",
    },
  });

  const accountSummaries = await Promise.all(
    accounts.map(async (account) => {
      const transactions = await transactionRepository
        .createQueryBuilder("transaction")
        .where("transaction.accountId = :accountId", {
          accountId: account.id,
        })
        .andWhere("transaction.type IN (:...types)", {
          types: ["income", "expense"],
        })
        .getMany();

      const totalIncome = transactions
        .filter((transaction) => transaction.type === "income")
        .reduce(
          (total, transaction) => total + Number(transaction.amount),
          0
        );

      const totalExpense = transactions
        .filter((transaction) => transaction.type === "expense")
        .reduce(
          (total, transaction) => total + Number(transaction.amount),
          0
        );

      return {
        accountId: account.id,
        accountName: account.name,
        accountType: account.type,
        currency: account.currency,
        balance: Number(account.balance),
        totalIncome,
        totalExpense,
        net: totalIncome - totalExpense,
      };
    })
  );

  res.status(200).json({
    accounts: accountSummaries,
  });
};