import { prisma } from '../../services/prisma';
import { requireAuth } from '../../middleware/auth';
import type { AuthContext } from '../../middleware/auth';

export const userResolvers = {
  Query: {
    me: async (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx.user);
      return prisma.user.findUniqueOrThrow({
        where: { id: ctx.user.id },
        include: { releases: { orderBy: { createdAt: 'desc' } } },
      });
    },
  },
};
