/**
 * Centralized frontend environment variables.
 * Copy .env.example to .env and fill in your own Supabase + Stripe keys.
 */
export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined,
  stripeAccountId: import.meta.env.VITE_STRIPE_ACCOUNT_ID as string | undefined,
} as const;

export const hasSupabaseConfig = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const hasStripeConfig = Boolean(env.stripePublishableKey);