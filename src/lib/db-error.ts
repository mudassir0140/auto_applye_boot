import { NextResponse } from 'next/server'

const CONNECTION_PATTERNS = /Server selection timeout|No available servers|received fatal alert|DNS resolution|Can't reach database|PrismaClientInitializationError|ReplicaSetNoPrimary|timed out|ECONNREFUSED|ENOTFOUND/i
const AUTH_PATTERNS = /Authentication failed|bad auth|SCRAM|not authorized/i

/**
 * Turn a MongoDB/Prisma failure into an API response the UI can show, instead
 * of an opaque 500. Never includes the connection string or credentials.
 */
export function databaseErrorResponse(error: unknown, context: string) {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  console.error(`[${context}]`, text.replace(/mongodb(\+srv)?:\/\/[^\s"']+/g, 'mongodb://***').slice(0, 600))

  if (AUTH_PATTERNS.test(text)) {
    return NextResponse.json(
      { error: 'Database authentication failed', code: 'database_auth', message: 'MongoDB rejected the username or password in DATABASE_URL.' },
      { status: 503 }
    )
  }
  if (CONNECTION_PATTERNS.test(text)) {
    return NextResponse.json(
      {
        error: 'Database unreachable',
        code: 'database_unreachable',
        message:
          'Boot cannot reach MongoDB Atlas. In Atlas > Network Access, allow this machine\'s IP (or 0.0.0.0/0), and check the cluster is not paused.',
      },
      { status: 503 }
    )
  }
  return NextResponse.json({ error: 'Request failed', code: 'internal', message: `Unexpected server error (${context}). Check the server log.` }, { status: 500 })
}
