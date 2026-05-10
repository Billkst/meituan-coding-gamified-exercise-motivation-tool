-- 20260510000017_day9_get_leaderboard.sql
-- Day 9: get_leaderboard RPC — period-aware ranking + self position + percentile

create or replace function public.get_leaderboard(
  p_period text default 'all',
  p_limit int default 100
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_period_start timestamptz;
  v_total_users int;
  v_user_rank int;
  v_user_score int;
  v_user_percentile int;
  v_entries jsonb;
begin
  if v_user_id is null then raise exception 'auth required'; end if;

  if p_period = 'week' then
    v_period_start := now() - interval '7 days';
  elsif p_period = 'month' then
    v_period_start := now() - interval '30 days';
  elsif p_period = 'all' then
    v_period_start := null;
  else
    raise exception 'invalid period: %', p_period;
  end if;

  with scores as (
    select
      u.id, u.username, u.level, u.current_streak,
      case when v_period_start is null
        then u.season_score::int
        else coalesce((
          select sum(xp_gained)::int
          from public.workouts
          where user_id = u.id and created_at >= v_period_start
        ), 0)
      end as score
    from public.users u
  ),
  ranked as (
    select
      id, username, level, current_streak, score,
      dense_rank() over (order by score desc) as rnk
    from scores
  )
  select
    (select count(*) from public.users)
  into v_total_users;

  select rnk, score from (
    with scores as (
      select
        u.id, u.username, u.level, u.current_streak,
        case when v_period_start is null
          then u.season_score::int
          else coalesce((
            select sum(xp_gained)::int
            from public.workouts
            where user_id = u.id and created_at >= v_period_start
          ), 0)
        end as score
      from public.users u
    ),
    ranked as (
      select
        id, username, level, current_streak, score,
        dense_rank() over (order by score desc) as rnk
      from scores
    )
    select rnk, score from ranked where id = v_user_id
  ) self into v_user_rank, v_user_score;

  v_user_percentile := case
    when v_total_users <= 1 then 0
    when v_user_rank is null then 0
    else 100 - round(v_user_rank::numeric / v_total_users * 100)::int
  end;

  with scores as (
    select
      u.id, u.username, u.level, u.current_streak,
      case when v_period_start is null
        then u.season_score::int
        else coalesce((
          select sum(xp_gained)::int
          from public.workouts
          where user_id = u.id and created_at >= v_period_start
        ), 0)
      end as score
    from public.users u
  ),
  ranked as (
    select
      id, username, level, current_streak, score,
      dense_rank() over (order by score desc) as rnk
    from scores
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'rank', rnk,
    'user_id', id,
    'username', username,
    'level', level,
    'score', score,
    'streak', current_streak,
    'is_self', id = v_user_id
  ) order by rnk, id), '[]'::jsonb) into v_entries
  from ranked
  where rnk <= p_limit;

  return jsonb_build_object(
    'period', p_period,
    'total_users', v_total_users,
    'user_rank', v_user_rank,
    'user_score', v_user_score,
    'user_percentile', v_user_percentile,
    'entries', v_entries
  );
end;
$$;

grant execute on function public.get_leaderboard(text, int) to anon, authenticated;
