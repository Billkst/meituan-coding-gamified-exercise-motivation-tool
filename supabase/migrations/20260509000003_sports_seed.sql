-- PULSE 26 项运动 seed
-- Day 2: 2026-05-09
-- icon = @tabler/icons-react component name (per DESIGN.md § Iconography)
-- base_xp_multiplier:  0.80 light · 0.90 light-mod · 1.00 default · 1.10 high · 1.20 burn

insert into public.sports (id, name_zh, name_en, category, icon, base_xp_multiplier, display_order) values
  ('running',         '跑步',     'Running',        'cardio',   'IconRun',             1.00,  1),
  ('cycling',         '骑行',     'Cycling',        'cardio',   'IconBike',            1.00,  2),
  ('swimming',        '游泳',     'Swimming',       'cardio',   'IconSwimming',        1.10,  3),
  ('jump_rope',       '跳绳',     'Jump Rope',      'cardio',   'IconJumpRope',        0.90,  4),
  ('hiit',            'HIIT',     'HIIT',           'cardio',   'IconFlame',           1.20,  5),
  ('rowing',          '划船',     'Rowing',         'cardio',   'IconRowing',          1.10,  6),
  ('weightlifting',   '力量训练',  'Weightlifting',  'strength', 'IconBarbell',         1.10,  7),
  ('boxing',          '拳击',     'Boxing',         'strength', 'IconBoxingGlove',     1.20,  8),
  ('climbing',        '攀岩',     'Climbing',       'strength', 'IconClimbing',        1.20,  9),
  ('calisthenics',    '徒手健身',  'Calisthenics',   'strength', 'IconStretching',      1.00, 10),
  ('basketball',      '篮球',     'Basketball',     'ball',     'IconBallBasketball',  1.10, 11),
  ('football',        '足球',     'Football',       'ball',     'IconBallFootball',    1.10, 12),
  ('badminton',       '羽毛球',    'Badminton',      'ball',     'IconBadminton',       1.00, 13),
  ('pingpong',        '乒乓球',    'Pingpong',       'ball',     'IconPingPong',        0.90, 14),
  ('tennis',          '网球',     'Tennis',         'ball',     'IconBallTennis',      1.10, 15),
  ('volleyball',      '排球',     'Volleyball',     'ball',     'IconBallVolleyball',  1.00, 16),
  ('frisbee',         '飞盘',     'Frisbee',        'ball',     'IconFrisbee',         0.90, 17),
  ('yoga',            '瑜伽',     'Yoga',           'flex',     'IconYoga',            0.90, 18),
  ('pilates',         '普拉提',    'Pilates',        'flex',     'IconStretching2',     0.90, 19),
  ('dance',           '舞蹈',     'Dance',          'flex',     'IconDance',           1.00, 20),
  ('taichi',          '太极',     'Tai Chi',        'flex',     'IconYinYang',         0.80, 21),
  ('martial_arts',    '武术',     'Martial Arts',   'martial',  'IconKarate',          1.10, 22),
  ('judo',            '柔道',     'Judo',           'martial',  'IconShield',          1.10, 23),
  ('hiking',          '徒步登山',  'Hiking',         'outdoor',  'IconHiking',          1.00, 24),
  ('skateboarding',   '滑板',     'Skateboarding',  'outdoor',  'IconSkateboard',      1.00, 25),
  ('skiing',          '滑雪',     'Skiing',         'outdoor',  'IconSkiJumping',      1.10, 26)
on conflict (id) do nothing;
