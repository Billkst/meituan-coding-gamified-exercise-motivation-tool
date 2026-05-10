-- 20260510000014_day7_xp_column_fix.sql
-- Fix: claim_achievement and claim_quest used non-existent users.weekly_xp / lifetime_xp.
-- The real schema has users.xp (mirroring submit_workout's pattern: xp += N, season_score += N).

create or replace function public.claim_achievement(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_ach record;
  v_ua record;
  v_card record;
  v_xp_amount int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'auth required'; end if;

  select * into v_ach from public.achievements where id = p_id;
  if not found then raise exception 'achievement not found'; end if;

  select * into v_ua from public.user_achievements
    where user_id = v_user_id and achievement_id = p_id;

  if v_ua is null or v_ua.unlocked_at is null then
    raise exception 'not unlocked';
  end if;
  if v_ua.claimed_at is not null then
    raise exception 'already claimed';
  end if;

  if v_ach.reward_kind = 'xp' then
    v_xp_amount := (v_ach.reward_payload->>'xp')::int;
    update public.users
      set xp = xp + v_xp_amount,
          season_score = season_score + v_xp_amount
      where id = v_user_id;
  elsif v_ach.reward_kind = 'protect' then
    update public.users
      set protect_cards = least(3, protect_cards + 1)
      where id = v_user_id;
  elsif v_ach.reward_kind = 'card' then
    select * into v_card from public.cards where id = (v_ach.reward_payload->>'card_id');
    if found then
      insert into public.user_cards (user_id, card_id, copies)
        values (v_user_id, v_card.id, 1)
        on conflict (user_id, card_id) do update set copies = user_cards.copies + 1;
      update public.decks
        set card_ids = card_ids || v_card.id
        where user_id = v_user_id;
    end if;
  end if;

  update public.user_achievements
    set claimed_at = now()
    where user_id = v_user_id and achievement_id = p_id;

  return jsonb_build_object(
    'ok', true,
    'reward_kind', v_ach.reward_kind,
    'reward_payload', v_ach.reward_payload,
    'achievement_id', p_id
  );
end;
$$;

grant execute on function public.claim_achievement(text) to anon, authenticated;

create or replace function public.claim_quest(p_slot int, p_claim_bonus boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_today date := current_date;
  v_quest record;
  v_user record;
  v_card record;
  v_total_claimed int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'auth required'; end if;

  if p_claim_bonus then
    select * into v_user from public.users where id = v_user_id;
    if v_user.last_quest_bonus_date = v_today then
      raise exception 'bonus already claimed';
    end if;

    select count(*) into v_total_claimed
      from public.daily_quests
      where user_id = v_user_id and quest_date = v_today and claimed_at is not null;
    if v_total_claimed < 3 then
      raise exception 'not all quests claimed';
    end if;

    update public.users
      set xp = xp + 200,
          season_score = season_score + 200,
          last_quest_bonus_date = v_today
      where id = v_user_id;

    select * into v_card from public.cards
      where rarity = 'common' order by random() limit 1;
    if found then
      insert into public.user_cards (user_id, card_id, copies)
        values (v_user_id, v_card.id, 1)
        on conflict (user_id, card_id) do update set copies = user_cards.copies + 1;
      update public.decks
        set card_ids = card_ids || v_card.id
        where user_id = v_user_id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'kind', 'bonus',
      'xp', 200,
      'card_id', v_card.id
    );
  end if;

  select * into v_quest from public.daily_quests
    where user_id = v_user_id and quest_date = v_today and slot = p_slot;

  if not found then raise exception 'quest not found'; end if;
  if v_quest.completed_at is null then raise exception 'not completed'; end if;
  if v_quest.claimed_at is not null then raise exception 'already claimed'; end if;

  update public.users
    set xp = xp + v_quest.reward_xp,
        season_score = season_score + v_quest.reward_xp
    where id = v_user_id;

  update public.daily_quests
    set claimed_at = now()
    where user_id = v_user_id and quest_date = v_today and slot = p_slot;

  return jsonb_build_object(
    'ok', true,
    'kind', 'quest',
    'slot', p_slot,
    'xp', v_quest.reward_xp
  );
end;
$$;

grant execute on function public.claim_quest(int, boolean) to anon, authenticated;
