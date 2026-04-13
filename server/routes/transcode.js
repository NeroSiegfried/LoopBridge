/**
 * LoopBridge — Transcoding Routes
 *
 * POST /api/transcode/:uploadId        — trigger transcoding for a video upload
 * GET  /api/transcode/:uploadId/status  — check transcoding job status
 *
 * These are called by the admin/course editor after uploading a video.
 * Transcoding is also triggered automatically on video upload (see uploads route).
 */
'use strict';

const express = require('express');
const { requireAuthor } = require('../middleware/auth');
const { storageService } = require('../services');
const transcodingService = require('../services/transcodingService');

const router = express.Router();

// ─── POST /api/transcode/:uploadId ─────────────────────
router.post('/:uploadId', requireAuthor, async (req, res) => {
    try {
        const upload = await storageService.getRawById(req.params.uploadId);
        if (!upload) return res.status(404).json({ error: 'Upload not found.' });

        if (!upload.mime_type.startsWith('video/')) {
            return res.status(400).json({ error: 'Only video files can be transcoded.' });
        }

        const result = await transcodingService.transcodeVideo(upload.id, upload.path);
        if (!result) {
            return res.status(503).json({ error: 'Transcoding not configured. Set MEDIACONVERT_ROLE_ARN and MEDIACONVERT_ENDPOINT.' });
        }

        return res.json(result);
    } catch (err) {
        console.error('[transcode route]', err.message);
        return res.status(500).json({ error: 'Failed to start transcoding.' });
    }
});

// ─── GET /api/transcode/:uploadId/status ────────────────
router.get('/:uploadId/status', requireAuthor, async (req, res) => {
    try {
        const upload = await storageService.getRawById(req.params.uploadId);
        if (!upload) return res.status(404).json({ error: 'Upload not found.' });

        // If we have a job ID, check with MediaConvert
        if (upload.transcode_job_id) {
            try {
                const status = await transcodingService.getJobStatus(upload.transcode_job_id);
                return res.json({
                    uploadId: upload.id,
                    ...status,
                    hlsUrl: upload.hls_url,
                    thumbnailUrl: upload.thumbnail_url,
                });
            } catch (err) {
                return res.json({
                    uploadId: upload.id,
                    status: upload.transcode_status || 'unknown',
                    hlsUrl: upload.hls_url,
                    thumbnailUrl: upload.thumbnail_url,
                });
            }
        }

        return res.json({
            uploadId: upload.id,
            status: upload.transcode_status || 'none',
            hlsUrl: upload.hls_url || null,
            thumbnailUrl: upload.thumbnail_url || null,
        });
    } catch (err) {
        console.error('[transcode status]', err.message);
        return res.status(500).json({ error: 'Failed to get transcode status.' });
    }
});

module.exports = router;
