#!/bin/bash
# DTC E-commerce - Secrets Setup Script (Bash)
# This script helps set up Cloudflare Worker secrets

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Default environment
ENVIRONMENT="${1:-development}"

echo -e "${CYAN}DTC E-commerce - Secrets Setup${NC}"
echo -e "${YELLOW}Environment: $ENVIRONMENT${NC}"
echo ""

# Define required secrets
declare -A SECRETS=(
    ["SUPABASE_URL"]="Supabase project URL (e.g., https://xxx.supabase.co)"
    ["SUPABASE_SERVICE_KEY"]="Supabase service role key"
    ["STRIPE_SECRET_KEY"]="Stripe secret key (sk_live_... or sk_test_...)"
    ["STRIPE_WEBHOOK_SECRET"]="Stripe webhook signing secret (whsec_...)"
    ["RESEND_API_KEY"]="Resend email API key (re_...)"
    ["DEEPSEEK_API_KEY"]="DeepSeek AI API key"
)

SECRET_ORDER=("SUPABASE_URL" "SUPABASE_SERVICE_KEY" "STRIPE_SECRET_KEY" "STRIPE_WEBHOOK_SECRET" "RESEND_API_KEY" "DEEPSEEK_API_KEY")

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}Error: Wrangler CLI not found. Please install it first:${NC}"
    echo -e "${YELLOW}npm install -g wrangler${NC}"
    exit 1
fi

WRANGLER_VERSION=$(wrangler --version)
echo -e "${GREEN}Using Wrangler: $WRANGLER_VERSION${NC}"
echo ""

# Build environment flag
ENV_FLAG=""
if [ "$ENVIRONMENT" != "development" ]; then
    ENV_FLAG="--env $ENVIRONMENT"
fi

# Check existing secrets
echo -e "${CYAN}Checking existing secrets...${NC}"
EXISTING_SECRETS=$(wrangler secret list $ENV_FLAG 2>/dev/null | grep -o '"name": "[^"]*"' | cut -d'"' -f4 || echo "")

echo ""
echo -e "${CYAN}Required Secrets Status:${NC}"
echo -e "${CYAN}========================${NC}"

for secret_name in "${SECRET_ORDER[@]}"; do
    description="${SECRETS[$secret_name]}"
    if echo "$EXISTING_SECRETS" | grep -q "^${secret_name}$"; then
        echo -e "${GREEN}[SET]${NC} $secret_name"
    else
        echo -e "${RED}[NOT SET]${NC} $secret_name"
    fi
    echo -e "${GRAY}       $description${NC}"
done

echo ""
read -p "Do you want to set/update secrets now? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Exiting...${NC}"
    exit 0
fi

echo ""
echo -e "${CYAN}Setting secrets (press Enter to skip)...${NC}"
echo ""

for secret_name in "${SECRET_ORDER[@]}"; do
    read -p "Enter value for $secret_name (or press Enter to skip): " -s value
    echo ""
    
    if [ -n "$value" ]; then
        echo -e "${YELLOW}Setting $secret_name...${NC}"
        echo "$value" | wrangler secret put "$secret_name" $ENV_FLAG
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}Successfully set $secret_name${NC}"
        else
            echo -e "${RED}Failed to set $secret_name${NC}"
        fi
    else
        echo -e "${GRAY}Skipping $secret_name${NC}"
    fi
    echo ""
done

echo -e "${GREEN}Done!${NC}"
echo ""
echo -e "${CYAN}To verify, run: wrangler secret list $ENV_FLAG${NC}"
