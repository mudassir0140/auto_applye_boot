import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as {
  prisma: PrismaClient
  prismaExitHookRegistered: boolean
}

// The schema is MongoDB. A leftover SQLite value ("file:./dev.db") makes every
// PrismaAdapter call fail inside /api/auth/callback/google, which NextAuth reports
// only as the opaque "?error=Callback". Say what is actually wrong, in the terminal.
const databaseUrl = process.env.DATABASE_URL || ''
const isMongoUrl = databaseUrl.startsWith('mongodb://') || databaseUrl.startsWith('mongodb+srv://')
if (process.env.NEXT_PHASE !== 'phase-production-build' && !isMongoUrl) {
  console.error(
    [
      '',
      `[boot] DATABASE_URL is not a MongoDB connection string (protocol "${databaseUrl.split(':')[0]}").`,
      '[boot] Google sign-in will fail with ?error=Callback until DATABASE_URL in .env.local is your',
      '[boot] MongoDB Atlas URL (mongodb+srv://.../boot?retryWrites=true&w=majority). See MONGODB_SETUP.md.',
      '',
    ].join(String.fromCharCode(10))
  )
}

// Fail fast (instead of Prisma's 30s default) when Atlas is unreachable, so the
// dashboard can show the real error quickly.
function withTimeouts(url: string) {
  if (!isMongoUrl || /serverSelectionTimeoutMS=/i.test(url)) return url
  return url + (url.includes('?') ? '&' : '?') + 'serverSelectionTimeoutMS=10000&connectTimeoutMS=10000'
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    ...(isMongoUrl ? { datasources: { db: { url: withTimeouts(databaseUrl) } } } : {}),
    log: process.env.NODE_ENV === 'development'
      ? [
          { emit: 'stdout', level: 'query' },
          { emit: 'stdout', level: 'error' },
          { emit: 'stdout', level: 'warn' },
        ]
      : [],
    errorFormat: 'pretty',
  })

// Next.js dev mode re-evaluates this module on every hot-reload. Without this
// guard, `process.on('beforeExit', ...)` below would register a new listener
// each time, eventually tripping Node's MaxListenersExceededWarning.
if (process.env.NODE_ENV === 'development' && !globalForPrisma.prismaExitHookRegistered) {
  process.on('beforeExit', () => {
    console.log('Prisma: process exiting, client disconnecting')
  })
  globalForPrisma.prismaExitHookRegistered = true
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
