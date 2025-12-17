---
description: Deploy Ghost Armstrong to Firebase (functions + hosting)
---

# Deploy to Firebase

This workflow deploys both Cloud Functions and the web frontend to Firebase.

## Steps

// turbo-all
1. Build the Cloud Functions:
```
cd functions && npm run build
```

2. Export the web app for static hosting:
```
npx expo export --platform web
```

3. Deploy everything to Firebase:
```
firebase deploy
```

## Notes
- The site is hosted at: https://infinite-realms-5dcba.web.app
- Firebase project: `infinite-realms-5dcba`
- If authentication fails, run: `firebase login --reauth`
