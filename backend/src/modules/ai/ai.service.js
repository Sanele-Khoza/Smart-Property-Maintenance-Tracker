import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { query } from '../../db/connection.js';
import { classify } from '../../shared/utils/aiClassifier.js';
import { classifyText as comprehendClassifyText } from './comprehend.service.js';
import { classifyText as pythonClassifyText, autoAssign } from './pythonAi.service.js';
import { analyzeImage } from './rekognition.service.js';
import decidePriority from '../../shared/utils/priorityDetector.js';
import { extractEntities, deduplicateEntities } from './entityExtractor.js';
import { findDuplicates } from './duplicateDetector.js';
import * as ticketsRepo from '../tickets/tickets.repository.js';
import config from '../../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOADS_PATH = path.resolve(__dirname, '..', '..', '..', config.upload.uploadDir);

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

async function logSingleInference(ticketId, service, result) {
  try {
    await query(
      `INSERT INTO ai_inference_log (ticket_id, service, text_result, visual_result, text_confidence, visual_confidence, arbitrated_label, conflict_detected)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [ticketId, service, JSON.stringify(result), null, result.confidence || 0, null, result.category || null, false]
    );
  } catch (err) {
    console.error('Failed to log AI inference:', err.message);
  }
}

async function persistClassification(id, textResult, visualResult, classification) {
  await query(
    `INSERT INTO ai_inference_log (ticket_id, service, text_result, visual_result, text_confidence, visual_confidence, arbitrated_label, conflict_detected)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, 'combined', JSON.stringify(textResult), JSON.stringify(visualResult),
     classification.textConfidence, classification.imageConfidence,
     classification.primaryCategory, classification.conflictDetected]
  );

  const updates = {
    ai_text_label: classification.textLabel,
    ai_visual_label: classification.imageLabel,
    ai_text_confidence: classification.textConfidence,
    ai_visual_confidence: classification.imageConfidence,
    ai_confidence: classification.combinedConfidence,
    ai_category: classification.primaryCategory,
    category: classification.primaryCategory,
    conflict_detected: classification.conflictDetected,
  };

  if (classification.visualEmergency) {
    updates.visual_emergency = true;
    updates.visual_emergency_escalated_by = 'AI';
  }

  if (classification.combinedConfidence < 0.6 && classification.outcome !== 'EMERGENCY') {
    updates.pm_confirmed = false;
  }

  if (classification.outcome === 'MANUAL_REVIEW') {
    updates.status = 'Manual Review';
  } else if (classification.outcome === 'EMERGENCY') {
    updates.status = 'ESCALATED';
  }

  /* ── AI priority intelligence (text + Rekognition based) ──
     The AI decides a priority and overrides the tenant's claim when it is
     wrong — e.g. a tenant marks EMERGENCY but the description is a minor leak,
     or a real emergency was marked LOW. This always writes the decided level. */
  const ticketRow = (await query('SELECT priority, description FROM tickets WHERE id = $1', [id])).rows[0];
  const priorityDecision = decidePriority(ticketRow || { priority: 'MEDIUM', description: '' }, visualResult);
  updates.priority = priorityDecision.priority;

  await query(
    `UPDATE tickets SET
      ai_text_label = $1, ai_visual_label = $2,
      ai_text_confidence = $3, ai_visual_confidence = $4,
      ai_confidence = $5, ai_category = $6,
      category = COALESCE($6, category),
      conflict_detected = $7, status = COALESCE($8, status),
      priority = $9,
      ai_priority = $16, ai_priority_overridden = $17, ai_priority_reason = $18,
      visual_emergency = COALESCE($10, visual_emergency),
      visual_emergency_escalated_by = COALESCE($11, visual_emergency_escalated_by),
      pm_confirmed = COALESCE($12, pm_confirmed),
      ai_service = COALESCE($13, ai_service),
      ai_method = COALESCE($14, ai_method),
      updated_at = NOW()
    WHERE id = $15`,
    [
      updates.ai_text_label, updates.ai_visual_label,
      updates.ai_text_confidence, updates.ai_visual_confidence,
      updates.ai_confidence, updates.ai_category,
      updates.conflict_detected,
      updates.status || null,
      updates.priority || null,
      updates.visual_emergency ?? null,
      updates.visual_emergency_escalated_by || null,
      updates.pm_confirmed ?? null,
      textResult?.service || null,
      classification.outcome || null,
      id,
      priorityDecision.priority || null,
      priorityDecision.overridden || false,
      priorityDecision.reason || null,
    ]
  );

  await query(
    `INSERT INTO ticket_status_history (ticket_id, status, changed_by, changed_by_name, reason)
     VALUES ($1, $2, NULL, 'AI', $3)`,
    [id, updates.status || 'AI Classified', `AI classification: ${classification.outcome}`]
  );

  if (classification.combinedConfidence < 0.7 && classification.outcome !== 'EMERGENCY') {
    await query(
      `INSERT INTO low_confidence_queue (ticket_id, text_confidence, visual_confidence, combined_confidence, reason)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (ticket_id) DO UPDATE SET
         text_confidence = EXCLUDED.text_confidence,
         visual_confidence = EXCLUDED.visual_confidence,
         combined_confidence = EXCLUDED.combined_confidence,
         reason = EXCLUDED.reason,
         status = 'pending',
         reviewed_by = NULL,
         reviewed_at = NULL`,
      [id, classification.textConfidence, classification.imageConfidence, classification.combinedConfidence,
       classification.outcome === 'CONFLICT'
         ? 'AI conflict between text and image classification'
         : classification.outcome === 'MANUAL_REVIEW'
           ? 'Low confidence — requires manual review'
           : `Combined confidence ${Math.round(classification.combinedConfidence * 100)}% is below 70% threshold`]
    );
  }

  const descRow = (await query('SELECT description FROM tickets WHERE id = $1', [id])).rows[0];
  const descriptionText = descRow?.description || '';
  if (descriptionText) {
    const raw = extractEntities(descriptionText);
    const deduped = deduplicateEntities(raw);
    for (const e of deduped) {
      await query(
        `INSERT INTO ai_entity_tags (ticket_id, entity_type, value, confidence, source) VALUES ($1, $2, $3, $4, $5)`,
        [id, e.entityType, e.value, e.confidence, e.source]
      );
    }
    await query('UPDATE tickets SET entity_tags = $1 WHERE id = $2',
      [JSON.stringify(deduped), id]
    );
  }

  const ticket = (await query('SELECT unit_id FROM tickets WHERE id = $1', [id])).rows[0];
  if (ticket?.unit_id) {
    const duplicates = await findDuplicates(id, ticket.unit_id);
    for (const d of duplicates) {
      await query(
        `INSERT INTO duplicate_ticket_suggestions (ticket_id, duplicate_ticket_id, similarity_score, match_reason)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (ticket_id, duplicate_ticket_id) DO NOTHING`,
        [id, d.duplicateTicketId, d.similarityScore, d.matchReason]
      );
    }
  }

  return { classification, textResult, visualResult };
}

async function classifyTicket(id) {
  const ticketResult = await query('SELECT * FROM tickets WHERE id = $1', [id]);
  const ticket = ticketResult.rows[0];
  if (!ticket) {
    return { error: 'Ticket not found', statusCode: 404 };
  }

  const textResult = ticket.description
    ? await (config.pythonAi.enabled ? pythonClassifyText : comprehendClassifyText)(ticket.description)
    : { category: null, confidence: 0, service: 'none' };

  let visualResult = { category: null, confidence: 0, service: 'none', visualEmergency: false, labels: [] };
  try {
    const attachments = await ticketsRepo.getAttachments(id);
    for (const att of attachments) {
      if (IMAGE_MIMES.includes(att.file_type)) {
        const filePath = path.join(UPLOADS_PATH, att.file_key);
        try {
          const buffer = await fs.readFile(filePath);
          visualResult = await analyzeImage(buffer);
          break;
        } catch {
          continue;
        }
      }
    }
  } catch {
    /* No image attachments found — run text-only classification */
  }

  const opts = {
    imageIsEmergency: visualResult.visualEmergency || false,
    awsTextAvailable: textResult.service === 'comprehend',
    awsVisualAvailable: visualResult.service === 'rekognition',
  };

  const classification = classify(
    { category: textResult.category, confidence: textResult.confidence, service: textResult.service },
    { category: visualResult.category, confidence: visualResult.confidence, service: visualResult.service },
    opts
  );

  return persistClassification(id, textResult, visualResult, classification);
}

async function getLowConfidenceQueue(filters = {}) {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params = [];
  let paramIdx = 1;

  if (filters.status) {
    where += ` AND lcq.status = $${paramIdx++}`;
    params.push(filters.status);
  }

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM low_confidence_queue lcq ${where}`,
    params
  );
  const total = countResult.rows[0].total;

  params.push(limit);
  params.push(offset);

  const rows = await query(
    `SELECT lcq.*, t.title AS ticket_title, t.status AS ticket_status,
            t.priority, t.unit_id, t.created_at AS ticket_created_at,
            u.name AS tenant_name, u.surname AS tenant_surname
     FROM low_confidence_queue lcq
     JOIN tickets t ON t.id = lcq.ticket_id
     LEFT JOIN users u ON u.id = t.tenant_id
     ${where}
     ORDER BY lcq.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    params
  );

  return {
    items: rows.rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function reviewQueueItem(id, status, reviewedBy) {
  const result = await query(
    `UPDATE low_confidence_queue
     SET status = $1, reviewed_by = $2, reviewed_at = NOW()
     WHERE id = $3 AND status = 'pending'
     RETURNING *`,
    [status, reviewedBy, id]
  );

  if (result.rows.length === 0) {
    const existing = await query('SELECT * FROM low_confidence_queue WHERE id = $1', [id]);
    if (existing.rows.length === 0) return { error: 'Queue item not found', statusCode: 404 };
    return { error: 'Item already reviewed', statusCode: 409 };
  }

  return { item: result.rows[0] };
}

async function getEntities(ticketId) {
  const result = await query(
    'SELECT * FROM ai_entity_tags WHERE ticket_id = $1 ORDER BY entity_type, confidence DESC',
    [ticketId]
  );
  return result.rows;
}

async function getDuplicates(ticketId) {
  const result = await query(
    `SELECT dts.*, t.title AS duplicate_title, t.status AS duplicate_status
     FROM duplicate_ticket_suggestions dts
     JOIN tickets t ON t.id = dts.duplicate_ticket_id
     WHERE dts.ticket_id = $1
     ORDER BY dts.similarity_score DESC`,
    [ticketId]
  );
  return result.rows;
}

async function extractEntitiesFromText(text) {
  const raw = extractEntities(text);
  return deduplicateEntities(raw);
}

async function getQueueStats() {
  const result = await query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending') AS pending,
      COUNT(*) FILTER (WHERE status = 'reviewed') AS reviewed,
      COUNT(*) FILTER (WHERE status = 'resolved') AS resolved
    FROM low_confidence_queue
  `);
  return result.rows[0] || { pending: 0, reviewed: 0, resolved: 0 };
}

/**
 * Pure-Python classification + provider assignment preview.
 * Returns the Python model's category and a ranked provider list without
 * persisting anything.
 */
async function pythonClassifyAndAssign(ticketId, { topN = 1 } = {}) {
  const ticketRes = await query('SELECT * FROM tickets WHERE id = $1', [ticketId]);
  const ticket = ticketRes.rows[0];
  if (!ticket) return { error: 'Ticket not found', statusCode: 404 };

  const catResult = await pythonClassifyText(ticket.description || '');

  const category = catResult.category || 'Other';
  const providers = await query(
    `SELECT sp.*,
            COALESCE(sp.rating, 0) AS rating,
            COALESCE(sp.current_workload, 0) AS current_workload,
            COALESCE(sp.specialisations, '{}') AS specialisations,
            pa.auto_accept, pa.current_jobs AS pa_jobs,
            pa.preferred_radius_km
     FROM service_providers sp
     LEFT JOIN provider_availability pa ON pa.provider_id = sp.id
     WHERE sp.status != 'OFF_DUTY'`
  );

  const lat = ticket.unit_id
    ? (await query('SELECT gps_location FROM units WHERE id = $1', [ticket.unit_id])).rows[0]?.gps_location?.x
    : null;
  const lng = ticket.unit_id
    ? (await query('SELECT gps_location FROM units WHERE id = $1', [ticket.unit_id])).rows[0]?.gps_location?.y
    : null;

  const assignResult = await autoAssign(providers.rows, {
    category, topN, lat, lng,
  });

  return {
    classification: catResult,
    category,
    matches: assignResult.data?.matches || [],
  };
}


export {
  classifyTicket,
  persistClassification,
  logSingleInference,
  getLowConfidenceQueue,
  reviewQueueItem,
  getEntities,
  getDuplicates,
  extractEntitiesFromText,
  getQueueStats,
  pythonClassifyAndAssign,
};
