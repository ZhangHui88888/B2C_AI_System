# DTC E-commerce - Secrets Setup Script (PowerShell)
# This script helps set up Cloudflare Worker secrets

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("development", "staging", "production")]
    [string]$Environment = "development"
)

Write-Host "DTC E-commerce - Secrets Setup" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host ""

# Define required secrets
$secrets = @(
    @{ Name = "SUPABASE_URL"; Description = "Supabase project URL (e.g., https://xxx.supabase.co)" },
    @{ Name = "SUPABASE_SERVICE_KEY"; Description = "Supabase service role key" },
    @{ Name = "STRIPE_SECRET_KEY"; Description = "Stripe secret key (sk_live_... or sk_test_...)" },
    @{ Name = "STRIPE_WEBHOOK_SECRET"; Description = "Stripe webhook signing secret (whsec_...)" },
    @{ Name = "RESEND_API_KEY"; Description = "Resend email API key (re_...)" },
    @{ Name = "DEEPSEEK_API_KEY"; Description = "DeepSeek AI API key" }
)

# Check if wrangler is installed
$wranglerVersion = wrangler --version 2>$null
if (-not $wranglerVersion) {
    Write-Host "Error: Wrangler CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "npm install -g wrangler" -ForegroundColor Yellow
    exit 1
}

Write-Host "Using Wrangler: $wranglerVersion" -ForegroundColor Green
Write-Host ""

# Build environment flag
$envFlag = ""
if ($Environment -ne "development") {
    $envFlag = "--env $Environment"
}

# Check existing secrets
Write-Host "Checking existing secrets..." -ForegroundColor Cyan
$existingSecrets = @()
try {
    $secretList = Invoke-Expression "wrangler secret list $envFlag 2>&1"
    if ($secretList -match "name") {
        $existingSecrets = ($secretList | Select-String -Pattern '"name":\s*"([^"]+)"' -AllMatches).Matches | ForEach-Object { $_.Groups[1].Value }
    }
} catch {
    Write-Host "Could not fetch existing secrets list" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Required Secrets Status:" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan

foreach ($secret in $secrets) {
    $status = if ($existingSecrets -contains $secret.Name) { "[SET]" } else { "[NOT SET]" }
    $color = if ($existingSecrets -contains $secret.Name) { "Green" } else { "Red" }
    Write-Host "$status $($secret.Name)" -ForegroundColor $color
    Write-Host "       $($secret.Description)" -ForegroundColor Gray
}

Write-Host ""
$proceed = Read-Host "Do you want to set/update secrets now? (y/n)"

if ($proceed -ne "y") {
    Write-Host "Exiting..." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Setting secrets (press Enter to skip)..." -ForegroundColor Cyan
Write-Host ""

foreach ($secret in $secrets) {
    $value = Read-Host "Enter value for $($secret.Name) (or press Enter to skip)"
    
    if ($value) {
        Write-Host "Setting $($secret.Name)..." -ForegroundColor Yellow
        # Use echo to pipe the value to wrangler
        $value | wrangler secret put $secret.Name $envFlag.Split(" ")
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Successfully set $($secret.Name)" -ForegroundColor Green
        } else {
            Write-Host "Failed to set $($secret.Name)" -ForegroundColor Red
        }
    } else {
        Write-Host "Skipping $($secret.Name)" -ForegroundColor Gray
    }
    Write-Host ""
}

Write-Host "Done!" -ForegroundColor Green
Write-Host ""
Write-Host "To verify, run: wrangler secret list $envFlag" -ForegroundColor Cyan
