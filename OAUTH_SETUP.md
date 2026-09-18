# Gmail OAuth Setup Guide

This guide explains how to properly configure Gmail OAuth for the Job Application AI Agent.

## Overview

The application uses Google OAuth 2.0 to securely connect to Gmail without storing passwords. This guide covers setup for both local development and Vercel production deployment.

## Key Security Features

✅ **No Password Storage** - Passwords are never stored or transmitted
✅ **OAuth 2.0** - Industry-standard secure authentication
✅ **Server-Side Tokens** - Access tokens stored securely on server only
✅ **Offline Access** - Can fetch emails even when user isn't actively using app
✅ **Gmail Read-Only** - Only reads emails, never modifies them

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a Project** → **NEW PROJECT**
3. Enter project name: "Job Application AI"
4. Click **CREATE**
5. Wait for project to be created (1-2 minutes)

### 2. Enable Required APIs

1. In Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for and enable these APIs:
   - **Gmail API** - Click, then **ENABLE**
   - **Google+ API** - Click, then **ENABLE**
3. Wait for APIs to be enabled (1-2 minutes)

### 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS**
3. Select **OAuth client ID**
4. If prompted, click **CONFIGURE CONSENT SCREEN** first:
   - Select **External** user type
   - Fill in:
     - App name: "Job Application AI"
     - User support email: your-email@gmail.com
     - Developer contact email: your-email@gmail.com
   - Click **SAVE AND CONTINUE**
   - Add scopes: Click **ADD OR REMOVE SCOPES**
     - Search for and select: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/gmail.readonly`
     - Click **UPDATE**
   - Click **SAVE AND CONTINUE**
   - Click **BACK TO DASHBOARD**

5. Go back to **Credentials** and click **+ CREATE CREDENTIALS** → **OAuth client ID**
6. Application type: Select **Web application**
7. Name: "Job Application AI - Web"
8. Add Authorized redirect URIs:
   - **For Local Development**:
     ```
     http://localhost:3000/api/auth/callback/google
     http://localhost:3001/api/auth/callback/google
     http://localhost:3002/api/auth/callback/google
     ```
   - **For Production (Vercel)**:
     ```
     https://your-app-name.vercel.app/api/auth/callback/google
     ```
     (Replace `your-app-name` with your actual Vercel project name)

9. Click **CREATE**
10. You'll see a popup with credentials. Click **DOWNLOAD JSON** to save them

### 4. Configure Environment Variables

#### Local Development

Create `.env.local` in your project root:

```bash
# Copy from downloaded JSON file
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET

# Generate a secret key
NEXTAUTH_SECRET=<generate-below>
NEXTAUTH_URL=http://localhost:3000

# Other variables
DATABASE_URL="file:./prisma/dev.db"
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

**To generate NEXTAUTH_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Vercel Production

1. Go to your Vercel project settings
2. Go to **Environment Variables**
3. Add these variables:

```
GOOGLE_CLIENT_ID = <value from Google Cloud Console>
GOOGLE_CLIENT_SECRET = <value from Google Cloud Console> (mark as sensitive)
NEXTAUTH_SECRET = <generate with node command above> (mark as sensitive)
NEXTAUTH_URL = https://your-app-name.vercel.app
DATABASE_URL = file:./prisma/dev.db
NEXT_PUBLIC_APP_URL = https://your-app-name.vercel.app
NODE_ENV = production
```

⚠️ **Important**: Do NOT add a trailing slash to NEXTAUTH_URL

### 5. Test Locally

```bash
npm run dev
# Visit http://localhost:3000
```

1. Click "Sign in with Google"
2. You should be redirected to Google login
3. After login, you'll be redirected back to the app
4. Go to **Settings** → **Gmail Integration**
5. Click **Connect Gmail**
6. Approve the permission request
7. You should see "✓ Connected"

### 6. Deploy to Vercel

1. Push your code to GitHub
2. Connect repository to Vercel
3. Add environment variables (see Vercel section above)
4. Deploy
5. Test OAuth flow on production URL

## Troubleshooting

### "Callback URL mismatch" Error

**Problem**: OAuth fails with callback URL error

**Solution**:
1. Check NEXTAUTH_URL matches your domain exactly
2. Check Google Cloud Console has correct redirect URI
3. Make sure you added `/api/auth/callback/google` to the redirect URI
4. Restart dev server or redeploy to Vercel

### "Invalid credentials" Error

**Problem**: Client ID or secret is invalid

**Solution**:
1. Go back to Google Cloud Console
2. Verify credentials weren't regenerated (would invalidate old ones)
3. Download credentials again
4. Update `.env.local` or Vercel environment variables
5. Restart dev server or redeploy to Vercel

### Gmail connection shows "404"

**Problem**: OAuth endpoint not found

**Solution**:
1. Verify `.env.local` has NEXTAUTH_URL without trailing slash
2. Check that NEXTAUTH_SECRET is set
3. Run `npm run prisma:generate` to ensure Prisma is set up
4. Clear browser cache (Ctrl+Shift+Delete)
5. Restart dev server

### "Error: getServerSession is not authorized to access this route"

**Problem**: Auth middleware issue

**Solution**:
1. Verify NEXTAUTH_SECRET is set in environment
2. Restart dev server
3. Clear browser cookies for the domain

## How It Works

1. **User clicks "Connect Gmail"** → Redirects to Google login
2. **Google authentication** → User logs in with their Google account
3. **Permission request** → User approves access to Gmail
4. **Callback to app** → Google redirects back to `/api/auth/callback/google`
5. **Account linking** → OAuth credentials stored securely in database
6. **Email syncing** → App can now fetch emails from Gmail API

## Disconnect & Reconnect

Users can:
1. Go to **Settings** → **Gmail Integration**
2. Click **Disconnect Gmail** to remove the connection
3. Click **Connect Gmail** to connect a different account
4. Their main app account is not affected (they stay logged in)

## Security Notes

- ✅ Gmail refresh tokens are stored securely in database
- ✅ Access tokens are never exposed to frontend
- ✅ All OAuth operations use HTTPS on production
- ✅ NEXTAUTH_SECRET is used to encrypt session data
- ✅ Email credentials are tied to specific user accounts
- ❌ Never share GOOGLE_CLIENT_SECRET or NEXTAUTH_SECRET

## API Scopes

The app requests these Gmail scopes:

| Scope | Purpose | Used For |
|-------|---------|----------|
| `openid` | OpenID Connect | User identification |
| `email` | Email address | Account linking |
| `profile` | Basic profile | User name, picture |
| `gmail.readonly` | Read emails | Sync job-related emails |

**Note**: The app NEVER requests write permissions to Gmail, so it cannot send, delete, or modify emails.

## Additional Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Documentation](https://developers.google.com/gmail/api)

## Support

If you encounter issues:

1. Check this guide first
2. Read TROUBLESHOOTING.md for more solutions
3. Check browser console (F12) for error messages
4. Check server logs for detailed error information
5. Verify all environment variables are set correctly
