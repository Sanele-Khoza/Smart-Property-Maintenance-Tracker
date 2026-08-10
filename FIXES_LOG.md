# Fixes Log

Running record of bugs found and fixed on `feature/F9-service-provider-ratings`. Ground truth for "why" is the code itself — file:line references below.

---

## 1. Service Provider couldn't change their own availability status

**Symptom:** Logging in as a Service Provider and trying to change Availability Status (Available / On Call / Off Duty) on the Profile page returned "insufficient permission".

**Root cause:** `provider/Profile.jsx` calls `updateTechnicianStatus()`, which hits `PUT /api/technicians/:id/status`. That route only authorized `SYSTEM_ADMIN` and `PROPERTY_MANAGER` — `SERVICE_PROVIDER` was missing, even though the sibling route right below it (`PUT /:id/location`) already allowed Service Providers to update their own record.

**Fix:** `backend/src/modules/technicians/technicians.routes.js:13`
Added `Roles.SERVICE_PROVIDER` to the `authorize(...)` list on `PUT /:id/status`, matching the existing `PUT /:id/location` pattern.

**Known pre-existing limitation (not introduced by this fix):** Neither `/:id/status` nor `/:id/location` verifies that the technician record being updated actually belongs to the calling provider — there's no ownership check anywhere in this module. Flagged for the user; not fixed since it's a pre-existing gap and out of scope for the reported bug.

---

## 2. Ticket photos were never visible to anyone except the tenant, in their own browser

**Symptom:** Tenants attach a photo when creating a ticket, but Property Managers, System Admins, and Service Providers had no way to see it — before or after assignment/acceptance, and even after tenant confirmation.

**Root cause:** A complete backend attachment system already existed (`ticket_attachments` table, `POST/GET /tickets/:id/attachments`, multer disk/S3 storage, static `/uploads` serving) but the frontend never called it:
- `createTicket()` in `frontend/src/data/ticketStore.js` only POSTed `{unit_id, title, description, priority, source}` to `/tickets` — the captured photos (base64) were kept only in local React state / `localStorage`, never sent to the backend.
- `GET /tickets` and `GET /tickets/:id` never returned attachment data at all.
- `mapTicket()` in `ticketStore.js` unconditionally set `images: []` on every ticket, discarding anything even if the backend had returned photos.
- 4 of the 5 places that display ticket photos (`manager/Tickets.jsx`, `components/Assignment.jsx`, `provider/MyJobs.jsx`, `provider/JobDetail.jsx`, `tenant/TicketTracking.jsx`) had UI code for it already, but it was permanently dead since the array was always empty.
- `admin/Tickets.jsx` (System Admin) had no photo-display code at all.

**Fix (backend):**
- `backend/src/modules/tickets/tickets.repository.js` — added `getAttachmentsByTicketIds()`, a bulk lookup (`WHERE ta.ticket_id = ANY($1::uuid[])`) so a ticket list doesn't need N+1 queries.
- `backend/src/modules/tickets/tickets.service.js` — `list()` and `getById()` now attach a resolved `attachments` array (with a ready-to-use `url`: local `/uploads/...` path or S3 presigned URL) to every ticket they return.

**Fix (frontend):**
- `frontend/src/api/client.js` — added `getStaticOrigin()` (derives the file-serving origin from the API base URL, since `/uploads` is served at server root, not under `/api`).
- `frontend/src/data/ticketStore.js`:
  - `createTicket()` now actually uploads each captured photo via `POST /tickets/:id/attachments` (multipart) right after the ticket is created, then refreshes the local copy with the real backend-hosted URLs.
  - `mapTicket()` now builds `images` from real backend `attachments` data instead of hardcoding `[]`.
- Fixed the `<img src=...>` binding in `components/Assignment.jsx`, `provider/MyJobs.jsx`, `provider/JobDetail.jsx`, and `tenant/TicketTracking.jsx` — they expected a raw string URL, but real attachment objects carry the URL in `.data`, so they now read `img.data || img`.
- Added a photo-display block to `admin/Tickets.jsx`, which had none before.

**Access control:** No new authorization code was needed — the existing `ensureTicketAccess()` scoping (Tenant: own tickets only; PM: own properties; Service Provider: tickets assigned to them, including pre-accept; System Admin: everything) already gates the ticket object that the photos are embedded in.

**Tests:** `backend/src/__tests__/tickets.test.js` mocked `tickets.repository.js` with a fixed export list that didn't include the two new functions — updated the mocks (`getAttachments`, `getAttachmentsByTicketIds`) and added a mock for `shared/adapters/s3Adapter.js#getPresignedUrl`. Full suite: 19/19 passing.

**Not yet verified:** Live end-to-end check in a real browser (upload a photo as tenant, confirm it renders for PM/Admin/SP) — implementation is done and unit-tested, but the manual browser pass hasn't happened yet.

---

## 3. Ticket type always showed "General", and provider recommendations only worked after a manual override

**Symptom:** Two related bugs reported together:
1. Tenants have no way to get their ticket properly classified — it always ends up as "General".
2. The service-provider recommendation/ranking (used when a PM assigns a ticket) only produced useful suggestions *after* the PM manually overrode the AI category — not automatically.

**Root cause (single bug, two symptoms):** `tickets.category` is set once at ticket creation (defaulting to `'General'`) and is **never updated automatically** afterward:
- The AI classification pipeline (`runAiPipeline` in `tickets.service.js`, and `classifyTicket` in `ai.service.js` — both call the same shared `persistClassification()`) runs automatically right after every ticket is created and correctly computes a category.
- But `persistClassification()` in `backend/src/modules/ai/ai.service.js` only ever wrote that result to a separate `ai_category` column — never back to `tickets.category`.
- The provider-matching scorer, `scoreProviders()` in `backend/src/shared/utils/routingScore.js:54`, resolves the ticket's category as `ticket.category || ticket.ai_category || 'Other'`. Since `ticket.category` is always the truthy string `'General'`, `ai_category` never got a chance to be used.
- The **only** code path that ever wrote to `tickets.category` was `overrideAiLabel()` (the PM's manual "override AI category" action) — which is exactly why recommendations appeared to only work after a manual override.

**Fix:** `backend/src/modules/ai/ai.service.js` — `persistClassification()`:
- Added `category: classification.primaryCategory` to the update payload.
- Updated the raw `UPDATE tickets` SQL to set `category = COALESCE($6, category)` (reusing the same parameter as `ai_category`), so a low-confidence/AWS-unavailable classification (where `primaryCategory` is `null`) never wipes out the existing category — it just leaves it as-is.

This single change fixes both symptoms because both classification pipelines funnel through this one function.

**Tests:** `backend/src/__tests__/ai.test.js`, `routing.test.js`, and `tickets.test.js` — 61/61 passing, no regressions.

**Open question raised, not yet acted on:** since a ticket's category can now silently change shortly after creation (tenant/PM might see "General" for a moment, then it flips to the AI-determined category), should there be a visible "AI classified" indicator so this doesn't read as a glitch? Not implemented — pending a decision.

---

## 4. Ticket photo thumbnails weren't clickable to view full-size

**Symptom:** Follow-up to #2 — now that photos actually render, there was no way to see them larger than a small thumbnail. Clicking a thumbnail did nothing (or, on the Manager Tickets page, silently no-opped).

**Root cause:** A shared `ImageLightbox` component (`frontend/src/components/common/ImageLightbox.jsx`) already existed — a full-screen dark-overlay modal with an `×` close button, backed by existing `.modal`/`.modal-close` CSS — but it was wired up in only one place, and even there incompletely:
- `manager/Tickets.jsx` imported it and tracked `lightboxImg` state on thumbnail click, but never actually rendered `<ImageLightbox />` anywhere, so clicking a photo did nothing.
- `admin/Tickets.jsx`, `provider/MyJobs.jsx`, `provider/JobDetail.jsx`, `tenant/TicketTracking.jsx`, `provider/WorkHistory.jsx` had no click handling or lightbox at all — thumbnails were static.

**Fix:** Wired up `ImageLightbox` consistently across all six locations that render ticket photos:
- `manager/Tickets.jsx` — added the missing `<ImageLightbox src={lightboxImg} onClose={...} />` render.
- `admin/Tickets.jsx`, `provider/MyJobs.jsx`, `provider/JobDetail.jsx` (both the ticket photo grid and the completion-photo grid), `tenant/TicketTracking.jsx`, `provider/WorkHistory.jsx` — added `lightboxImg` state, a `cursor: pointer` + `onClick` on each thumbnail, and the `ImageLightbox` render.
- `provider/WorkHistory.jsx` also had its `<img src={img}>` binding fixed to `img.data || img` (same bug class as #2 — attachments are objects, not raw strings) so its completion-photo thumbnails render at all.

Clicking any thumbnail now opens the photo full-size over a dark overlay; clicking the `×` (or anywhere on the overlay) closes it — no new component needed, just consistent wiring of the existing one.

**Not yet verified:** Live browser check.

---

## 5. Tenant had no way to choose a ticket category — always defaulted to "General", forcing a PM override before recommendations were useful

**Symptom:** Tenants could only submit `unitId, title, description, priority` — no category field existed. Every ticket landed on `category: 'General'` until a Property Manager manually ran the "Override Category" flow. Recommendations only ever produced matches after that manual step.

**Root cause (traced end-to-end before changing anything, per user request):**
- `frontend/src/components/Ticket.jsx` had no category field in form state, so nothing was ever sent for it.
- `backend/src/modules/tickets/tickets.validation.js`'s `createTicketSchema` had no `category` field at all (only a vestigial, unused `category_id`). Zod silently strips unrecognized keys — so even sending `category` from the frontend would have been dropped before reaching the controller. **This was the actual blocker**, not the repository layer: `tickets.repository.js#create()` already did `category || 'General'`, i.e. it was ready to accept a real category and only defaulted when none was supplied.
- The "recommendation tool" that Property Managers actually see (`getRoutingRecommendations()`, inline client-side logic in `manager/Tickets.jsx`) reads `ticket.category` directly against technician `.specialisations` — it has no permission gate and never required an override; it simply had nothing but `'General'` to match against, and no technician has that as a specialisation.
- Also found, but intentionally **not fixed this round** (deferred — AI classifier is being redone later, per user): a bug in `aiClassifier.js`'s step-5 fallback that discards a usable keyword-based text classification whenever neither AWS service is live, and a `pm_confirmed`/`PUT /tickets/:id/confirm` gate that's unreachable from any frontend code. Neither is the mechanism behind this bug, but both remain open items for whenever the AI classifier work happens.
- Category taxonomy was also found fragmented across four places, one of which (the DB `categories` table / `/api/categories` module / `category_id` FK) is entirely dead — `015_sdd_schema.js` drops the `categories` table while rebuilding `tickets` with a flat `category VARCHAR(100)` column, and nothing recreates it, so `GET /api/categories` errors today. Not touched — out of scope.

**Fix:**
- `backend/src/modules/tickets/tickets.validation.js` — added `category: z.string().min(1).optional()` to `createTicketSchema`.
- `frontend/src/data/categories.js` (new) — canonical `TICKET_CATEGORIES` list: `Plumbing, Electrical, HVAC, Painting, Carpentry, Tiling, Solar`, matching what's actually seeded on `service_providers.specialisations`, so a chosen category always has a chance of matching an eligible technician (user's explicit choice over the old 5-item local default list, which barely overlapped with real specialisations).
- `frontend/src/components/Ticket.jsx` — added a required Category field, sourced from `TICKET_CATEGORIES`, included in form validation and the pre-submit review table.
- `frontend/src/data/ticketStore.js` — `createTicket()` now takes a `category` argument and sends it in the `POST /tickets` body.
- `frontend/src/pages/manager/Tickets.jsx` and `frontend/src/pages/admin/Tickets.jsx` — swapped the PM/Admin "Override Category" dropdown from the old local `getCategories()` store to the same `TICKET_CATEGORIES` list, so tenant-chosen and PM-overridden categories are drawn from one consistent set.
- `frontend/src/pages/manager/Tickets.jsx` — Reassign modal now resolves the ticket from the live `tickets` array by id instead of the stale snapshot captured on click, so a category override made just before reopening Reassign is always reflected (belt-and-suspenders; the override → reactive re-render path already worked correctly across separate open/close cycles).

**Not yet verified:** Live browser check. Backend build/lint pass and a production frontend build were run clean; no automated tests exist yet for ticket creation's category field specifically.

---

## Status summary

| # | Bug | Backend fix | Frontend fix | Tests | Live browser check |
|---|---|---|---|---|---|
| 1 | SP can't change availability | ✅ | — | — (trivial route change) | Not done |
| 2 | Ticket photos invisible to PM/Admin/SP | ✅ | ✅ | ✅ 19/19 | Not done |
| 3 | Category stuck on "General" / recommendations need manual override | ✅ | — | ✅ 61/61 | Not done |
| 4 | Photo thumbnails not clickable to view full-size | — | ✅ | — (UI wiring only) | Not done |
| 5 | Tenant can't choose category / recommendations need PM override | ✅ | ✅ | — (build/lint clean) | Not done |

None of these five fixes have had a live, in-browser end-to-end pass yet — all verification so far is code-level (unit tests, mock coverage, manual trace-through, lint, build). Recommend a full manual smoke test before merging.
