# 01 — Fitness → Gold Mapping

**Question:** How does a workout become an in-game economy reward without making
either side feel cheap?

## The product loop, in one sentence

You exercise → you earn gold → you spend gold to unlock cards → you take a
deck onto the battlefield → you beat the AI → you earn more rewards. The
mapping piece is the first arrow.

## What we did

Each completed workout drops a fixed +200 gold payout into
`cr_account_currency.gold`, atomic with the `submitWorkout` RPC
(migration 27 — `cr_workout_gold` trigger). Type of workout, duration, and
intensity do **not** affect gold this version.

## Why a flat reward, not a duration/intensity formula

Three options were on the table:

1. **Flat** — every workout = same reward
2. **Linear** — minutes × intensity-multiplier
3. **Streak-multiplied** — base × streak-day bonus

We picked (1) for three reasons:

- **Incentive integrity.** A duration/intensity formula tempts users to game
  the input (longer walks, higher HR rationalizations). The product purpose
  is "did you move today?", not "did you optimize the move?" Flat reward
  matches purpose.
- **Onboarding velocity.** A first-time user shouldn't have to learn 4
  variables to know what they earned. The 30-second mock workout in
  onboarding v2 (Step 2) only needs to say "+200 gold" once; that's the
  contract.
- **Pacing parity.** Card-unlock costs (50–500 gold) are tuned so 1 workout
  ≈ 1 unlock-equivalent over 3 sessions. A duration formula would have
  rich users hitting card-ceiling in 2 sessions, killing the loop early.

## The honest trade-off

Flat reward leaves the **intensity dimension untapped**. A 5-min walk and a
60-min HIIT session feel different to the body but identical to the wallet,
which any serious fitness user will notice on day 3. The fix isn't going
back to formulas — it's adding *categorical* differences (e.g., long-form
endurance unlocks a different chest type than HIIT) so the variety dimension
becomes a *qualitative* lever, not a quantitative one. Out of v0.2 scope.

## What's deliberately not in this v0.2

- **GPS tracking / Apple Health import.** Workouts are user-asserted; we
  trust the click. Real fitness products would close the loop here, but the
  evaluation is product thinking, not anti-fraud engineering.
- **Calorie / step formulas.** Same reason. Not part of the mechanic story.
- **Daily / weekly caps.** Limiting reward would force a separate "engaged
  user" loop (return tomorrow for more gold) that we haven't designed yet.
  When we do, daily soft-cap is the cleanest knob to add — it'll feel like a
  natural progression gate, not a punishment.

## Where it lives in code

- `src/api/submitWorkout.ts` — fires the RPC
- `supabase/migrations/20260510000027_day15_workout_gold.sql` — gold trigger
- `src/clash/api/clashState.ts` — surfaces the updated balance to the UI
