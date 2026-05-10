-- 20260510000009_finalize_log_16.sql
-- Fix: finalize_battle expects log = 16 entries (8 player + 8 AI attacks per spec C1).

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

  -- 8 turns × 2 attacks (player + AI) = 16 log entries per spec C1
  if p_log is null or jsonb_array_length(p_log) <> 16 then
    raise exception 'log must have exactly 16 entries (8 turns × 2 attacks)' using errcode = '22023';
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
