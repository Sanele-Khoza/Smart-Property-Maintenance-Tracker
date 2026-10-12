const CATEGORIES = [
  ['Appliances', '🔌', '#8e44ad'],
  ['Electrical', '⚡', '#2980b9'],
  ['HVAC', '❄️', '#16a085'],
  ['Landscaping', '🌿', '#27ae60'],
  ['Pest Control', '🐜', '#e67e22'],
  ['Plumbing', '🚰', '#d35400'],
  ['Security', '🔒', '#c0392b'],
];

async function up(query) {
  for (const [name, icon, color] of CATEGORIES) {
    await query(
      `INSERT INTO categories (name, icon, color)
       SELECT $1::varchar, $2::varchar, $3::varchar
       WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = $1)`,
      [name, icon, color]
    );
  }
}

async function down(query) {
  const names = CATEGORIES.map(c => c[0]);
  await query(`DELETE FROM categories WHERE name = ANY($1::text[])`, [names]);
}

export { up, down };