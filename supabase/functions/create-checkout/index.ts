// deno-lint-ignore-file no-explicit-any
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { corsPreflight, jsonResponse } from '../_shared/cors.ts';

const TIER_PRICES: Record<string, string | undefined> = {
  basic: Deno.env.get('STRIPE_PRICE_BASIC'),
  advanced: Deno.env.get('STRIPE_PRICE_ADVANCED'),
  premium: Deno.env.get('STRIPE_PRICE_PREMIUM'),
};

function stripeClient(): Stripe {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });
}

function stripeOpts(): { stripeAccount?: string } {
  const account = Deno.env.get('STRIPE_ACCOUNT_ID');
  return account ? { stripeAccount: account } : {};
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight();
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405);
  }

  try {
    const body = await req.json();
    const { action, tier, email, name, customerId } = body;
    const stripe = stripeClient();
    const opts = stripeOpts();

    if (action === 'create-setup-intent') {
      if (!tier || !email) {
        return jsonResponse({ error: 'tier and email required' }, 400);
      }

      const customer = await stripe.customers.create(
        { email, name: name || email.split('@')[0] },
        opts,
      );

      const setupIntent = await stripe.setupIntents.create(
        {
          customer: customer.id,
          payment_method_types: ['card'],
          metadata: { tier },
        },
        opts,
      );

      if (!setupIntent.client_secret) {
        return jsonResponse({ error: 'Failed to create setup intent' }, 500);
      }

      return jsonResponse({
        clientSecret: setupIntent.client_secret,
        customerId: customer.id,
      });
    }

    if (action === 'activate-subscription') {
      if (!customerId || !tier || !email) {
        return jsonResponse({ error: 'customerId, tier, and email required' }, 400);
      }

      const priceId = TIER_PRICES[String(tier).toLowerCase()];
      if (!priceId) {
        return jsonResponse({ error: `No Stripe price configured for tier: ${tier}` }, 400);
      }

      const paymentMethods = await stripe.paymentMethods.list(
        { customer: customerId, type: 'card' },
        opts,
      );
      const paymentMethodId = paymentMethods.data[0]?.id;
      if (!paymentMethodId) {
        return jsonResponse({ error: 'No payment method on file' }, 400);
      }

      await stripe.customers.update(
        customerId,
        { invoice_settings: { default_payment_method: paymentMethodId } },
        opts,
      );

      const subscription = await stripe.subscriptions.create(
        {
          customer: customerId,
          items: [{ price: priceId }],
          default_payment_method: paymentMethodId,
          metadata: { tier, email },
        },
        opts,
      );

      return jsonResponse({ subscriptionId: subscription.id, status: subscription.status });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('create-checkout error:', message);
    return jsonResponse({ error: message }, 500);
  }
});