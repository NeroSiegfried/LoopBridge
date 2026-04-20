# ─────────────────────────────────────────────────────────────────────────────
# infrastructure/terraform/s3.tf
# S3 bucket: file uploads + Litestream SQLite replication
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "uploads" {
  bucket = local.bucket_name

  # Prevent accidental destruction when the bucket has data
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block all public access — objects are served through the API, never directly
resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS for direct browser uploads (presigned URLs)
resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"]   # Restrict to your domain in production
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Lifecycle: auto-delete incomplete multipart uploads after 7 days
resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  # Optional: move transcoded videos to cheaper storage after 90 days
  rule {
    id     = "transcoded-to-ia"
    status = "Enabled"

    filter {
      prefix = "transcoded/"
    }

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
  }
}
