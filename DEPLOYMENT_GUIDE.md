# Deployment Guide - Vercel

## Overview

This guide covers deploying the Job Application AI Agent to Vercel for production use.

## Prerequisites

- GitHub account with the repository
- Vercel account (free tier works)
- Google OAuth credentials (same as development)
- A custom domain (optional)

## Step 1: Prepare Repository

### 1.1 Create .env files for Vercel

You should NOT commit `.env.local` to Git. Instead, add environment variables in Vercel dashboard.

Make sure `.env.local` is in `.gitignore`:

```bash
git status
```

Verify `.env.local` is not listed.

### 1.2 Update vercel.json

The project already has `vercel.json` configured. Verify it looks correct:

```json
{
  "buildCommand": "npm run prisma:generate && npm run build",
  "framework": "nextjs"
}
```

## Step 2: Deploy to Vercel

### 2.1 Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." > "Project"
3. Select "Import Git Repository"
4. Connect your GitHub account
5. Select the `boot_Auto_play` repository

### 2.2 Configure Environment Variables

In the Vercel dashboard project settings:

**Environment Variables Section**, add:

```
NEXTAUTH_SECRET = <generate-random-32-hex-string>
NEXTAUTH_URL = https://yourdomain.vercel.app
GOOGLE_CLIENT_ID = <your-google-client-id>
GOOGLE_CLIENT_SECRET = <your-google-client-secret>
DATABASE_URL = file:./prisma/dev.db
NEXT_PUBLIC_APP_URL = https://yourdomain.vercel.app
```

Add every one of these for the **Production** environment specifically (Vercel scopes
variables per environment — Production / Preview / Development — and a value saved only
under Preview or Development is invisible to the live site). A blank or missing
`NEXTAUTH_SECRET` under Production is the most common cause of a production-only
"Configuration" sign-in error and 500s across the whole site.

**Do NOT add a `NODE_ENV` variable.** Vercel sets it automatically (`production` for
every build and every deployed function; it never runs `next dev` in the cloud). A
project-level `NODE_ENV` added here — especially `development`, copied by mistake from a
local `.env.local` — makes Next.js mix its development and production renderers in the
same process, which crashes **every** route, including ones with no application code on
the stack, such as a plain `/favicon.ico` request. If one exists, remove it and redeploy.

### Generate NEXTAUTH_SECRET

Run locally:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste in Vercel dashboard.

### 2.3 Update Google OAuth Redirect URI

Back in [Google Cloud Console](https://console.cloud.google.com/):

1. Go to APIs & Services > Credentials
2. Edit your OAuth 2.0 credential
3. Add to Authorized redirect URIs:
   ```
   https://yourdomain.vercel.app/api/auth/callback/google
   ```
4. Save

### 2.4 Deploy

In Vercel dashboard:

1. Click "Deploy"
2. Wait for build to complete (2-5 minutes)
3. You should see "Deployment Successful"

## Step 3: Set Up Custom Domain (Optional)

1. Go to Vercel Dashboard > Project > Settings > Domains
2. Add your custom domain
3. Follow Vercel's DNS instructions
4. Update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` environment variables

## Step 4: Production Database

SQLite works for single user, but for production with multiple users or high availability, use PostgreSQL:

### 4.1 Get PostgreSQL Credentials

- Use Railway, Supabase, or AWS RDS
- Get connection string (DATABASE_URL)

### 4.2 Update Prisma

Edit `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"  // Change from "sqlite"
  url      = env("DATABASE_URL")
}
```

### 4.3 Deploy Changes

```bash
git add prisma/schema.prisma
git commit -m "Switch to PostgreSQL for production"
git push
```

Vercel automatically detects the push and rebuilds.

## Step 5: Verify Deployment

1. Visit your deployed URL
2. Sign in with Google
3. Test Gmail connection
4. Try searching for and applying to jobs
5. Verify email sync works

## Monitoring

### View Logs

In Vercel Dashboard:
- Go to Deployments tab
- Click any deployment
- View build and runtime logs

### Error Tracking

Check browser console and Vercel logs for errors:

```bash
vercel logs --follow
```

## Maintenance

### Update Secrets

If you need to update Google OAuth credentials:

1. Go to Vercel > Project Settings > Environment Variables
2. Update `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
3. Redeploy: Go to Deployments > Redeploy

### Update Code

Simply push to main/master branch:

```bash
git push
```

Vercel automatically deploys the changes.

## Troubleshooting

### "OAuth callback failed"

1. Verify `NEXTAUTH_URL` in Vercel env vars
2. Verify redirect URI in Google Cloud Console includes your Vercel domain
3. Restart deployment

### "Database connection failed"

1. Verify `DATABASE_URL` is correct
2. If using PostgreSQL, verify network access is allowed
3. Check database server is running

### "Gmail not connecting"

1. Verify Google OAuth credentials are correct
2. Check that redirect URI is registered
3. Clear browser cookies and try again

### Build Fails

1. Check build logs in Vercel Dashboard
2. Verify `npm run build` works locally
3. Check for missing environment variables

## Performance Optimization

### Edge Functions (Recommended)

Add Next.js middleware to Vercel:

```typescript
// Already configured in src/middleware.ts
```

### Database Caching

For frequently accessed data, add caching:

```typescript
const response = NextResponse.json(data)
response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
return response
```

### Image Optimization

Already configured in `next.config.js` for external images.

## Security Checklist

- [ ] `NEXTAUTH_SECRET` is 32+ character random string
- [ ] `GOOGLE_CLIENT_SECRET` is never logged or exposed
- [ ] `.env.local` is in `.gitignore`
- [ ] Database connection string is marked as sensitive
- [ ] Gmail tokens are only stored server-side
- [ ] HTTPS is enforced (automatic on Vercel)
- [ ] Regular security updates (Dependabot on GitHub)

## Rollback

If deployment fails:

1. Go to Vercel Dashboard > Deployments
2. Find previous successful deployment
3. Click "Promote to Production"

## Support

- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- NextAuth Docs: https://next-auth.js.org/
