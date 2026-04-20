# ─────────────────────────────────────────────────────────────────────────────
# infrastructure/terraform/outputs.tf
# ─────────────────────────────────────────────────────────────────────────────

output "ec2_public_ip" {
  description = "Public IP of the EC2 instance (via Elastic IP)"
  value       = aws_eip.app.public_ip
}

output "ec2_instance_id" {
  description = "EC2 instance ID — used in deploy.yml EC2_INSTANCE_ID env var"
  value       = aws_instance.app.id
}

output "ecr_registry" {
  description = "ECR registry URL — used in deploy.yml ECR_REGISTRY env var"
  value       = "${local.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}

output "ecr_repository_url" {
  description = "Full ECR repository URL"
  value       = aws_ecr_repository.api.repository_url
}

output "s3_bucket_name" {
  description = "S3 bucket name — used in deploy.yml S3_BUCKET env var"
  value       = aws_s3_bucket.uploads.id
}

output "mediaconvert_role_arn" {
  description = "MediaConvert IAM role ARN — used in docker run MEDIACONVERT_ROLE_ARN"
  value       = aws_iam_role.mediaconvert.arn
}

output "cicd_access_key_id" {
  description = "AWS_ACCESS_KEY_ID for GitHub Actions — add to secrets.env"
  value       = aws_iam_access_key.cicd.id
  sensitive   = true
}

output "cicd_secret_access_key" {
  description = "AWS_SECRET_ACCESS_KEY for GitHub Actions — add to secrets.env"
  value       = aws_iam_access_key.cicd.secret
  sensitive   = true
}

# ── deploy.yml env block (copy-paste ready) ───────────────────────────────────
output "deploy_yml_env_block" {
  description = "Copy-paste this into the env: block of .github/workflows/deploy.yml"
  value       = <<-EOT
    env:
      AWS_REGION:       ${var.aws_region}
      ECR_REPOSITORY:   ${local.name_prefix}-api
      ECR_REGISTRY:     ${local.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com
      EC2_INSTANCE_ID:  ${aws_instance.app.id}
      S3_BUCKET:        ${aws_s3_bucket.uploads.id}
  EOT
}
