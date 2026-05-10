-- 20260510000008_arena_rpc_fixes.sql
-- Day 5 fix: code-review issues from migration 7.

-- ============================================================
-- 1. Explicit anon grant for npc_opponents (don't rely on supabase defaults)
-- ============================================================
grant select on public.npc_opponents to anon, authenticated;

-- ============================================================
-- 2. start_battle: BUG-1 (NULL level bypass) + IMPORTANT-3 (empty deck check)
-- ============================================================
create or replace function public.start_battle(p_npc_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_user_level int;
  v_npc npc_opponents%rowtype;
  v_deck text[];
  v_battle_id bigint;
begin
  if v_user_id is null then
    raise exception 'unauthorized: no auth.uid()' using errcode = '28000';
  end if;

  -- FIX BUG-1: explicit not-found handling so NULL level can't silently bypass lock check
  select level into v_user_level from users where id = v_user_id;
  if not found then
    raise exception 'user profile not found' using errcode = '28000';
  end if;

  select * into v_npc from npc_opponents where id = p_npc_id;
  if not found then
    raise exception 'npc not found: %', p_npc_id using errcode = '22023';
  end if;
  if v_user_level < v_npc.unlock_at_level then
    raise exception 'npc locked: need level %', v_npc.unlock_at_level using errcode = '22023';
  end if;

  select card_ids into v_deck
    from decks where user_id = v_user_id and is_active = true;

  -- FIX IMPORTANT-3: array_length('{}', 1) returns NULL, not 0; coalesce to handle empty deck
  if v_deck is null or coalesce(array_length(v_deck, 1), 0) <> 8 then
    raise exception 'active deck must have exactly 8 cards' using errcode = '22023';
  end if;

  insert into battles (attacker_id, defender_id, npc_id, attacker_deck_ids, defender_deck_ids)
  values (v_user_id, null, p_npc_id, v_deck, v_npc.deck_card_ids)
  returning id into v_battle_id;

  return jsonb_build_object(
    'battle_id', v_battle_id,
    'attacker_deck_ids', to_jsonb(v_deck),
    'defender_deck_ids', to_jsonb(v_npc.deck_card_ids),
    'reward_xp', v_npc.reward_xp,
    'npc_name_zh', v_npc.name_zh,
    'npc_name_en', v_npc.name_en,
    'npc_level', v_npc.level,
    'npc_flavor_zh', v_npc.flavor_zh,
    'npc_flavor_en', v_npc.flavor_en
  );
end; $$;

grant execute on function public.start_battle(text) to authenticated;

-- ============================================================
-- 3. finalize_battle: IMPORTANT-2 (idempotent fields) + MINOR-3 (null log guard)
-- ============================================================
create or replace function public.finalize_battle(p_battle_id bigint, p_log jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_battle battles%rowtype;
  v_npc npc_opponents%rowtype;
  v_attacker_hp int;
  v_defender_hp int;
  v_winner uuid;
  v_xp_gained int := 0;
  v_xp_bonus_pct int := 0;
  v_old_score int := 0;
  v_new_score int := 0;
  v_milestone_crossed boolean := false;
  v_base_reward_xp int := 0;
begin
  if v_user_id is null then
    raise exception 'unauthorized: no auth.uid()' using errcode = '28000';
  end if;

  select * into v_battle
    from battles where id = p_battle_id and attacker_id = v_user_id
    for update;
  if not found then
    raise exception 'battle not found or not yours: %', p_battle_id using errcode = '22023';
  end if;

  -- FIX IMPORTANT-2: idempotent path returns same fields as success path so frontend
  -- doesn't crash on stale fields when receiving an already-finalized response.
  if v_battle.winner_id is not null then
    return jsonb_build_object(
      'result', case when v_battle.winner_id = v_user_id then 'win' else 'lose' end,
      'xp_gained', v_battle.attacker_xp_delta,
      'base_reward_xp', case when v_battle.npc_id is not null then (select reward_xp from npc_opponents where id = v_battle.npc_id) else 0 end,
      'final_attacker_hp', coalesce((v_battle.log->-1->>'attacker_hp_after')::int, 100),
      'final_defender_hp', coalesce((v_battle.log->-1->>'defender_hp_after')::int, 100),
      'new_season_score', (select season_score from users where id = v_user_id),
      'score_milestone_crossed', false,
      'idempotent', true
    );
  end if;

  -- FIX MINOR-3: null guard before length check
  if p_log is null or jsonb_array_length(p_log) <> 8 then
    raise exception 'log must have exactly 8 turns' using errcode = '22023';
  end if;

  v_attacker_hp := (p_log->-1->>'attacker_hp_after')::int;
  v_defender_hp := (p_log->-1->>'defender_hp_after')::int;

  if v_attacker_hp > v_defender_hp then
    v_winner := v_user_id;
    select * into v_npc from npc_opponents where id = v_battle.npc_id;
    v_base_reward_xp := v_npc.reward_xp;
    select coalesce(sum(ability_value), 0) into v_xp_bonus_pct
      from cards
      where id = any(v_battle.attacker_deck_ids)
        and ability_kind = 'xp_bonus'
        and ability_trigger = 'on_battle_end';
    v_xp_gained := round(v_npc.reward_xp * (1 + v_xp_bonus_pct::numeric / 100));
  end if;

  update battles set
    winner_id = v_winner,
    log = p_log,
    attacker_xp_delta = v_xp_gained
    where id = p_battle_id;

  if v_xp_gained > 0 then
    select season_score into v_old_score from users where id = v_user_id;
    update users set
      xp = xp + v_xp_gained,
      season_score = season_score + (v_xp_gained / 4)
      where id = v_user_id
      returning season_score into v_new_score;
    v_milestone_crossed := floor(v_old_score / 100.0) < floor(v_new_score / 100.0);
  else
    select season_score into v_new_score from users where id = v_user_id;
  end if;

  return jsonb_build_object(
    'result', case when v_winner is not null then 'win' else 'lose' end,
    'xp_gained', v_xp_gained,
    'base_reward_xp', v_base_reward_xp,
    'final_attacker_hp', v_attacker_hp,
    'final_defender_hp', v_defender_hp,
    'new_season_score', v_new_score,
    'score_milestone_crossed', v_milestone_crossed
  );
end; $$;

grant execute on function public.finalize_battle(bigint, jsonb) to authenticated;
