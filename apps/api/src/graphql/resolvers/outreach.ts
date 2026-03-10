import { prisma } from '../../services/prisma';
import { requireAuth } from '../../middleware/auth';
import {
  generateOutreachEmail as aiGenerateOutreachEmail,
  type OutreachContactType,
} from '../../services/openai';
import { sendEmail } from '../../services/email';
import type { AuthContext } from '../../middleware/auth';
import type { ContactType } from '@prisma/client';

export const outreachResolvers = {
  Query: {
    contacts: async (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx.user);
      return prisma.contact.findMany({
        where: { userId: ctx.user.id },
        orderBy: { name: 'asc' },
      });
    },

    outreach: async (_: unknown, { releaseId }: { releaseId: string }, ctx: AuthContext) => {
      requireAuth(ctx.user);
      const release = await prisma.release.findFirst({
        where: { id: releaseId, userId: ctx.user.id },
      });
      if (!release) throw new Error('Release not found');

      return prisma.outreach.findMany({
        where: { releaseId },
        include: { contact: true, release: true },
        orderBy: { createdAt: 'desc' },
      });
    },
  },

  Mutation: {
    createContact: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          name: string;
          email: string;
          type: ContactType;
          website?: string;
          notes?: string;
        };
      },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      return prisma.contact.create({
        data: { ...input, userId: ctx.user.id },
      });
    },

    updateContact: async (
      _: unknown,
      {
        id,
        input,
      }: {
        id: string;
        input: {
          name?: string;
          email?: string;
          type?: ContactType;
          website?: string;
          notes?: string;
        };
      },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      const contact = await prisma.contact.findFirst({
        where: { id, userId: ctx.user.id },
      });
      if (!contact) throw new Error('Contact not found');

      return prisma.contact.update({ where: { id }, data: input });
    },

    deleteContact: async (_: unknown, { id }: { id: string }, ctx: AuthContext) => {
      requireAuth(ctx.user);
      const contact = await prisma.contact.findFirst({
        where: { id, userId: ctx.user.id },
      });
      if (!contact) throw new Error('Contact not found');
      await prisma.contact.delete({ where: { id } });
      return true;
    },

    generateOutreachEmail: async (
      _: unknown,
      {
        releaseId,
        contactType,
        contactName,
      }: { releaseId: string; contactType: ContactType; contactName?: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);

      const release = await prisma.release.findFirst({
        where: { id: releaseId, userId: ctx.user.id },
      });
      if (!release) throw new Error('Release not found');

      const emailContent = await aiGenerateOutreachEmail(
        {
          artistName: release.artistName,
          title: release.title,
          genre: release.genre ?? undefined,
          mood: release.mood ?? undefined,
          city: release.city ?? undefined,
          influences: release.influences ?? undefined,
        },
        contactType as OutreachContactType,
        contactName
      );

      return {
        subject: emailContent.subject,
        body: emailContent.body,
      };
    },

    createOutreach: async (
      _: unknown,
      {
        releaseId,
        contactId,
        subject,
        body,
      }: { releaseId: string; contactId: string; subject: string; body: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);

      const [release, contact] = await Promise.all([
        prisma.release.findFirst({ where: { id: releaseId, userId: ctx.user.id } }),
        prisma.contact.findFirst({ where: { id: contactId, userId: ctx.user.id } }),
      ]);

      if (!release) throw new Error('Release not found');
      if (!contact) throw new Error('Contact not found');

      return prisma.outreach.create({
        data: { releaseId, contactId, subject, body, status: 'NOT_CONTACTED' },
        include: { contact: true, release: true },
      });
    },

    updateOutreachStatus: async (
      _: unknown,
      { id, status }: { id: string; status: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);

      const outreach = await prisma.outreach.findFirst({
        where: { id, release: { userId: ctx.user.id } },
        include: { contact: true, release: true },
      });
      if (!outreach) throw new Error('Outreach not found');

      return prisma.outreach.update({
        where: { id },
        data: {
          status: status as any,
          ...(status === 'REPLIED' && !outreach.repliedAt
            ? { repliedAt: new Date() }
            : {}),
        },
        include: { contact: true, release: true },
      });
    },

    sendOutreachEmail: async (_: unknown, { id }: { id: string }, ctx: AuthContext) => {
      requireAuth(ctx.user);

      const outreach = await prisma.outreach.findFirst({
        where: { id, release: { userId: ctx.user.id } },
        include: { contact: true, release: true },
      });
      if (!outreach) throw new Error('Outreach not found');
      if (!outreach.contact) throw new Error('Contact not linked');

      await sendEmail({
        to: outreach.contact.email,
        subject: outreach.subject,
        body: outreach.body,
        fromName: outreach.release?.artistName,
      });

      return prisma.outreach.update({
        where: { id },
        data: { status: 'SENT', sentAt: new Date() },
        include: { contact: true, release: true },
      });
    },

    deleteOutreach: async (_: unknown, { id }: { id: string }, ctx: AuthContext) => {
      requireAuth(ctx.user);
      const outreach = await prisma.outreach.findFirst({
        where: { id, release: { userId: ctx.user.id } },
      });
      if (!outreach) throw new Error('Outreach not found');
      await prisma.outreach.delete({ where: { id } });
      return true;
    },
  },
};
