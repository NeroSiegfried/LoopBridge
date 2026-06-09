# ─────────────────────────────────────────────────────────────────────────────
# infrastructure/terraform/outputs.tf
# After `terraform apply`, copy these values into your GitHub repo settings.
# ─────────────────────────────────────────────────────────────────────────────

output "ec2_public_ip" {
  description = "EC2 public IP (add an A record for your domain)"
  value       = aws_eip.app.public_ip
}

output "ec2_instance_id" {
  description = "EC2 instance ID (CI/CD discovers this via tags — informational)"
  value       = aws_instance.app.id
}

output "s3_bucket_name" {
  description = "S3 uploads bucket name (CI/CD derives this from account ID — informational)"
  value       = aws_s3_bucket.uploads.id
}

output "ecr_repository_url" {
  description = "Full ECR repository URL"
  value       = aws_ecr_repository.api.repository_url
}

output "mediaconvert_role_arn" {
  description = "MediaConvert IAM role ARN — pass as MEDIACONVERT_ROLE_ARN env var"
  value       = aws_iam_role.mediaconvert.arn
}

# ── The ONE GitHub Actions secret you need ────────────────────────────────────

output "github_actions_role_arn" {
  description = <<-EOT
    REQUIRED: Add this as a GitHub Actions variable named AWS_ROLE_ARN.
    Settings → Secrets and variables → Actions → Variables → New repository variable
    Name: AWS_ROLE_ARN
    Value: (this output)

    This is the only account-specific value GitHub needs.
    Everything else (instance ID, bucket, registry) is discovered dynamically.
  EOT
  value = aws_iam_role.github_actions.arn
}

# ── Setup checklist (printed after apply) ─────────────────────────────────────

output "setup_checklist" {
  description = "One-time steps to finish the setup"
  value       = <<-EOT

    ════════════ POST-APPLY CHECKLIST ════════════

    1. Add GitHub Actions variable:
       Repo → Settings → Secrets and variables → Actions → Variables
       Name : AWS_ROLE_ARN
       Value: ${aws_iam_role.github_actions.arn}

    2. Add GitHub Actions secrets (one-time):
       JWT_SECRET, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
       NEWSLETTER_FROM_EMAIL, GOOGLE_CLIENT_ID,
       TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
       TWILIO_WHATSAPP_FROM, TWILIO_SMS_FROM

    3. Point your domain DNS:
       A record → ${aws_eip.app.public_ip}

    4. Push to main → CI/CD deploys automatically.

    ══════════════════════════════════════════════
  EOT
}
