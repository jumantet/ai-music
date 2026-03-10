import { requireAuth } from '../../middleware/auth';
import { createCheckoutSession, createPortalSession } from '../../services/stripe';
import type { AuthContext } from '../../middleware/auth';

export const billingResolvers = {
  Mutation: {
    createStripeCheckout: async (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx.user);
      if (ctx.user.plan === 'PRO') throw new Error('Already on Pro plan');
      return createCheckoutSession(ctx.user.id, ctx.user.email, ctx.user.stripeCustomerId);
    },

    createStripePortal: async (_: unknown, __: unknown, ctx: AuthContext) => {
      requireAuth(ctx.user);
      if (!ctx.user.stripeCustomerId) {
        throw new Error('No billing account found');
      }
      return createPortalSession(ctx.user.stripeCustomerId);
    },
  },
};
