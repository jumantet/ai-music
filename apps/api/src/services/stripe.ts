import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  customerId?: string | null
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId ?? undefined,
    customer_email: customerId ? undefined : userEmail,
    line_items: [
      {
        price: process.env.STRIPE_PRO_PRICE_ID!,
        quantity: 1,
      },
    ],
    success_url: `${process.env.FRONTEND_URL}/settings?upgraded=true`,
    cancel_url: `${process.env.FRONTEND_URL}/settings`,
    metadata: { userId },
    allow_promotion_codes: true,
  });

  if (!session.url) throw new Error('Failed to create checkout session');
  return session.url;
}

export async function createPortalSession(customerId: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.FRONTEND_URL}/settings`,
  });
  return session.url;
}
