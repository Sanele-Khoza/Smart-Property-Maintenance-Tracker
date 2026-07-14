# SPMT Database Design

## 1. Overview

PostgreSQL database for a property maintenance ticket management system. All tables are normalized to **3NF**.

**23 tables** across 6 logical groups:

1. **People & Roles** — users, technicians
2. **Property Hierarchy** — properties, units, leases
3. **Ticket System** — tickets, status_history, comments, categories, inference_logs
4. **Field Operations** — job_evidence, completion_reports, materials, availability_slots
5. **Communications** — notifications, messages, password_reset_tokens
6. **System** — system_settings, sla_config, ai_threshold_config, audit_logs, security_audit_logs, documents, ratings

---

## 2. Entity-Relationship Diagram (Text)

```
┌──────────────┐     ┌──────────────┐     ┌───────────────┐
│    users     │1──N│    units     │N──1│  properties   │
│              │     │              │     │               │
│ PK: id       │     │ PK: id       │     │ PK: id        │
│ UK: email    │     │ FK: prop_id  │     │               │
│              │     │ FK: occupant │     └───────────────┘
│ role: ENUM   │     │ status: ENUM │
│ account_st   │     └──────┬───────┘
└──────┬───────┘            │
       │                    │
       │1                  N│
       │  ┌─────────────────┴──────────────────┐
       │  │                                    │
       │  │            tickets                 │
       │  │  ┌───────────────────────────┐    │
       │  │  │  PK: id                   │    │
       └──│──│  FK: tenant_id (users)    │    │
          │  │  FK: property_id          │    │
          │  │  FK: unit_id              │    │
          │  │  FK: category_id          │    │
          │  │  FK: assigned_to_id       │    │
          │  │  status: ENUM (11 states) │    │
          │  │  priority: ENUM           │    │
          │  └───────────────────────────┘    │
          │            │                      │
          └────────────│──────────────────────┘
                       │
              ┌────────┼────────┬──────────────┐
              │        │        │              │
      ┌───────┴───┐ ┌──┴────┐ ┌─┴───────┐ ┌───┴───────┐
      │ticket_st_ │ │ticket_│ │ratings  │ │inference_ │
      │atus_hist  │ │comme  │ │         │ │logs       │
      │           │ │nts    │ │         │ │           │
      │FK: ticket │ │FK: tkt│ │FK: tick │ │FK: ticket │
      └───────────┘ └───────┘ └─────────┘ └───────────┘

┌──────────────┐   ┌───────────────┐   ┌────────────────┐
│  technicians │   │availability_  │   │   categories   │
│              │   │    slots      │   │                │
│ PK: id       │   │               │   │ PK: id         │
│ special: JSON│   │ PK: id        │   │ UK: name       │
│ status: ENUM │   │ FK: tech_id   │   └────────────────┘
└──────┬───────┘   └───────────────┘
       │
       └──────────────────────────────────┐
                                          │
          ┌────────────┬──────────────────┼──────────┐
          │            │                  │          │
   ┌──────┴───┐  ┌────┴────┐  ┌─────────┴────┐ ┌───┴──────┐
   │materials │  │job_evid │  │completion_   │ │messages  │
   │          │  │ence     │  │reports       │ │          │
   │FK:ticket │  │FK:ticket│  │FK: ticket    │ │FK:sender │
   │FK:provider│ │         │  │              │ │FK:receive│
   └──────────┘  └─────────┘  └──────────────┘ └──────────┘

┌──────────────┐  ┌───────────┐  ┌───────────────┐
│ notificati   │  │ documents │  │    leases     │
│ ons          │  │           │  │               │
│ FK: user_id  │  │FK: uploaded│ │FK: unit_id    │
│ read: bool   │  │           │  │FK: tenant_id  │
└──────────────┘  └───────────┘  └───────────────┘

┌────────────────┐  ┌────────────────┐  ┌────────────────────┐
│system_settings │  │  sla_config    │  │ai_threshold_config │
│                │  │                │  │                    │
│ UK: key        │  │ UK: priority   │  │ UK: key            │
└────────────────┘  └────────────────┘  └────────────────────┘

┌──────────────┐  ┌──────────────────┐  ┌───────────────────┐
│  audit_logs  │  │security_audit_   │  │password_reset_    │
│              │  │logs              │  │tokens             │
│              │  │                  │  │                   │
│              │  │ severity: ENUM   │  │ FK: user_id       │
└──────────────┘  └──────────────────┘  └───────────────────┘
```

---

## 3. Table Definitions

---

### 3.1 `users`

**Purpose:** Central identity table for all 4 roles. Stores auth credentials and account state.

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | `SERIAL` | `PK` | Unique identifier |
| `name` | `VARCHAR(100)` | `NOT NULL` | First name |
| `surname` | `VARCHAR(100)` | `NOT NULL` | Last name |
| `email` | `VARCHAR(255)` | `UNIQUE NOT NULL` | Login identifier |
| `phone` | `VARCHAR(20)` | — | Contact number |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | bcrypt hash |
| `role` | `VARCHAR(20)` | `NOT NULL DEFAULT 'TENANT'` | RBAC role |
| `account_status` | `VARCHAR(20)` | `DEFAULT 'PENDING'` | ACTIVE/DEACTIVATED/PENDING/SUSPENDED |
| `approved` | `BOOLEAN` | `DEFAULT FALSE` | Admin approval flag |
| `approved_at` | `TIMESTAMPTZ` | — | When approved |
| `last_login` | `TIMESTAMPTZ` | — | Last successful auth |
| `email_verification_token` | `VARCHAR(255)` | — | Token for email verification |
| `password_reset_token` | `VARCHAR(255)` | — | Token for password reset |
| `password_reset_expiry` | `TIMESTAMPTZ` | — | Reset token expiry |
| `login_attempts` | `INTEGER` | `DEFAULT 0` | Brute force tracking |
| `locked_until` | `TIMESTAMPTZ` | — | Account lockout |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Record created |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Record updated |

**Constraints:** `CHECK (role IN ('TENANT','PROPERTY_MANAGER','SERVICE_PROVIDER','SYSTEM_ADMIN'))`, `CHECK (account_status IN ('ACTIVE','DEACTIVATED','PENDING','SUSPENDED'))`

**Indexes:** `idx_users_email ON email`

---

### 3.2 `properties`

**Purpose:** Buildings or complexes being managed.

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | `SERIAL` | `PK` | Unique identifier |
| `name` | `VARCHAR(200)` | `NOT NULL` | Property name |
| `type` | `VARCHAR(20)` | `DEFAULT 'Residential'` | Residential/Commercial/Mixed-Use |
| `status` | `VARCHAR(30)` | `DEFAULT 'Active'` | Active/Inactive/Under Maintenance |
| `address` | `TEXT` | `NOT NULL` | Physical address |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

---

### 3.3 `units`

**Purpose:** Individual rentable spaces within a property. 3NF: depends on `properties`.

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | `SERIAL` | `PK` | |
| `property_id` | `INTEGER` | `FK → properties(id) ON DELETE CASCADE` | Parent property |
| `unit_number` | `VARCHAR(20)` | `NOT NULL` | E.g. "101", "A1" |
| `floor` | `VARCHAR(10)` | — | Floor level |
| `type` | `VARCHAR(30)` | `DEFAULT '1-Bed'` | Unit type |
| `status` | `VARCHAR(30)` | `DEFAULT 'Vacant'` | Vacant/Occupied/Under Maintenance |
| `bedrooms` | `INTEGER` | `DEFAULT 1` | Bedroom count |
| `bathrooms` | `INTEGER` | `DEFAULT 1` | Bathroom count |
| `size_sqm` | `REAL` | — | Size in square meters |
| `monthly_rent` | `REAL` | — | Rent amount |
| `occupant_id` | `INTEGER` | `FK → users(id) ON DELETE SET NULL` | Current tenant |
| `created_at` | `TIMESTAMPTZ` | | |
| `updated_at` | `TIMESTAMPTZ` | | |

**Indexes:** `idx_units_property (property_id)`, `idx_units_occupant (occupant_id)`, `idx_units_status (status)`

---

### 3.4 `leases`

**Purpose:** Rental agreements linking a tenant to a unit.

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | `SERIAL` | `PK` | |
| `unit_id` | `INTEGER` | `FK → units(id) ON DELETE CASCADE` | |
| `tenant_id` | `INTEGER` | `FK → users(id) ON DELETE SET NULL` | |
| `tenant_name` | `VARCHAR(200)` | — | Denormalized for history |
| `start_date` | `DATE` | `NOT NULL` | Lease start |
| `end_date` | `DATE` | — | Lease end |
| `rent_amount` | `FLOAT` | — | Agreed rent |
| `deposit` | `FLOAT` | — | Security deposit |
| `status` | `VARCHAR(20)` | `DEFAULT 'active'` | active/expired/terminated/renewed |
| `terms` | `TEXT` | — | Lease terms |
| `created_at` | `TIMESTAMPTZ` | | |

**Indexes:** `idx_leases_unit (unit_id)`, `idx_leases_tenant (tenant_id)`

---

### 3.5 `categories`

**Purpose:** Lookup table for ticket categories.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `SERIAL` | `PK` |
| `name` | `VARCHAR(100)` | `UNIQUE NOT NULL` |
| `icon` | `VARCHAR(10)` | `DEFAULT '🔧'` |
| `color` | `VARCHAR(10)` | `DEFAULT '#95a5a6'` |
| `created_at` | `TIMESTAMPTZ` | |

---

### 3.6 `technicians`

**Purpose:** Service providers who perform maintenance work. Separate from `users` because a technician may not have a login account, and has different attributes (company name, specialisations, GPS location).

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | `SERIAL` | `PK` | |
| `name` | `VARCHAR(200)` | `NOT NULL` | |
| `company_name` | `VARCHAR(200)` | — | |
| `email` | `VARCHAR(255)` | — | |
| `phone` | `VARCHAR(20)` | — | |
| `specialisations` | `JSONB` | `DEFAULT '[]'` | Array of skill categories |
| `rating` | `FLOAT` | `DEFAULT 0` | Average rating |
| `current_workload` | `INTEGER` | `DEFAULT 0` | Active jobs count |
| `total_jobs_completed` | `INTEGER` | `DEFAULT 0` | Lifetime jobs |
| `availability_status` | `VARCHAR(20)` | `DEFAULT 'AVAILABLE'` | AVAILABLE/ON_CALL/OFF_DUTY/SUSPENDED |
| `gps_latitude` | `FLOAT` | — | Real-time GPS |
| `gps_longitude` | `FLOAT` | — | |
| `last_location_update` | `TIMESTAMPTZ` | — | |
| `created_at` / `updated_at` | | | |

**Indexes:** `idx_technicians_status (availability_status)`

---

### 3.7 `availability_slots`

**Purpose:** Weekly schedule for each technician. 3NF: depends on `technicians`.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `SERIAL` | `PK` |
| `technician_id` | `INTEGER` | `FK → technicians(id) ON DELETE CASCADE` |
| `day_of_week` | `INTEGER` | `NOT NULL` (0=Mon, 6=Sun) |
| `start_time` | `VARCHAR(5)` | `NOT NULL` (HH:MM) |
| `end_time` | `VARCHAR(5)` | `NOT NULL` (HH:MM) |

**Index:** `idx_avail_tech (technician_id)`

---

### 3.8 `tickets`

**Purpose:** Core business table — maintenance requests. Central junction point for users, properties, units, categories, and technicians.

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | `SERIAL` | `PK` | |
| `property_id` | `INTEGER` | `FK → properties(id) ON DELETE SET NULL` | |
| `unit_id` | `INTEGER` | `FK → units(id) ON DELETE SET NULL` | |
| `tenant_id` | `INTEGER` | `FK → users(id) ON DELETE SET NULL` | Reporter |
| `category_id` | `INTEGER` | `FK → categories(id) ON DELETE SET NULL` | |
| `category_name` | `VARCHAR(100)` | — | Denormalized | 
| `category_icon` | `VARCHAR(10)` | — | Denormalized |
| `category_color` | `VARCHAR(10)` | — | Denormalized |
| `assigned_to_id` | `INTEGER` | `FK → technicians(id) ON DELETE SET NULL` | |
| `assigned_to_name` | `VARCHAR(200)` | — | Denormalized |
| `title` | `VARCHAR(300)` | `NOT NULL` | |
| `description` | `TEXT` | `NOT NULL` | |
| `priority` | `VARCHAR(10)` | `DEFAULT 'MEDIUM'` | LOW/MEDIUM/HIGH/EMERGENCY |
| `status` | `VARCHAR(30)` | `DEFAULT 'Open'` | 11-state machine |
| `source` | `VARCHAR(20)` | `DEFAULT 'tenant_portal'` | How it was created |
| `tenant_rating` | `INTEGER` | — | 1-5 rating |
| `sla_breached` | `BOOLEAN` | `DEFAULT FALSE` | SLA violation flag |
| `ai_classification` | `JSONB` | — | ML classification results |
| `conflict_detected` | `BOOLEAN` | `DEFAULT FALSE` | Duplicate detection |
| `manual_review_required` | `BOOLEAN` | `DEFAULT FALSE` | AI flag |
| `due_date` | `TIMESTAMPTZ` | — | SLA deadline |
| `created_by_date` | `TIMESTAMPTZ` | `DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | | |

**Why denormalized category_name/icon/color:** Avoids JOINs on every ticket list query. Category changes are rare.

**Indexes:** `idx_tickets_status`, `idx_tickets_priority`, `idx_tickets_tenant`, `idx_tickets_assigned`, `idx_tickets_property`, `idx_tickets_unit`, `idx_tickets_date`

**Check constraints:** `CHECK (priority IN ('LOW','MEDIUM','HIGH','EMERGENCY'))`, `CHECK (source IN ('tenant_portal','email','phone','system','in_person'))`

---

### 3.9 `ticket_status_history`

**Purpose:** Audit trail for every state change in a ticket's lifecycle. Enables the 11-state machine to be audited.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `SERIAL` | `PK` |
| `ticket_id` | `INTEGER` | `FK → tickets(id) ON DELETE CASCADE` |
| `status` | `VARCHAR(30)` | `NOT NULL` |
| `changed_by` | `INTEGER` | `FK → users(id) ON DELETE SET NULL` |
| `changed_by_name` | `VARCHAR(200)` | — |
| `reason` | `TEXT` | — |
| `created_at` | `TIMESTAMPTZ` | |

**Index:** `idx_ticket_history (ticket_id)`

---

### 3.10 `ticket_comments`

**Purpose:** Free-form comments on tickets from any user role.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `SERIAL` | `PK` |
| `ticket_id` | `INTEGER` | `FK → tickets(id) ON DELETE CASCADE` |
| `user_id` | `INTEGER` | `FK → users(id) ON DELETE SET NULL` |
| `comment` | `TEXT` | `NOT NULL` |
| `created_at` | `TIMESTAMPTZ` | |

**Index:** `idx_ticket_comments (ticket_id)`

---

### 3.11 `materials`

**Purpose:** Materials used during maintenance, tracked per ticket.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `SERIAL` | `PK` |
| `ticket_id` | `INTEGER` | `FK → tickets(id) ON DELETE SET NULL` |
| `name` | `VARCHAR(200)` | `NOT NULL` |
| `quantity` | `FLOAT` | `DEFAULT 1` |
| `unit_cost` | `FLOAT` | — |
| `provided_by` | `INTEGER` | `FK → users(id) ON DELETE SET NULL` |
| `created_by` | `INTEGER` | `FK → users(id) ON DELETE SET NULL` |
| `created_at` | | |

**Index:** `idx_materials_ticket (ticket_id)`

---

### 3.12 `job_evidence`

**Purpose:** Photos/files uploaded by technicians as proof of completed work.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `SERIAL` | `PK` |
| `ticket_id` | `INTEGER` | `FK → tickets(id) ON DELETE CASCADE` |
| `provider_name` | `VARCHAR(200)` | — |
| `file_url` | `TEXT` | `NOT NULL` |
| `type` | `VARCHAR(10)` | `DEFAULT 'image'` |
| `description` | `TEXT` | — |
| `uploaded_at` | | |

**Index:** `idx_job_evidence_ticket (ticket_id)`

---

### 3.13 `completion_reports`

**Purpose:** Detailed report filed by technician when marking a job done.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `SERIAL` | `PK` |
| `ticket_id` | `INTEGER` | `FK → tickets(id) ON DELETE CASCADE` |
| `provider_name` | `VARCHAR(200)` | — |
| `description` | `TEXT` | `NOT NULL` |
| `materials_used` | `TEXT` | — |
| `hours_worked` | `FLOAT` | — |
| `notes` | `TEXT` | — |
| `completed_at` | | |

---

### 3.14 `notifications`

**Purpose:** System-generated messages for users. Supports both user-scoped and email-based delivery.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `SERIAL` | `PK` |
| `recipient` | `VARCHAR(255)` | — (email address) |
| `user_id` | `INTEGER` | `FK → users(id) ON DELETE CASCADE` |
| `type` | `VARCHAR(10)` | `DEFAULT 'info'` |
| `message` | `TEXT` | `NOT NULL` |
| `is_emergency` | `BOOLEAN` | `DEFAULT FALSE` |
| `delivery_status` | `VARCHAR(10)` | `DEFAULT 'Pending'` |
| `read` | `BOOLEAN` | `DEFAULT FALSE` |
| `created_at` | | |

**Indexes:** `idx_notif_user (user_id)`, `idx_notif_recipient (recipient)`, `idx_notif_read (read)`

---

### 3.15 `messages`

**Purpose:** User-to-user internal messaging system.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `SERIAL` | `PK` |
| `sender_id` | `INTEGER` | `FK → users(id) ON DELETE CASCADE` |
| `receiver_id` | `INTEGER` | `FK → users(id) ON DELETE CASCADE` |
| `subject` | `VARCHAR(300)` | `NOT NULL` |
| `body` | `TEXT` | `NOT NULL` |
| `category` | `VARCHAR(50)` | `DEFAULT 'general'` |
| `read` | `BOOLEAN` | `DEFAULT FALSE` |
| `created_at` | | |

**Indexes:** `idx_messages_sender`, `idx_messages_receiver`, `idx_messages_read`

---

### 3.16 `documents`

**Purpose:** File uploads (leases, photos, contracts).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `SERIAL` | `PK` |
| `name` | `VARCHAR(255)` | `NOT NULL` |
| `type` | `VARCHAR(50)` | `NOT NULL` (MIME type) |
| `file_path` | `TEXT` | — (filesystem path) |
| `file_url` | `TEXT` | — (URL) |
| `uploaded_by` | `INTEGER` | `FK → users(id) ON DELETE SET NULL` |
| `description` | `TEXT` | — |
| `uploaded_at` | | |

**Index:** `idx_docs_uploader (uploaded_by)`

---

### 3.17 `ratings`

**Purpose:** Ticket satisfaction ratings from tenants.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `SERIAL` | `PK` |
| `ticket_id` | `INTEGER` | `FK → tickets(id) ON DELETE CASCADE` |
| `rated_by` | `INTEGER` | `FK → users(id) ON DELETE SET NULL` |
| `rating_value` | `INTEGER` | `NOT NULL` (1-5) |
| `comment` | `TEXT` | — |
| `created_at` | | |

**Indexes:** `idx_ratings_ticket`, `idx_ratings_user`

---

### 3.18 `inference_logs`

**Purpose:** AI/ML classification logs for audit and model improvement.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `SERIAL` | `PK` |
| `ticket_id` | `INTEGER` | `FK → tickets(id) ON DELETE CASCADE` |
| `service` | `VARCHAR(20)` | `NOT NULL` (e.g. 'duplicate', 'priority') |
| `type` | `VARCHAR(10)` | `NOT NULL` (e.g. 'ml', 'rule') |
| `result` | `TEXT` | — |
| `confidence` | `FLOAT` | — |
| `conflict_detected` | `BOOLEAN` | `DEFAULT FALSE` |
| `created_at` | | |

**Index:** `idx_inference_ticket`

---

### 3.19-21 Configuration Tables

#### `system_settings`

Key-value store for application configuration. `UNIQUE (key)`.

| Column | Type |
|--------|------|
| `id` | `SERIAL PK` |
| `key` | `VARCHAR(100) UNIQUE NOT NULL` |
| `value` | `TEXT NOT NULL` |
| `type` | `VARCHAR(10) DEFAULT 'string'` |

#### `sla_config`

SLA time limits per priority level. `UNIQUE (priority)`.

| Column | Type |
|--------|------|
| `id` | `SERIAL PK` |
| `priority` | `VARCHAR(10) UNIQUE NOT NULL` |
| `response_minutes` | `INTEGER NOT NULL` |
| `resolution_minutes` | `INTEGER NOT NULL` |

#### `ai_threshold_config`

AI confidence thresholds. `UNIQUE (key)`.

| Column | Type |
|--------|------|
| `id` | `SERIAL PK` |
| `key` | `VARCHAR(100) UNIQUE NOT NULL` |
| `value` | `TEXT NOT NULL` |
| `description` | `TEXT` |

---

### 3.22-23 Audit Tables

#### `audit_logs`

**Purpose:** Application-level audit trail for tracking who did what.

| Column | Type |
|--------|------|
| `id` | `SERIAL PK` |
| `action` | `VARCHAR(255) NOT NULL` |
| `user_id` | `INTEGER` |
| `user_name` | `VARCHAR(200)` |
| `details` | `TEXT` |
| `timestamp` | `TIMESTAMPTZ DEFAULT NOW()` |

**Indexes:** `idx_audit_user`, `idx_audit_action`, `idx_audit_time`

#### `security_audit_logs`

**Purpose:** Security events (login attempts, permission changes, lockouts).

| Column | Type |
|--------|------|
| `id` | `SERIAL PK` |
| `event_type` | `VARCHAR(255) NOT NULL` |
| `user_id` | `INTEGER` |
| `details` | `TEXT` |
| `ip_address` | `VARCHAR(45)` |
| `severity` | `VARCHAR(10) DEFAULT 'INFO'` |
| `timestamp` | `TIMESTAMPTZ DEFAULT NOW()` |

**Indexes:** `idx_sec_audit_severity`, `idx_sec_audit_time`

---

### 3.24 `password_reset_tokens`

**Purpose:** Separate table for password reset tokens (avoids locking users table).

| Column | Type |
|--------|------|
| `id` | `SERIAL PK` |
| `user_id` | `INTEGER FK → users(id) ON DELETE CASCADE` |
| `token` | `VARCHAR(255) NOT NULL` |
| `expires_at` | `TIMESTAMPTZ NOT NULL` |
| `used` | `BOOLEAN DEFAULT FALSE` |
| `created_at` | |

**Indexes:** `idx_pwreset_user`, `idx_pwreset_token`

---

## 4. Normalization Analysis (3NF)

### 1NF (Atomic Values)
- All columns are atomic (no multi-valued attributes in non-JSONB columns)
- JSONB in `technicians.specialisations` and `tickets.ai_classification` is intentionally denormalized for flexibility

### 2NF (Full Functional Dependency)
- Every non-key column depends on the whole primary key
- No partial dependencies — all tables use single-column `SERIAL` PKs

### 3NF (No Transitive Dependencies)
- Leases: `tenant_name` is intentionally denormalized (transitively depends on `tenant_id`) — justified as historical snapshot
- Tickets: `category_name/icon/color` and `assigned_to_name` are intentionally denormalized to avoid JOINs on high-frequency reads

---

## 5. Constraint Summary

| Type | Count | Examples |
|------|-------|---------|
| Primary Keys | 24 | All tables have `SERIAL PK` |
| Foreign Keys | 25+ | Every FK has a cascading rule |
| Unique Constraints | 5 | `users.email`, `categories.name`, `system_settings.key`, `sla_config.priority`, `ai_threshold_config.key` |
| Check Constraints | 4 | Role enum, account_status enum, priority enum, source enum |
| NOT NULL | 30+ | Critical business fields |
| Default Values | 15+ | Status defaults, timestamps, booleans |

---

## 6. Cascading Rules

| Parent → Child | Rule | Rationale |
|----------------|------|-----------|
| `properties → units` | `CASCADE` | Delete property removes units |
| `units → tickets` | `SET NULL` | Unit deletion keeps ticket history |
| `users → tickets` | `SET NULL` | User deletion keeps ticket history |
| `technicians → tickets` | `SET NULL` | Technician deletion keeps ticket history |
| `tickets → status_history` | `CASCADE` | Ticket deletion removes its history |
| `tickets → comments` | `CASCADE` | Ticket deletion removes its comments |
| `tickets → ratings` | `CASCADE` | Ticket deletion removes ratings |
| `users → notifications` | `CASCADE` | User deletion removes notifications |
| `technicians → availability_slots` | `CASCADE` | Technician deletion removes schedule |
| `users → documents` | `SET NULL` | Orphan documents remain |
| `properties → units → leases` | `CASCADE` | Unit deletion cascades to leases |

---

## 7. Indexing Strategy

**High-cardinality columns (PKs, emails):** Unique B-tree indexes (default)

**Low-cardinality filter columns:** B-tree indexes on `status`, `priority`, `account_status`, `availability_status`, `read`, `severity`

**Foreign key columns:** Indexed on all FK columns for JOIN performance

**Temporal columns:** Indexed on `created_by_date`, `timestamp`, `created_at` for time-range queries

**Composite indexes:** None needed — all queries use single-column filters or OR conditions

**JSONB:** No GIN index on `specialisations` because queries use `@>` containment on small arrays (< 50 rows/technician)

---

## 8. Total Index Count: **30**

`idx_units_property`, `idx_units_occupant`, `idx_units_status`, `idx_technicians_status`, `idx_avail_tech`, `idx_tickets_status`, `idx_tickets_priority`, `idx_tickets_tenant`, `idx_tickets_assigned`, `idx_tickets_property`, `idx_tickets_unit`, `idx_tickets_date`, `idx_ticket_history`, `idx_ticket_comments`, `idx_materials_ticket`, `idx_notif_user`, `idx_notif_recipient`, `idx_notif_read`, `idx_ratings_ticket`, `idx_ratings_user`, `idx_docs_uploader`, `idx_leases_unit`, `idx_leases_tenant`, `idx_messages_sender`, `idx_messages_receiver`, `idx_messages_read`, `idx_audit_user`, `idx_audit_action`, `idx_audit_time`, `idx_sec_audit_severity`, `idx_sec_audit_time`, `idx_inference_ticket`, `idx_pwreset_user`, `idx_pwreset_token`
