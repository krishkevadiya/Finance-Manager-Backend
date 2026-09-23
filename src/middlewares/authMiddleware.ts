import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        message: "Access denied. No token provided",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      res.status(500).json({
        message: "JWT secret is not configured",
      });
      return;
    }

    const decoded = jwt.verify(token, secret) as {
      userId: number;
      email: string;
    };

    req.user = decoded;

    next();
  } catch (error) {
    console.error("JWT verification error:", error);

    res.status(401).json({
      message: "Access denied. Invalid token",
    });
  }
};