# Deployment Guide

## Production Deployment Issues

The application works locally but not on production because the SPA routing configuration was missing for Vercel deployment.

## Fixed Issues

1. ✅ Added Vercel configuration (`vercel.json`) for SPA routing
2. ✅ Updated Vite config for proper Vercel deployment
3. ✅ Added `.vercelignore` for optimized builds
4. ✅ Added Firebase hosting configuration to `firebase.json` (for Firebase deployment)
5. ✅ Added deployment scripts to `package.json`

## Deployment Steps

### For Vercel Deployment (Current Setup)

1. **Environment Variables in Vercel Dashboard**:
   Go to your Vercel project settings and add these environment variables:
   ```
   VITE_FIREBASE_API_KEY=your_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
   ```

2. **Redeploy**:
   ```bash
   # Push changes to trigger Vercel deployment
   git add .
   git commit -m "Fix Vercel SPA routing configuration"
   git push
   ```

### For Firebase Hosting (Alternative)

1. **Environment Configuration**:
   Create a `.env` file in the root directory with your Firebase project credentials:

2. **Build and Deploy**:
   ```bash
   # Build the application
   npm run build

   # Deploy to Firebase hosting
   npm run deploy

   # Or deploy everything (hosting + functions if any)
   npm run deploy:all
   ```

### 3. Verify Deployment

After deployment, test these URLs:
- `https://lyazami.frigosmart.com/` - Main app
- `https://lyazami.frigosmart.com/reception-debug` - Debug page
- `https://lyazami.frigosmart.com/reception/REC250911421443` - Reception view

## What Was Fixed

1. **Firebase Hosting Configuration**: Added proper hosting config with SPA routing
2. **Build Output**: Set to use `dist` folder (Vite's default build output)
3. **SPA Routing**: All routes now redirect to `index.html` for client-side routing
4. **Deployment Scripts**: Added convenient npm scripts for building and deploying

## Troubleshooting

If the deployment still doesn't work:

1. Check Firebase project configuration
2. Verify environment variables are set correctly
3. Ensure Firebase CLI is installed and authenticated
4. Check Firebase console for any deployment errors
5. Verify the domain is properly configured in Firebase hosting

## Development vs Production

- **Development**: Uses Firebase emulators (localhost:4000)
- **Production**: Uses actual Firebase project (lyazami.frigosmart.com)
