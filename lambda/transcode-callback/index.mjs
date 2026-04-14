/**
 * LoopBridge — MediaConvert Transcode Callback Lambda
 *
 * Triggered by EventBridge when a MediaConvert job completes or errors.
 * Sends a webhook to the EC2 instance to update the upload record.
 *
 * Environment variables:
 *   WEBHOOK_URL    — e.g. http://44.197.184.251/api/transcode/webhook
 *   WEBHOOK_SECRET — shared secret for Authorization header
 *   S3_BUCKET      — bucket name for constructing HLS URLs
 *   S3_REGION      — region for constructing S3 URLs
 */

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const detail = event.detail || {};
  const status = detail.status;               // COMPLETE or ERROR
  const userMetadata = detail.userMetadata || {};
  const uploadId = userMetadata.uploadId;

  if (!uploadId) {
    console.error('No uploadId in userMetadata — skipping');
    return { statusCode: 400, body: 'Missing uploadId' };
  }

  const s3Bucket = process.env.S3_BUCKET || 'loopbridge-uploads-680128294518';
  const s3Region = process.env.S3_REGION || 'us-east-1';
  const webhookUrl = process.env.WEBHOOK_URL || 'http://44.197.184.251/api/transcode/webhook';
  const webhookSecret = process.env.WEBHOOK_SECRET || 'loopbridge-transcode-callback';

  // Construct the HLS URL from the known output path convention
  const hlsUrl = `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/transcoded/${uploadId}/stream.m3u8`;

  const payload = {
    uploadId,
    status: status === 'COMPLETE' ? 'complete' : 'error',
    hlsUrl: status === 'COMPLETE' ? hlsUrl : undefined,
    errorMessage: detail.errorMessage || undefined,
  };

  console.log('Sending webhook:', JSON.stringify(payload));

  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${webhookSecret}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await resp.text();
    console.log(`Webhook response: ${resp.status} ${body}`);

    return { statusCode: resp.status, body };
  } catch (err) {
    console.error('Webhook call failed:', err.message);
    return { statusCode: 500, body: err.message };
  }
};
