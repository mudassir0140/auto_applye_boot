import { prisma } from './prisma'

/**
 * Drop the stored Google tokens but keep the Account row, so the user stays
 * logged in and signing in with Google again re-links to the same Boot user.
 */
export async function disconnectGmail(userId: string) {
  await prisma.account.updateMany({
    where: { userId, provider: 'google' },
    data: { access_token: null, refresh_token: null, expires_at: null, disconnectedAt: new Date() },
  })
}
