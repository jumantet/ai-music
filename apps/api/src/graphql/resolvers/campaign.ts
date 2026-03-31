import { GraphQLError } from 'graphql';
import { prisma } from '../../services/prisma';
import { requireAuth } from '../../middleware/auth';
import { getPresignedUploadUrl, getPublicUrl } from '../../services/storage';
import { suggestHooks, detectMood } from '../../services/hookFinder';
import { generateAdVariants } from '../../services/adGenerator';
import { searchVideos } from '../../services/pexels';
import type { AuthContext } from '../../middleware/auth';
import { Prisma } from '@prisma/client';

const MOOD_KEYWORDS: Record<string, string[]> = {
  dreamy: ['cinematic moody soft light', 'rain window bokeh', 'hazy golden hour nature'],
  night_drive: ['city night lights cinematic', 'neon street rain moody', 'empty highway night'],
  indie: ['analog film grain aesthetic', 'lo-fi urban calm', 'bedroom warm light desk'],
  psychedelic: ['abstract soft light motion', 'prism light subtle', 'dreamy blur colors'],
  vintage: ['super 8 film vintage texture', 'retro analog footage', 'tape degradation aesthetic'],
  urban: ['minimal architecture night', 'urban calm empty street', 'subway soft motion'],
};

const LOFI_STOCK_HINTS = [
  'cinematic moody soft light',
  'slow motion atmospheric nature',
  'night city subtle neon',
];

function serializeEditorSettings(raw: Prisma.JsonValue | null | undefined) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/** Accès lecture / écriture : propriétaire OU brouillon session correspondante. */
function accessWhere(
  id: string,
  ctx: AuthContext
): Prisma.CampaignWhereInput {
  const or: Prisma.CampaignWhereInput[] = [];
  if (ctx.user?.id) {
    or.push({ id, userId: ctx.user.id });
  }
  if (ctx.draftSessionId) {
    or.push({ id, sessionId: ctx.draftSessionId });
  }
  return { OR: or };
}

async function findAccessibleCampaign(
  id: string,
  ctx: AuthContext,
  include: Prisma.CampaignInclude = {}
) {
  return prisma.campaign.findFirst({
    where: accessWhere(id, ctx),
    include,
  });
}

export const campaignResolvers = {
  Query: {
    campaign: async (_: unknown, { id }: { id: string }, ctx: AuthContext) => {
      const campaign = await findAccessibleCampaign(id, ctx, { generatedAd: true });
      if (!campaign) throw new Error('Campaign not found');
      return { ...campaign, editorSettings: serializeEditorSettings(campaign.editorSettings) };
    },

    campaigns: async (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx.user);
      const campaigns = await prisma.campaign.findMany({
        where: { userId: ctx.user.id },
        include: { generatedAd: true },
        orderBy: { createdAt: 'desc' },
      });
      return campaigns.map((c) => ({
        ...c,
        editorSettings: serializeEditorSettings(c.editorSettings),
      }));
    },

    suggestHooks: async (
      _: unknown,
      {
        campaignId,
        audioDurationSec,
        audioEnergyEnvelope,
      }: {
        campaignId: string;
        audioDurationSec?: number | null;
        audioEnergyEnvelope?: number[] | null;
      },
      ctx: AuthContext
    ) => {
      const campaign = await findAccessibleCampaign(campaignId, ctx);
      if (!campaign) throw new Error('Campaign not found');
      return suggestHooks(
        campaign.trackS3Key ?? null,
        campaign.trackTitle,
        campaign.artistName,
        {
          durationSec: audioDurationSec ?? undefined,
          audioEnergyEnvelope: audioEnergyEnvelope ?? undefined,
        }
      );
    },

    suggestMood: async (
      _: unknown,
      {
        campaignId,
        audioDurationSec,
        audioEnergyEnvelope,
      }: {
        campaignId: string;
        audioDurationSec?: number | null;
        audioEnergyEnvelope?: number[] | null;
      },
      ctx: AuthContext
    ) => {
      const campaign = await findAccessibleCampaign(campaignId, ctx);
      if (!campaign) throw new Error('Campaign not found');
      return detectMood(campaign.trackTitle, campaign.artistName, {
        durationSec: audioDurationSec ?? undefined,
        audioEnergyEnvelope: audioEnergyEnvelope ?? undefined,
      });
    },

    searchVideosForMood: async (
      _: unknown,
      {
        mood,
        page = 1,
        keywords: customKeywords,
      }: { mood: string; page?: number; keywords?: string[] }
    ) => {
      const keywords = customKeywords?.length
        ? customKeywords
        : (MOOD_KEYWORDS[mood] ?? LOFI_STOCK_HINTS);
      return searchVideos(keywords, 'portrait', 9, page);
    },

    searchPexelsVideos: async (
      _: unknown,
      { query, page = 1 }: { query: string; page?: number }
    ) => {
      const q = query.trim().slice(0, 200);
      if (!q) {
        return { videos: [], totalResults: 0, page, perPage: 9 };
      }
      return searchVideos([q], 'portrait', 9, page);
    },
  },

  Mutation: {
    createCampaign: async (
      _: unknown,
      {
        trackTitle,
        artistName,
        spotifyTrackId,
      }: { trackTitle: string; artistName: string; spotifyTrackId?: string | null },
      ctx: AuthContext
    ) => {
      if (!ctx.user && !ctx.draftSessionId) {
        throw new Error('Sign in or send x-session-id header to start a draft');
      }

      const campaign = await prisma.campaign.create({
        data: {
          trackTitle,
          artistName,
          ...(spotifyTrackId?.trim() ? { spotifyTrackId: spotifyTrackId.trim() } : {}),
          userId: ctx.user ? ctx.user.id : null,
          sessionId: ctx.user ? null : ctx.draftSessionId!,
        },
        include: { generatedAd: true },
      });
      return { ...campaign, editorSettings: null };
    },

    updateCampaign: async (
      _: unknown,
      args: {
        id: string;
        hookStart?: number;
        hookEnd?: number;
        trackS3Key?: string;
        spotifyTrackId?: string | null;
        videoS3Key?: string;
        videoUrl?: string;
        editorSettings?: Record<string, unknown> | null;
      },
      ctx: AuthContext
    ) => {
      const { id, ...data } = args;
      const campaign = await findAccessibleCampaign(id, ctx);
      if (!campaign) throw new Error('Campaign not found');

      const updateData: Prisma.CampaignUpdateInput = {};
      if (data.hookStart !== undefined) updateData.hookStart = data.hookStart;
      if (data.hookEnd !== undefined) updateData.hookEnd = data.hookEnd;
      if (data.trackS3Key !== undefined) {
        updateData.trackS3Key = data.trackS3Key;
        updateData.trackUrl = getPublicUrl(data.trackS3Key);
      }
      if (data.spotifyTrackId !== undefined) {
        updateData.spotifyTrackId =
          data.spotifyTrackId === null || data.spotifyTrackId === ''
            ? null
            : data.spotifyTrackId.trim();
      }
      if (data.videoS3Key !== undefined) {
        updateData.videoS3Key = data.videoS3Key;
        updateData.videoUrl = getPublicUrl(data.videoS3Key);
      }
      if (data.videoUrl !== undefined && data.videoS3Key === undefined) {
        updateData.videoUrl = data.videoUrl;
        updateData.videoS3Key = null;
      }
      if (data.editorSettings !== undefined) {
        updateData.editorSettings =
          data.editorSettings === null
            ? Prisma.JsonNull
            : (data.editorSettings as Prisma.InputJsonValue);
      }

      const updated = await prisma.campaign.update({
        where: { id },
        data: updateData,
        include: { generatedAd: true },
      });
      return { ...updated, editorSettings: serializeEditorSettings(updated.editorSettings) };
    },

    deleteCampaign: async (_: unknown, { id }: { id: string }, ctx: AuthContext) => {
      const campaign = await findAccessibleCampaign(id, ctx);
      if (!campaign) throw new Error('Campaign not found');
      await prisma.campaign.delete({ where: { id } });
      return true;
    },

    generateAds: async (
      _: unknown,
      { campaignId }: { campaignId: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);

      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId },
        include: { generatedAd: true },
      });
      if (!campaign) throw new Error('Campaign not found');

      const canClaim =
        campaign.userId === ctx.user.id ||
        (!campaign.userId &&
          campaign.sessionId &&
          ctx.draftSessionId &&
          campaign.sessionId === ctx.draftSessionId);

      if (!canClaim) {
        throw new Error('Campaign not found or session mismatch');
      }

      if (!campaign.trackS3Key?.trim()) {
        throw new Error(
          'Upload your track audio file before generating. Streaming links only provide title and artwork.'
        );
      }

      const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
      if (user.videoCredits < 1) {
        throw new GraphQLError('Not enough video credits. Purchase a pack to continue.', {
          extensions: { code: 'INSUFFICIENT_CREDITS' },
        });
      }

      await prisma.$transaction([
        prisma.campaign.update({
          where: { id: campaignId },
          data: {
            userId: ctx.user.id,
            sessionId: null,
            status: 'GENERATING',
          },
        }),
        prisma.user.update({
          where: { id: ctx.user.id },
          data: { videoCredits: { decrement: 1 } },
        }),
      ]);

      const hookStart = campaign.hookStart ?? 0;
      const hookEnd = campaign.hookEnd ?? Math.min(30, hookStart + 30);
      const editorSettings = serializeEditorSettings(campaign.editorSettings) ?? {};

      let videoUrl = campaign.videoUrl ?? null;
      if (!videoUrl) {
        try {
          const result = await searchVideos(LOFI_STOCK_HINTS, 'portrait', 1, 1);
          videoUrl = result.videos[0]?.previewUrl ?? null;
        } catch {
          /* */
        }
      }

      let result: { videoS3Key: string; videoUrl: string } = { videoS3Key: '', videoUrl: '' };
      try {
        const variants = await generateAdVariants({
          campaignId,
          trackS3Key: campaign.trackS3Key ?? null,
          hookStart,
          hookEnd,
          videoUrl,
          videoS3Key: campaign.videoS3Key ?? null,
          artistName: campaign.artistName,
          trackTitle: campaign.trackTitle,
          editorSettings,
        });
        result = variants[0] ?? result;
      } catch (e) {
        console.error('[generateAds]', e);
        await prisma.user.update({
          where: { id: ctx.user.id },
          data: { videoCredits: { increment: 1 } },
        });
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'DRAFT' },
        });
        throw e;
      }

      const finalVideoUrl =
        (result.videoUrl && result.videoUrl.trim()) ||
        (campaign.videoUrl?.trim() ?? '') ||
        (videoUrl?.trim() ?? '') ||
        null;
      const finalS3Key = (result.videoS3Key && result.videoS3Key.trim()) || null;

      await prisma.generatedAd.upsert({
        where: { campaignId },
        create: {
          campaignId,
          videoS3Key: finalS3Key,
          videoUrl: finalVideoUrl,
        },
        update: {
          videoS3Key: finalS3Key,
          videoUrl: finalVideoUrl,
          metaAdId: null,
        },
      });

      const updated = await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'READY' },
        include: { generatedAd: true },
      });
      return { ...updated, editorSettings: serializeEditorSettings(updated.editorSettings) };
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
      const campaign = await findAccessibleCampaign(campaignId, ctx);
      if (!campaign) throw new Error('Campaign not found');

      const ext = contentType.split('/')[1] ?? 'bin';
      const key = `campaigns/${campaignId}/${fileType}-${Date.now()}.${ext}`;
      const uploadUrl = await getPresignedUploadUrl(key, contentType);
      const fileUrl = getPublicUrl(key);
      return { uploadUrl, fileUrl, key };
    },
  },
};
