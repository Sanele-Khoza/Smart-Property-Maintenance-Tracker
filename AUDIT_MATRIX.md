# SPMT Role-Action Audit Matrix

Ground truth: **SRS v2.0 (Group 20, IEEE 830-1998)** — REQ-001..REQ-056, BR-001..BR-010, UC-001..UC-004.
**SDD v2.1** — module cards MOD-001..MOD-010.
Roles: TENANT (T), PROPERTY_MANAGER (PM), SERVICE_PROVIDER (SP), SYSTEM_ADMIN (SA).

Status: all columns populated from a code-level walk (routes/controllers + frontend pages/stores),
plus prior audits (concurrency, validation, config/secrets) and a frontend wiring pass (below).
"E2E" = confirmed wired route→handler; flagged rows are live defects, not just cosmetic gaps.

| Action | Page/Component | Role(s) allowed (per SDD/SRS) | Frontend handler exists? | Calls real API? | Backend route + method | Backend enforces role? | Verified working end-to-end? |
|---|---|---|---|---|---|---|---|
| **Tickets** | | | | | | | |
| Create ticket | `tenant/*` New Ticket (`components/Ticket.jsx` → ticketsStore.create) | T (REQ-013, BR-001, UC-001; MOD-003 "used exclusively by Tenants") | Yes | Yes — `POST /tickets` | `POST /api/tickets` | authorize T, PM, SA — **PM & SA also allowed (broader than spec)** | Yes |
| View own tickets | `tenant/Tickets.jsx` | T (MOD-003 GET own; NFR-SEC04 no cross-tenant) | Yes | Yes — `GET /tickets` | `GET /api/tickets` | Route allows T,PM,SP,SA; **own-scope enforced only in controller `list`** | Partial (controller-level, not route) |
| View all tickets / queue | `manager/Tickets.jsx`, admin ticket pages | PM, SA (MOD-007, MOD-010) | Yes | Yes — `GET /tickets` | `GET /api/tickets` | Route allows all 4 roles; scoping in controller | Partial |
| View ticket audit trail | Ticket detail (history) | PM, SA (REQ-042) | Yes | Yes — `GET /tickets/:id/history` | `GET /api/tickets/:id/history` | authorize T,PM,SP,SA — **T & SP also allowed (broader than spec)** | Partial |
| Override AI category / priority | `manager/Tickets.jsx` (override-ai) | PM (REQ-028, UC-002, BR-006) | Yes | Yes — `PUT /tickets/:id/override-ai` | `PUT /api/tickets/:id/override-ai` | authorize PM, SA — **SA allowed (broader)** | Yes |
| Assign / reassign provider | `manager/Tickets.jsx` (assign) | PM only (BR-002, REQ-035, UC-003) | Yes | Yes — `PUT /tickets/:id/assign` | `PUT /api/tickets/:id/assign` | authorize PM, SA — **SA allowed (broader)** | Yes |
| Accept job | `provider/MyJobs.jsx` (accept) | SP (UC-004; Assigned→In Progress) | Yes | Yes — `PUT /tickets/:id/accept` | `PUT /api/tickets/:id/accept` | authorize SP, SA | Yes |
| Decline job (+ optional reason) | **None** (only text in `provider/Emergency.jsx:199`) | SP (UC-004 alt flow; REQ-037, REQ-038) | **No handler** | **No** | **No route exists** | — | **GAP — feature missing (spec requires Accept + Decline)** |
| Update job status (In Progress / Waiting Parts / Completed) | `provider/*` (start / waiting-parts / parts-received / complete) | SP (MOD-007, MOD-006) | Yes | Yes — `PUT /tickets/:id/start` etc. | `PUT /api/tickets/:id/start` `waiting-parts` `parts-received` `complete` | authorize SP, PM, SA; generic `PUT /:id/status` allows T,PM,SP,SA | Yes |
| Confirm completion / close | `tenant` tenant-confirm; `manager/Tickets.jsx` close | T confirms + PM verifies (state machine) | Yes | Yes | `PUT /api/tickets/:id/tenant-confirm` (T,SA); `PUT /api/tickets/:id/close` (PM,SA); `PUT /:id/confirm` (PM,SA) | ✓ matches spec | Yes |
| Reopen (mandatory justification) | `manager/Tickets.jsx` (reopen) | PM with reopen permission (REQ-041, BR-005) | Yes | Yes — `PUT /tickets/:id/reopen` | `PUT /api/tickets/:id/reopen` | authorize T, PM, SA — **T also allowed (deviation vs BR-005)**; `reopenTicketSchema` requires reason | Partial (role deviation) |
| Rate provider (1–5 stars + comment) | `tenant` rate form | T, after ticket CLOSED (REQ-047, MOD-009) | Yes | Yes — `POST /tickets/:id/rate` | `POST /api/tickets/:id/rate` | authorize TENANT only ✓; **service `rate()` (tickets.service.js:400) never checks ticket status == CLOSED** | Partial (**can rate open ticket — REQ-047 not enforced**) |
| Downgrade Emergency priority | `provider/Emergency.jsx` (view only) | SA only, after manual review (BR-009) | Route exists; no confirmed frontend trigger | ? | `PUT /api/tickets/:id/downgrade-emergency` | authorize SA only ✓ | Partial (no frontend trigger found) |
| Delete / cancel ticket | — | NOT IN SPEC | No | No | No route; `tickets.delete` permission exists (RBAC ADMIN) but unused | — | Flag: permission w/o route |
| **Profile / account** | | | | | | | |
| Register | `Auth.jsx` | All roles (REQ-001) | Yes | Yes — `POST /auth/register` | `POST /api/auth/register` | public + loginLimiter | Yes |
| Verify email | `Auth.jsx` | All roles (REQ-002) | Yes | Yes — `POST /auth/verify-email` | `POST /api/auth/verify-email` | public | Yes |
| Login / logout / token refresh | `Auth.jsx` + `api/client.js` | All roles (MOD-001) | Yes | Yes | `POST /api/auth/login` `logout` `refresh-token` | loginLimiter on login | Yes |
| Password reset (email link) | Forgot/Reset forms | All roles (REQ-007) | Yes | Yes | `POST /api/auth/forgot-password` `reset-password` | loginLimiter | Yes |
| Change own password | `tenant/Profile.jsx`, `provider/Profile.jsx` (handlePasswordChange) | NOT EXPLICIT in SRS (REQ-007 is reset-only) | Yes | **calls `updateUser(id,{password})` → `PATCH /users/:id`** | Correct endpoint `PUT /api/auth/change-password` exists (any auth) — **frontend never calls it**; `PATCH /api/users/:id` is SA-only AND controller (users.controller.js:77) ignores `password` | **BROKEN for T/SP (403 + no-op)** | **BUG** |
| Update own profile (name / surname / phone) | `tenant/Profile.jsx`, `provider/Profile.jsx` (handleSave) | NOT EXPLICIT in SRS | Yes | **calls `updateUser(id,{...})` → `PATCH /users/:id`** | Correct endpoint `PUT /api/profile` exists (any auth) — **frontend never calls it**; `PATCH /api/users/:id` = SA-only | **BROKEN for T/SP (403)** | **BUG** |
| Change own email | (part of handleSave) | NOT EXPLICIT in SRS | Yes | same broken `PATCH /users/:id` path; no uniqueness handling | `PUT /api/profile` | **BROKEN for T/SP** | **BUG** |
| View own profile | Profile pages via `getSession` → `auth/me` | All roles (implied, MOD-001) | Yes | Yes | `GET /api/auth/me`; `GET /api/profile` | ✓ | Yes |
| Configure notification channels | **None** | All roles (REQ-045) | **No page** | No | `GET/PUT /api/notification-preferences` (auth only) | Backend ✓ (all roles) | **Frontend gap — feature not surfaced** |
| Admin edits another user's profile | `admin/Users.jsx` (edit) | NOT EXPLICIT in SRS (deactivation only: REQ-008) | Yes | Yes — `PATCH /users/:id` | `PATCH /api/users/:id` | authorize SA only ✓ | Yes (SA only) |
| **Properties / Units** | | | | | | | |
| Add property | `manager/Properties.jsx` | PM (REQ-009; MOD-002 exclusively PMs, SA oversight) | Yes | Yes — `POST /properties` | `POST /api/properties` | authorize SA, PM — **SA allowed (oversight per MOD-002)** | Yes |
| Edit property (incl. deactivate/reactivate) | `manager/Properties.jsx` | PM (MOD-002) | Yes | Yes — `PUT /properties/:id` | `PUT /api/properties/:id` | authorize SA, PM | Yes |
| Add unit to property | `manager/Units.jsx` | PM (REQ-010) | Yes | Yes — `POST /units` | `POST /api/units` | authorize SA, PM | Yes |
| Edit unit | `manager/Units.jsx` | PM (MOD-002) | Yes | Yes — `PUT /units/:id` | `PUT /api/units/:id` | authorize SA, PM | Yes |
| Assign tenant to unit | `manager/Units.jsx` (assign) | PM (REQ-011 — one active tenant per unit) | Yes | Yes — `PUT /units/:id/assign` | `PUT /api/units/:id/assign` | authorize SA, PM | Yes |
| Reassign / vacate a unit | `manager/Units.jsx` (vacate) | PM (MOD-002; REQ-011) | Yes | Yes — `PUT /units/:id/vacate` | `PUT /api/units/:id/vacate` | authorize SA, PM | Yes |
| **Users / accounts (admin–manager side)** | | | | | | | |
| Approve Tenant / Provider account | `admin/Users.jsx` / pending list | PM (REQ-004) | Yes | Yes — `PUT /users/:id/approve` | `PUT /api/users/:id/approve` | authorize SA, PM — **no target-role check: PM can also approve a PM** | Partial (**REQ-005 not enforced — PM can approve PM**) |
| Approve Property Manager account | (same) | SA (REQ-005) | Yes | Yes | same route | **PM also allowed** | **Deviation** |
| Deactivate any account | `admin/Users.jsx` | SA (REQ-008) | Yes | Yes — `PUT /users/:id/deactivate` | `PUT /api/users/:id/deactivate` | authorize SA, PM — **PM can deactivate (deviation: spec SA only)** | Partial |
| Reactivate account | `admin/Users.jsx` | SA (implied MOD-001) | Yes | Yes — `PUT /users/:id/reactivate` | `PUT /api/users/:id/reactivate` | authorize SA ✓ | Yes |
| Unlock locked account | `admin/Users.jsx` | SA (REQ-006, MOD-001) | Yes | Yes — `PUT /users/:id/unlock` | `PUT /api/users/:id/unlock` | authorize SA ✓ | Yes |
| Change a user's role | `admin/Roles.jsx` | SA (REQ-003; RBAC mgmt MOD-001) | Yes | Yes — `PUT /users/:id/role` | `PUT /api/users/:id/role` | authorize SA ✓ | Yes |
| **Notifications** | | | | | | | |
| Mark notification as read / read-all | Notification pages | All roles (MOD-008) | **No handler (read-only pages)** | No | `PUT /api/notifications/:id/read`, `/read-all` (T,PM,SP,SA) | Backend ✓ | **Frontend gap — no mark-as-read action wired** |
| Update notification preferences | **None** | All roles (REQ-045) | **No page** | No | `GET/PUT /api/notification-preferences` (auth only) | Backend ✓ | **Frontend gap** |
| **Reporting (read-only)** | | | | | | | |
| View / export reports | `admin` Reports/Analytics; `manager` Reports | PM, SA (REQ-051..REQ-056, MOD-010) | Yes | Yes | `GET /api/reports/*`, `GET /api/analytics/*` | authorize SA, PM ✓ | Yes |

## Non-matrix findings from the code walk (new this pass)

1. **Profile flows broken for Tenants & Providers (P0)** — `tenant/Profile.jsx` & `provider/Profile.jsx` save via `updateUser(id, …)` → `PATCH /api/users/:id`, which is `SYSTEM_ADMIN`-only (`users.routes.js:16`) and its controller ignores `password` (`users.controller.js:77`). Correct any-role endpoints exist (`PUT /api/profile`, `PUT /api/auth/change-password`) but are never called. No `manager/Profile.jsx` or `admin/Profile.jsx` exist at all.
2. **Provider "Decline job" missing entirely** — spec UC-004 alt flow requires Accept + Decline (+ reason); only "Accept" is implemented. `decline` appears only as explanatory text (`provider/Emergency.jsx:199`).
3. **`POST /api/audit` has no role guard** (`audit.routes.js:10`) — any authenticated user can forge security-log entries (integrity risk; also unvalidated per validation audit).
4. **Categories `GET /` & `GET /:id` have no `authorize`** (`categories.routes.js:11-12`) — any authenticated user (T/SP) can list categories despite RBAC granting `categories.view` only to PM/SA.
5. **Rate endpoint doesn't enforce "after CLOSED"** — `tickets.service.js:400` `rate()` checks only the creator; REQ-047 requires ticket CLOSED first.
6. **Reopen route allows TENANT** (`tickets.routes.js:33`) — BR-005/REQ-041 specify PM only (with justification).
7. **PM can approve a PM and deactivate accounts** — `users.routes.js:11-12` authorize PM + SA with no target-role split (REQ-004 vs REQ-005, REQ-008).
8. **Backup/restore backend exists but frontend is local-only** — `super-admin.routes.js` has real SA `export/import/reset-data`; `admin/Backup.jsx` simulates restore/snapshot/PITR in localStorage (`storeCore.resetData`).
9. **`RBAC_MATRIX` contains vestigial `ADMIN` and `GUEST` keys** (`permissions.js:83-116`) not in the spec role set; routes only reference `SYSTEM_ADMIN`. `ADMIN` entry never used.
10. **Notification preferences + mark-as-read** — backend routes fine, no frontend surface at all (REQ-045, MOD-008 gaps).

---

# Frontend Wiring Verification (per action)

Criteria per action: (A) handler async + awaits store fn, (B) store fn calls `src/api/client.js` real endpoint (no localStorage/array-mutation bypass), (C) loading state shown, (D) error state shown on failure (silent catch = FAIL), (E) UI reflects server response (API-returned object / re-fetch) rather than an optimistic local guess.

Legend: ✓ ok · ✗ fails · ~ partial/mixed. "CACHE RE-READ" = refresh() re-reads the localStorage-backed store mirror (acceptable only because the store was just written from the API response).

| Action (matrix row) | Page | (A) await | (B) real API | (C) loading | (D) error UI | (E) post-success |
|---|---|---|---|---|---|---|
| Create ticket | `tenant/*` New Ticket → ticketsStore.create | ✓ | ✓ | ✗ | ✓ | ~ unshift local copy (`ticketStore.js:88`) of API ticket |
| Rate provider | `tenant/TicketTracking.jsx` handleRate | ✓ | ✓ (`POST /tickets/:id/rate`) | ✗ | ✓ | ✗ optimistic `selected.rating` patch (`:33`), no refetch |
| Confirm completion (Y) | `tenant/TicketTracking.jsx` handleConfirm(true) | ✓ | ✓ (`tenant-confirm`) | ✗ | ✓ | ✗ optimistic `selected.status='Tenant Confirmed'` (`:44`) |
| Reopen as tenant (N) | `tenant/TicketTracking.jsx` handleConfirm(false) | ✓ | ✓ | ✗ | ✓ | ✗ optimistic `selected.status='Reopened'` |
| Update own profile | `tenant/Profile.jsx` / `provider/Profile.jsx` | ✓ | ✗ **`PATCH /users/:id` = SA-only; correct `PUT /api/profile` unused** | ✗ | ✓ (user call) / ✗ (provider `updateTechnician` result ignored `Profile.jsx:66`) | ~ re-reads cache |
| Change own password | `tenant/Profile.jsx` / `provider/Profile.jsx` | ✓ | ✗ **`PATCH /users/:id`; `PUT /api/auth/change-password` never called; controller ignores `password`** | ✗ | ✓ | ~ |
| Accept job | `provider/MyJobs.jsx` / `JobDetail.jsx` | ✓ | ✓ | ✗ | ✓ | ~ CACHE RE-READ via `refresh()` |
| Start work | provider | ✓ | ✓ | ✗ | ✓ | ~ CACHE RE-READ |
| Waiting for parts | provider | ✓ | ✓ | ✗ | ✓ | ~ CACHE RE-READ |
| Parts received / resume | provider | ✓ | ✓ | ✗ | ✓ | ~ CACHE RE-READ |
| Complete job (list) | `MyJobs.jsx:53` | ✓ | ✓ (sends empty invoice) | ✗ | ✓ | ~ CACHE RE-READ |
| Complete job (w/ invoice+photos) | `JobDetail.jsx:199-208` | ✓ | ✓ | ✗ | ✓ | ~ CACHE RE-READ |
| Decline job | **none — GAP** | — | — | — | — | — |
| Update availability status | `provider/Profile.jsx` handleStatusChange | ✓ | ✓ | ✗ | ✓ | ~ CACHE RE-READ |
| Sync provider reports | `provider/Reports.jsx` handleSync | ✓ | ✓ | ✓ (`syncing`) | ✗ **no try/catch — rejection unhandled, `syncing` stuck** | ~ |
| Change ticket status | `manager/Tickets.jsx` handleTransition | ✓ | ✓ | ✗ | ✓ | ~ event-driven (store dispatches `spmt:tickets-updated`) |
| Reassign | `manager/Tickets.jsx` handleReassign | ✓ | ✓ | ✗ | ✓ | ~ event-driven |
| Reopen (PM) | `manager/Tickets.jsx` handleReopen | ✓ | ✓ | ✗ | ✓ | ~ event-driven |
| Override AI category | `manager/Tickets.jsx` / `AIReview.jsx` | ✓ | ✓ | ✗ | ✓ | ~ event-driven; **AIReview queue is one-shot `useState` — stale after override until reload** |
| Approve pending user | `manager/Tenants.jsx` handleApprove | ✓ | ✓ | ✗ | ✓ | ✗ **`window.location.reload()`** (`:75`) |
| Create unit | `manager/Units.jsx` handleCreate | ✓ | ✓ | ✗ | ✓ | ✓ uses `r.data.unitNumber` |
| Edit unit | `manager/Units.jsx` handleEdit | ✓ | ✓ | ✗ | ✓ | ~ CACHE RE-READ |
| Assign tenant to unit | `manager/Units.jsx` handleAssign | ✓ | ✓ | ✗ | ✓ | ~ CACHE RE-READ |
| Vacate unit | `manager/Units.jsx` executeConfirm | ✓ | ✓ | ✗ | ✗ **result discarded, success shown unconditionally** (`:80`) | ~ |
| Delete unit | `manager/Units.jsx` executeConfirm | ✓ | ✓ | ✗ | ✓ | ~ CACHE RE-READ |
| Create property | `manager/Properties.jsx` handleCreate | ✓ | ✓ | ✗ | ✓ | ✓ uses `r.data.name` |
| Edit property | `manager/Properties.jsx` handleEdit | ✓ | ✓ | ✗ | ✓ | ~ CACHE RE-READ |
| Deactivate/reactivate property | `manager/Properties.jsx` executeConfirm | ✓ | ✓ | ✗ | ✗ **same silent-discard pattern** (`:88-89`) | ~ |
| Technician status | `manager/Technicians.jsx` handleStatusChange | ✓ | ✓ | ✗ | ✓ | ~ CACHE RE-READ |
| Approve/deactivate/reactivate/unlock user | `admin/Users.jsx` | ✓ | ✓ | ✗ | ✓ | ~ CACHE RE-READ; **authStore normalizes `{message}` responses into blank user → cache row can blank** (`users.controller.js:48` no `user` payload) |
| Edit user (admin) | `admin/Users.jsx` handleEditSubmit | ✓ | ✓ (`PATCH /users/:id`, OK for SA) | ✗ | ✓ | ~ |
| Change role | `admin/Roles.jsx` confirmRoleChange | ✓ | ✓ | ✗ | ✓ | ✓ uses `result.data.name` |
| Create/edit/delete category | `admin/Categories.jsx` | ✓ | ✓ | ✗ | ✓ | ✓ uses `r.data.name`; delete blocked-check local |
| Save AI threshold | `admin/Categories.jsx` saveThreshold | ✓ | ✓ | ✓ (`savingThreshold`) | ✓ | ~ |
| Save system setting | `admin/Settings.jsx` saveSetting | ✓ | ✓ | ✓ (`saving`) | ✓ | ~ echoes typed value, not server echo |
| Save SLA field | `admin/Settings.jsx` saveSlaField | ✓ | ✓ | ✓ | ✓ | ~ |
| Retry/dismiss notification (admin) | `admin/Notifications.jsx` | ✓ | ✓ | ✗ | ✗ **silent** | ~ |
| Send message | `admin/Messages.jsx` | — **static template list, no send action** | — | — | — | — |
| Snapshot/restore/PITR/reset (backup) | `admin/Backup.jsx` | — | ✗ **fully simulated — `setTimeout` fakes (`:37,:50`), no API** | ✓ (fake `triggering`) | — | ✗ fabricated |
| View reports/analytics | `admin/Analytics.jsx` / `admin/Reports.jsx` | — | ✗ **no `/reports` or `/analytics` calls — computed from local `getStats()`/`getTickets()`; PDF client-side jsPDF** | — | — | — |
| View audit trail | `admin/AuditLogs.jsx` / `admin/Activity.jsx` | — | ✗ **reads localStorage `securityAuditLog`/`auditLog`, never `GET /api/audit`** | — | — | — |
| Create security log | `auditStore.addSecurityAuditLogEntry` | ✓ | ✓ (POST /api/audit) | — | ✗ **catch swallows error; always returns success** (`:26`) | ~ also pushes local copy |
| Mark notification read | Notification pages | — **no handler (read-only pages)** | — | — | — | — |
| Update notification prefs | **no page** | — | — | — | — | — |

## Wiring-pass summary

**Baseline that holds (pass standard):** every user-triggered handler is `async` and awaits its store fn — no fire-and-forget among actions. No page component mutates localStorage or store arrays directly (all mutations flow through stores; only local render copies are pushed in `JobDetail.jsx:76-85,173-174` and `Tenants.jsx:40`). Most actions hit real endpoints and surface errors.

**Systemic failures, by criterion:**
- **(B) Real API — 5 rows fail:** profile/password (wrong SA-only route), backup (simulated), admin reports/analytics (local compute), audit-log/activity views (localStorage reads), messages (no action). Plus two store-level fabrications: `notificationStore.addNotification` (`:42-54`) returns a fake local notification on API failure, and `auditStore.addAuditLogEntry` (`:8-18`) is pure localStorage with no API.
- **(C) Loading — failed almost everywhere.** Only settings, AI-thresholds, backup (fake), and both Reports sync buttons have busy states. Ticket-role actions (accept/start/complete/rate/confirm/reopen/assign/close/override), all unit/property create/edit/delete/assign/vacate, and all user admin actions can double-fire on double-click.
- **(D) Error UI — 4 silent paths:** manager vacate (`Units.jsx:80`), manager property deactivate/reactivate (`Properties.jsx:88-89`), provider technician-update (`Profile.jsx:66`), provider/manager Reports sync (no catch), admin notification retry/dismiss.
- **(E) Server-response fidelity — 2 optimistic-patch rows:** tenant confirm/reopen and rate hand-patch local `selected` with no refetch. Two rows force a full reload; AIReview holds a stale one-shot queue. Everything else re-reads the localStorage-backed store mirror immediately after a store write (drift window is small but the mirror is the app's primary read source — App.jsx re-syncs from the API only once at boot/login).

**Not wired at all (already flagged):** decline-job, notification mark-as-read + preferences, tenant/provider/manager Quick-Action tiles (dead `div`s, no `onClick`), `Documents.jsx` and `Materials.jsx` (5-line placeholders), manager Scheduling (read-only calendar).

---

# Backend Enforcement Verification (pass 5)

Per action: **AuthN? → Role (vs spec) → Ownership (beyond role) → State/domain guard → Verdict.**
Legend: ✓ enforced · ✗ missing/broken · ~ partial.
All roles on the ticket routes were re-checked end-to-end (route list → controller access check → service guard). `validate.js` uses `zod.safeParse` on plain `z.object` (unknown keys **stripped**, not rejected — so no `.strict()` misfires).

| # | Action (route) | AuthN | Role vs spec | Ownership | State/domain guard | Verdict |
|---|---|---|---|---|---|---|
| 1 | `POST /tickets` create | ✓ | T,PM,SA (T per spec; PM/SA broader) | `tenant_id = req.user.id` forced (`service.create:196`) ✓ | duplicate check ✓ | ok |
| 2 | `GET /tickets` list | ✓ | 4 roles | `injectScopeFilters` scopes T/SP/PM ✓ | — | ok |
| 3 | `GET /tickets/:id` | ✓ | 4 roles | `verifyTicketAccess` (T owns, SP = assigned_to, PM owns property, SA bypass) ✓ | — | ok |
| 4 | `PUT /tickets/:id/status` **generic** | ✓ | **T,PM,SP,SA — all 4 on one endpoint** | access ✓ | `changeStatus` only blocks TENANT→Reopened; **no per-role action mapping** | **✗ LOOPHOLE** |
| 5 | `PUT /tickets/:id/assign` | ✓ | PM,SA ✓ | access ✓ | reassign allowed; **no `isValidTransition` — force-sets `Assigned`** | **✗ LOOPHOLE** |
| 6 | `PUT /:id/accept` | ✓ | SP,SA ✓ | SP must be `assigned_to` ✓ | Assigned→Accepted via `performTransition` ✓ | ok (see note*) |
| 7 | `PUT /:id/start`·`waiting-parts`·`parts-received`·`complete` | ✓ | SP,PM,SA | access ✓ | `performTransition` validates each hop ✓ | ok |
| 8 | `PUT /:id/tenant-confirm` | ✓ | T,SA ✓ | T must own ✓ | requires `Completed` ✓ | ok |
| 9 | `PUT /:id/close` | ✓ | PM,SA ✓ | access ✓ | Tenant Confirmed→Closed via transition ✓ | ok |
| 10 | `PUT /:id/reopen` | ✓ | **T,PM,SA — TENANT allowed** | access ✓ | requires Completed/Archived + reason; **no role param passed to service** | **✗ LOOPHOLE** |
| 11 | `POST /:id/rate` | ✓ | T only ✓ | T must be creator ✓ | **no CLOSED check, no once-only check** | **✗ LOOPHOLE** |
| 12 | `PUT /:id/downgrade-emergency` | ✓ | SA only ✓ | n/a | requires `visual_emergency` ✓ | ok |
| 13 | `PUT /:id/override-ai` | ✓ | PM,SA ✓ | access ✓ | — | ok (frontend sends `category`, schema needs `correctedLabel` → 422 — **UI bug**) |
| 14 | `PUT /users/:id/approve` | ✓ | **PM,SA — no target-role split** | n/a | **no "is pending" check** | **✗ LOOPHOLE** |
| 15 | `PUT /users/:id/deactivate` | ✓ | **PM,SA — PM allowed (spec SA only)** | n/a | **no self / no last-SA guard** | **✗ LOOPHOLE** |
| 16 | `PUT /users/:id/reactivate`·`unlock`·`role`·`PATCH` | ✓ | SA only ✓ | n/a | self-role-change guard absent (minor) | ok |
| 17 | Notifications `GET /:id`·`PUT /:id/read`·`PUT /:id/status`·`DELETE /:id` | ✓ | all 4 roles | **✗ id-only, no `req.user` scoping** | — | **✗ IDOR LOOPHOLE** |
| 18 | Notifications `GET /`·`read-all`·`unread-count` | ✓ | all 4 | scoped by `req.user` ✓ | — | ok |
| 19 | `PUT /technicians/:id/location`·`POST /:id/availability` | ✓ | SP,SA | **✗ no self-check — SP can target any technician id** | — | **✗ LOOPHOLE** |
| 20 | Units `POST/`·`PUT/:id`·`assign`·`vacate`·`DELETE/:id` | ✓ | SA,PM | **✗ zero ownership — no `p.manager_id` filter** | assign has unit-occupancy/tenant-single check ✓ | **✗ LOOPHOLE** |
| 21 | Properties `POST/`·`PUT/:id`·`DELETE/:id` | ✓ | SA,PM | **✗ zero ownership — no `manager_id` filter** | — | **✗ LOOPHOLE** |
| 22 | `POST /api/audit` | ✓ auth | **✗ any role** | n/a | unvalidated | **✗ LOOPHOLE** |
| 23 | Categories `GET /`·`GET /:id` | **✗ none (no `authorize`)** | unauthenticated | n/a | — | **✗ LOOPHOLE (minor)** |

\* Note on Accept: earlier flag "accept 400s on every call" is **corrected** — `acceptSchema` is `{ note }` and `validate.js` **strips** unknown keys (no `.strict()`), so the frontend's `assignedTo:'Me'` is silently dropped and the call succeeds; the provider is still bound by `verifyTicketAccess`. Only `override-ai` truly 422s (missing `correctedLabel`).

## Confirmed loopholes — proof & fix location

| # | Loophole | How to break it (curl / steps) | Severity | Fix |
|---|---|---|---|---|
| L1 | **Generic `/status` has no per-role action mapping** (`tickets.routes.js:21`; `changeStatus` `tickets.service.js:266-299`) | SP: `PUT /tickets/:id/status {status:'Tenant Confirmed'}` (Completed→TC valid), then `{status:'Closed'}` → **SP closes own job, never seen by tenant** (BR-001/002 broken). TENANT: `{status:'Closed'}` on own Tenant-Confirmed ticket → bypasses PM verify-close; `{status:'Accepted'}`/`{status:'In Progress'}` on own ticket → drives provider steps. SP: `{status:'Reopened'}` on own Completed ticket. | P1 | Split route per action (like the dedicated steps already used) or add a role→allowed-transitions map inside `changeStatus`. |
| L2 | **`rate()` no CLOSED guard / once-only** (`tickets.service.js:400-409`) | Tenant `POST /tickets/:id/rate` on a New/Assigned ticket with `{rating:5}` → accepted. Repeat → duplicates. | P1 | Require `ticket.status==='Closed'` + single-rating unique check (REQ-047). |
| L3 | **TENANT can `/reopen`** (`tickets.routes.js:33`; `service.reopen:385` ignores role) | Tenant `PUT /tickets/:id/reopen {reason:'x'}` on own Closed/Completed ticket → 200. BR-005/REQ-041 (PM only) broken; the `/status` handler blocks T but this route doesn't. | P1 | Remove TENANT from route (PM,SA) or pass role into `service.reopen`. |
| L4 | **`assign` skips transition validation** (`tickets.service.js:301-328`) | PM `PUT /tickets/:id/assign` on a `Completed`/`Tenant Confirmed` ticket → forced back to `Assigned`, bypassing the reopen workflow. | P2 | Gate on `isValidTransition(ticket.status,'Assigned')` (Completed→Assigned invalid; must be Reopened first). |
| L5 | **Notifications IDOR** (`notifications.service.js:22-60`, routes `:15-17`) | Tenant `DELETE /api/notifications/<PM's id>`; `PUT /:id/status {deliveryStatus:'failed'}` on an Emergency alert; `GET /:id` reads any user's notification. | P1 | Pass `req.user` into `getById/markRead/updateStatus/remove`; assert `user_id = req.user.id`. |
| L6 | **Units: no ownership** (`units.service.js:22-31`; controllers pass-through) | PM-A `PUT /api/units/:id` / `PUT /:id/assign` / `DELETE /:id` on a unit in PM-B's property → succeeds. REQ-009/010/011 scoping absent. | P1 | Join `units→properties` and require `p.manager_id = req.user.id`. |
| L7 | **Properties: no ownership** (`properties.service.js:20-33`) | PM-A `PUT /api/properties/:id` (incl. `{manager_id: PM-B}`) / `DELETE /:id` on PM-B's property → succeeds. | P1 | Require `manager_id = req.user.id` for update/delete. |
| L8 | **PM can approve PM + deactivate anyone** (`users.routes.js:11-12`, `users.controller.js:34-50`) | PM `PUT /api/users/:id/approve` on another PM → approved (REQ-005: SA only). PM `PUT /api/users/:id/deactivate` on a SYSTEM_ADMIN → locks out SA (REQ-008: SA only). Also approves non-pending users. | P1 | Split approve/deactivate by target role; block deactivating SA/self/last-SA. |
| L9 | **SP can overwrite another technician's location/availability** (`technicians.routes.js:14,16`; service `:33-49`) | SP `PUT /api/technicians/:id/location` on any id → writes GPS. | P2 | Resolve provider id from `req.user.email`; require match. |
| L10 | **`POST /api/audit` unguarded** (`audit.routes.js:10`) | Any auth user forges `AUDIT_LOG`/security entries (integrity). | P1 | SA-only (or internal) + validation. |
| L11 | **Categories GET unauthenticated** (`categories.routes.js:11-12`) | Unauthenticated `GET /api/categories` → 200 (RBAC says PM/SA only). | P2 | Add `authorize` to both GETs. |

**Compliant (verified, no action):** ticket create/access/ownership + duplicate guard; `performTransition` (accept→…→close) enforces terminal + valid-hop; `tenantConfirm` requires Completed; `downgradeEmergency` SA-only + requires `visual_emergency`; register cannot self-register SYSTEM_ADMIN (`auth.validation.js:22`); PM-reopen justification required (`changeStatus:271-281`); notifications list/read-all/unread-count user-scoped; users reactivate/unlock/role/PATCH SA-only.
