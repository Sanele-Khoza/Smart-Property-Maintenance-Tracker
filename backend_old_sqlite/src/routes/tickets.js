const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const TICKET_TRANSITIONS = {
  'Open': ['Assigned', 'Manual Review'],
  'Assigned': ['In Progress'],
  'In Progress': ['Completed (Provider)', 'Waiting for Parts', 'Escalated'],
  'Waiting for Parts': ['In Progress'],
  'Manual Review': ['Open'],
  'Completed (Provider)': ['Closed'],
  'Closed': ['Reopened'],
  'Reopened': ['Open'],
  'Escalated': ['Assigned'],
};

const PRIORITY_ORDER = { EMERGENCY: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function getSlaDeadlines(priority) {
  const slaMap = { LOW: { resp: 1440, resol: 10080 }, MEDIUM: { resp: 480, resol: 2880 }, HIGH: { resp: 120, resol: 1440 }, EMERGENCY: { resp: 15, resol: 240 } };
  const cfg = slaMap[priority] || slaMap.MEDIUM;
  const now = Date.now();
  return { sla_response_before: now + cfg.resp * 60000, sla_resolution_before: now + cfg.resol * 60000 };
}

async function addTimeline(ticketId, action, description, actor) {
  await dbRun('INSERT INTO ticket_timeline (ticket_id, action, description, actor) VALUES (?, ?, ?, ?)', [ticketId, action, description || '', actor || null]);
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { status, category, priority, assigned_to, limit } = req.query;
    let sql = 'SELECT * FROM tickets WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (priority) { sql += ' AND priority = ?'; params.push(priority); }
    if (assigned_to) { sql += ' AND assigned_to_id = ?'; params.push(Number(assigned_to)); }
    sql += ' ORDER BY created_at DESC';
    if (limit) { sql += ' LIMIT ?'; params.push(Number(limit)); }
    const tickets = await dbAll(sql, params);
    res.json(tickets.map(t => ({ ...t, images: safeJson(t.images), completion_photos: safeJson(t.completion_photos) })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

router.get('/my', authenticate, async (req, res) => {
  try {
    const tickets = await dbAll('SELECT * FROM tickets WHERE assigned_to_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json(tickets.map(t => ({ ...t, images: safeJson(t.images), completion_photos: safeJson(t.completion_photos) })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch my tickets' });
  }
});

router.get('/available', authenticate, async (req, res) => {
  try {
    const tickets = await dbAll("SELECT * FROM tickets WHERE assigned_to_id IS NULL AND status NOT IN ('Closed','Completed (Provider)','Cancelled') ORDER BY created_at DESC");
    res.json(tickets.map(t => ({ ...t, images: safeJson(t.images), completion_photos: safeJson(t.completion_photos) })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch available tickets' });
  }
});

router.get('/stats', authenticate, async (req, res) => {
  try {
    const total = await dbGet('SELECT COUNT(*) as count FROM tickets');
    const byStatus = await dbAll('SELECT status, COUNT(*) as count FROM tickets GROUP BY status');
    const byPriority = await dbAll('SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority');
    const open = await dbGet("SELECT COUNT(*) as count FROM tickets WHERE status IN ('Open','Manual Review')");
    const inProgress = await dbGet("SELECT COUNT(*) as count FROM tickets WHERE status IN ('Assigned','In Progress','Waiting for Parts')");
    const completed = await dbGet("SELECT COUNT(*) as count FROM tickets WHERE status IN ('Completed (Provider)','Closed')");
    const breached = await dbGet('SELECT COUNT(*) as count FROM tickets WHERE sla_resolution_before IS NOT NULL AND sla_resolution_before < ? AND status NOT IN (?)', [Date.now(), 'Closed']);
    res.json({
      total: total.count,
      byStatus: byStatus.reduce((a, s) => ({ ...a, [s.status]: s.count }), {}),
      byPriority: byPriority.reduce((a, p) => ({ ...a, [p.priority]: p.count }), {}),
      open: open.count,
      inProgress: inProgress.count,
      completed: completed.count,
      slaBreached: breached.count
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const ticket = await dbGet('SELECT * FROM tickets WHERE ticket_id = ? OR id = ?', [req.params.id, req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const timeline = await dbAll('SELECT * FROM ticket_timeline WHERE ticket_id = ? ORDER BY created_at ASC', [ticket.ticket_id]);
    const comments = await dbAll('SELECT * FROM ticket_comments WHERE ticket_id = ? ORDER BY created_at ASC', [ticket.ticket_id]);
    const evidence = await dbAll('SELECT * FROM job_evidence WHERE ticket_id = ? ORDER BY uploaded_at DESC', [ticket.ticket_id]);
    const reports = await dbAll('SELECT * FROM completion_reports WHERE ticket_id = ?', [ticket.ticket_id]);
    res.json({ ...ticket, images: safeJson(ticket.images), completion_photos: safeJson(ticket.completion_photos), timeline, comments, evidence, reports });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { unitId, title, description, priority, images, createdById, createdByName, aiFields, forceSubmit } = req.body;
    if (!unitId || !description) return res.status(400).json({ error: 'Unit ID and description are required' });
    if (description.trim().length < 20) return res.status(400).json({ error: 'Description must be at least 20 characters' });
    const creatorName = createdByName || req.user.name + ' ' + req.user.surname;
    const creatorId = createdById || req.user.id;

    if (!forceSubmit) {
      const existing = await dbGet(
        `SELECT ticket_id, title, status FROM tickets WHERE created_by_id = ? AND unit_id = ? AND status NOT IN ('Closed','Completed (Provider)') AND (LOWER(TRIM(title)) = LOWER(TRIM(?)) OR SUBSTR(LOWER(TRIM(description)),1,40) = SUBSTR(LOWER(TRIM(?)),1,40))`,
        [creatorId, unitId, title || '', description]
      );
      if (existing) {
        return res.status(409).json({ isDuplicate: true, existingTicketId: existing.ticket_id, error: `A similar active ticket already exists: ${existing.ticket_id} — "${existing.title}" (Status: ${existing.status}). Submit anyway?` });
      }
    }

    const unit = await dbGet('SELECT * FROM units WHERE unit_id = ?', [unitId]);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    const prop = await dbGet('SELECT * FROM properties WHERE property_id = ?', [unit.property_id]);
    const ticketId = 'TKT-' + String(Date.now()).slice(-6);
    const sla = getSlaDeadlines(priority || aiFields?.overridePriority || 'MEDIUM');
    const imgJson = JSON.stringify(images || []);

    const effectivePriority = aiFields?.overridePriority || priority || 'MEDIUM';
    const aiOrig = aiFields?.suggestedCategory || null;

    await dbRun(
      `INSERT INTO tickets (ticket_id, unit_id, title, description, priority, status, category, ai_original_category, combined_confidence, conflict_detected, manual_review_required, created_by, created_by_id, property_name, unit_number, images, sla_response_before, sla_resolution_before)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ticketId, unitId, title || 'Maintenance Request', description.trim(),
       effectivePriority, aiFields?.manualReviewRequired ? 'Manual Review' : 'Open',
       aiOrig, aiOrig, aiFields?.combinedConfidence || null,
       aiFields?.conflictDetected ? 1 : 0, aiFields?.manualReviewRequired ? 1 : 0,
       creatorName, creatorId, prop?.name || unit.property_name || 'Unknown', unit.unit_number,
       imgJson, sla.sla_response_before, sla.sla_resolution_before]
    );

    await addTimeline(ticketId, 'CREATED', `Ticket created with ${aiFields?.combinedConfidence ? 'confidence ' + aiFields.combinedConfidence : 'no AI classification'}`, creatorName);
    const ticket = await dbGet('SELECT * FROM tickets WHERE ticket_id = ?', [ticketId]);
    res.status(201).json({ ...ticket, images: safeJson(ticket.images), completion_photos: safeJson(ticket.completion_photos) });
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const ticket = await dbGet('SELECT * FROM tickets WHERE ticket_id = ? OR id = ?', [req.params.id, req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const { title, description, category, priority } = req.body;
    const updates = {};
    if (title) updates.title = title.trim();
    if (description) updates.description = description.trim();
    if (category) updates.category = category;
    if (priority) updates.priority = priority;
    updates.updated_at = new Date().toISOString();
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const vals = Object.values(updates);
    if (sets) await dbRun(`UPDATE tickets SET ${sets} WHERE ticket_id = ?`, [...vals, ticket.ticket_id]);
    const updated = await dbGet('SELECT * FROM tickets WHERE ticket_id = ?', [ticket.ticket_id]);
    res.json({ ...updated, images: safeJson(updated.images), completion_photos: safeJson(updated.completion_photos) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const ticket = await dbGet('SELECT * FROM tickets WHERE ticket_id = ? OR id = ?', [req.params.id, req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const { status, comment } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    const allowed = TICKET_TRANSITIONS[ticket.status];
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid transition: ${ticket.status} → ${status}. Allowed: ${(allowed || []).join(', ')}` });
    }
    await dbRun('UPDATE tickets SET status = ?, updated_at = ? WHERE ticket_id = ?', [status, new Date().toISOString(), ticket.ticket_id]);
    await addTimeline(ticket.ticket_id, 'STATUS_CHANGE', comment || `Status changed from ${ticket.status} to ${status}`, req.user.name + ' ' + req.user.surname);
    const updated = await dbGet('SELECT * FROM tickets WHERE ticket_id = ?', [ticket.ticket_id]);
    await dbRun('INSERT INTO audit_logs (action, user_id, user_name, details) VALUES (?, ?, ?, ?)', ['STATUS_CHANGE', req.user.id, req.user.name + ' ' + req.user.surname, `Ticket ${ticket.ticket_id}: ${ticket.status} → ${status}`]);
    res.json({ ...updated, images: safeJson(updated.images), completion_photos: safeJson(updated.completion_photos) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.put('/:id/assign', authenticate, async (req, res) => {
  try {
    const ticket = await dbGet('SELECT * FROM tickets WHERE ticket_id = ? OR id = ?', [req.params.id, req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const { assignedTo, assignedToId } = req.body;
    if (!assignedTo) return res.status(400).json({ error: 'Assignee name required' });
    await dbRun('UPDATE tickets SET assigned_to = ?, assigned_to_id = ?, status = ?, updated_at = ? WHERE ticket_id = ?', [assignedTo, assignedToId || null, 'Assigned', new Date().toISOString(), ticket.ticket_id]);
    await addTimeline(ticket.ticket_id, 'ASSIGNED', `Assigned to ${assignedTo}`, req.user.name + ' ' + req.user.surname);
    const updated = await dbGet('SELECT * FROM tickets WHERE ticket_id = ?', [ticket.ticket_id]);
    res.json({ ...updated, images: safeJson(updated.images), completion_photos: safeJson(updated.completion_photos) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
});

router.put('/:id/decline', authenticate, async (req, res) => {
  try {
    const ticket = await dbGet('SELECT * FROM tickets WHERE ticket_id = ? OR id = ?', [req.params.id, req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.status !== 'Assigned') return res.status(400).json({ error: 'Only assigned tickets can be declined' });
    const { reason } = req.body;
    await dbRun('UPDATE tickets SET assigned_to = NULL, assigned_to_id = NULL, status = ?, updated_at = ? WHERE ticket_id = ?', ['Open', new Date().toISOString(), ticket.ticket_id]);
    await addTimeline(ticket.ticket_id, 'DECLINED', reason || 'Provider declined assignment', req.user.name + ' ' + req.user.surname);
    const updated = await dbGet('SELECT * FROM tickets WHERE ticket_id = ?', [ticket.ticket_id]);
    res.json({ ...updated, images: safeJson(updated.images), completion_photos: safeJson(updated.completion_photos) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to decline ticket' });
  }
});

router.put('/:id/complete', authenticate, async (req, res) => {
  try {
    const ticket = await dbGet('SELECT * FROM tickets WHERE ticket_id = ? OR id = ?', [req.params.id, req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!['In Progress', 'Waiting for Parts'].includes(ticket.status)) {
      return res.status(400).json({ error: 'Can only complete in-progress jobs' });
    }
    const { invoiceText, photoMetadata, providerName } = req.body;
    const photosJson = JSON.stringify(photoMetadata || []);
    await dbRun('UPDATE tickets SET status = ?, completion_invoice = ?, completion_photos = ?, updated_at = ? WHERE ticket_id = ?',
      ['Completed (Provider)', invoiceText?.trim() || '', photosJson, new Date().toISOString(), ticket.ticket_id]);
    await addTimeline(ticket.ticket_id, 'JOB_COMPLETED', `Provider marked complete. Invoice: ${invoiceText || 'none provided'}`, providerName || req.user.name + ' ' + req.user.surname);
    const updated = await dbGet('SELECT * FROM tickets WHERE ticket_id = ?', [ticket.ticket_id]);
    res.json({ ...updated, images: safeJson(updated.images), completion_photos: safeJson(updated.completion_photos) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete job' });
  }
});

router.put('/:id/rating', authenticate, async (req, res) => {
  try {
    const ticket = await dbGet('SELECT * FROM tickets WHERE ticket_id = ? OR id = ?', [req.params.id, req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.status !== 'Closed') return res.status(400).json({ error: 'Can only rate closed tickets' });
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    await dbRun('UPDATE tickets SET rating = ?, rating_comment = ?, rating_submitted_at = ?, updated_at = ? WHERE ticket_id = ?',
      [rating, (comment || '').trim(), new Date().toISOString(), new Date().toISOString(), ticket.ticket_id]);
    const updated = await dbGet('SELECT * FROM tickets WHERE ticket_id = ?', [ticket.ticket_id]);
    res.json({ ...updated, images: safeJson(updated.images), completion_photos: safeJson(updated.completion_photos) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const ticket = await dbGet('SELECT * FROM tickets WHERE ticket_id = ? OR id = ?', [req.params.id, req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    await dbRun('DELETE FROM tickets WHERE ticket_id = ?', [ticket.ticket_id]);
    await dbRun('DELETE FROM ticket_timeline WHERE ticket_id = ?', [ticket.ticket_id]);
    await dbRun('DELETE FROM ticket_comments WHERE ticket_id = ?', [ticket.ticket_id]);
    res.json({ message: 'Ticket deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
});

function safeJson(val) {
  try { return JSON.parse(val || '[]'); } catch { return []; }
}

module.exports = router;
