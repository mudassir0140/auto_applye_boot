# Troubleshooting Guide

## Common Issues & Solutions

### npm install Hangs or Timeouts

**Symptoms:**
- npm install takes > 5 minutes
- Timeout errors
- No output after initial stages
- npm processes hanging

**Solutions (try in order):**

1. **Clear npm cache**
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Use npm install with flags**
   ```bash
   npm install --legacy-peer-deps --no-audit --prefer-offline
   ```

3. **Install packages selectively**
   ```bash
   npm install next react react-dom
   npm install -D typescript @types/node @types/react @types/react-dom
   npm install next-auth @next-auth/prisma-adapter
   npm install prisma @prisma/client
   npm install axios googleapis zod
   npm install tailwindcss postcss autoprefixer
   npm install eslint eslint-config-next
   ```

4. **Use Yarn instead**
   ```bash
   npm install -g yarn
   rm -rf node_modules package-lock.json
   yarn install
   ```

5. **Increase npm timeout**
   ```bash
   npm config set fetch-timeout 60000
   npm config set fetch-retry-mintimeout 60000
   npm config set fetch-retry-maxtimeout 120000
   npm install --legacy-peer-deps
   ```

6. **Use Windows PowerShell with higher privileges**
   ```powershell
   # Run as Administrator
   npm install --legacy-peer-deps
   ```

7. **Manual installation (Last resort)**
   - Download node_modules from a CDN or pre-built package
   - Extract into project directory

---

## Prisma Issues

### "Prisma Client not found"

**Error:**
```
Cannot find module '@prisma/client'
```

**Solution:**
```bash
npm run prisma:generate
npm install @prisma/client
```

### Database Migration Fails

**Error:**
```
Error: P1000: Authentication failed against database server
```

**Solution:**
```bash
# Check DATABASE_URL in .env.local
# SQLite doesn't need auth, just a valid path

# For SQLite
DATABASE_URL="file:./prisma/dev.db"

# Reset database
rm prisma/dev.db prisma/dev.db-journal 2>/dev/null
npm run prisma:migrate
```

### "Cannot find module 'prisma'"

**Solution:**
```bash
npm install prisma --save-dev
npm run prisma:generate
```

---

## Next.js Issues

### "Module not found" errors

**Error:**
```
Module not found: Can't resolve 'next-auth'
```

**Solution:**
```bash
npm install next-auth next-auth@beta
npm install @next-auth/prisma-adapter
```

### Port 3000 already in use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**
```bash
# Option 1: Use different port
npm run dev -- -p 3001

# Option 2: Kill process on port 3000
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

### TypeScript compilation errors

**Error:**
```
Type 'X' is not assignable to type 'Y'
```

**Solution:**
```bash
# Regenerate TypeScript types
npm run prisma:generate

# Type check
npx tsc --noEmit

# See all type errors
npm run build
```

---

## Authentication Issues

### "OAuth callback failed"

**Error:**
```
Error: invalid_grant or Callback URL mismatch
```

**Causes & Solutions:**
1. **Redirect URI mismatch**
   - Check Google Cloud Console settings match `NEXTAUTH_URL`
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`

2. **NEXTAUTH_URL not set**
   ```env
   NEXTAUTH_URL=http://localhost:3000
   ```

3. **NEXTAUTH_SECRET not set**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   # Copy output to NEXTAUTH_SECRET in .env.local
   ```

4. **Expired credentials**
   - Regenerate OAuth credentials in Google Cloud Console

### "Gmail connection fails"

**Error:**
```
Error: Gmail not connected or access token expired
```

**Solutions:**
1. Disconnect and reconnect Gmail in Settings
2. Check scope is correct: `email profile https://www.googleapis.com/auth/gmail.readonly`
3. Verify Gmail API is enabled in Google Cloud Console
4. Check OAuth credentials are correct

---

## Database Issues

### SQLite locking errors

**Error:**
```
Error: SQLITE_CANTOPEN: unable to open database file
```

**Solution:**
```bash
# Create prisma directory
mkdir -p prisma

# Ensure database file is writable
# And that another process isn't holding lock
rm -f prisma/dev.db-journal
npm run prisma:migrate
```

### "Too many connections"

**Error:**
```
Error: too many connections
```

**Solution:**
```bash
# This is a SQLite limitation
# For production, switch to PostgreSQL:

# 1. Get PostgreSQL connection string from Railway/Supabase
# 2. Update prisma/schema.prisma provider to "postgresql"
# 3. Update DATABASE_URL in .env.local
# 4. Run migrations: npm run prisma:migrate
```

---

## Build Issues

### Build fails with "Cannot find module"

**Error:**
```
Error: Cannot find module 'X' from 'Y'
```

**Solution:**
```bash
# Clean build
rm -rf .next
npm run build

# Or with verbose logging
npm run build -- --debug
```

### Build timeout

**Solution:**
```bash
# Increase build timeout
# In vercel.json or package.json scripts
# Add longer timeout for build process
```

---

## Deployment Issues (Vercel)

### "Build failed: Missing environment variable"

**Solution:**
1. Go to Vercel Project Settings
2. Environment Variables
3. Add all required variables:
   - NEXTAUTH_SECRET
   - NEXTAUTH_URL
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - DATABASE_URL

### "Deployment successful but site shows errors"

**Solutions:**
1. Check Vercel logs:
   ```bash
   vercel logs --follow
   ```

2. Check browser console (F12)

3. Verify environment variables are set in Vercel dashboard

4. Ensure DATABASE_URL is correct for production DB

### "PostgeSQL connection fails after deployment"

1. Check DATABASE_URL includes `?schema=public` for some providers
2. Verify database server allows connections from Vercel IP ranges
3. Check database credentials are correct
4. Test connection locally first

---

## Performance Issues

### Slow database queries

**Solution:**
```bash
# Check Prisma queries
npm run prisma:studio

# Monitor database performance
# SQLite: Consider upgrading to PostgreSQL for production
```

### Slow page loads

**Solution:**
```bash
# Enable next/image optimization
# Already configured in next.config.js

# Check bundle size
npm run build
# Look at .next output size
```

### High memory usage

**Solution:**
```bash
# Reduce number of concurrent email syncs
# Limit jobs fetched per search
# Use pagination for results
```

---

## Security Issues

### "NEXT_PUBLIC_APP_URL exposed in browser"

**Note:** This is intentional and safe
- It's prefixed with `NEXT_PUBLIC_` 
- No secrets are exposed
- Only used for public URLs

### "Environment variable visible in bundle"

**Safe variables (can be public):**
- NEXT_PUBLIC_APP_URL

**Secret variables (never public):**
- NEXTAUTH_SECRET
- GOOGLE_CLIENT_SECRET
- DATABASE_URL (if it contains passwords)

---

## Windows-Specific Issues

### Long file paths

**Error:**
```
ENAMETOOLONG: name too long
```

**Solution:**
```powershell
# Enable long paths in Windows
# Run as Administrator:
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

### Line ending issues (CRLF vs LF)

**Solution:**
```bash
# Git auto-converts, but if issues persist:
git config --global core.safecrlf false
```

### npm path issues

**Solution:**
```bash
# Use PowerShell instead of CMD
# Or use Git Bash for Unix-like commands
```

---

## Getting Help

1. **Check logs**
   - Browser console (F12)
   - Terminal output
   - Vercel deployment logs

2. **Check documentation**
   - README.md
   - SETUP_GUIDE.md
   - DEPLOYMENT_GUIDE.md

3. **GitHub Issues**
   - Search existing issues
   - Create new issue with:
     - Error message
     - Steps to reproduce
     - Environment info (node -v, npm -v)

4. **Community**
   - Next.js Discord
   - Prisma Slack
   - Stack Overflow

---

## Debugging Commands

```bash
# Check Node version
node --version  # Should be 18+

# Check npm version
npm --version   # Should be 9+

# List installed packages
npm list --depth=0

# Check for duplicate packages
npm list

# Verify TypeScript
npx tsc --noEmit

# Check Next.js build
npm run build

# Run with debugging
DEBUG=* npm run dev

# Check database
npm run prisma:studio
```

---

## Still Having Issues?

1. **Clear everything and restart**
   ```bash
   rm -rf node_modules .next dist .env.local package-lock.json
   npm install
   npm run prisma:generate
   npm run dev
   ```

2. **Use a different Node version**
   ```bash
   # Use nvm (Node Version Manager)
   nvm use 20
   npm install
   ```

3. **Create a fresh project and compare**
   - If possible, create a new Next.js project
   - Compare configurations
   - Copy working files

4. **Docker (as last resort)**
   - Use Docker container with pre-built image
   - Avoids system-specific npm issues
