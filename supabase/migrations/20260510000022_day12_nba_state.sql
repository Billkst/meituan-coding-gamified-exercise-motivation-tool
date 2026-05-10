-- 20260510000022_day12_nba_state.sql
-- Day 12: get_nba_state() — aggregate counters that drive Dashboard's
-- "Next Best Action" card. Cheaper than 6 separate selects from the
-- frontend, and keeps the decision rules colocated with data shape.

create or replace function public.get_nba_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_workouts int := 0;
  v_owned_cards int := 0;
  v_active_deck_size int := 0;
  v_pve_battles int := 0;
  v_pvp_battles int := 0;
  v_active_friends int := 0;
  v_quests_completable_unclaimed int := 0;
begin
  if v_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  select count(*) into v_workouts
    from public.workouts where user_id = v_user_id;

  select coalesce(sum(copies), 0) into v_owned_cards
    from public.user_cards where user_id = v_user_id;

  select coalesce(array_length(card_ids, 1), 0) into v_active_deck_size
    from public.decks where user_id = v_user_id and is_active = true
    limit 1;

  select count(*) into v_pve_battles
    from public.battles
    where attacker_id = v_user_id and npc_id is not null;

  select count(*) into v_pvp_battles
    from public.battles
    where (attacker_id = v_user_id or defender_id = v_user_id)
      and npc_id is null and defender_id is not null;

  select count(*) into v_active_friends
    from public.friendships
    where user_id = v_user_id and status = 'active';

  select count(*) into v_quests_completable_unclaimed
    from public.daily_quests
    where user_id = v_user_id
      and quest_date = current_date
      and completed_at is not null
      and claimed_at is null;

  return jsonb_build_object(
    'workouts_count', v_workouts,
    'owned_cards_count', v_owned_cards,
    'active_deck_size', v_active_deck_size,
    'pve_battle_count', v_pve_battles,
    'pvp_battle_count', v_pvp_battles,
    'active_friends_count', v_active_friends,
    'quests_completable_unclaimed', v_quests_completable_unclaimed
  );
end; $$;

grant execute on function public.get_nba_state() to authenticated;
