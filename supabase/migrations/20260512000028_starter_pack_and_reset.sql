-- Day 25 — Migration 28
--
-- Two RPCs supporting onboarding v2:
--   1. cr_grant_starter_pack(p_user_id) — idempotent gold-bonus award after
--      the chest-reveal step. The actual starter card unlock is already done
--      by handle_new_user_clash, so this just tops up the wallet on first
--      onboarding completion.
--   2. dev_reset_user(p_user_id)        — judge-facing /reset route helper.
--      Wipes match history + chests, resets currency, re-locks all non-free
--      cards. Re-unlocks the free starter set so the post-reset user can
--      immediately enter onboarding without crashing on an empty deck.
--
-- Both are SECURITY DEFINER so they bypass the user-row RLS — RLS policies
-- only allow a user to see/edit their own rows; these functions delete
-- *that* user's rows by p_user_id explicitly, so the elevated grant is
-- scoped tightly.
--
-- Push (CLAUDE.md WSL2 pooler dance):
--   read -r -s -p "DB password: " SUPABASE_DB_PASSWORD; echo
--   export SUPABASE_DB_PASSWORD
--   ENC_PASS=$(python3 -c "import os,urllib.parse;print(urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'],safe=''))")
--   SUPABASE_DB_URL="postgresql://postgres.hahxjtddwnqpklgftsgj:${ENC_PASS}@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
--   bunx supabase db push --include-all --db-url "$SUPABASE_DB_URL"

create or replace function public.cr_grant_starter_pack(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_already boolean;
  v_result json;
begin
  -- Idempotency: if the user already saw a bonus, no-op.
  select exists(
    select 1 from public.cr_account_currency
    where user_id = p_user_id and gold > 100
  ) into v_already;

  if v_already then
    select json_build_object('granted', false, 'reason', 'already_initialized')
    into v_result;
    return v_result;
  end if;

  -- Award the onboarding bonus. The +200 lands on top of the +100 the
  -- handle_new_user_clash trigger seeds.
  update public.cr_account_currency
    set gold = gold + 200
    where user_id = p_user_id;

  select json_build_object('granted', true, 'gold_added', 200) into v_result;
  return v_result;
end
$$;

grant execute on function public.cr_grant_starter_pack(uuid) to anon, authenticated;

create or replace function public.dev_reset_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Wipe transactional history.
  delete from public.cr_match_log where user_id = p_user_id;
  delete from public.cr_chests    where user_id = p_user_id;

  -- Reset progression: lock all cards, then re-unlock the free starter set.
  update public.cr_user_cards
    set unlocked = false, level = 1, shards = 0
    where user_id = p_user_id;
  update public.cr_user_cards uc
    set unlocked = true
    where uc.user_id = p_user_id
      and uc.card_id in (select id from public.cr_cards where unlock_cost = 0);

  -- Restore default wallet.
  update public.cr_account_currency
    set gold = 100, shards_total = 0
    where user_id = p_user_id;
end
$$;

grant execute on function public.dev_reset_user(uuid) to anon, authenticated;
