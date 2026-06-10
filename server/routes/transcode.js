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
const { uploadRepo } = require('../repositories');
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

        // Fire and forget — same pattern as the auto-trigger on upload
        // (see routes/uploads.js). Without this, the local-ffmpeg fallback
        // path (used when MediaConvert isn't configured) would block this
        // request for the full duration of the transcode. Progress is
        // pollable via GET /api/transcode/:uploadId/status.
        await uploadRepo.updateTranscodeStatus(upload.id, { transcodeStatus: 'processing' });
        transcodingService.transcodeVideo(upload.id, upload.path).catch((err) => {
            console.error('[transcode route] Transcode failed for', upload.id, err.message);
        });

        return res.status(202).json({ uploadId: upload.id, status: 'processing' });
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
                    videoWidth: upload.video_width || null,
                    videoHeight: upload.video_height || null,
                });
            } catch (err) {
                return res.json({
                    uploadId: upload.id,
                    status: upload.transcode_status || 'unknown',
                    hlsUrl: upload.hls_url,
                    thumbnailUrl: upload.thumbnail_url,
                    videoWidth: upload.video_width || null,
                    videoHeight: upload.video_height || null,
                });
            }
        }

        return res.json({
            uploadId: upload.id,
            status: upload.transcode_status || 'none',
            hlsUrl: upload.hls_url || null,
            thumbnailUrl: upload.thumbnail_url || null,
            videoWidth: upload.video_width || null,
            videoHeight: upload.video_height || null,
        });
    } catch (err) {
        console.error('[transcode status]', err.message);
        return res.status(500).json({ error: 'Failed to get transcode status.' });
    }
});

// ─── POST /api/transcode/webhook ────────────────────────
// Called by the EventBridge → Lambda callback when MediaConvert finishes.
// No auth — secured by a shared secret token in the Authorization header.
router.post('/webhook', async (req, res) => {
    const expectedToken = process.env.TRANSCODE_WEBHOOK_SECRET || 'loopbridge-transcode-callback';
    const authHeader = req.headers.authorization || '';
    if (authHeader !== `Bearer ${expectedToken}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { uploadId, status, hlsUrl, errorMessage } = req.body;
    if (!uploadId || !status) {
        return res.status(400).json({ error: 'uploadId and status are required.' });
    }

    try {
        const update = { transcodeStatus: status };
        if (hlsUrl) update.hlsUrl = hlsUrl;
        if (errorMessage) update.transcodeError = errorMessage;

        await uploadRepo.updateTranscodeStatus(uploadId, update);
        console.log(`[transcode webhook] Updated upload ${uploadId} → ${status}`);
        return res.json({ ok: true });
    } catch (err) {
        console.error('[transcode webhook]', err.message);
        return res.status(500).json({ error: 'Failed to update status.' });
    }
});

module.exports = router;
