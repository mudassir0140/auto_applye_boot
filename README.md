# Job Application AI Agent

A production-ready automation platform for discovering, applying to, and tracking job applications. Features intelligent job matching, Gmail integration for application updates, and a comprehensive dashboard.

## Features

- **Job Discovery**: Find relevant jobs from LinkedIn, Google Jobs, and other platforms
- **Smart Application**: Automatically or manually apply to suitable positions using your CV and portfolio
- **Email Integration**: Connect Gmail to automatically receive and categorize job-related emails
- **Application Tracking**: Monitor all applications in one centralized dashboard
- **Notifications**: Real-time browser and email notifications for interviews, assessments, and offers
- **Secure OAuth**: Gmail integration using secure OAuth 2.0 without storing passwords
- **Vercel Ready**: Optimized for deployment on Vercel with environment variables

## Tech Stack

- **Frontend**: React 19, Next.js 15, Tailwind CSS
- **Backend**: Next.js API Routes, TypeScript
- **Database**: SQLite (Prisma ORM)
- **Authentication**: NextAuth.js with Google OAuth
- **Email**: Google Gmail API
- **APIs**: Axios, googleapis

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Google OAuth credentials (for Gmail integration)

### Installation

1. **Clone and install dependencies**

```bash
cd boot_Auto_play
npm install
```

2. **Set up environment variables**

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_SECRET=generate-a-random-secret-key
NEXTAUTH_URL=http://localhost:3000

# Google OAuth - Get from https://console.cloud.google.com
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. **Set up the database**

```bash
npm run prisma:generate
npm run prisma:migrate
```

4. **Start the development server**

```bash
npm run dev
```

Visit `http://localhost:3000` and sign in with Google.

## Configuration

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable Gmail API
4. Create OAuth 2.0 credentials (Desktop app)
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Client Secret to `.env.local`

### Database

This app uses SQLite with Prisma ORM. To modify the schema:

1. Edit `prisma/schema.prisma`
2. Run `npm run prisma:migrate`

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/          # NextAuth configuration
│   │   ├── jobs/          # Job search & apply endpoints
│   │   ├── gmail/         # Gmail sync endpoints
│   │   ├── dashboard/     # Dashboard stats
│   │   └── user/          # User profile management
│   ├── dashboard/         # Protected dashboard pages
│   ├── auth/              # Auth pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── lib/
│   ├── prisma.ts          # Prisma client
│   ├── gmail.ts           # Gmail utilities
│   ├── jobs.ts            # Job search utilities
│   └── email-parser.ts    # Email classification
├── middleware.ts          # Auth middleware
└── globals.css            # Global styles
```

## API Endpoints

### Jobs
- `POST /api/jobs/search` - Search for jobs
- `POST /api/jobs/apply` - Apply to a job

### Gmail
- `POST /api/gmail/sync` - Sync job emails
- `GET /api/gmail/status` - Check Gmail connection status
- `DELETE /api/gmail/status` - Disconnect Gmail

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

### User
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile

## Security

- **No Password Storage**: Gmail OAuth uses secure tokens, no passwords stored
- **Environment Variables**: Sensitive data in `.env.local` (never committed)
- **Session Management**: Secure NextAuth session handling
- **Data Privacy**: Only job-related emails are processed
- **Server-Side Secrets**: Gmail tokens handled server-side only

## Deployment

### Vercel Deployment

1. Push to GitHub
2. Create new project on Vercel
3. Connect repository
4. Add environment variables in Vercel settings:
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (your production URL)
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `DATABASE_URL`

5. Deploy

For SQLite in production, consider migrating to PostgreSQL:

```bash
npm install @prisma/adapter-prisma-client
```

## Development

### Database Studio

```bash
npm run prisma:studio
```

### Build

```bash
npm run build
npm start
```

## Limitations & Future Improvements

Current Version:
- RSS-based job discovery (showing search URLs)
- Manual job applications for unsupported platforms
- SQLite database (suitable for single user)

Future Enhancements:
- Official LinkedIn Jobs API integration
- Automated application form filling
- Multi-user support with PostgreSQL
- Advanced job matching with AI
- Interview scheduling automation
- Salary negotiation guidance

## Contributing

This is a personal project. Feel free to fork and customize for your needs.

## License

MIT
