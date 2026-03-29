import { prisma } from '@/lib/db';

function buildPlaceholderEmail(authUserId: string): string {
  return `${Buffer.from(authUserId).toString('hex')}@a2r.local`;
}

export async function resolvePlatformUserId(authUserId: string): Promise<string> {
  const user = await prisma.user.upsert({
    where: { clerkId: authUserId },
    update: {},
    create: {
      clerkId: authUserId,
      email: buildPlaceholderEmail(authUserId),
      name: authUserId === 'local-user' ? 'Local User' : null,
    },
    select: {
      id: true,
    },
  });

  return user.id;
}
