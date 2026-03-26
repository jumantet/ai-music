import { prisma } from '../../services/prisma';
import { requireAuth } from '../../middleware/auth';
import { syncUserCatalogTracks } from '../../services/catalogSync';
import type { AuthContext } from '../../middleware/auth';

const userWithCampaigns = {
  campaigns: {
    orderBy: { createdAt: 'desc' as const },
    include: { generatedAd: true as const },
  },
} as const;

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
        include: userWithCampaigns,
      });
    },
  },

  Mutation: {
    linkSpotifyArtist: async (
      _: unknown,
      {
        spotifyArtistId,
        spotifyArtistName,
      }: { spotifyArtistId: string; spotifyArtistName: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      const sid = spotifyArtistId.trim();
      const sname = spotifyArtistName.trim();
      if (!sid || !sname) {
        throw new Error('Artist id and name are required');
      }
      const user = await prisma.user.update({
        where: { id: ctx.user.id },
        data: { spotifyArtistId: sid, spotifyArtistName: sname },
        include: userWithCampaigns,
      });
      try {
        await syncUserCatalogTracks(ctx.user.id);
      } catch (err) {
        console.error('[catalog] sync after linkSpotifyArtist failed', err);
      }
      return user;
    },

    unlinkSpotifyArtist: async (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx.user);
      await prisma.track.deleteMany({ where: { userId: ctx.user.id } });
      return prisma.user.update({
        where: { id: ctx.user.id },
        data: { spotifyArtistId: null, spotifyArtistName: null },
        include: userWithCampaigns,
      });
    },
  },
};
