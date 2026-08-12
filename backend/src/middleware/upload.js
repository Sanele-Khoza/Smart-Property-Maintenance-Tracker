import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import config from '../config/index.js';
import AppError from '../shared/errors/AppError.js';
import { moderateImage } from '../shared/adapters/rekognitionAdapter.js';
import { uploadFile as uploadS3, deleteFile as deleteS3 } from '../shared/adapters/s3Adapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', '..', config.upload.uploadDir);

if (!config.aws.enabled) {
  mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

const storage = config.aws.enabled
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, LOCAL_UPLOAD_DIR),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
      },
    });

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.sheet'];
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(AppError.badRequest(`File type ${file.mimetype} not allowed`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize },
});

async function moderateUpload(req, res, next) {
  if (!req.file) return next();
  if (!IMAGE_MIMES.includes(req.file.mimetype)) return next();

  try {
    const buffer = config.aws.enabled
      ? req.file.buffer
      : await fs.readFile(req.file.path);

    const result = await moderateImage(buffer);

    if (!result.safe) {
      if (!config.aws.enabled) await fs.unlink(req.file.path).catch(() => {});
      return next(AppError.badRequest(
        `Image rejected by moderation: ${result.labels.join(', ')}`
      ));
    }

    if (config.aws.enabled) {
      const key = req.file.originalname ? `${uuidv4()}-${req.file.originalname}` : `${uuidv4()}`;
      req.file.filename = key;
      await fs.writeFile(path.join(LOCAL_UPLOAD_DIR, key), buffer).catch(() => {});
      await uploadS3(buffer, key, req.file.mimetype).catch((err) => console.warn('S3 upload failed:', err.message));
    }

    req.moderated = result;
    next();
  } catch (err) {
    next(err);
  }
}

export default upload;
export { moderateUpload, uploadS3, deleteS3 };
