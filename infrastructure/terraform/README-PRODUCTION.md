# LoopBridge Terraform Production Deployment Guide

This directory contains the Infrastructure-as-Code (IaC) for deploying LoopBridge to AWS.

## Quick Start

### 1. Prerequisites

- [ ] AWS Account with appropriate permissions
- [ ] Terraform >= 1.6
- [ ] AWS CLI configured with credentials
- [ ] Domain name registered (for SSL/DNS)
- [ ] Payment gateway accounts (Paystack, Flutterwave, NOWPayments)
- [ ] Twilio account (for SMS/WhatsApp OTP)
- [ ] SMTP server credentials (SendGrid, AWS SES, etc.)

### 2. Configuration

```bash
# Clone the repo
git clone https://github.com/yourusername/loopbridge.git
cd loopbridge/infrastructure/terraform

# Copy example vars file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

### 3. Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply infrastructure
terraform apply

# Save outputs
terraform output -json > outputs.json
```

## Terraform Modules

### `main.tf`
- Provider configuration
- Data sources (current AWS account)
- Local variables

### `vpc.tf`
- VPC with 2 public + 2 private subnets (Multi-AZ)
- Internet Gateway and NAT Gateway
- Route tables and associations

### `s3.tf`
- S3 bucket for uploads (versioning, encryption, lifecycle)
- S3 bucket for Terraform state (optional)

### `ec2.tf`
- EC2 instance (t3.small or larger for production)
- Security group (ports 80, 443, 22)
- IAM instance role (S3, CloudWatch, Secrets Manager access)
- CloudWatch alarms (CPU, disk, status checks)

### `ecr.tf`
- ECR repository for Docker images
- Lifecycle policy (keep last 10 images)

### `iam.tf`
- EC2 instance role and policies
- MediaConvert role and policies
- Lambda execution role and policies
- CI/CD user (for GitHub Actions)

### `rds.tf` ⭐ NEW
- RDS PostgreSQL 16 with Multi-AZ
- Automated backups (35-day retention)
- Enhanced monitoring and performance insights
- KMS encryption
- Security group (access only from EC2)
- CloudWatch alarms (CPU, storage, connections)
- Secrets Manager integration

### `cloudfront.tf` ⭐ NEW
- CloudFront distribution for S3 media
- Origin Access Identity for secure S3 access
- Cache behaviors for manifests (.m3u8) and segments (.ts)
- CloudWatch alarms (4xx/5xx error rates)

### `lambda.tf` ⭐ NEW
- Lambda function for MediaConvert webhooks
- EventBridge rule to trigger Lambda on transcode completion
- IAM role with S3 and SNS permissions
- CloudWatch alarms (errors, throttles)

### `variables.tf` ⭐ UPDATED
- Added RDS variables (instance class, storage)
- Added payment gateway variables
- Added communications variables (Twilio, SMTP)
- Added OAuth variables
- Added monitoring variables

### `outputs.tf`
- VPC ID, subnets
- EC2 public IP, instance ID
- RDS endpoint, database name
- S3 bucket name, CloudFront URL
- ECR repository URI
- Secrets Manager ARN references

## Environment Variables (terraform.tfvars)

```hcl
aws_region              = "us-east-1"
environment             = "production"
app_domain              = "yourdomain.com"
enable_https            = true

# Database
rds_instance_class      = "db.t4g.medium"
rds_allocated_storage   = 100

# Payments
paystack_secret_key     = "sk_live_..."
paystack_public_key     = "pk_live_..."
flutterwave_secret_key  = "FLWSECK_LIVE_..."
flutterwave_public_key  = "FLWPUBK_LIVE_..."
flutterwave_encryption_key = "..."
nowpayments_api_key     = "..."
nowpayments_ipn_secret  = "..."

# Communications
twilio_account_sid      = "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
twilio_auth_token       = "your_auth_token"
twilio_whatsapp_from    = "whatsapp:+14155238886"
twilio_sms_from         = "+1234567890"
smtp_host               = "smtp.sendgrid.net"
smtp_port               = 587
smtp_user               = "apikey"
smtp_password           = "SG.xxx..."
newsletter_from_email   = "newsletter@yourdomain.com"

# OAuth
google_client_id        = "xxx.apps.googleusercontent.com"
google_client_secret    = "GOCSPX-..."

# Monitoring
alarm_email_topic_arn   = "arn:aws:sns:us-east-1:123456789:alarms"
transcode_webhook_secret = "your-secret-key"
```

## Deployment Workflow

### Phase 1: VPC & Networking (5 min)

```bash
terraform apply -target=aws_vpc.main -target=aws_subnet.public_1
# Creates VPC, subnets, IGW, NAT
```

### Phase 2: Storage (5 min)

```bash
terraform apply -target=aws_s3_bucket.uploads -target=aws_cloudfront_distribution.media
# Creates S3, CloudFront CDN
```

### Phase 3: Database (10 min)

```bash
terraform apply -target=aws_db_instance.loopbridge
# Creates RDS PostgreSQL, stored in Secrets Manager
```

### Phase 4: Compute (15 min)

```bash
terraform apply -target=aws_instance.app
# Creates EC2, security group, IAM role
```

### Phase 5: Serverless (5 min)

```bash
terraform apply -target=aws_lambda_function.transcode_callback
# Creates Lambda, EventBridge, IAM role
```

### Full Deployment

```bash
terraform apply
# Deploys everything in dependency order
```

## Post-Deployment Steps

1. **SSH into EC2 and verify setup**:
```bash
EC2_IP=$(terraform output -raw ec2_public_ip)
ssh -i my-keypair.pem ec2-user@${EC2_IP}
docker ps
```

2. **Configure DNS**:
   - Add A record pointing to EC2 IP or ALB
   - Update `app_domain` in app config

3. **Set up SSL**:
   - Use Let's Encrypt + certbot
   - Or attach AWS Certificate Manager cert to ALB

4. **Deploy Docker image**:
```bash
# Build and push to ECR
docker build -f server/Dockerfile -t loopbridge-api .
docker tag loopbridge-api:latest $ECR_URI:latest
docker push $ECR_URI:latest

# Pull and run on EC2
docker pull $ECR_URI:latest
docker run -d --name loopbridge \
  -e DATABASE_URL="postgresql://..." \
  -e PAYSTACK_SECRET_KEY="..." \
  $ECR_URI:latest
```

5. **Seed database** (optional):
```bash
# From EC2
cd /path/to/loopbridge/server
npm run seed
```

6. **Verify endpoints**:
```bash
curl https://yourdomain.com/api/health
curl https://yourdomain.com/api/courses
```

## Monitoring & Operations

### CloudWatch Dashboards
- View EC2 metrics (CPU, memory, network)
- View RDS metrics (CPU, connections, storage)
- View Lambda metrics (invocations, duration, errors)

### CloudWatch Alarms
- EC2 CPU > 80%
- RDS CPU > 80%
- RDS storage < 10GB
- Lambda errors > 5
- CloudFront 5xx > 1%

### Logs
- EC2: `/var/log/docker-loopbridge.log`
- RDS: CloudWatch Logs Group `/aws/rds/instance/loopbridge-db/postgresql`
- Lambda: CloudWatch Logs Group `/aws/lambda/loopbridge-transcode-callback`

## Cost Estimation (US East — Tiered)

| Tier | Users | Instance | Video Processing | Database | ~Monthly |
|------|-------|----------|------------------|----------|----------|
| **Starter** | 0–500 | t2.micro | **Local ffmpeg** (free!) | SQLite | **~$9–15** |
| **Growth** | 500–5k | t3.small | Local ffmpeg or MediaConvert | SQLite or RDS t4g.micro | **~$60–90** |
| **Scale** | 5k–50k | t3.medium | MediaConvert (async) | RDS db.t4g.medium Multi-AZ | **~$200–350** |

> **Key insight**: Local ffmpeg runs on EC2 during uploads, saves files to disk or S3. Scales to MediaConvert later when transcoding becomes a bottleneck (Growth/Scale tiers).

## Scaling Considerations

- **Auto-scaling**: Add `aws_autoscaling_group` for EC2 (if adding ALB)
- **RDS scaling**: Upgrade instance class or add read replicas
- **Lambda concurrency**: Increase reserved concurrency if needed
- **CloudFront**: Already auto-scales; monitor cache hit ratio

## Troubleshooting

### Terraform state conflicts
```bash
terraform state list
terraform state show aws_db_instance.loopbridge
terraform state rm aws_instance.app  # If needed
```

### Failed deployment
```bash
terraform plan -out=tfplan
terraform apply tfplan  # Apply specific plan
```

### Destroying resources
```bash
# CAREFUL! This deletes everything
terraform destroy

# Or target specific resources
terraform destroy -target=aws_instance.app
```

## Best Practices

- [ ] Use `terraform.tfvars.example` as template (don't commit secrets)
- [ ] Enable S3 backend for team collaboration: uncomment in `main.tf`
- [ ] Use Terraform Cloud for remote state locking
- [ ] Tag all resources consistently (Project, Environment, ManagedBy)
- [ ] Review `terraform plan` output before applying
- [ ] Keep backups of RDS and S3 (already configured)
- [ ] Monitor costs in AWS Cost Explorer

## References

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
- [CloudFront Performance](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/)
