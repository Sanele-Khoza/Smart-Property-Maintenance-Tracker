const { dbRun, dbAll } = require('./database');

async function seed() {
  // Users
  await dbRun(`INSERT OR IGNORE INTO users (id, name, surname, email, phone, password_hash, role, account_status, approved) VALUES
    (1, 'System', 'Admin', 'admin@spmt.com', '0115550100', '$2a$10$eSadm8NA.7EtSEVGC7oz1udUVF1W.s5kL/087kgROLovCoL/1edQu', 'SYSTEM_ADMIN', 'ACTIVE', 1),
    (2, 'John', 'Manager', 'manager@spmt.com', '0115550101', '$2a$10$5OPzLzCfHSPw7rhNy.9N0u7baI4euPliVdfXGxHlwyb/2SjxErAHS', 'PROPERTY_MANAGER', 'ACTIVE', 1),
    (3, 'Sarah', 'Tenant', 'sarah@email.com', '0115550102', '$2a$10$Ermhq9mZXN1beVVHF6KMgO102iLZUM7wBFjdjGo87nWPGiyomQpXK', 'TENANT', 'ACTIVE', 1),
    (4, 'Mike', 'Tenant', 'mike@email.com', '0115550103', '$2a$10$jqFd3pzEwlX3UsdyjFqIGeI2A8w5DDGjzKfBmsUf7VFF6CJQgFJPW', 'TENANT', 'ACTIVE', 1),
    (5, 'Jane', 'Tenant', 'jane@email.com', '0115550104', '$2a$10$jqFd3pzEwlX3UsdyjFqIGeI2A8w5DDGjzKfBmsUf7VFF6CJQgFJPW', 'TENANT', 'ACTIVE', 1),
    (6, 'Bob', 'Technician', 'bob.tech@email.com', '0115550105', '$2a$10$o8esvKn./qNqDK.se9bmDea9H5yOrF5kqcD1kS6Z4rdgjBuacuXHm', 'TECHNICIAN', 'ACTIVE', 1)`);

  // Properties
  await dbRun(`INSERT OR IGNORE INTO properties (id, name, type, status, address) VALUES
    (1, 'Sunset Towers', 'Residential', 'Active', '123 Main St, Johannesburg, 2001'),
    (2, 'Riverside Complex', 'Mixed-Use', 'Active', '456 River Rd, Sandton, 2031'),
    (3, 'Greenwood Estate', 'Residential', 'Active', '789 Park Ave, Randburg, 2194'),
    (4, 'CBD Office Park', 'Commercial', 'Active', '100 Business Blvd, Johannesburg, 2001'),
    (5, 'Lakeside Village', 'Residential', 'Active', '55 Lake Dr, Midrand, 1685')`);

  // Units
  await dbRun(`INSERT OR IGNORE INTO units (id, property_id, unit_number, floor, type, status, bedrooms, bathrooms, size_sqm, monthly_rent, square_meters, occupant_id) VALUES
    (1, 1, '101', 1, '1-Bed', 'Occupied', 1, 1, 45, 8500, 45, 3),
    (2, 1, '102', 1, '2-Bed', 'Occupied', 2, 1, 65, 12000, 65, 4),
    (3, 1, '201', 2, '2-Bed', 'Vacant', 2, 1, 65, 12500, 65, NULL),
    (4, 2, 'A1', 1, 'Studio', 'Occupied', 0, 1, 30, 5500, 30, 5),
    (5, 2, 'B2', 2, '1-Bed', 'Vacant', 1, 1, 42, 7800, 42, NULL),
    (6, 3, 'GA-01', 0, '3-Bed', 'Occupied', 3, 2, 120, 22000, 120, NULL),
    (7, 4, 'PH-A', 5, 'Office', 'Vacant', 0, 1, 85, 18000, 85, NULL),
    (8, 5, 'LV-01', 1, '2-Bed', 'Vacant', 2, 2, 75, 13500, 75, NULL),
    (9, 5, 'LV-02', 1, '1-Bed', 'Vacant', 1, 1, 40, 7500, 40, NULL),
    (10, 2, 'A2', 1, 'Studio', 'Vacant', 0, 1, 32, 5800, 32, NULL)`);

  // Categories
  await dbRun(`INSERT OR IGNORE INTO categories (id, name, icon, color) VALUES
    (1, 'Plumbing', '🔧', '#3498db'),
    (2, 'Electrical', '⚡', '#e74c3c'),
    (3, 'Painting', '🎨', '#9b59b6'),
    (4, 'Carpentry', '🪵', '#e67e22'),
    (5, 'HVAC', '🌡️', '#1abc9c'),
    (6, 'Cleaning', '🧹', '#2ecc71')`);

  // Technicians
  await dbRun(`INSERT OR IGNORE INTO technicians (id, name, company_name, email, phone, specialisations, rating, current_workload, total_jobs_completed, availability_status) VALUES
    (1, 'Bob The Builder', 'Bobs Repairs', 'bob.tech@email.com', '0115550105', '["Plumbing","Electrical"]', 4.5, 2, 150, 'AVAILABLE'),
    (2, 'Alice Mkhize', 'Alice Electric', 'alice@email.com', '0115550106', '["Electrical","HVAC"]', 4.8, 1, 200, 'AVAILABLE'),
    (3, 'Tom Ndlovu', 'Tom''s Painters', 'tom@email.com', '0115550107', '["Painting","Carpentry"]', 4.2, 3, 80, 'ON_CALL'),
    (4, 'Lisa Chen', 'Lisa Plumbing Co', 'lisa@email.com', '0115550108', '["Plumbing"]', 4.9, 0, 300, 'AVAILABLE'),
    (5, 'David Smith', 'Smith Repairs', 'david@email.com', '0115550109', '["Carpentry","Plumbing"]', 4.0, 4, 60, 'OFF_DUTY')`);

  // Availability Slots
  await dbRun(`INSERT OR IGNORE INTO availability_slots (id, technician_id, day_of_week, start_time, end_time) VALUES
    (1, 1, 1, '08:00', '17:00'), (2, 1, 2, '08:00', '17:00'), (3, 1, 3, '08:00', '17:00'), (4, 1, 4, '08:00', '17:00'), (5, 1, 5, '08:00', '16:00'),
    (6, 2, 1, '09:00', '18:00'), (7, 2, 2, '09:00', '18:00'), (8, 2, 3, '09:00', '18:00'), (9, 2, 4, '09:00', '18:00'), (10, 2, 5, '09:00', '15:00'),
    (11, 3, 1, '07:00', '16:00'), (12, 3, 2, '07:00', '16:00'), (13, 3, 3, '07:00', '16:00'), (14, 3, 4, '07:00', '16:00'), (15, 3, 5, '07:00', '14:00'),
    (16, 4, 1, '08:00', '17:00'), (17, 4, 2, '08:00', '17:00'), (18, 4, 3, '08:00', '17:00'), (19, 4, 4, '08:00', '17:00'), (20, 4, 5, '08:00', '16:00'),
    (21, 5, 1, '10:00', '19:00'), (22, 5, 2, '10:00', '19:00'), (23, 5, 3, '10:00', '19:00')`);

  // Tickets
  await dbRun(`INSERT OR IGNORE INTO tickets (id, property_id, unit_id, tenant_id, category_id, category_name, category_icon, category_color, assigned_to_id, assigned_to_name, title, description, priority, status, created_by_date, due_date, updated_at, source, tenant_rating, sla_breached) VALUES
    (1, 1, 1, 3, 1, 'Plumbing', '🔧', '#3498db', 1, 'Bob The Builder', 'Leaking faucet in kitchen', 'The kitchen faucet has been leaking for two days. Water is pooling under the sink.', 'HIGH', 'In Progress', '2026-03-15T08:00:00Z', '2026-03-18T08:00:00Z', '2026-03-16T10:00:00Z', 'tenant_portal', 4, 0),
    (2, 2, 4, 5, 2, 'Electrical', '⚡', '#e74c3c', 2, 'Alice Mkhize', 'Power outlet not working', 'The main power outlet in the living room is not working. No sparks or burning smell.', 'MEDIUM', 'Assigned', '2026-03-20T09:00:00Z', '2026-03-25T09:00:00Z', '2026-03-20T09:30:00Z', 'email', NULL, 0),
    (3, 1, 1, 3, 3, 'Painting', '🎨', '#9b59b6', NULL, NULL, 'Wall paint peeling in bedroom', 'The paint on the north wall of the master bedroom is bubbling and peeling.', 'LOW', 'Open', '2026-04-01T14:00:00Z', '2026-04-15T14:00:00Z', '2026-04-01T14:00:00Z', 'tenant_portal', NULL, 0),
    (4, 3, 6, NULL, 5, 'HVAC', '🌡️', '#1abc9c', NULL, NULL, 'Air conditioning not cooling', 'AC unit in common area is running but not cooling the space. Filter was last changed 6 months ago.', 'HIGH', 'Open', '2026-04-05T11:00:00Z', '2026-04-08T11:00:00Z', '2026-04-05T11:00:00Z', 'phone', NULL, 0),
    (5, 1, 1, 3, 1, 'Plumbing', '🔧', '#3498db', 1, 'Bob The Builder', 'Toilet running constantly', 'Toilet in main bathroom continues to run after flushing. Needs new flapper valve.', 'MEDIUM', 'Completed', '2026-03-10T07:00:00Z', '2026-03-13T07:00:00Z', '2026-03-12T15:00:00Z', 'tenant_portal', 5, 0),
    (6, 5, 8, NULL, 1, 'Plumbing', '🔧', '#3498db', 4, 'Lisa Chen', 'Preventive maintenance - water heater', 'Annual water heater inspection and flushing for unit LV-01. Scheduled maintenance.', 'LOW', 'Open', '2026-04-10T08:00:00Z', '2026-04-20T08:00:00Z', '2026-04-10T08:00:00Z', 'system', NULL, 0),
    (7, 1, 2, 4, 2, 'Electrical', '⚡', '#e74c3c', NULL, NULL, 'Light fixture broken', 'Ceiling light fixture in hallway is dangling. Needs to be secured.', 'MEDIUM', 'Open', '2026-04-12T16:00:00Z', '2026-04-17T16:00:00Z', '2026-04-12T16:00:00Z', 'tenant_portal', NULL, 0),
    (8, 4, 7, NULL, 4, 'Carpentry', '🪵', '#e67e22', NULL, NULL, 'Office door jammed', 'Main entrance door to office PH-A is stuck. Cannot open or close properly.', 'HIGH', 'Open', '2026-04-14T09:00:00Z', '2026-04-16T09:00:00Z', '2026-04-14T09:00:00Z', 'email', NULL, 0)`);

  // Tickets Status History
  await dbRun(`INSERT OR IGNORE INTO ticket_status_history (id, ticket_id, status, changed_by, changed_by_name, reason) VALUES
    (1, 1, 'Open', 3, 'Sarah Tenant', 'Created'),
    (2, 1, 'Assigned', 2, 'John Manager', 'Assigned to Bob the Builder'),
    (3, 1, 'In Progress', 1, 'Bob The Builder', 'Arrived at unit'),
    (4, 5, 'Open', 3, 'Sarah Tenant', 'Created'),
    (5, 5, 'Assigned', 2, 'John Manager', 'Assigned'),
    (6, 5, 'In Progress', 1, 'Bob The Builder', 'Started work'),
    (7, 5, 'Completed', 1, 'Bob The Builder', 'Replaced flapper valve, toilet working normally'),
    (8, 2, 'Open', 5, 'Jane Tenant', 'Created'),
    (9, 2, 'Assigned', 2, 'John Manager', 'Assigned to Alice Mkhize')`);

  // Materials
  await dbRun(`INSERT OR IGNORE INTO materials (id, ticket_id, name, quantity, unit_cost, provided_by, created_at) VALUES
    (1, 1, 'Faucet Washer Kit', 1, 85.00, 1, '2026-03-16T09:00:00Z'),
    (2, 1, 'Plumber Tape', 1, 25.00, 1, '2026-03-16T09:00:00Z'),
    (3, 5, 'Flapper Valve', 1, 120.00, 1, '2026-03-12T10:00:00Z'),
    (4, 6, 'Water Heater Anode Rod', 1, 350.00, 4, '2026-04-10T08:00:00Z')`);

  // Notifications
  await dbRun(`INSERT OR IGNORE INTO notifications (id, user_id, recipient, type, message, read, is_emergency, created_at) VALUES
    (1, NULL, 'sarah@email.com', 'info', 'Your maintenance request (Ticket #1) has been assigned to Bob The Builder.', 0, 0, '2026-03-15T10:00:00Z'),
    (2, NULL, 'admin@spmt.com', 'warning', 'New technician registration requires approval: David Smith', 1, 0, '2026-04-01T08:00:00Z'),
    (3, NULL, 'manager@spmt.com', 'info', 'SLA breach imminent: Ticket #4 (Air conditioning) due in 2 hours.', 0, 1, '2026-04-08T09:00:00Z'),
    (4, NULL, 'bob.tech@email.com', 'info', 'New job assigned: Leaking faucet in kitchen (Ticket #1).', 0, 0, '2026-03-15T10:00:00Z')`);

  // Documents
  await dbRun(`INSERT OR IGNORE INTO documents (id, name, type, file_path, uploaded_by, uploaded_at) VALUES
    (1, 'Lease Agreement - Sunset 101.pdf', 'lease', '/documents/leases/lease_001.pdf', 3, '2026-01-01T10:00:00Z'),
    (2, 'Inspection Report - Riverside A1.pdf', 'inspection', '/documents/inspections/insp_001.pdf', 2, '2026-03-01T14:00:00Z')`);

  // Ratings
  await dbRun(`INSERT OR IGNORE INTO ratings (id, ticket_id, rated_by, rating_value, comment, created_at) VALUES
    (1, 5, 3, 5, 'Excellent work! Bob fixed the toilet quickly and left everything clean.', '2026-03-12T16:00:00Z')`);

  // Settings
  await dbRun(`INSERT OR IGNORE INTO system_settings (key, value, type) VALUES
    ('PROPERTY_NAME', 'SPMT' ,'string'),
    ('MAINTENANCE_CONTACT', '0115550100', 'string'),
    ('EMERGENCY_CONTACT', '10177', 'string'),
    ('MAINTENANCE_EMAIL', 'maintenance@spmt.com', 'string'),
    ('DEFAULT_TENANT_RENT', '8500', 'number'),
    ('TENANT_PORTAL_ENABLED', 'true', 'boolean'),
    ('AUTO_ASSIGN_TICKETS', 'true', 'boolean'),
    ('SLA_ENABLED', 'true', 'boolean'),
    ('NOTIFICATIONS_ENABLED', 'true', 'boolean'),
    ('REQUIRE_TENANT_APPROVAL', 'true', 'boolean'),
    ('MAINTENANCE_HOURS_START', '08:00', 'string'),
    ('MAINTENANCE_HOURS_END', '17:00', 'string')`);

  // SLA Config
  await dbRun(`INSERT OR IGNORE INTO sla_config (priority, response_minutes, resolution_minutes) VALUES
    ('EMERGENCY', 30, 240),
    ('HIGH', 120, 480),
    ('MEDIUM', 480, 2880),
    ('LOW', 1440, 10080)`);

  // AI Threshold Config
  await dbRun(`INSERT OR IGNORE INTO ai_threshold_config (key, value, description) VALUES
    ('DUPLICATE_TICKET_SIMILARITY', '0.75', 'Minimum similarity score to flag as duplicate'),
    ('AUTO_ASSIGN_PROBABILITY', '0.80', 'Minimum confidence to auto-assign tickets'),
    ('TICKET_PRIORITY_SCORE_HIGH', '0.70', 'Score threshold for HIGH priority classification'),
    ('EMERGENCY_KEYWORD_WEIGHT', '2.0', 'Weight multiplier for emergency keywords'),
    ('SUGGESTED_CATEGORY_CONFIDENCE', '0.60', 'Minimum confidence for suggested category'),
    ('TENANT_SENTIMENT_THRESHOLD', '0.40', 'Sentiment score below this flags negative feedback')`);

  console.log('Seed data inserted successfully');
}

module.exports = { seed };
