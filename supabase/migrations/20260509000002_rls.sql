-- PULSE RLS policies — anti-cheat write split
-- Day 2: 2026-05-09
--
-- Split rule:
--   anti-cheat sensitive (level/xp/streak/cards/workouts/battles) → service_role only
--   preference (username, exploration_buffs, decks) → user direct
--   public read (sports, cards catalog) → anyone

-- ============================================================
-- USERS
-- ============================================================
alter table public.users enable row level security;

create policy "users_select_all"
  on public.users for select
  using (true);

create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- column-level: only username + exploration_buffs are user-writable
revoke update on public.users from authenticated, anon;
grant update (username, exploration_buffs) on public.users to authenticated;

-- INSERT/DELETE blocked at user level (managed via auth trigger or service_role)
revoke insert, delete on public.users from authenticated, anon;

-- ============================================================
-- SPORTS — public read, write blocked
-- ============================================================
alter table public.sports enable row level security;

create policy "sports_select_all"
  on public.sports for select
  using (true);

revoke insert, update, delete on public.sports from authenticated, anon;

-- ============================================================
-- CARDS — public read, write blocked
-- ============================================================
alter table public.cards enable row level security;

create policy "cards_select_all"
  on public.cards for select
  using (true);

revoke insert, update, delete on public.cards from authenticated, anon;

-- ============================================================
-- USER_CARDS — SELECT own, write via Edge Function only
-- ============================================================
alter table public.user_cards enable row level security;

create policy "user_cards_select_own"
  on public.user_cards for select
  using (auth.uid() = user_id);

revoke insert, update, delete on public.user_cards from authenticated, anon;

-- ============================================================
-- WORKOUTS — SELECT own, INSERT via Edge Function only
-- ============================================================
alter table public.workouts enable row level security;

create policy "workouts_select_own"
  on public.workouts for select
  using (auth.uid() = user_id);

revoke insert, update, delete on public.workouts from authenticated, anon;

-- ============================================================
-- STREAKS — SELECT own, write via Edge Function only
-- ============================================================
alter table public.streaks enable row level security;

create policy "streaks_select_own"
  on public.streaks for select
  using (auth.uid() = user_id);

revoke insert, update, delete on public.streaks from authenticated, anon;

-- ============================================================
-- DECKS — full ownership for user (preference write)
-- ============================================================
alter table public.decks enable row level security;

create policy "decks_select_own"
  on public.decks for select
  using (auth.uid() = user_id);

create policy "decks_insert_own"
  on public.decks for insert
  with check (auth.uid() = user_id);

create policy "decks_update_own"
  on public.decks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "decks_delete_own"
  on public.decks for delete
  using (auth.uid() = user_id);

-- ============================================================
-- BATTLES — SELECT own + opponent, INSERT via Edge Function
-- ============================================================
alter table public.battles enable row level security;

create policy "battles_select_involved"
  on public.battles for select
  using (auth.uid() = attacker_id or auth.uid() = defender_id);

revoke insert, update, delete on public.battles from authenticated, anon;
