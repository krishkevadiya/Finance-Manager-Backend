import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import accountRoutes from "./routes/accountRoutes";
import transactionRoutes from "./routes/transactionRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import categoryRoutes from "./routes/categoryRoutes";

import { errorMiddleware } from "./middlewares/errorMiddleware";
import { requestLogger } from "./middlewares/requestLogger";
import { logger } from "./config/logger";

import budgetRoutes from "./routes/budgetRoutes";

const app = express();

// Security headers
app.use(helmet());

// Request logging
app.use(requestLogger);

// CORS
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Request body parser
app.use(express.json({ limit: "1mb" }));

// Basic API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,  
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests. Please try again later.",
  },
});

app.use("/api", apiLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/budgets", budgetRoutes);

// Health check
app.get("/", (_req, res) => {
  res.status(200).json({
    message: "Finance Management API is running",
  });
});

// Unknown route handler
app.use((req, res) => {
  logger.warn("Route not found", {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized error handler
app.use(errorMiddleware);

// Process-level error logging
process.on("uncaughtException", (error: Error) => {
  logger.error("UNCAUGHT EXCEPTION", {
    message: error.message,
    stack: error.stack,
  });
});

process.on("unhandledRejection", (reason: unknown) => {
  logger.error("UNHANDLED PROMISE REJECTION", {
    reason,
  });
});

export default app;