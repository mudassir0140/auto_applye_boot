# Google OAuth Setup Guide

This guide explains how to configure Google OAuth 2.0 for the Job Application AI Agent in both local development and production (Vercel).

## Overview

The application uses Google OAuth 2.0 to:
1. Authenticate users (sign in)
2. Access Gmail API to read job-related emails
3. Securely manage credentials without storing passwords

## Prerequisites

- Google Account
- Access to Google Cloud Console (https://console.cloud.google.com)
- Ability to create and manage OAuth applications

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the project dropdown at the top
3. Click "NEW PROJECT"
4. Name it: "Job Application AI Agent" (or any name you prefer)
5. Click "CREATE"
6. Wait for the project to be created (2-3 minutes)

## Step 2: Enable Required APIs

1. Go to [Google Cloud Console APIs & Services](https://console.cloud.google.com/apis/dashboard)
2. Click "+ ENABLE APIS AND SERVICES"
3. Search for and enable these APIs:
   - **Gmail API** - for reading job emails
   - **Google+ API** - for user authentication (sometimes pre-enabled)
   - **Google Identity Service** - for OAuth support

### To enable each API:
1. Search for the API name
2. Click on the result
3. Click "ENABLE"
4. Repeat for all three APIs

## Step 3: Create OAuth 2.0 Credentials

### For Local Development:

1. Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "+ CREATE CREDENTIALS" → "OAuth client ID"
3. If prompted to configure OAuth consent screen first:
   - Choose "External" for User Type
   - Click "CREATE"
   - Fill in the form:
     - App name: "Job Application AI Agent"
     - User support email: your@email.com
     - Click "SAVE AND CONTINUE" through all screens
   - After consent screen is created, return to create credentials

4. For Application type, select "Web application"
5. Name it: "Local Development"
6. Under "Authorized JavaScript origins" add:
   - `http://localhost:3000`
   - `http://localhost:3001` (if using different port)

7. Under "Authorized redirect URIs" add:
   - `http://localhost:3000/api/auth/callback/google`

8. Click "CREATE"
9. A popup appears with your credentials. **SAVE THESE**:
   - Copy the Client ID
   - Copy the Client Secret

### For Production (Vercel):

1. After creating local credentials, go back to Credentials page
2. Click "+ CREATE CREDENTIALS" → "OAuth client ID" again
3. Select "Web application"
4. Name it: "Production - Vercel"
5. Under "Authorized JavaScript origins" add:
   - `https://yourusername.vercel.app`
   - `https://yourdomain.com` (if you have a custom domain)

6. Under "Authorized redirect URIs" add:
   - `https://yourusername.vercel.app/api/auth/callback/google`
   - `https://yourdomain.com/api/auth/callback/google` (if applicable)

7. Click "CREATE"
8. Save the Client ID and Client Secret for production

## Step 4: Add Test Users

1. Go to [OAuth consent screen settings](https://console.cloud.google.com/apis/credentials/consent)
2. Scroll down to "Test users"
3. Click "ADD USERS"
4. Enter your email addresses (fmkports@gmail.com)
5. Click "ADD"
6. These test users can use the app while it's in "Testing" mode

## Step 5: Configure Local Environment Variables

1. Edit `.env.local` in the project root:

```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# NextAuth Configuration
NEXTAUTH_SECRET=3cfb87ea0592f33c5f07de53c67f45cf89bce8456cc86dcab40d80c46f5a3bc5
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (Local Development)
# Get from Google Cloud Console → Credentials → OAuth 2.0 Client IDs → Web application (Local)
GOOGLE_CLIENT_ID=your-local-client-id-here
GOOGLE_CLIENT_SECRET=your-local-client-secret-here

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Node Environment
NODE_ENV=development
```

Replace:
- `your-local-client-id-here` with the Client ID from Step 3
- `your-local-client-secret-here` with the Client Secret from Step 3

## Step 6: Test Locally

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000 in your browser

3. Click "Sign in with Google"

4. You should be redirected to Google's login
   - If you get an "Access blocked" error, check:
     - Client ID and Secret are correct
     - Redirect URI matches exactly: `http://localhost:3000/api/auth/callback/google`
     - Your email is in the test users list
     - Gmail API is enabled

5. Grant the permissions when prompted

6. You should be redirected back to the dashboard

## Step 7: Configure Production (Vercel)

### On Vercel Dashboard:

1. Go to your Vercel project settings
2. Go to "Environment Variables"
3. Add these variables:

```
NEXTAUTH_SECRET
Value: Generate a new secure secret with: openssl rand -hex 32
Or keep the value from .env.local

NEXTAUTH_URL
Value: https://yourusername.vercel.app (or your custom domain)

GOOGLE_CLIENT_ID
Value: Production Client ID from Step 3

GOOGLE_CLIENT_SECRET
Value: Production Client Secret from Step 3

DATABASE_URL
Value: Your production database URL (if using PostgreSQL instead of SQLite)
```

### Important for Vercel:

- Use the **Production** credentials (not local ones) in Vercel env vars
- Make sure the `NEXTAUTH_URL` matches your Vercel domain exactly
- Vercel auto-generates VERCEL_URL, but we need NEXTAUTH_URL explicitly set

## Troubleshooting

### "Access blocked: Authorisation error"

**Cause:** Usually one of these:
- Client ID/Secret are incorrect or swapped
- Redirect URI doesn't match exactly (case-sensitive)
- Gmail API not enabled
- Email not added as test user
- OAuth consent screen not configured

**Fix:**
1. Verify Client ID/Secret in Google Cloud Console
2. Check redirect URIs match exactly (including protocol http/https)
3. Enable Gmail API if not already
4. Add your email as a test user
5. Complete OAuth consent screen configuration
6. Try a different browser or clear cookies

### "The redirect URI in the request did not match"

**Cause:** Redirect URI in app doesn't match Google Cloud Console config

**Fix:**
1. Open Google Cloud Console
2. Go to Credentials → OAuth 2.0 Client IDs → Your Web application
3. Check "Authorized redirect URIs" section
4. Make sure it includes exactly: `http://localhost:3000/api/auth/callback/google` (for local)
5. Ensure no trailing slashes or extra parameters

### OAuth consent screen shows "This app isn't verified"

**This is normal for development.** You'll see this because the app is in "Testing" mode.

To use in production without this warning:
1. Go to OAuth consent screen settings
2. Change from "External" to "Internal" (Google Workspace only)
3. Or submit app for verification (requires more setup)

### Email not accepting permissions after signing in

**Cause:** Browser cookies or cached authentication

**Fix:**
1. Clear browser cookies for localhost:3000
2. Try signing out and in again
3. Try a different browser
4. Try incognito/private mode

## Files Modified

- `.env.local` - Contains local OAuth credentials (never commit this)
- `src/lib/auth.ts` - NextAuth configuration with Google provider
- `vercel.json` - Defines environment variables needed for Vercel
- `src/app/page.tsx` - Login page
- `src/app/auth/error/page.tsx` - Error page with detailed error messages

## Security Notes

⚠️ **Important Security Practices:**

1. **Never commit `.env.local`** - It contains secrets
2. **GOOGLE_CLIENT_SECRET** should only be in secure places:
   - `.env.local` (local only, never commit)
   - Vercel environment variables (sensitive setting)
3. **Session storage** - Uses database strategy, not cookies
4. **Email reading** - Gmail API access token is stored safely:
   - Not stored as plaintext
   - Managed by NextAuth Prisma adapter
   - Can be revoked anytime by user
5. **Gmail permissions** - Only requests `gmail.readonly` scope
6. **No password storage** - Uses OAuth, no passwords stored

## Helpful Links

- [Google Cloud Console](https://console.cloud.google.com)
- [OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [NextAuth.js Google Provider](https://next-auth.js.org/providers/google)

## Support

If you encounter issues:
1. Check the error page at `/auth/error` for error type
2. Review logs with `npm run dev` in terminal
3. Verify all steps above completed
4. Check that Gmail API is enabled
5. Verify test user email matches your Google account email
