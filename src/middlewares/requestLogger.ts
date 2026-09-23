import morgan from "morgan";
import { logger } from "../config/logger";

morgan.token("user-agent", (req) => req.headers["user-agent"] || "");

export const requestLogger = morgan(
  ":date[iso] :method :url :status :response-time ms - :user-agent",
  {
    stream: {
      write: (message: string) => {
        logger.info(message.trim());
      },
    },
  }
);