# ─────────────────────────────────────────────────────────────────────────────
# infrastructure/terraform/main.tf
# ─────────────────────────────────────────────────────────────────────────────
# Provisions the full LoopBridge AWS stack:
#   VPC · Subnet · IGW · Route Table · Security Group
#   S3 bucket (uploads + Litestream replication)
#   ECR repository
#   IAM roles (EC2, MediaConvert) + admin CI/CD user
#   EC2 t2.micro (Amazon Linux 2023, Docker pre-installed)
#
# To deploy fresh on any AWS account:
#   1. cp terraform.tfvars.example terraform.tfvars  → fill in values
#   2. terraform init
#   3. terraform plan
#   4. terraform apply
#
# To import the existing LoopBridge infra instead of recreating it, see
# infrastructure/README.md → "Importing existing resources".
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Optional: store state in S3 so the whole team shares it.
  # Uncomment and fill in after first `terraform apply` creates the bucket,
  # then run `terraform init -migrate-state`.
  #
  # backend "s3" {
  #   bucket = "loopbridge-tfstate-<account-id>"
  #   key    = "loopbridge/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "LoopBridge"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ── Useful data sources ───────────────────────────────────────────────────────

data "aws_caller_identity" "current" {}

locals {
  account_id  = data.aws_caller_identity.current.account_id
  bucket_name = "loopbridge-uploads-${local.account_id}"
  name_prefix = "loopbridge"
}
