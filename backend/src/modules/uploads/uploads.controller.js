import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { query } from '../../db/connection.js';
import AppError from '../../shared/errors/AppError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const list = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM documents ORDER BY uploaded_at DESC');
    res.json({ success: true, data: { documents: result.rows } });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM documents WHERE id = $1', [Number(req.params.id)]);
    if (!result.rows.length) throw AppError.notFound('Document not found');
    res.json({ success: true, data: { document: result.rows[0] } });
  } catch (err) { next(err); }
};

const upload = async (req, res, next) => {
  try {
    if (!req.file) throw AppError.badRequest('No file uploaded');
    const result = await query(
      'INSERT INTO documents (name, type, file_path, file_url, uploaded_by, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.file.originalname, req.file.mimetype, req.file.path, `/uploads/${req.file.filename}`, req.user.id, req.body.description || null]
    );
    res.status(201).json({ success: true, data: { document: result.rows[0] }, message: 'File uploaded' });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const doc = await query('SELECT * FROM documents WHERE id = $1', [Number(req.params.id)]);
    if (doc.rows.length) {
      const filePath = doc.rows[0].file_path;
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    await query('DELETE FROM documents WHERE id = $1', [Number(req.params.id)]);
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) { next(err); }
};

export { list, getById, upload, remove };
