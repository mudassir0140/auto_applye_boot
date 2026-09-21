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
- Enable the **Gmail API**.
- OAuth consent screen scopes: `openid`, `email`, `profile`, `gmail.readonly`, `gmail.send`
  (while in "Testing", add each user's Gmail as a test user).
- Authorized redirect URI: `<NEXTAUTH_URL>/api/auth/callback/google`

## Background processing
`vercel.json` schedules `GET /api/cron/run` once a day at 09:00 UTC (the most frequent schedule Vercel Hobby allows) (Vercel sends `Authorization: Bearer $CRON_SECRET`).
For each user who confirmed their profile it: finds jobs → (optionally) emails applications from that
user's Gmail → reads job-related Gmail → updates interview / assessment / rejection / offer status.
