import { query } from './src/db/connection.js';

const BASE = 'http://localhost:5000/api';
let failures = 0;

function check(name, cond, extra) {
  if (cond) { console.log(`PASS: ${name}`); }
  else { failures++; console.log(`FAIL: ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}

async function login(email, password) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  return j.data?.accessToken || j.data?.token;
}

/* 0. clean any leftover E2E tickets from previous runs */
await query(`UPDATE tickets SET deleted_at = NOW() WHERE title = 'E2E rating sync test'`);

/* 1. pick a provider with an existing prior */
const prov = (await query(`SELECT id, name, rating, rating_count FROM service_providers ORDER BY rating_count DESC, rating DESC LIMIT 1`)).rows[0];
check('found provider', !!prov);
const oldRating = Number(prov.rating);
const oldCount = Number(prov.rating_count);
console.log(`  provider ${prov.name}: rating=${oldRating} count=${oldCount}`);

/* 2. tenant login + create a ticket assigned to that provider */
const tenantToken = await login('sarah@spmt.com', 'tenant123');
check('tenant login', !!tenantToken);
const unit = (await query(`SELECT id FROM units WHERE occupant_id IS NOT NULL LIMIT 1`)).rows[0];

const created = await fetch(`${BASE}/tickets`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tenantToken}` },
  body: JSON.stringify({ unit_id: unit.id, title: 'E2E rating sync test', description: 'verify formula and provider sync', priority: 'MEDIUM', category: 'General' }),
});
const createdJson = await created.json();
const ticketId = createdJson.data?.ticket?.id || createdJson.data?.ticket;
check('ticket created', !!ticketId, createdJson);

/* 3. let the async AI classification settle, then force status + assignment */
await new Promise(r => setTimeout(r, 2500));
await query(`UPDATE tickets SET status = 'Tenant Confirmed', assigned_to = $1 WHERE id = $2`, [prov.id, ticketId]);
const afterSetup = (await query(`SELECT status FROM tickets WHERE id = $1`, [ticketId])).rows[0];
check('ticket status forced to Tenant Confirmed', afterSetup.status === 'Tenant Confirmed', afterSetup);

/* 4. rate the ticket */
const rateRes = await fetch(`${BASE}/ratings`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tenantToken}` },
  body: JSON.stringify({ ticketId, rating: 5, comment: 'Great service' }),
});
const rateJson = await rateRes.json();
check('rating accepted (201)', rateRes.status === 201, rateJson);

const expectedFinal = Math.round(((oldRating * oldCount + 5) / (oldCount + 1)) * 100) / 100;
check('response finalRating matches formula', Number(rateJson.data?.finalRating) === expectedFinal, rateJson.data);
check('response ratingCount = old+1', Number(rateJson.data?.ratingCount) === oldCount + 1, rateJson.data);

/* 5. verify service_providers synced */
const after = (await query(`SELECT rating, rating_count FROM service_providers WHERE id = $1`, [prov.id])).rows[0];
check('service_providers.rating synced', Number(after.rating) === expectedFinal, { after, expectedFinal });
check('service_providers.rating_count synced', Number(after.rating_count) === oldCount + 1, after);

/* 6. ticket GET returns the synced provider rating */
const ticketGet = await fetch(`${BASE}/tickets/${ticketId}`, { headers: { Authorization: `Bearer ${tenantToken}` } });
const ticketJson = await ticketGet.json();
const t = ticketJson.data?.ticket || ticketJson.data || ticketJson;
check('ticket response includes provider_rating', Number(t.provider_rating) === expectedFinal, t.provider_rating);
check('ticket response includes provider_rating_count', Number(t.provider_rating_count) === oldCount + 1, t.provider_rating_count);

/* 7. reports aggregation still works with the new rating store */
const adminToken = await login('admin@spmt.com', 'admin123');
const repRes = await fetch(`${BASE}/reports/providers-summary`, { headers: { Authorization: `Bearer ${adminToken}` } });
check('reports/providers-summary 200', repRes.status === 200, repRes.status);

/* 8. duplicate rating blocked, rating unchanged */
const dup = await fetch(`${BASE}/ratings`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tenantToken}` },
  body: JSON.stringify({ ticketId, rating: 1, comment: 'again' }),
});
const dupJson = await dup.json();
check('duplicate rating rejected (400)', dup.status === 400, dupJson);
const afterDup = (await query(`SELECT rating, rating_count FROM service_providers WHERE id = $1`, [prov.id])).rows[0];
check('provider rating unchanged after duplicate', Number(afterDup.rating) === expectedFinal && Number(afterDup.rating_count) === oldCount + 1, afterDup);

/* 9. cleanup: soft-delete test ticket and restore provider state */
await query(`UPDATE tickets SET deleted_at = NOW() WHERE id = $1`, [ticketId]);
await query(`UPDATE service_providers SET rating = $1, rating_count = $2 WHERE id = $3`, [oldRating, oldCount, prov.id]);

console.log(failures === 0 ? '\nALL RATING SYNC CHECKS PASSED' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
