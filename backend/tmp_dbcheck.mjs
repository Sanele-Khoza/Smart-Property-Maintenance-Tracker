import { Pool } from 'pg';
const p = new Pool({ host: 'localhost', port: 5432, database: 'spmt', user: 'spmt_user', password: 'spmt_pass' });

const sp = await p.query('SELECT id, name, email FROM service_providers ORDER BY id');
console.log('--- service_providers ---');
for (const r of sp.rows) console.log(r.id, r.name.padEnd(18), r.email);

const fk = await p.query(`SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN ('service_providers','users','units','tickets','properties')
  ORDER BY tc.table_name, kcu.column_name`);
console.log('--- FKs ---');
for (const r of fk.rows) console.log(r.table_name + '.' + r.column_name, '->', r.foreign_table);

await p.end();
