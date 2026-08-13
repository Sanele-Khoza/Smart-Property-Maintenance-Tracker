# SPMT API Reference — Phase 6 (SDD §4)

> Base URL: `http://localhost:5000/api`
>
> Exact endpoint surface from MOD-001–MOD-010 (SDD §4) plus explicit REQ gaps.
> No generic REST. No `/permissions`, `/roles`, `/messages`, `/system`, `/help` (SRS §1.4).

---

## Conventions

| Convention | Standard |
|---|---|
| **Auth** | `Authorization: Bearer <JWT>` — required on every endpoint except `/auth/register` and `/auth/login` (SDD §6.1) |
| **Response envelope** | `{ data: { ... } \| null, error: { message, code } \| null, meta: { timestamp, requestId } }` (SDD §6.1) |
| **Pagination** | Inside `data`: `{ ..., pagination: { page, limit, total, totalPages } }` |
| **Date format** | ISO 8601 (`2026-07-10T12:00:00.000Z`) |
| **Validation** | Zod — errors returned as `{ data: null, error: { message: "Validation failed", code: "VALIDATION_ERROR", details: [{ field, message }] }, meta }` |

### Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request (validation or business rule) |
| 401 | Unauthorized (no token / invalid token / expired) |
| 403 | Forbidden (insufficient role / account locked/suspended/deactivated) |
| 404 | Not Found |
| 409 | Conflict (duplicate email, duplicate rating, etc.) |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

### Roles

| Abbr | Role | Description |
|------|------|-------------|
| SA | `SYSTEM_ADMIN` | Full system access |
| PM | `PROPERTY_MANAGER` | Manages properties, tickets, service providers |
| T | `TENANT` | Reports issues, views own tickets, rates |
| SP | `SERVICE_PROVIDER` | Views/accepts/completes assigned tickets |

All four roles are enum constants enforced at Express middleware. No dynamic permissions system.

---

## MOD-001 Auth — 6 endpoints

### `POST /auth/register`

**Description:** Register a new user account.  
**Auth:** None (public)  
**Rate limit:** 5 req / 15 min per IP

**Request body:**
```json
{
  "name": "Sarah",
  "surname": "Tenant",
  "email": "sarah@example.com",
  "password": "SecureP@ss1",
  "role": "TENANT",
  "phone": "+27115550102"
}
```

**Validation rules:**
- `name` string 1–100
- `surname` string 1–100  
- `email` valid email, lowercased
- `password` min 8, max 128, must contain uppercase + lowercase + digit + special
- `role` one of `TENANT`, `SERVICE_PROVIDER`, `PROPERTY_MANAGER` (registering `SYSTEM_ADMIN` is forbidden here — only seeded)
- `phone` optional, max 20

**Role effect on account status:**
- `SERVICE_PROVIDER` → status `PENDING` (requires PM approval per REQ-004)
- `PROPERTY_MANAGER` → status `PENDING` (requires SA approval per REQ-005)
- `TENANT` → status `ACTIVE` (auto-approved)

**Response 201:**
```json
{
  "data": {
    "user": { "id": "uuid", "name": "Sarah", "surname": "Tenant", "email": "sarah@example.com", "role": "TENANT", "status": "ACTIVE" },
    "accessToken": "eyJ...",
    "refreshToken": "hex..."
  },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Errors:** 400 (validation), 409 (duplicate email)

---

### `POST /auth/login`

**Description:** Authenticate and receive tokens.  
**Auth:** None (public)  
**Rate limit:** 10 req / 15 min per IP

**Request body:**
```json
{
  "email": "sarah@example.com",
  "password": "SecureP@ss1"
}
```

**Account checks (in order):** locked → suspended → deactivated → deleted → pending approval → credentials match → exceeded attempts

**On 5 failed attempts:** account locked for 30 min (returns 403)

**Response 200:**
```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "hex...",
    "user": { "id": "uuid", "name": "Sarah", "surname": "Tenant", "email": "sarah@example.com", "role": "TENANT", "status": "ACTIVE" }
  },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Errors:** 401 (invalid credentials), 403 (locked/suspended/deactivated/pending), 429 (rate limit)

---

### `POST /auth/refresh`

**Description:** Exchange a refresh token for a new access + refresh token pair (rotation).  
**Auth:** None (uses refresh token in body)

**Request body:**
```json
{ "refreshToken": "hex..." }
```

**Response 200:**
```json
{
  "data": { "accessToken": "eyJ...", "refreshToken": "hex..." },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Errors:** 401 (invalid/expired/revoked token), 403 (account not active)

---

### `POST /auth/logout`

**Description:** Revoke all refresh tokens for the authenticated user.  
**Auth:** Bearer token

**Headers:** `Authorization: Bearer eyJ...`

**Response 200:**
```json
{
  "data": { "message": "Logged out successfully from all devices" },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

---

### `POST /auth/verify-email`

**Description:** Verify email address using the token sent during registration.  
**Auth:** None (uses verification token in body)

**Request body:**
```json
{ "token": "hex..." }
```

**Response 200:**
```json
{
  "data": { "message": "Email verified successfully", "accessToken": "eyJ..." },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Errors:** 400 (invalid/expired token)

---

### `POST /auth/reset-password`

**Description:** Reset password using a reset token (obtained via forgot-password flow). Serves both the "send reset email" and "submit new password" steps.

**Auth:** None

**Step 1 — Request reset token:**
```json
{ "email": "sarah@example.com" }
```
**Response 200:** `{ data: { message: "If the email exists, a reset link has been sent" }, error: null, meta }`  
(Always returns 200 to avoid email enumeration.)

**Step 2 — Submit new password:**
```json
{ "token": "hex...", "newPassword": "NewSecureP@ss1" }
```
**Response 200:** `{ data: { message: "Password reset successfully. Please log in again." }, error: null, meta }`
**Errors:** 400 (invalid/expired token, weak password)

---

## MOD-002 Property — 4 endpoints

### `POST /properties`

**Description:** Create a new property.  
**Auth:** Bearer token  
**Roles:** SA, PM

**Request body:**
```json
{
  "name": "Sunset Towers",
  "address": "123 Main St, Johannesburg, 2001",
  "type": "Residential",
  "status": "Active"
}
```

`type` defaults to `Residential`. `status` defaults to `Active`.

**Response 201:**
```json
{
  "data": { "property": { "id": "uuid", "name": "Sunset Towers", "address": "...", "type": "Residential", "status": "Active", "createdAt": "..." } },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Errors:** 400 (validation), 403 (role)

---

### `GET /properties`

**Description:** List all properties.  
**Auth:** Bearer token  
**Roles:** Any

**Query params:** `?status=Active&type=Residential&search=Sunset&page=1&limit=20`

**Response 200:**
```json
{
  "data": {
    "properties": [{ "id": "uuid", "name": "Sunset Towers", "type": "Residential", "status": "Active", "address": "...", "unitCount": 10, "createdAt": "..." }],
    "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
  },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Filters by role:** Tenants see only properties where they occupy a unit. SPs see properties where they have ticket assignments. PMs and SAs see all.

---

### `POST /properties/{id}/units`

**Description:** Add a unit to a property.  
**Auth:** Bearer token  
**Roles:** SA, PM

**Request body:**
```json
{
  "unitNumber": "101",
  "floor": "1",
  "type": "1-Bed",
  "bedrooms": 1,
  "bathrooms": 1,
  "sizeSqm": 45
}
```

**Response 201:**
```json
{
  "data": { "unit": { "id": "uuid", "propertyId": "uuid", "unitNumber": "101", "floor": "1", "type": "1-Bed", "bedrooms": 1, "bathrooms": 1, "sizeSqm": 45, "status": "Vacant" } },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Errors:** 404 (property not found)

---

### `POST /properties/{id}/units/{unitId}/assign`

**Description:** Assign a tenant to a unit. Sets occupant_id and unit status to Occupied.  
**Auth:** Bearer token  
**Roles:** SA, PM

**Request body:**
```json
{ "tenantId": "uuid" }
```

**Response 200:**
```json
{
  "data": { "unit": { "id": "uuid", "unitNumber": "101", "status": "Occupied", "occupantId": "uuid" } },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Errors:** 404 (property/unit/tenant not found), 400 (unit already occupied, tenant already assigned elsewhere)

---

## MOD-003 Ticket Submit — 3 endpoints

### `POST /tickets`

**Description:** Create a new maintenance ticket with optional file attachments (multipart/form-data).  
**Auth:** Bearer token  
**Roles:** T, PM, SA

**Request (multipart/form-data):**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| unitId | string (UUID) | yes | |
| category | string | yes | max 100 |
| title | string | yes | max 300 |
| description | string | yes | min 20 chars |
| priority | string | no | `LOW`, `MEDIUM`, `HIGH`, `EMERGENCY` — defaults `MEDIUM` |
| source | string | no | defaults `tenant_portal` |
| attachments | file[] | no | Max 5 files, max 10 MB each, JPEG/PNG only |

**Role restrictions:** Tenants can only create tickets for units they occupy. SAs/PMs can create for any unit.

**Response 201:**
```json
{
  "data": {
    "ticket": {
      "id": "uuid",
      "unitId": "uuid",
      "tenantId": "uuid",
      "category": "Plumbing",
      "title": "Leaking faucet in kitchen",
      "description": "Kitchen faucet has been leaking for two days.",
      "priority": "HIGH",
      "status": "Open",
      "source": "tenant_portal",
      "createdAt": "2026-07-10T12:00:00.000Z",
      "updatedAt": "2026-07-10T12:00:00.000Z"
    }
  },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Errors:** 400 (validation, description too short), 403 (tenant assigning to wrong unit), 413 (file too large)

---

### `GET /tickets`

**Description:** List tickets with filtering and pagination.  
**Auth:** Bearer token  
**Roles:** Any (results filtered by role)

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| page | int | default 1 |
| limit | int | default 20, max 100 |
| status | string | `Open`, `Assigned`, `In Progress`, `Completed`, etc. |
| priority | string | `LOW`, `MEDIUM`, `HIGH`, `EMERGENCY` |
| unitId | string (UUID) | |
| tenantId | string (UUID) | |
| assignedTo | string (UUID) | |
| category | string | exact match |
| search | string | ILIKE on title + description |
| orderBy | string | `createdAt`, `updatedAt`, `priority`, `status` — defaults `createdAt DESC` |

**Role-based filtering:**
- **Tenant:** only own tickets
- **SP:** only tickets assigned to them
- **PM:** all tickets in their managed properties
- **SA:** all tickets

**Response 200:**
```json
{
  "data": {
    "tickets": [
      {
        "id": "uuid",
        "unitId": "uuid",
        "tenantId": "uuid",
        "category": "Plumbing",
        "title": "Leaking faucet",
        "description": "...",
        "priority": "HIGH",
        "status": "Open",
        "assignedTo": null,
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
  },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

---

### `GET /tickets/{id}`

**Description:** Get a single ticket by ID.  
**Auth:** Bearer token  
**Roles:** Any (role-filtered — tenants see only own, SPs see only assigned)

**Response 200:**
```json
{
  "data": {
    "ticket": { "id": "uuid", "unitId": "uuid", "tenantId": "uuid", "category": "Plumbing", "title": "...", "description": "...", "priority": "HIGH", "status": "Open", "assignedTo": null, "aiTextLabel": null, "aiVisualLabel": null, "conflictDetected": false, "source": "tenant_portal", "dueDate": null, "createdAt": "...", "updatedAt": "..." },
    "attachments": [{ "id": "uuid", "fileKey": "...", "fileType": "image/jpeg", "uploadedBy": "uuid", "uploadedAt": "..." }]
  },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Errors:** 404 (not found), 403 (not authorized to view)

---

## MOD-006 Routing — 4 endpoints

### `GET /tickets/{id}/provider-recommendations`

**Description:** Get AI-ranked list of service providers recommended for this ticket.  
**Auth:** Bearer token  
**Roles:** PM, SA

**Logic:** Ranks SPs by specialisation match to ticket category + availability status + lowest current workload + highest rating.

**Response 200:**
```json
{
  "data": {
    "recommendations": [
      { "provider": { "id": "uuid", "name": "Bob The Builder", "companyName": "Bob's Repairs", "specialisations": ["Plumbing", "Electrical"], "rating": 4.5, "currentWorkload": 2, "status": "AVAILABLE" }, "score": 0.92, "reason": "Specialisation match: Plumbing, lowest workload among available providers" }
    ]
  },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Error 404:** ticket not found

---

### `POST /tickets/{id}/assign`

**Description:** Assign a service provider to a ticket. Sets `assigned_to` and transitions status to `Assigned`.  
**Auth:** Bearer token  
**Roles:** PM, SA

**Request body:**
```json
{ "providerId": "uuid", "note": "Urgent — please prioritise" }
```

`providerId` is required. `note` is optional (logged in internal audit trail).

**Response 200:**
```json
{
  "data": { "ticket": { "id": "uuid", "status": "Assigned", "assignedTo": "uuid" } },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Errors:** 404 (ticket/provider not found), 400 (ticket already assigned, invalid state transition)

---

### `PATCH /tickets/{id}/accept`

**Description:** Service provider accepts an assignment. Transitions status to `In Progress`.  
**Auth:** Bearer token  
**Roles:** SP (must be the assigned provider)

**Response 200:**
```json
{
  "data": { "ticket": { "id": "uuid", "status": "In Progress", "assignedTo": "uuid" } },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Errors:** 403 (not the assigned provider), 400 (ticket not in `Assigned` status)

---

### `PUT /tickets/{id}/decline`

**Description:** Service provider declines an assignment. Ticket moves to `Declined` and `assigned_to` is cleared so it can be reassigned by the property manager. An optional `postponeUntil` (RFC 3339 datetime) records when the provider can take the job; the manager sees this when rescheduling.  
**Auth:** Bearer token  
**Roles:** SP (must be the assigned provider), SA

**Request body (optional):**
```json
{ "note": "Out of service area", "postponeUntil": "2026-08-20T09:00:00.000Z" }
```

**Response 200:**
```json
{
  "data": { "ticket": { "id": "uuid", "status": "Declined", "assignedTo": null, "postponedUntil": "2026-08-20T09:00:00.000Z" } },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Errors:** 403 (not the assigned provider), 400 (ticket not in `Assigned` status)

---

## MOD-007 Lifecycle — 3 endpoints

### `PATCH /tickets/{id}/status`

**Description:** Transition ticket status through the allowed state machine.  
**Auth:** Bearer token  
**Roles:** PM, SP, SA

**Request body:**
```json
{ "status": "Completed", "reason": "Fixed the leaking pipe and tested" }
```

**Allowed transitions (validated server-side):**
```
Open → Assigned
Assigned → In Progress (via accept)
In Progress → Completed | On Hold
Completed → Reopened (by tenant/admin)
Reopened → Assigned | In Progress
On Hold → In Progress
Any → Cancelled
```

**Response 200:**
```json
{
  "data": { "ticket": { "id": "uuid", "status": "Completed", "updatedAt": "..." } },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Errors:** 400 (invalid transition, e.g. `Open → Completed`), 403 (role not permitted for this transition)

---

### `POST /tickets/{id}/reopen`

**Description:** Reopen a completed ticket. Status becomes `Reopened`.  
**Auth:** Bearer token  
**Roles:** T (owner), PM, SA

**Request body:**
```json
{ "reason": "Issue returned after 2 days" }
```

`reason` is required.

**Response 200:**
```json
{
  "data": { "ticket": { "id": "uuid", "status": "Reopened", "updatedAt": "..." } },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Errors:** 404, 403 (tenant trying to reopen another's ticket), 400 (ticket not in `Completed` status)

---

### `GET /tickets/{id}/audit-trail`

**Description:** Get chronological history of all status transitions for a ticket.  
**Auth:** Bearer token  
**Roles:** Any (role-filtered)

**Response 200:**
```json
{
  "data": {
    "auditTrail": [
      { "status": "Open", "changedBy": "uuid", "changedByName": "Sarah Tenant", "reason": "Ticket created", "createdAt": "..." },
      { "status": "Assigned", "changedBy": "uuid", "changedByName": "John Manager", "reason": "Assigned to Bob The Builder", "createdAt": "..." },
      { "status": "In Progress", "changedBy": "uuid", "changedByName": "Bob The Builder", "reason": "Accepting assignment", "createdAt": "..." },
      { "status": "Completed", "changedBy": "uuid", "changedByName": "Bob The Builder", "reason": "Fixed the leaking pipe", "createdAt": "..." }
    ]
  },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

---

## MOD-009 Ratings — 3 endpoints

### `POST /tickets/{id}/rating`

**Description:** Rate a completed ticket. One rating per ticket (idempotent — returns 409 on duplicate).  
**Auth:** Bearer token  
**Roles:** T (must be the ticket owner)

**Request body:**
```json
{ "rating": 5, "comment": "Excellent work, very professional" }
```

`rating` is 1–5 integer. `comment` is optional, max 1000 chars.

**Response 201:**
```json
{
  "data": { "rating": { "id": "uuid", "ticketId": "uuid", "rating": 5, "comment": "Excellent work, very professional", "createdAt": "..." } },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Errors:** 403 (not the ticket owner), 404, 409 (already rated), 400 (ticket not completed)

---

### `GET /providers/{id}/profile`

**Description:** Get a service provider's public profile.  
**Auth:** Bearer token  
**Roles:** Any

**Response 200:**
```json
{
  "data": {
    "provider": { "id": "uuid", "name": "Bob The Builder", "companyName": "Bob's Repairs", "email": "bob@example.com", "phone": "0115550105", "specialisations": ["Plumbing", "Electrical"], "rating": 4.5, "currentWorkload": 2, "status": "AVAILABLE", "totalRatings": 15 }
  },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

---

### `GET /providers/{id}/ratings`

**Description:** List all ratings received by a service provider.  
**Auth:** Bearer token  
**Roles:** Any

**Response 200:**
```json
{
  "data": {
    "ratings": [
      { "id": "uuid", "ticketId": "uuid", "rating": 5, "comment": "Excellent work", "createdAt": "...", "tenantName": "Sarah Tenant" }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 15, "totalPages": 1 }
  },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

---

## MOD-010 Reports — 5 endpoints

All report endpoints require Bearer token and roles **SA** or **PM**. All support `?startDate=...&endDate=...` ISO 8601 range filtering.

### `GET /reports/ticket-volume`

**Description:** Ticket creation volume grouped by day/week/month.  
**Query:** `?groupBy=day&startDate=2026-06-01&endDate=2026-07-01`

**Response 200:**
```json
{
  "data": {
    "report": { "groupBy": "day", "dataPoints": [{ "date": "2026-06-15", "count": 8 }, { "date": "2026-06-16", "count": 12 }] }
  },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

---

### `GET /reports/resolution-time`

**Description:** Average/median resolution time by priority.  
**Query:** `?startDate=...&endDate=...`

**Response 200:**
```json
{
  "data": {
    "report": { "resolutionTimes": [{ "priority": "EMERGENCY", "avgMinutes": 185, "medianMinutes": 160, "ticketCount": 24 }, { "priority": "HIGH", "avgMinutes": 390, "medianMinutes": 370, "ticketCount": 56 }] }
  },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

---

### `GET /reports/sla-compliance`

**Description:** SLA breach rate by priority.  
**Query:** `?startDate=...&endDate=...`

**Response 200:**
```json
{
  "data": {
    "report": { "overallCompliance": 0.94, "byPriority": [{ "priority": "EMERGENCY", "compliant": 22, "breached": 2, "rate": 0.917 }, { "priority": "HIGH", "compliant": 52, "breached": 4, "rate": 0.929 }] }
  },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

---

### `GET /reports/provider-performance`

**Description:** Per-provider metrics: jobs completed, avg rating, avg resolution time, SLA breach count.  
**Query:** `?startDate=...&endDate=...&providerId=uuid`

**Response 200:**
```json
{
  "data": {
    "report": [{ "providerId": "uuid", "providerName": "Bob The Builder", "jobsCompleted": 42, "avgRating": 4.7, "avgResolutionMinutes": 210, "slaBreaches": 1 }]
  },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

---

### `GET /reports/ai-performance`

**Description:** Multi-modal AI classification accuracy metrics.  
**Auth:** Bearer token  
**Roles:** SA only

**Response 200:**
```json
{
  "data": {
    "report": {
      "textClassificationAccuracy": 0.89,
      "visualClassificationAccuracy": 0.92,
      "arbitrationConflictRate": 0.08,
      "autoAssignAccuracy": 0.85,
      "byLabel": [{ "label": "Plumbing", "textPrecision": 0.91, "visualPrecision": 0.94, "conflicts": 3 }],
      "sampleSize": 1500
    }
  },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

---

## File Access — 1 endpoint

### `GET /tickets/{id}/attachments/{attachmentId}/url`

**Description:** Get a pre-signed S3 URL to download an attachment (SDD §6.5). URL expires in 15 minutes.  
**Auth:** Bearer token  
**Roles:** Any (role-filtered — must have access to the parent ticket)

**Response 200:**
```json
{
  "data": { "url": "https://s3.af-south-1.amazonaws.com/spmt-attachments/...?X-Amz-Algorithm=...&X-Amz-Signature=...", "expiresIn": 900 },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Errors:** 404 (ticket or attachment not found), 403 (no access to ticket)

---

## Designed-Not-Specified (REQ Gaps)

These endpoints are **not spelled out in SDD §4** but are required by explicit REQ items. Flagged per traceability convention.

---

### 🔴 DNS-01 — Account Approval (REQ-004, REQ-005)

Approval workflow: PM approves Tenant/SP registrations (REQ-004). SA approves PM registrations (REQ-005).

#### `GET /users/pending`

**Description:** List users awaiting approval, filtered by role.  
**Auth:** Bearer token  
**Roles:** PM (sees T + SP), SA (sees all including PM)

**Query:** `?role=TENANT&page=1&limit=20`

**Response 200:**
```json
{
  "data": {
    "users": [{ "id": "uuid", "name": "New", "surname": "Tenant", "email": "new@email.com", "role": "TENANT", "status": "PENDING", "createdAt": "..." }],
    "pagination": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
  },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

---

#### `PATCH /users/{id}/approve`

**Description:** Approve a pending user.  
**Auth:** Bearer token  
**Roles:** PM (can approve T + SP), SA (can approve any including PM)

**Response 200:**
```json
{
  "data": { "user": { "id": "uuid", "status": "ACTIVE", "approvedAt": "..." } },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Errors:** 404, 403 (PM trying to approve another PM), 400 (user not in PENDING status)

---

### 🔴 DNS-02 — Account Deactivation / Reactivation (REQ-008)

#### `PATCH /users/{id}/deactivate`

**Description:** Deactivate a user account. SA can deactivate any user. Self-deactivation requires password confirmation.  
**Auth:** Bearer token  
**Roles:** SA (any user), or self with password

**Request body (self-deactivation):**
```json
{ "password": "currentPassword" }
```

**Response 200:**
```json
{
  "data": { "user": { "id": "uuid", "status": "DEACTIVATED", "deactivatedAt": "..." } },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

**Errors:** 401 (wrong password for self-deactivation), 403 (already deactivated or non-SA deactivating another)

---

#### `PATCH /users/{id}/reactivate`

**Description:** Reactivate a deactivated account.  
**Auth:** Bearer token  
**Roles:** SA only

**Response 200:**
```json
{
  "data": { "user": { "id": "uuid", "status": "ACTIVE", "deactivatedAt": null } },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

---

### 🔴 DNS-03 — Notification Channel Preference (REQ-045)

#### `GET /users/me/notification-preferences`

**Description:** Get the current user's notification channel preferences.  
**Auth:** Bearer token  
**Roles:** Any

**Response 200:**
```json
{
  "data": { "preferences": { "email": true, "inApp": true, "sms": false } },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

---

#### `PUT /users/me/notification-preferences`

**Description:** Update notification channel preferences.  
**Auth:** Bearer token  
**Roles:** Any

**Request body:**
```json
{ "email": true, "inApp": true, "sms": false }
```

**Response 200:**
```json
{
  "data": { "preferences": { "email": true, "inApp": true, "sms": false } },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

---

### 🔴 DNS-04 — SLA Config CRUD (SysAdmin only)

#### `GET /admin/sla-config`

**Description:** Get all SLA priority configurations.  
**Auth:** Bearer token  
**Roles:** SA only

**Response 200:**
```json
{
  "data": {
    "slaConfig": [
      { "priority": "EMERGENCY", "responseMinutes": 30, "resolutionMinutes": 240 },
      { "priority": "HIGH", "responseMinutes": 120, "resolutionMinutes": 480 },
      { "priority": "MEDIUM", "responseMinutes": 480, "resolutionMinutes": 2880 },
      { "priority": "LOW", "responseMinutes": 1440, "resolutionMinutes": 10080 }
    ]
  },
  "error": null,
  "meta": {}
}
```

---

#### `PUT /admin/sla-config/{priority}`

**Description:** Update SLA thresholds for a priority level.  
**Auth:** Bearer token  
**Roles:** SA only

**Request body:**
```json
{ "responseMinutes": 60, "resolutionMinutes": 480 }
```

**Response 200:**
```json
{
  "data": { "slaConfig": { "priority": "EMERGENCY", "responseMinutes": 60, "resolutionMinutes": 480 } },
  "error": null,
  "meta": {}
}
```

---

### 🔴 DNS-05 — AI System Parameter Tuning (SysAdmin only)

#### `GET /admin/system-config`

**Description:** Get all AI confidence thresholds and system parameters.  
**Auth:** Bearer token  
**Roles:** SA only

**Response 200:**
```json
{
  "data": {
    "config": [
      { "key": "AI_TEXT_CONFIDENCE_THRESHOLD", "value": "0.60", "description": "Minimum confidence for Comprehend text classification" },
      { "key": "AI_EMERGENCY_VISUAL_THRESHOLD", "value": "0.70", "description": "Minimum confidence for Rekognition emergency detection" },
      { "key": "AI_TEXT_WEIGHT", "value": "0.40", "description": "Text classifier weight in arbitration" },
      { "key": "AI_VISUAL_WEIGHT", "value": "0.60", "description": "Visual classifier weight in arbitration" },
      { "key": "AI_ARBITRATION_HIGH_CONFIDENCE_GAP", "value": "0.20", "description": "Minimum gap to auto-resolve conflict" },
      { "key": "AI_SIMILARITY_DUPLICATE_THRESHOLD", "value": "0.85", "description": "TF-IDF cosine threshold for duplicate detection" },
      { "key": "AI_TICKET_PRIORITY_HIGH_THRESHOLD", "value": "0.70", "description": "Emergency keyword score for HIGH priority" },
      { "key": "AI_EMERGENCY_KEYWORD_WEIGHT", "value": "2.00", "description": "Weight multiplier for emergency keywords" },
      { "key": "AI_SENTIMENT_NEGATIVE_THRESHOLD", "value": "0.40", "description": "Sentiment below this flags negative tenant feedback" },
      { "key": "AI_AUTO_ASSIGN_CONFIDENCE", "value": "0.80", "description": "Minimum confidence to auto-assign tickets" },
      { "key": "AI_MULTI_MODAL_CONFLICT_THRESHOLD", "value": "0.15", "description": "Label probability gap triggering conflict" },
      { "key": "AI_RETENTION_DAYS", "value": "365", "description": "Inference log retention in days" }
    ]
  },
  "error": null,
  "meta": {}
}
```

---

#### `PUT /admin/system-config/{key}`

**Description:** Update a single system parameter.  
**Auth:** Bearer token  
**Roles:** SA only

**Request body:**
```json
{ "value": "0.75" }
```

Validation: value is cast to the appropriate numeric type per key.

**Response 200:**
```json
{
  "data": { "config": { "key": "AI_TEXT_CONFIDENCE_THRESHOLD", "value": "0.75", "updatedAt": "..." } },
  "error": null,
  "meta": {}
}
```

**Errors:** 404 (unknown key), 400 (invalid value range)

---

### 🔴 DNS-06 — security_audit_log Read (NFR-SEC09)

#### `GET /admin/security-audit-log`

**Description:** Read security audit log entries. INSERT-only (BR-004), read-only view.  
**Auth:** Bearer token  
**Roles:** SA only

**Query params:** `?severity=WARNING&eventType=LOGIN_FAILED&startDate=...&endDate=...&page=1&limit=50`

**Response 200:**
```json
{
  "data": {
    "entries": [
      { "id": "uuid", "userId": "uuid", "eventType": "LOGIN_FAILED", "details": "5 failed attempts for sarah@example.com", "ipAddress": "192.168.1.100", "severity": "WARNING", "createdAt": "..." }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 128, "totalPages": 3 }
  },
  "error": null,
  "meta": { "timestamp": "2026-07-10T12:00:00.000Z", "requestId": "uuid" }
}
```

---

## Route Summary

### SDD §4 endpoints (29)

| Module | Endpoint | Method | Public | Roles |
|--------|----------|--------|--------|-------|
| MOD-001 Auth | `/auth/register` | POST | ✅ | — |
| | `/auth/login` | POST | ✅ | — |
| | `/auth/refresh` | POST | — | — |
| | `/auth/logout` | POST | — | Any |
| | `/auth/verify-email` | POST | — | — |
| | `/auth/reset-password` | POST | — | — |
| MOD-002 Property | `/properties` | POST | — | SA, PM |
| | `/properties` | GET | — | Any |
| | `/properties/{id}/units` | POST | — | SA, PM |
| | `/properties/{id}/units/{unitId}/assign` | POST | — | SA, PM |
| MOD-003 Ticket | `/tickets` | POST | — | T, PM, SA |
| | `/tickets` | GET | — | Any (filtered) |
| | `/tickets/{id}` | GET | — | Any (filtered) |
| MOD-006 Routing | `/tickets/{id}/provider-recommendations` | GET | — | PM, SA |
| | `/tickets/{id}/assign` | POST | — | PM, SA |
| | `/tickets/{id}/accept` | PATCH | — | SP |
| | `/tickets/{id}/decline` | PATCH | — | SP |
| MOD-007 Lifecycle | `/tickets/{id}/status` | PATCH | — | PM, SP, SA |
| | `/tickets/{id}/reopen` | POST | — | T, PM, SA |
| | `/tickets/{id}/audit-trail` | GET | — | Any (filtered) |
| MOD-009 Ratings | `/tickets/{id}/rating` | POST | — | T |
| | `/providers/{id}/profile` | GET | — | Any |
| | `/providers/{id}/ratings` | GET | — | Any |
| MOD-010 Reports | `/reports/ticket-volume` | GET | — | PM, SA |
| | `/reports/resolution-time` | GET | — | PM, SA |
| | `/reports/sla-compliance` | GET | — | PM, SA |
| | `/reports/provider-performance` | GET | — | PM, SA |
| | `/reports/ai-performance` | GET | — | SA |
| File Access | `/tickets/{id}/attachments/{attachmentId}/url` | GET | — | Any (filtered) |

### Designed-Not-Specified endpoints (12)

| Tag | Endpoint | Method | Roles | REQ |
|-----|----------|--------|-------|-----|
| DNS-01 | `/users/pending` | GET | PM, SA | REQ-004, REQ-005 |
| DNS-01 | `/users/{id}/approve` | PATCH | PM, SA | REQ-004, REQ-005 |
| DNS-02 | `/users/{id}/deactivate` | PATCH | SA / self | REQ-008 |
| DNS-02 | `/users/{id}/reactivate` | PATCH | SA | REQ-008 |
| DNS-03 | `/users/me/notification-preferences` | GET | Any | REQ-045 |
| DNS-03 | `/users/me/notification-preferences` | PUT | Any | REQ-045 |
| DNS-04 | `/admin/sla-config` | GET | SA | sla_config |
| DNS-04 | `/admin/sla-config/{priority}` | PUT | SA | sla_config |
| DNS-05 | `/admin/system-config` | GET | SA | SDD §5 |
| DNS-05 | `/admin/system-config/{key}` | PUT | SA | SDD §5 |
| DNS-06 | `/admin/security-audit-log` | GET | SA | NFR-SEC09 |

**Total: 41 endpoints** (29 SDD §4 + 12 DNS gaps).
