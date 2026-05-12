# 02 — Habit Loop

**Question:** What's the psychological model behind "you'll come back
tomorrow"? Not "did we add streaks", but *why* the loop is supposed to stick.

## The model we used

We borrowed Nir Eyal's **Hooked** framework, not because it's profound but
because it's the smallest model that names every part of what a habit-forming
product needs to provide. It's four pieces:

1. **Trigger** — what makes the user open the app today?
2. **Action** — what's the lowest-friction thing they do?
3. **Variable reward** — what feels different each time so the brain stays
   engaged?
4. **Investment** — what's the user leaving behind that pulls them back
   tomorrow?

## How PULSE fills each slot

| Slot | What we built | Why this and not something fancier |
|------|---------------|------|
| **Trigger** | Streak counter on ClashHome ("Day 3 / 7") + a streak-loss banner when broken | We don't push notifications (no permission system, no server-side scheduler). Streak-on-launch is the cheapest persistent trigger and the one that compounds: the trigger gets stronger as the streak grows. |
| **Action** | One-tap "Workout" from sidebar → log a workout. 30 s flow on the happy path. | Could ask for sport type, duration, intensity, mood — but each extra field is a drop-off cliff. We deliberately don't. The mock workout in onboarding teaches the user: "this is what logging looks like, you've already done it." |
| **Variable reward** | Card pulls (which card?), chest variants (which rarity?), match outcome (win/lose/draw), AI deploy hints (what enemy is coming?) | The card-pull pulls double duty — it's the reward *and* an investment trigger (you wanted that knight, now you need to play with it). Variable on *kind*, not just *amount*. |
| **Investment** | Deck composition, unlocked-card library, season XP, replay history | Each match adds to a personal-history surface. After 5 matches the user has *their* deck, not a generic loadout. Backing out costs something. |

## What we explicitly didn't build (and why)

- **Streak revive currency.** v0.1 had a "shard" revive system. We removed
  it in v0.2 because the streak-broken banner is enough psychological pressure
  on its own; an in-app "buy back yesterday" felt mercenary in a fitness
  context. Loss aversion works without monetizing it.
- **Daily quests.** v0.1 had three rotating quests; v0.2 cuts them. Reason:
  they fragmented attention. The single PULSE loop (workout → cards → battle)
  is the entire surface area v0.2 wants to teach. Quests would have been a
  parallel game.
- **Social proof / leaderboards.** v0.1 had a leaderboard. Removed in v0.2.
  The product is "you vs your past self" — leaderboard reframes it as "you
  vs the top whale", which is the wrong contract for a fitness product
  evaluation.

## The honest weakness

Habit loops typically need **months** to validate. We're shipping an
evaluation MVP that the judge runs once. So everything in this doc is
*designed* habit-formation, not *measured* habit-formation. The only loop
component the judge can verify is variable-reward (chest reveals + AI
behavior); the others are claims, not evidence. That's a real gap, and
collecting return-rate data would be the v0.3 instrumentation pass.

## Loss aversion is the lever we lean on hardest

Kahneman & Tversky put losing $5 at ~2× the felt impact of gaining $5. We
exploit this once, on the streak surface: a 6-day streak that resets feels
disproportionately bad relative to the modest pleasure of *building* a 6-day
streak. This is the engine that drags users back on a low-motivation day.
We don't compound it — no XP loss, no card-decay, no rank demotion — because
beyond one application it stops being a useful nudge and starts feeling
hostile.
