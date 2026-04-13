/**
 * LoopBridge — Storage Service
 *
 * Abstraction over file storage. Ships with a disk driver;
 * swap to S3 by setting STORAGE_DRIVER=s3 in env.
 *
 * Each driver implements: saveFiles(files, userId), deleteFile(record).
 * The repo metadata is always stored in SQLite / your DB of choice.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { uploadRepo } = require('../repositories');

// ─── MIME → sub-directory mapping ────────────────────────
const ALLOWED_TYPES = {
    'image/jpeg': 'images', 'image/png': 'images', 'image/gif': 'images',
    'image/webp': 'images', 'image/svg+xml': 'images',
    'video/mp4': 'videos', 'video/webm': 'videos', 'video/ogg': 'videos',
    'audio/mpeg': 'audio', 'audio/ogg': 'audio', 'audio/wav': 'audio',
    'audio/webm': 'audio',
};

function subdirFor(mimeType) {
    return ALLOWED_TYPES[mimeType] || 'other';
}

// ─── Disk Driver ─────────────────────────────────────────
const diskDriver = {
    init() {
        const dir = config.uploadsDir;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        ['images', 'videos', 'audio', 'other'].forEach(sub => {
            const p = path.join(dir, sub);
            if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
        });
    },

    /**
     * @param {Array} multerFiles – req.files from multer
     * @param {string|null} userId
     * @returns {Array} saved upload metadata objects
     */
    async saveFiles(multerFiles, userId) {
        const results = [];
        for (const file of multerFiles) {
            const id = uuidv4();
            const subdir = subdirFor(file.mimetype);
            const relativePath = `uploads/${subdir}/${file.filename}`;
            const url = `/${relativePath}`;

            await uploadRepo.create({
                id,
                filename: file.filename,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                path: relativePath,
                url,
                uploadedBy: userId
            });

            results.push({ id, filename: file.filename, originalName: file.originalname, mimeType: file.mimetype, size: file.size, url });
        }
        return results;
    },

    async deleteFile(record) {
        const fullPath = path.join(config.uploadsDir, '..', record.path);
        try {
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        } catch (err) {
            console.warn('[storage/disk] Failed to delete file:', err.message);
        }
        await uploadRepo.deleteById(record.id);
    }
};

// ─── S3 Driver (stub — implement when deploying to AWS) ──
const s3Driver = {
    init() {
        // AWS SDK v3 client init would go here
        console.log('[storage/s3] S3 driver initialised (bucket: %s)', config.s3Bucket);
    },

    async saveFiles(multerFiles, userId) {
        // TODO: upload each file to S3 using @aws-sdk/client-s3
        // Then store metadata via uploadRepo.create()
        throw new Error('S3 driver not yet implemented — set STORAGE_DRIVER=disk for local dev.');
    },

    async deleteFile(record) {
        // TODO: DeleteObjectCommand to S3, then uploadRepo.deleteById()
        throw new Error('S3 driver not yet implemented.');
    }
};

// ─── Exported interface ──────────────────────────────────
const driver = config.storageDriver === 's3' ? s3Driver : diskDriver;

const storageService = {
    ALLOWED_TYPES,

    init() {
        driver.init();
    },

    async saveFiles(multerFiles, userId) {
        return driver.saveFiles(multerFiles, userId);
    },

    async deleteFile(record) {
        return driver.deleteFile(record);
    },

    async getById(id) {
        return uploadRepo.findByIdFormatted(id);
    },

    async list(filters) {
        return uploadRepo.list(filters);
    },

    async getRawById(id) {
        return uploadRepo.findById(id);
    }
};

module.exports = storageService;
