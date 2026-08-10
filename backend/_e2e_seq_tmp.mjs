import { query } from "./src/db/connection.js";
const BASE = "http://localhost:5000/api";
let fails = 0;
const check = (n, c, x) => {
  if (c) console.log(`PASS: ${n}`);
  else {
    fails++;
    console.log(`FAIL: ${n} -> ${JSON.stringify(x)}`);
  }
};

async function login(email, password) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return (await r.json()).data?.accessToken;
}
const round2 = (n) => Math.round(n * 100) / 100;

const prov = (
  await query(
    `SELECT id, rating, rating_count FROM service_providers ORDER BY rating_count LIMIT 1`,
  )
).rows[0];
const orig = { rating: prov.rating, count: prov.rating_count };
console.log(`provider start: rating=${orig.rating} count=${orig.count}`);

const token = await login("sarah@spmt.com", "tenant123");
const unit = (
  await query(`SELECT id FROM units WHERE occupant_id IS NOT NULL LIMIT 1`)
).rows[0];

const DESCS = [
  "the bathroom sink is leaking water everywhere",
  "the kitchen stove heating element burned out completely",
];
async function makeTicket(i) {
  const r = await fetch(`${BASE}/tickets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      unit_id: unit.id,
      title: `E2E rating sequence test ${i}`,
      description: DESCS[i - 1],
      priority: "LOW",
      category: "General",
    }),
  });
  const j = await r.json();
  if (!j.data?.ticket?.id)
    console.log("  CREATE RESP", r.status, JSON.stringify(j).slice(0, 400));
  return j.data?.ticket?.id;
}
async function rate(ticketId, score) {
  const r = await fetch(`${BASE}/ratings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ticketId, rating: score }),
  });
  return await r.json();
}

let cur = orig.rating,
  cnt = orig.count,
  i = 1;
for (const score of [3, 5]) {
  const tId = await makeTicket(i++);
  await new Promise((r) => setTimeout(r, 2000));
  await query(
    `UPDATE tickets SET status = 'Tenant Confirmed', assigned_to = $1 WHERE id = $2`,
    [prov.id, tId],
  );
  const expected = round2((cur * cnt + score) / (cnt + 1));
  const j = await rate(tId, score);
  check(`rating ${score}/5 accepted (201)`, j.success === true, j);
  check(
    `finalRating = (${cur}*${cnt}+${score})/(${cnt}+1) = ${expected}`,
    Number(j.data?.finalRating) === expected,
    j.data,
  );
  const row = (
    await query(
      `SELECT rating, rating_count FROM service_providers WHERE id = $1`,
      [prov.id],
    )
  ).rows[0];
  check(`DB rating ${expected}`, Number(row.rating) === expected, row);
  check(`DB count ${cnt + 1}`, Number(row.rating_count) === cnt + 1, row);
  cur = expected;
  cnt = cnt + 1;
}

/* restore provider state + soft-delete test tickets */
await query(
  `UPDATE service_providers SET rating = $1, rating_count = $2 WHERE id = $3`,
  [orig.rating, orig.count, prov.id],
);
await query(
  `UPDATE tickets SET deleted_at = NOW() WHERE title LIKE 'E2E rating sequence test%'`,
);

console.log(fails === 0 ? "\nSEQUENCE CHECKS PASSED" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
