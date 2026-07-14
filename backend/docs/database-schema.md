# SPMT Database Schema

> Generated from migration files 001–013 (24 tables)

---

## 1. Table Relationships

### Legend
| Symbol | Meaning |
|--------|---------|
| PK | Primary Key |
| FK | Foreign Key |
| CASCADE | Parent delete cascades to child |
| SET NULL | Parent delete sets child FK to NULL |

### Foreign Key Relationships

| # | Parent Table | Child Table | Column | Rule |
|---|-------------|-------------|--------|------|
| 1 | properties | units | units.property_id | ON DELETE CASCADE |
| 2 | users | units | units.occupant_id | ON DELETE SET NULL |
| 3 | technicians | availability_slots | availability_slots.technician_id | ON DELETE CASCADE |
| 4 | properties | tickets | tickets.property_id | ON DELETE SET NULL |
| 5 | units | tickets | tickets.unit_id | ON DELETE SET NULL |
| 6 | users | tickets | tickets.tenant_id | ON DELETE SET NULL |
| 7 | categories | tickets | tickets.category_id | ON DELETE SET NULL |
| 8 | technicians | tickets | tickets.assigned_to_id | ON DELETE SET NULL |
| 9 | tickets | ticket_status_history | ticket_status_history.ticket_id | ON DELETE CASCADE |
| 10 | users | ticket_status_history | ticket_status_history.changed_by | ON DELETE SET NULL |
| 11 | tickets | ticket_comments | ticket_comments.ticket_id | ON DELETE CASCADE |
| 12 | users | ticket_comments | ticket_comments.user_id | ON DELETE SET NULL |
| 13 | tickets | materials | materials.ticket_id | ON DELETE SET NULL |
| 14 | users | materials | materials.provided_by | ON DELETE SET NULL |
| 15 | users | materials | materials.created_by | ON DELETE SET NULL |
| 16 | tickets | job_evidence | job_evidence.ticket_id | ON DELETE CASCADE |
| 17 | tickets | completion_reports | completion_reports.ticket_id | ON DELETE CASCADE |
| 18 | users | notifications | notifications.user_id | ON DELETE CASCADE |
| 19 | tickets | ratings | ratings.ticket_id | ON DELETE CASCADE |
| 20 | users | ratings | ratings.rated_by | ON DELETE SET NULL |
| 21 | users | documents | documents.uploaded_by | ON DELETE SET NULL |
| 22 | units | leases | leases.unit_id | ON DELETE CASCADE |
| 23 | users | leases | leases.tenant_id | ON DELETE SET NULL |
| 24 | users | messages | messages.sender_id | ON DELETE CASCADE |
| 25 | users | messages | messages.receiver_id | ON DELETE CASCADE |
| 26 | users | password_reset_tokens | password_reset_tokens.user_id | ON DELETE CASCADE |
| 27 | tickets | inference_logs | inference_logs.ticket_id | ON DELETE CASCADE |

### Relationship Diagram (textual)

```
users ──┬── units (occupant_id) SET NULL
        ├── tickets (tenant_id) SET NULL
        ├── ticket_status_history (changed_by) SET NULL
        ├── ticket_comments (user_id) SET NULL
        ├── materials (provided_by) SET NULL
        ├── materials (created_by) SET NULL
        ├── notifications (user_id) CASCADE
        ├── ratings (rated_by) SET NULL
        ├── documents (uploaded_by) SET NULL
        ├── leases (tenant_id) SET NULL
        ├── messages (sender_id) CASCADE
        ├── messages (receiver_id) CASCADE
        └── password_reset_tokens (user_id) CASCADE

properties ─┬── units (property_id) CASCADE
            └── tickets (property_id) SET NULL

units ──┬── tickets (unit_id) SET NULL
        └── leases (unit_id) CASCADE

categories ── tickets (category_id) SET NULL

technicians ─┬── availability_slots (technician_id) CASCADE
             └── tickets (assigned_to_id) SET NULL

tickets ──┬── ticket_status_history (ticket_id) CASCADE
          ├── ticket_comments (ticket_id) CASCADE
          ├── materials (ticket_id) SET NULL
          ├── job_evidence (ticket_id) CASCADE
          ├── completion_reports (ticket_id) CASCADE
          ├── ratings (ticket_id) CASCADE
          └── inference_logs (ticket_id) CASCADE
```

---

## 2. Data Dictionary

### 2.1 `users`

**Purpose:** Stores all system users — tenants, property managers, system admins, and service providers. Acts as the central identity table.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| name | VARCHAR(100) | NOT NULL | User's first name |
| surname | VARCHAR(100) | NOT NULL | User's last name / surname |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Email address (used for login and communication) |
| phone | VARCHAR(20) | | Phone number |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hash of the user's password |
| role | VARCHAR(20) | NOT NULL, DEFAULT 'TENANT' | User role: `SYSTEM_ADMIN`, `PROPERTY_MANAGER`, `TENANT`, `SERVICE_PROVIDER` |
| account_status | VARCHAR(20) | NOT NULL, DEFAULT 'PENDING' | Account lifecycle status: `PENDING`, `ACTIVE`, `SUSPENDED` |
| approved | BOOLEAN | DEFAULT FALSE | Whether the user account has been approved by an admin |
| approved_at | TIMESTAMPTZ | | Timestamp when the account was approved |
| last_login | TIMESTAMPTZ | | Timestamp of the user's most recent login |
| email_verification_token | VARCHAR(255) | | Token used for email address verification |
| password_reset_token | VARCHAR(255) | | Token used for password reset flow |
| password_reset_expiry | TIMESTAMPTZ | | Expiration timestamp for the password reset token |
| login_attempts | INTEGER | DEFAULT 0 | Consecutive failed login attempt counter |
| locked_until | TIMESTAMPTZ | | Timestamp until which the account is locked due to failed attempts |
| age | INTEGER | | User's age (optional, for demographic data) |
| id_number | VARCHAR(20) | | South African ID number (optional) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record last-updated timestamp |

---

### 2.2 `properties`

**Purpose:** Represents buildings or estates managed within the system. Each property can contain multiple units.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| name | VARCHAR(200) | NOT NULL | Property name (e.g. "Sunset Towers") |
| type | VARCHAR(20) | NOT NULL, DEFAULT 'Residential' | Property type: `Residential`, `Commercial`, `MixedUse` |
| status | VARCHAR(30) | NOT NULL, DEFAULT 'Active' | Operational status: `Active`, `Inactive` |
| address | TEXT | NOT NULL | Physical street address |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record last-updated timestamp |

---

### 2.3 `units`

**Purpose:** Individual dwelling or commercial spaces within a property. Links a property to its tenant occupants.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| property_id | INTEGER | FK → properties(id) ON DELETE CASCADE, NOT NULL | Parent property this unit belongs to |
| unit_number | VARCHAR(20) | NOT NULL | Unit, apartment, or suite number (e.g. "101") |
| floor | VARCHAR(10) | | Floor level (e.g. "1", "2", "Ground") |
| type | VARCHAR(30) | DEFAULT '1-Bed' | Unit classification: `Studio`, `1-Bed`, `2-Bed`, `3-Bed`, `Office` |
| status | VARCHAR(30) | NOT NULL, DEFAULT 'Vacant' | Occupancy status: `Vacant`, `Occupied` |
| bedrooms | INTEGER | DEFAULT 1 | Number of bedrooms |
| bathrooms | INTEGER | DEFAULT 1 | Number of bathrooms |
| size_sqm | REAL | | Total floor area in square metres |
| monthly_rent | REAL | | Monthly rent amount for the unit |
| square_meters | REAL | | Alternative size field (same purpose as size_sqm) |
| occupant_id | INTEGER | FK → users(id) ON DELETE SET NULL | Current tenant occupying the unit (nullable if vacant) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record last-updated timestamp |

---

### 2.4 `leases`

**Purpose:** Records rental agreements between tenants and property management for specific units.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| unit_id | INTEGER | FK → units(id) ON DELETE CASCADE | The unit under lease |
| tenant_id | INTEGER | FK → users(id) ON DELETE SET NULL | The tenant on the lease |
| tenant_name | VARCHAR(200) | | Denormalised tenant full name for quick display |
| start_date | DATE | NOT NULL | Lease commencement date |
| end_date | DATE | | Lease expiry / termination date |
| rent_amount | FLOAT | | Agreed monthly rental amount |
| deposit | FLOAT | | Security deposit paid |
| status | VARCHAR(20) | DEFAULT 'active' | Lease state: `active`, `expired`, `terminated` |
| terms | TEXT | | Full text of lease terms and conditions |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |

---

### 2.5 `categories`

**Purpose:** Defines maintenance issue categories (Plumbing, Electrical, etc.) used to classify tickets.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| name | VARCHAR(100) | UNIQUE, NOT NULL | Category display name (e.g. "Plumbing", "Electrical") |
| icon | VARCHAR(10) | DEFAULT '🔧' | Emoji icon for UI display |
| color | VARCHAR(10) | DEFAULT '#95a5a6' | Hex colour code for UI colour-coding |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |

---

### 2.6 `technicians`

**Purpose:** Stores service provider / technician profiles, including skills, workload, rating, and GPS location.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| name | VARCHAR(200) | NOT NULL | Technician's full name or business name |
| company_name | VARCHAR(200) | | Company the technician works for |
| email | VARCHAR(255) | | Email address |
| phone | VARCHAR(20) | | Phone number |
| specialisations | JSONB | DEFAULT '[]' | Array of specialisation category names (e.g. `["Plumbing", "Electrical"]`) |
| rating | FLOAT | DEFAULT 0 | Average rating score (0–5) |
| current_workload | INTEGER | DEFAULT 0 | Number of currently active/assigned jobs |
| total_jobs_completed | INTEGER | DEFAULT 0 | Lifetime count of completed jobs |
| availability_status | VARCHAR(20) | DEFAULT 'AVAILABLE' | Current availability: `AVAILABLE`, `ON_CALL`, `OFF_DUTY` |
| gps_latitude | FLOAT | | Current GPS latitude coordinate |
| gps_longitude | FLOAT | | Current GPS longitude coordinate |
| last_location_update | TIMESTAMPTZ | | Timestamp of the last GPS location ping |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record last-updated timestamp |

---

### 2.7 `availability_slots`

**Purpose:** Defines recurring weekly availability windows for technicians (e.g. Monday 08:00–17:00).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| technician_id | INTEGER | FK → technicians(id) ON DELETE CASCADE, NOT NULL | The technician this slot belongs to |
| day_of_week | INTEGER | NOT NULL | Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday) |
| start_time | VARCHAR(5) | NOT NULL | Start time in HH:MM format (e.g. "08:00") |
| end_time | VARCHAR(5) | NOT NULL | End time in HH:MM format (e.g. "17:00") |

---

### 2.8 `tickets`

**Purpose:** Core maintenance request entity — tracks every issue from submission through to resolution, including AI classification data and SLA status.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| property_id | INTEGER | FK → properties(id) ON DELETE SET NULL | Property where the issue occurred |
| unit_id | INTEGER | FK → units(id) ON DELETE SET NULL | Unit where the issue occurred |
| tenant_id | INTEGER | FK → users(id) ON DELETE SET NULL | Tenant who reported the issue |
| category_id | INTEGER | FK → categories(id) ON DELETE SET NULL | Issue category |
| category_name | VARCHAR(100) | | Denormalised category name (preserved even if category deleted) |
| category_icon | VARCHAR(10) | | Denormalised category icon |
| category_color | VARCHAR(10) | | Denormalised category colour |
| assigned_to_id | INTEGER | FK → technicians(id) ON DELETE SET NULL | Technician assigned to the ticket |
| assigned_to_name | VARCHAR(200) | | Denormalised technician name |
| title | VARCHAR(300) | NOT NULL | Short summary / title of the issue |
| description | TEXT | NOT NULL | Detailed description of the maintenance issue |
| priority | VARCHAR(10) | NOT NULL, DEFAULT 'MEDIUM' | Priority level: `LOW`, `MEDIUM`, `HIGH`, `EMERGENCY` |
| status | VARCHAR(30) | NOT NULL, DEFAULT 'Open' | Ticket workflow status: `Open`, `Assigned`, `In Progress`, `Completed`, `Cancelled` |
| source | VARCHAR(20) | DEFAULT 'tenant_portal' | Submission channel: `tenant_portal`, `phone`, `email`, `system` |
| tenant_rating | INTEGER | | Rating submitted by the tenant (1–5) after completion |
| sla_breached | BOOLEAN | DEFAULT FALSE | Whether the SLA deadline was missed |
| ai_classification | JSONB | | AI-generated classification metadata (category, priority, sentiment) |
| conflict_detected | BOOLEAN | DEFAULT FALSE | Whether a scheduling conflict was detected for this ticket |
| manual_review_required | BOOLEAN | DEFAULT FALSE | Flag indicating the ticket requires human review |
| due_date | TIMESTAMPTZ | | SLA-calculated deadline timestamp |
| created_by_date | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Timestamp when the ticket was created |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record last-updated timestamp |

---

### 2.9 `ticket_status_history`

**Purpose:** Audit trail of every status change on a ticket, capturing who changed it and why.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| ticket_id | INTEGER | FK → tickets(id) ON DELETE CASCADE, NOT NULL | The ticket whose status changed |
| status | VARCHAR(30) | NOT NULL | The new status value |
| changed_by | INTEGER | FK → users(id) ON DELETE SET NULL | The user who performed the status change |
| changed_by_name | VARCHAR(200) | | Denormalised name of the user who changed it |
| reason | TEXT | | Optional reason or note for the status change |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |

---

### 2.10 `ticket_comments`

**Purpose:** Stores user comments/discussion threads attached to tickets.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| ticket_id | INTEGER | FK → tickets(id) ON DELETE CASCADE, NOT NULL | Parent ticket |
| user_id | INTEGER | FK → users(id) ON DELETE SET NULL | Author of the comment |
| comment | TEXT | NOT NULL | Comment body text |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |

---

### 2.11 `materials`

**Purpose:** Logs materials used during maintenance work, including quantities and costs, linked to tickets.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| ticket_id | INTEGER | FK → tickets(id) ON DELETE SET NULL | Ticket this material was used for |
| name | VARCHAR(200) | NOT NULL | Material name or description |
| quantity | FLOAT | DEFAULT 1 | Quantity of material used |
| unit_cost | FLOAT | | Cost per unit of material |
| provided_by | INTEGER | FK → users(id) ON DELETE SET NULL | User who supplied/provided the material |
| created_by | INTEGER | FK → users(id) ON DELETE SET NULL | User who logged the material entry |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |

---

### 2.12 `job_evidence`

**Purpose:** Stores photos, videos, or documents uploaded as evidence of completed maintenance work.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| ticket_id | INTEGER | FK → tickets(id) ON DELETE CASCADE, NOT NULL | Associated ticket |
| provider_name | VARCHAR(200) | | Name of the technician/provider who uploaded the evidence |
| file_url | TEXT | NOT NULL | URL or path to the evidence file |
| type | VARCHAR(10) | DEFAULT 'image' | File type: `image`, `video`, `document` |
| description | TEXT | | Optional description of the evidence |
| uploaded_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Upload timestamp |

---

### 2.13 `completion_reports`

**Purpose:** Stores detailed job completion summaries written by technicians after finishing maintenance work.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| ticket_id | INTEGER | FK → tickets(id) ON DELETE CASCADE, NOT NULL | Associated ticket |
| provider_name | VARCHAR(200) | | Name of the technician/provider |
| description | TEXT | NOT NULL | Summary of work completed |
| materials_used | TEXT | | Free-text list of materials used |
| hours_worked | FLOAT | | Total hours spent on the job |
| notes | TEXT | | Additional notes or observations |
| completed_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Completion timestamp |

---

### 2.14 `notifications`

**Purpose:** Stores in-app and email notifications sent to users — supports info, warning, and emergency alerts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| recipient | VARCHAR(255) | | Recipient email address or identifier |
| user_id | INTEGER | FK → users(id) ON DELETE CASCADE | Target user the notification is for |
| type | VARCHAR(10) | NOT NULL, DEFAULT 'info' | Notification type: `info`, `warning`, `alert` |
| message | TEXT | NOT NULL | Notification body text |
| is_emergency | BOOLEAN | DEFAULT FALSE | Flag for emergency notifications |
| delivery_status | VARCHAR(10) | DEFAULT 'Pending' | Delivery status: `Pending`, `Sent`, `Failed` |
| read | BOOLEAN | DEFAULT FALSE | Whether the notification has been read by the user |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |

---

### 2.15 `ratings`

**Purpose:** Collects tenant satisfaction ratings and comments after a ticket is completed.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| ticket_id | INTEGER | FK → tickets(id) ON DELETE CASCADE | The ticket being rated |
| rated_by | INTEGER | FK → users(id) ON DELETE SET NULL | The user (tenant) who submitted the rating |
| rating_value | INTEGER | NOT NULL | Rating score (typically 1–5) |
| comment | TEXT | | Optional written feedback |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |

---

### 2.16 `documents`

**Purpose:** Generic document store for leases, invoices, reports, and other file attachments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| name | VARCHAR(255) | NOT NULL | File name or document title |
| type | VARCHAR(50) | NOT NULL | Document type classification (e.g. `lease`, `invoice`, `report`) |
| file_path | TEXT | | Local file system path to the document |
| file_url | TEXT | | Remote/cloud URL to the document |
| uploaded_by | INTEGER | FK → users(id) ON DELETE SET NULL | User who uploaded the document |
| description | TEXT | | Optional description of the document |
| uploaded_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Upload timestamp |

---

### 2.17 `messages`

**Purpose:** Internal messaging system between users (e.g. tenant-to-manager, manager-to-technician).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| sender_id | INTEGER | FK → users(id) ON DELETE CASCADE, NOT NULL | Message sender |
| receiver_id | INTEGER | FK → users(id) ON DELETE CASCADE, NOT NULL | Message recipient |
| subject | VARCHAR(300) | NOT NULL | Message subject line |
| body | TEXT | NOT NULL | Message body content |
| category | VARCHAR(50) | DEFAULT 'general' | Message category (e.g. `general`, `maintenance`, `billing`) |
| read | BOOLEAN | DEFAULT FALSE | Whether the message has been read |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |

---

### 2.18 `inference_logs`

**Purpose:** Logs AI model inference results (classification, priority prediction, scheduling) for auditing and debugging.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| ticket_id | INTEGER | FK → tickets(id) ON DELETE CASCADE | The ticket the inference was performed for |
| service | VARCHAR(20) | NOT NULL | AI service name: `classification`, `scheduling`, `sentiment` |
| type | VARCHAR(10) | NOT NULL | Inference sub-type |
| result | TEXT | | The inference result/output (free text or JSON) |
| confidence | FLOAT | | Model confidence score (0.0 – 1.0) |
| conflict_detected | BOOLEAN | DEFAULT FALSE | Whether the inference detected a conflict |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |

---

### 2.19 `system_settings`

**Purpose:** Key-value store for application-wide configuration settings (feature flags, contact info, hours).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| key | VARCHAR(100) | UNIQUE, NOT NULL | Setting key name |
| value | TEXT | NOT NULL | Setting value |
| type | VARCHAR(10) | NOT NULL, DEFAULT 'string' | Value data type: `string`, `boolean`, `number` |

---

### 2.20 `sla_config`

**Purpose:** Defines Service Level Agreement targets (response and resolution times) per priority level.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| priority | VARCHAR(10) | UNIQUE, NOT NULL | Priority level: `EMERGENCY`, `HIGH`, `MEDIUM`, `LOW` |
| response_minutes | INTEGER | NOT NULL | Target response time in minutes |
| resolution_minutes | INTEGER | NOT NULL | Target resolution time in minutes |

---

### 2.21 `ai_threshold_config`

**Purpose:** Stores tunable confidence thresholds and parameters used by AI services (classification, auto-assignment, sentiment).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| key | VARCHAR(100) | UNIQUE, NOT NULL | Threshold key name |
| value | TEXT | NOT NULL | Threshold numeric value (stored as text) |
| description | TEXT | | Human-readable purpose/description |

---

### 2.22 `audit_logs`

**Purpose:** General-purpose audit trail tracking user actions across the system (who did what and when).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| action | VARCHAR(255) | NOT NULL | Description of the action performed |
| user_id | INTEGER | | ID of the user who performed the action |
| user_name | VARCHAR(200) | | Denormalised name of the user |
| details | TEXT | | Additional context or details about the action |
| timestamp | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Timestamp of the action |

---

### 2.23 `security_audit_logs`

**Purpose:** Security-focused audit log for tracking authentication events, access violations, and other security-relevant events.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| event_type | VARCHAR(255) | NOT NULL | Security event type (e.g. `LOGIN_FAILURE`, `ACCOUNT_LOCKED`) |
| user_id | INTEGER | | ID of the related user |
| details | TEXT | | Event details |
| ip_address | VARCHAR(45) | | Originating IP address (supports IPv4 and IPv6) |
| severity | VARCHAR(10) | NOT NULL, DEFAULT 'INFO' | Event severity: `INFO`, `WARNING`, `CRITICAL` |
| timestamp | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Event timestamp |

---

### 2.24 `password_reset_tokens`

**Purpose:** Stores password reset tokens with expiration and usage tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Unique identifier |
| user_id | INTEGER | FK → users(id) ON DELETE CASCADE, NOT NULL | User requesting the password reset |
| token | VARCHAR(255) | NOT NULL | The reset token |
| expires_at | TIMESTAMPTZ | NOT NULL | Token expiration timestamp |
| used | BOOLEAN | DEFAULT FALSE | Whether the token has already been consumed |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |

---

## 3. Indexes

### `units`
| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| idx_units_property | property_id | Fast FK lookup to properties |
| idx_units_occupant | occupant_id | Fast FK lookup to users |
| idx_units_status | status | Filter units by occupancy status |

### `technicians`
| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| idx_technicians_status | availability_status | Filter technicians by availability |

### `availability_slots`
| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| idx_avail_tech | technician_id | Fast FK lookup to technicians |

### `tickets`
| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| idx_tickets_status | status | Filter tickets by workflow status |
| idx_tickets_priority | priority | Filter tickets by priority level |
| idx_tickets_tenant | tenant_id | Fast FK lookup to users (tenant) |
| idx_tickets_assigned | assigned_to_id | Fast FK lookup to technicians |
| idx_tickets_property | property_id | Fast FK lookup to properties |
| idx_tickets_unit | unit_id | Fast FK lookup to units |
| idx_tickets_date | created_by_date | Date-range queries and sorting by creation date |

### `ticket_status_history`
| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| idx_ticket_history | ticket_id | Fast FK lookup to tickets |

### `ticket_comments`
| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| idx_ticket_comments | ticket_id | Fast FK lookup to tickets |

### `materials`
| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| idx_materials_ticket | ticket_id | Fast FK lookup to tickets |

### `notifications`
| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| idx_notif_user | user_id | Fast FK lookup to users |
| idx_notif_recipient | recipient | Lookup notifications by recipient email |
| idx_notif_read | read | Filter unread notifications |

### `ratings`
| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| idx_ratings_ticket | ticket_id | Fast FK lookup to tickets |
| idx_ratings_user | rated_by | Fast FK lookup to users |

### `documents`
| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| idx_docs_uploader | uploaded_by | Fast FK lookup to users |

### `leases`
| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| idx_leases_unit | unit_id | Fast FK lookup to units |
| idx_leases_tenant | tenant_id | Fast FK lookup to users |

### `messages`
| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| idx_messages_sender | sender_id | Fast FK lookup to users (sender) |
| idx_messages_receiver | receiver_id | Fast FK lookup to users (receiver) |
| idx_messages_read | read | Filter unread messages |

### `password_reset_tokens`
| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| idx_pwreset_user | user_id | Fast FK lookup to users |
| idx_pwreset_token | token | Fast lookup by reset token value |

### `audit_logs`
| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| idx_audit_user | user_id | Lookup audit entries by user |
| idx_audit_action | action | Filter audit entries by action type |
| idx_audit_time | timestamp | Date-range queries on audit trail |

### `security_audit_logs`
| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| idx_sec_audit_severity | severity | Filter security events by severity |
| idx_sec_audit_time | timestamp | Date-range queries on security events |

### `inference_logs`
| Index Name | Column(s) | Purpose |
|------------|-----------|---------|
| idx_inference_ticket | ticket_id | Fast FK lookup to tickets |

---

## 4. Constraints Summary

### Primary Keys (24)
Every table has a single-column `SERIAL PRIMARY KEY` on its `id` column.

| Table | PK Column |
|-------|-----------|
| users | id |
| properties | id |
| units | id |
| leases | id |
| categories | id |
| technicians | id |
| availability_slots | id |
| tickets | id |
| ticket_status_history | id |
| ticket_comments | id |
| materials | id |
| job_evidence | id |
| completion_reports | id |
| notifications | id |
| ratings | id |
| documents | id |
| messages | id |
| inference_logs | id |
| system_settings | id |
| sla_config | id |
| ai_threshold_config | id |
| audit_logs | id |
| security_audit_logs | id |
| password_reset_tokens | id |

### Foreign Keys (27)

| # | Source Table | FK Column | Target Table | Delete Rule |
|---|-------------|-----------|-------------|-------------|
| 1 | units | property_id | properties | CASCADE |
| 2 | units | occupant_id | users | SET NULL |
| 3 | availability_slots | technician_id | technicians | CASCADE |
| 4 | tickets | property_id | properties | SET NULL |
| 5 | tickets | unit_id | units | SET NULL |
| 6 | tickets | tenant_id | users | SET NULL |
| 7 | tickets | category_id | categories | SET NULL |
| 8 | tickets | assigned_to_id | technicians | SET NULL |
| 9 | ticket_status_history | ticket_id | tickets | CASCADE |
| 10 | ticket_status_history | changed_by | users | SET NULL |
| 11 | ticket_comments | ticket_id | tickets | CASCADE |
| 12 | ticket_comments | user_id | users | SET NULL |
| 13 | materials | ticket_id | tickets | SET NULL |
| 14 | materials | provided_by | users | SET NULL |
| 15 | materials | created_by | users | SET NULL |
| 16 | job_evidence | ticket_id | tickets | CASCADE |
| 17 | completion_reports | ticket_id | tickets | CASCADE |
| 18 | notifications | user_id | users | CASCADE |
| 19 | ratings | ticket_id | tickets | CASCADE |
| 20 | ratings | rated_by | users | SET NULL |
| 21 | documents | uploaded_by | users | SET NULL |
| 22 | leases | unit_id | units | CASCADE |
| 23 | leases | tenant_id | users | SET NULL |
| 24 | messages | sender_id | users | CASCADE |
| 25 | messages | receiver_id | users | CASCADE |
| 26 | password_reset_tokens | user_id | users | CASCADE |
| 27 | inference_logs | ticket_id | tickets | CASCADE |

**Cascade rule distribution:**
- ON DELETE CASCADE: 12 FKs
- ON DELETE SET NULL: 15 FKs

### UNIQUE Constraints (5)
| Table | Column(s) |
|-------|-----------|
| users | email |
| categories | name |
| system_settings | key |
| sla_config | priority |
| ai_threshold_config | key |

### CHECK Constraints
None explicitly defined in migrations.

### NOT NULL Columns Count (by table)

| Table | Count | Columns |
|-------|-------|---------|
| users | 6 | name, surname, email, password_hash, role, account_status, created_at, updated_at |
| properties | 4 | name, type, status, address, created_at, updated_at |
| units | 3 | property_id, unit_number, status, created_at, updated_at |
| leases | 2 | start_date, created_at |
| categories | 1 | name, created_at |
| technicians | 1 | name, created_at, updated_at |
| availability_slots | 4 | technician_id, day_of_week, start_time, end_time |
| tickets | 5 | title, description, priority, status, created_by_date, updated_at |
| ticket_status_history | 2 | ticket_id, status, created_at |
| ticket_comments | 2 | ticket_id, comment, created_at |
| materials | 2 | name, created_at |
| job_evidence | 2 | ticket_id, file_url, uploaded_at |
| completion_reports | 2 | ticket_id, description, completed_at |
| notifications | 2 | type, message, created_at |
| ratings | 1 | rating_value, created_at |
| documents | 2 | name, type, uploaded_at |
| messages | 4 | sender_id, receiver_id, subject, body, created_at |
| inference_logs | 2 | service, type, created_at |
| system_settings | 2 | key, value |
| sla_config | 3 | priority, response_minutes, resolution_minutes |
| ai_threshold_config | 2 | key, value |
| audit_logs | 1 | action, timestamp |
| security_audit_logs | 2 | event_type, severity, timestamp |
| password_reset_tokens | 4 | user_id, token, expires_at, created_at |

### DEFAULT Values Summary

| Table | Column | Default |
|-------|--------|---------|
| users | role | 'TENANT' |
| users | account_status | 'PENDING' |
| users | approved | FALSE |
| users | login_attempts | 0 |
| properties | type | 'Residential' |
| properties | status | 'Active' |
| units | type | '1-Bed' |
| units | status | 'Vacant' |
| units | bedrooms | 1 |
| units | bathrooms | 1 |
| categories | icon | '🔧' |
| categories | color | '#95a5a6' |
| technicians | specialisations | '[]' |
| technicians | rating | 0 |
| technicians | current_workload | 0 |
| technicians | total_jobs_completed | 0 |
| technicians | availability_status | 'AVAILABLE' |
| tickets | priority | 'MEDIUM' |
| tickets | status | 'Open' |
| tickets | source | 'tenant_portal' |
| tickets | sla_breached | FALSE |
| tickets | conflict_detected | FALSE |
| tickets | manual_review_required | FALSE |
| notifications | type | 'info' |
| notifications | is_emergency | FALSE |
| notifications | delivery_status | 'Pending' |
| notifications | read | FALSE |
| messages | category | 'general' |
| messages | read | FALSE |
| leases | status | 'active' |
| job_evidence | type | 'image' |
| materials | quantity | 1 |
| system_settings | type | 'string' |
| security_audit_logs | severity | 'INFO' |
| password_reset_tokens | used | FALSE |
| inference_logs | conflict_detected | FALSE |

### All Constraints at a Glance

| Constraint Type | Count |
|----------------|-------|
| PRIMARY KEY | 24 |
| FOREIGN KEY | 27 |
| UNIQUE | 5 |
| CHECK | 0 |
| NOT NULL | ~60+ (individual columns) |
| DEFAULT | ~35+ (individual columns) |

---

*Document generated from migration files `001_users.js` through `013_inference_logs.js`.*
