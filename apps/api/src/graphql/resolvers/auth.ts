import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../services/prisma';
import { signToken, requireAuth } from '../../middleware/auth';
import { sendVerificationEmail } from '../../services/email';
import type { AuthContext } from '../../middleware/auth';
import { GraphQLError } from 'graphql';

function generateVerifyToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Affichage initial du compte (User.name requis) — dérivé de la partie locale de l’email. */
function defaultNameFromEmail(email: string): string {
  const local = email.trim().split('@')[0] ?? '';
  const cleaned = local.replace(/[.+_-]+/g, ' ').trim();
  if (!cleaned) return 'Artist';
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

export const authResolvers = {
  Mutation: {
    signup: async (_: unknown, { email, password }: { email: string; password: string }) => {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) throw new Error('Email already in use');

      const hashed = await bcrypt.hash(password, 12);
      const verifyToken = generateVerifyToken();
      const name = defaultNameFromEmail(email);

      const user = await prisma.user.create({
        data: { email, password: hashed, name, verifyToken },
      });

      // Send verification email (non-blocking — don't fail signup if email fails)
      sendVerificationEmail(user.email, user.name, verifyToken).catch((err) => {
        console.error('[Email] Failed to send verification email:', err);
      });

      const token = signToken(user.id, user.email);
      return { token, user };
    },

    login: async (
      _: unknown,
      { email, password }: { email: string; password: string }
    ) => {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) throw new Error('Invalid credentials');

      if (!user.password) {
        throw new GraphQLError('This account has no password set.', {
          extensions: { code: 'LOGIN_NO_PASSWORD' },
        });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) throw new Error('Invalid credentials');

      const token = signToken(user.id, user.email);
      return { token, user };
    },

    verifyEmail: async (_: unknown, { token }: { token: string }) => {
      const user = await prisma.user.findUnique({ where: { verifyToken: token } });
      if (!user) throw new Error('Invalid or expired verification link');

      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, verifyToken: null },
      });

      const authToken = signToken(user.id, user.email);
      return { token: authToken, user: { ...user, emailVerified: true, verifyToken: null } };
    },

    resendVerificationEmail: async (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx.user);

      if (ctx.user.emailVerified) {
        throw new Error('Email is already verified');
      }

      const verifyToken = generateVerifyToken();
      await prisma.user.update({
        where: { id: ctx.user.id },
        data: { verifyToken },
      });

      await sendVerificationEmail(ctx.user.email, ctx.user.name, verifyToken);
      return true;
    },
  },
};
