-- Day 27: rewrite submit_workout to draw from cr_cards (Clash deck) instead
-- of v1 public.cards. User feedback: drawn cards had no relationship to the
-- battle deck (v1 cards were workout-themed attack/defense placeholders;
-- v2 battles use cr_cards exclusively). Now every workout grants a real
-- Clash card unlock or shard top-up.
--
-- Changes vs the Day 3 version:
--   - draw v_drawn_card_id from public.cr_cards (12-card catalog)
--   - fall through legendary → epic → rare → common when a rarity pool is
--     empty (current catalog has no legendary cards, so high rolls always
--     resolve down to epic)
--   - shards_earned by rarity: common 5 / rare 3 / epic 1 / legendary 1
--   - upsert cr_user_cards: unlock if locked, accumulate shards either way
--   - increment cr_account_currency.shards_total
--   - same return top-level shape, but card_drawn.id is now a cr_card id
--     ('knight', 'archer', etc.) and card_drawn includes shards_earned
--
-- Push (CLAUDE.md WSL2 pooler dance):
--   read -r -s -p "DB password: " SUPABASE_DB_PASSWORD; echo
--   export SUPABASE_DB_PASSWORD
--   ENC_PASS=$(python3 -c "import os,urllib.parse;print(urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'],safe=''))")
--   SUPABASE_DB_URL="postgresql://postgres.hahxjtddwnqpklgftsgj:${ENC_PASS}@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
--   bunx supabase db push --include-all --db-url "$SUPABASE_DB_URL"

create or replace function public.submit_workout(
  p_sport_id text,
  p_duration_minutes int,
  p_intensity text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sport sports%rowtype;
  v_user users%rowtype;
  v_intensity_mult int;
  v_xp_gained int;
  v_today date := (now() at time zone 'utc')::date;
  v_yesterday date := v_today - interval '1 day';
  v_new_streak int;
  v_streak_status text;
  v_buff numeric;
  v_buff_pp int;
  v_rare_pp int;
  v_epic_pp int;
  v_legendary_pp int;
  v_common_pp int;
  v_roll int;
  v_rarity text;
  v_drawn_card_id text;
  v_shards_earned int;
begin
  if v_user_id is null then
    raise exception 'unauthorized: no auth.uid()' using errcode = '28000';
  end if;

  if p_intensity not in ('light', 'medium', 'high') then
    raise exception 'invalid intensity: %', p_intensity using errcode = '22023';
  end if;
  if p_duration_minutes < 1 or p_duration_minutes > 600 then
    raise exception 'invalid duration: %', p_duration_minutes using errcode = '22023';
  end if;

  select * into v_sport from sports where id = p_sport_id;
  if not found then
    raise exception 'unknown sport: %', p_sport_id using errcode = '22023';
  end if;

  v_intensity_mult := case p_intensity
    when 'light'  then 1
    when 'medium' then 2
    when 'high'   then 3
  end;
  v_xp_gained := round(p_duration_minutes * v_intensity_mult * v_sport.base_xp_multiplier);

  select * into v_user from users where id = v_user_id for update;
  if not found then
    raise exception 'user row missing for auth uid: %', v_user_id;
  end if;

  if v_user.last_workout_date is null or v_user.last_workout_date < v_yesterday then
    v_new_streak := 1;
    v_streak_status := 'new';
    update streaks
      set status='broken', end_date = v_user.last_workout_date
      where user_id = v_user_id and status = 'active';
    insert into streaks (user_id, start_date, length, status)
      values (v_user_id, v_today, 1, 'active');
  elsif v_user.last_workout_date = v_yesterday then
    v_new_streak := v_user.current_streak + 1;
    v_streak_status := 'continued';
    update streaks
      set length = v_new_streak
      where user_id = v_user_id and status = 'active';
  else
    v_new_streak := v_user.current_streak;
    v_streak_status := 'same_day';
  end if;

  -- ===== card rarity roll (same probability ladder as Day 3) =====
  v_buff := coalesce((v_user.exploration_buffs->>p_sport_id)::numeric, 0);
  v_buff_pp := round(v_buff * 100);
  v_rare_pp := 25 + v_buff_pp;
  v_epic_pp := 4 + (v_buff_pp / 6);
  v_legendary_pp := 1 + (v_buff_pp / 30);
  v_common_pp := 100 - v_rare_pp - v_epic_pp - v_legendary_pp;
  if v_common_pp < 0 then v_common_pp := 0; end if;

  v_roll := floor(random() * 100)::int;
  if v_roll < v_common_pp then
    v_rarity := 'common';
  elsif v_roll < v_common_pp + v_rare_pp then
    v_rarity := 'rare';
  elsif v_roll < v_common_pp + v_rare_pp + v_epic_pp then
    v_rarity := 'epic';
  else
    v_rarity := 'legendary';
  end if;

  -- Draw from cr_cards; fall through empty rarity tiers.
  select id into v_drawn_card_id
    from public.cr_cards where rarity = v_rarity
    order by random() limit 1;
  if v_drawn_card_id is null and v_rarity = 'legendary' then
    v_rarity := 'epic';
    select id into v_drawn_card_id
      from public.cr_cards where rarity = v_rarity
      order by random() limit 1;
  end if;
  if v_drawn_card_id is null and v_rarity = 'epic' then
    v_rarity := 'rare';
    select id into v_drawn_card_id
      from public.cr_cards where rarity = v_rarity
      order by random() limit 1;
  end if;
  if v_drawn_card_id is null then
    v_rarity := 'common';
    select id into v_drawn_card_id
      from public.cr_cards where rarity = v_rarity
      order by random() limit 1;
  end if;
  if v_drawn_card_id is null then
    raise exception 'cr_cards catalog is empty';
  end if;

  v_shards_earned := case v_rarity
    when 'common'    then 5
    when 'rare'      then 3
    when 'epic'      then 1
    when 'legendary' then 1
  end;

  -- ===== INSERT workout (audit row) =====
  -- cards_drawn now holds a cr_card id; the column references public.cards
  -- as a soft text array, so referential integrity is unaffected.
  insert into workouts (user_id, sport_id, duration_minutes, intensity, xp_gained, cards_drawn)
    values (v_user_id, p_sport_id, p_duration_minutes, p_intensity, v_xp_gained, array[v_drawn_card_id]);

  -- ===== UPSERT cr_user_cards =====
  -- If the user already owns the card → +shards. If locked → unlock + shards.
  insert into cr_user_cards (user_id, card_id, unlocked, level, shards)
    values (v_user_id, v_drawn_card_id, true, 1, v_shards_earned)
    on conflict (user_id, card_id) do update
    set unlocked = true,
        shards = cr_user_cards.shards + excluded.shards;

  -- Mirror onto the currency row so the home screen shard counter stays
  -- in sync with the sum of per-card shards.
  update cr_account_currency
    set shards_total = shards_total + v_shards_earned
    where user_id = v_user_id;

  -- ===== UPDATE users =====
  update users set
    xp = xp + v_xp_gained,
    total_workouts = total_workouts + 1,
    current_streak = v_new_streak,
    longest_streak = greatest(longest_streak, v_new_streak),
    last_workout_date = v_today,
    season_score = season_score + v_xp_gained
  where id = v_user_id;

  -- ===== return =====
  return jsonb_build_object(
    'xp_gained', v_xp_gained,
    'card_drawn', jsonb_build_object(
      'id', v_drawn_card_id,
      'rarity', v_rarity,
      'shards_earned', v_shards_earned
    ),
    'streak', v_new_streak,
    'streak_status', v_streak_status
  );
end;
$$;

grant execute on function public.submit_workout(text, int, text) to anon, authenticated;
