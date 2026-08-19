# 🏙️ Digital City Center – Backend

A scalable backend system for the Digital City Center platform built using Node.js, Express, PostgreSQL, and Prisma ORM. This backend provides secure APIs for authentication, user management, product handling, and order processing.

---

## 📌 Project Overview

The Digital City Center backend is designed to support a digital marketplace ecosystem where users can register, authenticate, browse products, and place orders.

The system follows a modular architecture with clear separation of concerns to ensure scalability, maintainability, and team collaboration.

---

## 🎯 Key Features

* User Authentication (Register/Login)
* JWT-based Authorization
* Secure Password Hashing
* RESTful API Architecture
* PostgreSQL Database Integration
* Prisma ORM for database management
* Scalable folder structure
* Role-based access control (future scope)

---

## 🧱 Tech Stack

### Backend Framework

* Node.js
* Express.js

### Database

* PostgreSQL

### ORM

* Prisma ORM

### Authentication

* JSON Web Token (JWT)
* bcrypt.js

### Tools

* Git & GitHub
* Postman
* VS Code

---

## 📁 Project Structure

```text
digital-city-center-backend/
│
├── prisma/                     # Prisma ORM configuration
│   ├── schema.prisma           # Database schema (models defined here)
│   └── migrations/             # Database migration history
│
├── src/                        # Main source code
│   │
│   ├── app.js                  # Express app configuration
│   ├── server.js               # Entry point of application
│   │
│   ├── config/                 # Configuration files
│   │   └── prisma.js           # Prisma client setup
│   │
│   ├── routes/                 # API route definitions
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── productRoutes.js
│   │   └── orderRoutes.js
│   │
│   ├── controllers/            # Request handlers
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── productController.js
│   │   └── orderController.js
│   │
│   ├── services/               # Business logic layer
│   │   ├── authService.js
│   │   ├── userService.js
│   │   ├── productService.js
│   │   └── orderService.js
│   │
│   ├── middleware/             # Custom middleware
│   │   ├── authMiddleware.js
│   │   ├── errorMiddleware.js
│   │   └── loggerMiddleware.js
│   │
│   ├── utils/                  # Helper functions
│   │   ├── generateToken.js
│   │   ├── hashPassword.js
│   │   └── responseHandler.js
│   │
│   └── database/               # Database utilities (seed scripts)
│       └── seed.js
│
├── tests/                      # Unit & integration tests
├── docs/                       # Project documentation
│
├── .github/
│   └── workflows/              # CI/CD pipelines (future)
│
├── .env.example                # Sample environment variables
├── .gitignore                  # Ignored files
├── package.json                # Dependencies & scripts
├── package-lock.json
└── README.md
```

---

## ⚙️ Installation & Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd digital-city-center-backend
```

---

### 2. Install Dependencies

```bash
npm install
```

---

### 3. Setup Environment Variables

Create a `.env` file:

```env
PORT=5000
DATABASE_URL="postgresql://postgres:password@localhost:5432/digital_city_center"
NODE_ENV="development"
REDIS_URL="redis://localhost:6379"
JWT_SECRET=your_secret_key
GOOGLE_CLIENT_ID=862870385262-3ci4ovdfhj81hbemgc5i69kqlfjt8ldq.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback
SMTP_HOST=smtp.gmail.com

SMTP_PORT=587

SMTP_USER=tharzmt@gmail.com

SMTP_PASS=akdsqxgjznbsehrm

MAIL_FROM=Digital City Center <tharzmt@gmail.com>

FRONTEND_URL=http://localhost:5173

# PayHere Payment Gateway (Sandbox)
PAYHERE_MERCHANT_ID=1236278
PAYHERE_MERCHANT_SECRET=Mjg3NzMwMzk1ODM2NzQ2MzUzODAzNTA1OTc1NjQzMzQ2NzQ5NTY0NQ==
PAYHERE_SANDBOX=true

```

---

### 4. Setup Prisma

Initialize Prisma (if not already done):

```bash
npx prisma init
```

Run migrations:

```bash
npx prisma migrate dev --name init
```

Open Prisma Studio:

```bash
npx prisma studio
```

---

### 5. Run Development Server

```bash
npm run dev
```

Server runs at:

```text
http://localhost:5000
```

---

## 📡 API Endpoints

### Authentication

```
POST /api/auth/register
POST /api/auth/login
```

### Users

```
GET /api/users
GET /api/users/:id
```

### Products

```
GET /api/products
POST /api/products
```

### Orders

```
POST /api/orders
GET /api/orders
```

---

## 🔐 Authentication Flow

* User registers with email & password
* Password is hashed using bcrypt
* On login, JWT token is generated
* Token is used for protected routes
* Middleware validates token

---

## 🧠 Architecture Flow

```text
Client Request
      ↓
Routes
      ↓
Controllers
      ↓
Services
      ↓
Prisma ORM
      ↓
PostgreSQL Database
```

---

## 🧪 Testing

* API testing using Postman
* Manual endpoint validation
* Authentication flow testing
* Error handling verification

---

## 👥 Team Structure

* Team A — Repository & Architecture Setup
* Team B — Backend Core Setup
* Team C — Database & Prisma ORM
* Team D — Authentication System
* Team E — Frontend & API Documentation
* QA Team — Testing & Validation

---

## 📌 Git Workflow

```text
main → production
develop → integration branch
feature/* → new features
bugfix/* → bug fixes
```

### Workflow Steps:

1. Create feature branch
2. Develop feature
3. Push branch
4. Create Pull Request
5. Review & merge into develop

---

## 🚀 Future Enhancements

* Payment gateway integration
* Admin dashboard
* Real-time notifications
* Advanced analytics
* Docker deployment
* Cloud hosting (AWS / Render / Azure)

---

## 📄 License

This project is created for academic and learning purposes.

---

## 👨‍💻 Contributors

* Full Stack Development Team
* QA Engineers

