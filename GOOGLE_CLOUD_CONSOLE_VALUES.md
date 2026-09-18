# Google Cloud Console Configuration - Copy-Paste Values

This document provides the **exact values** you need to configure in Google Cloud Console for this application.

## Quick Reference

| Setting | Value |
|---------|-------|
| **Project Name** | Job Application AI Agent |
| **Application Type** | Web application |
| **Authorized JavaScript Origins (Local)** | `http://localhost:3000` |
| **Authorized Redirect URI (Local)** | `http://localhost:3000/api/auth/callback/google` |
| **OAuth Consent Screen Type** | External |
| **Required Scopes** | openid, email, profile, gmail.readonly |
| **Test User Email** | fmkports@gmail.com (or your Gmail address) |

---

## Local Development Setup

Use these exact values when creating OAuth credentials in Google Cloud Console for local development.

### Step 1: OAuth Client Type
```
Web application
```

### Step 2: Authorized JavaScript Origins
Copy and paste exactly:
```
http://localhost:3000
```

### Step 3: Authorized Redirect URIs
Copy and paste exactly:
```
http://localhost:3000/api/auth/callback/google
```

**IMPORTANT:** 
- No trailing slash
- Must be `http://` (not https) for localhost
- Port must be `3000` (unless you're using a different port)

### Step 4: OAuth Consent Screen Settings

**User Type:** `External`

**App Name:** 
```
Job Application AI Agent
```

**User Support Email:**
```
your-email@gmail.com
```

**App Domain:**
```
http://localhost:3000
```

**Scopes to Request:**
- `openid` (required for authentication)
- `email` (required for user email)
- `profile` (required for user profile)
- `https://www.googleapis.com/auth/gmail.readonly` (for reading emails)

**Test Users:**
```
fmkports@gmail.com
```
(Or your own Gmail address)

### Step 5: Local `.env.local` Configuration

After getting credentials from Google Cloud Console, use these in `.env.local`:

```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# NextAuth Configuration
NEXTAUTH_SECRET=3cfb87ea0592f33c5f07de53c67f45cf89bce8456cc86dcab40d80c46f5a3bc5
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (Get these from Google Cloud Console)
GOOGLE_CLIENT_ID=<your-client-id-from-google>
GOOGLE_CLIENT_SECRET=<your-client-secret-from-google>

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Node Environment
NODE_ENV=development
```

**Replace:**
- `<your-client-id-from-google>` with the Client ID (looks like: `1234567890-abc123.apps.googleusercontent.com`)
- `<your-client-secret-from-google>` with the Client Secret (looks like: `GOCSPX-abc123xyz789`)

---

## Vercel Production Setup

Use these exact values when deploying to Vercel.

### Step 1: OAuth Client Type
```
Web application
```

### Step 2: Authorized JavaScript Origins
Replace `yourusername` with your actual Vercel username:
```
https://yourusername.vercel.app
```

If you have a custom domain:
```
https://yourdomain.com
```

### Step 3: Authorized Redirect URIs
Replace `yourusername` with your actual Vercel username:
```
https://yourusername.vercel.app/api/auth/callback/google
```

If you have a custom domain:
```
https://yourdomain.com/api/auth/callback/google
```

**IMPORTANT:**
- No trailing slash
- Must be `https://` (not http) for production
- Must match your actual Vercel domain

### Step 4: Vercel Environment Variables

Set these in Vercel Dashboard → Project Settings → Environment Variables:

```
NEXTAUTH_URL=https://yourusername.vercel.app
NEXTAUTH_SECRET=<generate-new-secret-with-openssl-rand-hex-32>
GOOGLE_CLIENT_ID=<production-client-id>
GOOGLE_CLIENT_SECRET=<production-client-secret>
DATABASE_URL=<your-database-url>
NEXT_PUBLIC_APP_URL=https://yourusername.vercel.app
```

**Mark `GOOGLE_CLIENT_SECRET` as "Sensitive"** when entering in Vercel.

---

## Code Verification

The application code uses these environment variables securely:

✅ **Correct Usage (in `src/lib/auth.ts`):**
```typescript
GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  // ... rest of config
})
```

✅ **Protected:** 
- `GOOGLE_CLIENT_SECRET` is only used on the server
- Never exposed to browser/frontend
- Safely passed to NextAuth.js

❌ **Not Used (Secure):**
- No `NEXT_PUBLIC_GOOGLE_CLIENT_SECRET` (would expose secret)
- No hardcoded credentials in code
- No credentials in version control

---

## Callback URL Explanation

The redirect URI is critical and must match exactly:

```
http://localhost:3000/api/auth/callback/google
                      ↑                    ↑
                   Base URL           OAuth endpoint
```

The `base URL` comes from `NEXTAUTH_URL` in `.env.local`:
```env
NEXTAUTH_URL=http://localhost:3000
```

When combined with `/api/auth/callback/google`, it forms the complete redirect URI.

---

## What Each Scope Does

The app requests these OAuth scopes:

| Scope | Purpose | Required |
|-------|---------|----------|
| `openid` | Verify user identity | Yes |
| `email` | Get user's email address | Yes |
| `profile` | Get user's name and picture | Yes |
| `https://www.googleapis.com/auth/gmail.readonly` | Read Gmail inbox (jobs only) | Yes |

User will see in consent screen:
- "See your email address"
- "See your name and profile picture"
- "View your Gmail inbox and send emails"

---

## Common Value Mistakes

### ❌ Wrong - Missing credentials
```env
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

### ✅ Correct - Real credentials
```env
GOOGLE_CLIENT_ID=1234567890-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

### ❌ Wrong - Trailing slash
```
http://localhost:3000/api/auth/callback/google/
```

### ✅ Correct - No trailing slash
```
http://localhost:3000/api/auth/callback/google
```

### ❌ Wrong - HTTPS for localhost
```
https://localhost:3000/api/auth/callback/google
```

### ✅ Correct - HTTP for localhost
```
http://localhost:3000/api/auth/callback/google
```

---

## Verification Checklist

Before testing, verify these values are set in Google Cloud Console:

- [ ] **OAuth Type:** Web application
- [ ] **Authorized Origins:** `http://localhost:3000` (local) or `https://yourusername.vercel.app` (production)
- [ ] **Redirect URI:** `http://localhost:3000/api/auth/callback/google` (local) or `https://yourusername.vercel.app/api/auth/callback/google` (production)
- [ ] **No trailing slashes** in any URL
- [ ] **OAuth Consent Screen** configured with scopes
- [ ] **Test user** email added to consent screen
- [ ] **Gmail API** is ENABLED

---

## Where to Find These Values in Google Cloud Console

1. **OAuth Client ID and Secret:**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Find: "OAuth 2.0 Client IDs"
   - Click: Your web application
   - You'll see Client ID and button to view secret

2. **Authorized Origins and Redirect URIs:**
   - Same location as above (in the OAuth client details)
   - Section labeled "Authorized JavaScript origins"
   - Section labeled "Authorized redirect URIs"

3. **OAuth Consent Screen:**
   - Go to: https://console.cloud.google.com/apis/credentials/consent
   - Section: "Scopes"
   - Section: "Test users"

---

## Security Reminders

🔒 **NEVER share or commit:**
- GOOGLE_CLIENT_SECRET
- `.env.local` file
- NEXTAUTH_SECRET

🔐 **ALWAYS store securely:**
- Use `.gitignore` to exclude `.env.local`
- Vercel: Use environment variables with "Sensitive" flag
- Local: Store in `.env.local` only

✅ **SAFE to use publicly:**
- GOOGLE_CLIENT_ID (it's public by design)
- Authorized origins and redirect URIs
- Code that uses these values

