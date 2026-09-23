# Finance Management System - Backend

Backend REST API for the Finance Management System.

This backend provides authentication, account management, transaction management, categories, budgets, dashboard summaries, and budget alerts.

## Technology Stack

- Node.js
- Express.js
- TypeScript
- PostgreSQL
- TypeORM
- JWT Authentication
- bcryptjs
- Axios
- CORS

## Main Features

- User registration and login
- JWT-based authentication
- Protected API routes
- Account management
- Income and expense transactions
- Transaction filtering and pagination
- Transaction update and deletion
- Automatic account balance updates
- Categories management
- Monthly budgets
- Budget usage and alerts
- Dashboard financial summaries
- Centralized error handling
- Request logging
- Database transactions for financial operations

## Project Structure

```text
backend/
│
├── config/
│   ├── database.ts
│   └── logger.ts
│
├── controllers/
│   ├── authController.ts
│   ├── accountController.ts
│   ├── transactionController.ts
│   ├── categoryController.ts
│   ├── budgetController.ts
│   └── dashboardController.ts
│
├── entities/
│   ├── User.ts
│   ├── Account.ts
│   ├── Transaction.ts
│   ├── Category.ts
│   └── Budget.ts
│
├── middlewares/
│   ├── asyncHandler.ts
│   ├── authMiddleware.ts
│   ├── errorMiddleware.ts
│   └── requestLogger.ts
│
├── routes/
│   ├── authRoutes.ts
│   ├── accountRoutes.ts
│   ├── transactionRoutes.ts
│   ├── categoryRoutes.ts
│   ├── budgetRoutes.ts
│   └── dashboardRoutes.ts
│
├── services/
│   └── budgetAlertService.ts
│
├── app.ts
├── server.ts
├── package.json
├── tsconfig.json
└── README.md