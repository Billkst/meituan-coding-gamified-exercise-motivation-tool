-- 20260510000013_dev_dispatch_day7_reset.sql
-- Day 7 patch: dev_dispatch.reset_progress now also clears user_achievements + daily_quests
-- (so reset gives a truly clean slate after Day 7 progress hooks land).

create or replace function public.dev_dispatch(p_action text, p_params jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_legendary cards%rowtype;
  v_n int;
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

    else
      raise exception 'unknown action: %', p_action using errcode = '22023';
  end case;

  return jsonb_build_object('action', p_action, 'ok', true);
end; $$;

grant execute on function public.dev_dispatch(text, jsonb) to authenticated;
