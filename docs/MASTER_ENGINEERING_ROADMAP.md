# Agency Operating System (AOS) — Master Engineering Roadmap

**Document purpose:** Single execution plan from current state → MVP → advanced platform.  
**Last updated:** 2026-05-11  
**Product:** Multi-tenant AI agency intelligence hub (Next.js 15 + Supabase + integrations).

---

## How to use this document

1. **Work top-to-bottom within each phase** unless dependencies say otherwise.  
2. **Check off** items in Git/Linear/Jira; keep this file in sync monthly.  
3. **Do not use `user_metadata` for authorization** (Supabase security); store roles in Postgres (`profiles`, `agency_members`, `client_portal_access`) and optionally `app_metadata` via Admin API for coarse flags only.  
4. **Treat RLS as mandatory** for every new table in `public`.

---

## Legend

### Status

| Tag | Meaning |
|-----|---------|
| `[x]` | Completed (shipped in repo / DB as described) |
| `[~]` | In progress (actively being built; partial) |
| `[ ]` | Pending |

### Priority

| Label | Meaning |
|-------|---------|
| **P0** | Blocker for MVP or security/compliance |
| **P1** | Core product value for first paying users |
| **P2** | Differentiator / retention |
| **P3** | Advanced / scale / nice-to-have |

### Dependency notation

- **Depends on:** upstream tasks that must exist first.  
- **Unlocks:** downstream tasks this enables.

---

## Milestones (recommended)

| ID | Milestone | Target outcome |
|----|-----------|----------------|
| M0 | **Foundation** | Auth, tenant model, RLS, shell UI, CI, staging deploy |
| M1 | **Operational truth** | Real dashboard metrics from DB + 1 CRM sync (read-only) |
| M2 | **Content + intel** | Social metrics ingestion + Apify competitor pipeline |
| M3 | **Workflow + comms** | Tasks, content board, notifications, reports export |
| M4 | **AI depth** | Onboarding-driven context, agents, call analysis, sales trainer |
| M5 | **Scale + enterprise** | Jobs, observability, hardening, performance, compliance |

---

## Global status dashboard

### Completed `[x]`

> Aligned with current repo + your confirmation: `.env.local` configured, migrations applied, UI works with mock/dummy data.

- [x] **P0** Next.js 15 App Router project with TypeScript, Tailwind v4, Turbopack scripts  
- [x] **P0** shadcn/ui component baseline (buttons, cards, forms, tabs, sheet, dropdown, tooltip, etc.)  
- [x] **P0** Supabase client utilities: browser client, server client (`@supabase/ssr`), cookie handling  
- [x] **P0** Middleware: session refresh pattern + route protection for `/dashboard/*`  
- [x] **P0** Auth routes: `/login`, `/signup`, `/auth/callback`, email + Google OAuth hooks (server actions)  
- [x] **P0** Root routing: `/` → session-aware redirect  
- [x] **P0** Dashboard shell: sidebar navigation, responsive sheet, header, user menu, sign-out  
- [x] **P0** Dashboard home UI: KPI cards, charts (Recharts), activity feed (**mock data**)  
- [x] **P0** CRM visualization page: tabs + Kanban-style board (**mock data**, not drag-and-drop)  
- [x] **P0** Integrations registry page (static provider metadata)  
- [x] **P0** Module placeholder pages for all major nav targets (stubs)  
- [x] **P0** Initial Postgres schema + enums + indexes (see **Appendix A — Existing tables**)  
- [x] **P0** RLS enabled on listed tables + policies for agency scoping + `profiles.is_super_admin` path  
- [x] **P0** Triggers: `auth.users` → `profiles`; `agencies` insert → `agency_members` owner row  
- [x] **P0** Agency creation flow (server action + form) writing real `agencies` rows  
- [x] **P0** Environment validation pattern (`src/lib/env.ts`) + `.env.example`  
- [x] **P0** Integration type contracts + provider registry (`src/lib/integrations/*`)  
- [x] **P0** Error boundary for dashboard route segment  
- [x] **P0** Production build passing (`next build`)

### In progress `[~]`

> Use this section during active sprints. Empty = no formal WIP tracked in-repo.

- [~] *(none documented in repository — add rows here when you start a thread of work)*  

### Pending `[ ]` (summary)

Everything after “Foundation” in this document: real data plumbing, Super Admin, RBAC matrix, client portal, CRM/GHL/n8n/Apify, AI pipelines, jobs, email, monitoring, test strategy, etc. **Detailed tasks follow by phase below.**

---

## Dependency overview (high level)

```text
Auth + profiles + agencies (done)
        │
        ├─► Agency context in UI (active agency, switcher) ──► All domain pages
        │
        ├─► RBAC (roles + permissions) ──► UI gating + RLS refinement + audit logs
        │
        ├─► Integrations table + vault secrets ──► CRM/Social/Apify/n8n sync
        │
        ├─► Webhooks + event log ──► Real-time + notifications + automations visibility
        │
        ├─► Background jobs ──► Heavy AI, scraping, report generation, email sends
        │
        └─► Observability + E2E + load testing ──► Production readiness
```

---

## Recommended folder structure (target architecture)

> Current repo is close; evolve toward clear boundaries. Adjust names to taste; keep **server-only secrets** out of `src/` imports used by client components.

```text
src/
  app/                          # Next.js routes (RSC + route handlers)
    (auth)/                     # Auth layouts/pages
    (dashboard)/                # Authenticated shell
      dashboard/              # /dashboard/* feature routes
    api/                        # Route handlers (webhooks, cron, signed callbacks)
      webhooks/
      integrations/
      cron/
  components/
    ui/                         # shadcn primitives
    layout/                     # shell, nav, headers
    dashboard/
    crm/
    content/
    onboarding/
    ...
  lib/
    supabase/                   # clients, types
    auth/                       # helpers: requireUser, requireAgencyRole
    rbac/                       # permission matrix, server checks
    integrations/
      gohighlevel/
      apify/
      n8n/
      youtube/
      ...
    jobs/                       # job enqueue helpers (if using Q or Edge)
    analytics/                  # query builders, metric definitions
    email/                      # Resend/SendGrid/etc. server-only
    ai/                         # OpenAI wrappers, prompts, guardrails
  server/
    actions/                    # complex server actions (optional grouping)
    queries/                    # reusable server-side data accessors
supabase/
  migrations/
  functions/                    # Edge functions (optional)
  seed.sql                      # dev fixtures (optional)
tests/
  e2e/
  integration/
  unit/
docs/
  MASTER_ENGINEERING_ROADMAP.md # this file
  adr/                          # architecture decision records (recommended)
```

---

## Phase 0 — Engineering hygiene (parallel track, never “done”)

**Goal:** Safe velocity: quality gates, secrets, branching, environments.

| Status | Priority | Task | Notes / acceptance |
|--------|----------|------|---------------------|
| [ ] | P0 | Add CI workflow (GitHub Actions): `lint`, `typecheck`, `build` | Block merge on red |
| [ ] | P0 | Add formatting gate (`prettier`) or Biome (pick one team-wide) | |
| [ ] | P0 | Branch protection + required reviews | |
| [ ] | P0 | **Secret scanning** (GitHub push protection) | |
| [ ] | P0 | Document env matrix: `local`, `preview`, `production` | Vercel + Supabase |
| [ ] | P1 | Preview deployments per PR with **non-production** Supabase project | Optional second project |
| [ ] | P1 | Semantic versioning / changelog policy | Keep user-visible changes traceable |
| [ ] | P2 | ADR folder for major decisions (RLS model, job runner, email provider) | `docs/adr/` |

---

## Phase 1 — Tenant context, RBAC, and “real dashboard” (M0 → M1)

**Depends on:** completed foundation (auth, agencies, RLS baseline).  
**Unlocks:** all product modules with correct data isolation.

### 1.1 Agency context & settings

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | **Active agency** resolution: cookie or user preference table `user_preferences` | agencies, members |
| [ ] | P0 | Agency switcher UI in header; persist selection | ↑ |
| [ ] | P1 | Agency settings page: name, slug (immutable or careful migration), timezone, currency | settings UI |
| [ ] | P1 | **Branding** fields: logo URL (Supabase Storage), accent color (optional) | Storage bucket + policies |
| [ ] | P2 | Per-agency feature flags row `agency_features` | admin UI later |

**Suggested tables (additive migrations):**

- `user_preferences` (`user_id`, `active_agency_id`, `updated_at`) — RLS: user owns row.  
- `agency_settings` (`agency_id` PK, `timezone`, `currency`, `display_name`, `logo_path`, …) — RLS: agency staff.

### 1.2 RBAC: roles & permissions matrix

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | Define canonical roles: `super_admin`, `agency_owner`, `agency_admin`, `team_member`, `client_viewer`, `client_admin` | Map to existing `agency_member_role` + portal roles |
| [ ] | P0 | **Server-side** helpers: `requireSession()`, `requireAgencyRole()`, `requireClientAccess()` | `lib/auth/*` |
| [ ] | P0 | **UI gating**: hide nav items by permission | shared `can(permission)` |
| [ ] | P0 | RLS review: ensure **UPDATE** paths include required **SELECT** policies (Postgres RLS pitfall) | Supabase advisors |
| [ ] | P1 | Optional: `permissions` + `role_permissions` tables for fine-grained toggles | avoids code deploy for small toggles |
| [ ] | P2 | **Impersonation** for super admin (audited) | high risk; defer |

### 1.3 Super Admin system

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | Operational procedure: set `profiles.is_super_admin` only via Supabase SQL/service role | document in runbook |
| [ ] | P1 | `/dashboard/super-admin` route group (gated by `is_super_admin`) | helper |
| [ ] | P1 | Agency directory: search, suspend, plan tier (future), support notes | `agencies` columns |
| [ ] | P1 | User support tools: lookup by email, force password reset link (via Admin API) | service role Edge Function |
| [ ] | P2 | Abuse review queue | reports from users |

**Suggested tables:**

- `support_notes` (`agency_id`, `author_id`, `body`, `created_at`) — RLS: super admin only.  
- `agency_subscription` (later) — Stripe/etc.

### 1.4 Dashboard: replace mocks with real metrics

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | Metric definitions doc: what is MRR, pipeline value, etc. (per your business) | product |
| [ ] | P0 | SQL views or materialized views for heavy aggregates (optional) | performance |
| [ ] | P1 | Wire KPI cards to **Supabase queries** scoped by `active_agency_id` | agency context |
| [ ] | P1 | Charts: time-series from `sales_calls`, `leads`, `content_analytics`, etc. | data ingestion |
| [ ] | P1 | Activity feed backed by `notifications` + `integration_sync_runs` (see Phase 3) | events |
| [ ] | P2 | Cohort / pacing widgets | analytics |

---

## Phase 2 — CRM integration layer + GoHighLevel (M1)

**Goal:** Read-only truth first, then selective writes.

### 2.1 Integration credentials & health

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | **Never store OAuth tokens in client**; use server-only env + DB encrypted payload pattern | architecture |
| [ ] | P0 | `integrations` row lifecycle: connect → validate → sync → error state | UI |
| [ ] | P0 | Secure token storage: Supabase Vault / encrypted column + KMS strategy | decide approach |
| [ ] | P1 | Token refresh scheduler (n8n or Edge Function cron) | jobs |

**Suggested tables:**

- `integration_credentials` (`integration_id`, `ciphertext`, `version`, `rotated_at`) — **no RLS to anon**; only Edge/service role.  
- `integration_sync_runs` (`id`, `integration_id`, `started_at`, `finished_at`, `status`, `stats`, `error`) — RLS: agency staff read.

### 2.2 Webhook ingestion architecture

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | Route handler: `POST /api/webhooks/gohighlevel` (verify signature / IP allowlist) | secrets |
| [ ] | P0 | **Idempotency** table `webhook_events` (`provider`, `event_id` unique, payload, processed_at`) | |
| [ ] | P0 | Normalizer: GHL payload → `pipelines`, `leads`, stage mapping | mapping tables |
| [ ] | P1 | Dead-letter handling + admin replay tool | super admin |
| [ ] | P2 | Rate limit + request logging | observability |

**Suggested tables:**

- `webhook_endpoints` (`agency_id`, `provider`, `secret`, `url_slug`) — if multi-endpoint per agency.  
- `crm_stage_map` (`agency_id`, `external_stage_id`, `internal_stage` enum) — RLS: agency staff.

### 2.3 GoHighLevel API (REST)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | Read docs + define **scope** (contacts, opportunities, pipelines, calendars) | product |
| [ ] | P0 | Implement `lib/integrations/gohighlevel/client.ts` with retries, backoff, typed errors | |
| [ ] | P0 | Initial **full sync** job: pipelines → `pipelines`, opportunities → `leads` | mapping |
| [ ] | P1 | Incremental sync using `updatedAt` / polling strategy | jobs |
| [ ] | P1 | CRM UI: Kanban columns = mapped stages; cards = `leads` | queries |
| [ ] | P1 | Lead detail drawer: fields, notes (add `lead_notes` table), activity timeline | |
| [ ] | P2 | **Write-backs** (create task in GHL) behind explicit permission | audit |

**Suggested tables:**

- `lead_notes` (`lead_id`, `author_id`, `body`, `created_at`) — RLS via pipeline/agency.  
- `lead_activities` (`lead_id`, `kind`, `payload`, `occurred_at`) — optional if not stored in GHL only.

### 2.4 CRM UX hardening

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P1 | Drag-and-drop Kanban (dnd-kit) + optimistic updates + rollback | writes |
| [ ] | P1 | Virtualization for large pipelines | performance |
| [ ] | P2 | Inline edits, bulk assign | permissions |

---

## Phase 3 — n8n automation integration + automation center UI (M1–M2)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | n8n **incoming webhooks** for AOS events (optional) vs AOS polling n8n API | choose pattern |
| [ ] | P0 | Store `automations` linkage: `external_id`, `webhook_url`, `status` | integrations |
| [ ] | P1 | `POST /api/webhooks/n8n` secured by secret header | |
| [ ] | P1 | Automation Center UI: list automations, last run, error count from `integration_sync_runs` | data |
| [ ] | P2 | “Test trigger” button (server action) | guardrails |
| [ ] | P3 | Make.com parity | same patterns |

**Suggested API routes:**

- `POST /api/webhooks/n8n`  
- `POST /api/cron/automations-reconcile` (Vercel cron + secret)

---

## Phase 4 — Client portal (M1–M2)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | Route group `/portal` or `/dashboard/client` with separate layout | branding |
| [ ] | P0 | Invite flow: agency admin adds `client_portal_access` + sends magic link / invite email | email |
| [ ] | P0 | Client-safe metrics pages (RLS already partially scoped) | queries |
| [ ] | P1 | Client-visible reports + onboarding progress | onboarding data |
| [ ] | P2 | Client commenting / approvals | new tables |

**Suggested tables:**

- `client_invites` (`email`, `client_id`, `token_hash`, `expires_at`, `accepted_at`) — RLS: agency admin.

---

## Phase 5 — Content intelligence (YouTube / IG / TikTok) (M2)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | OAuth/token strategy per platform (store in `integrations`) | security |
| [ ] | P0 | Normalized metric model (already started in `content_analytics`) — finalize grain (daily) | migrations |
| [ ] | P1 | YouTube: channel stats + video list + time series | workers |
| [ ] | P1 | Instagram Graph: insights where available | workers |
| [ ] | P1 | TikTok: available endpoints per TikTok product access | compliance |
| [ ] | P1 | `/dashboard/content` charts: followers, reach, engagement, views, watch time, CTR | UI |
| [ ] | P2 | “Top performers” ranking + annotations | AI later |

**Suggested API routes:**

- `GET /api/integrations/youtube/oauth/start`  
- `GET /api/integrations/youtube/oauth/callback`  
- `POST /api/cron/sync-content-analytics`

---

## Phase 6 — Apify competitor scraping (M2)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | Apify actor selection (YouTube/IG/TikTok channel scrapers) + cost model | product |
| [ ] | P0 | Server-only Apify token | secrets |
| [ ] | P0 | Job: run actor → store raw JSON in `competitor_data.snapshot` + parse summary fields | jobs |
| [ ] | P1 | `/dashboard/competitors` UI: competitor list, last scrape, diff vs previous | |
| [ ] | P1 | Dedupe + schedule (weekly) per competitor | cron |
| [ ] | P2 | Thumbnail/hook extraction helpers | AI |

**Suggested tables:**

- `competitor_targets` (`agency_id`, `client_id`, `platform`, `handle`, `actor_id`, `schedule_cron`) — separates config from snapshots.  
- Optional: `scraped_media_items` child table if snapshots too large.

**Suggested API routes:**

- `POST /api/competitors/scrape` (agency role)  
- `POST /api/cron/competitors` (cron secret)

---

## Phase 7 — Onboarding system + brand context (M2–M4)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | Define onboarding “programs” per agency template | product |
| [ ] | P0 | Form builder stored in `onboarding_forms.schema` (validated JSON Schema) | |
| [ ] | P0 | Client-facing onboarding wizard + save to `responses` | RLS |
| [ ] | P1 | Supabase Storage buckets: `brand-assets`, `onboarding-uploads` + RLS | storage policies |
| [ ] | P1 | Whisper transcription pipeline for voice answers | Edge function + queue |
| [ ] | P1 | Derive structured `brand_profiles` fields from responses (manual review + AI assist) | AI |
| [ ] | P2 | Versioning: `onboarding_versions` | audits |

**Suggested Edge functions / routes:**

- `POST /api/onboarding/submit`  
- `POST /api/media/transcribe` (upload → storage → job)

---

## Phase 8 — Content workflow board (Trello-like) (M3)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | Canonical stages enum aligned to product (idea → posted) | migration |
| [ ] | P0 | Extend `content_items` with assignees, due dates, priority, channel | migration |
| [ ] | P1 | Board UI with drag-and-drop + optimistic updates | dnd-kit |
| [ ] | P1 | Comments thread (`content_comments`) + mentions + notifications | |
| [ ] | P1 | Attachments via Storage | policies |
| [ ] | P2 | Calendar view + scheduling integration | |

**Suggested tables:**

- `content_comments` (`content_item_id`, `author_id`, `body`, `created_at`)  
- `content_item_assignees` (many-to-many)  
- `content_item_activity` (audit-style)

---

## Phase 9 — Task management (M3)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P1 | `/dashboard/tasks` list + filters + assignee | tasks table |
| [ ] | P1 | Task statuses + priority + due | migration |
| [ ] | P2 | Recurring tasks | jobs |
| [ ] | P2 | Subtasks | `task_subtasks` |

---

## Phase 10 — Sales analytics + calls + setter system (M3–M4)

### 10.1 Sales analytics

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P1 | Define metrics: show rate, close rate, pipeline velocity | queries |
| [ ] | P1 | `/dashboard/sales` charts fed by `sales_calls`, `leads`, CRM mapping | |
| [ ] | P2 | Leaderboards + goal tracking | new tables |

### 10.2 Call analysis AI

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | Storage bucket `call-recordings` + signed upload URLs | security |
| [ ] | P0 | Transcription job (Whisper) + store transcript text | worker |
| [ ] | P1 | LLM pipeline: summary, objections, sentiment, coaching, scores → `call_analysis` | prompts |
| [ ] | P1 | UI: call list, detail, scoring breakdown, share to rep | RBAC |
| [ ] | P2 | Compare calls across team | analytics |

### 10.3 Setter inbox (Mochi-style)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P1 | Data model: `conversations`, `messages`, `conversation_participants` | migrations |
| [ ] | P1 | Inbox UI + assignment + tags | |
| [ ] | P2 | IG DM / Discord adapters | integrations |
| [ ] | P2 | AI reply assist with guardrails + audit | AI |

---

## Phase 11 — AI agents (M4)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | **Prompt safety**: allowlists, PII redaction, rate limits, cost caps | |
| [ ] | P0 | Traceability: store prompts/outputs in `ai_outputs` with hashes + model version | |
| [ ] | P1 | Agent framework: tool calls for “fetch competitor snapshot”, “fetch onboarding” | RLS-aware tools |
| [ ] | P1 | `/dashboard/ai-agents` flows: ideation, hooks, packaging suggestions | |
| [ ] | P2 | Retrieval + embeddings (pgvector) for long-lived memory | Supabase vector |
| [ ] | P3 | Autonomous multi-step runs with human approvals | workflow engine |

---

## Phase 12 — AI sales trainer (M4)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P2 | Scenario generator + rubric scoring | AI |
| [ ] | P2 | Voice practice (WebRTC) optional | complex |
| [ ] | P3 | Real-time coach mode | latency |

---

## Phase 13 — Reporting + email snapshots (M3–M4)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P1 | Report templates (weekly/monthly) stored as JSON definitions | `reports` |
| [ ] | P1 | PDF export (server-side) | worker |
| [ ] | P1 | Email provider integration (Resend/SendGrid) server-only | secrets |
| [ ] | P1 | `POST /api/cron/send-client-snapshots` + per-client preferences | |
| [ ] | P2 | Client segmentation for different snapshot templates | |

**Suggested tables:**

- `client_email_preferences` (`client_id`, `frequency`, `timezone`, `enabled`)  
- `email_send_log` (`id`, `to`, `template`, `status`, `provider_id`)

---

## Phase 14 — Notification system + realtime (M3)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P1 | Notification creation helpers (server) for tasks, mentions, sync failures | |
| [ ] | P1 | UI bell + unread counts | |
| [ ] | P1 | Supabase Realtime channel subscriptions scoped per user | RLS + private topics |
| [ ] | P2 | Push notifications (web push) optional | service worker |
| [ ] | P2 | Mobile later | future |

---

## Phase 15 — Security, compliance, and RLS hardening (continuous)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | Annual **RLS policy review** + Supabase advisors in CI | |
| [ ] | P0 | Ensure **views** use `security_invoker` where applicable (Postgres 15+) | |
| [ ] | P0 | Storage policies audited (per bucket) | |
| [ ] | P0 | CSP headers + security headers in `next.config` | |
| [ ] | P1 | Audit logs table `audit_logs` (who did what, impersonation, integration changes) | super admin |
| [ ] | P1 | GDPR export/delete workflow | legal |
| [ ] | P2 | SOC2-oriented controls checklist | enterprise |

---

## Phase 16 — Background jobs, queues, scheduling (M5)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | Choose job runner: **Supabase Edge Functions + pg_cron**, or **Queue external** (Inngest/Trigger.dev), or **n8n** as orchestrator | ADR |
| [ ] | P0 | Standard job envelope: `job_type`, `payload`, `attempts`, `idempotency_key` | table |
| [ ] | P1 | Dashboard for failed jobs + replay | super admin |
| [ ] | P2 | Concurrency controls + rate limits per integration | |

**Suggested tables:**

- `jobs` / `job_runs` (depends on runner choice)

---

## Phase 17 — Deployment pipeline + environments (M0–M5)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | Vercel project wired to repo; environment variables set per env | |
| [ ] | P0 | Supabase branching strategy (optional) | |
| [ ] | P0 | Database migration discipline: only forward migrations in CI | |
| [ ] | P1 | Seed script for demo agency (dev only) | |
| [ ] | P2 | Blue/green or staged rollout playbook | |

---

## Phase 18 — Monitoring, logging, observability (M5)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P1 | Structured logs from route handlers (request id, agency id) | |
| [ ] | P1 | Error tracking (Sentry) for frontend + server | |
| [ ] | P2 | Metrics: integration sync durations, AI costs | |
| [ ] | P2 | Uptime checks for webhooks + cron | |

---

## Phase 19 — Performance optimization (continuous)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P1 | Add DB indexes for common filters (agency_id + created_at) | explain analyze |
| [ ] | P1 | Pagination everywhere lists > 50 rows | |
| [ ] | P2 | Materialized views for dashboards | refresh strategy |
| [ ] | P2 | Image optimization + lazy charts | UX |

---

## Phase 20 — Testing strategy (continuous)

| Status | Priority | Task | Dependencies |
|--------|----------|------|----------------|
| [ ] | P0 | Define test pyramid policy in repo | |
| [ ] | P1 | Unit tests for integration mappers (GHL → internal) | |
| [ ] | P1 | Integration tests for RLS using Supabase test project | |
| [ ] | P2 | Playwright E2E: login, agency create, CRM board loads | staging |

---

## Appendix A — Existing database tables (from initial migration)

> Use this as the canonical “already exists” list when adding migrations.

- `profiles`  
- `agencies`  
- `agency_members`  
- `clients`  
- `client_portal_access`  
- `onboarding_forms`  
- `brand_profiles`  
- `pipelines`  
- `leads`  
- `content_items`  
- `content_analytics`  
- `tasks`  
- `sales_calls`  
- `call_analysis`  
- `ai_outputs`  
- `reports`  
- `notifications`  
- `integrations`  
- `automations`  
- `competitor_data`  
- `team_metrics`  

**Enums:** `agency_member_role`, `client_portal_role`, `lead_stage`

---

## Appendix B — Suggested new tables (summary checklist)

> Not all are required for MVP; pick based on milestone pressure.

- [ ] `user_preferences` (active agency, UI prefs) — **P0**  
- [ ] `agency_settings` — **P1**  
- [ ] `integration_credentials` (encrypted) — **P0**  
- [ ] `integration_sync_runs` — **P0**  
- [ ] `webhook_events` (idempotency) — **P0**  
- [ ] `crm_stage_map` — **P0**  
- [ ] `lead_notes`, `lead_activities` — **P1**  
- [ ] `client_invites` — **P1**  
- [ ] `competitor_targets` — **P1**  
- [ ] `content_comments`, `content_item_assignees`, `content_item_activity` — **P1**  
- [ ] `conversations`, `messages`, `conversation_participants` — **P2**  
- [ ] `audit_logs` — **P1**  
- [ ] `client_email_preferences`, `email_send_log` — **P1**  
- [ ] `jobs` / `job_runs` (if not externalized) — **P1**  
- [ ] `agency_features` / `feature_flags` — **P3**  

---

## Appendix C — Suggested API routes (Route Handlers)

> Prefix with `/api` in `src/app/api/.../route.ts`. Protect with secrets, session, or signed tokens as appropriate.

**Webhooks (public-ish, verified):**

- [ ] `POST /api/webhooks/gohighlevel`  
- [ ] `POST /api/webhooks/n8n`  
- [ ] `POST /api/webhooks/stripe` (future billing)  

**OAuth callbacks:**

- [ ] `GET /api/integrations/[provider]/callback` (if not using Supabase Auth OAuth exclusively)

**Cron / maintenance (secret header):**

- [ ] `POST /api/cron/sync-crm`  
- [ ] `POST /api/cron/sync-content`  
- [ ] `POST /api/cron/scrape-competitors`  
- [ ] `POST /api/cron/reports`  
- [ ] `POST /api/cron/email-snapshots`  

**Internal ops:**

- [ ] `POST /api/admin/replay-webhook` (super admin only)  

---

## Appendix D — Priority backlog ordering (recommended execution queue)

> First 30-ish tasks in strict order (adjust if product priorities shift):

1. [ ] **P0** CI: lint + typecheck + build  
2. [ ] **P0** `requireSession` / `requireAgencyMember` helpers + route audit  
3. [ ] **P0** Active agency context + switcher + persistence  
4. [ ] **P0** Replace dashboard mocks with queries (even if sparse)  
5. [ ] **P0** `integration_credentials` + secure GHL connect flow (server-only)  
6. [ ] **P0** `webhook_events` + verified GHL webhook route  
7. [ ] **P0** Normalizer: GHL → `pipelines`/`leads` + `crm_stage_map`  
8. [ ] **P0** CRM UI reads from DB + loading/error states  
9. [ ] **P1** Incremental CRM sync job + `integration_sync_runs`  
10. [ ] **P1** Activity feed wired to sync + notifications inserts  
11. [ ] **P1** n8n webhook + Automation Center truthy data  
12. [ ] **P1** Client portal MVP (access + read-only dashboards)  
13. [ ] **P1** Email provider + invite flow  
14. [ ] **P1** Content analytics ingestion (start with YouTube)  
15. [ ] **P2** Apify competitor targets + scheduled scrapes  
16. [ ] **P1** Onboarding wizard MVP + storage uploads  
17. [ ] **P2** Whisper transcription jobs  
18. [ ] **P1** Tasks module CRUD  
19. [ ] **P1** Content workflow board MVP  
20. [ ] **P2** Drag/drop polish + optimistic updates everywhere  
21. [ ] **P1** Sales analytics queries + charts  
22. [ ] **P2** Call uploads + transcription + call analysis AI  
23. [ ] **P2** AI agents MVP with tool restrictions + audit  
24. [ ] **P2** Reports PDF + scheduled emails  
25. [ ] **P2** Realtime notifications  
26. [ ] **P2** Setter inbox MVP (internal only)  
27. [ ] **P3** Sales trainer scenarios  
28. [ ] **P1** Audit logs + super admin tools  
29. [ ] **P2** Observability (Sentry + structured logs)  
30. [ ] **P2** Performance passes (indexes + pagination + materialized views)

---

## Appendix E — “Definition of Done” for production readiness (checklist)

**Security**

- [ ] RLS on all public tables + advisor clean  
- [ ] No service role keys in client bundles  
- [ ] Webhooks verified + idempotent  
- [ ] Storage policies reviewed  
- [ ] Secrets rotated + documented  

**Reliability**

- [ ] Cron jobs monitored + alerting  
- [ ] Retries with backoff for external APIs  
- [ ] DLQ / replay path for failed webhooks  

**Quality**

- [ ] E2E smoke on staging  
- [ ] Load test on hottest endpoints (webhooks, dashboards)  

**Operations**

- [ ] Runbooks: onboarding new agency, rotating keys, handling abuse  
- [ ] Backup/restore tested (Supabase PITR / backups per plan)  

---

**End of master roadmap.**  
Maintain this file as the single source of truth for macro sequencing; track micro-tasks in your issue tracker with links back to section IDs (e.g., `P2-CRM-014`).
