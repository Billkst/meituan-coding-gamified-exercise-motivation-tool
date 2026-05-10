-- Day 15: grant Clash gold on every workout via trigger (avoids redefining submit_workout).
-- Formula: 100 + xp_gained × 5, capped at 500.

create or replace function public.handle_workout_clash_gold()
returns trigger as $$
declare
  v_gold_earned int := least(500, 100 + new.xp_gained * 5);
begin
  update cr_account_currency
    set gold = gold + v_gold_earned
   where user_id = new.user_id;
  if not found then
    insert into cr_account_currency (user_id, gold)
    values (new.user_id, 100 + v_gold_earned);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_workout_grant_clash_gold
  after insert on public.workouts
  for each row execute function public.handle_workout_clash_gold();
