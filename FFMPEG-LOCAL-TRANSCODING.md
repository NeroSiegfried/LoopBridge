# Local FFmpeg Transcoding Guide

## Overview

LoopBridge supports **local ffmpeg-based video transcoding** on your EC2 instance. This is **completely free** and perfect for the Starter tier (0–500 users).

- ✅ No MediaConvert costs
- ✅ Generates multi-bitrate HLS (1080p, 720p, 480p, 360p)
- ✅ Files saved to disk or S3
- ✅ Seamless upgrade path to MediaConvert later

---

## How It Works

1. **User uploads video** → `/api/uploads/videos` endpoint
2. **Server detects no MediaConvert config** → triggers local ffmpeg
3. **ffmpeg transcodes locally** → generates HLS manifest + segments
4. **Files uploaded to S3** (if `STORAGE_DRIVER=s3`) **OR** saved to disk (if `STORAGE_DRIVER=disk`)
5. **Express static middleware** serves from disk at `/uploads/transcoded/<uploadId>/manifest.m3u8` OR S3 URL returned

### File Storage

**With `STORAGE_DRIVER=s3`** (recommended for production):
```
S3 bucket:
  ├─ transcoded/<uploadId>/
  │  ├─ manifest.m3u8           (master HLS playlist)
  │  ├─ 1080p/
  │  │  ├─ index.m3u8           (variant playlist)
  │  │  └─ seg0000.ts, seg0001.ts, ...
  │  ├─ 720p/
  │  ├─ 480p/
  │  ├─ 360p/
  │  └─ thumb.jpg
```

**With `STORAGE_DRIVER=disk`** (dev/Starter on EC2):
```
EC2 disk:
  ├─ uploads/transcoded/
  │  ├─ <uploadId>/
  │  │  ├─ manifest.m3u8
  │  │  ├─ 1080p/
  │  │  ├─ 720p/
  │  │  ├─ 480p/
  │  │  ├─ 360p/
  │  │  └─ thumb.jpg
```

---

## Setup for Starter Tier

### 1. **EC2 User Data** (included in terraform bootstrap)

The default Terraform EC2 user data already installs ffmpeg:

```bash
#!/bin/bash
set -e
yum update -y
yum install -y docker git ffmpeg

# ... rest of bootstrap
```

**Verify ffmpeg is installed**:
```bash
ssh -i <pem> ec2-user@<ec2-ip>
ffmpeg -version
```

### 2. **Environment Variables**

For Starter, **don't set these**:
```bash
# LEAVE THESE UNSET:
# MEDIACONVERT_ENDPOINT=
# MEDIACONVERT_ROLE_ARN=

# DO set these:
DB_TYPE=sqlite
STORAGE_DRIVER=disk
```

The server will auto-detect that MediaConvert isn't configured and use local ffmpeg.

### 3. **Docker Container**

When running the LoopBridge Docker container, ensure:

```bash
# Starter (disk mode):
docker run \
  -p 5000:5000 \
  -e DB_TYPE=sqlite \
  -e STORAGE_DRIVER=disk \
  -e NODE_ENV=production \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/loopbridge.db:/app/loopbridge.db \
  loopbridge:latest

# Growth/Scale (S3 mode):
docker run \
  -p 5000:5000 \
  -e DB_TYPE=sqlite \
  -e STORAGE_DRIVER=s3 \
  -e S3_BUCKET=loopbridge-media \
  -e AWS_REGION=us-east-1 \
  -e AWS_ACCESS_KEY_ID=<key> \
  -e AWS_SECRET_ACCESS_KEY=<secret> \
  -e NODE_ENV=production \
  loopbridge:latest
```

ffmpeg is already in the Docker image (`Dockerfile` includes it).

---

## Expected Behavior

### Video Upload Flow (Disk Mode)
```
POST /api/uploads/videos
  ├─ Save file to disk → uploads/videos/<id>-name.mp4
  ├─ [Local ffmpeg starts]
  │  ├─ Probe source video dimensions & duration
  │  ├─ Generate 1080p HLS stream
  │  ├─ Generate 720p HLS stream
  │  ├─ Generate 480p HLS stream
  │  ├─ Generate 360p HLS stream
  │  └─ Write manifest.m3u8
  ├─ Update DB: hls_url = /uploads/transcoded/<id>/manifest.m3u8
  └─ Return 200 OK
```

### Video Upload Flow (S3 Mode)
```
POST /api/uploads/videos
  ├─ Save file to disk → uploads/videos/<id>-name.mp4
  ├─ [Local ffmpeg starts]
  │  ├─ Probe + generate HLS locally
  │  ├─ Upload all files to S3: transcoded/<id>/{1080p,720p,480p,360p,manifest.m3u8,thumb.jpg}
  │  └─ Delete local temp files
  ├─ Update DB: hls_url = https://bucket.s3.region.amazonaws.com/transcoded/<id>/manifest.m3u8
  └─ Return 200 OK
```

**Typical processing time**:
- 5-min video @ 1080p → 2-3 minutes on t2.micro
- 30-min video @ 1080p → 15-20 minutes on t2.micro

> **Note**: Transcoding is **sequential, not async**. The HTTP request will wait for completion. For production Growth/Scale, migrate to MediaConvert (async jobs).

### Monitoring

Check logs:
```bash
# On EC2:
docker logs loopbridge-server | grep transcode

# Example output:
[transcode:local] Starting local HLS transcode for upload abc-123
[transcode:local]   input:  uploads/videos/abc-123-video.mp4
[transcode:local]   output: uploads/transcoded/abc-123
[transcode:local]   1080p → ffmpeg -i ... started
[transcode:local]   1080p done
[transcode:local]   720p → ffmpeg -i ...
...
```

---

## Upgrading to MediaConvert (Growth Tier)

When you hit Growth tier (500+ users, revenue >₦300k/month):

1. **Create AWS MediaConvert IAM role** (Terraform handles this in `iam.tf`)

2. **Get MediaConvert endpoint**:
   ```bash
   aws mediaconvert describe-endpoints --region us-east-1
   # Copy the URL from response, e.g.:
   # https://xxxxxxx.mediaconvert.us-east-1.amazonaws.com
   ```

3. **Set environment variables**:
   ```bash
   MEDIACONVERT_ENDPOINT=https://xxxxxxx.mediaconvert.us-east-1.amazonaws.com
   MEDIACONVERT_ROLE_ARN=arn:aws:iam::ACCOUNT:role/loopbridge-mediaconvert-role
   ```

4. **Restart container** — new uploads will use MediaConvert automatically

> **Zero code changes needed** — your app already has both code paths built in.

---

## Performance Tuning

### For Slower Uploads (t2.micro constraints):

If transcoding is too slow, add to `server/services/transcodingService.js`:

```javascript
// In the ffmpeg command, change preset:
.outputOptions([
    '-preset slower',  // slower = better compression, slower encoding
    // OR
    '-preset ultrafast',  // ultrafast = less CPU, larger files
])
```

### For Larger Video Files:

Add S3 integration (Growth tier):
```bash
STORAGE_DRIVER=s3
S3_BUCKET=loopbridge-media
# Videos saved to S3, transcoded locally or via MediaConvert
```

---

## Troubleshooting

### ffmpeg not found
```
Error: Command failed: ffmpeg -i ...
```
**Fix**: SSH to EC2, run `ffmpeg -version` to verify installation.

### Out of disk space
```
Error: ENOSPC: no space left on device
```
**Fix**: Check disk usage:
```bash
df -h
# If uploads/ is full, delete old transcoded/ files:
rm -rf uploads/transcoded/old-*
```

### Transcoding taking too long
- Normal on t2.micro for large/4K videos
- For Growth tier, migrate to MediaConvert
- Alternatively, compress videos before upload (client-side)

### HLS playback issues
- Ensure CORS headers are correct in EC2 security group
- Test with `curl https://<domain>/uploads/transcoded/<id>/manifest.m3u8`

---

## Cost Comparison

| Metric | Local FFmpeg | MediaConvert |
|--------|--------------|-------------|
| **Setup cost** | $0 | $0 (pay-per-use) |
| **Cost per min** | $0 (included in EC2) | $0.015/min |
| **10 videos/week** | ~$0 | ~$1.50 |
| **50 videos/week** | ~$0 | ~$7.50 |
| **Latency** | 2–3x video duration | ~5 min start + duration |
| **Scalability** | t2.micro bottleneck @ 50+/week | Auto-scales, async |

---

## Code Reference

- **Entry point**: `server/routes/uploads.js` → POST `/api/uploads/videos`
- **Service**: `server/services/transcodingService.js` → `transcodeVideoLocally()`
  - Detects `STORAGE_DRIVER` and calls `uploadToS3()` if S3 mode
  - Returns local URL or S3 URL based on storage driver
- **S3 helper**: `server/services/storageService.js` → `uploadToS3()`
  - Uploads transcoded files to S3 bucket
  - Sets appropriate MIME types (`.m3u8` as `application/vnd.apple.mpegurl`, etc.)
- **Config detection**: `server/config/index.js` → checks `mediaConvertEndpoint` and `storageDriver`
- **DB schema**: `server/db.js` → `transcode_status`, `hls_url`, `thumbnail_url` columns
