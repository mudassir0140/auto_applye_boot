# Google OAuth Callback Error - Fix Summary

## Problem
Users encountered a Google OAuth callback error when signing in:
```
?callbackUrl=http%3A%2F%2Flocalhost%3A3000&error=Callback
```

Browser console also showed:
```
Unchecked runtime.lastError: Could not establish connection. Receiving end does not exist.
Uncaught (in promise) Error: Could not establish connection. Receiving end does not exist.
```

## Root Cause
The SQLite database was never initialized. Prisma migrations had not been run, so the following tables did not exist:
- `User` - OAuth user records
- `Account` - Google OAuth account linking
- `Session` - User sessions
- `VerificationToken` - Email verification tokens

When Google OAuth callback triggered PrismaAdapter to save the Google account record, it failed with a database table not found error, which NextAuth interpreted as a `Callback` error.

## Solution

### 1. Database Initialization
Run Prisma migrations to create all required tables:
```bash
npm run prisma:migrate
# or manually:
npx prisma migrate deploy
```

### 2. Improved Auth Configuration
Enhanced `src/lib/auth.ts` with:
- Better redirect callback that handles both absolute and relative URLs
- Console logging for debugging OAuth flow
- Proper error handling in callbacks

### 3. Session Refresh After OAuth
Updated dashboard pages to refresh session after Google OAuth callback:
- `src/app/dashboard/settings/page.tsx`
- `src/app/dashboard/layout.tsx`
- `src/app/dashboard/page.tsx`
- Other dashboard pages

This ensures Gmail connection status is immediately reflected after login.

## How to Test

### Prerequisites
1. Valid Google OAuth credentials in `.env.local`:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```
2. Google Cloud Console configured with:
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`

### Test Steps

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Test initial sign-in:**
   - Navigate to `http://localhost:3000`
   - Click "Sign in with Google"
   - Approve the Google consent screen
   - **Expected:** Redirected to `/dashboard` with session established

3. **Verify Gmail connection status:**
   - Go to Settings page (`/dashboard/settings`)
   - Should show "✓ Connected" under Gmail Integration
   - Email address should be displayed

4. **Test session persistence:**
   - Refresh the page (F5)
   - Gmail status should still show "✓ Connected"
   - Session should remain active

5. **Connect Gmail from Settings:**
   - From Settings page, click "Disconnect Gmail" (if already connected)
   - Refresh page - should show "✗ Not connected"
   - Click "Connect Gmail"
   - Approve Google consent screen
   - **Expected:** Redirected back to Settings with "✓ Connected" status
   - Refresh page - should still show "✓ Connected"

6. **Test logout and re-login:**
   - Click "Sign Out" from sidebar
   - Should return to home page
   - Click "Sign in with Google" again
   - Gmail should already be connected from previous session

## Database Tables Created

The following tables are now properly initialized:

- **User** - Stores user profile information
- **Account** - Stores OAuth provider accounts with access tokens
- **Session** - Stores user sessions for authentication
- **VerificationToken** - For email verification workflows
- **Job** - Job listings found by the agent
- **JobApplication** - Application tracking
- **ApplicationHistory** - Historical record of applications
- **JobEmail** - Email notifications related to applications
- **Notification** - In-app notifications

## Key Configuration Values

From `src/lib/auth.ts`:
- **Session Strategy:** `database` (uses PrismaAdapter)
- **Provider:** `GoogleProvider` with Gmail scopes:
  - `gmail.readonly` - Read emails
  - `gmail.send` - Send emails
- **Access Type:** `offline` - Enables refresh tokens
- **Callback URL:** `http://localhost:3000/api/auth/callback/google`

## Verification Commands

```bash
# Check Prisma schema is in sync with database
npx prisma db push

# Verify migrations are applied
npx prisma migrate status

# Test database connection
npx prisma studio  # Opens visual database explorer
```

## Logging

The auth flow now includes detailed console logging:
- ✅ `Sign in callback` - User authentication
- 🔑 `JWT callback` - Token handling
- 📋 `Session callback` - Session creation
- 🔄 `Redirect callback` - Post-auth redirection
- ↪️ `Redirecting to` - Final redirect destination

Watch the server logs (npm run dev) to see these messages during OAuth flow.

## Common Issues

### "Database does not exist"
- Ensure `.env.local` has correct `DATABASE_URL`
- Run migrations: `npx prisma migrate deploy`
- Check that `prisma/schema.prisma` exists

### "Account table missing"
- Migrations not applied
- Run: `npx prisma migrate deploy`
- Verify with: `npx prisma db push`

### "Invalid_client error from Google"
- Check Google Client ID/Secret in `.env.local`
- Verify they match Google Cloud Console
- Check callback URL matches exactly

### "Session not persisting"
- Ensure database is accessible
- Check `NEXTAUTH_SECRET` is set (32+ characters)
- Verify PrismaAdapter is properly initialized

## Commits

Two commits implement this fix:

1. **e2ff4c9** - Fix: Resolve Google OAuth callback error by ensuring database is initialized
   - Initialize database
   - Improve auth callbacks
   - Add debugging logs

2. **bcaed2b** - Improve: Add session refresh after OAuth callback for reliable Gmail status
   - Dashboard session refresh
   - Better OAuth flow handling
   - Session persistence verification

## Next Steps

1. Pull the latest changes from GitHub
2. Run `npm install` (if needed)
3. Run `npm run dev` to start the dev server
4. Test the OAuth flow following the steps above
5. Report any remaining issues with full console logs

