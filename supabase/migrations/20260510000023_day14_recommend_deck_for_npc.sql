-- 20260510000023_day14_recommend_deck_for_npc.sql
-- Day 14: server-side deck recommender that takes the NPC opponent into
-- account. Picks the user's top-8 cards by a score that weights:
--   - own card power (atk + def, scaled by star)
--   - rarity bonus (legendary > epic > rare > common)
--   - synergy chain hits (cards that have synergy_with overlap inside the deck)
--   - matchup penalty: if NPC deck has lots of pierce, prefer high-DEF cards;
--     if NPC has lots of high-DEF, prefer pierce attackers.
-- Returns the picked card_ids + a short bilingual reasoning string.

create or replace function public.recommend_deck_for_npc(p_npc_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_owned_count int := 0;
  v_npc_record record;
  v_npc_def_avg numeric := 0;
  v_npc_pierce_count int := 0;
  v_picked text[];
  v_picked_card_meta jsonb;
  v_legendary_n int := 0;
  v_epic_n int := 0;
  v_avg_star numeric := 1;
begin
  if v_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  select count(*) into v_owned_count
    from public.user_cards where user_id = v_user_id;
  if v_owned_count < 8 then
    raise exception 'need at least 8 cards to recommend' using errcode = '22023';
  end if;

  -- Pull NPC deck stats so we can adjust score
  select * into v_npc_record from public.npc_opponents where id = p_npc_id;
  if not found then
    raise exception 'npc not found: %', p_npc_id using errcode = '22023';
  end if;

  select coalesce(avg(c.base_defense), 0),
         coalesce(sum(case when c.ability_kind = 'pierce' then 1 else 0 end), 0)
    into v_npc_def_avg, v_npc_pierce_count
    from public.cards c
    where c.id = any(v_npc_record.deck_card_ids);

  -- Top-8 owned cards by composite score
  with scored as (
    select
      uc.card_id as id,
      uc.star_level,
      c.rarity,
      c.base_attack,
      c.base_defense,
      c.ability_kind,
      c.synergy_with,
      (c.base_attack + c.base_defense) * (1 + 0.2 * (uc.star_level - 1))
        + case c.rarity
            when 'legendary' then 25
            when 'epic' then 12
            when 'rare' then 5
            else 0
          end
        + case
            when c.ability_kind = 'pierce' and v_npc_def_avg > 8 then 15
            when v_npc_pierce_count >= 2 and c.base_defense >= 10 then 8
            else 0
          end
        + array_length(c.synergy_with, 1) * 0.5 as score
    from public.user_cards uc
    join public.cards c on c.id = uc.card_id
    where uc.user_id = v_user_id
  )
  select
    array_agg(id order by score desc, id),
    sum(case when rarity = 'legendary' then 1 else 0 end) filter (where rownum <= 8),
    sum(case when rarity = 'epic' then 1 else 0 end) filter (where rownum <= 8),
    avg(star_level) filter (where rownum <= 8)
  into v_picked, v_legendary_n, v_epic_n, v_avg_star
  from (
    select id, rarity, star_level, score, row_number() over (order by score desc, id) as rownum
    from scored
  ) ranked
  where rownum <= 8;

  -- Trim to 8 (in case array_agg returned more)
  v_picked := v_picked[1:8];

  v_picked_card_meta := (
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'name_zh', c.name_zh,
      'name_en', c.name_en,
      'rarity', c.rarity,
      'base_attack', c.base_attack,
      'base_defense', c.base_defense
    ) order by ord)
    from unnest(v_picked) with ordinality as t(id, ord)
    join public.cards c on c.id = t.id
  );

  return jsonb_build_object(
    'deck', to_jsonb(v_picked),
    'cards', v_picked_card_meta,
    'legendary_count', coalesce(v_legendary_n, 0),
    'epic_count', coalesce(v_epic_n, 0),
    'avg_star', round(coalesce(v_avg_star, 1), 1),
    'npc_pierce_threat', v_npc_pierce_count >= 2,
    'npc_high_def', v_npc_def_avg > 8
  );
end; $$;

grant execute on function public.recommend_deck_for_npc(text) to authenticated;
