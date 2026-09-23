import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { User } from "../entities/User";
import { Account } from "../entities/Account";
import { Transaction } from "../entities/Transaction";
import { Category } from "../entities/Category";
import { Budget } from "../entities/Budget";

const sslSetting = (process.env.DB_SSL ?? "").toLowerCase();
const isSSL = ["true", "1", "yes", "require"].includes(sslSetting);

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: true,
  logging: false,
  entities: [User, Account, Transaction, Category, Budget],
  ssl: isSSL ? { rejectUnauthorized: false } : false,
});