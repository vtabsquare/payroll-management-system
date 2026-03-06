# PayFlow Dynamics - Payroll Management System

Production-ready payroll web application with dynamic incentive tracking, salary scheduling, and automated payslip generation.

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + Framer Motion + shadcn/ui
- **Backend:** Node.js + Express + JWT Authentication
- **Database:** Google Sheets API (with in-memory fallback for local development)
- **Email:** Brevo SMTP API for payslip delivery
- **Deployment:** PM2 + Nginx + Let's Encrypt SSL

## Features

- 🔐 **Authentication & Authorization** - JWT-based auth with role-based access control
- 👥 **Employee Management** - CRUD operations with salary structure and incentive configuration
- 📊 **Attendance Tracking** - CSV upload with validation and proration logic
- 💰 **Payroll Generation** - Automated salary calculation with dynamic incentive deductions
- 📈 **Incentive Ledger** - Cumulative tracking with admin-controlled payouts
- 📅 **Salary Schedule** - Timeline-based salary revisions with notifications
- 📧 **Payslip Delivery** - PDF generation and email distribution via Brevo
- 🔒 **Payment Lock** - Prevents editing after payroll is marked as paid

## Architecture

```
Frontend (React/TypeScript) 
    ↓
Backend (Express API) 
    ↓
Google Sheets (Employees, Users, Payroll, Attendance, Incentive Ledger, Salary Schedule)
    ↓
Brevo API (Email delivery)
```

## Project Structure

```text
backend/
  middleware/
  routes/
  services/
  utils/
  server.js

src/
  components/
  contexts/
  pages/
  services/
```

## Environment Variables

Copy `.env.example` to `.env` and configure the following:

### Required Configuration

```env
# Backend
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://payroll.vtabsquare.com

# Google Sheets API
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SHEET_ID=your_google_sheet_id

# Brevo Email
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=noreply@vtabsquare.com
BREVO_SENDER_NAME=Payroll System

# JWT Secret
JWT_SECRET=your_secure_random_secret

# Frontend
VITE_API_BASE_URL=https://payroll.vtabsquare.com/api
```

**Note:** In local development, `VITE_API_BASE_URL=/api` works because Vite proxies `/api` to `http://localhost:4000`.

## Setup

```bash
npm install
npm --prefix backend install
```

## Local Development

### Terminal 1 - Backend:
```bash
npm run backend:dev
```

### Terminal 2 - Frontend:
```bash
npm run dev
```

**Access:**
- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:4000/api`

### Default Credentials

- **Admin:** `admin@company.com` / `Admin@123`
- **Employee:** `arjun@company.com` / `Employee@123`

## Production Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for complete step-by-step deployment guide to DigitalOcean.

### Quick Deploy Summary

1. Push code to GitHub
2. Clone on DigitalOcean droplet
3. Configure `.env` with production values
4. Install dependencies and build: `npm install && npm run build`
5. Start with PM2: `pm2 start ecosystem.config.js`
6. Configure Nginx reverse proxy
7. Set up SSL with Let's Encrypt
8. Configure DNS A record for subdomain

**Production URL:** `https://payroll.vtabsquare.com`

## API Modules

- **Auth** - Login, forgot password, reset password with JWT tokens
- **Users** - User management with role-based access control
- **Employees** - CRUD operations with salary structure and incentive configuration
- **Attendance** - CSV upload with validation and duplicate handling
- **Payroll** - Generation, editing, payment status, and payslip delivery
- **Incentive Ledger** - Cumulative tracking with manual payout control
- **Salary Schedule** - Timeline-based salary revisions with admin approval
- **Profile** - Current user profile endpoint

## Security Features

- ✅ JWT-based authentication with secure token handling
- ✅ Role-based authorization (admin, employee)
- ✅ bcrypt password hashing (10 rounds)
- ✅ Payroll lock enforcement after payment
- ✅ Helmet.js security headers
- ✅ CORS configuration
- ✅ Environment-based secrets
- ✅ SSL/TLS encryption in production
- ✅ Input validation and sanitization

## License

Proprietary - All rights reserved
