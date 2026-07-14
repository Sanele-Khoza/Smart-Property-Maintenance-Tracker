import { query } from '../../db/connection.js';
import AppError from '../../shared/errors/AppError.js';

const PROFILE_FIELDS = 'id, name, surname, email, phone, role, avatar_url, created_at';

const getProfile = async (req, res, next) => {
  try {
    const userResult = await query(
      `SELECT ${PROFILE_FIELDS} FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!userResult.rows.length) throw AppError.notFound('User not found');
    const unitsResult = await query(
      `SELECT u.*, p.name AS property_name, p.address AS property_address
       FROM units u
       LEFT JOIN properties p ON p.id = u.property_id
       WHERE u.occupant_id = $1`,
      [req.user.id]
    );
    res.json({ success: true, data: { user: userResult.rows[0], units: unitsResult.rows } });
  } catch (err) { next(err); }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, surname, phone } = req.body;
    const updates = [];
    const params = [];
    let idx = 1;
    if (name) { updates.push(`name = $${idx++}`); params.push(name); }
    if (surname) { updates.push(`surname = $${idx++}`); params.push(surname); }
    if (phone !== undefined) { updates.push(`phone = $${idx++}`); params.push(phone); }
    if (updates.length === 0) throw AppError.badRequest('No fields to update');
    params.push(req.user.id);
    await query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, params);
    const result = await query(`SELECT ${PROFILE_FIELDS} FROM users WHERE id = $1`, [req.user.id]);
    res.json({ success: true, data: { user: result.rows[0] }, message: 'Profile updated' });
  } catch (err) { next(err); }
};

const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) throw AppError.badRequest('No file uploaded');
    const avatarUrl = `/uploads/${req.file.filename}`;
    await query('UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2', [avatarUrl, req.user.id]);
    const result = await query(`SELECT ${PROFILE_FIELDS} FROM users WHERE id = $1`, [req.user.id]);
    res.json({ success: true, data: { user: result.rows[0] }, message: 'Avatar updated' });
  } catch (err) { next(err); }
};

export { getProfile, updateProfile, uploadAvatar };
