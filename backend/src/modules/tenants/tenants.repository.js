import { query } from '../../db/connection.js';

const findTicketsByTenant = async (tenantId) => {
  const result = await query(
    `SELECT t.*, u.unit_number, p.name AS property_name,
            c.name AS category_name, c.icon AS category_icon, c.color AS category_color
     FROM tickets t
     LEFT JOIN units u ON u.id = t.unit_id
     LEFT JOIN properties p ON p.id = t.property_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.tenant_id = $1
     ORDER BY t.created_by_date DESC`,
    [tenantId]
  );
  return result.rows;
};

const findUserById = async (id) => {
  const result = await query(
    'SELECT id, name, surname, email, phone, role, status, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};

const findUnitsByOccupant = async (userId) => {
  const result = await query(
    `SELECT u.*, p.name AS property_name, p.address AS property_address
     FROM units u
     LEFT JOIN properties p ON p.id = u.property_id
     WHERE u.occupant_id = $1`,
    [userId]
  );
  return result.rows;
};

const updateProfile = async (userId, fields) => {
  const updates = [];
  const params = [];
  let idx = 1;
  if (fields.name) { updates.push(`name = $${idx++}`); params.push(fields.name); }
  if (fields.surname) { updates.push(`surname = $${idx++}`); params.push(fields.surname); }
  if (fields.phone !== undefined) { updates.push(`phone = $${idx++}`); params.push(fields.phone); }
  if (updates.length === 0) return null;
  params.push(userId);
  await query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, params);
  return findUserById(userId);
};

export { findTicketsByTenant, findUserById, findUnitsByOccupant, updateProfile };
