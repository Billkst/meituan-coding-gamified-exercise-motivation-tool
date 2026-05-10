-- 20260510000015_day8_user_stats_rpc.sql
-- Day 8: get_user_stats RPC — single-call aggregation for /stats page
-- Returns: summary metrics + 30-day XP trend + sport breakdown top 10 + arena W/L + card collection by rarity

create or replace function public.get_user_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_user users%rowtype;
  v_today date := current_date;
  v_summary jsonb;
  v_xp_trend jsonb;
  v_sport_breakdown jsonb;
  v_arena jsonb;
  v_card_collection jsonb;
  v_total_minutes int;
  v_card_count int;
  v_card_total_pool int;
  v_arena_wins int;
  v_arena_losses int;
  v_battles_total int;
  v_win_rate_pp int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'auth required'; end if;

  select * into v_user from public.users where id = v_user_id;
  if not found then raise exception 'user not found'; end if;

  -- ===== summary metrics =====
  select coalesce(sum(duration_minutes), 0) into v_total_minutes
    from public.workouts where user_id = v_user_id;

  select count(distinct card_id) into v_card_count
    from public.user_cards where user_id = v_user_id and copies > 0;

  select count(*) into v_card_total_pool from public.cards;

  select
    count(*) filter (where winner_id = v_user_id),
    count(*) filter (where winner_id is not null and winner_id != v_user_id),
    count(*)
  into v_arena_wins, v_arena_losses, v_battles_total
  from public.battles where attacker_id = v_user_id;

  v_win_rate_pp := case when v_battles_total > 0
    then round(v_arena_wins::numeric / v_battles_total * 100)::int
    else 0 end;

  v_summary := jsonb_build_object(
    'joined_days', (v_today - v_user.created_at::date) + 1,
    'total_workouts', v_user.total_workouts,
    'total_minutes', v_total_minutes,
    'total_xp', v_user.xp,
    'level', v_user.level,
    'card_count', v_card_count,
    'card_total_pool', v_card_total_pool,
    'arena_wins', v_arena_wins,
    'arena_losses', v_arena_losses,
    'current_streak', v_user.current_streak,
    'longest_streak', v_user.longest_streak
  );

  -- ===== 30-day XP trend =====
  -- generate_series for full date range, left join workouts daily sum
  select coalesce(jsonb_agg(
    jsonb_build_object('date', d::date, 'xp', coalesce(daily_xp, 0))
    order by d
  ), '[]'::jsonb)
  into v_xp_trend
  from generate_series(v_today - interval '29 days', v_today, interval '1 day') d
  left join (
    select (created_at at time zone 'utc')::date as wd, sum(xp_gained)::int as daily_xp
    from public.workouts
    where user_id = v_user_id
      and created_at >= (v_today - interval '29 days')
    group by wd
  ) w on w.wd = d::date;

  -- ===== sport breakdown (top 10 by count) =====
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'sport_id', sport_id,
      'count', cnt,
      'total_minutes', total_min
    ) order by cnt desc, sport_id asc
  ), '[]'::jsonb)
  into v_sport_breakdown
  from (
    select sport_id, count(*)::int as cnt, sum(duration_minutes)::int as total_min
    from public.workouts
    where user_id = v_user_id
    group by sport_id
    order by count(*) desc, sport_id asc
    limit 10
  ) s;

  -- ===== arena =====
  v_arena := jsonb_build_object(
    'wins', v_arena_wins,
    'losses', v_arena_losses,
    'battles_total', v_battles_total,
    'win_rate_pp', v_win_rate_pp
  );

  -- ===== card collection (by rarity, fixed 4 rows) =====
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'rarity', rarity,
      'owned', owned,
      'total', total
    ) order by case rarity
      when 'common' then 1
      when 'rare' then 2
      when 'epic' then 3
      when 'legendary' then 4
    end
  ), '[]'::jsonb)
  into v_card_collection
  from (
    select
      c.rarity,
      count(distinct c.id)::int as total,
      count(distinct uc.card_id) filter (where uc.copies > 0)::int as owned
    from public.cards c
    left join public.user_cards uc
      on uc.card_id = c.id and uc.user_id = v_user_id
    group by c.rarity
  ) cc;

  return jsonb_build_object(
    'summary', v_summary,
    'xp_trend', v_xp_trend,
    'sport_breakdown', v_sport_breakdown,
    'arena', v_arena,
    'card_collection', v_card_collection
  );
end;
$$;

grant execute on function public.get_user_stats() to anon, authenticated;
