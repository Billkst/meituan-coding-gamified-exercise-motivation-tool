-- PULSE Arena extension — Day 5
-- Section 1: ability metadata on cards
-- Section 2: npc_opponents table + seed
-- Section 3: battles extensions + 2 RPCs

-- ============================================================
-- Section 1: alter cards — add ability columns
-- ============================================================
alter table public.cards
  add column ability_kind text check (ability_kind in (
    'damage_buff','defense_buff','heal','shield',
    'pierce','reflect','first_strike','xp_bonus'
  )),
  add column ability_value int not null default 0,
  add column ability_trigger text check (ability_trigger in (
    'on_play','on_attack','on_defend','on_battle_end','passive'
  ));

-- COMMON 26
update public.cards set ability_kind='first_strike',  ability_value=5,  ability_trigger='on_attack' where id='c_sprint';
update public.cards set ability_kind='defense_buff',  ability_value=3,  ability_trigger='on_defend' where id='c_endurance';
update public.cards set ability_kind='damage_buff',   ability_value=1,  ability_trigger='on_attack' where id='c_pace';
update public.cards set ability_kind='shield',        ability_value=3,  ability_trigger='on_play'   where id='c_warmup';
update public.cards set ability_kind='defense_buff',  ability_value=3,  ability_trigger='on_defend' where id='c_stretch';
update public.cards set ability_kind='heal',          ability_value=2,  ability_trigger='on_battle_end' where id='c_breath';
update public.cards set ability_kind='damage_buff',   ability_value=2,  ability_trigger='on_attack' where id='c_focus';
update public.cards set ability_kind='damage_buff',   ability_value=2,  ability_trigger='on_attack' where id='c_resolve';
update public.cards set ability_kind='defense_buff',  ability_value=4,  ability_trigger='on_defend' where id='c_grit';
update public.cards set ability_kind='damage_buff',   ability_value=1,  ability_trigger='on_attack' where id='c_cardio';
update public.cards set ability_kind='pierce',        ability_value=0,  ability_trigger='on_attack' where id='c_strength';
update public.cards set ability_kind='damage_buff',   ability_value=1,  ability_trigger='on_attack' where id='c_balance';
update public.cards set ability_kind='first_strike',  ability_value=4,  ability_trigger='on_attack' where id='c_speed';
update public.cards set ability_kind='reflect',       ability_value=10, ability_trigger='on_defend' where id='c_jump';
update public.cards set ability_kind='damage_buff',   ability_value=2,  ability_trigger='on_attack' where id='c_swing';
update public.cards set ability_kind='damage_buff',   ability_value=2,  ability_trigger='on_attack' where id='c_aim';
update public.cards set ability_kind='damage_buff',   ability_value=1,  ability_trigger='on_attack' where id='c_rhythm';
update public.cards set ability_kind='reflect',       ability_value=8,  ability_trigger='on_defend' where id='c_flex';
update public.cards set ability_kind='defense_buff',  ability_value=4,  ability_trigger='on_defend' where id='c_balance2';
update public.cards set ability_kind='damage_buff',   ability_value=2,  ability_trigger='on_attack' where id='c_grip';
update public.cards set ability_kind='damage_buff',   ability_value=2,  ability_trigger='on_attack' where id='c_kick';
update public.cards set ability_kind='defense_buff',  ability_value=5,  ability_trigger='on_defend' where id='c_block';
update public.cards set ability_kind='damage_buff',   ability_value=1,  ability_trigger='on_attack' where id='c_paddle';
update public.cards set ability_kind='damage_buff',   ability_value=1,  ability_trigger='on_attack' where id='c_pedal';
update public.cards set ability_kind='damage_buff',   ability_value=2,  ability_trigger='on_attack' where id='c_jab';
update public.cards set ability_kind='first_strike',  ability_value=3,  ability_trigger='on_attack' where id='c_glide';

-- RARE 10
update public.cards set ability_kind='damage_buff',   ability_value=1,  ability_trigger='on_attack' where id='r_combo';
update public.cards set ability_kind='damage_buff',   ability_value=4,  ability_trigger='on_attack' where id='r_intervals';
update public.cards set ability_kind='shield',        ability_value=8,  ability_trigger='on_play'   where id='r_zone';
update public.cards set ability_kind='heal',          ability_value=10, ability_trigger='on_battle_end' where id='r_secondwind';
update public.cards set ability_kind='pierce',        ability_value=0,  ability_trigger='on_attack' where id='r_finisher';
update public.cards set ability_kind='reflect',       ability_value=30, ability_trigger='on_defend' where id='r_counter';
update public.cards set ability_kind='damage_buff',   ability_value=3,  ability_trigger='on_attack' where id='r_flow';
update public.cards set ability_kind='heal',          ability_value=5,  ability_trigger='on_battle_end' where id='r_endurance_run';
update public.cards set ability_kind='first_strike',  ability_value=22, ability_trigger='on_attack' where id='r_explosive';
update public.cards set ability_kind='heal',          ability_value=5,  ability_trigger='on_battle_end' where id='r_recovery';

-- EPIC 3
update public.cards set ability_kind='xp_bonus',      ability_value=50, ability_trigger='on_battle_end' where id='e_runner_high';
update public.cards set ability_kind='xp_bonus',      ability_value=100, ability_trigger='on_battle_end' where id='e_apex';
update public.cards set ability_kind='heal',          ability_value=20, ability_trigger='on_battle_end' where id='e_marathon';

-- LEGENDARY 1
update public.cards set ability_kind='damage_buff',   ability_value=25, ability_trigger='passive' where id='l_pulse';

-- ============================================================
-- Section 2: npc_opponents table + RLS + 8 NPC seed
-- ============================================================
create table public.npc_opponents (
  id text primary key,
  name_zh text not null,
  name_en text not null,
  level int not null check (level between 1 and 8),
  deck_card_ids text[] not null check (array_length(deck_card_ids, 1) = 8),
  reward_xp int not null check (reward_xp >= 0),
  unlock_at_level int not null default 1,
  flavor_zh text,
  flavor_en text
);
create index npc_opponents_level_idx on public.npc_opponents (level);

alter table public.npc_opponents enable row level security;
create policy "npc_opponents read" on public.npc_opponents for select using (true);

insert into public.npc_opponents (id, name_zh, name_en, level, deck_card_ids, reward_xp, unlock_at_level, flavor_zh, flavor_en) values
  ('npc_lazy',      '宿舍懒鬼',  'Lazy Roomie',     1, '{c_warmup,c_breath,c_balance,c_endurance,c_pace,c_focus,c_stretch,c_resolve}', 25, 1,
    '只想躺着的对手', 'Just wants to lie down'),
  ('npc_pe',        '体育委员',  'PE Captain',      2, '{c_sprint,c_speed,c_strength,c_endurance,c_focus,c_resolve,c_balance,c_jump}', 40, 1,
    '点名认真的体委', 'Counts your push-ups'),
  ('npc_swimmer',   '泳池常客',  'Pool Veteran',    3, '{c_paddle,c_endurance,c_breath,c_grit,c_balance,r_recovery,r_endurance_run,c_focus}', 55, 3,
    '一千米起步',     'Starts at 1km'),
  ('npc_climber',   '攀岩硬核',  'Climber',         4, '{c_grip,c_strength,c_focus,c_grit,r_combo,r_zone,r_intervals,c_resolve}', 70, 5,
    '指尖即天堂',     'The wall is home'),
  ('npc_boxer',     '拳台老兵',  'Boxing Vet',      5, '{c_jab,c_kick,c_strength,r_combo,r_finisher,r_explosive,c_speed,c_grit}', 90, 8,
    '十五回合站着',   'Stands all 15 rounds'),
  ('npc_dancer',    '心流舞者',  'Flow Dancer',     6, '{c_rhythm,c_flex,c_balance2,r_zone,r_flow,r_intervals,r_secondwind,c_focus}', 110, 12,
    '节拍即心跳',     'Beat is heartbeat'),
  ('npc_marathon',  '终极耐力',  'Endurance Lord',  7, '{r_endurance_run,r_recovery,r_secondwind,c_endurance,c_pace,c_breath,e_marathon,c_grit}', 140, 18,
    '没有终点线',     'No finish line'),
  ('npc_pulse',     'PE 魔王',   'PE Demon',        8, '{l_pulse,e_apex,e_runner_high,r_explosive,r_finisher,r_counter,c_strength,c_speed}', 200, 25,
    '听说过 PULSE 吗','Have you heard of PULSE');

-- ============================================================
-- Section 3: alter battles + 2 RPCs
-- ============================================================
alter table public.battles
  add column npc_id text references public.npc_opponents(id),
  add column log jsonb;

create or replace function public.start_battle(p_npc_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_user_level int;
  v_npc npc_opponents%rowtype;
  v_deck text[];
  v_battle_id bigint;
begin
  if v_user_id is null then
    raise exception 'unauthorized: no auth.uid()' using errcode = '28000';
  end if;

  select level into v_user_level from users where id = v_user_id;

  select * into v_npc from npc_opponents where id = p_npc_id;
  if not found then
    raise exception 'npc not found: %', p_npc_id using errcode = '22023';
  end if;
  if v_user_level < v_npc.unlock_at_level then
    raise exception 'npc locked: need level %', v_npc.unlock_at_level using errcode = '22023';
  end if;

  select card_ids into v_deck
    from decks where user_id = v_user_id and is_active = true;

  if v_deck is null or array_length(v_deck, 1) <> 8 then
    raise exception 'active deck must have exactly 8 cards' using errcode = '22023';
  end if;

  insert into battles (attacker_id, defender_id, npc_id, attacker_deck_ids, defender_deck_ids)
  values (v_user_id, null, p_npc_id, v_deck, v_npc.deck_card_ids)
  returning id into v_battle_id;

  return jsonb_build_object(
    'battle_id', v_battle_id,
    'attacker_deck_ids', to_jsonb(v_deck),
    'defender_deck_ids', to_jsonb(v_npc.deck_card_ids),
    'reward_xp', v_npc.reward_xp,
    'npc_name_zh', v_npc.name_zh,
    'npc_name_en', v_npc.name_en,
    'npc_level', v_npc.level,
    'npc_flavor_zh', v_npc.flavor_zh,
    'npc_flavor_en', v_npc.flavor_en
  );
end; $$;

grant execute on function public.start_battle(text) to authenticated;

create or replace function public.finalize_battle(p_battle_id bigint, p_log jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_battle battles%rowtype;
  v_npc npc_opponents%rowtype;
  v_attacker_hp int;
  v_defender_hp int;
  v_winner uuid;
  v_xp_gained int := 0;
  v_xp_bonus_pct int := 0;
  v_old_score int := 0;
  v_new_score int := 0;
  v_milestone_crossed boolean := false;
begin
  if v_user_id is null then
    raise exception 'unauthorized: no auth.uid()' using errcode = '28000';
  end if;

  select * into v_battle
    from battles where id = p_battle_id and attacker_id = v_user_id
    for update;
  if not found then
    raise exception 'battle not found or not yours: %', p_battle_id using errcode = '22023';
  end if;
  if v_battle.winner_id is not null then
    return jsonb_build_object(
      'result', case when v_battle.winner_id = v_user_id then 'win' else 'lose' end,
      'xp_gained', v_battle.attacker_xp_delta,
      'idempotent', true
    );
  end if;

  if jsonb_array_length(p_log) <> 8 then
    raise exception 'log must have exactly 8 turns, got %', jsonb_array_length(p_log) using errcode = '22023';
  end if;

  v_attacker_hp := (p_log->-1->>'attacker_hp_after')::int;
  v_defender_hp := (p_log->-1->>'defender_hp_after')::int;

  if v_attacker_hp > v_defender_hp then
    v_winner := v_user_id;
    select * into v_npc from npc_opponents where id = v_battle.npc_id;
    select coalesce(sum(ability_value), 0) into v_xp_bonus_pct
      from cards
      where id = any(v_battle.attacker_deck_ids)
        and ability_kind = 'xp_bonus'
        and ability_trigger = 'on_battle_end';
    v_xp_gained := round(v_npc.reward_xp * (1 + v_xp_bonus_pct::numeric / 100));
  end if;

  update battles set
    winner_id = v_winner,
    log = p_log,
    attacker_xp_delta = v_xp_gained
    where id = p_battle_id;

  if v_xp_gained > 0 then
    select season_score into v_old_score from users where id = v_user_id;
    v_new_score := v_old_score + (v_xp_gained / 4);
    v_milestone_crossed := floor(v_old_score / 100.0) < floor(v_new_score / 100.0);

    update users set
      xp = xp + v_xp_gained,
      season_score = season_score + (v_xp_gained / 4)
      where id = v_user_id;
  else
    select season_score into v_new_score from users where id = v_user_id;
  end if;

  return jsonb_build_object(
    'result', case when v_winner is not null then 'win' else 'lose' end,
    'xp_gained', v_xp_gained,
    'base_reward_xp', case when v_winner is not null then (select reward_xp from npc_opponents where id = v_battle.npc_id) else 0 end,
    'final_attacker_hp', v_attacker_hp,
    'final_defender_hp', v_defender_hp,
    'new_season_score', v_new_score,
    'score_milestone_crossed', v_milestone_crossed
  );
end; $$;

grant execute on function public.finalize_battle(bigint, jsonb) to authenticated;
