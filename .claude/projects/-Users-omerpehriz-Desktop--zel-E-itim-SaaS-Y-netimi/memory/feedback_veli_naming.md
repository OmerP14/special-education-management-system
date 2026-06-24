---
name: feedback-veli-naming
description: Always use "Veli" for guardian/parent in all visible UI — never Guardian, Parent, or Ebeveyn
metadata:
  type: feedback
---

Always use "Veli" in every visible UI label, column header, button, form field, and empty state. Never use "Guardian", "Parent", "Ebeveyn", or any mixed label.

**Why:** User explicitly requires consistent Turkish branding for the guardian entity throughout the SaaS UI.

**How to apply:** Internal code identifiers (guardianId, guardianName, mockGuardians, GuardianDetail) can keep their English names — only the *visible* UI text must say "Veli". Applies to: page titles, table headers, form labels, breadcrumbs, stat card titles, tab labels, empty state messages, import type descriptions.
