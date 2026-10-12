<div align="center">

# 🎓 Special Education Management System

### A modern SaaS platform for managing special education centers.

Built with **Next.js**, **React**, **TypeScript** and **Tailwind CSS**.

</div>

---

## 📖 Overview

The **Special Education Management System** is a comprehensive SaaS platform designed to replace Excel-based workflows used by special education centers.

It centralizes student management, session scheduling, financial tracking, reporting, and teacher management into a modern web application.

---

## ✨ Features

### 👨‍🎓 Student Management

- Student profiles
- Guardian management
- Session history
- Notes
- Current account tracking

### 👨‍🏫 Teacher Management

- Teacher profiles
- Earnings calculation
- Custom pricing
- Payroll management

### 📅 Session Management

- Weekly planning
- Calendar view
- Conflict detection
- Attendance tracking

### 💰 Financial Management

- Student payments
- Installments
- Teacher payments
- Daily cash flow
- Current account system

### 📊 Reporting

- Financial reports
- Session reports
- Teacher reports
- Student reports

### 📥 Data Import

- Excel Import Wizard
- Validation
- Preview
- Data mapping

### 🔐 Access

- One shared institution account with full access
- Several people can be signed in at once, on different devices
- Login lockout after repeated wrong passwords; a password change signs out every other device

---

## 🛠 Tech Stack

| Category | Technologies |
|----------|--------------|
| Frontend | Next.js (App Router), React, TypeScript |
| Styling | Tailwind CSS, shadcn/ui (Base UI) |
| State Management | React Context + localStorage (mock store) |
| Charts | Recharts |
| Excel | SheetJS (xlsx) |
| Icons | Lucide React |
| Testing | Vitest |

---

## 📁 Project Structure

```text
src/
 ├── app/            # Routes: (auth) login pages, (app)/app/* application pages
 ├── components/     # Feature components (students, sessions, payments…) and ui/ primitives
 ├── hooks/          # Shared React hooks
 ├── lib/
 │   ├── auth/       # Single-account auth service and password rules
 │   ├── helpers/    # Business logic (finance, installments, conflicts, import…)
 │   ├── mock/       # Seed data and the localStorage-backed store
 │   └── settings/   # Institution settings defaults and validation
 └── types/          # Shared TypeScript types
```

> **Note:** There is no backend yet. All data, including the account and its
> password, lives in the browser's localStorage, so devices do not share data
> yet and this build is for demos only — it must not be used with real student
> data.

---

## 🚀 Getting Started

Clone the repository

```bash
git clone https://github.com/OmerP14/special-education-management-system.git
```

Install dependencies

```bash
npm install
```

Run the development server

```bash
npm run dev
```

Open

```text
http://localhost:3000
```

### Demo account

Username `admin`, password `1`.

Settings → Excel ve Veri Yönetimi → "Demo Verilerine Sıfırla" resets all institution data back to the demo data (the login is kept).

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |

---

## 🎯 Project Goals

- Replace Excel-based workflows
- Simplify daily operations
- Improve financial tracking
- Reduce manual work
- Provide a scalable SaaS solution

---

## 🗺️ Roadmap

- [x] Student Management
- [x] Teacher Management
- [x] Session Management
- [x] Financial Module
- [x] Reporting
- [x] Calendar
- [x] Excel Import
- [x] Single shared account (client-side mock)
- [ ] Backend and database — shared data and live sync across devices
- [ ] Multi-tenant Architecture
- [ ] Production Deployment

---

## 📸 Screenshots

Screenshots will be added soon.

---

## 📄 License

This project is currently under active development.
