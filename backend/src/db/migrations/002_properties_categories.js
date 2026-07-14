async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS properties (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'Residential',
      status VARCHAR(30) NOT NULL DEFAULT 'Active',
      address TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      icon VARCHAR(10) DEFAULT '🔧',
      color VARCHAR(10) DEFAULT '#95a5a6',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function down(query) {
  await query('DROP TABLE IF EXISTS categories CASCADE');
  await query('DROP TABLE IF EXISTS properties CASCADE');
}

export { up, down };
