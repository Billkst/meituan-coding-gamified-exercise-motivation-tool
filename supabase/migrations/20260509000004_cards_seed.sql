-- PULSE cards seed — universal pool, 不绑 sport
-- Day 3: 2026-05-09
--
-- Distribution (40 cards total):
--   common    × 26   (65%) — 每张运动一张同名通卡 + 通用
--   rare      × 10   (25%) — 跨运动通用，技能型
--   epic      × 3    ( 8%) — 史诗稀有，强 buff
--   legendary × 1    ( 2%) — 唯一传说
--
-- 抽卡概率 70/25/4/1 vs 卡池存量 65/25/8/2 — 池更稀有的 epic/legendary 给抽中后惊喜感
-- (drawCards 按 70/25/4/1 抽 rarity，再在 rarity 池里 uniform 抽 id)

-- ===== COMMON ===== 26 — running-themed for variety
insert into public.cards (id, name_zh, name_en, rarity, base_attack, base_defense, ability_text_zh, ability_text_en, synergy_with) values
  ('c_sprint',         '冲刺',     'Sprint',         'common',  12,  6,  '速度 +5%',         'Speed +5%',         '{c_endurance}'),
  ('c_endurance',      '耐力',     'Endurance',      'common',   8, 12,  '续航 +5%',         'Endurance +5%',     '{c_sprint,c_pace}'),
  ('c_pace',           '配速',     'Pace',           'common',  10, 10,  '匀速节奏',         'Steady pace',       '{c_endurance}'),
  ('c_warmup',         '热身',     'Warmup',         'common',   6,  8,  '入场前缓冲',       'Pre-game cushion',  '{}'),
  ('c_stretch',        '拉伸',     'Stretch',        'common',   4, 10,  '减伤 +3%',         'Damage reduction',  '{c_warmup}'),
  ('c_breath',         '呼吸',     'Breath Control', 'common',   5,  9,  '回血 +2/turn',     'Heal +2/turn',      '{c_focus}'),
  ('c_focus',          '专注',     'Focus',          'common',   8,  8,  '暴击率 +3%',       'Crit +3%',          '{c_breath}'),
  ('c_resolve',        '决心',     'Resolve',        'common',  10,  6,  '初始 ATK +2',      'Starting ATK +2',   '{}'),
  ('c_grit',           '韧性',     'Grit',           'common',   6, 12,  '不死一击',         'Survive lethal',    '{c_resolve}'),
  ('c_cardio',         '有氧',     'Cardio Base',    'common',   9,  9,  '通用加成',         'Universal boost',   '{}'),
  ('c_strength',       '力量',     'Strength',       'common',  14,  4,  '高 ATK 低 DEF',    'Glass cannon',      '{}'),
  ('c_balance',        '平衡',     'Balance',        'common',   9,  9,  '稳定输出',         'Even output',       '{c_focus}'),
  ('c_speed',          '速度',     'Speed',          'common',  11,  7,  '先手率 +10%',      'First-strike +10%', '{c_sprint}'),
  ('c_jump',           '跳跃',     'Jump',           'common',  10,  8,  '回避 +5%',         'Dodge +5%',         '{}'),
  ('c_swing',          '挥击',     'Swing',          'common',  11,  7,  '球类协同',         'Ball-class synergy','{c_aim}'),
  ('c_aim',            '瞄准',     'Aim',            'common',   8, 10,  '命中 +5%',         'Accuracy +5%',      '{c_swing,c_focus}'),
  ('c_rhythm',         '节奏',     'Rhythm',         'common',   9,  9,  '舞蹈协同',         'Dance synergy',     '{}'),
  ('c_flex',           '柔韧',     'Flexibility',    'common',   7, 11,  '回避 +4%',         'Dodge +4%',         '{c_stretch}'),
  ('c_balance2',       '稳态',     'Stillness',      'common',   6, 12,  '太极协同',         'Tai-chi synergy',   '{}'),
  ('c_grip',           '握力',     'Grip',           'common',  12,  6,  '攀岩协同',         'Climbing synergy',  '{}'),
  ('c_kick',           '踢击',     'Kick',           'common',  11,  7,  '武术协同',         'Martial synergy',   '{}'),
  ('c_block',          '格挡',     'Block',          'common',   6, 12,  '减伤 +5%',         'Damage reduce 5%',  '{c_grit}'),
  ('c_paddle',         '划水',     'Paddle',         'common',  10,  8,  '游泳协同',         'Swimming synergy',  '{}'),
  ('c_pedal',          '蹬踏',     'Pedal',          'common',  10,  8,  '骑行协同',         'Cycling synergy',   '{}'),
  ('c_jab',            '直拳',     'Jab',            'common',  12,  6,  '拳击协同',         'Boxing synergy',    '{}'),
  ('c_glide',          '滑行',     'Glide',          'common',   9,  9,  '滑板协同',         'Skate synergy',     '{}');

-- ===== RARE ===== 10 — cross-sport tactics
insert into public.cards (id, name_zh, name_en, rarity, base_attack, base_defense, ability_text_zh, ability_text_en, synergy_with) values
  ('r_combo',          '连击',     'Combo',          'rare',    20, 14,  '连续命中 +1 ATK', '+1 ATK on chain',    '{c_speed,c_focus}'),
  ('r_intervals',      '间歇',     'Intervals',      'rare',    18, 16,  '回合制爆发',       'Burst rotation',    '{c_endurance}'),
  ('r_zone',           '心流',     'In The Zone',    'rare',    16, 18,  '专注期间无敌 1t', 'Invuln 1 turn',     '{c_focus,c_breath}'),
  ('r_secondwind',     '第二春',   'Second Wind',    'rare',    14, 20,  '低血量回血 +10',  'Heal at low HP',    '{c_grit,c_resolve}'),
  ('r_finisher',       '终结',     'Finisher',       'rare',    24, 10,  '残血必杀',         'Execute low HP',    '{c_strength}'),
  ('r_counter',        '反击',     'Counter',        'rare',    18, 16,  '受击反伤 +30%',   'Reflect 30%',       '{c_block}'),
  ('r_flow',           '流派',     'Flow State',     'rare',    17, 17,  '随机 buff',        'Random buff',       '{r_zone}'),
  ('r_endurance_run',  '长跑',     'Long Run',       'rare',    15, 19,  '长持续战优势',     'Long-fight buff',   '{c_endurance,c_pace}'),
  ('r_explosive',      '爆发',     'Explosive',      'rare',    22, 12,  '首回合双倍 ATK',  '2× ATK turn 1',     '{c_strength,c_speed}'),
  ('r_recovery',       '恢复',     'Recovery',       'rare',    14, 20,  '回合结束回血 +5', 'End-turn heal +5',  '{c_breath,c_stretch}');

-- ===== EPIC ===== 3 — high-stakes signature cards
insert into public.cards (id, name_zh, name_en, rarity, base_attack, base_defense, ability_text_zh, ability_text_en, synergy_with) values
  ('e_runner_high',    '跑者高潮', 'Runner''s High', 'epic',    32, 24,  '心流叠加 +50% XP', '+50% XP in flow',  '{r_zone,c_endurance}'),
  ('e_apex',           '巅峰',     'Apex',           'epic',    36, 20,  '段位首战双倍奖励', 'Double rank reward','{r_finisher,r_explosive}'),
  ('e_marathon',       '马拉松',   'Marathon',       'epic',    24, 36,  '持久战回血 +20%',  'Long-fight heal',  '{r_endurance_run,r_recovery}');

-- ===== LEGENDARY ===== 1 — the white whale
insert into public.cards (id, name_zh, name_en, rarity, base_attack, base_defense, ability_text_zh, ability_text_en, synergy_with) values
  ('l_pulse',          'PULSE',    'PULSE',          'legendary', 56, 56, '所有运动协同 +25%', 'All-sport synergy','{e_runner_high,e_apex,e_marathon}');
