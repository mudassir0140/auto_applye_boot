# OAuth Testing Guide

## Overview

This guide walks through testing the Gmail OAuth 2.0 connection flow for the Job Application AI Agent.

## Prerequisites

- Google Cloud Console project with OAuth credentials
- GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from Google Cloud Console
- NEXTAUTH_SECRET generated
- .env.local file configured (see OAUTH_SETUP.md)

## Complete Flow Test

### Step 1: Local Development Setup

1. Ensure .env.local is configured with:
   ```
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-generated-secret
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   DATABASE_URL=file:./prisma/dev.db
   ```

2. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```

3. Start dev server:
   ```bash
   npm run dev
   ```

### Step 2: Test Settings Page

1. Open http://localhost:3000 in browser
2. Click "Sign In" button
3. Sign in with Google (your personal Google account)
4. Navigate to Settings page (/dashboard/settings)
5. See "Gmail Integration" section

### Step 3: Test Gmail Connection

#### Test Case 1: Connect Gmail

1. On Settings page, click "Connect Gmail" button
2. You should be redirected to Google OAuth consent screen
3. Verify the app name and requested permissions
4. Requested scopes should include:
   - Email
   - Profile
   - Gmail read-only access
5. Click "Allow" to grant permissions
6. You should be redirected back to Settings page
7. Verify the status now shows "✓ Connected"

#### Test Case 2: Verify Connection

After connecting:
1. Refresh the Settings page
2. Status should still show "✓ Connected"
3. Button should now show "Disconnect Gmail"
4. Blue info box should appear explaining OAuth is secure

#### Test Case 3: Sync Emails

1. In a new terminal, run the email sync:
   ```bash
   curl -X POST http://localhost:3000/api/gmail/sync \
     -H "Content-Type: application/json"
   ```
   (This requires a valid session cookie)

2. Check that emails are fetched and classified

#### Test Case 4: Disconnect Gmail

1. On Settings page, click "Disconnect Gmail" button
2. Confirm the dialog
3. Status should now show "✗ Not connected"
4. Button should now show "Connect Gmail" again
5. User should still be logged into the app

### Step 4: Test Reconnect with Different Account

1. Click "Connect Gmail" again
2. This time, log in with a DIFFERENT Google account (if you have multiple accounts)
3. Grant permissions again
4. Verify the new account is connected
5. The previous account's connection is completely removed

## Production Testing (Vercel)

### Pre-Deployment Checklist

- [ ] NEXTAUTH_URL set to Vercel deployment URL
- [ ] GOOGLE_CLIENT_ID configured
- [ ] GOOGLE_CLIENT_SECRET configured
- [ ] NEXTAUTH_SECRET set (same or new)
- [ ] DATABASE_URL set to production database
- [ ] Build passes: `npm run build`
- [ ] No TypeScript errors: `npx tsc --noEmit`

### Post-Deployment Testing

1. Deploy to Vercel:
   ```bash
   git push origin main  # Or connect Vercel to GitHub
   ```

2. Wait for deployment to complete

3. Open your Vercel URL in browser

4. Repeat the complete flow test steps 1-4 above

5. Verify OAuth callback URL matches exactly:
   - Expected: `https://your-domain.vercel.app/api/auth/callback/google`

## Troubleshooting

### "Callback URL mismatch" Error

**Cause:** The OAuth redirect URL in Google Cloud Console doesn't match the app's actual URL

**Solutions:**
1. Check NEXTAUTH_URL environment variable
2. Verify Google Cloud Console has exact redirect URIs:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.vercel.app/api/auth/callback/google`
3. Ensure no trailing slashes
4. Check http vs https matches

### "Invalid Client" Error

**Cause:** Wrong or expired OAuth credentials

**Solutions:**
1. Regenerate credentials in Google Cloud Console
2. Update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
3. Redeploy application

### Settings Page Shows "Not connected" After Refresh

**Cause:** Database not persisting the connection

**Solutions:**
1. Check DATABASE_URL is correct
2. Verify database file/service is accessible
3. Check browser console for errors
4. Check server logs for database errors

### Email Sync Fails

**Cause:** Gmail API not enabled or permission issues

**Solutions:**
1. Enable Gmail API in Google Cloud Console
2. Disconnect and reconnect Gmail
3. Verify scopes in OAuth consent screen include `gmail.readonly`
4. Check access token hasn't expired

## Testing Checklist

### OAuth Connection Flow
- [ ] User can click "Connect Gmail"
- [ ] Redirected to Google OAuth consent screen
- [ ] Scopes displayed correctly
- [ ] Can grant permissions
- [ ] Redirected back to Settings page
- [ ] Status shows "✓ Connected"
- [ ] Settings page persists after refresh

### Disconnect/Reconnect Flow
- [ ] Can disconnect Gmail
- [ ] Status shows "✗ Not connected"
- [ ] User remains logged in to app
- [ ] Can reconnect with same account
- [ ] Can reconnect with different account
- [ ] Disconnect confirmation works

### Email Functionality
- [ ] Can sync job-related emails
- [ ] Emails are correctly classified
- [ ] Job applications are updated with email status
- [ ] Notifications are created for important emails

### Security
- [ ] No passwords stored anywhere
- [ ] Access tokens stored securely in database
- [ ] NEXTAUTH_SECRET is used for session encryption
- [ ] Refresh tokens are stored for offline access
- [ ] OAuth scope is limited to gmail.readonly

### Edge Cases
- [ ] User can connect, disconnect, reconnect multiple times
- [ ] App works on different OAuth accounts
- [ ] Handles OAuth timeout gracefully
- [ ] Handles network errors gracefully
- [ ] Works after app restart

## Performance Metrics

Monitor these metrics while testing:
- OAuth redirect time: < 5 seconds
- Settings page load time: < 2 seconds
- Email sync time: < 30 seconds for 20 emails
- Database operations: < 100ms

## Success Criteria

✅ All test cases pass
✅ No console errors or warnings
✅ Settings page responsive
✅ OAuth flow completes without errors
✅ Emails synced and displayed correctly
✅ Production build succeeds
✅ No security vulnerabilities
