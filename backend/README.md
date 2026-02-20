# Odin Backend

NestJS + MongoDB (Mongoose) backend for multi-tenant football ERP.

## Features implemented
- Club responsable registration with pending admin approval.
- Club-scoped user registration/approval for `JOUEUR`, `STAFF_TECHNIQUE`, `STAFF_MEDICAL`, `FINANCIER`.
- Strict `clubId` tenant scoping + role/permission guards.
- Email verification by 6-digit code on registration.
- Forgot password by 6-digit code.
- Finance APIs (accounting, payroll, transfers, treasury, budget, reports).
- Sensitive finance actions protected by re-auth (`x-sensitive-password` or `x-sensitive-otp`).
- Immutable audit logs for sensitive/business actions.
- Idempotent admin seed script.

## Quick start
1. Copy env:
```bash
cp .env.example .env
```
2. Install dependencies:
```bash
npm install
```
3. Run API:
```bash
npm run start:dev
```
4. Seed global admin:
```bash
npm run seed:admin
```

API base URL: `http://localhost:3001/api`
Swagger: `http://localhost:3001/docs`

## Core env vars
- `MONGO_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `SENSITIVE_DAILY_LIMIT_COUNT`
- `SENSITIVE_DAILY_LIMIT_AMOUNT`
- `SENSITIVE_PER_ACTION_AMOUNT_LIMIT`

## Tests
```bash
npm test
npm run test:e2e
```
