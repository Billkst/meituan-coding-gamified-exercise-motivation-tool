-- Day 15: Clash RPCs (8 functions)
-- cr_get_state, cr_unlock_card, cr_upgrade_card, cr_set_deck,
-- cr_finalize_match, cr_open_chest, cr_unlock_chest_now, cr_grant_workout_gold

-- ============================================================
-- cr_upgrade_cost: pure helper (immutable)
-- ============================================================
create or replace function public.cr_upgrade_cost(p_target_level int)
returns jsonb as $$
declare
  v_costs jsonb := '{
    "2":  {"gold": 5,     "shards": 2},
    "3":  {"gold": 20,    "shards": 4},
    "4":  {"gold": 50,    "shards": 10},
    "5":  {"gold": 150,   "shards": 20},
    "6":  {"gold": 400,   "shards": 50},
    "7":  {"gold": 1000,  "shards": 100},
    "8":  {"gold": 2000,  "shards": 200},
    "9":  {"gold": 4000,  "shards": 400},
    "10": {"gold": 8000,  "shards": 800},
    "11": {"gold": 20000, "shards": 1500}
  }'::jsonb;
begin
  return v_costs -> p_target_level::text;
end;
$$ language plpgsql immutable;

-- ============================================================
-- cr_get_state: full Clash state for current user
-- ============================================================
create or replace function public.cr_get_state()
returns jsonb as $$
declare
  v_user_id uuid := auth.uid();
  v_win_streak int;
begin
  if v_user_id is null then
    raise exception 'Unauthenticated';
  end if;

  select count(*)::int into v_win_streak
    from cr_match_log
   where user_id = v_user_id
     and result = 'win'
     and created_at > coalesce(
       (select max(created_at) from cr_match_log
         where user_id = v_user_id and result <> 'win'),
       '1970-01-01'::timestamptz
     );

  return jsonb_build_object(
    'gold', coalesce((select gold from cr_account_currency where user_id = v_user_id), 0),
    'shards_total', coalesce((select shards_total from cr_account_currency where user_id = v_user_id), 0),
    'cards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name_zh', c.name_zh,
        'name_en', c.name_en,
        'card_type', c.card_type,
        'cost', c.cost,
        'rarity', c.rarity,
        'emoji', c.emoji,
        'unlock_cost', c.unlock_cost,
        'base_stats', c.base_stats,
        'unlocked', coalesce(uc.unlocked, false),
        'level', coalesce(uc.level, 1),
        'shards', coalesce(uc.shards, 0)
      ) order by c.cost, c.rarity, c.id)
      from cr_cards c
      left join cr_user_cards uc on uc.user_id = v_user_id and uc.card_id = c.id
    ), '[]'::jsonb),
    'deck', coalesce(
      (select to_jsonb(cards) from cr_user_decks where user_id = v_user_id),
      '[]'::jsonb
    ),
    'chests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'chest_type', chest_type,
        'unlocks_at', unlocks_at,
        'rewards', rewards
      ) order by created_at)
      from cr_chests
      where user_id = v_user_id and not opened
    ), '[]'::jsonb),
    'win_streak', v_win_streak
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- cr_unlock_card: spend gold to unlock
-- ============================================================
create or replace function public.cr_unlock_card(p_card_id text)
returns jsonb as $$
declare
  v_user_id uuid := auth.uid();
  v_card record;
  v_user_card record;
  v_gold int;
begin
  if v_user_id is null then
    raise exception 'Unauthenticated';
  end if;

  select * into v_card from cr_cards where id = p_card_id;
  if not found then
    raise exception 'Card not found: %', p_card_id;
  end if;

  if v_card.unlock_cost = 0 then
    raise exception 'Card already free (initial unlock)';
  end if;

  select * into v_user_card from cr_user_cards
   where user_id = v_user_id and card_id = p_card_id;

  if found and v_user_card.unlocked then
    raise exception 'Already unlocked';
  end if;

  update cr_account_currency
    set gold = gold - v_card.unlock_cost
   where user_id = v_user_id and gold >= v_card.unlock_cost
   returning gold into v_gold;

  if not found then
    raise exception 'Insufficient gold (need %)', v_card.unlock_cost;
  end if;

  insert into cr_user_cards (user_id, card_id, unlocked, level)
  values (v_user_id, p_card_id, true, 1)
  on conflict (user_id, card_id) do update
    set unlocked = true;

  return jsonb_build_object(
    'success', true,
    'gold', v_gold,
    'card_id', p_card_id,
    'unlocked', true,
    'level', 1
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- cr_upgrade_card: spend gold + shards to level up
-- ============================================================
create or replace function public.cr_upgrade_card(p_card_id text)
returns jsonb as $$
declare
  v_user_id uuid := auth.uid();
  v_user_card record;
  v_target_level int;
  v_cost jsonb;
  v_gold_cost int;
  v_shards_cost int;
  v_gold int;
  v_shards int;
begin
  if v_user_id is null then
    raise exception 'Unauthenticated';
  end if;

  select * into v_user_card from cr_user_cards
   where user_id = v_user_id and card_id = p_card_id;

  if not found or not v_user_card.unlocked then
    raise exception 'Card not unlocked';
  end if;

  if v_user_card.level >= 11 then
    raise exception 'Already at max level';
  end if;

  v_target_level := v_user_card.level + 1;
  v_cost := cr_upgrade_cost(v_target_level);
  v_gold_cost := (v_cost ->> 'gold')::int;
  v_shards_cost := (v_cost ->> 'shards')::int;

  if v_user_card.shards < v_shards_cost then
    raise exception 'Insufficient shards (have %, need %)', v_user_card.shards, v_shards_cost;
  end if;

  update cr_account_currency
    set gold = gold - v_gold_cost
   where user_id = v_user_id and gold >= v_gold_cost
   returning gold into v_gold;

  if not found then
    raise exception 'Insufficient gold (need %)', v_gold_cost;
  end if;

  update cr_user_cards
    set shards = shards - v_shards_cost,
        level = v_target_level
   where user_id = v_user_id and card_id = p_card_id
   returning shards into v_shards;

  return jsonb_build_object(
    'success', true,
    'gold', v_gold,
    'card_id', p_card_id,
    'level', v_target_level,
    'shards', v_shards
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- cr_set_deck: replace 8-card active deck
-- ============================================================
create or replace function public.cr_set_deck(p_card_ids text[])
returns jsonb as $$
declare
  v_user_id uuid := auth.uid();
  v_unique_count int;
  v_unlocked_count int;
begin
  if v_user_id is null then
    raise exception 'Unauthenticated';
  end if;

  if array_length(p_card_ids, 1) <> 8 then
    raise exception 'Deck must contain exactly 8 cards';
  end if;

  select count(distinct x) into v_unique_count from unnest(p_card_ids) as x;
  if v_unique_count <> 8 then
    raise exception 'Deck cards must be unique';
  end if;

  select count(*) into v_unlocked_count
    from cr_user_cards
   where user_id = v_user_id
     and card_id = any(p_card_ids)
     and unlocked = true;

  if v_unlocked_count <> 8 then
    raise exception 'All 8 deck cards must be unlocked';
  end if;

  insert into cr_user_decks (user_id, cards)
  values (v_user_id, p_card_ids)
  on conflict (user_id) do update
    set cards = excluded.cards, updated_at = now();

  return jsonb_build_object(
    'success', true,
    'deck', to_jsonb(p_card_ids)
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- cr_finalize_match: log match + grant gold/chest
-- ============================================================
create or replace function public.cr_finalize_match(
  p_result text,
  p_duration int,
  p_player_towers_lost int,
  p_ai_towers_lost int,
  p_difficulty text,
  p_replay jsonb default '{}'::jsonb
) returns jsonb as $$
declare
  v_user_id uuid := auth.uid();
  v_gold_earned int;
  v_chest_id uuid := null;
  v_chest_type text := null;
  v_unlock_minutes int;
  v_win_streak int;
  v_active_chests int;
  v_match_id uuid;
begin
  if v_user_id is null then
    raise exception 'Unauthenticated';
  end if;

  if p_result not in ('win', 'loss', 'draw') then
    raise exception 'Invalid result: %', p_result;
  end if;

  v_gold_earned := case p_result
    when 'win' then 30
    when 'draw' then 10
    when 'loss' then 5
  end;

  if p_result = 'win' then
    select count(*)::int + 1 into v_win_streak
      from cr_match_log
     where user_id = v_user_id
       and result = 'win'
       and created_at > coalesce(
         (select max(created_at) from cr_match_log
           where user_id = v_user_id and result <> 'win'),
         '1970-01-01'::timestamptz
       );
  else
    v_win_streak := 0;
  end if;

  select count(*) into v_active_chests
    from cr_chests where user_id = v_user_id and not opened;

  if p_result = 'win' and v_active_chests < 4 then
    if v_win_streak >= 3 then
      v_chest_type := 'gold';
      v_unlock_minutes := 120;
    else
      v_chest_type := 'silver';
      v_unlock_minutes := 30;
    end if;

    insert into cr_chests (user_id, chest_type, unlocks_at)
    values (v_user_id, v_chest_type, now() + (v_unlock_minutes || ' minutes')::interval)
    returning id into v_chest_id;
  end if;

  update cr_account_currency
    set gold = gold + v_gold_earned
   where user_id = v_user_id;

  insert into cr_match_log (
    user_id, result, duration_seconds,
    player_towers_lost, ai_towers_lost, ai_difficulty, rewards, replay
  ) values (
    v_user_id, p_result, p_duration,
    p_player_towers_lost, p_ai_towers_lost, p_difficulty,
    jsonb_build_object(
      'gold', v_gold_earned,
      'chest_id', v_chest_id,
      'chest_type', v_chest_type
    ),
    p_replay
  )
  returning id into v_match_id;

  return jsonb_build_object(
    'match_id', v_match_id,
    'result', p_result,
    'gold_earned', v_gold_earned,
    'chest_id', v_chest_id,
    'chest_type', v_chest_type,
    'win_streak', v_win_streak
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- cr_open_chest: unlock chest, distribute gold + shards
-- ============================================================
create or replace function public.cr_open_chest(p_chest_id uuid)
returns jsonb as $$
declare
  v_user_id uuid := auth.uid();
  v_chest record;
  v_gold_amount int;
  v_shards_amount int;
  v_unlocked_card_ids text[];
  v_card_count int;
  v_shards_per_card int;
  v_remainder int;
  v_breakdown jsonb := '[]'::jsonb;
  v_card_id text;
  v_amount int;
  v_i int := 0;
begin
  if v_user_id is null then
    raise exception 'Unauthenticated';
  end if;

  select * into v_chest from cr_chests
   where id = p_chest_id and user_id = v_user_id;

  if not found then
    raise exception 'Chest not found';
  end if;

  if v_chest.opened then
    raise exception 'Chest already opened';
  end if;

  if v_chest.unlocks_at > now() then
    raise exception 'Chest not yet unlocked';
  end if;

  if v_chest.chest_type = 'silver' then
    v_gold_amount := 50;
    v_shards_amount := 20;
  elsif v_chest.chest_type = 'gold' then
    v_gold_amount := 200;
    v_shards_amount := 80;
  else
    raise exception 'Unknown chest type: %', v_chest.chest_type;
  end if;

  select array_agg(card_id) into v_unlocked_card_ids
    from cr_user_cards
   where user_id = v_user_id and unlocked = true;

  v_card_count := coalesce(array_length(v_unlocked_card_ids, 1), 0);

  if v_card_count > 0 then
    v_shards_per_card := v_shards_amount / v_card_count;
    v_remainder := v_shards_amount - v_shards_per_card * v_card_count;

    foreach v_card_id in array v_unlocked_card_ids loop
      v_i := v_i + 1;
      v_amount := v_shards_per_card + (case when v_i <= v_remainder then 1 else 0 end);
      if v_amount > 0 then
        update cr_user_cards
          set shards = shards + v_amount
         where user_id = v_user_id and card_id = v_card_id;
        v_breakdown := v_breakdown || jsonb_build_array(
          jsonb_build_object('card_id', v_card_id, 'shards', v_amount)
        );
      end if;
    end loop;
  end if;

  update cr_account_currency
    set gold = gold + v_gold_amount,
        shards_total = shards_total + v_shards_amount
   where user_id = v_user_id;

  update cr_chests
    set opened = true,
        rewards = jsonb_build_object(
          'gold', v_gold_amount,
          'shards', v_shards_amount,
          'breakdown', v_breakdown
        )
   where id = p_chest_id;

  return jsonb_build_object(
    'success', true,
    'chest_id', p_chest_id,
    'chest_type', v_chest.chest_type,
    'gold', v_gold_amount,
    'shards', v_shards_amount,
    'breakdown', v_breakdown
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- cr_unlock_chest_now: dev-only fast-unlock (review-mode helper)
-- ============================================================
create or replace function public.cr_unlock_chest_now(p_chest_id uuid)
returns jsonb as $$
declare
  v_user_id uuid := auth.uid();
  v_updated int;
begin
  if v_user_id is null then
    raise exception 'Unauthenticated';
  end if;

  update cr_chests
    set unlocks_at = now()
   where id = p_chest_id and user_id = v_user_id and not opened;

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception 'Chest not found or already opened';
  end if;

  return jsonb_build_object('success', true, 'chest_id', p_chest_id);
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- cr_grant_workout_gold: called from submit_workout extension
-- ============================================================
create or replace function public.cr_grant_workout_gold(p_xp int)
returns jsonb as $$
declare
  v_user_id uuid := auth.uid();
  v_gold_earned int;
  v_gold_total int;
begin
  if v_user_id is null then
    raise exception 'Unauthenticated';
  end if;

  v_gold_earned := least(500, 100 + p_xp * 5);

  update cr_account_currency
    set gold = gold + v_gold_earned
   where user_id = v_user_id
   returning gold into v_gold_total;

  if not found then
    insert into cr_account_currency (user_id, gold)
    values (v_user_id, 100 + v_gold_earned)
    returning gold into v_gold_total;
  end if;

  return jsonb_build_object(
    'gold_earned', v_gold_earned,
    'gold_total', v_gold_total
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- Grants
-- ============================================================
grant execute on function public.cr_upgrade_cost(int) to authenticated;
grant execute on function public.cr_get_state() to authenticated;
grant execute on function public.cr_unlock_card(text) to authenticated;
grant execute on function public.cr_upgrade_card(text) to authenticated;
grant execute on function public.cr_set_deck(text[]) to authenticated;
grant execute on function public.cr_finalize_match(text, int, int, int, text, jsonb) to authenticated;
grant execute on function public.cr_open_chest(uuid) to authenticated;
grant execute on function public.cr_unlock_chest_now(uuid) to authenticated;
grant execute on function public.cr_grant_workout_gold(int) to authenticated;
