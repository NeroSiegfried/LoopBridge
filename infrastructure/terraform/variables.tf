# ─────────────────────────────────────────────────────────────────────────────
# infrastructure/terraform/variables.tf
# ─────────────────────────────────────────────────────────────────────────────

variable "aws_profile" {
  description = "AWS CLI profile to use"
  type        = string
  default     = "loopbridge-developer"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "subnet_cidr" {
  type    = string
  default = "10.0.0.0/20"
}

variable "availability_zone" {
  type    = string
  default = "us-east-1a"
}

variable "root_volume_size_gb" {
  description = "Root EBS volume size in GiB"
  type        = number
  default     = 8
}

variable "ec2_key_pair_name" {
  description = "Existing EC2 Key Pair for SSH (optional — SSM is preferred)"
  type        = string
  default     = ""
}

variable "allowed_ssh_cidrs" {
  description = "CIDRs allowed SSH. Empty = no SSH rule (SSM only)."
  type        = list(string)
  default     = []
}

# ─── App ──────────────────────────────────────────────────────────────────────

variable "app_domain" {
  description = "Domain name (e.g. loopbridge.network)"
  type        = string
  default     = ""
}

# ─── GitHub OIDC ──────────────────────────────────────────────────────────────

variable "github_repo" {
  description = <<-EOT
    GitHub repository in owner/repo format.
    This is the ONE variable to change when pointing CI/CD at a different repo.
    It controls the OIDC trust condition — only this repo can assume the deploy role.
    Example: "NeroSiegfried/LoopBridge"
  EOT
  type    = string
  default = "NeroSiegfried/LoopBridge"
}

# ─── MediaConvert (optional) ──────────────────────────────────────────────────

variable "transcode_webhook_secret" {
  description = "HMAC secret for MediaConvert callback validation"
  type        = string
  sensitive   = true
  default     = ""
}
