# Deployment Guide

## Quick Deploy to Vercel

### Option 1: Vercel CLI (Fastest)

```bash
# Install Vercel globally
npm install -g vercel

# Navigate to project
cd exercise-form-advisor

# Install dependencies
npm install

# Deploy
vercel

# Follow prompts:
# - Set up and deploy: Y
# - Link to existing project: N
# - Project name: exercise-form-advisor
# - Directory: ./
# - Build command: npm run build
# - Output directory: build
```

### Option 2: GitHub + Vercel Dashboard

1. Push code to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Configure:
   - Framework Preset: Create React App
   - Build Command: `npm run build`
   - Output Directory: `build`
6. Click "Deploy"

### Option 3: Deploy from Local

1. Go to [vercel.com](https://vercel.com)
2. Download Vercel Desktop app
3. Drag and drop the `exercise-form-advisor` folder
4. Vercel will auto-detect settings and deploy

## Environment Configuration

No environment variables needed for the base app! MediaPipe runs entirely client-side.

### Optional: Analytics

Add to Vercel dashboard settings:
- Vercel Analytics
- Web Vitals monitoring

## Custom Domain (Optional)

1. In Vercel dashboard, go to Project Settings > Domains
2. Add your custom domain
3. Update DNS records as instructed

## Post-Deployment

### Test the following:

- [ ] Camera access on mobile (requires HTTPS ✓)
- [ ] Video upload functionality
- [ ] Video analysis completes
- [ ] Results page displays correctly
- [ ] History persists after refresh
- [ ] All exercise types work

### Performance Optimization

Vercel automatically provides:
- CDN distribution
- Automatic HTTPS
- HTTP/2
- Brotli compression
- Edge caching

## Monitoring

Check Vercel dashboard for:
- Deployment logs
- Runtime logs
- Analytics
- Error tracking

## Troubleshooting

### Build fails
- Check Node version (16+ required)
- Verify package.json dependencies
- Check build logs in Vercel dashboard

### Camera doesn't work on deployed site
- Vercel provides HTTPS automatically (required for camera)
- Check browser permissions
- Test on different devices

### MediaPipe scripts not loading
- CDN scripts are loaded in public/index.html
- Check browser console for CORS errors
- Verify CDN availability

## Updating the App

```bash
# Make changes
git add .
git commit -m "Update description"
git push

# Vercel auto-deploys on push to main branch
```

Or with Vercel CLI:
```bash
vercel --prod
```

## Future: Add Supabase

1. Create Supabase project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key
3. Add to Vercel environment variables:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_KEY`
4. Update `src/services/storage.js` to use Supabase client
5. Redeploy

## Costs

- Vercel Free Tier: Perfect for this app
  - 100GB bandwidth/month
  - Unlimited deployments
  - HTTPS included
  - Custom domain support

- Supabase Free Tier (when added):
  - 500MB database
  - 1GB file storage
  - 50,000 monthly active users
