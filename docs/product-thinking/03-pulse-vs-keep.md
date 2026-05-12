# 03 — PULSE vs Keep (and the rest of the fitness app market)

**Question:** This whole product depends on a thesis — that mainstream
fitness apps under-serve a real user segment. Is the thesis defensible?

## What Keep et al. are very good at

- Workout libraries (yoga / HIIT / running plans) with video instruction
- Heart-rate / GPS integration with wearables
- Social feed + KOL content
- Subscription monetization on premium plans

Keep is a mature product. We're not going to out-Keep Keep on any of those.

## The user we think Keep doesn't serve

> "I know I should exercise. I've installed Keep three times. I open it,
> see 47 workout plans, feel guilty, close it, and do nothing."

This user is **motivation-poor, not information-poor**. Keep's value-add is
mostly content + instruction. For a user who already knows how to walk for
30 minutes, more content is friction, not help.

The persona we built for is:

- Knows what exercise is, does not need a 47-plan picker
- Has *intended* to start exercising for some time, hasn't
- Is on a screen / sitting most of the day (white-collar, student, etc.)
- Plays casual mobile games or has in the past

For this user, the unlock is **lowering the activation energy + adding a
non-fitness incentive layer**. Keep can't add the second piece without
contradicting its identity. We can, because we're not pretending to be a
serious fitness product.

## How the product surface differs

| Surface | Keep | PULSE |
|---------|------|-------|
| First screen | Workout plan picker | "You're on a 3-day streak" + card preview |
| Logging a workout | Pick → execute video → save (30+ s) | Tap → declare → done (<5 s) |
| Reward after workout | XP toward fitness level | Gold + card unlock + tomorrow's streak slot |
| Sticky surface | Followed instructors / friend feed | Your deck + replay of last match |
| Failure mode | Skip a day → silent absence | Skip a day → streak banner + visible loss |

## What we are giving up by going this direction

- **The "I want to actually get fit" power user.** PULSE provides no
  technical coaching. A user past activation will outgrow us and migrate to
  Keep. We accept this — converting a non-exerciser into a regular
  exerciser is the win we're chasing, not retaining a marathon trainer.
- **B2B / corporate wellness contracts.** PULSE's game framing reads as
  childish to enterprise procurement. Keep's neutral aesthetic is closer to
  HR-approval territory. We've left a real revenue door closed by leaning
  into the game language. Conscious choice; a later "PULSE for Teams" SKU
  could rebrand the same engine.
- **Athletic-data depth.** No HRV, no VO2 max trend, no zones. The user
  segment we're after doesn't have those numbers anyway.

## The honest moat question

Keep can clone the gamification layer in a sprint. The defensibility isn't
the mechanic, it's:

1. **First-mover narrative** in the specific niche (gamified anti-fitness-app).
2. **Card-economy depth** — once we have 80+ cards and 6 chest tiers, the
   library + meta becomes the moat (the same way Hearthstone's moat is the
   card pool, not the engine).
3. **The cross-product loop with PvP** — if v1 ships PvP-vs-friend, the
   social graph IS the moat. v0.2 doesn't build PvP; the design holds the
   door open for it.

None of these are real today. The honest answer is: PULSE v0.2 has no moat.
What it has is a **product-thinking demonstration** that the niche is
worth pursuing, and the architecture to chase the moat if early signal
appears.
