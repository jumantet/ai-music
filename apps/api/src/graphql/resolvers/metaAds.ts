import { prisma } from '../../services/prisma';
import { requireAuth, requireVerified } from '../../middleware/auth';
import {
  createMetaAdCampaign,
  getMetaAdAccounts,
  getMetaPages,
} from '../../services/metaAds';
import type { AuthContext } from '../../middleware/auth';

export const metaAdsResolvers = {
  Query: {
    metaAdAccounts: async (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx.user);
      requireVerified(ctx.user);

      const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
      if (!user?.metaAccessToken) throw new Error('Meta account not connected.');

      const accounts = await getMetaAdAccounts(user.metaAccessToken);
      return accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }));
    },

    metaPages: async (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx.user);
      requireVerified(ctx.user);

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
    connectMeta: async (
      _: unknown,
      { accessToken, adAccountId }: { accessToken: string; adAccountId: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      requireVerified(ctx.user);

      return prisma.user.update({
        where: { id: ctx.user.id },
        data: { metaAccessToken: accessToken, metaAdAccountId: adAccountId },
        include: { campaigns: { include: { generatedAds: true } } },
      });
    },

    disconnectMeta: async (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx.user);

      return prisma.user.update({
        where: { id: ctx.user.id },
        data: { metaAccessToken: null, metaAdAccountId: null },
        include: { campaigns: { include: { generatedAds: true } } },
      });
    },

    launchMetaAd: async (
      _: unknown,
      args: {
        campaignId: string;
        adId: string;
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

      const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
      if (!user?.metaAccessToken || !user?.metaAdAccountId) {
        throw new Error('Connect your Meta account first.');
      }

      const campaign = await prisma.campaign.findFirst({
        where: { id: args.campaignId, userId: ctx.user.id },
        include: { generatedAds: true },
      });
      if (!campaign) throw new Error('Campaign not found');

      const ad = campaign.generatedAds.find((a) => a.id === args.adId);
      if (!ad) throw new Error('Ad not found');
      if (!ad.videoUrl) throw new Error('Ad video not yet rendered');

      const result = await createMetaAdCampaign({
        accessToken: user.metaAccessToken,
        adAccountId: user.metaAdAccountId,
        campaignName: args.campaignName,
        dailyBudgetCents: args.dailyBudgetCents,
        durationDays: args.durationDays,
        videoUrl: ad.videoUrl,
        message: args.message,
        pageId: args.pageId,
        instagramActorId: args.instagramActorId,
      });

      await prisma.campaign.update({
        where: { id: args.campaignId },
        data: { metaCampaignId: result.campaignId, status: 'LAUNCHED' },
      });
      await prisma.generatedAd.update({
        where: { id: args.adId },
        data: { metaAdId: result.adId },
      });

      return result;
    },
  },
};
