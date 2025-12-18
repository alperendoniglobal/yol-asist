I am building a multi-tenant SaaS project using Node.js, Express.js, TypeORM and MySQL (phpMyAdmin).

I want you to generate a complete backend architecture with entities, controllers, services, routes, middlewares, and folder structure.

===============================
PROJECT DESCRIPTION
===============================

This is a multi-tenant system with:
- SUPER_ADMIN (global system admin)
- AGENCY_ADMIN (agency owner)
- BRANCH_ADMIN (branch manager)
- BRANCH_USER (branch staff)

Multi-tenancy rules:
- SUPER_ADMIN can see all agencies, branches, users, sales, customers.
- AGENCY_ADMIN can only see their own agency and all branches inside it.
- BRANCH_ADMIN can only see their own branch.
- BRANCH_USER can only see the data they created.

Every record in the system must contain:
- agency_id (nullable for SUPER_ADMIN)
- branch_id (nullable for AGENCY_ADMIN)
- created_by (user_id)

===============================
FEATURE MODULES
===============================

The platform contains these modules:

✔ Agencies (Dealers)
✔ Branches
✔ Users & Roles
✔ Customers
✔ Vehicles
✔ Packages
✔ Package Prices
✔ Package Covers
✔ Sales
✔ Payments
✔ Commission Requests
✔ Support Tickets
✔ Statistics

===============================
DATABASE ENTITIES (TypeORM)
===============================

Create the following entities with full relations:

1) Agency
   - id
   - name
   - status
   - created_at
   - updated_at
   One Agency has many Branches.
   One Agency has many Users.

2) Branch
   - id
   - agency_id (FK)
   - name
   - status
   One Branch has many Users.

3) User
   - id
   - agency_id (FK, nullable for SUPER_ADMIN)
   - branch_id (FK, nullable for AGENCY_ADMIN)
   - name
   - email
   - phone
   - password (hashed)
   - role: SUPER_ADMIN | AGENCY_ADMIN | BRANCH_ADMIN | BRANCH_USER
   - permissions (JSON)
   - created_at
   - updated_at

4) Customer
   - id
   - agency_id FK
   - branch_id FK
   - created_by FK(User)
   - tc/vkn
   - name
   - surname
   - phone
   - email

5) Vehicle
   - id
   - customer_id FK
   - agency_id FK
   - branch_id FK
   - plate
   - brand_id
   - model_id
   - model_year
   - usage_type

6) Package
   - id
   - name
   - usage_type
   - min_age
   - max_age
   - status

7) PackagePrice
   - id
   - package_id FK
   - model_year
   - price
   - commission_rate

8) PackageCover
   - id
   - package_id FK
   - title
   - description

9) Sale
   - id
   - customer_id FK
   - vehicle_id FK
   - agency_id FK
   - branch_id FK
   - user_id FK
   - package_id FK
   - price
   - commission
   - start_date
   - end_date

10) Payment
    - id
    - sale_id FK
    - agency_id FK
    - amount
    - type (iyzico | balance)
    - status

11) CommissionRequest
    - id
    - agency_id
    - amount
    - status

12) SupportTicket
    - id
    - agency_id
    - branch_id
    - user_id
    - subject
    - status

13) SupportMessage
    - id
    - ticket_id
    - sender_id
    - message

===============================
REQUIRED MIDDLEWARES
===============================

Create the following middlewares:

1) authMiddleware
   - verify JWT
   - attach user to request
   - deny unauthorized users

2) roleMiddleware(requiredRoles)
   - block if role not allowed

3) tenantMiddleware
   - automatically filter based on:
     SUPER_ADMIN → no filter
     AGENCY_ADMIN → filter by agency_id
     BRANCH_ADMIN → filter by agency_id + branch_id
     BRANCH_USER → agency_id + branch_id + created_by

===============================
PROJECT STRUCTURE
===============================

Generate the following folder structure:

src/
 ├─ config/
 ├─ database/
 ├─ entities/
 ├─ controllers/
 ├─ services/
 ├─ routes/
 ├─ middlewares/
 ├─ utils/
 ├─ app.ts
 └─ server.ts

===============================
WHAT YOU MUST GENERATE NOW
===============================

Start with:

✔ Step 1: Generate all TypeORM entities with full relations.
✔ Step 2: Generate migration files.
✔ Step 3: Generate folder structure.
✔ Step 4: Generate permission middleware.
✔ Step 5: Generate all route definitions.
✔ Step 6: Generate empty controller & service classes.

Do NOT write business logic yet.
Just create architecture, definitions, and structure.

Output everything in clean, well-organized code blocks.

Start with: **Generate all TypeORM Entities first.**
