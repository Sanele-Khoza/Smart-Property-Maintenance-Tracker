/*
 * Track which AI classifier produced a ticket's text classification so the
 * UI can show whether Python (sklearn) or AWS Comprehend / keyword fallback
 * was used. Pure metadata — no behavioural change on either path.
 */
async function up(query) {
  await query(
    'ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ai_service TEXT'
  );
  await query(
    'ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ai_method TEXT'
  );
}

async function down(query) {
  await query('ALTER TABLE tickets DROP COLUMN IF EXISTS ai_method');
  await query('ALTER TABLE tickets DROP COLUMN IF EXISTS ai_service');
}

export { up, down };