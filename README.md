# Z Consult Backend

<p align="left">
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-6.19-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Swagger-OpenAPI-22C55E?style=flat-square&logo=swagger&logoColor=white" alt="Swagger" />
  <img src="https://img.shields.io/badge/JWT-Auth-0F172A?style=flat-square&logo=jsonwebtokens&logoColor=white" alt="JWT" />
</p>

## Overview

Z Consult Backend is a production-ready API built with **NestJS** and **Prisma**, providing appointment scheduling, queue management, staff assignment, and admin analytics functionalities for a clinic management system.

## Core Features

- **Role-Based Access Control (RBAC)** - Admin, Buyer, and Problem Solver roles.
- **Appointments** - Create, update, cancel, and manage appointments.
- **Queue Management** - Assign appointments to available staff, with smart conflict checking.
- **Admin Dashboard** - View project statistics, recent activities, and staff availability.
- **Task Management** - Problem solvers can create, manage, and submit tasks.
- **JWT Authentication** - Secure token-based authentication for users.

---

## Tech Stack

- **NestJS**: A progressive Node.js framework for building scalable applications.
- **TypeScript**: Static typing for cleaner and more predictable code.
- **Prisma**: ORM for database management with PostgreSQL.
- **PostgreSQL**: Relational database to store appointment, staff, project, and queue data.
- **JWT Authentication**: Secure user authentication with access and refresh tokens.
- **Swagger**: OpenAPI documentation for easy API exploration.

---

## Quickstart

### 1. Install Dependencies

First, clone the repository and navigate to the backend directory.

```bash
git clone https://github.com/your-org/z-consult-backend.git
cd z-consult-backend
npm install

```


2. Set Up PostgreSQL

Ensure PostgreSQL is running on your local machine or use a cloud database (e.g., Heroku, AWS RDS). Then, configure your .env file with the DATABASE_URL for Prisma to connect to the database.

For local PostgreSQL:
DATABASE_URL=postgresql://username:password@localhost:5432/zconsult

3. Run Migrations

Run Prisma migrations to set up the database schema.

npx prisma migrate dev


4. Start the Server
npm run start:dev


Environment Variables

```
Variable	Required	Default	Description
DATABASE_URL	Yes	-	Database connection string for PostgreSQL
JWT_SECRET	Yes	-	Base JWT secret for authentication
JWT_ACCESS_SECRET	No	access-secret	Secret for signing access tokens
JWT_REFRESH_SECRET	No	refresh-secret	Secret for signing refresh tokens
JWT_EXPIRES_IN	No	15m	Default JWT expiry for access tokens
PORT	No	3000	API port
SUPABASE_URL	No	-	URL for Supabase storage (if needed)
SUPABASE_ANON_KEY	No	-	Supabase anon key (if needed)
NODE_ENV	No	-	Set to production for secure refresh cookies
```



API Routes
```
Auth
Route	Method	Role	Description
/auth/register	POST	Public	Registers a new user
/auth/login	POST	Public	Logs in and provides token
/auth/refresh	POST	Public	Refreshes the auth token
/auth/me	GET	Bearer	Fetches the current user info
Appointments
Route	Method	Role	Description
/appointments	GET	Admin	List all appointments
/appointments	POST	Admin	Create new appointment
/appointments/:id	PATCH	Admin	Update existing appointment
/appointments/:id/cancel	POST	Admin	Cancel an appointment
Queue
Route	Method	Role	Description
/queue	GET	Admin	Get the current active queue
/queue/assign	POST	Admin	Assign the next appointment
Staff
Route	Method	Role	Description
/staff	GET	Admin	Get the list of staff members
/staff	POST	Admin	Add a new staff member


```

#Project Structure
```
src/
  auth/            # Authentication related routes
  appointments/    # Appointment management
  queue/           # Queue and assignment logic
  staff/           # Staff management
  services/        # Service management
  common/          # Shared utilities (guards, interceptors, etc.)
  prisma/          # Prisma schema, migrations, and seed
  dashboard/       # Admin dashboard summary
```


Docker Setup

This project comes with a docker-compose.yml file for setting up PostgreSQL locally and a Dockerfile for production.

To run the project with Docker:

Build the Docker image:

docker build -t z-consult-backend .


Start the container:

docker-compose up

Running Tests

To run the tests for the backend:

npm run test


For end-to-end testing:

npm run test:e2e



