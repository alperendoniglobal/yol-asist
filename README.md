# Yol Asistan Backend

Multi-tenant SaaS backend for insurance management platform built with Node.js, Express.js, TypeORM, and MySQL.

## Features

- **Multi-tenancy**: Support for multiple agencies, branches, and users with role-based access control
- **Role-based Access Control**: SUPER_ADMIN, AGENCY_ADMIN, BRANCH_ADMIN, BRANCH_USER
- **Complete Insurance Management**: Customers, vehicles, packages, sales, payments, and commissions
- **Support System**: Built-in ticket and messaging system
- **Statistics & Analytics**: Comprehensive dashboard and reporting
- **Secure Authentication**: JWT-based authentication with refresh tokens
- **Payment Integration**: Iyzico payment gateway integration

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: TypeORM
- **Database**: MySQL 8.0+
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: express-validator
- **Logging**: Winston
- **Security**: Helmet, bcrypt

## Project Structure

```
src/
├── config/          # Configuration files
├── database/        # Database migrations
├── entities/        # TypeORM entities
├── controllers/     # Request handlers
├── services/        # Business logic
├── routes/          # API routes
├── middlewares/     # Custom middlewares
├── utils/           # Utility functions
├── types/           # TypeScript types
├── app.ts          # Express app setup
└── server.ts       # Server entry point
```

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Create MySQL database:
```sql
CREATE DATABASE yol_asistan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

5. Run migrations:
```bash
npm run migration:run
```

6. Start development server:
```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run seed` - Seed database with realistic test data
- `npm run migration:generate` - Generate new migration
- `npm run migration:run` - Run pending migrations
- `npm run migration:revert` - Revert last migration
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Database Seeding

To populate your database with realistic test data:

```bash
npm run seed
```

This will create:
- 5 Agencies
- 10 Branches (2 per agency)
- 35+ Users (Super Admin, Agency Admins, Branch Admins, Branch Users)
- 5 Insurance Packages (with prices and covers)
- 30 Customers
- 30 Vehicles
- ~18 Sales
- ~14 Payments

**Login Credentials:**
- Super Admin: `admin@yolasistan.com` / `Admin123!`
- Agency Admin: `ahmet.yilmaz@anadolu.com` / `Admin123!`
- Branch User: `can.yilmaz@anadolu.com` / `User123!`

See [SEEDING.md](SEEDING.md) for detailed information.

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/refresh-token` - Refresh access token
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/change-password` - Change password

### Agencies
- `GET /api/v1/agencies` - List all agencies
- `GET /api/v1/agencies/:id` - Get agency by ID
- `POST /api/v1/agencies` - Create agency (SUPER_ADMIN only)
- `PUT /api/v1/agencies/:id` - Update agency (SUPER_ADMIN only)
- `DELETE /api/v1/agencies/:id` - Delete agency (SUPER_ADMIN only)

### Branches
- `GET /api/v1/branches` - List branches
- `POST /api/v1/branches` - Create branch
- `PUT /api/v1/branches/:id` - Update branch
- `DELETE /api/v1/branches/:id` - Delete branch

### Users
- `GET /api/v1/users` - List users
- `POST /api/v1/users` - Create user
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user

### Customers
- `GET /api/v1/customers` - List customers
- `GET /api/v1/customers/search` - Search customers
- `POST /api/v1/customers` - Create customer
- `PUT /api/v1/customers/:id` - Update customer
- `DELETE /api/v1/customers/:id` - Delete customer

### Vehicles
- `GET /api/v1/vehicles` - List vehicles
- `GET /api/v1/vehicles/customer/:customerId` - Get customer vehicles
- `POST /api/v1/vehicles` - Create vehicle
- `PUT /api/v1/vehicles/:id` - Update vehicle
- `DELETE /api/v1/vehicles/:id` - Delete vehicle

### Packages
- `GET /api/v1/packages` - List packages
- `GET /api/v1/packages/:id/prices` - Get package prices
- `GET /api/v1/packages/:id/covers` - Get package covers
- `POST /api/v1/packages` - Create package (SUPER_ADMIN only)

### Sales
- `GET /api/v1/sales` - List sales
- `GET /api/v1/sales/stats` - Get sales statistics
- `POST /api/v1/sales` - Create sale
- `PUT /api/v1/sales/:id` - Update sale

### Payments
- `GET /api/v1/payments` - List payments
- `POST /api/v1/payments/iyzico` - Process Iyzico payment
- `POST /api/v1/payments/balance` - Process balance payment
- `POST /api/v1/payments/:id/refund` - Refund payment

### Commissions
- `GET /api/v1/commissions` - List commission requests
- `POST /api/v1/commissions` - Create commission request
- `POST /api/v1/commissions/:id/approve` - Approve request (SUPER_ADMIN)
- `POST /api/v1/commissions/:id/reject` - Reject request (SUPER_ADMIN)

### Support
- `GET /api/v1/support` - List support tickets
- `POST /api/v1/support` - Create ticket
- `GET /api/v1/support/:id/messages` - Get ticket messages
- `POST /api/v1/support/:id/messages` - Add message

### Statistics
- `GET /api/v1/stats/dashboard` - Dashboard statistics
- `GET /api/v1/stats/sales` - Sales statistics
- `GET /api/v1/stats/revenue` - Revenue statistics
- `GET /api/v1/stats/customers` - Customer statistics

## Multi-tenancy Rules

### SUPER_ADMIN
- Can see all agencies, branches, users, sales, customers
- No filtering applied
- Full system access

### AGENCY_ADMIN
- Can only see their own agency and all branches inside it
- Filtered by `agency_id`
- Can manage branches and users within their agency

### BRANCH_ADMIN
- Can only see their own branch
- Filtered by `agency_id` and `branch_id`
- Can manage users and data within their branch

### BRANCH_USER
- Can only see the data they created
- Filtered by `agency_id`, `branch_id`, and `created_by`
- Limited to their own records

## Environment Variables

See `.env.example` for all available configuration options.

## License

MIT
