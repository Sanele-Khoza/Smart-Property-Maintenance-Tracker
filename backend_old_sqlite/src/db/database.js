const sqlite3 = require('sqlite3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const DB_PATH = path.join(__dirname, '../../spmt.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('DB connection error:', err.message);
    process.exit(1);
  }
});

db.run('PRAGMA journal_mode=WAL');
db.run('PRAGMA foreign_keys=ON');

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

async function initializeDatabase() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      surname TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      age INTEGER,
      id_number TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('TENANT','PROPERTY_MANAGER','SERVICE_PROVIDER','TECHNICIAN','SYSTEM_ADMIN')),
      account_status TEXT DEFAULT 'ACTIVE' CHECK(account_status IN ('ACTIVE','DEACTIVATED','PENDING','SUSPENDED')),
      approved INTEGER DEFAULT 0,
      approved_at TEXT,
      last_login TEXT,
      email_verification_token TEXT,
      password_reset_token TEXT,
      password_reset_expiry TEXT,
      login_attempts INTEGER DEFAULT 0,
      locked_until TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'Residential' CHECK(type IN ('Residential','Commercial','Mixed-Use')),
      status TEXT DEFAULT 'Active' CHECK(status IN ('Active','Inactive','Under Maintenance')),
      address TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      unit_number TEXT NOT NULL,
      floor TEXT,
      type TEXT DEFAULT '1-Bed',
      status TEXT DEFAULT 'Vacant' CHECK(status IN ('Vacant','Occupied','Under Maintenance')),
      bedrooms INTEGER DEFAULT 1,
      bathrooms INTEGER DEFAULT 1,
      size_sqm REAL,
      monthly_rent REAL,
      square_meters REAL,
      occupant_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS leases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      tenant_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      tenant_name TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      rent_amount REAL,
      deposit REAL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','expired','terminated','renewed')),
      terms TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      icon TEXT DEFAULT '🔧',
      color TEXT DEFAULT '#95a5a6'
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
      unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
      tenant_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      category_name TEXT,
      category_icon TEXT,
      category_color TEXT,
      assigned_to_id INTEGER REFERENCES technicians(id) ON DELETE SET NULL,
      assigned_to_name TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT DEFAULT 'MEDIUM' CHECK(priority IN ('LOW','MEDIUM','HIGH','EMERGENCY')),
      status TEXT DEFAULT 'Open' CHECK(status IN ('Open','Assigned','In Progress','Waiting for Parts','Completed','Cancelled','Archived','On Hold')),
      created_by_date TEXT DEFAULT (datetime('now')),
      due_date TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      source TEXT DEFAULT 'tenant_portal' CHECK(source IN ('tenant_portal','email','phone','system','in_person')),
      tenant_rating INTEGER,
      sla_breached INTEGER DEFAULT 0
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS ticket_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      changed_by INTEGER,
      changed_by_name TEXT,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS technicians (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company_name TEXT,
      email TEXT,
      phone TEXT,
      specialisations TEXT DEFAULT '[]',
      rating REAL DEFAULT 0,
      current_workload INTEGER DEFAULT 0,
      total_jobs_completed INTEGER DEFAULT 0,
      availability_status TEXT DEFAULT 'AVAILABLE' CHECK(availability_status IN ('AVAILABLE','ON_CALL','OFF_DUTY','SUSPENDED')),
      gps_latitude REAL,
      gps_longitude REAL,
      last_location_update TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS availability_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technician_id INTEGER NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_cost REAL,
      provided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type TEXT DEFAULT 'info' CHECK(type IN ('info','warning','success','error','email','push','sms')),
      message TEXT NOT NULL,
      is_emergency INTEGER DEFAULT 0,
      delivery_status TEXT DEFAULT 'Pending' CHECK(delivery_status IN ('Pending','Sent','Delivered','Failed')),
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      file_path TEXT,
      file_url TEXT,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      description TEXT,
      uploaded_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
      rated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      rating_value INTEGER NOT NULL CHECK(rating_value BETWEEN 1 AND 5),
      comment TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS inference_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
      service TEXT NOT NULL CHECK(service IN ('Comprehend','Rekognition')),
      type TEXT NOT NULL CHECK(type IN ('text','image')),
      result TEXT,
      confidence REAL,
      conflict_detected INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      type TEXT DEFAULT 'string' CHECK(type IN ('number','boolean','string'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS sla_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      priority TEXT UNIQUE NOT NULL CHECK(priority IN ('LOW','MEDIUM','HIGH','EMERGENCY')),
      response_minutes INTEGER NOT NULL,
      resolution_minutes INTEGER NOT NULL
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS ai_threshold_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      description TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      user_id INTEGER,
      user_name TEXT,
      details TEXT,
      timestamp TEXT DEFAULT (datetime('now'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS security_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      user_id INTEGER,
      details TEXT,
      ip_address TEXT,
      severity TEXT DEFAULT 'INFO' CHECK(severity IN ('INFO','WARNING','CRITICAL')),
      timestamp TEXT DEFAULT (datetime('now'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS ticket_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      comment TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS job_evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      provider_name TEXT,
      file_url TEXT NOT NULL,
      type TEXT DEFAULT 'image' CHECK(type IN ('image','video','document','other')),
      description TEXT,
      uploaded_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS completion_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      provider_name TEXT,
      description TEXT NOT NULL,
      materials_used TEXT,
      hours_worked REAL,
      notes TEXT,
      completed_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  console.log('Database initialized: all tables created');
}

module.exports = { db, dbRun, dbGet, dbAll, initializeDatabase };
