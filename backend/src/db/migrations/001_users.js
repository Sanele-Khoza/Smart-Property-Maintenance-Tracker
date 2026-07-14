async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      surname VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20),
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'TENANT',
      account_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      approved BOOLEAN DEFAULT FALSE,
      approved_at TIMESTAMPTZ,
      last_login TIMESTAMPTZ,
      email_verification_token VARCHAR(255),
      password_reset_token VARCHAR(255),
      password_reset_expiry TIMESTAMPTZ,
      login_attempts INTEGER DEFAULT 0,
      locked_until TIMESTAMPTZ,
      age INTEGER,
      id_number VARCHAR(20),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function down(query) {
  await query('DROP TABLE IF EXISTS users CASCADE');
}

export { up, down };
