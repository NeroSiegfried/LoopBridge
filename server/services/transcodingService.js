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
    const outputPrefix = `transcoded/${uploadId}/`;
    const outputUri = `s3://${bucket}/${outputPrefix}`;

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
                            Destination: outputUri,
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
                        FileGroupSettings: { Destination: outputUri },
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
        },
        StatusUpdateInterval: 'SECONDS_30',
    };

    const command = new CreateJobCommand(jobParams);
    const response = await client.send(command);

    const hlsUrl = config.cdnBaseUrl
        ? `${config.cdnBaseUrl}/${outputPrefix}manifest.m3u8`
        : `https://${bucket}.s3.${config.s3Region || 'us-east-1'}.amazonaws.com/${outputPrefix}manifest.m3u8`;

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
 * Full pipeline: transcode a video upload and update the upload record.
 * Called after a video is uploaded to S3.
 *
 * @param {string} uploadId — the upload DB row id
 * @param {string} s3Key    — the S3 object key
 */
async function transcodeVideo(uploadId, s3Key) {
    if (!config.mediaConvertRoleArn) {
        console.log('[transcode] MEDIACONVERT_ROLE_ARN not set — skipping transcoding');
        return null;
    }

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
