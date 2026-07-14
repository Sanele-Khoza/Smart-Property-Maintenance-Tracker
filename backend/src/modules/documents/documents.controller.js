import * as service from './documents.service.js';

const list = async (req, res, next) => { try { const result = await service.list(req.query); res.json(result); } catch (err) { next(err); } };
const getById = async (req, res, next) => { try { const result = await service.getById(Number(req.params.id)); res.json(result); } catch (err) { next(err); } };
const upload = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const doc = await service.create({
      name: req.file.originalname,
      type: req.body.type || 'document',
      file_path: req.file.path,
      file_url: `/uploads/${req.file.filename}`,
      description: req.body.description || null,
    }, req.user.id);
    res.status(201).json(doc);
  } catch (err) { next(err); }
};
const remove = async (req, res, next) => { try { const result = await service.remove(Number(req.params.id)); res.json(result); } catch (err) { next(err); } };

export { list, getById, upload, remove };
