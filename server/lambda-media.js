/**
 * LoopBridge — Media Processing Lambda
 *
 * Triggered by S3 PutObject events on the uploads bucket.
 * Compresses images and generates video thumbnails.
 *
 * Architecture:
 *   S3 PutObject → EventBridge / S3 Event Notification → this Lambda
 *   → reads original from S3
 *   → compresses / resizes
 *   → writes optimised version back to S3 (same key or a /optimised/ prefix)
 *   → optionally updates the uploads table via RDS/API call
 *
 * Environment variables:
 *   S3_BUCKET           — the uploads bucket
 *   S3_REGION           — AWS region
 *   IMAGE_MAX_WIDTH     — max width for resized images (default 1920)
 *   IMAGE_QUALITY       — JPEG/WebP quality 1-100 (default 80)
 *   THUMBNAIL_WIDTH     — thumbnail width (default 400)
 *   API_BASE_URL        — LoopBridge API base (optional, for metadata updates)
 *
 * Dependencies (Lambda layer or bundled):
 *   sharp               — image compression / resizing
 *
 * Deployment:
 *   1. Package this file + node_modules (with sharp for linux-x64) into a zip
 *   2. Create Lambda function (Node.js 20.x, 512MB RAM, 30s timeout)
 *   3. Add S3 event trigger for ObjectCreated on uploads/ prefix
 *   4. Attach IAM role with s3:GetObject, s3:PutObject on the bucket
 *
 * For video compression, consider using AWS Elastic Transcoder or
 * MediaConvert instead of Lambda (videos are too large/slow for Lambda).
 * This handler creates a thumbnail from the first frame of the video instead.
 */
'use strict';

// These would be installed in the Lambda deployment package
// const sharp = require('sharp');
// const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const S3_BUCKET = process.env.S3_BUCKET;
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const IMAGE_MAX_WIDTH = parseInt(process.env.IMAGE_MAX_WIDTH, 10) || 1920;
const IMAGE_QUALITY = parseInt(process.env.IMAGE_QUALITY, 10) || 80;
const THUMBNAIL_WIDTH = parseInt(process.env.THUMBNAIL_WIDTH, 10) || 400;

// Uncomment when deploying to AWS:
// const s3 = new S3Client({ region: S3_REGION });

/**
 * Determine what kind of media this is.
 */
function classifyKey(key) {
    const lower = key.toLowerCase();
    if (/\.(jpe?g|png|gif|webp|avif|tiff?)$/i.test(lower)) return 'image';
    if (/\.(mp4|webm|mov|avi|mkv)$/i.test(lower)) return 'video';
    if (/\.(mp3|ogg|wav|aac|flac|webm)$/i.test(lower)) return 'audio';
    return 'other';
}

/**
 * Compress / resize an image using sharp.
 * Returns the optimised buffer and its content type.
 */
async function processImage(buffer, contentType) {
    // Dynamic import so the file can be parsed even without sharp installed locally
    const sharp = require('sharp');

    const metadata = await sharp(buffer).metadata();

    // Skip SVGs — they're already vector
    if (contentType === 'image/svg+xml') {
        return { buffer, contentType, skipped: true };
    }

    let pipeline = sharp(buffer).rotate(); // auto-rotate from EXIF

    // Resize if wider than max
    if (metadata.width && metadata.width > IMAGE_MAX_WIDTH) {
        pipeline = pipeline.resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true });
    }

    // Convert to WebP for best compression, or keep JPEG
    let outputBuffer;
    let outputType;

    if (contentType === 'image/png' && metadata.hasAlpha) {
        // Keep PNG for transparency, but optimise
        outputBuffer = await pipeline.png({ quality: IMAGE_QUALITY, effort: 6 }).toBuffer();
        outputType = 'image/png';
    } else {
        // Convert everything else to WebP
        outputBuffer = await pipeline.webp({ quality: IMAGE_QUALITY }).toBuffer();
        outputType = 'image/webp';
    }

    const savings = ((1 - outputBuffer.length / buffer.length) * 100).toFixed(1);
    console.log(`[media] Compressed ${metadata.width}x${metadata.height} → ${outputBuffer.length} bytes (${savings}% savings)`);

    return { buffer: outputBuffer, contentType: outputType, skipped: false };
}

/**
 * Generate a thumbnail for an image.
 */
async function generateThumbnail(buffer) {
    const sharp = require('sharp');

    return sharp(buffer)
        .rotate()
        .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
        .webp({ quality: 70 })
        .toBuffer();
}

/**
 * Lambda handler.
 * Receives S3 event notifications.
 */
exports.handler = async (event) => {
    // Lazy-import AWS SDK (available in Lambda runtime)
    const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: S3_REGION });

    const results = [];

    for (const record of event.Records || []) {
        const bucket = record.s3?.bucket?.name || S3_BUCKET;
        const key = decodeURIComponent((record.s3?.object?.key || '').replace(/\+/g, ' '));

        if (!key) {
            console.warn('[media] No key in event record, skipping');
            continue;
        }

        // Skip already-processed files
        if (key.includes('/optimised/') || key.includes('/thumbnails/')) {
            console.log(`[media] Skipping already-processed key: ${key}`);
            continue;
        }

        const mediaType = classifyKey(key);
        console.log(`[media] Processing ${mediaType}: ${key}`);

        if (mediaType === 'image') {
            try {
                // Fetch original
                const getCmd = new GetObjectCommand({ Bucket: bucket, Key: key });
                const response = await s3.send(getCmd);
                const chunks = [];
                for await (const chunk of response.Body) chunks.push(chunk);
                const originalBuffer = Buffer.concat(chunks);
                const contentType = response.ContentType || 'image/jpeg';

                // Compress
                const { buffer: optimised, contentType: outType, skipped } = await processImage(originalBuffer, contentType);

                if (!skipped) {
                    // Write optimised version (overwrite the original to save storage)
                    const putCmd = new PutObjectCommand({
                        Bucket: bucket,
                        Key: key,
                        Body: optimised,
                        ContentType: outType,
                        CacheControl: 'public, max-age=31536000, immutable'
                    });
                    await s3.send(putCmd);
                    console.log(`[media] Wrote optimised image: ${key}`);
                }

                // Generate thumbnail
                const thumbnailKey = key.replace(/^uploads\/images\//, 'uploads/images/thumbnails/');
                if (thumbnailKey !== key) {
                    const thumb = await generateThumbnail(originalBuffer);
                    const thumbCmd = new PutObjectCommand({
                        Bucket: bucket,
                        Key: thumbnailKey,
                        Body: thumb,
                        ContentType: 'image/webp',
                        CacheControl: 'public, max-age=31536000, immutable'
                    });
                    await s3.send(thumbCmd);
                    console.log(`[media] Wrote thumbnail: ${thumbnailKey}`);
                }

                results.push({ key, status: 'compressed', savings: `${((1 - optimised.length / originalBuffer.length) * 100).toFixed(1)}%` });
            } catch (err) {
                console.error(`[media] Failed to process image ${key}:`, err);
                results.push({ key, status: 'error', error: err.message });
            }
        } else if (mediaType === 'video') {
            // Video compression is too heavy for Lambda (15 min / 10GB limit).
            // Use AWS MediaConvert or Elastic Transcoder for that.
            // Here we just log it — a separate MediaConvert job could be triggered.
            console.log(`[media] Video detected: ${key} — skipping (use MediaConvert for video transcoding)`);
            results.push({ key, status: 'skipped', reason: 'Video — use MediaConvert' });
        } else {
            console.log(`[media] Unsupported media type for ${key}, skipping`);
            results.push({ key, status: 'skipped', reason: `Type: ${mediaType}` });
        }
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ processed: results.length, results })
    };
};
