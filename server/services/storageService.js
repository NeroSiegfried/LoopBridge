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
    'video/quicktime': 'videos', 'video/x-msvideo': 'videos',
    'audio/mpeg': 'audio', 'audio/ogg': 'audio', 'audio/wav': 'audio',
    'audio/webm': 'audio', 'audio/aac': 'audio',
    'application/pdf': 'documents',
    'application/msword': 'documents',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'documents',
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

// ─── S3 Driver ───────────────────────────────────────────
const s3Driver = {
    _client: null,

    client() {
        if (!this._client) {
            const { S3Client } = require('@aws-sdk/client-s3');
            this._client = new S3Client({ region: config.s3Region || 'us-east-1' });
        }
        return this._client;
    },

    init() {
        if (!config.s3Bucket) throw new Error('[storage/s3] S3_BUCKET env var is required.');
        this.client(); // eagerly init
        console.log('[storage/s3] S3 driver initialised (bucket: %s)', config.s3Bucket);
    },

    async saveFiles(multerFiles, userId) {
        const { PutObjectCommand } = require('@aws-sdk/client-s3');
        const results = [];

        for (const file of multerFiles) {
            const id = uuidv4();
            const subdir = subdirFor(file.mimetype);
            const key = `${config.s3Prefix || 'uploads/'}${subdir}/${id}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const publicUrl = config.cdnBaseUrl
                ? `${config.cdnBaseUrl}/${key}`
                : `https://${config.s3Bucket}.s3.${config.s3Region || 'us-east-1'}.amazonaws.com/${key}`;

            const fileBuffer = fs.readFileSync(file.path);
            await this.client().send(new PutObjectCommand({
                Bucket: config.s3Bucket,
                Key: key,
                Body: fileBuffer,
                ContentType: file.mimetype,
                ContentDisposition: 'inline',
                // Public read is granted via bucket policy, not per-object ACL.
                // (Per-object ACL requires "Block Public Access" to be fully disabled,
                //  which is off by default and unsafe. Use the bucket policy below instead.)
            }));

            // Clean up temp file left by multer
            try { fs.unlinkSync(file.path); } catch (_) {}

            await uploadRepo.create({
                id,
                filename: path.basename(key),
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                path: key,
                url: publicUrl,
                uploadedBy: userId
            });

            results.push({ id, filename: path.basename(key), originalName: file.originalname, mimeType: file.mimetype, size: file.size, url: publicUrl });
        }
        return results;
    },

    async deleteFile(record) {
        const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
        try {
            await this.client().send(new DeleteObjectCommand({
                Bucket: config.s3Bucket,
                Key: record.path,
            }));
        } catch (err) {
            console.warn('[storage/s3] Failed to delete S3 object:', err.message);
        }
        await uploadRepo.deleteById(record.id);
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

/**
 * Upload a file buffer to S3.
 * Used by transcodingService to upload transcoded HLS files.
 * 
 * @param {Buffer} fileContent - the file data
 * @param {string} s3Key - the S3 object key (e.g., "transcoded/abc-123/manifest.m3u8")
 * @param {string} filename - the original filename (for MIME type detection)
 */
async function uploadToS3(fileContent, s3Key, filename) {
    if (!config.s3Bucket) {
        throw new Error('[storage] S3_BUCKET env var is required for S3 uploads');
    }
    
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: config.s3Region || 'us-east-1' });
    
    // Detect MIME type from filename
    let contentType = 'application/octet-stream';
    if (filename.endsWith('.m3u8')) contentType = 'application/vnd.apple.mpegurl';
    else if (filename.endsWith('.ts')) contentType = 'video/mp2t';
    else if (filename.endsWith('.jpg')) contentType = 'image/jpeg';
    else if (filename.endsWith('.mp4')) contentType = 'video/mp4';
    
    const command = new PutObjectCommand({
        Bucket: config.s3Bucket,
        Key: s3Key,
        Body: fileContent,
        ContentType: contentType,
    });
    
    await s3.send(command);
}

module.exports = { ...storageService, uploadToS3 };
