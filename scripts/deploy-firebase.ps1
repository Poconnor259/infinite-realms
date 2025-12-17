# Deployment script for Infinite Realms to Firebase Hosting

Write-Host "Building and deploying Infinite Realms to Firebase Hosting..." -ForegroundColor Cyan
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

# Deploy to Firebase Hosting
Write-Host "Deploying to Firebase Hosting..." -ForegroundColor Yellow
firebase deploy --only "hosting,functions"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Firebase deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Your app is live on Firebase Hosting!" -ForegroundColor Cyan
Write-Host "Check Firebase Console for the hosting URL" -ForegroundColor Gray
