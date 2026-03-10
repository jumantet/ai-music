import jwt from 'jsonwebtoken';
import { prisma } from '../services/prisma';
import type { User } from '@prisma/client';

export interface AuthContext {
  user?: User;
}

export interface JWTPayload {
  userId: string;
  email: string;
}

export function signToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email } satisfies JWTPayload,
    process.env.JWT_SECRET!,
    { expiresIn: '30d' }
  );
}

export async function getUserFromToken(token?: string): Promise<User | undefined> {
  if (!token) return undefined;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    return user ?? undefined;
  } catch {
    return undefined;
  }
}

export function requireAuth(user: User | undefined): asserts user is User {
  if (!user) {
    throw new Error('Authentication required');
  }
}

export function requireVerified(user: User): void {
  if (!user.emailVerified) {
    throw new Error('Please verify your email address before continuing. Check your inbox or resend the verification email from Settings.');
  }
}
