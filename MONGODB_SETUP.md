# Boot — MongoDB Atlas setup

Boot stores everything server-side in MongoDB Atlas (users, CV, skills/preferences, Google accounts + OAuth
tokens, jobs, applications, history, sent/received emails, notifications). Every record has a `userId`
and every API query filters on the signed-in user's id. Nothing persistent lives in `localStorage`.

## 1. Create the free cluster
1. https://cloud.mongodb.com → create a free **M0** cluster.
2. **Database Access** → add a database user (choose a password; keep it to yourself).
3. **Network Access** → allow `0.0.0.0/0` (needed for Vercel's changing IPs) or your own IP for local dev.
4. **Connect → Drivers** → copy the connection string and add a database name before the `?`:

   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/boot?retryWrites=true&w=majority`

## 2. Environment variable
Add **`DATABASE_URL`** with that string to:
- `.env.local` (local; git-ignored) — replace the old `file:./dev.db` value
- Vercel → Project → Settings → Environment Variables

Also required: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
and `CRON_SECRET` (any long random string; protects `/api/cron/run`). See `.env.example`.

## 3. Create collections and indexes
```
npm install
npm run prisma:push      # prisma db push (MongoDB has no migrations)
```

## 4. Google Cloud Console
- Enable the **Gmail API**: APIs & Services -> Library -> "Gmail API" -> Enable (same project as your OAuth client).
  Until it is enabled Google answers every Gmail call with `403 accessNotConfigured`; Boot detects that, shows a banner
  on the dashboard with the exact activation link, stops auto-applying, and recovers by itself ("Check again" button or the
  next background run) once the API is on. Nothing is ever recorded as sent while it is off.
- OAuth consent screen scopes: `openid`, `email`, `profile`, `gmail.readonly`, `gmail.send`
  (while in "Testing", add each user's Gmail as a test user).
- Authorized redirect URI: `<NEXTAUTH_URL>/api/auth/callback/google`

## Background processing
`vercel.json` schedules `GET /api/cron/run` once a day at 09:00 UTC (the most frequent schedule Vercel Hobby allows) (Vercel sends `Authorization: Bearer $CRON_SECRET`).
For each user who confirmed their profile it: finds jobs → (optionally) emails applications from that
user's Gmail → reads job-related Gmail → updates interview / assessment / rejection / offer status.

## How Boot applies (and what it will not do)
1. **Discover** — jobs come from real public boards (Remotive, Arbeitnow, RemoteOK). Each posting is classified from its
   *title* (React/Next.js/JavaScript, Flutter, React Native, Node, ...) and kept only if that role matches the keywords/roles
   you confirmed on the Profile page. A Flutter profile never gets React roles and vice versa.
2. **Choose the flow** — postings that name an application address (`send your CV to jobs@...`) are *email* jobs: Boot sends
   from your own Gmail with your CV attached. Greenhouse / Lever / Ashby / Workable / board forms are *external*: those
   submissions need the employer's private API key and are captcha-protected, so Boot links you to the form and lets you
   mark it applied. It never pretends to submit them.
3. **Track** — every attempt is stored in MongoDB. A failed send is saved as failed (with the reason), never as applied.
4. **Monitor Gmail** — only messages in the thread of an email Boot sent, from the company's own domain, or naming the
   company in a real hiring message are saved (interview / assessment / rejection / offer / bounce). Newsletters and
   unrelated mail are ignored. A bounce turns the application into "bounced" and lifts the 7-day cooldown so it can be retried.
