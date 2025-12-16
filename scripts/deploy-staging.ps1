# Deployment script for Infinite Realms to shouldersofgiants.app/IR

Write-Host "Building Infinite Realms for staging deployment..." -ForegroundColor Cyan
Write-Host ""

# Build for web
Write-Host "Building web app..." -ForegroundColor Yellow
npx expo export --platform web

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Build successful!" -ForegroundColor Green
Write-Host ""

# Define paths
$distPath = "dist"
$sogPath = "C:\Users\sunfi\OneDrive\Desktop\SOG\SOG-website"
$irPath = Join-Path $sogPath "IR"

# Create IR directory if it doesn't exist
if (-not (Test-Path $irPath)) {
    Write-Host "Creating IR directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $irPath -Force | Out-Null
}

# Copy files
Write-Host "Copying files to SOG-website..." -ForegroundColor Yellow
Copy-Item -Path "$distPath\*" -Destination $irPath -Recurse -Force

Write-Host "Files copied!" -ForegroundColor Green
Write-Host ""

# Git operations
Write-Host "Committing and pushing to GitHub..." -ForegroundColor Yellow
Set-Location $sogPath

git add IR/
git commit -m "Update Infinite Realms staging deployment"
git push

Write-Host "Deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Your app will be live at: https://shouldersofgiants.app/IR" -ForegroundColor Cyan
Write-Host "Netlify deployment usually takes 1-2 minutes" -ForegroundColor Gray
