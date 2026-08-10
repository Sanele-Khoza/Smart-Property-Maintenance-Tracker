import { query } from './src/db/connection.js';
const r = await query(`
  SELECT c.table_name, c.column_name, c.data_type
  FROM information_schema.columns c
  WHERE (c.table_name = 'ratings' AND c.column_name IN ('id','ticket_id','rated_by','rating_value'))
     OR (c.table_name = 'tickets' AND c.column_name = 'assigned_to')
     OR (c.table_name = 'service_providers' AND c.column_name IN ('id','rating','rating_count'))
  ORDER BY c.table_name, c.column_name
`);
r.rows.forEach(x => console.log(`${x.table_name}.${x.column_name}: ${x.data_type}`));
process.exit(0);
