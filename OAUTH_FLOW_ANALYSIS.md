# OAuth 401: invalid_client - Code Flow Analysis

This document explains exactly what the code does and where the 401 error comes from.

## Exact OAuth Flow in Your Code

### 1. User Clicks "Connect Gmail"

Location: `src/app/dashboard/settings/page.tsx` line 47-55

```typescript
async function handleConnectGmail() {
  setGmailConnecting(true)
  try {
    await signIn('google', {
      callbackUrl: '/dashboard/settings',
      redirect: true,
    })
  }
}
```

What happens:
- Calls NextAuth's `signIn()` function
- Tells NextAuth to use 'google' provider
- Will redirect back to `/dashboard/settings` after OAuth success

### 2. NextAuth Configuration

Location: `src/lib/auth.ts` line 12-80

**What the code reads from environment:**
```typescript
const baseUrl = getBaseUrl()           // Gets NEXTAUTH_URL or defaults
const clientId = process.env.GOOGLE_CLIENT_ID
const clientSecret = process.env.GOOGLE_CLIENT_SECRET
const secret = process.env.NEXTAUTH_SECRET
```

**Exact values used:**
- Base URL: `http://localhost:3000` (from NEXTAUTH_URL in .env.local)
- Callback URL: `http://localhost:3000/api/auth/callback/google`
- Client ID: From `GOOGLE_CLIENT_ID` environment variable
- Client Secret: From `GOOGLE_CLIENT_SECRET` environment variable

**Console Output in Development:**
When you run `npm run dev`, you'll see:
```
🔐 OAuth Configuration:
  Base URL: http://localhost:3000
  Callback URL: http://localhost:3000/api/auth/callback/google
  Client ID: ✓ Set (1234567890...ABCDEF)    [if configured]
  NEXTAUTH_SECRET: ✓ Set
```

Or if credentials missing:
```
🔐 OAuth Configuration:
  Base URL: http://localhost:3000
  Callback URL: http://localhost:3000/api/auth/callback/google
  Client ID: ❌ Missing/placeholder
  NEXTAUTH_SECRET: ✓ Set

⚠️  OAuth Configuration Issues:
  - GOOGLE_CLIENT_ID is not configured (still using placeholder)
  - GOOGLE_CLIENT_SECRET is not configured (still using placeholder)
```

### 3. Authorization URL Generation

NextAuth.js generates this URL and redirects user:

```
https://accounts.google.com/o/oauth2/v2/auth?
  client_id=GOOGLE_CLIENT_ID_VALUE
  redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback%2Fgoogle
  scope=openid+email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.readonly
  response_type=code
  state=random_string_for_security
  prompt=consent
  access_type=offline
```

### 4. Google's Response

Google checks: "Do I recognize this client_id?"

**If YES:**
- Shows OAuth consent screen
- User grants permissions
- Google redirects to callback URL with authorization code

**If NO → 401: invalid_client error:**
Reasons why Google doesn't recognize client_id:
1. ❌ `GOOGLE_CLIENT_ID` is empty string
2. ❌ `GOOGLE_CLIENT_ID` is placeholder: "your-google-client-id-here"
3. ❌ `GOOGLE_CLIENT_ID` doesn't exist in Google Cloud Console
4. ❌ `GOOGLE_CLIENT_ID` is from different Google Cloud project
5. ❌ `GOOGLE_CLIENT_ID` is wrong format or typo

### 5. Callback Processing

If authorization succeeds, Google redirects to:
```
http://localhost:3000/api/auth/callback/google?code=...&state=...
```

Next Auth route handler at `src/app/api/auth/[...nextauth]/route.ts`:
```typescript
const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

This:
1. Validates the `state` parameter for security
2. Exchanges `code` for access token using `GOOGLE_CLIENT_SECRET`
3. Stores tokens in database via Prisma adapter
4. Creates user session
5. Redirects to `/dashboard/settings`

## The 401 Error - Root Cause Analysis

### What the Error Actually Means

```
OAuth Request to Google:
  client_id=GOOGLE_CLIENT_ID_VALUE
  
Google Response:
  401: invalid_client - "I don't recognize this client_id"
```

### Why This Happens

The value of `GOOGLE_CLIENT_ID` environment variable doesn't match any registered OAuth application in Google's database.

### Where Environment Variables Come From

**For local development (.env.local):**
```env
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

**For Vercel (Environment Variables):**
- Set in Vercel Project Settings → Environment Variables
- Same variable names: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

## Diagnostic Checklist

### Check 1: Is the Variable Set?

```bash
# In terminal, at project root:
echo $GOOGLE_CLIENT_ID

# Should output your actual Client ID, like:
# 1234567890-abc123def456.apps.googleusercontent.com

# NOT:
# your-google-client-id-here
# (empty)
```

### Check 2: Does It Match Google Cloud Console?

1. Go to Google Cloud Console
2. Find your OAuth 2.0 credentials
3. Copy the Client ID
4. Compare with `.env.local` value
5. Must match EXACTLY

### Check 3: What's the Callback URL?

The app generates:
```
http://localhost:3000/api/auth/callback/google
```

This must be configured in Google Cloud Console under:
- OAuth 2.0 Client ID → Authorized redirect URIs

Must match EXACTLY (no trailing slash, http not https for localhost).

### Check 4: What Does Console Log Show?

Run `npm run dev` and look for:

```
🔐 OAuth Configuration:
  Base URL: http://localhost:3000
  Callback URL: http://localhost:3000/api/auth/callback/google
  Client ID: ✓ Set (1234567...ABCDEF)
```

- ✓ Set means credentials are configured
- ❌ Missing means they're not

## Detailed Test Steps

### Step 1: Verify .env.local

```bash
cat .env.local | grep GOOGLE_
```

Should output:
```
GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123xyz789
```

NOT:
```
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

### Step 2: Start Dev Server and Check Console

```bash
npm run dev
```

Look for output like:
```
🔐 OAuth Configuration:
  Base URL: http://localhost:3000
  Callback URL: http://localhost:3000/api/auth/callback/google
  Client ID: ✓ Set (1234567890...ABCDEF)
  NEXTAUTH_SECRET: ✓ Set
```

### Step 3: Click "Connect Gmail"

1. Open http://localhost:3000/dashboard/settings
2. Click "Connect Gmail"
3. Check what happens:
   - ✓ Redirects to Google login → Credentials are correct
   - ❌ Shows error → Check credentials

### Step 4: Check Browser Network

Open DevTools (F12) → Network tab → Click "Connect Gmail"

Look for request to `accounts.google.com`:
- Check URL query parameters
- Look for `client_id=` value
- Should match your Google Cloud Console Client ID

### Step 5: Check Error Details

If you see 401 error, go to `/auth/error` page:
- Should show error type and details
- Use this to understand what went wrong

## Code Configuration Verification

### What .env.local Controls

```env
NEXTAUTH_URL=http://localhost:3000
```
↓ Used to generate:
```
Callback URL: http://localhost:3000/api/auth/callback/google
```

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```
↓ Used for:
```
OAuth Authorization URL: 
  client_id={value}
  
Token Exchange:
  client_id={value}
  client_secret={value}
```

### What Google Cloud Console Controls

Three things MUST match:

1. **Client ID matches:**
   ```
   .env.local: GOOGLE_CLIENT_ID=1234567890...
   Google Cloud: OAuth Client ID = 1234567890...
   ```

2. **Redirect URI matches exactly:**
   ```
   Code generates: http://localhost:3000/api/auth/callback/google
   Google Cloud: http://localhost:3000/api/auth/callback/google
   ```

3. **Client Secret matches:**
   ```
   .env.local: GOOGLE_CLIENT_SECRET=GOCSPX-...
   Google Cloud: Client Secret = GOCSPX-...
   ```

## The 401 Error Solution

The fix is simple:

1. **Get real credentials from Google Cloud Console:**
   - Don't use placeholder values
   - Copy exact values

2. **Put them in .env.local:**
   - GOOGLE_CLIENT_ID=<actual-value>
   - GOOGLE_CLIENT_SECRET=<actual-value>

3. **Verify Google Cloud Console:**
   - Redirect URI: http://localhost:3000/api/auth/callback/google

4. **Restart dev server:**
   ```bash
   npm run dev
   ```

5. **Test:**
   - Go to settings
   - Click "Connect Gmail"
   - Should work!

## Where Each Value Comes From

| Value | Source | Used For |
|-------|--------|----------|
| NEXTAUTH_URL | `.env.local` | Generate callback URL |
| GOOGLE_CLIENT_ID | `.env.local` | OAuth authorization request |
| GOOGLE_CLIENT_SECRET | `.env.local` | Token exchange (server-side) |
| NEXTAUTH_SECRET | `.env.local` | Session encryption |
| Base URL | NEXTAUTH_URL or default | Construct full URLs |
| Callback URL | Computed from Base URL | OAuth redirect |

## Security Notes

✓ Safe (never exposed):
- GOOGLE_CLIENT_SECRET (only used server-side)
- NEXTAUTH_SECRET (only used server-side)
- Access tokens (stored in database, not sent to browser)

❌ Never:
- Commit `.env.local` to Git
- Hardcode secrets in code
- Expose GOOGLE_CLIENT_SECRET to frontend

## Production (Vercel) Differences

For Vercel, the flow is identical but:

```
Base URL: https://your-project-name.vercel.app
Callback URL: https://your-project-name.vercel.app/api/auth/callback/google

Environment Variables Set In: Vercel Project Settings
```

Note: Use DIFFERENT credentials for production:
- Local: http://localhost:3000 credentials
- Production: https://vercel.app credentials

## Summary

The 401: invalid_client error means the Client ID being sent to Google doesn't match any registered OAuth application.

**Fix:**
1. Ensure GOOGLE_CLIENT_ID in .env.local is real (not placeholder)
2. Ensure it matches Google Cloud Console exactly
3. Ensure Callback URL is configured in Google Cloud Console
4. Restart dev server

**Debug:**
1. Run `npm run dev` and check console output
2. Look at browser Network tab when OAuth happens
3. Verify .env.local has real credentials
4. Go to Google Cloud Console and verify configuration

See OAUTH_DEBUGGING.md for step-by-step debugging procedures.

