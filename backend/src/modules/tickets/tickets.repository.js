import { query } from '../../db/connection.js';

function toSnakeTicket(row) {
  if (!row) return null;
  return {
    id: row.id,
    unit_id: row.unit_id,
    property_id: row.property_id ?? null,
    tenant_id: row.tenant_id,
    category: row.category,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    source: row.source,
    assigned_to: row.assigned_to,
    auto_assigned: row.auto_assigned ?? false,
    auto_assigned_at: row.auto_assigned_at ?? null,
    no_provider_flagged_at: row.no_provider_flagged_at ?? null,
    ai_text_label: row.ai_text_label,
    ai_visual_label: row.ai_visual_label,
    ai_text_confidence: row.ai_text_confidence,
    ai_visual_confidence: row.ai_visual_confidence,
    ai_original_label: row.ai_original_label ?? null,
    ai_corrected_label: row.ai_corrected_label ?? null,
    ai_overridden_by: row.ai_overridden_by ?? null,
    ai_overridden_at: row.ai_overridden_at ?? null,
    ai_category: row.ai_category ?? null,
    conflict_detected: row.conflict_detected,
    visual_emergency: row.visual_emergency,
    pm_confirmed: row.pm_confirmed,
    emergency_assigned_at: row.emergency_assigned_at,
    sla_breached: row.sla_breached,
    due_date: row.due_date,
    deleted_at: row.deleted_at ?? null,
    deleted_by: row.deleted_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    property_name: row.property_name ?? null,
    unit_number: row.unit_number ?? null,
    created_by_name: row.created_by_name ?? null,
    assigned_to_name: row.assigned_to_name ?? null,
    provider_rating: row.provider_rating ?? null,
    provider_rating_count: row.provider_rating_count ?? null,
    acceptance_note: row.acceptance_note ?? null,
  };
}

const TICKET_JOINS = `
  LEFT JOIN units u ON u.id = t.unit_id
  LEFT JOIN properties p ON p.id = u.property_id
  LEFT JOIN users tenant_user ON tenant_user.id = t.tenant_id
  LEFT JOIN service_providers sp ON sp.id = t.assigned_to
`;

const findById = async (id) => {
  const result = await query(
    `SELECT t.*, p.name AS property_name, u.unit_number, u.property_id,
            TRIM(CONCAT(tenant_user.name, ' ', tenant_user.surname)) AS created_by_name,
            sp.name AS assigned_to_name,
            sp.rating AS provider_rating, sp.rating_count AS provider_rating_count,
            (SELECT h.reason FROM ticket_status_history h
              WHERE h.ticket_id = t.id AND h.status = 'Accepted'
              ORDER BY h.created_at DESC LIMIT 1) AS acceptance_note
     FROM tickets t
     ${TICKET_JOINS}
     WHERE t.id = $1 AND t.deleted_at IS NULL`,
    [id]
  );
  return toSnakeTicket(result.rows[0]);
};

const findByIdIncludingDeleted = async (id) => {
  const result = await query(
    `SELECT t.*, p.name AS property_name, u.unit_number, u.property_id,
            TRIM(CONCAT(tenant_user.name, ' ', tenant_user.surname)) AS created_by_name,
            sp.name AS assigned_to_name,
            sp.rating AS provider_rating, sp.rating_count AS provider_rating_count,
            (SELECT h.reason FROM ticket_status_history h
              WHERE h.ticket_id = t.id AND h.status = 'Accepted'
              ORDER BY h.created_at DESC LIMIT 1) AS acceptance_note
     FROM tickets t
     ${TICKET_JOINS}
     WHERE t.id = $1`,
    [id]
  );
  return toSnakeTicket(result.rows[0]);
};

const findAll = async (filters = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.deleted === 'true') {
    conditions.push('t.deleted_at IS NOT NULL');
  } else {
    conditions.push('t.deleted_at IS NULL');
  }

  if (filters.status) {
    conditions.push(`t.status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.priority) {
    conditions.push(`t.priority = $${idx++}`);
    params.push(filters.priority);
  }
  if (filters.tenant_id) {
    conditions.push(`t.tenant_id = $${idx++}`);
    params.push(filters.tenant_id);
  }
  if (filters.assigned_to) {
    conditions.push(`t.assigned_to = $${idx++}`);
    params.push(filters.assigned_to);
  }
  if (filters.unit_id) {
    conditions.push(`t.unit_id = $${idx++}`);
    params.push(filters.unit_id);
  }
  if (filters.manager_id) {
    conditions.push(`p.manager_id = $${idx++}`);
    params.push(filters.manager_id);
  }
  if (filters.search) {
    conditions.push(`(t.title ILIKE $${idx} OR t.description ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const FIELD_MAP = {
    't.created_at': 't.created_at',
    'created_at': 't.created_at',
    't.updated_at': 't.updated_at',
    'updated_at': 't.updated_at',
    't.due_date': 't.due_date',
    'due_date': 't.due_date',
    't.priority': 't.priority',
    'priority': 't.priority',
    't.status': 't.status',
    'status': 't.status',
  };

  const orderClause = filters.orderBy || 'created_at DESC';
  const parts = orderClause.split(' ');
  const rawField = parts[0];
  const direction = (parts[1] || 'DESC').toUpperCase();
  const orderField = FIELD_MAP[rawField] || 't.created_at';
  const safeDir = direction === 'ASC' ? 'ASC' : 'DESC';

  const limit = filters.limit ? parseInt(filters.limit) : null;
  const offset = filters.offset ? parseInt(filters.offset) : null;

  const countResult = await query(
    `SELECT COUNT(*) FROM tickets t ${TICKET_JOINS} ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  let sql = `SELECT t.*, p.name AS property_name, u.unit_number, u.property_id,
                    TRIM(CONCAT(tenant_user.name, ' ', tenant_user.surname)) AS created_by_name,
                    sp.name AS assigned_to_name,
                    sp.rating AS provider_rating, sp.rating_count AS provider_rating_count,
                    (SELECT h.reason FROM ticket_status_history h
                      WHERE h.ticket_id = t.id AND h.status = 'Accepted'
                      ORDER BY h.created_at DESC LIMIT 1) AS acceptance_note
             FROM tickets t
             ${TICKET_JOINS}
             ${whereClause}
             ORDER BY ${orderField} ${safeDir}`;

  if (limit !== null) {
    sql += ` LIMIT $${idx++}`;
    params.push(limit);
  }
  if (offset !== null) {
    sql += ` OFFSET $${idx++}`;
    params.push(offset);
  }

  const result = await query(sql, params);
  return { tickets: result.rows.map(toSnakeTicket), total };
};

const create = async (data) => {
  const { unit_id, tenant_id, category, title, description, priority, source } = data;
  const result = await query(
    `INSERT INTO tickets (unit_id, tenant_id, category, title, description, priority, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      unit_id || null, tenant_id || null,
      category || 'General', title, description, priority || 'MEDIUM',
      source || 'tenant_portal',
    ]
  );
  return toSnakeTicket(result.rows[0]);
};

const update = async (id, data) => {
  const entries = Object.entries(data).filter(([_, v]) => v !== undefined);
  if (entries.length === 0) return findById(id);

  const setClauses = [];
  const params = [];
  let idx = 1;
  for (const [key, value] of entries) {
    setClauses.push(`${key} = $${idx++}`);
    params.push(value);
  }
  params.push(id);
  await query(
    `UPDATE tickets SET ${setClauses.join(', ')} WHERE id = $${idx}`,
    params
  );
  return findById(id);
};

const softDelete = async (id, userId) => {
  await query(
    'UPDATE tickets SET deleted_at = NOW(), deleted_by = $2, updated_at = NOW() WHERE id = $1',
    [id, userId]
  );
  return findByIdIncludingDeleted(id);
};

const restore = async (id) => {
  await query(
    'UPDATE tickets SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW() WHERE id = $1',
    [id]
  );
  return findByIdIncludingDeleted(id);
};

const addHistory = async (ticketId, status, changedBy, changedByName, reason) => {
  await query(
    'INSERT INTO ticket_status_history (ticket_id, status, changed_by, changed_by_name, reason) VALUES ($1, $2, $3, $4, $5)',
    [ticketId, status, changedBy || null, changedByName || null, reason || null]
  );
};

const getHistory = async (ticketId) => {
  const result = await query(
    'SELECT * FROM ticket_status_history WHERE ticket_id = $1 ORDER BY created_at ASC',
    [ticketId]
  );
  return result.rows.map(r => ({
    id: r.id,
    ticket_id: r.ticket_id,
    status: r.status,
    changed_by: r.changed_by,
    changed_by_name: r.changed_by_name,
    reason: r.reason,
    created_at: r.created_at,
  }));
};

const getComments = async (ticketId) => {
  const result = await query(
    `SELECT tc.*, u.name, u.surname
     FROM ticket_comments tc
     LEFT JOIN users u ON u.id = tc.user_id
     WHERE tc.ticket_id = $1
     ORDER BY tc.created_at ASC`,
    [ticketId]
  );
  return result.rows.map(r => ({
    id: r.id,
    ticket_id: r.ticket_id,
    user_id: r.user_id,
    comment: r.comment,
    created_at: r.created_at,
    name: r.name ?? null,
    surname: r.surname ?? null,
  }));
};

const addComment = async (ticketId, userId, comment) => {
  const result = await query(
    'INSERT INTO ticket_comments (ticket_id, user_id, comment) VALUES ($1, $2, $3) RETURNING *',
    [ticketId, userId, comment]
  );
  const row = result.rows[0];
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    user_id: row.user_id,
    comment: row.comment,
    created_at: row.created_at,
  };
};

const addRating = async (ticketId, userId, ratingValue, comment) => {
  await query(
    'INSERT INTO performance_ratings (ticket_id, rated_by, rating, comment) VALUES ($1, $2, $3, $4)',
    [ticketId, userId, ratingValue, comment || null]
  );
};

const getOverdueTickets = async () => {
  const result = await query(
    `SELECT t.*, p.name AS property_name, u.unit_number, u.property_id
     FROM tickets t
     LEFT JOIN units u ON u.id = t.unit_id
     LEFT JOIN properties p ON p.id = u.property_id
     WHERE t.status NOT IN ('Completed', 'Cancelled', 'Archived')
       AND t.deleted_at IS NULL
       AND t.due_date < NOW()`
  );
  return result.rows.map(toSnakeTicket);
};

const getAttachments = async (ticketId) => {
  const result = await query(
    `SELECT ta.*, u.name AS uploaded_by_name, u.surname AS uploaded_by_surname
     FROM ticket_attachments ta
     LEFT JOIN users u ON u.id = ta.uploaded_by
     WHERE ta.ticket_id = $1
     ORDER BY ta.uploaded_at DESC`,
    [ticketId]
  );
  return result.rows;
};

const addAttachment = async (ticketId, file, userId) => {
  const result = await query(
    `INSERT INTO ticket_attachments (ticket_id, file_key, file_type, uploaded_by)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [ticketId, file.filename || file.originalname, file.mimetype || 'application/octet-stream', userId]
  );
  return result.rows[0];
};

const removeAttachment = async (ticketId, attachmentId) => {
  await query('DELETE FROM ticket_attachments WHERE id = $1 AND ticket_id = $2', [attachmentId, ticketId]);
};

const getAttachmentById = async (attachmentId) => {
  const result = await query('SELECT * FROM ticket_attachments WHERE id = $1', [attachmentId]);
  return result.rows[0] || null;
};

const getAttachmentsForTickets = async (ticketIds) => {
  if (!ticketIds || ticketIds.length === 0) return [];
  const result = await query(
    `SELECT ta.*, u.name AS uploaded_by_name, u.surname AS uploaded_by_surname
     FROM ticket_attachments ta
     LEFT JOIN users u ON u.id = ta.uploaded_by
     WHERE ta.ticket_id = ANY($1::uuid[])
     ORDER BY ta.uploaded_at DESC`,
    [ticketIds]
  );
  return result.rows;
};

export { findById, findByIdIncludingDeleted, findAll, create, update, softDelete, restore, addHistory, getHistory, getComments, addComment, addRating, getOverdueTickets, getAttachments, addAttachment, removeAttachment, getAttachmentById, getAttachmentsForTickets };
