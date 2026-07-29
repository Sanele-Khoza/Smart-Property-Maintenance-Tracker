import bcrypt from "bcryptjs";
import {
  ALL_PERMISSIONS,
  RBAC_MATRIX,
} from "../../shared/constants/permissions.js";
import logger from "../../shared/utils/logger.js";

/* deterministic UUIDs so seed is idempotent across restarts */
const ID = {
  admin:    "a0000000-0000-0000-0000-000000000001",
  john:     "a0000000-0000-0000-0000-000000000002",
  sarah:    "a0000000-0000-0000-0000-000000000003",
  mike:     "a0000000-0000-0000-0000-000000000004",
  jane:     "a0000000-0000-0000-0000-000000000005",
  bob:      "a0000000-0000-0000-0000-000000000006",
  sarahM:   "a0000000-0000-0000-0000-000000000007",
  nomsa:    "a0000000-0000-0000-0000-000000000008",
  linda:    "a0000000-0000-0000-0000-000000000009",
  thabo:    "a0000000-0000-0000-0000-00000000000a",
  zanele:   "a0000000-0000-0000-0000-00000000000b",
  sunset:   "b0000000-0000-0000-0000-000000000001",
  riverside:"b0000000-0000-0000-0000-000000000002",
  greenwood:"b0000000-0000-0000-0000-000000000003",
  cbd:      "b0000000-0000-0000-0000-000000000004",
  lakeside: "b0000000-0000-0000-0000-000000000005",
  bobTech:  "c0000000-0000-0000-0000-000000000001",
  alice:    "c0000000-0000-0000-0000-000000000002",
  tom:      "c0000000-0000-0000-0000-000000000003",
  lisa:     "c0000000-0000-0000-0000-000000000004",
  david:    "c0000000-0000-0000-0000-000000000005",
  henry:    "c0000000-0000-0000-0000-000000000006",
  grace:    "c0000000-0000-0000-0000-000000000007",
  ivy:      "c0000000-0000-0000-0000-000000000008",
};

/* 25 deterministic unit UUIDs (5 per property) */
const UNIT = [
  "d0000000-0000-0000-0000-000000000001",  // Sunset 101
  "d0000000-0000-0000-0000-000000000002",  // Sunset 102
  "d0000000-0000-0000-0000-000000000003",  // Sunset 201
  "d0000000-0000-0000-0000-000000000004",  // Sunset 202
  "d0000000-0000-0000-0000-000000000005",  // Sunset 301
  "d0000000-0000-0000-0000-000000000006",  // Riverside A1
  "d0000000-0000-0000-0000-000000000007",  // Riverside A2
  "d0000000-0000-0000-0000-000000000008",  // Riverside B1
  "d0000000-0000-0000-0000-000000000009",  // Riverside B2
  "d0000000-0000-0000-0000-00000000000a",  // Riverside C1
  "d0000000-0000-0000-0000-00000000000b",  // Greenwood GA-01
  "d0000000-0000-0000-0000-00000000000c",  // Greenwood GA-02
  "d0000000-0000-0000-0000-00000000000d",  // Greenwood GA-03
  "d0000000-0000-0000-0000-00000000000e",  // Greenwood GB-01
  "d0000000-0000-0000-0000-00000000000f",  // Greenwood GB-02
  "d0000000-0000-0000-0000-000000000010",  // CBD PH-A
  "d0000000-0000-0000-0000-000000000011",  // CBD PH-B
  "d0000000-0000-0000-0000-000000000012",  // CBD 1F-A
  "d0000000-0000-0000-0000-000000000013",  // CBD 1F-B
  "d0000000-0000-0000-0000-000000000014",  // CBD 2F-A
  "d0000000-0000-0000-0000-000000000015",  // Lakeside LV-01
  "d0000000-0000-0000-0000-000000000016",  // Lakeside LV-02
  "d0000000-0000-0000-0000-000000000017",  // Lakeside LV-03
  "d0000000-0000-0000-0000-000000000018",  // Lakeside LV-04
  "d0000000-0000-0000-0000-000000000019",  // Lakeside LV-05
];

/* deterministic ticket UUIDs */
const TICKET = [
  "e0000000-0000-0000-0000-000000000001",
  "e0000000-0000-0000-0000-000000000002",
  "e0000000-0000-0000-0000-000000000003",
  "e0000000-0000-0000-0000-000000000004",
  "e0000000-0000-0000-0000-000000000005",
  "e0000000-0000-0000-0000-000000000006",
  "e0000000-0000-0000-0000-000000000007",
  "e0000000-0000-0000-0000-000000000008",
  "e0000000-0000-0000-0000-000000000009",
  "e0000000-0000-0000-0000-00000000000a",
  "e0000000-0000-0000-0000-00000000000b",
  "e0000000-0000-0000-0000-00000000000c",
];

/* deterministic notification UUIDs */
const NOTIF = [
  "f0000000-0000-0000-0000-000000000001",
  "f0000000-0000-0000-0000-000000000002",
  "f0000000-0000-0000-0000-000000000003",
  "f0000000-0000-0000-0000-000000000004",
  "f0000000-0000-0000-0000-000000000005",
  "f0000000-0000-0000-0000-000000000006",
];

const RATING = "f0000000-0000-0000-0000-000000000010";

async function seed(query) {
  logger.info("Seeding database...");

  const hash = (pwd) => bcrypt.hashSync(pwd, 12);

  /* ── 1. users ── */
  const users = [
    /* System Admin */
    { id: ID.admin, name: "System", surname: "Admin", email: "admin@spmt.com", phone: "0115550100", hash: hash("admin123"), role: "SYSTEM_ADMIN", status: "ACTIVE", approved: true },

    /* Property Managers */
    { id: ID.john,   name: "John",   surname: "Manager", email: "john@spmt.com",   phone: "0115550101", hash: hash("manager123"), role: "PROPERTY_MANAGER", status: "ACTIVE", approved: true },
    { id: ID.sarahM, name: "Sarah",  surname: "Manager", email: "sarah.m@spmt.com", phone: "0115550110", hash: hash("manager123"), role: "PROPERTY_MANAGER", status: "ACTIVE", approved: true },
    { id: ID.nomsa,  name: "Nomsa",  surname: "Dlamini", email: "nomsa@spmt.com",   phone: "0115550111", hash: hash("manager123"), role: "PROPERTY_MANAGER", status: "ACTIVE", approved: true },

    /* Tenants */
    { id: ID.sarah,  name: "Sarah",  surname: "Tenant",  email: "sarah@spmt.com",   phone: "0115550102", hash: hash("tenant123"), role: "TENANT", status: "ACTIVE", approved: true },
    { id: ID.mike,   name: "Mike",   surname: "Tenant",  email: "mike@spmt.com",    phone: "0115550103", hash: hash("tenant123"), role: "TENANT", status: "ACTIVE", approved: true },
    { id: ID.jane,   name: "Jane",   surname: "Tenant",  email: "jane@spmt.com",    phone: "0115550104", hash: hash("tenant123"), role: "TENANT", status: "ACTIVE", approved: true },
    { id: ID.linda,  name: "Linda",  surname: "Tenant",  email: "linda@spmt.com",   phone: "0115550112", hash: hash("tenant123"), role: "TENANT", status: "ACTIVE", approved: true },
    { id: ID.thabo,  name: "Thabo",  surname: "Tenant",  email: "thabo@spmt.com",   phone: "0115550113", hash: hash("tenant123"), role: "TENANT", status: "ACTIVE", approved: true },
    { id: ID.zanele, name: "Zanele", surname: "Tenant",  email: "zanele@spmt.com",  phone: "0115550114", hash: hash("tenant123"), role: "TENANT", status: "ACTIVE", approved: true },

    /* Service Providers (Technicians) */
    { id: ID.bob,   name: "Bob",     surname: "Builder",  email: "bob@spmt.com",    phone: "0115550105", hash: hash("provider123"), role: "SERVICE_PROVIDER", status: "ACTIVE", approved: true },
    { id: ID.alice, name: "Alice",   surname: "Mkhize",   email: "alice@spmt.com",  phone: "0115550106", hash: hash("provider123"), role: "SERVICE_PROVIDER", status: "ACTIVE", approved: true },
    { id: ID.tom,   name: "Tom",     surname: "Ndlovu",   email: "tom@spmt.com",    phone: "0115550107", hash: hash("provider123"), role: "SERVICE_PROVIDER", status: "ACTIVE", approved: true },
    { id: ID.lisa,  name: "Lisa",    surname: "Chen",     email: "lisa@spmt.com",   phone: "0115550108", hash: hash("provider123"), role: "SERVICE_PROVIDER", status: "ACTIVE", approved: true },
    { id: ID.david, name: "David",   surname: "Smith",    email: "david@spmt.com",  phone: "0115550109", hash: hash("provider123"), role: "SERVICE_PROVIDER", status: "ACTIVE", approved: true },
    { id: ID.henry, name: "Henry",   surname: "Okafor",   email: "henry@spmt.com",  phone: "0115550115", hash: hash("provider123"), role: "SERVICE_PROVIDER", status: "ACTIVE", approved: true },
    { id: ID.grace, name: "Grace",   surname: "Mokoena",  email: "grace@spmt.com",  phone: "0115550116", hash: hash("provider123"), role: "SERVICE_PROVIDER", status: "ACTIVE", approved: true },
    { id: ID.ivy,   name: "Ivy",     surname: "Naidoo",   email: "ivy@spmt.com",    phone: "0115550117", hash: hash("provider123"), role: "SERVICE_PROVIDER", status: "ACTIVE", approved: true },
  ];
  for (const u of users) {
    await query(
      `INSERT INTO users (id, name, surname, email, phone, password_hash, role, status, approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
      [u.id, u.name, u.surname, u.email, u.phone, u.hash, u.role, u.status, u.approved],
    );
  }

  /* ── 2. properties ── */
  const properties = [
    { id: ID.sunset,    name: "Sunset Towers",    type: "Residential", status: "Active", address: "123 Main St, Johannesburg, 2001" },
    { id: ID.riverside, name: "Riverside Complex", type: "MixedUse",   status: "Active", address: "456 River Rd, Sandton, 2031" },
    { id: ID.greenwood, name: "Greenwood Estate",  type: "Residential", status: "Active", address: "789 Park Ave, Randburg, 2194" },
    { id: ID.cbd,       name: "CBD Office Park",   type: "Commercial",  status: "Active", address: "100 Business Blvd, Johannesburg, 2001" },
    { id: ID.lakeside,  name: "Lakeside Village",  type: "Residential", status: "Active", address: "55 Lake Dr, Midrand, 1685" },
  ];
  for (const p of properties) {
    await query(
      "INSERT INTO properties (id, name, type, status, address) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
      [p.id, p.name, p.type, p.status, p.address],
    );
  }

  /* ── 3. service_providers ── */
  const providers = [
    { id: ID.bob,   name: "Bob Builder",    companyName: "Bob's Repairs",       email: "bob@spmt.com",   phone: "0115550105", specialisations: ["Plumbing", "Electrical"],   rating: 4.5, workload: 2, status: "AVAILABLE" },
    { id: ID.alice, name: "Alice Mkhize",   companyName: "Alice Electric",      email: "alice@spmt.com", phone: "0115550106", specialisations: ["Electrical", "HVAC"],       rating: 4.8, workload: 1, status: "AVAILABLE" },
    { id: ID.tom,   name: "Tom Ndlovu",     companyName: "Tom's Painters",      email: "tom@spmt.com",   phone: "0115550107", specialisations: ["Painting", "Carpentry"],    rating: 4.2, workload: 3, status: "ON_CALL" },
    { id: ID.lisa,  name: "Lisa Chen",      companyName: "Lisa Plumbing Co",    email: "lisa@spmt.com",  phone: "0115550108", specialisations: ["Plumbing"],                  rating: 4.9, workload: 0, status: "AVAILABLE" },
    { id: ID.david, name: "David Smith",    companyName: "Smith Repairs",       email: "david@spmt.com", phone: "0115550109", specialisations: ["Carpentry", "Plumbing"],    rating: 4.0, workload: 4, status: "OFF_DUTY" },
    { id: ID.henry, name: "Henry Okafor",   companyName: "Henry HVAC Solutions", email: "henry@spmt.com", phone: "0115550115", specialisations: ["HVAC", "Plumbing"],         rating: 4.6, workload: 1, status: "AVAILABLE" },
    { id: ID.grace, name: "Grace Mokoena",  companyName: "Grace Tiles & Paint",  email: "grace@spmt.com", phone: "0115550116", specialisations: ["Painting", "Tiling"],       rating: 4.7, workload: 2, status: "AVAILABLE" },
    { id: ID.ivy,   name: "Ivy Naidoo",     companyName: "Ivy Solar & Electric", email: "ivy@spmt.com",   phone: "0115550117", specialisations: ["Electrical", "Solar"],      rating: 4.4, workload: 1, status: "ON_CALL" },
  ];
  for (const sp of providers) {
    await query(
      `INSERT INTO service_providers (id, name, company_name, email, phone, specialisations, rating, current_workload, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
      [sp.id, sp.name, sp.companyName, sp.email, sp.phone, sp.specialisations, sp.rating, sp.workload, sp.status],
    );
  }

  /* ── 4. units (5 per property = 25 total) ── */
  const units = [
    /* Sunset Towers — managed by John */
    { id: UNIT[0],  propertyId: ID.sunset,    unitNumber: "101",  floor: "1", type: "1-Bed",   bedrooms: 1, bathrooms: 1, sizeSqm: 45,  status: "Occupied", occupantId: ID.sarah },
    { id: UNIT[1],  propertyId: ID.sunset,    unitNumber: "102",  floor: "1", type: "2-Bed",   bedrooms: 2, bathrooms: 1, sizeSqm: 65,  status: "Occupied", occupantId: ID.mike },
    { id: UNIT[2],  propertyId: ID.sunset,    unitNumber: "201",  floor: "2", type: "2-Bed",   bedrooms: 2, bathrooms: 1, sizeSqm: 65,  status: "Vacant",   occupantId: null },
    { id: UNIT[3],  propertyId: ID.sunset,    unitNumber: "202",  floor: "2", type: "1-Bed",   bedrooms: 1, bathrooms: 1, sizeSqm: 48,  status: "Occupied", occupantId: ID.thabo },
    { id: UNIT[4],  propertyId: ID.sunset,    unitNumber: "301",  floor: "3", type: "3-Bed",   bedrooms: 3, bathrooms: 2, sizeSqm: 95,  status: "Vacant",   occupantId: null },

    /* Riverside Complex — managed by John */
    { id: UNIT[5],  propertyId: ID.riverside, unitNumber: "A1",   floor: "1", type: "Studio",  bedrooms: 0, bathrooms: 1, sizeSqm: 30,  status: "Occupied", occupantId: ID.jane },
    { id: UNIT[6],  propertyId: ID.riverside, unitNumber: "A2",   floor: "1", type: "Studio",  bedrooms: 0, bathrooms: 1, sizeSqm: 32,  status: "Vacant",   occupantId: null },
    { id: UNIT[7],  propertyId: ID.riverside, unitNumber: "B1",   floor: "2", type: "1-Bed",   bedrooms: 1, bathrooms: 1, sizeSqm: 42,  status: "Occupied", occupantId: ID.zanele },
    { id: UNIT[8],  propertyId: ID.riverside, unitNumber: "B2",   floor: "2", type: "1-Bed",   bedrooms: 1, bathrooms: 1, sizeSqm: 40,  status: "Vacant",   occupantId: null },
    { id: UNIT[9],  propertyId: ID.riverside, unitNumber: "C1",   floor: "3", type: "2-Bed",   bedrooms: 2, bathrooms: 1, sizeSqm: 58,  status: "Occupied", occupantId: ID.linda },

    /* Greenwood Estate — managed by Sarah M */
    { id: UNIT[10], propertyId: ID.greenwood, unitNumber: "GA-01", floor: "0", type: "3-Bed",  bedrooms: 3, bathrooms: 2, sizeSqm: 120, status: "Vacant",   occupantId: null },
    { id: UNIT[11], propertyId: ID.greenwood, unitNumber: "GA-02", floor: "0", type: "2-Bed",  bedrooms: 2, bathrooms: 1, sizeSqm: 75,  status: "Vacant",   occupantId: null },
    { id: UNIT[12], propertyId: ID.greenwood, unitNumber: "GA-03", floor: "0", type: "3-Bed",  bedrooms: 3, bathrooms: 2, sizeSqm: 130, status: "Vacant",   occupantId: null },
    { id: UNIT[13], propertyId: ID.greenwood, unitNumber: "GB-01", floor: "1", type: "2-Bed",  bedrooms: 2, bathrooms: 1, sizeSqm: 70,  status: "Vacant",   occupantId: null },
    { id: UNIT[14], propertyId: ID.greenwood, unitNumber: "GB-02", floor: "1", type: "1-Bed",  bedrooms: 1, bathrooms: 1, sizeSqm: 45,  status: "Vacant",   occupantId: null },

    /* CBD Office Park — managed by Sarah M */
    { id: UNIT[15], propertyId: ID.cbd,       unitNumber: "PH-A",  floor: "5", type: "Office", bedrooms: 0, bathrooms: 1, sizeSqm: 85,  status: "Occupied", occupantId: null },
    { id: UNIT[16], propertyId: ID.cbd,       unitNumber: "PH-B",  floor: "5", type: "Office", bedrooms: 0, bathrooms: 1, sizeSqm: 90,  status: "Vacant",   occupantId: null },
    { id: UNIT[17], propertyId: ID.cbd,       unitNumber: "1F-A",  floor: "1", type: "Office", bedrooms: 0, bathrooms: 1, sizeSqm: 60,  status: "Occupied", occupantId: null },
    { id: UNIT[18], propertyId: ID.cbd,       unitNumber: "1F-B",  floor: "1", type: "Office", bedrooms: 0, bathrooms: 1, sizeSqm: 55,  status: "Vacant",   occupantId: null },
    { id: UNIT[19], propertyId: ID.cbd,       unitNumber: "2F-A",  floor: "2", type: "Office", bedrooms: 0, bathrooms: 1, sizeSqm: 70,  status: "Occupied", occupantId: null },

    /* Lakeside Village — managed by Nomsa */
    { id: UNIT[20], propertyId: ID.lakeside,  unitNumber: "LV-01", floor: "1", type: "2-Bed",  bedrooms: 2, bathrooms: 2, sizeSqm: 75,  status: "Occupied", occupantId: ID.linda },
    { id: UNIT[21], propertyId: ID.lakeside,  unitNumber: "LV-02", floor: "1", type: "1-Bed",  bedrooms: 1, bathrooms: 1, sizeSqm: 40,  status: "Occupied", occupantId: ID.thabo },
    { id: UNIT[22], propertyId: ID.lakeside,  unitNumber: "LV-03", floor: "2", type: "2-Bed",  bedrooms: 2, bathrooms: 1, sizeSqm: 68,  status: "Occupied", occupantId: ID.zanele },
    { id: UNIT[23], propertyId: ID.lakeside,  unitNumber: "LV-04", floor: "2", type: "1-Bed",  bedrooms: 1, bathrooms: 1, sizeSqm: 38,  status: "Vacant",   occupantId: null },
    { id: UNIT[24], propertyId: ID.lakeside,  unitNumber: "LV-05", floor: "3", type: "3-Bed",  bedrooms: 3, bathrooms: 2, sizeSqm: 110, status: "Vacant",   occupantId: null },
  ];
  for (const u of units) {
    await query(
      `INSERT INTO units (id, property_id, unit_number, floor, type, bedrooms, bathrooms, size_sqm, status, occupant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
      [u.id, u.propertyId, u.unitNumber, u.floor, u.type, u.bedrooms, u.bathrooms, u.sizeSqm, u.status, u.occupantId],
    );
  }

  /* ── 5. tickets (12 spread across properties) ── */
  const tickets = [
    /* Sunset Towers tickets */
    { id: TICKET[0], unitId: UNIT[0], tenantId: ID.sarah, category: "Plumbing",  title: "Leaking faucet in kitchen",          description: "Kitchen faucet has been leaking for two days. Water pooling under sink.",                  priority: "HIGH",     status: "In Progress", assignedTo: ID.bob,   source: "tenant_portal", dueDate: new Date("2026-08-01T08:00:00Z") },
    { id: TICKET[1], unitId: UNIT[1], tenantId: ID.mike,  category: "Electrical", title: "Power outlet not working",            description: "Main power outlet in living room not working.",                                           priority: "MEDIUM",   status: "Assigned",    assignedTo: ID.alice, source: "tenant_portal", dueDate: new Date("2026-08-05T09:00:00Z") },
    { id: TICKET[2], unitId: UNIT[0], tenantId: ID.sarah, category: "Painting",   title: "Wall paint peeling in bedroom",       description: "Paint on north wall bubbling and peeling. Needs stripping and repaint.",                   priority: "LOW",      status: "Open",        assignedTo: null,     source: "tenant_portal", dueDate: new Date("2026-08-15T14:00:00Z") },

    /* Riverside Complex tickets */
    { id: TICKET[3], unitId: UNIT[5], tenantId: ID.jane,  category: "Plumbing",   title: "Toilet running constantly",           description: "Toilet continues to run after flushing. Needs new flapper valve.",                         priority: "MEDIUM",   status: "Completed",   assignedTo: ID.bob,   source: "tenant_portal", dueDate: new Date("2026-07-20T07:00:00Z") },
    { id: TICKET[4], unitId: UNIT[7], tenantId: ID.zanele,category: "Electrical", title: "Tripping circuit breaker",            description: "Main breaker trips when kettle and microwave used together.",                              priority: "HIGH",     status: "In Progress", assignedTo: ID.ivy,   source: "tenant_portal", dueDate: new Date("2026-08-03T10:00:00Z") },

    /* Greenwood Estate tickets */
    { id: TICKET[5], unitId: UNIT[10],tenantId: null,     category: "HVAC",       title: "Air conditioning not cooling",        description: "AC unit running but not cooling space. Filter seems clean.",                               priority: "HIGH",     status: "Open",        assignedTo: null,     source: "phone",         dueDate: new Date("2026-08-08T11:00:00Z") },
    { id: TICKET[6], unitId: UNIT[11],tenantId: ID.sarah, category: "Plumbing",   title: "Geysor not heating water",            description: "No hot water from geyser since yesterday morning.",                                        priority: "EMERGENCY",status: "ESCALATED",   assignedTo: ID.henry, source: "tenant_portal", dueDate: new Date("2026-07-28T06:00:00Z") },

    /* CBD Office Park tickets */
    { id: TICKET[7], unitId: UNIT[15],tenantId: null,     category: "Carpentry",  title: "Office door jammed",                  description: "Main entrance door to office PH-A is stuck. Cannot open or close.",                        priority: "HIGH",     status: "Open",        assignedTo: null,     source: "email",         dueDate: new Date("2026-08-10T09:00:00Z") },
    { id: TICKET[8], unitId: UNIT[17],tenantId: null,     category: "Painting",   title: "Reception area needs repainting",     description: "Reception walls scuffed and faded. Full repaint needed before client visit.",              priority: "MEDIUM",   status: "Assigned",    assignedTo: ID.grace, source: "phone",         dueDate: new Date("2026-08-12T08:00:00Z") },

    /* Lakeside Village tickets */
    { id: TICKET[9], unitId: UNIT[20],tenantId: ID.linda, category: "Plumbing",   title: "Bathroom drain blocked",              description: "Water backing up in bathroom shower drain. Likely hair clog.",                             priority: "MEDIUM",   status: "In Progress", assignedTo: ID.lisa,  source: "tenant_portal", dueDate: new Date("2026-08-02T13:00:00Z") },
    { id: TICKET[10],unitId: UNIT[22],tenantId: ID.zanele,category: "Electrical", title: "Dimmer switch sparking",              description: "Bedroom dimmer switch makes sparking sound and smells of burning.",                        priority: "HIGH",     status: "Open",        assignedTo: null,     source: "tenant_portal", dueDate: new Date("2026-08-04T15:00:00Z") },
    { id: TICKET[11],unitId: UNIT[24],tenantId: null,     category: "Tiling",     title: "Kitchen floor tiles cracked",         description: "Several floor tiles in kitchen cracked after heavy item was dropped.",                     priority: "LOW",      status: "Open",        assignedTo: null,     source: "tenant_portal", dueDate: new Date("2026-08-20T10:00:00Z") },
  ];
  for (const t of tickets) {
    await query(
      `INSERT INTO tickets (id, unit_id, tenant_id, category, title, description, priority, status, assigned_to, source, due_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING`,
      [t.id, t.unitId, t.tenantId, t.category, t.title, t.description, t.priority, t.status, t.assignedTo, t.source, t.dueDate, new Date(t.dueDate.getTime() - 3 * 24 * 60 * 60 * 1000)],
    );
  }

  /* ── 6. ticket_attachments (empty for seed) ── */

  /* ── 7. ai_inference_log (empty for seed) ── */

  /* ── 8. audit_log (empty for seed) ── */

  /* ── 9. notifications ── */
  await query(
    `INSERT INTO notifications (id, user_id, type, title, body, is_emergency, delivery_status) VALUES
     ($1,  $2,  'info',    'Ticket Assigned',       'Your maintenance request (Leaking faucet) has been assigned to Bob Builder.',         FALSE, 'Sent'),
     ($3,  $4,  'warning', 'Registration Approved', 'New service provider registration approved: Grace Mokoena.',                         FALSE, 'Sent'),
     ($5,  $6,  'warning', 'SLA Breach Imminent',   'SLA breach imminent: Ticket "Geysor not heating water" due in 2 hours.',              TRUE,  'Sent'),
     ($7,  $8,  'info',    'New Job Assigned',       'New job assigned: Leaking faucet in kitchen (Ticket #1).',                           FALSE, 'Sent'),
     ($9,  $10, 'info',    'Ticket Assigned',        'Your maintenance request (Tripping circuit breaker) has been assigned to Ivy Naidoo.', FALSE, 'Sent'),
     ($11, $12, 'warning', 'Emergency Ticket',       'Emergency: Geyser not heating water at Greenwood Estate. Assigned to Henry.',  TRUE,  'Sent')
     ON CONFLICT (id) DO NOTHING`,
    [
      NOTIF[0], ID.sarah,
      NOTIF[1], ID.admin,
      NOTIF[2], ID.john,
      NOTIF[3], ID.bob,
      NOTIF[4], ID.zanele,
      NOTIF[5], ID.sarahM,
    ],
  );

  /* ── 10. performance_ratings ── */
  await query(
    `INSERT INTO performance_ratings (id, ticket_id, rated_by, rating, comment) VALUES
     ($1, $2, $3, 5, 'Excellent work! Bob fixed the toilet quickly and left everything clean.')
     ON CONFLICT (id) DO NOTHING`,
    [RATING, TICKET[3], ID.jane],
  );

  /* ── 11. sla_config ── */
  const slaData = [
    { priority: "EMERGENCY", responseMinutes: 30, resolutionMinutes: 240 },
    { priority: "HIGH", responseMinutes: 120, resolutionMinutes: 480 },
    { priority: "MEDIUM", responseMinutes: 480, resolutionMinutes: 2880 },
    { priority: "LOW", responseMinutes: 1440, resolutionMinutes: 10080 },
  ];
  for (const s of slaData) {
    await query(
      "INSERT INTO sla_config (priority, response_minutes, resolution_minutes) VALUES ($1, $2, $3) ON CONFLICT (priority) DO NOTHING",
      [s.priority, s.responseMinutes, s.resolutionMinutes],
    );
  }

  /* ── 12. security_audit_log (empty for seed) ── */

  /* ── system_config (SDD §5 thresholds) ── */
  const thresholds = [
    { key: "AI_TEXT_CONFIDENCE_THRESHOLD",        value: "0.60", desc: "Minimum confidence for Comprehend text classification (SDD §5.3)" },
    { key: "AI_EMERGENCY_VISUAL_THRESHOLD",       value: "0.70", desc: "Minimum confidence for Rekognition emergency detection (SDD §5.3)" },
    { key: "AI_TEXT_WEIGHT",                      value: "0.40", desc: "Text classifier weight in arbitration (SDD §5.3.3)" },
    { key: "AI_VISUAL_WEIGHT",                    value: "0.60", desc: "Visual classifier weight in arbitration (SDD §5.3.3)" },
    { key: "AI_ARBITRATION_HIGH_CONFIDENCE_GAP",  value: "0.20", desc: "Minimum gap to auto-resolve conflict (SDD §5.3.3)" },
    { key: "AI_SIMILARITY_DUPLICATE_THRESHOLD",   value: "0.85", desc: "TF-IDF cosine threshold for duplicate detection (SDD §5.3.4)" },
    { key: "AI_TICKET_PRIORITY_HIGH_THRESHOLD",   value: "0.70", desc: "Emergency keyword score for HIGH priority (SDD §5.3.5)" },
    { key: "AI_EMERGENCY_KEYWORD_WEIGHT",         value: "2.00", desc: "Weight multiplier for emergency keywords (SDD §5.3.5)" },
    { key: "AI_SENTIMENT_NEGATIVE_THRESHOLD",     value: "0.40", desc: "Sentiment below this flags negative tenant feedback (SDD §5.3.6)" },
    { key: "AI_AUTO_ASSIGN_CONFIDENCE",           value: "0.80", desc: "Minimum confidence to auto-assign tickets (SDD §5.3.7)" },
    { key: "AI_MULTI_MODAL_CONFLICT_THRESHOLD",   value: "0.15", desc: "Label probability gap triggering conflict (SDD §4.1.1)" },
    { key: "AI_RETENTION_DAYS",                   value: "365",  desc: "Inference log retention in days (SDD §5.3.8)" },
  ];
  for (const t of thresholds) {
    await query(
      "INSERT INTO system_config (key, value, description) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING",
      [t.key, t.value, t.desc],
    );
  }

  /* ── Permissions + role_permissions ── */
  for (const perm of ALL_PERMISSIONS) {
    await query(
      'INSERT INTO permissions (id, label, "group") VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
      [perm.id, perm.label, perm.group],
    );
  }

  for (const [role, permIds] of Object.entries(RBAC_MATRIX)) {
    for (const permId of permIds) {
      await query(
        "INSERT INTO role_permissions (role, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [role, permId],
      );
    }
  }

  logger.info("Seed complete");
}

export { seed };
