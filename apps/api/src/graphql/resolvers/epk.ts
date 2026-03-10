import { prisma } from '../../services/prisma';
import { requireAuth, requireVerified } from '../../middleware/auth';
import { generateEPKContent } from '../../services/openai';
import { generatePressKit as buildPressKit } from '../../services/pressKit';
import type { AuthContext } from '../../middleware/auth';

function slugify(artistName: string, title: string): string {
  const base = `${artistName}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  return `${base}-${Date.now().toString(36)}`;
}

export const epkResolvers = {
  Query: {
    epkPage: async (_: unknown, { slug }: { slug: string }) => {
      return prisma.ePKPage.findFirst({
        where: { slug, isPublished: true },
        include: { release: true },
      });
    },
  },

  Mutation: {
    generateEPK: async (_: unknown, { releaseId }: { releaseId: string }, ctx: AuthContext) => {
      requireAuth(ctx.user);
      requireVerified(ctx.user);

      const release = await prisma.release.findFirst({
        where: { id: releaseId, userId: ctx.user.id },
      });
      if (!release) throw new Error('Release not found');

      const content = await generateEPKContent({
        artistName: release.artistName,
        title: release.title,
        genre: release.genre ?? undefined,
        mood: release.mood ?? undefined,
        bpm: release.bpm ?? undefined,
        city: release.city ?? undefined,
        influences: release.influences ?? undefined,
        shortBio: release.shortBio ?? undefined,
      });

      const existing = await prisma.ePKPage.findUnique({ where: { releaseId } });

      if (existing) {
        return prisma.ePKPage.update({
          where: { releaseId },
          data: {
            bio: content.bio,
            pressPitch: content.pressPitch,
            shortBio: content.shortBio,
            releaseDescription: content.releaseDescription,
          },
          include: { release: true },
        });
      }

      const slug = slugify(release.artistName, release.title);
      return prisma.ePKPage.create({
        data: {
          releaseId,
          slug,
          bio: content.bio,
          pressPitch: content.pressPitch,
          shortBio: content.shortBio,
          releaseDescription: content.releaseDescription,
        },
        include: { release: true },
      });
    },

    updateEPKPage: async (
      _: unknown,
      {
        releaseId,
        bio,
        pressPitch,
        shortBio,
        releaseDescription,
      }: {
        releaseId: string;
        bio?: string;
        pressPitch?: string;
        shortBio?: string;
        releaseDescription?: string;
      },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);

      const release = await prisma.release.findFirst({
        where: { id: releaseId, userId: ctx.user.id },
      });
      if (!release) throw new Error('Release not found');

      return prisma.ePKPage.update({
        where: { releaseId },
        data: {
          ...(bio !== undefined && { bio }),
          ...(pressPitch !== undefined && { pressPitch }),
          ...(shortBio !== undefined && { shortBio }),
          ...(releaseDescription !== undefined && { releaseDescription }),
        },
        include: { release: true },
      });
    },

    publishEPKPage: async (
      _: unknown,
      { releaseId }: { releaseId: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      const release = await prisma.release.findFirst({
        where: { id: releaseId, userId: ctx.user.id },
      });
      if (!release) throw new Error('Release not found');

      const epk = await prisma.ePKPage.findUnique({ where: { releaseId } });
      if (!epk) throw new Error('Generate EPK first');

      return prisma.ePKPage.update({
        where: { releaseId },
        data: { isPublished: true },
        include: { release: true },
      });
    },

    unpublishEPKPage: async (
      _: unknown,
      { releaseId }: { releaseId: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      const release = await prisma.release.findFirst({
        where: { id: releaseId, userId: ctx.user.id },
      });
      if (!release) throw new Error('Release not found');

      return prisma.ePKPage.update({
        where: { releaseId },
        data: { isPublished: false },
        include: { release: true },
      });
    },

    generatePressKit: async (
      _: unknown,
      { releaseId }: { releaseId: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);

      const release = await prisma.release.findFirst({
        where: { id: releaseId, userId: ctx.user.id },
      });
      if (!release) throw new Error('Release not found');

      const zipUrl = await buildPressKit(releaseId);

      const existing = await prisma.pressKit.findUnique({ where: { releaseId } });
      if (existing) {
        return prisma.pressKit.update({
          where: { releaseId },
          data: { zipUrl, generatedAt: new Date() },
        });
      }

      return prisma.pressKit.create({
        data: { releaseId, zipUrl },
      });
    },
  },
};
