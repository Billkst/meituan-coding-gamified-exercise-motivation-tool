-- 20260510000019_day11_pvp_battle.sql
-- Day 11: start_pvp_battle + extend finalize_battle to handle PVP outcomes.
-- Schema is unchanged — battles already supports defender_id (uuid) + npc_id (text).
-- PVE row: npc_id IS NOT NULL, defender_id IS NULL.
-- PVP row: npc_id IS NULL, defender_id IS NOT NULL.

-- ============================================================
-- SECTION 1: start_pvp_battle
-- ============================================================
create or replace function public.start_pvp_battle(p_opponent_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_my_deck text[];
  v_opp_deck text[];
  v_opp_user record;
  v_battle_id bigint;
begin
  if v_user_id is null then
    raise exception 'unauthorized: no auth.uid()' using errcode = '28000';
  end if;
  if p_opponent_id is null or p_opponent_id = v_user_id then
    raise exception 'invalid opponent' using errcode = '22023';
  end if;

  -- must be active friend
  if not exists (
    select 1 from public.friendships
      where user_id = v_user_id and friend_id = p_opponent_id and status = 'active'
  ) then
    raise exception 'opponent is not an active friend' using errcode = '22023';
  end if;

  -- both decks must be 8-card active
  select card_ids into v_my_deck
    from public.decks where user_id = v_user_id and is_active = true;
  if v_my_deck is null or array_length(v_my_deck, 1) <> 8 then
    raise exception 'your active deck must have exactly 8 cards' using errcode = '22023';
  end if;

  select card_ids into v_opp_deck
    from public.decks where user_id = p_opponent_id and is_active = true;
  if v_opp_deck is null or array_length(v_opp_deck, 1) <> 8 then
    raise exception 'opponent has no 8-card deck yet' using errcode = '22023';
  end if;

  select id, username, level into v_opp_user
    from public.users where id = p_opponent_id;

  insert into battles (attacker_id, defender_id, npc_id, attacker_deck_ids, defender_deck_ids)
    values (v_user_id, p_opponent_id, null, v_my_deck, v_opp_deck)
    returning id into v_battle_id;

  return jsonb_build_object(
    'battle_id', v_battle_id,
    'attacker_deck_ids', to_jsonb(v_my_deck),
    'defender_deck_ids', to_jsonb(v_opp_deck),
    'opponent_user_id', v_opp_user.id,
    'opponent_username', v_opp_user.username,
    'opponent_level', v_opp_user.level,
    'kind', 'pvp'
  );
end; $$;

grant execute on function public.start_pvp_battle(uuid) to authenticated;

-- ============================================================
-- SECTION 2: finalize_battle — replace, add PVP branch
-- PVE: unchanged (xp + season_score for attacker; xp_bonus from card abilities)
-- PVP: no XP, winner +30 season_score, loser max(0, score-5)
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
  v_is_pvp boolean := false;
  v_opp_old int := 0;
  v_opp_new int := 0;
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

  v_is_pvp := (v_battle.npc_id is null and v_battle.defender_id is not null);

  -- idempotent return for already-finalized battles
  if v_battle.winner_id is not null then
    return jsonb_build_object(
      'result', case when v_battle.winner_id = v_user_id then 'win' else 'lose' end,
      'xp_gained', v_battle.attacker_xp_delta,
      'base_reward_xp',
        case when v_battle.npc_id is not null
             then (select reward_xp from npc_opponents where id = v_battle.npc_id)
             else 0 end,
      'final_attacker_hp', coalesce((v_battle.log->-1->>'attacker_hp_after')::int, 100),
      'final_defender_hp', coalesce((v_battle.log->-1->>'defender_hp_after')::int, 100),
      'new_season_score', (select season_score from users where id = v_user_id),
      'score_milestone_crossed', false,
      'is_pvp', v_is_pvp,
      'idempotent', true
    );
  end if;

  if p_log is null or jsonb_array_length(p_log) <> 16 then
    raise exception 'log must have exactly 16 entries (8 turns × 2 attacks)' using errcode = '22023';
  end if;

  v_attacker_hp := (p_log->-1->>'attacker_hp_after')::int;
  v_defender_hp := (p_log->-1->>'defender_hp_after')::int;

  if v_attacker_hp > v_defender_hp then
    v_winner := v_user_id;
  end if;

  if v_is_pvp then
    -- PVP: no XP. Winner +30 season_score, loser max(0, -5).
    update battles set
      winner_id = v_winner,
      log = p_log,
      attacker_xp_delta = 0
      where id = p_battle_id;

    if v_winner = v_user_id then
      select season_score into v_old_score from users where id = v_user_id;
      update users set season_score = season_score + 30
        where id = v_user_id
        returning season_score into v_new_score;
      v_milestone_crossed := floor(v_old_score / 100.0) < floor(v_new_score / 100.0);
      -- loser side
      select season_score into v_opp_old from users where id = v_battle.defender_id;
      update users set season_score = greatest(0, season_score - 5)
        where id = v_battle.defender_id
        returning season_score into v_opp_new;
    else
      -- attacker lost; opponent wins
      v_winner := v_battle.defender_id;
      update battles set winner_id = v_winner where id = p_battle_id;
      select season_score into v_old_score from users where id = v_user_id;
      update users set season_score = greatest(0, season_score - 5)
        where id = v_user_id
        returning season_score into v_new_score;
      select season_score into v_opp_old from users where id = v_battle.defender_id;
      update users set season_score = season_score + 30
        where id = v_battle.defender_id
        returning season_score into v_opp_new;
    end if;
  else
    -- PVE: original behavior
    if v_winner is not null then
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
  end if;

  return jsonb_build_object(
    'result', case when v_winner = v_user_id then 'win' else 'lose' end,
    'xp_gained', v_xp_gained,
    'base_reward_xp', v_base_reward_xp,
    'final_attacker_hp', v_attacker_hp,
    'final_defender_hp', v_defender_hp,
    'new_season_score', v_new_score,
    'opponent_new_season_score', case when v_is_pvp then v_opp_new else null end,
    'score_milestone_crossed', v_milestone_crossed,
    'is_pvp', v_is_pvp
  );
end; $$;

grant execute on function public.finalize_battle(bigint, jsonb) to authenticated;
