---
name: project-overview
description: Architecture, tech stack, and data model for the Özel Eğitim SaaS management platform
metadata:
  type: project
---

Turkish special-education center management SaaS. Next.js 16.2.9 (Turbopack), TypeScript, Tailwind CSS, shadcn/ui.

**Why:** Building a multi-tenant SaaS to manage students, teachers, sessions, payments, and earnings for special-ed centers.

**How to apply:** All pages are under `src/app/(app)/app/`. All mock data is in `src/lib/mock/`. All business logic lives in `src/lib/helpers/finance.ts` (relation resolvers, list/detail builders, report builders) and `src/lib/helpers/import.ts`. No Supabase yet — mock data only.

Core entities: Tenant → Students → Veliler (Guardians), Teachers, EducationTypes; Sessions (Student+Teacher+EducationType); Payments (Student+Veli); TeacherEarnings (Teacher+Session).

Key types file: `src/types/index.ts`. All UI models (ListItem, Detail, ReportRow) live there too.
