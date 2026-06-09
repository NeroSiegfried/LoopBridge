/**
 * LoopBridge — Upload Routes (thin controller)
 *
 * POST   /api/uploads         — upload one or more files (auth: author+)
 * GET    /api/uploads         — list uploads (auth: author+)
 * GET    /api/uploads/:id     — get upload metadata
 * DELETE /api/uploads/:id     — delete upload (auth: owner / admin)
 */
'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const config = require('../config');
const { requireAuth, requireAuthor } = require('../middleware/auth');
const { storageService } = require('../services');
const transcodingService = require('../services/transcodingService');

const router = express.Router();

function toPositiveInt(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getClientProvidedDimensions(body, index) {
    if (!body) return null;

    const rawWidth = Array.isArray(body.videoWidth) ? body.videoWidth[index] : body.videoWidth;
    const rawHeight = Array.isArray(body.videoHeight) ? body.videoHeight[index] : body.videoHeight;
    const width = toPositiveInt(rawWidth);
    const height = toPositiveInt(rawHeight);

    if (!width || !height) return null;
    return { width, height };
}

// ─── Multer config (disk storage — used for both disk and S3 drivers) ───
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const subdir = storageService.ALLOWED_TYPES[file.mimetype] || 'other';
        cb(null, path.join(config.uploadsDir, subdir));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const safeName = file.originalname
            .replace(ext, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 60);
        cb(null, `${safeName}-${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: config.maxFileSize },
    fileFilter: (req, file, cb) => {
        if (storageService.ALLOWED_TYPES[file.mimetype]) {
            cb(null, true);
        } else {
            cb(new Error(`File type "${file.mimetype}" is not allowed.`), false);
        }
    }
});

// ─── POST /api/uploads ──────────────────────────────────
router.post('/', requireAuthor, upload.array('files', config.maxFiles), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded.' });
    }

    // Probe video dimensions BEFORE saveFiles (S3 driver deletes temp file after upload)
    const ffmpeg = require('fluent-ffmpeg');
    const probedDimensions = await Promise.all(req.files.map(async (file) => {
        if (!file.mimetype.startsWith('video/')) return null;
        try {
            const meta = await new Promise((resolve, reject) => {
                ffmpeg.ffprobe(file.path, (err, data) => err ? reject(err) : resolve(data));
            });
            const vs = meta.streams.find(s => s.codec_type === 'video');
            if (!vs) return null;
            // Account for rotation metadata (e.g. portrait phone videos encoded as 1920x1080 + rotate:90)
            const rotate = parseInt(vs.tags?.rotate || vs.rotation || '0', 10);
            const swapped = Math.abs(rotate) === 90 || Math.abs(rotate) === 270;
            return swapped
                ? { width: vs.height, height: vs.width }
                : { width: vs.width, height: vs.height };
        } catch (e) {
            console.warn('[uploads] ffprobe failed for', file.originalname, e.message);
            return null;
        }
    }));

    const clientProvidedDimensions = req.files.map((_, index) => getClientProvidedDimensions(req.body, index));

    const results = await storageService.saveFiles(req.files, req.user ? req.user.id : null);

    // Store dimensions and auto-trigger transcoding for video uploads (non-blocking)
    const { uploadRepo } = require('../repositories');
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const dims = probedDimensions[i] || clientProvidedDimensions[i];
        if (dims) {
            await uploadRepo.updateDimensions(result.id, dims.width, dims.height);
            result.videoWidth = dims.width;
            result.videoHeight = dims.height;
        }
        if (result.mimeType && result.mimeType.startsWith('video/')) {
            // Fire and forget — don't block the upload response
            const rawRecord = await storageService.getRawById(result.id);
            if (rawRecord) {
                transcodingService.transcodeVideo(result.id, rawRecord.path).catch(err => {
                    console.warn('[uploads] Auto-transcode failed for', result.id, err.message);
                });
            }
        }
    }

    return res.status(201).json(results.length === 1 ? results[0] : results);
});

// ─── GET /api/uploads ───────────────────────────────────
router.get('/', requireAuthor, async (req, res) => {
    const { type, limit } = req.query;
    return res.json(await storageService.list({ type, limit }));
});

// ─── GET /api/uploads/:id ───────────────────────────────
router.get('/:id', async (req, res) => {
    const upload = await storageService.getById(req.params.id);
    if (!upload) return res.status(404).json({ error: 'Upload not found.' });
    return res.json(upload);
});

// ─── DELETE /api/uploads/:id ────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
    const record = await storageService.getRawById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Upload not found.' });

    if (req.user.role !== 'admin' && record.uploaded_by !== req.user.id) {
        return res.status(403).json({ error: 'Permission denied.' });
    }

    await storageService.deleteFile(record);
    return res.json({ ok: true });
});

// ─── Multer error handler ───────────────────────────────
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: `File too large. Max ${config.maxFileSize / 1024 / 1024} MB.` });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
});

module.exports = router;
