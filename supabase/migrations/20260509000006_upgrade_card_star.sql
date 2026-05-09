-- Day 4 · 升星 RPC
-- ★1 → ★2 消耗 2 张同卡
-- ★2 → ★3 消耗 5 张同卡
-- ★3 → ★4 消耗 10 张同卡
-- ★4 → ★5 消耗 20 张同卡
-- ★5 已封顶
--
-- atomic: 单事务 + FOR UPDATE 行锁，防并发双花

create or replace function public.upgrade_card_star(
  p_card_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_card user_cards%rowtype;
  v_threshold int;
  v_new_star int;
  v_new_copies int;
begin
  if v_user_id is null then
    raise exception 'unauthorized: no auth.uid()' using errcode = '28000';
  end if;

  -- lock the row to prevent double-spend
  select * into v_card
  from user_cards
  where user_id = v_user_id and card_id = p_card_id
  for update;

  if not found then
    raise exception 'card not owned: %', p_card_id using errcode = '22023';
  end if;

  if v_card.star_level >= 5 then
    raise exception 'already at max star (5)' using errcode = '22023';
  end if;

  v_threshold := case v_card.star_level
    when 1 then 2
    when 2 then 5
    when 3 then 10
    when 4 then 20
  end;

  if v_card.copies < v_threshold then
    raise exception 'insufficient copies: have %, need %', v_card.copies, v_threshold using errcode = '22023';
  end if;

  v_new_star := v_card.star_level + 1;
  v_new_copies := v_card.copies - v_threshold;

  update user_cards
  set star_level = v_new_star,
      copies = v_new_copies
  where user_id = v_user_id and card_id = p_card_id;

  return jsonb_build_object(
    'card_id', p_card_id,
    'star_level', v_new_star,
    'copies', v_new_copies,
    'consumed', v_threshold
  );
end;
$$;

grant execute on function public.upgrade_card_star(text) to anon, authenticated;
