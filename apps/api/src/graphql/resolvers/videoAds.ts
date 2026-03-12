import { prisma } from '../../services/prisma';
import { requireAuth, requireVerified } from '../../middleware/auth';
import { generateVideoKeywords } from '../../services/openai';
import { searchVideos } from '../../services/pexels';
import {
  createMetaAdCampaign,
  getMetaAdAccounts,
  getMetaPages,
} from '../../services/metaAds';
import type { AuthContext } from '../../middleware/auth';

export const videoAdsResolvers = {
  User: {
    metaConnected: (user: { metaAccessToken?: string | null }) =>
      Boolean(user.metaAccessToken),
  },

  Query: {
    searchVideosForRelease: async (
      _: unknown,
      { releaseId }: { releaseId: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      requireVerified(ctx.user);

      if (ctx.user.plan === 'FREE') {
        throw new Error('Video Ads is a Pro feature. Upgrade to access the video library.');
      }

      const release = await prisma.release.findFirst({
        where: { id: releaseId, userId: ctx.user.id },
      });
      if (!release) throw new Error('Release not found');

      const keywords = await generateVideoKeywords({
        artistName: release.artistName,
        title: release.title,
        genre: release.genre ?? undefined,
        mood: release.mood ?? undefined,
        bpm: release.bpm ?? undefined,
        influences: release.influences ?? undefined,
      });

      const videos = await searchVideos(keywords, 'portrait', 15);
      return videos;
    },

    metaAdAccounts: async (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx.user);
      requireVerified(ctx.user);

      if (ctx.user.plan === 'FREE') {
        throw new Error('Meta Ads is a Pro feature.');
      }

      const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
      if (!user?.metaAccessToken) throw new Error('Meta account not connected.');

      const accounts = await getMetaAdAccounts(user.metaAccessToken);
      return accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }));
    },

    metaPages: async (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx.user);
      requireVerified(ctx.user);

      if (ctx.user.plan === 'FREE') {
        throw new Error('Meta Ads is a Pro feature.');
      }

      const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
      if (!user?.metaAccessToken) throw new Error('Meta account not connected.');

      const pages = await getMetaPages(user.metaAccessToken);
      return pages.map((p) => ({
        id: p.id,
        name: p.name,
        instagramActorId: p.instagram_business_account?.id ?? null,
      }));
    },
  },

  Mutation: {
    saveVideoSelection: async (
      _: unknown,
      { releaseId, videoUrls }: { releaseId: string; videoUrls: string[] },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      requireVerified(ctx.user);

      if (ctx.user.plan === 'FREE') {
        throw new Error('Video Ads is a Pro feature. Upgrade to save video selections.');
      }

      const release = await prisma.release.findFirst({
        where: { id: releaseId, userId: ctx.user.id },
      });
      if (!release) throw new Error('Release not found');

      const campaign = await prisma.videoAdCampaign.upsert({
        where: { releaseId },
        create: {
          releaseId,
          selectedVideoUrls: videoUrls,
          status: 'draft',
        },
        update: {
          selectedVideoUrls: videoUrls,
          status: 'draft',
        },
      });

      return campaign;
    },

    connectMeta: async (
      _: unknown,
      { accessToken, adAccountId }: { accessToken: string; adAccountId: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      requireVerified(ctx.user);

      if (ctx.user.plan === 'FREE') {
        throw new Error('Meta Ads is a Pro feature.');
      }

      return prisma.user.update({
        where: { id: ctx.user.id },
        data: { metaAccessToken: accessToken, metaAdAccountId: adAccountId },
        include: { releases: true },
      });
    },

    disconnectMeta: async (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx.user);

      return prisma.user.update({
        where: { id: ctx.user.id },
        data: { metaAccessToken: null, metaAdAccountId: null },
        include: { releases: true },
      });
    },

    createMetaAdCampaign: async (
      _: unknown,
      args: {
        releaseId: string;
        videoUrl: string;
        pageId: string;
        instagramActorId?: string;
        campaignName: string;
        dailyBudgetCents: number;
        durationDays: number;
        message: string;
      },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      requireVerified(ctx.user);

      if (ctx.user.plan === 'FREE') {
        throw new Error('Meta Ads is a Pro feature.');
      }

      const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
      if (!user?.metaAccessToken || !user?.metaAdAccountId) {
        throw new Error('Connect your Meta account first.');
      }

      const release = await prisma.release.findFirst({
        where: { id: args.releaseId, userId: ctx.user.id },
      });
      if (!release) throw new Error('Release not found');

      const result = await createMetaAdCampaign({
        accessToken: user.metaAccessToken,
        adAccountId: user.metaAdAccountId,
        campaignName: args.campaignName,
        dailyBudgetCents: args.dailyBudgetCents,
        durationDays: args.durationDays,
        videoUrl: args.videoUrl,
        imageUrl: release.coverUrl ?? undefined,
        message: args.message,
        pageId: args.pageId,
        instagramActorId: args.instagramActorId,
      });

      // Persist campaign ID on the VideoAdCampaign record
      await prisma.videoAdCampaign.upsert({
        where: { releaseId: args.releaseId },
        create: {
          releaseId: args.releaseId,
          selectedVideoUrls: [args.videoUrl],
          metaCampaignId: result.campaignId,
          status: 'launched',
        },
        update: {
          metaCampaignId: result.campaignId,
          status: 'launched',
        },
      });

      return result;
    },
  },
};
