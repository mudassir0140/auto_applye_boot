# OAuth 401: invalid_client - Deep Debugging Guide

If you're still getting "401: invalid_client" after following the setup guides, this document helps you identify the exact issue.

## What the Code is Using

When you run `npm run dev`, the app will now show:

```
🔐 OAuth Configuration:
  Base URL: http://localhost:3000
  Callback URL: http://localhost:3000/api/auth/callback/google
  Client ID: ✓ Set (1234567890...ABCDEF)
  NEXTAUTH_SECRET: ✓ Set
```

**Your exact values:**
- **Base URL:** Where your app is running (from NEXTAUTH_URL or defaults)
- **Callback URL:** Exact URL sent to Google for OAuth callback
- **Client ID:** First 10 and last 6 characters shown (full value hidden for security)

## OAuth Request Flow

Here's exactly what happens when you click "Connect Gmail":

```
1. User clicks "Connect Gmail"
   ↓
2. Browser calls: signIn('google', { callbackUrl: '/dashboard/settings', redirect: true })
   ↓
3. NextAuth generates authorization URL to Google:
   https://accounts.google.com/o/oauth2/v2/auth?
     client_id=<GOOGLE_CLIENT_ID>
     redirect_uri=http://localhost:3000/api/auth/callback/google
     scope=openid email profile gmail.readonly
     response_type=code
     prompt=consent
     access_type=offline
   ↓
4. Google checks: "Is this client_id registered with me?"
   ↓
   If NO → 401: invalid_client error
   If YES → Shows permission screen
   ↓
5. User grants permissions
   ↓
6. Google redirects to: http://localhost:3000/api/auth/callback/google?code=...&state=...
   ↓
7. NextAuth exchanges authorization code for tokens
   ↓
8. Tokens stored in database
   ↓
9. User redirected to /dashboard/settings
```

## Debugging Steps

### Step 1: Check Console Output

Run `npm run dev` and look for this output:

```
🔐 OAuth Configuration:
  Base URL: http://localhost:3000
  Callback URL: http://localhost:3000/api/auth/callback/google
```

**What to check:**
- ✓ Base URL should be `http://localhost:3000` (or your actual dev URL)
- ✓ Callback URL should be `http://localhost:3000/api/auth/callback/google`

If you see ❌ indicators, credentials are missing/invalid.

### Step 2: Verify Credentials Are Set

Check `.env.local`:

```bash
cat .env.local | grep GOOGLE_
```

You should see:
```
GOOGLE_CLIENT_ID=1234567890-abc...@apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123...
```

**NOT:**
```
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

### Step 3: Check Google Cloud Console

Open Google Cloud Console:
https://console.cloud.google.com/apis/credentials

1. Find your OAuth 2.0 Web Application credential
2. Click it to view details
3. Check "Authorized redirect URIs" section
4. Should show exactly:
   ```
   http://localhost:3000/api/auth/callback/google
   ```

**Common mismatches:**
```
❌ WRONG                                           ✓ RIGHT
http://localhost:3001/...                        http://localhost:3000/...
https://localhost:3000/...                       http://localhost:3000/...
http://localhost:3000/api/auth/callback/google/ http://localhost:3000/api/auth/callback/google
```

### Step 4: Browser Network Debugging

1. Open Browser DevTools (F12)
2. Go to Network tab
3. Click "Connect Gmail"
4. Look for request to `accounts.google.com`
5. Click on it to view details
6. Check query parameters:
   - `client_id=` should match your Google Cloud Console value
   - `redirect_uri=http://localhost:3000/api/auth/callback/google`
   - `scope=openid%20email%20profile%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.readonly`

### Step 5: Check Error Details

When you get the 401 error, check the error page (`/auth/error`).

It should show:
- Error type: `OAuthCallback` (if it's a configuration error)
- Or: `OAuthSignin` (if credentials are wrong)

Different errors mean different issues:
- `OAuthSignin` → Client ID or Secret invalid
- `OAuthCallback` → Redirect URI mismatch or validation failed
- `access_denied` → User denied permissions

## Step-by-Step Verification

### Checklist 1: Credentials Exist

```bash
# In project root, check:
grep GOOGLE_CLIENT_ID .env.local

# Should output something like:
# GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com

# NOT:
# GOOGLE_CLIENT_ID=your-google-client-id-here
```

### Checklist 2: Google Cloud Console Configured

Go to: https://console.cloud.google.com/apis/credentials

1. ✓ Project exists: "Job Application AI Agent"
2. ✓ Gmail API is ENABLED (check APIs & Services)
3. ✓ OAuth 2.0 Web Application credentials created
4. ✓ Authorized JavaScript origins include: `http://localhost:3000`
5. ✓ Authorized redirect URIs include: `http://localhost:3000/api/auth/callback/google`
6. ✓ Your email is in test users (OAuth consent screen)

### Checklist 3: Configuration Matches

```
Google Cloud Console:
  Client ID: 1234567890-abc...@apps.googleusercontent.com
  Redirect URI: http://localhost:3000/api/auth/callback/google

.env.local:
  GOOGLE_CLIENT_ID=1234567890-abc...@apps.googleusercontent.com
  NEXTAUTH_URL=http://localhost:3000

Generated by app:
  Callback URL: http://localhost:3000/api/auth/callback/google
```

All three must match EXACTLY.

## The 401 Error Actually Means

Google received a request with:
- `client_id=<your-value>`

But when Google checked their database, they didn't find a registered OAuth application with that client ID.

**Possible causes:**
1. ❌ `GOOGLE_CLIENT_ID` is empty or placeholder
   - Fix: Put real value from Google Cloud Console in `.env.local`

2. ❌ `GOOGLE_CLIENT_ID` is wrong
   - Fix: Copy exact value from Google Cloud Console

3. ❌ Credentials were deleted from Google Cloud Console
   - Fix: Create new OAuth 2.0 credentials

4. ❌ Using credentials from wrong project
   - Fix: Make sure all credentials from same Google Cloud project

5. ❌ Credentials are for web app but you're using in wrong way
   - Fix: Must be "Web application" type, not "Desktop" or other

## Advanced Debugging

### Enable NextAuth.js Debug Logging

The code now includes `debug: true` in development mode, which enables NextAuth.js internal logging.

You'll see detailed logs in terminal when OAuth happens:
```
[oauth-debug] Generating authorization request
[oauth-debug] client_id: 1234567890...
[oauth-debug] redirect_uri: http://localhost:3000/api/auth/callback/google
```

### Check Network Request

Open DevTools, Network tab, filter for "oauth2":

You should see request to:
```
https://accounts.google.com/o/oauth2/v2/auth?
  client_id=1234567890...
  redirect_uri=http://localhost:3000%2Fapi%2Fauth%2Fcallback%2Fgoogle
  scope=openid+email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.readonly
  response_type=code
  state=abc123...
  prompt=consent
  access_type=offline
```

If you see this request, it means:
- ✓ App sent request to Google
- ✓ Client ID was included
- ✓ Redirect URI was correct

If 401 error comes back, it means Google rejected the client_id.

### Common URL Issues

Check the exact URL being generated:

```
✓ CORRECT format:
  http://localhost:3000/api/auth/callback/google

❌ WRONG variations:
  http://localhost:3000/api/auth/callback/google/  (extra slash)
  http://localhost:3001/api/auth/callback/google   (wrong port)
  https://localhost:3000/api/auth/callback/google  (https not http)
  http://localhost:3000/api/auth/callback/google?  (query params)
```

These MUST match EXACTLY in both:
1. Code (should show in console.log)
2. Google Cloud Console (in redirect URIs field)

## If You're on Vercel

For Vercel deployments, the flow is the same but:

```
Base URL: https://your-project-name.vercel.app
Callback URL: https://your-project-name.vercel.app/api/auth/callback/google

NEXTAUTH_URL=https://your-project-name.vercel.app
GOOGLE_CLIENT_ID=<your-production-credentials-client-id>
GOOGLE_CLIENT_SECRET=<your-production-credentials-secret>
```

Note: These should be DIFFERENT from local credentials.
- Local: Use `http://localhost:3000` credentials
- Production: Use `https://vercel-app.vercel.app` credentials

## Troubleshooting Checklist

- [ ] `.env.local` has real GOOGLE_CLIENT_ID (not placeholder)
- [ ] `.env.local` has real GOOGLE_CLIENT_SECRET (not placeholder)
- [ ] Console output shows `✓ Set` for Client ID
- [ ] Google Cloud Console has OAuth credentials created
- [ ] Redirect URI in Google Cloud Console is EXACTLY: `http://localhost:3000/api/auth/callback/google`
- [ ] JavaScript origins in Google Cloud Console include: `http://localhost:3000`
- [ ] No trailing slashes in URLs
- [ ] HTTP (not HTTPS) for localhost
- [ ] Port is 3000 (or matches your actual port)
- [ ] NEXTAUTH_URL in `.env.local` is `http://localhost:3000`
- [ ] Gmail API is ENABLED (not just configured)
- [ ] Your email is in test users (OAuth consent screen)
- [ ] Dev server restarted after editing `.env.local`

If all checklist items pass, run step-by-step from "Step 1: Check Console Output" to identify the issue.

