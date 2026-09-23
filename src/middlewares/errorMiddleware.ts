import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";

interface AppError extends Error {
  statusCode?: number;
  code?: string;
  detail?: string;
  query?: string;
}

export const errorMiddleware = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;

  logger.error("Unhandled application error", {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    ip: req.ip,
    message: err.message,
    stack: err.stack,
    code: err.code,
    detail: err.detail,
    query: err.query,
  });

  res.status(statusCode).json({
    message:
      statusCode === 500
        ? "Internal server error"
        : err.message || "Something went wrong",
  });
};