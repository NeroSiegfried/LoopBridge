# Single Variable Deployment Strategy

## Problem Solved

Previously, deploying to a new repo/account required:
- Updating multiple Terraform variables
- Manually choosing instance sizes
- Remembering backup settings per environment
- Managing multiple terraform.tfvars files

**Now**: One environment variable controls everything.

---

## The Single Variable: `LOOPBRIDGE_ENV`

This variable controls:

```
LOOPBRIDGE_ENV=staging  →  t2.micro + db.t4g.micro + no backup
LOOPBRIDGE_ENV=production  →  t3.medium + db.t4g.medium + backup + CDN
```

### Usage

**Option 1: Via deploy.sh (Recommended)**
```bash
./deploy.sh staging plan
./deploy.sh staging apply
./deploy.sh production plan
./deploy.sh production apply
```

**Option 2: Manual Terraform**
```bash
export LOOPBRIDGE_ENV=staging
terraform plan -var="deployment_env=$LOOPBRIDGE_ENV"
terraform apply -var="deployment_env=$LOOPBRIDGE_ENV"
```

**Option 3: One-liner**
```bash
terraform plan -var="deployment_env=production"
terraform apply -var="deployment_env=production"
```

---

## Changing the Repository

To deploy the same infrastructure but from a different GitHub repo:

```bash
# Edit terraform.tfvars
nano infrastructure/terraform/terraform.tfvars

# Change this line:
github_repo = "NeroSiegfried/LoopBridge"  # ← Your new repo

# Then deploy as normal
./deploy.sh production apply
```

The EC2 instance will use the new `github_repo` value when pulling the source code.

---

## Multi-Staging Strategy

Deploy multiple staging environments with different configurations:

**Option A: Multiple AWS accounts**
```bash
# Deploy to account 1 (loopbridge-developer)
export AWS_PROFILE=loopbridge-developer
./deploy.sh staging apply

# Deploy to account 2 (other-account)
export AWS_PROFILE=other-account-profile
./deploy.sh staging apply
```

**Option B: Multiple environments in one account**
```bash
# Staging for testing
./deploy.sh staging apply

# Production for live
./deploy.sh production apply
```

**Option C: Add custom environment to environments.tf**
```hcl
locals {
  env_config = {
    staging = { ... },
    demo = { 
      instance_type = "t2.small"
      name_prefix = "loopbridge-demo"
      # ... other config
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

## Configuration Breakdown

### What Terraform Selects Based on LOOPBRIDGE_ENV

| Setting | Staging | Production |
|---------|---------|-----------|
| `instance_type` | t2.micro | t3.medium |
| `rds_instance_class` | db.t4g.micro | db.t4g.medium |
| `rds_allocated_storage` | 20 GB | 100 GB |
| `enable_backup` | false | true |
| `enable_cloudfront` | false | true |
| `name_prefix` | `loopbridge-staging` | `loopbridge` |
| `enable_multi_az` | false | true |

### Location of Config

File: `infrastructure/terraform/environments.tf`

```hcl
locals {
  env_config = {
    staging = {
      instance_type = "t2.micro"
      rds_instance_class = "db.t4g.micro"
      # ... all settings
    }
    production = {
      instance_type = "t3.medium"
      rds_instance_class = "db.t4g.medium"
      # ... all settings
    }
  }
  
  # Terraform uses the selected config:
  current_env = var.deployment_env  # Set by LOOPBRIDGE_ENV
  config = local.env_config[local.current_env]
  instance_type = local.config.instance_type  # ← Used by EC2
  rds_instance_class = local.config.rds_instance_class  # ← Used by RDS
  # ... rest of infrastructure uses these local values
}
```

---

## Zero-Code Environment Swaps

You can now swap environments **without touching code**:

```bash
# Deploy staging
./deploy.sh staging apply

# Preview production (with t3.medium, etc.)
./deploy.sh production plan

# Modify terraform.tfvars if needed (e.g., different repo)
nano infrastructure/terraform/terraform.tfvars

# Deploy production
./deploy.sh production apply

# Switch back to staging without any code changes
./deploy.sh staging apply
```

---

## Practical Examples

### Example 1: Test on Staging, Deploy to Production

```bash
# Develop on staging
./deploy.sh staging apply

# Run tests...
# Everything works!

# Deploy to production (same config, but with t3.medium)
./deploy.sh production apply
```

### Example 2: Multiple GitHub Repos

```bash
# Deploy main repo to production
terraform.tfvars:
  github_repo = "NeroSiegfried/LoopBridge"
./deploy.sh production apply

# Deploy fork to staging
terraform.tfvars:
  github_repo = "username/LoopBridge-fork"
./deploy.sh staging apply

# Deploy experimental branch to demo
terraform.tfvars:
  github_repo = "NeroSiegfried/LoopBridge-experimental"
# (if you added 'demo' to environments.tf)
./deploy.sh demo apply
```

### Example 3: Scale from Staging to Production

```bash
# Start with staging (cheap)
./deploy.sh staging apply

# Getting traffic? Upgrade to production (bigger resources)
./deploy.sh production apply

# Terraform automatically scales:
# - EC2: t2.micro → t3.medium
# - RDS: t4g.micro → t4g.medium
# - Storage: 20 GB → 100 GB
# - Backups: disabled → enabled
# - CDN: disabled → enabled
```

---

## Summary

✅ Single `LOOPBRIDGE_ENV` variable controls all configuration  
✅ No code changes needed to switch environments  
✅ One terraform.tfvars file for all deployments  
✅ Use `./deploy.sh <env> <command>` for safe, interactive deployments  
✅ Automatic scaling from staging to production  
✅ Multi-repo support via `github_repo` variable  
✅ All resources deployed to `loopbridge-developer` AWS account  

**To change repo**: Update `github_repo` in terraform.tfvars, then deploy.  
**To change environment**: Use `./deploy.sh staging` or `./deploy.sh production`
