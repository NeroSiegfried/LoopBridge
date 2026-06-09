# ─────────────────────────────────────────────────────────────────────────────
# infrastructure/terraform/environments.tf
# ─────────────────────────────────────────────────────────────────────────────
# Three tiers. Set LOOPBRIDGE_ENV before running Terraform.
#
#   export LOOPBRIDGE_ENV=micro        # ~$10/month  (default — few users)
#   export LOOPBRIDGE_ENV=small        # ~$17/month  (growing)
#   export LOOPBRIDGE_ENV=production   # ~$50+/month (scaled, CloudFront)
#
# SQLite + Litestream is used at every tier. Add RDS only when SQLite
# becomes the actual bottleneck (thousands of concurrent writes).
# ─────────────────────────────────────────────────────────────────────────────

variable "deployment_env" {
  description = "Tier: micro | small | production  (set via LOOPBRIDGE_ENV)"
  type        = string
  default     = "micro"

  validation {
    condition     = contains(["micro", "small", "production"], var.deployment_env)
    error_message = "deployment_env must be micro, small, or production."
  }
}

locals {
  env_config = {
    # 1 GB RAM · burstable · ~$8/month · SQLite · no CDN
    # Right for: early-stage, internal tools, < ~5,000 users
    micro = {
      instance_type     = "t3.micro"
      name_prefix       = "loopbridge"
      enable_cloudfront = false
      tags = {
        Environment = "micro"
        ManagedBy   = "terraform"
      }
    }

    # 2 GB RAM · burstable · ~$17/month · SQLite · no CDN
    # Right for: 5,000–50,000 users, heavier video transcoding load
    small = {
      instance_type     = "t3.small"
      name_prefix       = "loopbridge"
      enable_cloudfront = false
      tags = {
        Environment = "small"
        ManagedBy   = "terraform"
      }
    }

    # 4 GB RAM · burstable · ~$50+/month · SQLite · CloudFront CDN
    # Right for: 50,000+ users, swap SQLite for RDS when writes saturate
    production = {
      instance_type     = "t3.medium"
      name_prefix       = "loopbridge"
      enable_cloudfront = true
      tags = {
        Environment = "production"
        ManagedBy   = "terraform"
      }
    }
  }

  config            = local.env_config[var.deployment_env]
  name_prefix       = local.config.name_prefix
  aws_region        = var.aws_region
  instance_type     = local.config.instance_type
  enable_cloudfront = local.config.enable_cloudfront

  tags = merge(local.config.tags, {
    Project   = "LoopBridge"
    Terraform = "true"
    Tier      = var.deployment_env
  })
}
