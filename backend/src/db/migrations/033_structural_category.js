async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      icon VARCHAR(10) DEFAULT '🔧',
      color VARCHAR(10) DEFAULT '#95a5a6',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    INSERT INTO categories (name, icon, color)
    SELECT 'Structural', '🧱', '#34495e'
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Structural')
  `);
}

async function down(query) {
  await query(`DELETE FROM categories WHERE name = 'Structural'`);
}

export { up, down };