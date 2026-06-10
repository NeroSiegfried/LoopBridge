# Migration Guide: Moving to loopbridge-developer Account

## Current State

Your LoopBridge infrastructure is currently running in the **main AWS account** (680128294518).

## Target State

Move everything to the **loopbridge-developer account** (815771784030).

---

## Step 1: Prepare the New Environment

### 1a. Verify Access to loopbridge-developer

```bash
aws sts get-caller-identity --profile loopbridge-developer
```

Should output:
```json
{
    "UserId": "AIDA3336JSNPK7XNWVHWW",
    "Account": "815771784030",
    "Arn": "arn:aws:iam::815771784030:user/fullstack-developer"
}
```

### 1b. Set Up terraform.tfvars

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars

# Edit and ensure these are set:
# aws_profile = "loopbridge-developer"
# github_repo = "NeroSiegfried/LoopBridge"  (or your fork)
# ec2_key_pair_name = ""  (or your key)
```

---

## Step 2: Migrate Data (Optional but Recommended)

If you want to preserve data from the old environment:

### Option A: RDS Database Snapshot

```bash
# 1. In old account (680128294518), create a snapshot
aws rds create-db-snapshot \
  --db-instance-identifier loopbridge \
  --db-snapshot-identifier loopbridge-migration-snapshot \
  --region us-east-1

# Wait for snapshot to complete
aws rds describe-db-snapshots \
  --db-snapshot-identifier loopbridge-migration-snapshot \
  --region us-east-1 \
  --query 'DBSnapshots[0].Status'

# 2. Share snapshot to new account
aws rds modify-db-snapshot-attribute \
  --db-snapshot-identifier loopbridge-migration-snapshot \
  --attribute-name restore \
  --values-to-add arn:aws:iam::815771784030:root \
  --region us-east-1

# 3. In new account (loopbridge-developer), restore snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier loopbridge-restored \
  --db-snapshot-identifier arn:aws:rds:us-east-1:680128294518:snapshot:loopbridge-migration-snapshot \
  --region us-east-1 \
  --profile loopbridge-developer

# 4. Once restored, update terraform.tfvars to skip database creation
# (or import the restored instance into Terraform state)
```

### Option B: Start Fresh

If your data is small or you want a clean start:

```bash
# Just deploy fresh to new account
# Old database will be untouched (remains in old account)
# New database will be created fresh in new account
```

---

## Step 3: Deploy to New Account

### 3a. Initialize Terraform (New Account)

```bash
cd infrastructure/terraform

# Initialize Terraform for the new account
./deploy.sh production init
```

### 3b. Preview the Deployment

```bash
# See what Terraform will create in the new account
./deploy.sh production plan
```

### 3c. Deploy to Production

```bash
# Deploy to loopbridge-developer account
./deploy.sh production apply

# This will create:
# - EC2 t3.medium instance
# - RDS db.t4g.medium database
# - S3 bucket
# - CloudFront distribution
# - All other infrastructure
```

### 3d. Verify Deployment

```bash
# Get outputs (IPs, endpoints, etc.)
./deploy.sh production output

# Example output:
# alb_dns_name = "loopbridge-alb-123.us-east-1.elb.amazonaws.com"
# ec2_public_ip = "52.123.45.67"
# rds_endpoint = "loopbridge.c123abc.us-east-1.rds.amazonaws.com"
# s3_bucket = "loopbridge-uploads-815771784030"
```

---

## Step 4: Point DNS/Traffic to New Infrastructure

### Update DNS Records

If you're using a domain:

```bash
# Old: points to old EC2 IP or ALB DNS
# New: update to point to new infrastructure

# Get new IP/endpoint
./deploy.sh production output | grep ec2_public_ip

# Update DNS:
# loopbridge.com  A  52.123.45.67  (new IP)
# Or update CNAME to new ALB DNS
```

### Update Docker Deployments

If you're using Docker on the EC2:

```bash
# SSH to new EC2
aws ssm start-session --target <instance-id> \
  --profile loopbridge-developer

# Pull latest code
cd /app
docker pull <your-ecr-repo>/loopbridge:latest
docker-compose up -d
```

---

## Step 5: Verify New Infrastructure

### Health Checks

```bash
# Get EC2 IP
IP=$(./deploy.sh production output -json | jq -r '.ec2_public_ip.value')

# Check if app is running
curl http://$IP:5000/health

# Check database connectivity
mysql -h $(./deploy.sh production output -json | jq -r '.rds_endpoint.value') \
  -u admin \
  -p<password> \
  -e "SELECT 1;"
```

### Database Verification

If you migrated data:

```bash
# Connect to new RDS
mysql -h $(./deploy.sh production output -json | jq -r '.rds_endpoint.value') \
  -u admin \
  -p

# Verify tables
mysql> SHOW TABLES;
```

---

## Step 6: Decommission Old Infrastructure (Optional)

Once everything is working on the new account:

### Option A: Keep Old Account (Safe Backup)

```bash
# Leave old infrastructure running as a backup
# Useful if you need to rollback

# Stop EC2 to save costs
aws ec2 stop-instances --instance-ids i-xxxxx --region us-east-1
```

### Option B: Destroy Old Infrastructure

```bash
# Switch back to old credentials
export AWS_PROFILE=default  # or your old profile

# In old account, destroy infrastructure
cd infrastructure/terraform
terraform destroy -var="deployment_env=production"

# Confirm destruction
# This removes all resources from the old account
```

---

## Step 7: Update Environment Variables

### Docker Environment

Update your `.env` or deployment config to use new endpoints:

```bash
# OLD
RDS_HOST=old-rds-endpoint
EC2_IP=old-ip
S3_BUCKET=old-bucket

# NEW
RDS_HOST=$(./deploy.sh production output -json | jq -r '.rds_endpoint.value')
EC2_IP=$(./deploy.sh production output -json | jq -r '.ec2_public_ip.value')
S3_BUCKET=$(./deploy.sh production output -json | jq -r '.s3_bucket.value')
```

### CI/CD Pipelines

If you have GitHub Actions or similar:

```yaml
# Update to use loopbridge-developer profile
env:
  AWS_PROFILE: loopbridge-developer

# And use the new deployment script
- name: Deploy
  run: |
    cd infrastructure/terraform
    ./deploy.sh production apply
```

---

## Timeline

| Phase | Action | Time |
|-------|--------|------|
| **1** | Verify loopbridge-developer access | 5 min |
| **2** | Prepare terraform.tfvars | 10 min |
| **3** | Migrate data (optional) | 15-30 min |
| **4** | Deploy to new account | 10-15 min |
| **5** | Verify new infrastructure | 10 min |
| **6** | Update DNS/traffic | 5 min |
| **7** | Test new environment | 10-20 min |
| **8** | Decommission old (optional) | 5-10 min |

**Total: 70-125 minutes (1-2 hours)**

---

## Rollback Plan

If something goes wrong:

```bash
# Keep traffic pointing to old infrastructure
# Don't update DNS yet

# Destroy new infrastructure in loopbridge-developer
./deploy.sh production destroy

# Continue using old infrastructure
# Investigate issue
# Try migration again
```

---

## Multi-Environment After Migration

Once migration is complete, you can:

```bash
# Deploy staging (development copy)
./deploy.sh staging apply

# Deploy production (live)
./deploy.sh production apply

# Both in the same loopbridge-developer account
# Tagged differently (loopbridge-staging vs loopbridge)
```

---

## Monitoring & Support

### CloudWatch Logs

```bash
# View application logs
aws logs tail /aws/ec2/loopbridge --follow \
  --profile loopbridge-developer

# View RDS logs
aws rds describe-db-logs \
  --db-instance-identifier loopbridge \
  --profile loopbridge-developer
```

### SSH Access

```bash
# Use SSM Session Manager (no SSH key needed)
aws ssm start-session \
  --target <instance-id> \
  --profile loopbridge-developer
```

### Costs

New account monthly costs:

| Resource | Staging | Production |
|----------|---------|-----------|
| EC2 | $9 | $40 |
| RDS | $15 | $80 |
| S3 | $3 | $25 |
| CloudFront | $0 | $150 |
| Other | $0 | $5 |
| **Total** | **$27** | **$300** |

---

## Checklist

- [ ] Verified loopbridge-developer account access
- [ ] Created terraform.tfvars from example
- [ ] Initialized Terraform (`./deploy.sh production init`)
- [ ] Previewed deployment (`./deploy.sh production plan`)
- [ ] Deployed infrastructure (`./deploy.sh production apply`)
- [ ] Verified new infrastructure is running
- [ ] Migrated data (if needed)
- [ ] Updated DNS records
- [ ] Updated environment variables
- [ ] Tested new infrastructure
- [ ] Decided on old infrastructure (keep or destroy)
- [ ] Updated CI/CD pipelines

---

## Questions?

Check:
1. `infrastructure/QUICK-REFERENCE.md` — Quick commands
2. `infrastructure/MULTI-ENVIRONMENT-GUIDE.md` — Detailed guide
3. `infrastructure/SINGLE-VARIABLE-DEPLOYMENT.md` — Single variable info
4. `infrastructure/terraform/README-PRODUCTION.md` — Ops guide
