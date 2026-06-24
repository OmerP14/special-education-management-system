---
name: project-ozel-egitim
description: Core facts about the ÖzelEğitim SaaS frontend — stack, architecture, current state, and next steps
metadata:
  type: project
---

Multi-tenant SaaS management system for special education centers in Turkey. Frontend only — no backend/Supabase yet; everything uses mock data.

**Why:** Replace Excel-based workflows used by özel eğitim (special education) centers. Designed to be a sellable SaaS product from day one, not a single-center custom app.

**How to apply:** When adding new modules, follow the existing patterns — client component pages, mock data in `src/lib/mock/`, helpers in `src/lib/helpers/`, types in `src/types/index.ts`.

## Stack
- Next.js 16 (App Router), TypeScript, Tailwind CSS
- shadcn/ui **using `@base-ui/react`** (NOT Radix UI) — no `asChild` prop; use `render` prop instead for custom rendering; all interactive components need `"use client"`
- Lucide icons

## Current state (Students module complete, Haziran 2026)
All routes built and building cleanly. Pages are client components (`"use client"`).

Dynamic `[id]` routes: use a thin **server component** page that extracts async params and passes only serializable values (strings) to a `"use client"` view component. Add `generateStaticParams` to pre-build all detail pages from mock data.

Routes: `/login`, `/app/dashboard`, `/app/students`, `/app/students/[id]`, `/app/teachers`, `/app/sessions`, `/app/payments`, `/app/teacher-earnings`, `/app/reports`, `/app/settings`, `/app/guardians`

## Folder structure
```
src/
  types/index.ts           — all entity types (incl. StudentListItem, StudentDetail)
  lib/
    mock/                  — mock data files (index.ts re-exports all)
    helpers/finance.ts     — all calculation helpers; pure functions; no direct mock imports except buildDashboardStats
    nav.ts                 — sidebar nav items
  components/
    layout/                — AppSidebar, AppTopbar, PageHeader
    shared/                — StatCard, StatusBadge, DataTable, EmptyState, FormDrawer, Tabs
    dashboard/             — RecentSessionsTable, PaymentSummaryCard, TeacherEarningsCard, SessionStatusBreakdown
    students/              — StudentFormDrawer, StudentDetailView
  app/
    (auth)/login/          — login page
    (app)/layout.tsx       — sidebar + topbar shell (mobile sheet for sidebar)
    (app)/app/students/    — list page (search + status filter + full columns)
    (app)/app/students/[id]/ — server wrapper → StudentDetailView
    (app)/app/[module]/    — other module pages
```

## Key design decisions
- Session statuses: `planned | completed | cancelled | no_show | makeup`
- Billable statuses (charge student): `completed | no_show | makeup`
- Earning statuses (pay teacher): `completed | makeup`
- Every entity has `tenantId` for future SaaS isolation
- Turkish UI labels throughout
- `buildStudentListItems` and `buildStudentDetail` in finance.ts are pure functions — take all data as args, no mock imports inside

## shadcn/ui gotcha
This project uses the new shadcn that wraps `@base-ui/react`. Avatar, Sheet, DropdownMenu, etc. all use base-ui primitives. `asChild` does not exist — use the `render` prop pattern. All components that use shadcn components must have `"use client"`. FormDrawer wraps Sheet with `onOpenChange={(isOpen: boolean) => fn(isOpen)}` to handle base-ui's extra callback args.

## Key design decisions
- Session statuses: `planned | completed | cancelled | no_show | makeup`
- Billable statuses (charge student): `completed | no_show | makeup`
- Earning statuses (pay teacher): `completed | makeup`
- Every entity has `tenantId` for future SaaS isolation
- Turkish UI labels throughout

## shadcn/ui gotcha
This project uses the new shadcn that wraps `@base-ui/react`. Avatar, Sheet, DropdownMenu, etc. all use base-ui primitives. `asChild` does not exist — use the `render` prop pattern. All components that use shadcn components must have `"use client"`.
