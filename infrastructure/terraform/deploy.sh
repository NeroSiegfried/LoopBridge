#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# infrastructure/terraform/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
# Multi-environment deployment helper for LoopBridge
#
# Usage:
#   ./deploy.sh staging plan      # Preview staging changes
#   ./deploy.sh staging apply     # Deploy to staging
#   ./deploy.sh production plan   # Preview production changes
#   ./deploy.sh production apply  # Deploy to production
#
# This script automatically:
#   - Sets LOOPBRIDGE_ENV (controls instance size, DB tier, etc.)
#   - Uses loopbridge-developer AWS profile
#   - Handles terraform init, plan, apply
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Usage check
if [[ $# -lt 2 ]]; then
    cat << EOF
${BLUE}LoopBridge Multi-Environment Deployment${NC}

Usage: $0 <environment> <command> [extra-args]

Environments:
  ${GREEN}staging${NC}     - Development environment (t2.micro, db.t4g.micro)
  ${GREEN}production${NC}  - Production environment (t3.medium, db.t4g.medium)

Commands:
  ${YELLOW}init${NC}       - Initialize Terraform (one-time)
  ${YELLOW}plan${NC}       - Show changes without applying
  ${YELLOW}apply${NC}      - Apply changes to AWS
  ${YELLOW}destroy${NC}    - Destroy all resources (CAREFUL!)
  ${YELLOW}output${NC}     - Show outputs (IPs, endpoints, etc.)

Examples:
  $0 staging plan
  $0 production apply
  $0 staging destroy

EOF
    exit 1
fi

ENV="${1:?Environment required (staging|production)}"
COMMAND="${2:?Command required (init|plan|apply|destroy|output)}"
shift 2
EXTRA_ARGS=("$@")

# Validate environment
case "$ENV" in
    staging|production)
        ;;
    *)
        echo -e "${RED}Error: Invalid environment '$ENV'${NC}"
        echo "Must be 'staging' or 'production'"
        exit 1
        ;;
esac

# Export environment variable to control Terraform configuration
export LOOPBRIDGE_ENV="$ENV"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}LoopBridge ${ENV^} Deployment${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Environment:      $ENV"
echo "Terraform Dir:    $(pwd)"
echo "Command:          $COMMAND"
echo "Profile:          loopbridge-developer"
echo ""

# Verify AWS credentials
echo -e "${YELLOW}Verifying AWS credentials...${NC}"
if ! aws sts get-caller-identity --profile loopbridge-developer > /dev/null 2>&1; then
    echo -e "${RED}Error: Cannot authenticate with loopbridge-developer profile${NC}"
    exit 1
fi
ACCOUNT_ID=$(aws sts get-caller-identity --profile loopbridge-developer --query Account --output text)
echo -e "${GREEN}✓ Connected to AWS account: $ACCOUNT_ID${NC}"
echo ""

# Ensure terraform.tfvars exists
if [[ ! -f terraform.tfvars ]]; then
    echo -e "${RED}Error: terraform.tfvars not found${NC}"
    echo "Copy terraform.tfvars.example to terraform.tfvars and fill it in"
    exit 1
fi

# Run Terraform commands
case "$COMMAND" in
    init)
        echo -e "${YELLOW}Initializing Terraform...${NC}"
        terraform init -upgrade
        echo -e "${GREEN}✓ Terraform initialized${NC}"
        ;;
    
    plan)
        echo -e "${YELLOW}Planning changes for $ENV environment...${NC}"
        terraform plan -var="deployment_env=$ENV" "${EXTRA_ARGS[@]}" -out=tfplan
        echo -e "${GREEN}✓ Plan saved to tfplan${NC}"
        echo ""
        echo "Review the plan above. To apply:"
        echo "  $0 $ENV apply"
        ;;
    
    apply)
        if [[ ! -f tfplan ]]; then
            echo -e "${YELLOW}No tfplan found. Running plan first...${NC}"
            terraform plan -var="deployment_env=$ENV" "${EXTRA_ARGS[@]}" -out=tfplan
        fi
        
        echo -e "${RED}⚠️  About to apply changes to $ENV environment!${NC}"
        read -p "Type 'yes' to continue: " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            echo "Cancelled"
            exit 1
        fi
        
        echo -e "${YELLOW}Applying changes...${NC}"
        terraform apply tfplan
        echo -e "${GREEN}✓ Applied successfully${NC}"
        echo ""
        echo "New outputs:"
        terraform output
        ;;
    
    destroy)
        echo -e "${RED}⚠️  WARNING: This will destroy all $ENV infrastructure!${NC}"
        read -p "Type 'yes' to confirm destruction: " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            echo "Cancelled"
            exit 1
        fi
        
        echo -e "${YELLOW}Destroying infrastructure...${NC}"
        terraform destroy -var="deployment_env=$ENV" "${EXTRA_ARGS[@]}" -auto-approve
        echo -e "${GREEN}✓ Destroyed${NC}"
        ;;
    
    output)
        echo -e "${YELLOW}Outputs for $ENV:${NC}"
        terraform output -json | jq . 2>/dev/null || terraform output
        ;;
    
    *)
        echo -e "${RED}Error: Unknown command '$COMMAND'${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Done!${NC}"
