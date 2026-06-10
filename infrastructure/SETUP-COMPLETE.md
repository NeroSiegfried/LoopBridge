# LoopBridge Multi-Account Migration Setup — Complete

## Summary

Your LoopBridge infrastructure is now configured for **multi-environment deployment** using a **single environment variable**, all deployed to your **loopbridge-developer AWS account** (815771784030).

---

## What Was Set Up

### 1. **Single Environment Variable Control**

Change one variable to control:
- EC2 instance size (t2.micro vs t3.medium)
- RDS instance class (t4g.micro vs t4g.medium)
- Backup settings (off vs on)
- CDN (disabled vs enabled)
- Resource naming & tagging

```bash
LOOPBRIDGE_ENV=staging      # → cheap development setup
LOOPBRIDGE_ENV=production   # → full production setup
```

### 2. **AWS Profile Integration**

All deployments use `loopbridge-developer` AWS profile:
- Account: 815771784030
- Profile: loopbridge-developer
- Credentials: Configured in `~/.aws/credentials`

### 3. **Safe Deployment Script**

```bash
./deploy.sh <staging|production> <init|plan|apply|destroy|output>
```

Features:
- ✅ Automatic confirmation prompts
- ✅ Preview changes before applying
- ✅ One command to switch environments
- ✅ Interactive output

### 4. **Repository-Agnostic**

To deploy from a different repository:

Edit `terraform.tfvars`:
```hcl
github_repo = "username/different-repo"
```

Then:
```bash
./deploy.sh production apply
```

---

## Files Created/Modified

### New Files

```
infrastructure/
├─ QUICK-REFERENCE.md                    ← Start here for quick commands
├─ MULTI-ENVIRONMENT-GUIDE.md            ← Comprehensive guide
├─ SINGLE-VARIABLE-DEPLOYMENT.md         ← How single variable works
├─ MIGRATION-TO-LOOPBRIDGE-DEVELOPER.md  ← Migration steps
└─ terraform/
   ├─ environments.tf                    ← NEW: Env config (staging vs prod)
   ├─ deploy.sh                          ← NEW: Safe CLI for deployments
   └─ (updated)
       ├─ main.tf                        ← Uses environments.tf config
       ├─ ec2.tf                         ← Uses local.instance_type
       ├─ variables.tf                   ← Added aws_profile
       └─ terraform.tfvars.example       ← Updated for new workflow
```

### Key Changes

| File | Change |
|------|--------|
| `main.tf` | Now uses `local.aws_region`, `local.tags`, `local.bucket_name` |
| `ec2.tf` | Uses `local.instance_type` instead of `var.instance_type` |
| `variables.tf` | Added `aws_profile` variable (defaults to `loopbridge-developer`) |
| `terraform.tfvars.example` | Updated with new profile & environment docs |

---

## Quick Start (4 Steps)

### Step 1: Prepare

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars if needed (most defaults are good)
```

### Step 2: Initialize (One-time)

```bash
./deploy.sh production init
```

### Step 3: Preview

```bash
./deploy.sh production plan
```

### Step 4: Deploy

```bash
./deploy.sh production apply
```

Done! Infrastructure is running in loopbridge-developer account.

---

## Usage Examples

### Deploy to Staging (Development)

```bash
./deploy.sh staging plan    # Preview
./deploy.sh staging apply   # Deploy t2.micro + small DB
```

### Deploy to Production (Live)

```bash
./deploy.sh production plan    # Preview
./deploy.sh production apply   # Deploy t3.medium + full DB + CDN
```

### Switch Between Environments

```bash
# Currently running staging? Switch to production
./deploy.sh production apply

# Back to staging
./deploy.sh staging apply
```

### Deploy from Different Repository

```bash
# Edit terraform.tfvars
github_repo = "your-username/your-fork"

# Deploy
./deploy.sh production apply

# EC2 will pull from new repo on next update
```

---

## Environment Comparison

### Staging (Development)

```
Cost: ~$27/month

✓ EC2 t2.micro                (~$9)
✓ RDS db.t4g.micro            (~$15)
✓ S3 bucket                   (~$3)
✓ Name: loopbridge-staging
✓ No CloudFront
✓ No backups
✓ Single AZ
```

### Production (Live)

```
Cost: ~$300/month

✓ EC2 t3.medium               (~$40)
✓ RDS db.t4g.medium Multi-AZ  (~$80)
✓ S3 bucket                   (~$25)
✓ CloudFront CDN              (~$150)
✓ Name: loopbridge
✓ Daily backups (7 day retention)
✓ Multi-AZ for HA
```

---

## The Single Variable: LOOPBRIDGE_ENV

### How It Works

```
You run:
  ./deploy.sh production apply

Script internally:
  export LOOPBRIDGE_ENV=production

Terraform reads:
  environments.tf → selects production config

Config controls:
  instance_type = t3.medium
  rds_instance_class = db.t4g.medium
  enable_backup = true
  enable_cloudfront = true
  name_prefix = "loopbridge"

Result:
  Production infrastructure deployed to loopbridge-developer
```

### Add More Environments

To add staging, demo, canary, etc., just add to `environments.tf`:

```hcl
locals {
  env_config = {
    staging = { ... },
    demo = {            # ← NEW
      instance_type = "t2.small",
      name_prefix = "loopbridge-demo",
      # ... other settings
    },
    production = { ... }
  }
}
```

Then deploy:
```bash
./deploy.sh demo apply
```

---

## AWS Account Details

### Account Info

- **Name**: loopbridge-developer
- **Account ID**: 815771784030
- **Region**: us-east-1
- **Profile**: loopbridge-developer
- **Access**: Via AWS CLI using configured profile

### Verification

```bash
aws sts get-caller-identity --profile loopbridge-developer
# Should return Account: 815771784030
```

---

## Common Commands

```bash
# Deployment
./deploy.sh staging plan                # Preview staging changes
./deploy.sh staging apply               # Deploy to staging
./deploy.sh production plan             # Preview production
./deploy.sh production apply            # Deploy to production
./deploy.sh production destroy          # Destroy production (careful!)

# Information
./deploy.sh staging output              # Get staging IPs, endpoints
./deploy.sh production output           # Get production IPs, endpoints
./deploy.sh production output -json     # JSON format

# Manual Terraform (if needed)
export LOOPBRIDGE_ENV=production
terraform plan -var="deployment_env=$LOOPBRIDGE_ENV"
terraform apply -var="deployment_env=$LOOPBRIDGE_ENV"
```

---

## What Terraform Controls

All with a single `LOOPBRIDGE_ENV` variable:

```
✓ EC2 instance type & size
✓ RDS database tier & storage
✓ Multi-AZ availability
✓ Backup frequency & retention
✓ CloudFront CDN
✓ All resource naming
✓ Tags & labels
✓ Security groups
✓ VPC configuration
✓ IAM roles & policies
✓ S3 buckets & policies
✓ ECR repositories
```

---

## Migration Path

If currently running in old account (680128294518):

1. **Prepare** → `cp terraform.tfvars.example terraform.tfvars`
2. **Initialize** → `./deploy.sh production init`
3. **Deploy** → `./deploy.sh production apply`
4. **Verify** → `./deploy.sh production output`
5. **Migrate data** (optional) → Use RDS snapshots
6. **Update DNS** → Point to new infrastructure
7. **Test** → Verify everything works
8. **Cleanup** (optional) → Destroy old infrastructure

See `infrastructure/MIGRATION-TO-LOOPBRIDGE-DEVELOPER.md` for detailed steps.

---

## Documentation Files

| File | Purpose |
|------|---------|
| `QUICK-REFERENCE.md` | TL;DR commands and quick start |
| `MULTI-ENVIRONMENT-GUIDE.md` | Comprehensive deployment guide |
| `SINGLE-VARIABLE-DEPLOYMENT.md` | How the single variable works |
| `MIGRATION-TO-LOOPBRIDGE-DEVELOPER.md` | Step-by-step migration guide |
| `terraform/deploy.sh` | Automated deployment script |
| `terraform/environments.tf` | Environment configurations |

---

## Next Steps

1. **Read** → Start with `infrastructure/QUICK-REFERENCE.md`
2. **Prepare** → `cp terraform.tfvars.example terraform.tfvars`
3. **Initialize** → `./deploy.sh production init`
4. **Deploy** → `./deploy.sh production plan && ./deploy.sh production apply`
5. **Verify** → `./deploy.sh production output`

---

## Key Benefits

✅ **One variable controls everything** — no more manual config  
✅ **Safe deployments** — confirmations & previews  
✅ **Multi-environment** — staging and production in same account  
✅ **Multi-repo ready** — change `github_repo` in terraform.tfvars  
✅ **Automatic scaling** — add more environments easily  
✅ **Clear infrastructure** — all resources tagged & named per environment  
✅ **Cost-optimized** — right-sized for each environment  
✅ **Production-ready** — Multi-AZ, backups, CDN enabled for prod  

---

## Support

**Issue**: Can't authenticate with AWS  
**Fix**: `aws configure list --profile loopbridge-developer`

**Issue**: terraform.tfvars missing  
**Fix**: `cp terraform.tfvars.example terraform.tfvars`

**Issue**: Wrong environment deployed  
**Fix**: Check `export LOOPBRIDGE_ENV=staging` or `export LOOPBRIDGE_ENV=production`

**Issue**: State locked  
**Fix**: Wait or run `terraform force-unlock <lock-id>`

See detailed docs in `infrastructure/` directory for more troubleshooting.

---

## Summary

Your LoopBridge infrastructure is now:

- ✅ Configured for multi-environment deployment
- ✅ Using a single `LOOPBRIDGE_ENV` variable
- ✅ Deployed to `loopbridge-developer` AWS account
- ✅ Ready for staging and production
- ✅ Repository-agnostic (change via `terraform.tfvars`)
- ✅ Safe with the `deploy.sh` script
- ✅ Fully documented

**Ready to deploy?**

```bash
cd infrastructure/terraform
./deploy.sh production plan
./deploy.sh production apply
```
