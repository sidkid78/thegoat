import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia' as any,
  appInfo: {
    name: 'Dwellingly.ai Real Estate',
    version: '1.0.0',
  },
});

export interface CreateEarnestSessionParams {
  offerId: number;
  propertyAddress: string;
  amount: number;
  userEmail: string;
}

/**
 * Creates a Stripe Checkout session for earnest money deposit on an accepted offer.
 */
export async function createEarnestMoneyCheckoutSession({
  offerId,
  propertyAddress,
  amount,
  userEmail,
}: CreateEarnestSessionParams) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    customer_email: userEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Earnest Money Deposit - ${propertyAddress}`,
            description: `Escrow hold for Purchase Offer #${offerId}`,
          },
          unit_amount: Math.round(amount * 100), // Convert dollars to cents
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${origin}/dashboard?payment=success&offerId=${offerId}`,
    cancel_url: `${origin}/dashboard?payment=cancelled`,
    metadata: {
      offerId: offerId.toString(),
      type: 'earnest_money_deposit',
    },
  });

  return session;
}

/**
 * Validates Stripe incoming webhooks
 */
export function constructStripeEvent(body: string, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  }
  return stripe.webhooks.constructEvent(body, signature, secret);
}