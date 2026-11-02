import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { config } from '../config.js';
import { badRequest } from '../lib/errors.js';
import { isAgent } from '../middleware/rbac.js';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || '.bin';
    cb(null, `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) return cb(badRequest(`نوع ملف غير مدعوم: ${file.mimetype}`));
    cb(null, true);
  },
});

const router = Router();

router.post('/', isAgent, upload.array('files', 10), (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw badRequest('لم يتم إرسال ملفات');
    res.status(201).json({
      files: files.map((f) => ({ url: `${config.apiBase}/uploads/${f.filename}`, name: f.originalname, size: f.size, type: f.mimetype })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
