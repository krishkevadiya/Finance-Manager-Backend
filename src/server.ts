import "reflect-metadata";
import "dotenv/config";

import app from "./app";
import { AppDataSource } from "./config/database";
import { logger } from "./config/logger";

const PORT = process.env.PORT || 5000;

const startServer = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();

    logger.info("Database connected");

    app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error("Database connection failed", {
      error,
    });

    process.exit(1);
  }
};

void startServer();