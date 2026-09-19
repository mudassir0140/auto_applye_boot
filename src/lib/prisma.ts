import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? [
          {
            emit: 'stdout',
            level: 'query',
          },
          {
            emit: 'stdout',
            level: 'error',
          },
          {
            emit: 'stdout',
            level: 'warn',
          },
        ]
      : [],
    errorFormat: 'pretty',
  })

// Add connection error logging using process instead of prisma.$on
// beforeExit hook is not applicable to library engine in Prisma 5.0.0
if (process.env.NODE_ENV === 'development') {
  process.on('beforeExit', async () => {
    console.log('\n📊 Prisma: Client disconnecting')
  })
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
