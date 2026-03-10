import { prisma } from '../../services/prisma';
import { requireAuth, requireVerified } from '../../middleware/auth';
import { getPresignedUploadUrl, getPublicUrl } from '../../services/storage';
import type { AuthContext } from '../../middleware/auth';

interface CreateReleaseInput {
  title: string;
  artistName: string;
  genre?: string;
  mood?: string;
  bpm?: number;
  city?: string;
  influences?: string;
  shortBio?: string;
}

interface UpdateReleaseInput {
  title?: string;
  artistName?: string;
  genre?: string;
  mood?: string;
  bpm?: number;
  city?: string;
  influences?: string;
  shortBio?: string;
}

export const releaseResolvers = {
  Query: {
    release: async (_: unknown, { id }: { id: string }, ctx: AuthContext) => {
      requireAuth(ctx.user);
      const release = await prisma.release.findFirst({
        where: { id, userId: ctx.user.id },
        include: { epkPage: true, pressKit: true },
      });
      if (!release) throw new Error('Release not found');
      return release;
    },

    releases: async (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx.user);
      return prisma.release.findMany({
        where: { userId: ctx.user.id },
        include: { epkPage: true, pressKit: true },
        orderBy: { createdAt: 'desc' },
      });
    },
  },

  Mutation: {
    createRelease: async (
      _: unknown,
      { input }: { input: CreateReleaseInput },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      requireVerified(ctx.user);

      if (ctx.user.plan === 'FREE') {
        const count = await prisma.release.count({ where: { userId: ctx.user.id } });
        if (count >= 1) {
          throw new Error('Free plan is limited to 1 release. Upgrade to Pro for unlimited releases.');
        }
      }

      return prisma.release.create({
        data: { ...input, userId: ctx.user.id },
        include: { epkPage: true, pressKit: true },
      });
    },

    updateRelease: async (
      _: unknown,
      { id, input }: { id: string; input: UpdateReleaseInput },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      const release = await prisma.release.findFirst({
        where: { id, userId: ctx.user.id },
      });
      if (!release) throw new Error('Release not found');

      return prisma.release.update({
        where: { id },
        data: input,
        include: { epkPage: true, pressKit: true },
      });
    },

    deleteRelease: async (_: unknown, { id }: { id: string }, ctx: AuthContext) => {
      requireAuth(ctx.user);
      const release = await prisma.release.findFirst({
        where: { id, userId: ctx.user.id },
      });
      if (!release) throw new Error('Release not found');
      await prisma.release.delete({ where: { id } });
      return true;
    },

    setReleaseCover: async (
      _: unknown,
      { releaseId, fileUrl }: { releaseId: string; fileUrl: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      const release = await prisma.release.findFirst({
        where: { id: releaseId, userId: ctx.user.id },
      });
      if (!release) throw new Error('Release not found');

      return prisma.release.update({
        where: { id: releaseId },
        data: { coverUrl: fileUrl },
        include: { epkPage: true, pressKit: true },
      });
    },

    setReleaseTrack: async (
      _: unknown,
      {
        releaseId,
        fileUrl,
        bpm,
        genre,
        mood,
      }: { releaseId: string; fileUrl: string; bpm?: number; genre?: string; mood?: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      const release = await prisma.release.findFirst({
        where: { id: releaseId, userId: ctx.user.id },
      });
      if (!release) throw new Error('Release not found');

      return prisma.release.update({
        where: { id: releaseId },
        data: {
          trackUrl: fileUrl,
          ...(bpm !== undefined && { bpm }),
          ...(genre && { genre }),
          ...(mood && { mood }),
        },
        include: { epkPage: true, pressKit: true },
      });
    },

    getUploadUrl: async (
      _: unknown,
      {
        releaseId,
        fileType,
        contentType,
      }: { releaseId: string; fileType: string; contentType: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      const release = await prisma.release.findFirst({
        where: { id: releaseId, userId: ctx.user.id },
      });
      if (!release) throw new Error('Release not found');

      const ext = contentType.split('/')[1] ?? 'bin';
      const key = `releases/${releaseId}/${fileType}-${Date.now()}.${ext}`;
      const uploadUrl = await getPresignedUploadUrl(key, contentType);
      const fileUrl = getPublicUrl(key);

      return { uploadUrl, fileUrl, key };
    },
  },
};
