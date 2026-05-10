-- Day 15: extend dev_dispatch with 4 Clash actions for review-mode helpers.
-- grant_gold, unlock_all_cr_cards, instant_open_chests, reset_clash

create or replace function public.dev_dispatch(p_action text, p_params jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_legendary cards%rowtype;
  v_n int;
  v_amount int;
begin
  if v_user_id is null then raise exception 'unauthorized' using errcode = '28000'; end if;

  case p_action
    when 'set_streak' then
      v_n := coalesce((p_params->>'n')::int, 0);
      update users set current_streak = greatest(v_n, 0) where id = v_user_id;

    when 'grant_legendary' then
      select * into v_legendary from cards where rarity = 'legendary' order by random() limit 1;
      if v_legendary.id is null then raise exception 'no legendary cards'; end if;
      insert into user_cards (user_id, card_id, copies) values (v_user_id, v_legendary.id, 1)
        on conflict (user_id, card_id) do update set copies = user_cards.copies + 1;

    when 'level_up' then
      update users set level = level + 1, xp = 0 where id = v_user_id;

    when 'break_streak' then
      update users set
        current_streak = 0,
        last_workout_date = (current_date - 1),
        freeze_xp_until = null
        where id = v_user_id;
      update streaks
        set status = 'broken', end_date = (current_date - 1)
        where user_id = v_user_id and status = 'active';
      insert into streaks (user_id, start_date, length, status)
        values (v_user_id, current_date - 11, 10, 'broken');

    when 'reset_progress' then
      delete from user_cards where user_id = v_user_id;
      delete from workouts where user_id = v_user_id;
      delete from battles where attacker_id = v_user_id;
      update decks set card_ids = '{}'::text[] where user_id = v_user_id;
      delete from streaks where user_id = v_user_id;
      delete from public.user_achievements where user_id = v_user_id;
      delete from public.daily_quests where user_id = v_user_id;
      update users set
        level = 1, xp = 0, total_workouts = 0,
        current_streak = 0, longest_streak = 0,
        last_workout_date = null,
        protect_cards = 0,
        season_score = 0,
        freeze_xp_until = null,
        last_protect_grant_at = now(),
        exploration_buffs = '{}'::jsonb,
        last_quest_date = null,
        last_quest_bonus_date = null
        where id = v_user_id;

    when 'grant_protect' then
      update users set protect_cards = least(protect_cards + 1, 3) where id = v_user_id;

    when 'reset_onboarding' then
      update users set onboarded_at = null where id = v_user_id;

    when 'grant_gold' then
      v_amount := coalesce((p_params->>'amount')::int, 1000);
      update cr_account_currency set gold = gold + v_amount where user_id = v_user_id;
      if not found then
        insert into cr_account_currency (user_id, gold) values (v_user_id, 100 + v_amount);
      end if;

    when 'unlock_all_cr_cards' then
      insert into cr_user_cards (user_id, card_id, unlocked, level)
      select v_user_id, id, true, 5 from cr_cards
      on conflict (user_id, card_id) do update
        set unlocked = true, level = greatest(cr_user_cards.level, 5);

    when 'instant_open_chests' then
      update cr_chests set unlocks_at = now()
       where user_id = v_user_id and not opened;

    when 'reset_clash' then
      delete from cr_user_cards where user_id = v_user_id;
      delete from cr_user_decks where user_id = v_user_id;
      delete from cr_chests where user_id = v_user_id;
      delete from cr_match_log where user_id = v_user_id;
      update cr_account_currency set gold = 100, shards_total = 0 where user_id = v_user_id;
      -- re-init defaults like handle_new_user_clash
      insert into cr_user_decks (user_id, cards) values (
        v_user_id,
        array['knight','archer','goblin','giant','musketeer','valkyrie','arrows','cannon']
      ) on conflict (user_id) do update set cards = excluded.cards, updated_at = now();
      insert into cr_user_cards (user_id, card_id, unlocked, level)
      select v_user_id, id, true, 1 from cr_cards where unlock_cost = 0
      on conflict (user_id, card_id) do update set unlocked = true, level = 1, shards = 0;

    else
      raise exception 'unknown action: %', p_action using errcode = '22023';
  end case;

  return jsonb_build_object('action', p_action, 'ok', true);
end; $$;

grant execute on function public.dev_dispatch(text, jsonb) to authenticated;
