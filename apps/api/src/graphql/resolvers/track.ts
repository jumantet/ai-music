import { prisma } from '../../services/prisma';
import { requireAuth, requireVerified } from '../../middleware/auth';
import { syncUserCatalogTracks } from '../../services/catalogSync';
import type { AuthContext } from '../../middleware/auth';

export const trackResolvers = {
  Query: {
    myCatalogTracks: async (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx.user);
      requireVerified(ctx.user);
      return prisma.track.findMany({
        where: { userId: ctx.user.id },
        orderBy: { name: 'asc' },
      });
    },
  },

  Mutation: {
    syncMyCatalogTracks: async (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx.user);
      requireVerified(ctx.user);
      return syncUserCatalogTracks(ctx.user.id);
    },
  },
};
