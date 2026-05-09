-- PULSE schema — 8 tables, indexes, helper triggers
-- Day 2: 2026-05-09

-- ============================================================
-- helper: updated_at trigger function
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 1. users (extends auth.users)
-- ============================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 1 and 20),
  level int not null default 1 check (level >= 1),
  xp int not null default 0 check (xp >= 0),
  total_workouts int not null default 0 check (total_workouts >= 0),
  current_streak int not null default 0 check (current_streak >= 0),
  longest_streak int not null default 0 check (longest_streak >= 0),
  last_workout_date date,
  exploration_buffs jsonb not null default '{}'::jsonb,
  protect_cards int not null default 0 check (protect_cards >= 0),
  season_score int not null default 0 check (season_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create index users_season_score_idx on public.users (season_score desc);

-- ============================================================
-- 2. sports (catalog, 26 项, public read)
-- ============================================================
create table public.sports (
  id text primary key,
  name_zh text not null,
  name_en text not null,
  category text not null check (category in ('cardio', 'strength', 'ball', 'flex', 'martial', 'outdoor')),
  icon text not null,
  base_xp_multiplier numeric(3,2) not null default 1.00 check (base_xp_multiplier > 0),
  display_order int not null default 0
);
create index sports_category_idx on public.sports (category, display_order);

-- ============================================================
-- 3. cards (universal pool, 不绑 sport)
-- ============================================================
create table public.cards (
  id text primary key,
  name_zh text not null,
  name_en text not null,
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  base_attack int not null check (base_attack >= 0),
  base_defense int not null check (base_defense >= 0),
  ability_text_zh text,
  ability_text_en text,
  synergy_with text[] not null default '{}',
  flavor_zh text,
  flavor_en text
);
create index cards_rarity_idx on public.cards (rarity);

-- ============================================================
-- 4. user_cards (instances)
-- ============================================================
create table public.user_cards (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  card_id text not null references public.cards(id) on delete cascade,
  star_level int not null default 1 check (star_level between 1 and 5),
  copies int not null default 1 check (copies >= 0),
  acquired_at timestamptz not null default now(),
  unique (user_id, card_id)
);
create index user_cards_user_idx on public.user_cards (user_id, acquired_at desc);

-- ============================================================
-- 5. workouts (history)
-- ============================================================
create table public.workouts (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  sport_id text not null references public.sports(id),
  duration_minutes int not null check (duration_minutes between 1 and 600),
  intensity text not null check (intensity in ('light', 'medium', 'high')),
  xp_gained int not null check (xp_gained >= 0),
  cards_drawn text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index workouts_user_recent_idx on public.workouts (user_id, created_at desc);

-- ============================================================
-- 6. streaks (periods)
-- ============================================================
create table public.streaks (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  start_date date not null,
  end_date date,
  length int not null check (length >= 1),
  status text not null check (status in ('active', 'broken', 'frozen')),
  frozen_until timestamptz
);
create index streaks_user_idx on public.streaks (user_id, start_date desc);

-- ============================================================
-- 7. decks (主卡组 8 张)
-- ============================================================
create table public.decks (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null default '主卡组',
  card_ids text[] not null default '{}' check (
    array_length(card_ids, 1) is null or array_length(card_ids, 1) <= 8
  ),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger decks_set_updated_at before update on public.decks
  for each row execute function public.set_updated_at();
-- one active deck per user
create unique index decks_user_active_idx on public.decks (user_id) where is_active = true;
create index decks_user_idx on public.decks (user_id);

-- ============================================================
-- 8. battles (history)
-- ============================================================
create table public.battles (
  id bigserial primary key,
  attacker_id uuid not null references public.users(id) on delete cascade,
  defender_id uuid references public.users(id) on delete set null,
  attacker_deck_ids text[] not null,
  defender_deck_ids text[] not null,
  winner_id uuid,
  attacker_xp_delta int not null default 0,
  defender_xp_delta int not null default 0,
  season text not null default to_char(now(), 'YYYY-MM'),
  created_at timestamptz not null default now()
);
create index battles_attacker_idx on public.battles (attacker_id, created_at desc);
create index battles_defender_idx on public.battles (defender_id, created_at desc);
create index battles_season_idx on public.battles (season, created_at desc);

-- ============================================================
-- handle_new_user: auto-create public.users + default deck on auth signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  random_username text;
begin
  random_username := 'user_' || substr(new.id::text, 1, 8);
  insert into public.users (id, username)
  values (new.id, random_username);
  insert into public.decks (user_id, name, card_ids, is_active)
  values (new.id, '主卡组', '{}', true);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
