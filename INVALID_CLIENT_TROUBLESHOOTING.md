# Fixing "401: invalid_client" Error in Google OAuth

This guide specifically addresses the "The OAuth client was not found" error that occurs during Gmail connection.

## Root Cause

The "401: invalid_client" error means one of these:
1. ❌ `.env.local` has placeholder values instead of real Google credentials
2. ❌ GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing/empty
3. ❌ Client ID/Secret are invalid or don't match Google Cloud Console
4. ❌ The credentials were deleted from Google Cloud Console
5. ❌ Wrong credentials are being used (production credentials in local or vice versa)

## How the OAuth Flow Works in This App

```
User clicks "Connect Gmail"
    ↓
signIn('google') is called
    ↓
App redirects to Google OAuth consent screen
    ↓
Google checks: Is GOOGLE_CLIENT_ID valid?
    ↓
If invalid → "401: invalid_client" error
    ↓
If valid → Show scopes to user (email, profile, gmail.readonly)
    ↓
User grants permissions
    ↓
Google redirects to: /api/auth/callback/google
    ↓
App verifies credentials with GOOGLE_CLIENT_SECRET
    ↓
Account linked to user profile
    ↓
✓ Gmail Connected!
```

## Step-by-Step Fix

### Step 1: Verify Current Status

1. Check what's in `.env.local`:
   ```bash
   cat .env.local | grep GOOGLE_
   ```

2. You'll see either:
   - **Problem:** `GOOGLE_CLIENT_ID=your-google-client-id-here` (placeholder)
   - **OK:** `GOOGLE_CLIENT_ID=1234567890.apps.googleusercontent.com` (real value)

### Step 2: Get Real Credentials from Google Cloud Console

#### If you haven't created credentials yet:

1. **Go to Google Cloud Console:**
   - https://console.cloud.google.com/

2. **Create a new project:**
   - Click project dropdown at top
   - Click "NEW PROJECT"
   - Name: "Job Application AI Agent"
   - Click "CREATE"
   - Wait 2-3 minutes for creation

3. **Enable Gmail API:**
   - Go to APIs & Services: https://console.cloud.google.com/apis/dashboard
   - Click "+ ENABLE APIS AND SERVICES"
   - Search for "Gmail API"
   - Click on "Gmail API"
   - Click "ENABLE"
   - Wait for it to finish

4. **Create OAuth 2.0 Credentials:**
   - Go to Credentials: https://console.cloud.google.com/apis/credentials
   - Click "+ CREATE CREDENTIALS"
   - Select "OAuth client ID"
   - If prompted about OAuth consent screen:
     - Select "External"
     - Click "CREATE"
     - Fill in:
       - App name: "Job Application AI Agent"
       - User support email: your-email@gmail.com
       - Click "SAVE AND CONTINUE" three times
     - Back to create OAuth client ID
   
   - Application type: "Web application"
   - Name: "Local Development"
   - Under "Authorized JavaScript origins":
     - Click "+ ADD URI"
     - Enter: `http://localhost:3000`
     - Click "ADD"
   
   - Under "Authorized redirect URIs":
     - Click "+ ADD URI"
     - Enter: `http://localhost:3000/api/auth/callback/google`
     - Click "ADD"
   
   - Click "CREATE"

5. **Copy Your Credentials:**
   - A popup appears with your credentials
   - **CLIENT ID:** Starts with numbers, ends with `.apps.googleusercontent.com`
     Example: `1234567890-abcdefghijklmnop.apps.googleusercontent.com`
   - **CLIENT SECRET:** A string of random characters
     Example: `GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ`

#### If you already created credentials:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find "OAuth 2.0 Client IDs" section
3. Click "Local Development" (or your web application)
4. You'll see your CLIENT ID and can view the SECRET

### Step 3: Update `.env.local`

1. **Open `.env.local` in your editor**

2. **Find these lines:**
   ```env
   GOOGLE_CLIENT_ID=your-google-client-id-here
   GOOGLE_CLIENT_SECRET=your-google-client-secret-here
   ```

3. **Replace with your real values:**
   ```env
   GOOGLE_CLIENT_ID=1234567890-abcdefghijklmnop.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
   ```

4. **Important:**
   - Copy the exact values from Google Cloud Console
   - No extra spaces or quotes
   - Keep NEXTAUTH_URL=http://localhost:3000 (don't change it)

### Step 4: Verify Redirect URI Configuration

This is the most common mistake!

1. Go to Google Cloud Console credentials
2. Click your "Local Development" OAuth 2.0 client
3. Check "Authorized redirect URIs" section
4. You should see EXACTLY:
   ```
   http://localhost:3000/api/auth/callback/google
   ```

5. If it's missing or different:
   - Click "EDIT"
   - Remove wrong URIs
   - Add: `http://localhost:3000/api/auth/callback/google`
   - Click "SAVE"

### Step 5: Add Test User

1. Go to OAuth consent screen: https://console.cloud.google.com/apis/credentials/consent
2. Scroll down to "Test users"
3. Click "+ ADD USERS"
4. Enter your Gmail address (the one you'll use to test)
5. Click "ADD"

### Step 6: Test the Fix

1. **Stop dev server** (Ctrl+C)

2. **Start dev server:**
   ```bash
   npm run dev
   ```

3. **Open http://localhost:3000**

4. **Click "Sign in with Google"** at the bottom

5. You should be redirected to Google login (not an error)

6. Sign in with your test Gmail account

7. Grant permissions when prompted

8. You should see the permission request showing:
   - "See your email address"
   - "See your name"
   - "See your profile picture"
   - "View your Gmail inbox and send emails"

9. Click "Continue" to grant permissions

10. You should be redirected back to the dashboard ✓

## Testing Gmail Connection from Settings

After signing in, test the Gmail connection:

1. Go to `/dashboard/settings`
2. Scroll to "Gmail Integration" section
3. Click "Connect Gmail"
4. This should show the same Google permission screen
5. After granting, status should show "✓ Connected"

## Verifying Credentials Are Correct

The app will show different errors for different problems:

| Error | Meaning | Fix |
|-------|---------|-----|
| 401: invalid_client | Client ID/Secret wrong | Check Google Cloud Console values |
| invalid_request | Redirect URI not configured | Add `http://localhost:3000/api/auth/callback/google` in console |
| access_denied | User denied permissions | Click "Continue" to grant permissions |
| redirect_uri_mismatch | Redirect URI doesn't match exactly | Must match EXACTLY: `http://localhost:3000/api/auth/callback/google` |
| consent_required | Test user not added | Add your email in OAuth consent screen |

## Common Mistakes

### ❌ Mistake 1: Redirect URI has trailing slash
```
WRONG: http://localhost:3000/api/auth/callback/google/
RIGHT: http://localhost:3000/api/auth/callback/google
```

### ❌ Mistake 2: Using port 3001 but configured for 3000
```
If running on http://localhost:3001:
Add to Google Cloud: http://localhost:3001/api/auth/callback/google
```

### ❌ Mistake 3: OAuth consent screen not configured
- If you see "This app isn't verified" - that's normal for test mode
- Just make sure your email is in the test users list

### ❌ Mistake 4: Gmail API not enabled
- Go to APIs & Services → APIs & Libraries
- Search "Gmail API"
- Make sure it shows "ENABLED"

### ❌ Mistake 5: Mixing up Client ID and Client Secret
- Client ID: Long number ending in `.apps.googleusercontent.com`
- Client Secret: Random string starting with `GOCSPX-`
- **Never** put Client Secret in frontend code

## Debug Checklist

Before contacting support, verify all of these:

- [ ] `.env.local` has real GOOGLE_CLIENT_ID (not placeholder)
- [ ] `.env.local` has real GOOGLE_CLIENT_SECRET (not placeholder)
- [ ] Google Cloud Console has OAuth 2.0 Web application credentials
- [ ] "Authorized redirect URIs" includes `http://localhost:3000/api/auth/callback/google`
- [ ] "Authorized JavaScript origins" includes `http://localhost:3000`
- [ ] Gmail API is ENABLED in APIs & Services
- [ ] Your email is in the OAuth consent screen test users
- [ ] No trailing slashes in redirect URI
- [ ] NEXTAUTH_URL=http://localhost:3000 in `.env.local`
- [ ] Dev server restarted after editing `.env.local`

## For Vercel Production

When deploying to Vercel, you'll need:

1. **Create second OAuth credential** in Google Cloud Console:
   - Name it "Production - Vercel"
   - Authorized JavaScript origins: `https://yourusername.vercel.app`
   - Authorized redirect URI: `https://yourusername.vercel.app/api/auth/callback/google`

2. **In Vercel dashboard**, set environment variables:
   ```
   NEXTAUTH_URL=https://yourusername.vercel.app
   NEXTAUTH_SECRET=(same as local or new one)
   GOOGLE_CLIENT_ID=(production credentials)
   GOOGLE_CLIENT_SECRET=(production credentials)
   ```

3. Keep local credentials for local development

## If Still Having Issues

1. **Clear browser cookies:**
   - DevTools → Application → Cookies → Delete localhost cookies
   - Try in incognito/private window

2. **Check logs:**
   - Terminal where npm run dev is running
   - Look for error messages

3. **Verify app URL:**
   - When running locally: http://localhost:3000
   - Matches NEXTAUTH_URL in `.env.local`

4. **Test with curl** (advanced):
   ```bash
   # This should NOT return 401
   curl -X POST http://localhost:3000/api/auth/callback/google \
     -H "Content-Type: application/json"
   ```

## Important Security Notes

⚠️ **NEVER:**
- Commit `.env.local` to Git
- Share GOOGLE_CLIENT_SECRET with anyone
- Use GOOGLE_CLIENT_SECRET in frontend code
- Commit credentials to GitHub

✓ **Always:**
- Keep `.env.local` local only
- Store secrets in Vercel environment variables (marked as "Sensitive")
- Review who has access to your Google Cloud Project

## Need More Help?

If you're still getting "401: invalid_client" after following all steps:

1. Take a screenshot of your Google Cloud Console "Authorized redirect URIs" section
2. Verify it shows exactly: `http://localhost:3000/api/auth/callback/google`
3. Verify `.env.local` shows real Client ID (not placeholder)
4. Restart dev server with: `npm run dev`
5. Try in a new incognito window
