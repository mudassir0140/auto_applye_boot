# Job Application AI Agent - Setup Guide

## Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- npm 9+
- Git
- A Google account

## Step 1: Clone the Repository

```bash
cd boot_Auto_play
```

## Step 2: Install Dependencies

```bash
npm install
```

This may take 3-5 minutes on first install.

## Step 3: Generate Database

```bash
npm run prisma:generate
npm run prisma:migrate
```

This creates the SQLite database and tables.

## Step 4: Set Up Google OAuth

### Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (name it "JobAI" or similar)
3. Click the project selector and create a new project
4. Wait for the project to be created

### Enable Required APIs

1. Go to APIs & Services > Library
2. Search for and enable:
   - Gmail API
   - People API (for email access)
3. Create OAuth 2.0 Credentials:
   - Go to APIs & Services > Credentials
   - Click "Create Credentials" > "OAuth Client ID"
   - Choose "Desktop Application"
   - Download the credentials (save as JSON)

### Configure Redirect URI

1. In Google Cloud Console, go to APIs & Services > Credentials
2. Click on your OAuth 2.0 credential
3. Add Authorized redirect URIs:
   - For Local: `http://localhost:3000/api/auth/callback/google`
   - For Production: `https://yourdomain.com/api/auth/callback/google`
4. Save

### Copy to Environment

1. From the downloaded credentials JSON, copy:
   - `client_id` → `GOOGLE_CLIENT_ID`
   - `client_secret` → `GOOGLE_CLIENT_SECRET`

## Step 5: Configure Environment Variables

Create `.env.local`:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add:

```env
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### Generate NEXTAUTH_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste it as `NEXTAUTH_SECRET`.

## Step 6: Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 7: Create Your First Account

1. Click "Sign in with Google"
2. Select your Google account
3. Approve the requested permissions
4. You'll be redirected to the dashboard

## Initial Setup on Dashboard

1. **Connect Gmail** (Settings):
   - Click "Connect Gmail"
   - Approve the Gmail API access
   - Your Gmail account is now connected

2. **Update Profile** (Settings):
   - Add your full name
   - Add CV/Resume URL
   - Add Portfolio/GitHub URL

3. **Search for Jobs**:
   - Go to Search & Apply
   - Enter your job keywords (e.g., React, Next.js)
   - Click "Search Jobs"
   - Apply to positions using the Apply button

4. **Sync Gmail**:
   - Go to Email Updates
   - Click "Sync Gmail" to fetch job-related emails

## Features Overview

### Dashboard
- Overview of all applications and statistics
- Quick access to Gmail connection status
- Recent applications and email updates

### Search & Apply
- Search for jobs using custom keywords
- View job match scores
- Apply directly from the platform
- Some platforms may require manual application

### Applications Tracking
- Filter applications by status
- View all communication for each application
- Track interview and assessment progress

### Email Integration
- Automatic sync of job-related emails from Gmail
- Email classification (Interview, Assessment, Rejection, Offer)
- Real-time status updates
- Notification system

### Settings
- Profile management
- CV and portfolio URLs
- Gmail connection management
- Job search preferences

## Troubleshooting

### "Gmail not connected"
1. Make sure you've signed in with Google
2. Click "Connect Gmail" in Settings
3. Approve all requested permissions

### "Database error"
1. Delete `prisma/dev.db` if it exists
2. Run `npm run prisma:migrate`

### "Port 3000 already in use"
```bash
# Use a different port
npm run dev -- -p 3001
```

### "OAuth callback failed"
1. Verify `NEXTAUTH_URL` matches your domain
2. Check that redirect URI is registered in Google Cloud Console
3. Restart the development server

### "Can't apply to jobs"
Some job platforms don't support automation. You'll see a manual approval prompt for these positions.

## Database Management

### View Database Schema
```bash
npm run prisma:studio
```

This opens a visual database editor at `http://localhost:5555`

### Reset Database
```bash
rm prisma/dev.db prisma/dev.db-journal 2>/dev/null
npm run prisma:migrate
```

### Make Schema Changes
1. Edit `prisma/schema.prisma`
2. Run `npm run prisma:migrate`
3. Restart the development server

## Performance Tips

1. **Email Sync**: Run manually or schedule periodic syncs to avoid overwhelming Gmail API
2. **Job Search**: Use specific keywords to get better matches
3. **Database**: SQLite is fine for single user; for production with multiple users, switch to PostgreSQL

## Next Steps

- Read `README.md` for full documentation
- Check `DEPLOYMENT_GUIDE.md` for production setup
- Review API endpoints documentation

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review application logs in browser console
3. Check server logs in terminal
