/**
 * LoopBridge — Video Transcoding Service
 *
 * Triggers AWS MediaConvert jobs to transcode uploaded videos into HLS
 * (HTTP Live Streaming) at multiple quality levels for adaptive bitrate.
 *
 * Flow:
 *   1. Author uploads a video via /api/uploads
 *   2. storageService saves it to S3 (e.g. uploads/videos/<id>-file.mp4)
 *   3. This service creates a MediaConvert job that outputs:
 *      - transcoded/<uploadId>/manifest.m3u8   (master playlist)
 *      - transcoded/<uploadId>/1080p/          (segments)
 *      - transcoded/<uploadId>/720p/           (segments)
 *      - transcoded/<uploadId>/480p/           (segments)
 *      - transcoded/<uploadId>/360p/           (segments)
 *      - transcoded/<uploadId>/thumb.jpg       (thumbnail at 3s)
 *   4. The upload record is updated with hlsUrl pointing to the master playlist.
 *
 * Requires:
 *   - MEDIACONVERT_ENDPOINT (account-specific, get from `aws mediaconvert describe-endpoints`)
 *   - MEDIACONVERT_ROLE_ARN (IAM role that MediaConvert assumes for S3 access)
 *   - S3_BUCKET
 *
 * Cost: ~$0.024 per minute of video (on-demand). Very cheap.
 */
'use strict';

const config = require('../config');
const { uploadRepo } = require('../repositories');

// Resolutions to generate (width, height, bitrate in bps, name)
const PRESETS = [
    { name: '1080p', width: 1920, height: 1080, videoBitrate: 5000000, audioBitrate: 128000 },
    { name: '720p',  width: 1280, height: 720,  videoBitrate: 2500000, audioBitrate: 128000 },
    { name: '480p',  width: 854,  height: 480,  videoBitrate: 1000000, audioBitrate: 96000 },
    { name: '360p',  width: 640,  height: 360,  videoBitrate: 600000,  audioBitrate: 64000 },
];

let mcClient = null;

function getClient() {
    if (!mcClient) {
        const { MediaConvertClient } = require('@aws-sdk/client-mediaconvert');
        mcClient = new MediaConvertClient({
            region: config.s3Region || 'us-east-1',
            endpoint: config.mediaConvertEndpoint || undefined,
        });
    }
    return mcClient;
}

/**
 * Create a MediaConvert HLS transcoding job for an uploaded video.
 *
 * @param {string} uploadId   — the upload row ID
 * @param {string} s3Key      — the S3 key of the source video (e.g. uploads/videos/abc.mp4)
 * @returns {Object}          — { jobId, outputPrefix, hlsUrl }
 */
async function createTranscodeJob(uploadId, s3Key) {
    const { CreateJobCommand } = require('@aws-sdk/client-mediaconvert');
    const client = getClient();

    const bucket = config.s3Bucket;
    const inputUri = `s3://${bucket}/${s3Key}`;
    const s3Prefix = config.s3Prefix || '';
    const outputPrefix = `${s3Prefix}transcoded/${uploadId}/`;
    // Destination must include base filename — MediaConvert appends NameModifier + .m3u8
    // e.g. s3://bucket/sandbox/transcoded/<id>/stream  →  stream.m3u8 (master), stream_1080p.m3u8, etc.
    const hlsDestination = `s3://${bucket}/${outputPrefix}stream`;
    const thumbDestination = `s3://${bucket}/${outputPrefix}`;

    const outputs = PRESETS.map((p) => ({
        NameModifier: `_${p.name}`,
        ContainerSettings: { Container: 'M3U8' },
        VideoDescription: {
            Width: p.width,
            Height: p.height,
            CodecSettings: {
                Codec: 'H_264',
                H264Settings: {
                    RateControlMode: 'QVBR',
                    MaxBitrate: p.videoBitrate,
                    QvbrSettings: { QvbrQualityLevel: 7 },
                    SceneChangeDetect: 'TRANSITION_DETECTION',
                    QualityTuningLevel: 'SINGLE_PASS',
                },
            },
        },
        AudioDescriptions: [{
            CodecSettings: {
                Codec: 'AAC',
                AacSettings: {
                    Bitrate: p.audioBitrate,
                    CodingMode: 'CODING_MODE_2_0',
                    SampleRate: 48000,
                },
            },
        }],
    }));

    const jobParams = {
        Role: config.mediaConvertRoleArn,
        Settings: {
            Inputs: [{
                FileInput: inputUri,
                AudioSelectors: {
                    'Audio Selector 1': { DefaultSelection: 'DEFAULT' },
                },
                VideoSelector: {},
            }],
            OutputGroups: [
                {
                    Name: 'HLS Group',
                    OutputGroupSettings: {
                        Type: 'HLS_GROUP_SETTINGS',
                        HlsGroupSettings: {
                            Destination: hlsDestination,
                            SegmentLength: 6,
                            MinSegmentLength: 2,
                            ManifestCompression: 'NONE',
                        },
                    },
                    Outputs: outputs,
                },
                {
                    Name: 'Thumbnail',
                    OutputGroupSettings: {
                        Type: 'FILE_GROUP_SETTINGS',
                        FileGroupSettings: { Destination: thumbDestination },
                    },
                    Outputs: [{
                        NameModifier: '_thumb',
                        ContainerSettings: { Container: 'RAW' },
                        VideoDescription: {
                            Width: 640,
                            Height: 360,
                            CodecSettings: {
                                Codec: 'FRAME_CAPTURE',
                                FrameCaptureSettings: {
                                    FramerateNumerator: 1,
                                    FramerateDenominator: 3, // capture at 3s
                                    MaxCaptures: 1,
                                    Quality: 80,
                                },
                            },
                        },
                    }],
                },
            ],
        },
        UserMetadata: {
            uploadId,
            // Lambda reads these and POSTs to the correct server instance.
            // Allows prod and sandbox to coexist on the same EC2 with different ports.
            callbackUrl: config.transcodeWebhookUrl || '',
            callbackSecret: config.transcodeWebhookSecret || 'loopbridge-transcode-callback',
            s3Prefix: config.s3Prefix || '',
        },
        StatusUpdateInterval: 'SECONDS_30',
    };

    const command = new CreateJobCommand(jobParams);
    const response = await client.send(command);

    const hlsUrl = config.cdnBaseUrl
        ? `${config.cdnBaseUrl}/${outputPrefix}stream.m3u8`
        : `https://${bucket}.s3.${config.s3Region || 'us-east-1'}.amazonaws.com/${outputPrefix}stream.m3u8`;

    console.log(`[transcode] Created job ${response.Job.Id} for upload ${uploadId}`);

    return {
        jobId: response.Job.Id,
        outputPrefix,
        hlsUrl,
    };
}

/**
 * Check the status of a MediaConvert job.
 */
async function getJobStatus(jobId) {
    const { GetJobCommand } = require('@aws-sdk/client-mediaconvert');
    const client = getClient();
    const response = await client.send(new GetJobCommand({ Id: jobId }));
    return {
        status: response.Job.Status, // SUBMITTED, PROGRESSING, COMPLETE, ERROR
        percentComplete: response.Job.JobPercentComplete,
        errorMessage: response.Job.ErrorMessage || null,
    };
}

/**
 * Local ffmpeg HLS transcoder — used when MediaConvert is not configured.
 *
 * Generates a multi-variant HLS manifest at:
 *   <uploadsDir>/transcoded/<uploadId>/manifest.m3u8
 * with per-rendition subdirectories for segments.
 *
 * The files are served by the existing `express.static(config.uploadsDir)`
 * middleware at /uploads/transcoded/<uploadId>/manifest.m3u8.
 *
 * @param {string} uploadId   — the upload DB row id
 * @param {string} localPath  — absolute path OR path relative to uploadsDir
 *                              (e.g. "videos/abc.mp4" or "/abs/path/videos/abc.mp4")
 * @returns {{ hlsUrl: string }}
 */
async function transcodeVideoLocally(uploadId, localPath) {
    const ffmpeg = require('fluent-ffmpeg');
    const fs = require('fs');
    const path = require('path');

    // Resolve input path.
    // In local disk mode, rawRecord.path is "uploads/videos/<filename>" (relative to
    // the project root, not to uploadsDir).  uploadsDir is "<project>/uploads", so
    // the full path is path.join(uploadsDir, '..', relativePath).
    // In prod, localPath is an S3 key and this function is never called.
    const inputPath = path.isAbsolute(localPath)
        ? localPath
        : path.join(config.uploadsDir, '..', localPath);

    const outputDir = path.join(config.uploadsDir, 'transcoded', uploadId);
    fs.mkdirSync(outputDir, { recursive: true });

    console.log(`[transcode:local] Starting local HLS transcode for upload ${uploadId}`);
    console.log(`[transcode:local]   input:  ${inputPath}`);
    console.log(`[transcode:local]   output: ${outputDir}`);

    // Probe source to know if it's tall enough for each preset
    const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });

    const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
    const srcHeight = videoStream ? (videoStream.height || 9999) : 9999;
    // Capture display dimensions (accounting for rotation metadata)
    const rotate = parseInt(videoStream?.tags?.rotate || videoStream?.rotation || '0', 10);
    const swapped = Math.abs(rotate) === 90 || Math.abs(rotate) === 270;
    const displayWidth  = videoStream ? (swapped ? videoStream.height : videoStream.width)  : null;
    const displayHeight = videoStream ? (swapped ? videoStream.width  : videoStream.height) : null;

    // Only encode presets whose height is <= source height
    let activePresets = PRESETS.filter((p) => p.height <= srcHeight);
    if (activePresets.length === 0) {
        // Fallback: at least encode the lowest preset
        activePresets = [PRESETS[PRESETS.length - 1]];
    }
    // Always generate at least 2 quality levels so the quality selector appears
    if (activePresets.length < 2) {
        // Add the next-lowest preset that isn't already included (ffmpeg will scale down gracefully)
        const missing = PRESETS.filter((p) => !activePresets.includes(p));
        if (missing.length > 0) activePresets = [...activePresets, missing[missing.length - 1]];
    }

    // Build per-rendition HLS streams — one ffmpeg invocation each so segment
    // paths can be written to subdirectories cleanly
    await Promise.all(
        activePresets.map((preset) => {
            const renditionDir = path.join(outputDir, preset.name);
            fs.mkdirSync(renditionDir, { recursive: true });

            return new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .outputOptions([
                        '-c:v libx264',
                        '-preset fast',
                        `-b:v ${preset.videoBitrate}`,
                        `-maxrate ${Math.round(preset.videoBitrate * 1.2)}`,
                        `-bufsize ${preset.videoBitrate * 2}`,
                        // force_original_aspect_ratio=decrease keeps aspect ratio, then
                        // trunc(w/2)*2:trunc(h/2)*2 ensures both dimensions are even
                        // (libx264 requires even width/height; odd values occur with portrait
                        //  sources like 576x1024 scaled to fit a 640x360 box → 203x360)
                        `-vf scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`,
                        '-c:a aac',
                        `-b:a ${preset.audioBitrate}`,
                        '-ar 48000',
                        '-ac 2',
                        '-hls_time 6',
                        '-hls_list_size 0',
                        `-hls_segment_filename ${path.join(renditionDir, 'seg%04d.ts')}`,
                        '-f hls',
                    ])
                    .output(path.join(renditionDir, 'index.m3u8'))
                    .on('start', (cmd) => console.log(`[transcode:local]   ${preset.name} → ${cmd.slice(0, 80)}…`))
                    .on('end', () => {
                        console.log(`[transcode:local]   ${preset.name} done`);
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error(`[transcode:local]   ${preset.name} error:`, err.message);
                        reject(err);
                    })
                    .run();
            });
        })
    );

    // Write the master manifest
    const masterLines = ['#EXTM3U', '#EXT-X-VERSION:3', ''];
    for (const preset of activePresets) {
        masterLines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${preset.videoBitrate},RESOLUTION=${preset.width}x${preset.height}`);
        masterLines.push(`${preset.name}/index.m3u8`);
    }
    masterLines.push(''); // trailing newline
    fs.writeFileSync(path.join(outputDir, 'manifest.m3u8'), masterLines.join('\n'));

    // Capture a thumbnail at 3 s via ffmpeg
    await new Promise((resolve) => {
        ffmpeg(inputPath)
            .screenshots({
                timestamps: ['3'],
                filename: 'thumb.jpg',
                folder: outputDir,
                size: '640x360',
            })
            .on('end', resolve)
            .on('error', (err) => {
                // Thumbnail failure is non-fatal
                console.warn('[transcode:local] thumbnail error (non-fatal):', err.message);
                resolve();
            });
    });

    const hlsUrl = `/uploads/transcoded/${uploadId}/manifest.m3u8`;
    const thumbnailUrl = `/uploads/transcoded/${uploadId}/thumb.jpg`;
    console.log(`[transcode:local] Complete — ${hlsUrl}`);
    return { hlsUrl, thumbnailUrl, videoWidth: displayWidth, videoHeight: displayHeight };
}

/**
 * Full pipeline: transcode a video upload and update the upload record.
 * Called after a video is uploaded to S3 (or saved to disk in local dev).
 *
 * @param {string} uploadId — the upload DB row id
 * @param {string} s3Key    — the S3 object key (prod) OR local relative path (dev)
 */
async function transcodeVideo(uploadId, s3Key) {
    // ── Local dev path ──────────────────────────────────────────────────────
    // When MediaConvert credentials are absent, fall back to local ffmpeg.
    if (!config.mediaConvertRoleArn) {
        try {
            const { hlsUrl, thumbnailUrl, videoWidth, videoHeight } = await transcodeVideoLocally(uploadId, s3Key);
            await uploadRepo.updateTranscodeStatus(uploadId, {
                hlsUrl,
                thumbnailUrl,
                transcodeStatus: 'complete',
            });
            if (videoWidth && videoHeight) {
                await uploadRepo.updateDimensions(uploadId, videoWidth, videoHeight);
            }
            return { hlsUrl };
        } catch (err) {
            console.error(`[transcode:local] Failed for ${uploadId}:`, err.message);
            await uploadRepo.updateTranscodeStatus(uploadId, {
                transcodeStatus: 'error',
                transcodeError: err.message,
            });
            return null;
        }
    }

    // ── Cloud path (AWS MediaConvert) ───────────────────────────────────────

    try {
        const result = await createTranscodeJob(uploadId, s3Key);

        // Store the HLS URL and job ID in the upload record metadata
        // We add hls_url and transcode_job_id columns, or store in metadata
        await uploadRepo.updateTranscodeStatus(uploadId, {
            transcodeJobId: result.jobId,
            hlsUrl: result.hlsUrl,
            transcodeStatus: 'processing',
        });

        return result;
    } catch (err) {
        console.error(`[transcode] Failed to create job for ${uploadId}:`, err.message);
        await uploadRepo.updateTranscodeStatus(uploadId, {
            transcodeStatus: 'error',
            transcodeError: err.message,
        });
        return null;
    }
}

module.exports = {
    transcodeVideo,
    createTranscodeJob,
    getJobStatus,
    PRESETS,
};
