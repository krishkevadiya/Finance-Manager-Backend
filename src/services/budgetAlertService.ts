import { AppDataSource } from "../config/database";
import { Budget } from "../entities/Budget";
import { Category } from "../entities/Category";
import { Transaction } from "../entities/Transaction";

export interface BudgetStatus {
  budgetId: number;
  categoryId: number;
  category: string;
  month: number;
  year: number;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  exceeded: boolean;
  exceededBy: number;
}

const pad = (value: number): string =>
  String(value).padStart(2, "0");

const getMonthRange = (
  year: number,
  month: number
): { startDate: string; endDateExclusive: string } => {
  const startDate = `${year}-${pad(month)}-01`;

  if (month === 12) {
    return {
      startDate,
      endDateExclusive: `${year + 1}-01-01`,
    };
  }

  return {
    startDate,
    endDateExclusive: `${year}-${pad(month + 1)}-01`,
  };
};

export const getBudgetStatusForBudget = async (
  budget: Budget
): Promise<BudgetStatus> => {
  const transactionRepository =
    AppDataSource.getRepository(Transaction);

  const categoryRepository =
    AppDataSource.getRepository(Category);

  let categoryName = budget.category?.name;

  if (!categoryName) {
    const category = await categoryRepository.findOne({
      where: {
        id: budget.categoryId,
        userId: budget.userId,
      },
    });

    categoryName = category?.name ?? "Unknown Category";
  }

  const { startDate, endDateExclusive } = getMonthRange(
    budget.year,
    budget.month
  );

  const result = await transactionRepository
    .createQueryBuilder("transaction")
    .leftJoin("transaction.account", "account")
    .where("account.userId = :userId", {
      userId: budget.userId,
    })
    .andWhere("transaction.type = :type", {
      type: "expense",
    })
    .andWhere("transaction.category = :category", {
      category: categoryName,
    })
    .andWhere("transaction.transactionDate >= :startDate", {
      startDate,
    })
    .andWhere(
      "transaction.transactionDate < :endDateExclusive",
      {
        endDateExclusive,
      }
    )
    .select("COALESCE(SUM(transaction.amount), 0)", "spentAmount")
    .getRawOne<{ spentAmount: string }>();

  const budgetAmount = Number(budget.amount) || 0;
  const spentAmount = Number(result?.spentAmount ?? 0) || 0;
  const remainingAmount = budgetAmount - spentAmount;
  const exceeded = spentAmount > budgetAmount;
  const exceededBy = exceeded ? spentAmount - budgetAmount : 0;
  const percentageUsed =
    budgetAmount > 0
      ? (spentAmount / budgetAmount) * 100
      : spentAmount > 0
        ? 100
        : 0;

  return {
    budgetId: budget.id,
    categoryId: budget.categoryId,
    category: categoryName,
    month: budget.month,
    year: budget.year,
    budgetAmount,
    spentAmount,
    remainingAmount,
    percentageUsed,
    exceeded,
    exceededBy,
  };
};

export const getBudgetStatusForTransaction = async (
  userId: number,
  categoryName: string,
  transactionDate: string
): Promise<BudgetStatus | null> => {
  const categoryRepository =
    AppDataSource.getRepository(Category);

  const category = await categoryRepository.findOne({
    where: {
      userId,
      name: categoryName,
    },
  });

  if (!category) {
    return null;
  }

  const [yearText, monthText] = transactionDate.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return null;
  }

  const budgetRepository =
    AppDataSource.getRepository(Budget);

  const budget = await budgetRepository.findOne({
    where: {
      userId,
      categoryId: category.id,
      year,
      month,
    },
    relations: {
      category: true,
    },
  });

  if (!budget) {
    return null;
  }

  return getBudgetStatusForBudget(budget);
};
