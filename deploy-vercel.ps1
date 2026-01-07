# Vercel Deployment Script
Write-Host "Starting Vercel deployment..." -ForegroundColor Green

# Try to run vercel command
try {
    # Check if vercel is available
    $vercelCmd = Get-Command vercel -ErrorAction SilentlyContinue
    if ($vercelCmd) {
        Write-Host "Using global vercel command..." -ForegroundColor Yellow
        & vercel --prod
    } else {
        Write-Host "Using npx vercel..." -ForegroundColor Yellow
        & npx --yes vercel --prod
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "Trying alternative method..." -ForegroundColor Yellow
    & npx vercel --prod
}

Write-Host "Deployment command executed." -ForegroundColor Green



