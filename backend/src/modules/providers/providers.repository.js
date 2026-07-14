import { query } from '../../db/connection.js';

const findTechnicianByEmail = async (email) => {
  const result = await query('SELECT * FROM technicians WHERE email = $1', [email]);
  return result.rows[0] || null;
};

const findUserEmailById = async (userId) => {
  const result = await query('SELECT email FROM users WHERE id = $1', [userId]);
  return result.rows[0] || null;
};

const findTechnicianById = async (id) => {
  const result = await query('SELECT * FROM technicians WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const updateTechnicianStatus = async (techId, status) => {
  await query('UPDATE technicians SET availability_status = $1 WHERE id = $2', [status, techId]);
};

const updateTechnicianLocation = async (techId, latitude, longitude) => {
  await query(
    'UPDATE technicians SET gps_latitude = $1, gps_longitude = $2, last_location_update = NOW() WHERE id = $3',
    [latitude, longitude, techId]
  );
};

export { findTechnicianByEmail, findUserEmailById, findTechnicianById, updateTechnicianStatus, updateTechnicianLocation };
