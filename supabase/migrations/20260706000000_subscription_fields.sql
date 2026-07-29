-- Subscription fields on profiles (Stripe checkout writes these)

alter table public.profiles
  add column if not exists subscription_tier text
    check (subscription_tier is null or subscription_tier in ('basic', 'advanced', 'premium'));

alter table public.profiles
  add column if not exists subscription_status text;

alter table public.profiles
  add column if not exists stripe_customer_id text;

alter table public.profiles
  add column if not exists stripe_subscription_id text;

create index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;