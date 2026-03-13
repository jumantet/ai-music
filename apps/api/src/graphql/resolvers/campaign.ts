import { prisma } from '../../services/prisma';
import { requireAuth, requireVerified } from '../../middleware/auth';
import { getPresignedUploadUrl, getPublicUrl } from '../../services/storage';
import { suggestHooks } from '../../services/hookFinder';
import { generateAdVariants } from '../../services/adGenerator';
import { searchVideos } from '../../services/pexels';
import type { AuthContext } from '../../middleware/auth';

const MOOD_KEYWORDS: Record<string, string[]> = {
  dreamy: ['dreamy blur', 'soft light nature', 'hazy golden hour'],
  night_drive: ['city night lights', 'driving highway night', 'neon street'],
  indie: ['grain film aesthetic', 'indie rooftop sunset', 'lo-fi urban'],
  psychedelic: ['abstract colorful motion', 'psychedelic prism light', 'trippy visuals'],
  vintage: ['super 8 film vintage', 'retro old footage', 'analog grain'],
  urban: ['city street motion', 'urban skyscraper timelapse', 'metro crowd'],
};

export const campaignResolvers = {
  Query: {
    campaign: async (_: unknown, { id }: { id: string }, ctx: AuthContext) => {
      requireAuth(ctx.user);
      const campaign = await prisma.campaign.findFirst({
        where: { id, userId: ctx.user.id },
        include: { generatedAds: { orderBy: { createdAt: 'asc' } } },
      });
      if (!campaign) throw new Error('Campaign not found');
      return campaign;
    },

    campaigns: async (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx.user);
      return prisma.campaign.findMany({
        where: { userId: ctx.user.id },
        include: { generatedAds: true },
        orderBy: { createdAt: 'desc' },
      });
    },

    suggestHooks: async (
      _: unknown,
      { campaignId }: { campaignId: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, userId: ctx.user.id },
      });
      if (!campaign) throw new Error('Campaign not found');

      return suggestHooks(
        campaign.trackS3Key ?? null,
        campaign.trackTitle,
        campaign.artistName
      );
    },

    searchVideosForMood: async (
      _: unknown,
      { mood }: { mood: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      requireVerified(ctx.user);

      const keywords = MOOD_KEYWORDS[mood] ?? ['music visual aesthetic', 'abstract motion', 'cinematic blur'];
      return searchVideos(keywords, 'portrait', 12);
    },
  },

  Mutation: {
    createCampaign: async (
      _: unknown,
      { trackTitle, artistName }: { trackTitle: string; artistName: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      requireVerified(ctx.user);

      return prisma.campaign.create({
        data: { trackTitle, artistName, userId: ctx.user.id },
        include: { generatedAds: true },
      });
    },

    updateCampaign: async (
      _: unknown,
      args: {
        id: string;
        hookStart?: number;
        hookEnd?: number;
        mood?: string;
        trackS3Key?: string;
      },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      const { id, ...data } = args;
      const campaign = await prisma.campaign.findFirst({
        where: { id, userId: ctx.user.id },
      });
      if (!campaign) throw new Error('Campaign not found');

      const updateData: Record<string, unknown> = {};
      if (data.hookStart !== undefined) updateData.hookStart = data.hookStart;
      if (data.hookEnd !== undefined) updateData.hookEnd = data.hookEnd;
      if (data.mood !== undefined) updateData.mood = data.mood;
      if (data.trackS3Key !== undefined) {
        updateData.trackS3Key = data.trackS3Key;
        updateData.trackUrl = getPublicUrl(data.trackS3Key);
      }

      return prisma.campaign.update({
        where: { id },
        data: updateData,
        include: { generatedAds: true },
      });
    },

    deleteCampaign: async (_: unknown, { id }: { id: string }, ctx: AuthContext) => {
      requireAuth(ctx.user);
      const campaign = await prisma.campaign.findFirst({
        where: { id, userId: ctx.user.id },
      });
      if (!campaign) throw new Error('Campaign not found');
      await prisma.campaign.delete({ where: { id } });
      return true;
    },

    generateAds: async (_: unknown, { campaignId }: { campaignId: string }, ctx: AuthContext) => {
      requireAuth(ctx.user);
      requireVerified(ctx.user);

      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, userId: ctx.user.id },
        include: { generatedAds: true },
      });
      if (!campaign) throw new Error('Campaign not found');

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'GENERATING' },
      });

      const mood = campaign.mood ?? 'dreamy';
      const keywords = MOOD_KEYWORDS[mood] ?? ['music visual aesthetic'];
      let videoUrls: string[] = [];

      try {
        const videos = await searchVideos(keywords, 'portrait', 8);
        videoUrls = videos.map((v) => v.previewUrl);
      } catch {
        // Continue without Pexels videos
      }

      const hookStart = campaign.hookStart ?? 60;
      const hookEnd = campaign.hookEnd ?? 75;

      let variants: Array<{ visualStyle: string; textOverlay: string; videoS3Key: string; videoUrl: string }> = [];

      try {
        variants = await generateAdVariants({
          campaignId,
          trackS3Key: campaign.trackS3Key ?? null,
          hookStart,
          hookEnd,
          mood,
          videoUrls,
          artistName: campaign.artistName,
          trackTitle: campaign.trackTitle,
        });
      } catch {
        // Fallback: create stub ads without video rendering
        const FALLBACK_STYLES = [
          { style: 'Night Drive', text: 'Out now' },
          { style: 'Abstract Motion', text: 'Listen now' },
          { style: 'Vintage Footage', text: 'Stream now' },
          { style: 'City Lights', text: 'New track' },
        ];
        variants = FALLBACK_STYLES.map((s) => ({
          visualStyle: s.style,
          textOverlay: s.text,
          videoS3Key: '',
          videoUrl: '',
        }));
      }

      // Persist generated ads
      await prisma.generatedAd.deleteMany({ where: { campaignId } });
      await prisma.generatedAd.createMany({
        data: variants.map((v) => ({
          campaignId,
          visualStyle: v.visualStyle,
          textOverlay: v.textOverlay,
          videoS3Key: v.videoS3Key || null,
          videoUrl: v.videoUrl || null,
        })),
      });

      return prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'READY' },
        include: { generatedAds: { orderBy: { createdAt: 'asc' } } },
      });
    },

    getUploadUrl: async (
      _: unknown,
      {
        campaignId,
        fileType,
        contentType,
      }: { campaignId: string; fileType: string; contentType: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, userId: ctx.user.id },
      });
      if (!campaign) throw new Error('Campaign not found');

      const ext = contentType.split('/')[1] ?? 'bin';
      const key = `campaigns/${campaignId}/${fileType}-${Date.now()}.${ext}`;
      const uploadUrl = await getPresignedUploadUrl(key, contentType);
      const fileUrl = getPublicUrl(key);

      return { uploadUrl, fileUrl, key };
    },
  },
};
