#!/bin/bash
# Deployment script for Infinite Realms staging environment

echo "🚀 Building Infinite Realms for staging deployment..."

# Build for web
npx expo export --platform web

# Check if build succeeded
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "📦 Next steps:"
    echo "1. Copy the dist/ folder contents to your SOG-website repo under IR/"
    echo "2. Commit and push to GitHub"
    echo "3. Netlify will auto-deploy to shouldersofgiants.app/IR"
    echo ""
    echo "Or run: npm run deploy:staging"
else
    echo "❌ Build failed!"
    exit 1
fi
