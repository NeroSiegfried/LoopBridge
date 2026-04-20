# LoopBridge Infrastructure

All AWS resources are managed as code using **Terraform**. Anyone with AWS account access and a clone of this repository can spin up the full stack in minutes.

## What's Provisioned

| Resource | Details |
|---|---|
| **VPC** | 10.0.0.0/16, non-default, DNS enabled |
| **Subnet** | 10.0.0.0/20, us-east-1a, public (auto-assign IP) |
| **Internet Gateway** | Attached to VPC, route table entry 0.0.0.0/0 |
| **Security Group** | Inbound: 80, 443, 3001 (all), SSH optional |
| **S3 Bucket** | `loopbridge-uploads-<account-id>` — uploads + Litestream replication |
| **ECR Repository** | `loopbridge-api` — Docker image registry |
| **EC2** | t2.micro, Amazon Linux 2023, 8 GB gp3, Docker pre-installed |
| **Elastic IP** | Stable public IP attached to EC2 |
| **IAM: EC2 role** | SSM + ECR read + SecretsManager + S3 + MediaConvert |
| **IAM: MediaConvert role** | S3 read (uploads/) + write (transcoded/) |
| **IAM: loopbridge-admin** | CI/CD user — ECR push + SSM deploy + S3 Litestream |

## Prerequisites

```bash
# Install Terraform
brew install terraform      # macOS
# or: https://developer.hashicorp.com/terraform/install

# Install AWS CLI + configure credentials
brew install awscli
aws configure               # use credentials for the target AWS account

# Install GitHub CLI (for secrets push)
brew install gh
gh auth login
```

## Fresh Deploy (new AWS account)

```bash
cd infrastructure/terraform

# 1. Copy and fill in variables
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars — defaults work for most cases

# 2. Initialise
terraform init

# 3. Preview
terraform plan

# 4. Apply (~2 minutes)
terraform apply

# 5. Read the CI/CD credentials from state
terraform output -raw cicd_access_key_id
terraform output -raw cicd_secret_access_key
```

## Push GitHub Secrets

After apply, fill in `secrets.env` (copied from `secrets.env.template`) and push everything to GitHub in one command:

```bash
cd /path/to/LoopBridge

# 1. Create your secrets file
cp secrets.env.template secrets.env
# edit secrets.env — paste in the Terraform outputs + your SMTP/Twilio/Google creds

# 2. Push to GitHub
bash scripts/push-secrets.sh
```

The script:
- Skips any blank values (tells you which ones)
- Is safe to re-run — it just overwrites existing secrets
- Uses `gh secret set` under the hood (no browser needed)

## Update deploy.yml After Apply

Run `terraform output deploy_yml_env_block` and copy the result into the `env:` block at the top of `.github/workflows/deploy.yml`. This updates the instance ID, ECR registry, and S3 bucket to match the new account.

## Importing Existing Resources

If you already have the LoopBridge infrastructure running (e.g. the original account), you can import it into state instead of recreating it:

```bash
# VPC
terraform import aws_vpc.main vpc-00f4572f1e2c696e6

# Subnet
terraform import aws_subnet.public subnet-07e1c13ee4ae719ff

# Internet Gateway
terraform import aws_internet_gateway.main igw-02b2592270669b492

# Security Group
terraform import aws_security_group.app sg-08c70f386d9852775

# S3
terraform import aws_s3_bucket.uploads loopbridge-uploads-680128294518

# ECR
terraform import aws_ecr_repository.api loopbridge-api

# IAM roles
terraform import aws_iam_role.ec2 loopbridge-ec2-role
terraform import aws_iam_role.mediaconvert loopbridge-mediaconvert-role
terraform import aws_iam_instance_profile.ec2 loopbridge-ec2-profile
terraform import aws_iam_user.cicd loopbridge-admin

# EC2
terraform import aws_instance.app i-035f5e2909653efa0

# Elastic IP (use allocation ID)
terraform import aws_eip.app <eipalloc-...>
```

After importing, run `terraform plan` — it should show no changes if the config matches live infrastructure.

## Cost Estimate (us-east-1, ~730 hrs/month)

| Resource | Monthly Cost |
|---|---|
| EC2 t2.micro (on-demand) | ~$8.47 |
| EBS 8 GB gp3 | ~$0.64 |
| S3 (first 5 GB) | ~$0.12 |
| ECR (first 500 MB) | ~$0.05 |
| Elastic IP (attached) | $0.00 |
| Data transfer (first 100 GB) | ~$0.00–$9.00 |
| **Total** | **~$9–18/month** |

> Free Tier: t2.micro + 30 GB EBS + 5 GB S3 are free for 12 months on new accounts.
