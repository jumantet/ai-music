import { prisma } from '../../services/prisma';
import { requireAuth } from '../../middleware/auth';
import type { AuthContext } from '../../middleware/auth';

export const userResolvers = {
  User: {
    metaConnected: (user: { metaAccessToken?: string | null }) =>
      Boolean(user.metaAccessToken),
  },

  Query: {
    me: async (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx.user);
      return prisma.user.findUniqueOrThrow({
        where: { id: ctx.user.id },
        include: {
          campaigns: {
            orderBy: { createdAt: 'desc' },
            include: { generatedAds: true },
          },
        },
      });
    },
  },
};
