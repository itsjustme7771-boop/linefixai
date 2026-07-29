-- Allow signed-out visitors to browse approved Cross-Fix Cards.
-- Submitting, approving, and upvoting still require authentication.

drop policy if exists "cross_fix_cards_select_approved_anon" on public.cross_fix_cards;
create policy "cross_fix_cards_select_approved_anon"
  on public.cross_fix_cards for select
  to anon
  using (status = 'approved');