-- 20260510000011_day6_streak_protect_revive.sql
-- Day 6: onboarding gate + streak protect/revive + dev_dispatch

-- ============================================================
-- 1. ALTER users — 3 new fields
-- ============================================================
alter table public.users
  add column if not exists onboarded_at timestamptz,
  add column if not exists freeze_xp_until timestamptz,
  add column if not exists last_protect_grant_at timestamptz;

-- Backfill last_protect_grant_at = created_at for existing users
update public.users
  set last_protect_grant_at = created_at
  where last_protect_grant_at is null;
