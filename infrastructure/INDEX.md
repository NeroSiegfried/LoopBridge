# Infrastructure Documentation Index

## Start Here

**New to this setup?** Start with one of these based on your task:

### 🚀 I Want to Deploy Now
→ Read: `infrastructure/QUICK-REFERENCE.md`

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
./deploy.sh production apply
```

### 📚 I Want to Understand Everything
→ Read: `infrastructure/MULTI-ENVIRONMENT-GUIDE.md`

Covers:
- How environments work
- What each environment includes
- How to add more environments
- CI/CD integration

### 🔧 I Want to Know About the Single Variable
→ Read: `infrastructure/SINGLE-VARIABLE-DEPLOYMENT.md`

Explains:
- How `LOOPBRIDGE_ENV` controls everything
- What it controls
- Multi-repo support
- Configuration breakdown

### 🚚 I'm Migrating from Old Account
→ Read: `infrastructure/MIGRATION-TO-LOOPBRIDGE-DEVELOPER.md`

Step-by-step:
- Verify loopbridge-developer account access
- Prepare terraform.tfvars
- Optionally migrate data
- Deploy to new account
- Decommission old infrastructure

### ✅ I Just Want a Summary
→ Read: `infrastructure/SETUP-COMPLETE.md`

Quick overview:
- What was set up
- Quick start (4 steps)
- Key benefits
- Common commands

---

## Complete Documentation Map

```
infrastructure/
│
├─ SETUP-COMPLETE.md ⭐
│  └─ Overview & summary (5 min read)
│
├─ QUICK-REFERENCE.md ⭐
│  └─ TL;DR commands & examples (10 min read)
│
├─ MULTI-ENVIRONMENT-GUIDE.md
│  └─ Comprehensive guide (30 min read)
│     ├─ Environment comparison
│     ├─ How single variable works
│     ├─ Common tasks
│     ├─ CI/CD integration
│     └─ Troubleshooting
│
├─ SINGLE-VARIABLE-DEPLOYMENT.md
│  └─ Single variable focus (15 min read)
│     ├─ What problem it solves
│     ├─ Configuration breakdown
│     ├─ Multi-repo support
│     └─ Practical examples
│
├─ MIGRATION-TO-LOOPBRIDGE-DEVELOPER.md
│  └─ Migration steps (20 min read)
│     ├─ Verify access
│     ├─ Prepare environment
│     ├─ Migrate data (optional)
│     ├─ Deploy to new account
│     ├─ Verify & test
│     └─ Decommission old
│
├─ README.md
│  └─ Infrastructure overview
│
└─ terraform/
   ├─ deploy.sh ⭐
   │  └─ Easy CLI for deployments
   │     $ ./deploy.sh staging plan
   │     $ ./deploy.sh production apply
   │
   ├─ environments.tf ⭐
   │  └─ Multi-environment config (LOOPBRIDGE_ENV control)
   │
   ├─ main.tf
   │  └─ AWS provider & globals
   │
   ├─ variables.tf
   │  └─ All input variables
   │
   ├─ terraform.tfvars.example ⭐
   │  └─ Copy to terraform.tfvars and fill in
   │
   ├─ ec2.tf
   │  └─ EC2 instance
   │
   ├─ rds.tf
   │  └─ RDS database
   │
   ├─ s3.tf
   │  └─ S3 storage
   │
   ├─ cloudfront.tf
   │  └─ CDN distribution
   │
   ├─ iam.tf
   │  └─ Roles & policies
   │
   ├─ vpc.tf
   │  └─ Networking
   │
   ├─ outputs.tf
   │  └─ EC2 IP, RDS endpoint, etc.
   │
   ├─ README-PRODUCTION.md
   │  └─ Operational guide
   │
   └─ (state files: terraform.tfstate, tfplan, .terraform/)
```

---

## By Task

### Deploy Infrastructure

1. **First Time Ever?**
   - Read: `SETUP-COMPLETE.md` (5 min)
   - Read: `QUICK-REFERENCE.md` (10 min)
   - Execute: 4-step quick start

2. **Deploy to Staging**
   ```bash
   cd infrastructure/terraform
   ./deploy.sh staging plan
   ./deploy.sh staging apply
   ```

3. **Deploy to Production**
   ```bash
   cd infrastructure/terraform
   ./deploy.sh production plan
   ./deploy.sh production apply
   ```

4. **Deploy from Different Repo**
   ```bash
   cd infrastructure/terraform
   nano terraform.tfvars
   # Change: github_repo = "your-repo"
   ./deploy.sh production apply
   ```

### Understand Configuration

1. **How do environments work?**
   - Read: `MULTI-ENVIRONMENT-GUIDE.md` → "Environment Comparison"

2. **What controls what?**
   - Read: `SINGLE-VARIABLE-DEPLOYMENT.md` → "Configuration Breakdown"
   - Read: `environments.tf` (the actual config)

3. **What gets deployed?**
   - Read: `QUICK-REFERENCE.md` → "What Gets Deployed"
   - Run: `./deploy.sh production output`

### Migrate from Old Account

1. Read: `MIGRATION-TO-LOOPBRIDGE-DEVELOPER.md`
2. Step 1: Verify access
3. Step 2: Migrate data (optional)
4. Step 3-4: Deploy to new account
5. Step 5-6: Point DNS & verify
6. Step 7: Decommission old (optional)

### Add More Environments

1. Edit: `terraform/environments.tf`
2. Add a new entry to `env_config` map
3. Deploy: `./deploy.sh <newenv> apply`

See: `MULTI-ENVIRONMENT-GUIDE.md` → "How to Modify Environments"

### CI/CD Integration

Read: `MULTI-ENVIRONMENT-GUIDE.md` → "CI/CD Integration"

### Troubleshooting

- See: `QUICK-REFERENCE.md` → "Troubleshooting"
- See: `MULTI-ENVIRONMENT-GUIDE.md` → "Troubleshooting"

---

## Key Files

| File | Purpose | When to Use |
|------|---------|-----------|
| `SETUP-COMPLETE.md` | Overview | First time setup |
| `QUICK-REFERENCE.md` | Quick commands | Need to deploy quickly |
| `MULTI-ENVIRONMENT-GUIDE.md` | Comprehensive guide | Want full understanding |
| `SINGLE-VARIABLE-DEPLOYMENT.md` | Single variable details | Customizing for your needs |
| `MIGRATION-TO-LOOPBRIDGE-DEVELOPER.md` | Migration steps | Moving to new account |
| `terraform/deploy.sh` | Deployment CLI | Actually deploying |
| `terraform/environments.tf` | Config | Modifying environment settings |
| `terraform/terraform.tfvars` | Your values | Deployment secrets & settings |

---

## AWS Account Info

- **Account Name**: loopbridge-developer
- **Account ID**: 815771784030
- **Profile**: loopbridge-developer
- **Region**: us-east-1
- **User**: fullstack-developer

### Verify Access

```bash
aws sts get-caller-identity --profile loopbridge-developer
# Should show Account: 815771784030
```

---

## The Single Variable: LOOPBRIDGE_ENV

All environment differences controlled by one variable:

```
LOOPBRIDGE_ENV=staging      → t2.micro, db.t4g.micro, no CDN, ~$27/mo
LOOPBRIDGE_ENV=production   → t3.medium, db.t4g.medium, CDN, ~$300/mo
```

Set automatically by `deploy.sh`, or manually:

```bash
export LOOPBRIDGE_ENV=production
terraform plan -var="deployment_env=$LOOPBRIDGE_ENV"
```

---

## Quick Start (TL;DR)

```bash
# 1. Prepare
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars

# 2. Initialize (one-time)
./deploy.sh production init

# 3. Preview
./deploy.sh production plan

# 4. Deploy
./deploy.sh production apply

# 5. Check results
./deploy.sh production output
```

Done! Infrastructure running in loopbridge-developer account.

---

## File Dependencies

```
deploy.sh ──requires──> terraform.tfvars
                        ├─> main.tf (provider, globals)
                        ├─> environments.tf (single variable control)
                        ├─> variables.tf (all variable definitions)
                        ├─> ec2.tf (uses local.instance_type)
                        ├─> rds.tf (uses local.rds_instance_class)
                        ├─> s3.tf
                        ├─> cloudfront.tf
                        ├─> iam.tf
                        ├─> vpc.tf
                        └─> outputs.tf
```

All `.tf` files work together. `environments.tf` is the control center.

---

## Documentation Reading Order

1. **Just want to deploy?**
   - `QUICK-REFERENCE.md` (5 min) → Deploy!

2. **Want to understand?**
   - `SETUP-COMPLETE.md` (5 min)
   - `MULTI-ENVIRONMENT-GUIDE.md` (20 min)
   - `SINGLE-VARIABLE-DEPLOYMENT.md` (10 min)

3. **Migrating from old account?**
   - `MIGRATION-TO-LOOPBRIDGE-DEVELOPER.md` (20 min)
   - Then deploy following step 1

4. **Deep dive?**
   - Read all docs
   - Explore `environments.tf` directly

---

## What to Do Right Now

### Option A: Deploy Now
```bash
cd infrastructure/terraform
./deploy.sh production plan
./deploy.sh production apply
```

### Option B: Learn First
Read `infrastructure/QUICK-REFERENCE.md` (5 min)

### Option C: Full Understanding
Read `infrastructure/MULTI-ENVIRONMENT-GUIDE.md` (25 min)

### Option D: Migration
Read `infrastructure/MIGRATION-TO-LOOPBRIDGE-DEVELOPER.md` (20 min)

---

## Questions?

| Question | Answer Location |
|----------|-----------------|
| How do I deploy? | `QUICK-REFERENCE.md` |
| How do environments work? | `MULTI-ENVIRONMENT-GUIDE.md` |
| What does LOOPBRIDGE_ENV do? | `SINGLE-VARIABLE-DEPLOYMENT.md` |
| How do I migrate? | `MIGRATION-TO-LOOPBRIDGE-DEVELOPER.md` |
| What gets deployed? | `SETUP-COMPLETE.md` → "Environment Comparison" |
| How do I add an environment? | `MULTI-ENVIRONMENT-GUIDE.md` → "How to Modify Environments" |
| How do I use a different repo? | `SINGLE-VARIABLE-DEPLOYMENT.md` → "To Change Repository" |
| Something's broken | `QUICK-REFERENCE.md` → "Troubleshooting" |

---

## Summary

✅ Multi-environment setup complete  
✅ Single variable (`LOOPBRIDGE_ENV`) controls everything  
✅ Deployed to loopbridge-developer account (815771784030)  
✅ Safe deployment script (`deploy.sh`)  
✅ Repository-agnostic (change via `terraform.tfvars`)  
✅ Fully documented with guides for every use case  

**Next Step**: Read `QUICK-REFERENCE.md` and deploy!
