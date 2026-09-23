import { Response } from "express";
import { AppDataSource } from "../config/database";
import { Account } from "../entities/Account";
import { User } from "../entities/User";
import { AuthRequest } from "../middlewares/authMiddleware";

const accountRepository = AppDataSource.getRepository(Account);
const userRepository = AppDataSource.getRepository(User);

// Allowed account types
const allowedAccountTypes = [
  "cash",
  "bank",
  "credit_card",
  "investment",
  "other",
];

// Validate account name
const isValidAccountName = (name: unknown): boolean => {
  return (
    typeof name === "string" &&
    name.trim().length >= 2 &&
    name.trim().length <= 100
  );
};

// Validate account type
const isValidAccountType = (type: unknown): boolean => {
  return (
    typeof type === "string" &&
    allowedAccountTypes.includes(type)
  );
};

// Validate balance
const isValidBalance = (balance: unknown): boolean => {
  if (balance === undefined || balance === null || balance === "") {
    return true;
  }

  const parsedBalance = Number(balance);

  return Number.isFinite(parsedBalance) && parsedBalance >= 0;
};

// Validate currency
const isValidCurrency = (currency: unknown): boolean => {
  return (
    typeof currency === "string" &&
    /^[A-Z]{3}$/.test(currency)
  );
};

// CREATE ACCOUNT
export const createAccount = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { name, type, balance, currency } = req.body;

  if (!isValidAccountName(name)) {
    res.status(400).json({
      message:
        "Account name is required and must be between 2 and 100 characters",
    });
    return;
  }

  if (!isValidAccountType(type)) {
    res.status(400).json({
      message:
        "Account type must be one of: cash, bank, credit_card, investment, other",
    });
    return;
  }

  if (!isValidBalance(balance)) {
    res.status(400).json({
      message: "Balance must be a valid number greater than or equal to 0",
    });
    return;
  }

  const finalCurrency = currency ?? "INR";

  if (!isValidCurrency(finalCurrency)) {
    res.status(400).json({
      message: "Currency must be a valid 3-letter uppercase code",
    });
    return;
  }

  const user = await userRepository.findOne({
    where: {
      id: req.user!.userId,
    },
  });

  if (!user) {
    res.status(404).json({
      message: "User not found",
    });
    return;
  }

  const account = accountRepository.create({
    name: name.trim(),
    type,
    balance: balance ?? 0,
    currency: finalCurrency,
    user,
  });

  await accountRepository.save(account);

  res.status(201).json({
    message: "Account created successfully",
    account: {
      id: account.id,
      name: account.name,
      type: account.type,
      balance: Number(account.balance),
      currency: account.currency,
      createdAt: account.createdAt,
    },
  });
};

// GET ALL ACCOUNTS
export const getAccounts = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const accounts = await accountRepository.find({
    where: {
      user: {
        id: req.user!.userId,
      },
    },
    order: {
      createdAt: "DESC",
    },
  });

  res.status(200).json({
    accounts,
  });
};

// GET SINGLE ACCOUNT
export const getAccountById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({
      message: "Invalid account ID",
    });
    return;
  }

  const account = await accountRepository.findOne({
    where: {
      id,
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

  res.status(200).json({
    account,
  });
};

// UPDATE ACCOUNT
export const updateAccount = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({
      message: "Invalid account ID",
    });
    return;
  }

  const account = await accountRepository.findOne({
    where: {
      id,
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

  const { name, type, balance, currency } = req.body;

  if (name !== undefined && !isValidAccountName(name)) {
    res.status(400).json({
      message: "Account name must be between 2 and 100 characters",
    });
    return;
  }

  if (type !== undefined && !isValidAccountType(type)) {
    res.status(400).json({
      message:
        "Account type must be one of: cash, bank, credit_card, investment, other",
    });
    return;
  }

  if (balance !== undefined && !isValidBalance(balance)) {
    res.status(400).json({
      message: "Balance must be a valid number greater than or equal to 0",
    });
    return;
  }

  if (currency !== undefined && !isValidCurrency(currency)) {
    res.status(400).json({
      message: "Currency must be a valid 3-letter uppercase code",
    });
    return;
  }

  if (name !== undefined) {
    account.name = name.trim();
  }

  if (type !== undefined) {
    account.type = type;
  }

  if (balance !== undefined) {
    account.balance = Number(balance);
  }

  if (currency !== undefined) {
    account.currency = currency;
  }

  await accountRepository.save(account);

  res.status(200).json({
    message: "Account updated successfully",
    account,
  });
};

// DELETE ACCOUNT
export const deleteAccount = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({
      message: "Invalid account ID",
    });
    return;
  }

  const account = await accountRepository.findOne({
    where: {
      id,
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

  await accountRepository.remove(account);

  res.status(200).json({
    message: "Account deleted successfully",
  });
};