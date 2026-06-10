# LoopBridge Infrastructure — Quick Reference

## First deploy (new AWS account)

```bash
cd infrastructure/terraform

# 1. Configure
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars: set github_repo to your repo

# 2. Authenticate
aws configure --profile loopbridge-developer
# (or set AWS_PROFILE=loopbridge-developer)

# 3. Init + deploy (default tier: micro = t3.micro, ~$8/month)
export LOOPBRIDGE_ENV=micro
terraform init
terraform plan
terraform apply

# 4. Copy the github_actions_role_arn output to GitHub:
#    Repo → Settings → Secrets and variables → Actions → Variables
#    Name: AWS_ROLE_ARN   Value: <output from above>

# 5. Add GitHub Secrets (one-time):
#    JWT_SECRET, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
#    NEWSLETTER_FROM_EMAIL, GOOGLE_CLIENT_ID,
#    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
#    TWILIO_WHATSAPP_FROM, TWILIO_SMS_FROM

# 6. Push to main → CI/CD deploys automatically
```

---

## To change which GitHub repo CI/CD trusts

Edit `terraform.tfvars`:
```hcl
github_repo = "NewOrg/NewRepo"   # ← this is the ONE change
```
Then:
```bash
terraform apply
```
The OIDC trust updates. Add `AWS_ROLE_ARN` as a variable in the new repo. Done.

---

## Tiers

| Tier         | Instance   | RAM  | Cost/mo | Use when                  |
|--------------|------------|------|---------|---------------------------|
| `micro`      | t3.micro   | 1 GB | ~$8     | Default, early stage      |
| `small`      | t3.small   | 2 GB | ~$17    | Higher transcoding load   |
| `production` | t3.medium  | 4 GB | ~$34    | Scale, + CloudFront CDN   |

```bash
export LOOPBRIDGE_ENV=small
terraform apply
```

---

## Architecture

```
GitHub Actions (OIDC)
    │
    ├── ECR (Docker image push)
    └── SSM (deploy command to EC2)
              │
              ▼
         EC2 (t3.micro)
         ├── Docker container: loopbridge API
         │   └── SQLite + Litestream → S3 (continuous backup)
         └── Port 80 → app:3000

S3 bucket: uploads + media + Litestream DB replicas
```

**Scale path (no code changes needed):**
1. `micro` → `small` → `production` (just change LOOPBRIDGE_ENV)
2. Add ALB + run multiple containers → swap docker run for ECS
3. SQLite → RDS → set `DB_TYPE=postgres` env var

---

## Commands

```bash
# See what will change
LOOPBRIDGE_ENV=micro terraform plan

# Apply
LOOPBRIDGE_ENV=micro terraform apply

# Get outputs
terraform output

# Get the role ARN for GitHub
terraform output github_actions_role_arn

# Destroy (careful!)
terraform destroy
```

---

## AWS Account

Account: **loopbridge-developer** (815771784030)
Profile: `loopbridge-developer`

```bash
# Verify you're in the right account
aws sts get-caller-identity --profile loopbridge-developer
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "No running instance found" | Check EC2 tags: `Name=loopbridge-app`, `Project=LoopBridge` |
| OIDC error in GitHub Actions | Verify `AWS_ROLE_ARN` variable is set correctly |
| Wrong account | `aws sts get-caller-identity --profile loopbridge-developer` |
| State locked | `terraform force-unlock <lock-id>` |
