# Multi-Account Migration & Environment Management Guide

## Overview

Your LoopBridge infrastructure is now configured to support multiple environments using a **single environment variable**. Everything is deployed to your `loopbridge-developer` AWS account (815771784030) and can be switched between **staging** and **production** environments by changing one variable.

### What Changed

| Control | Before | Now |
|---------|--------|-----|
| **AWS Account** | Manual CLI setup | Automatic via `loopbridge-developer` profile |
| **Environment** | Multiple tfvars files | Single `LOOPBRIDGE_ENV` variable |
| **Instance Size** | Manual variable | Automatic (t2.micro for staging, t3.medium for prod) |
| **Database Tier** | Manual variable | Automatic (t4g.micro for staging, t4g.medium for prod) |
| **Backups** | Manual setup | Automatic (disabled for staging, enabled for prod) |

---

## Quick Start

### 1. Initial Setup (One-time)

```bash
cd infrastructure/terraform

# Copy the example tfvars
cp terraform.tfvars.example terraform.tfvars

# Fill in any custom values in terraform.tfvars
# (Most defaults are good; update if needed)
nano terraform.tfvars

# Initialize Terraform (one-time)
./deploy.sh production init
```

### 2. Deploy to Staging (Development)

```bash
# Preview changes
./deploy.sh staging plan

# Apply changes
./deploy.sh staging apply

# Get staging outputs
./deploy.sh staging output
```

**Result**: 
- t2.micro EC2 (free tier eligible)
- db.t4g.micro RDS (~$15/month)
- No backups, no CloudFront
- Resources tagged with `loopbridge-staging`

### 3. Deploy to Production (Live)

```bash
# Preview changes
./deploy.sh production plan

# Apply changes
./deploy.sh production apply

# Get production outputs
./deploy.sh production output
```

**Result**:
- t3.medium EC2 (~$40/month)
- db.t4g.medium Multi-AZ RDS (~$80/month)
- Daily backups enabled
- CloudFront enabled
- Resources tagged with `loopbridge`

---

## Environment Comparison

| Feature | Staging | Production |
|---------|---------|-----------|
| **EC2 Instance** | t2.micro ($9-10/mo) | t3.medium (~$40/mo) |
| **RDS Instance** | db.t4g.micro (~$15/mo) | db.t4g.medium (~$80/mo) |
| **RDS Backup** | Disabled | Enabled (7 days) |
| **CloudFront CDN** | Disabled | Enabled |
| **Multi-AZ** | Single AZ | Multi-AZ |
| **Name Prefix** | `loopbridge-staging` | `loopbridge` |
| **Use Case** | Testing, development | Live users, revenue |

---

## Single Environment Variable Control

All environment differences are controlled by **one variable**: `LOOPBRIDGE_ENV`

### How It Works

The `deploy.sh` script automatically:
1. Accepts environment name: `staging` or `production`
2. Sets `LOOPBRIDGE_ENV` internally
3. Passes it to Terraform
4. Terraform selects correct config from `environments.tf`

### Manual Usage (if not using deploy.sh)

```bash
# Set environment before running terraform
export LOOPBRIDGE_ENV=staging
terraform plan -var="deployment_env=$LOOPBRIDGE_ENV"

# Or pass directly
terraform apply -var="deployment_env=production"
```

### What the Variable Controls

In `environments.tf`, each environment gets:

```hcl
locals {
  env_config = {
    staging = {
      aws_region              = "us-east-1"
      instance_type           = "t2.micro"
      rds_instance_class      = "db.t4g.micro"
      rds_allocated_storage   = 20
      enable_backup           = false
      enable_cloudfront       = false
      name_prefix             = "loopbridge-staging"
      tags = { Environment = "staging", ... }
    }
    
    production = {
      aws_region              = "us-east-1"
      instance_type           = "t3.medium"
      rds_instance_class      = "db.t4g.medium"
      rds_allocated_storage   = 100
      enable_backup           = true
      enable_cloudfront       = true
      name_prefix             = "loopbridge"
      tags = { Environment = "production", ... }
    }
  }
}
```

---

## AWS Profile Configuration

Your AWS credentials are stored in `~/.aws/credentials` and `~/.aws/config`:

```bash
# View profile
aws configure list --profile loopbridge-developer

# Output should show:
# NAME            VALUE                              TYPE
# profile         loopbridge-developer               manual
# access_key      ****SWVK                          login
# secret_key      ****3gJb                          login
# region          eu-west-2 (or your region)         config-file
```

The Terraform configuration automatically uses this profile via `deploy.sh`.

---

## Common Tasks

### Switch to Staging (Development)

```bash
./deploy.sh staging plan
./deploy.sh staging apply
```

All staging resources will be created/updated with `loopbridge-staging` prefix.

### Switch to Production (Live)

```bash
./deploy.sh production plan
./deploy.sh production apply
```

All production resources will be created/updated with `loopbridge` prefix.

### See What Will Change

```bash
./deploy.sh staging plan
# Review the output, then either:
./deploy.sh staging apply     # Apply changes
# (or Ctrl+C to cancel)
```

### Deploy Specific Resources

```bash
# Only EC2
./deploy.sh production plan -target=aws_instance.app

# Only RDS
./deploy.sh production plan -target=aws_db_instance.postgres

# Only S3
./deploy.sh production plan -target=aws_s3_bucket.uploads
```

### View Current Infrastructure

```bash
./deploy.sh staging output
# or
./deploy.sh production output
```

Returns: EC2 IP, RDS endpoint, S3 bucket, ECR repo, etc.

### Destroy Everything (CAREFUL!)

```bash
./deploy.sh staging destroy
# (asks for confirmation)
```

---

## File Structure

```
infrastructure/terraform/
├─ main.tf                    # Provider, data sources
├─ environments.tf            # ← NEW: Multi-env config (LOOPBRIDGE_ENV control)
├─ ec2.tf                     # Uses local.instance_type (from env config)
├─ rds.tf                     # Uses local.rds_instance_class (from env config)
├─ s3.tf                      # Bucket config
├─ cloudfront.tf              # CDN (conditional on enable_cloudfront)
├─ iam.tf                     # Roles & policies
├─ vpc.tf                     # Network
├─ variables.tf               # ← UPDATED: Added aws_profile variable
├─ terraform.tfvars.example   # ← UPDATED: Shows new profile usage
├─ deploy.sh                  # ← NEW: Easy CLI for multi-env deployment
├─ outputs.tf                 # EC2 IP, RDS endpoint, etc.
└─ README-PRODUCTION.md       # Operational guide

Key Changes:
- environments.tf: NEW file controlling everything
- main.tf: Updated to use local.aws_region, local.tags
- ec2.tf: Uses local.instance_type instead of var.instance_type
- deploy.sh: NEW executable script for safe deployments
```

---

## How to Modify Environments

To add more environments (e.g., `demo`, `test`):

1. **Edit `environments.tf`**:

```hcl
locals {
  env_config = {
    staging = { ... },
    demo = {  # NEW
      aws_region              = "us-east-1"
      instance_type           = "t2.micro"
      rds_instance_class      = "db.t4g.micro"
      rds_allocated_storage   = 50
      enable_backup           = true
      enable_cloudfront       = false
      name_prefix             = "loopbridge-demo"
      tags = { Environment = "demo", ... }
    },
    production = { ... }
  }
}
```

2. **Update deploy.sh validation** (line ~40):

```bash
case "$ENV" in
    staging|demo|production)  # ← Add demo
        ;;
esac
```

3. **Deploy**:

```bash
./deploy.sh demo plan
./deploy.sh demo apply
```

---

## CI/CD Integration

If you want GitHub Actions or other CI/CD to deploy:

```bash
#!/bin/bash
# Example: GitHub Actions workflow

export LOOPBRIDGE_ENV="${DEPLOYMENT_ENV:-production}"  # production by default
cd infrastructure/terraform
terraform init
terraform plan -var="deployment_env=$LOOPBRIDGE_ENV"
terraform apply -auto-approve -var="deployment_env=$LOOPBRIDGE_ENV"
```

---

## Troubleshooting

### "Error: AWS account mismatch"

```bash
# Verify you're using the right profile
aws sts get-caller-identity --profile loopbridge-developer
# Should show Account: 815771784030
```

### "terraform state lock"

If Terraform hangs during apply, it may be locked from a previous interrupted run:

```bash
./deploy.sh production plan  # This will force-unlock if needed
```

### "Invalid value for var.deployment_env"

Make sure `LOOPBRIDGE_ENV` is set correctly before running:

```bash
export LOOPBRIDGE_ENV=staging
echo $LOOPBRIDGE_ENV  # Should print: staging
./deploy.sh staging plan
```

### "terraform.tfvars not found"

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# Now fill in any values you want to override
```

---

## Next Steps

1. **Copy terraform.tfvars**:
   ```bash
   cd infrastructure/terraform
   cp terraform.tfvars.example terraform.tfvars
   ```

2. **Initialize Terraform**:
   ```bash
   ./deploy.sh production init
   ```

3. **Preview production**:
   ```bash
   ./deploy.sh production plan
   ```

4. **Deploy**:
   ```bash
   ./deploy.sh production apply
   ```

5. **Get outputs**:
   ```bash
   ./deploy.sh production output
   ```

---

## Summary

✅ **Single environment variable** (`LOOPBRIDGE_ENV`) controls everything  
✅ **Easy switching** between staging and production  
✅ **Automatic resource scaling** based on environment  
✅ **Safe deployment script** (`deploy.sh`) with confirmations  
✅ **All to loopbridge-developer account** (815771784030)  
✅ **Git-friendly** (just change one variable)  

To deploy to a different repo/branch, only modify the `github_repo` variable in `terraform.tfvars`.
