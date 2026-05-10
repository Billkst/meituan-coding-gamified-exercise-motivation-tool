-- Day 15: Clash Royale clone schema
-- 6 tables (cr_cards, cr_user_cards, cr_user_decks, cr_account_currency, cr_chests, cr_match_log)
-- + RLS + initial unlock trigger + backfill

-- ============================================================
-- 1. cr_cards (12 cards static catalog)
-- ============================================================
create table public.cr_cards (
  id text primary key,
  name_zh text not null,
  name_en text not null,
  card_type text not null check (card_type in ('troop','spell','building')),
  cost int not null check (cost between 1 and 9),
  rarity text not null check (rarity in ('common','rare','epic','legendary')),
  emoji text not null,
  unlock_cost int not null default 0 check (unlock_cost >= 0),
  base_stats jsonb not null
);
create index cr_cards_rarity_idx on public.cr_cards (rarity);

insert into public.cr_cards (id, name_zh, name_en, card_type, cost, rarity, emoji, unlock_cost, base_stats) values
('knight',     '骑士',       'Knight',         'troop',    3, 'common', '⚔️', 0,
  '{"hp":1500,"dmg":150,"hit_speed":1.2,"move_speed":60,"range":1,"target":"ground","count":1}'::jsonb),
('archer',     '弓箭手',     'Archer',         'troop',    3, 'common', '🏹', 0,
  '{"hp":250,"dmg":90,"hit_speed":1.0,"move_speed":60,"range":5,"target":"air+ground","count":2}'::jsonb),
('goblin',     '哥布林',     'Goblin',         'troop',    2, 'common', '👺', 0,
  '{"hp":200,"dmg":110,"hit_speed":1.1,"move_speed":120,"range":1,"target":"ground","count":3}'::jsonb),
('arrows',     '箭雨',       'Arrows',         'spell',    3, 'common', '🌧️', 0,
  '{"dmg":250,"radius":4}'::jsonb),
('cannon',     '加农炮',     'Cannon',         'building', 3, 'common', '💥', 0,
  '{"hp":700,"dmg":110,"hit_speed":1.0,"range":6,"target":"ground"}'::jsonb),
('giant',      '巨人',       'Giant',          'troop',    5, 'rare',   '🗿', 0,
  '{"hp":3500,"dmg":200,"hit_speed":1.5,"move_speed":45,"range":1,"target":"building","count":1}'::jsonb),
('musketeer',  '火枪手',     'Musketeer',      'troop',    4, 'rare',   '🔫', 0,
  '{"hp":700,"dmg":220,"hit_speed":1.1,"move_speed":60,"range":6,"target":"air+ground","count":1}'::jsonb),
('valkyrie',   '女武神',     'Valkyrie',       'troop',    4, 'rare',   '🛡️', 0,
  '{"hp":1700,"dmg":230,"hit_speed":1.5,"move_speed":60,"range":1.2,"target":"ground","count":1}'::jsonb),
('mini_pekka', '小皮卡',     'Mini P.E.K.K.A', 'troop',    4, 'rare',   '🤖', 10,
  '{"hp":1300,"dmg":600,"hit_speed":1.6,"move_speed":90,"range":1,"target":"ground","count":1}'::jsonb),
('tesla',      '特斯拉电塔', 'Tesla',          'building', 4, 'rare',   '⚡', 10,
  '{"hp":800,"dmg":130,"hit_speed":1.1,"range":6,"target":"air+ground"}'::jsonb),
('baby_dragon','小宝龙',     'Baby Dragon',    'troop',    4, 'epic',   '🐲', 20,
  '{"hp":1100,"dmg":100,"hit_speed":1.6,"move_speed":60,"range":3.5,"target":"air+ground","count":1}'::jsonb),
('lightning',  '闪电',       'Lightning',      'spell',    6, 'epic',   '⛈️', 20,
  '{"dmg":600,"radius":3,"max_targets":3}'::jsonb);

-- ============================================================
-- 2. cr_user_cards (per-user unlock + level + shards)
-- ============================================================
create table public.cr_user_cards (
  user_id uuid not null references public.users(id) on delete cascade,
  card_id text not null references public.cr_cards(id) on delete cascade,
  unlocked boolean not null default false,
  level int not null default 1 check (level between 1 and 11),
  shards int not null default 0 check (shards >= 0),
  primary key (user_id, card_id)
);
create index cr_user_cards_user_idx on public.cr_user_cards (user_id);

-- ============================================================
-- 3. cr_user_decks (8-card active deck per user)
-- ============================================================
create table public.cr_user_decks (
  user_id uuid primary key references public.users(id) on delete cascade,
  cards text[] not null check (array_length(cards, 1) = 8),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger cr_user_decks_set_updated_at before update on public.cr_user_decks
  for each row execute function public.set_updated_at();

-- ============================================================
-- 4. cr_account_currency (gold + total shards earned)
-- ============================================================
create table public.cr_account_currency (
  user_id uuid primary key references public.users(id) on delete cascade,
  gold int not null default 100 check (gold >= 0),
  shards_total int not null default 0 check (shards_total >= 0),
  updated_at timestamptz not null default now()
);
create trigger cr_account_currency_set_updated_at before update on public.cr_account_currency
  for each row execute function public.set_updated_at();

-- ============================================================
-- 5. cr_chests (queue with unlock timer)
-- ============================================================
create table public.cr_chests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  chest_type text not null check (chest_type in ('silver','gold')),
  unlocks_at timestamptz not null,
  opened boolean not null default false,
  rewards jsonb,
  created_at timestamptz not null default now()
);
create index cr_chests_user_idx on public.cr_chests (user_id, opened, unlocks_at);

-- ============================================================
-- 6. cr_match_log (replay + result for stats)
-- ============================================================
create table public.cr_match_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  result text not null check (result in ('win','loss','draw')),
  duration_seconds int not null check (duration_seconds >= 0),
  player_towers_lost int not null default 0,
  ai_towers_lost int not null default 0,
  ai_difficulty text not null check (ai_difficulty in ('easy','normal','hard')),
  rewards jsonb,
  replay jsonb,
  created_at timestamptz not null default now()
);
create index cr_match_log_user_idx on public.cr_match_log (user_id, created_at desc);

-- ============================================================
-- 7. RLS
-- ============================================================
alter table public.cr_cards            enable row level security;
alter table public.cr_user_cards       enable row level security;
alter table public.cr_user_decks       enable row level security;
alter table public.cr_account_currency enable row level security;
alter table public.cr_chests           enable row level security;
alter table public.cr_match_log        enable row level security;

create policy cr_cards_public_read on public.cr_cards
  for select using (true);

create policy cr_user_cards_self_all on public.cr_user_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy cr_user_decks_self_all on public.cr_user_decks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy cr_account_currency_self_all on public.cr_account_currency
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy cr_chests_self_all on public.cr_chests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy cr_match_log_self_all on public.cr_match_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 8. New-user initialization trigger (fires AFTER public.users insert)
-- ============================================================
create or replace function public.handle_new_user_clash()
returns trigger as $$
begin
  insert into public.cr_account_currency (user_id, gold) values (new.id, 100);
  insert into public.cr_user_decks (user_id, cards) values (
    new.id,
    array['knight','archer','goblin','giant','musketeer','valkyrie','arrows','cannon']
  );
  -- Initial unlocks: all 8 cards in default deck (cost-0 cards)
  insert into public.cr_user_cards (user_id, card_id, unlocked, level)
  select new.id, id, true, 1
    from public.cr_cards
   where unlock_cost = 0;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_user_created_init_clash
  after insert on public.users
  for each row execute function public.handle_new_user_clash();

-- ============================================================
-- 9. Backfill existing users
-- ============================================================
insert into public.cr_account_currency (user_id, gold)
select id, 100 from public.users
on conflict (user_id) do nothing;

insert into public.cr_user_decks (user_id, cards)
select id, array['knight','archer','goblin','giant','musketeer','valkyrie','arrows','cannon']
  from public.users
on conflict (user_id) do nothing;

insert into public.cr_user_cards (user_id, card_id, unlocked, level)
select u.id, c.id, true, 1
  from public.users u
  cross join public.cr_cards c
 where c.unlock_cost = 0
on conflict (user_id, card_id) do nothing;
