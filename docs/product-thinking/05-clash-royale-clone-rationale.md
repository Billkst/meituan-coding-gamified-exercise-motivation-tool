# 05 — Why Clash Royale Clone?

**Question:** Of all the game genres we could have used as the "you exercise
→ you play games" carrot, why specifically a real-time card battler
modeled on Supercell's Clash Royale?

## What we needed from the game half

For PULSE the game is not the product, the fitness loop is. The game is the
**reward delivery vehicle**. The constraints it has to satisfy:

1. **Recognizable on first contact.** A judge has 5 minutes; we cannot teach
   a novel mechanic. The user must look at the screen and think "oh, I know
   what this is."
2. **Short sessions.** A workout is once a day; the resulting play session
   needs to be under 5 minutes or the loop breaks (user starts skipping
   workouts to free up play time, which inverts the incentive).
3. **Card-collection-shaped rewards.** The "you earned a card" moment is
   the variable-reward beat the habit loop depends on (Doc 02). Other
   genres reward differently (puzzle progress, level XP) and don't compose
   with our fitness-to-currency mapping.
4. **Single-player feasible.** No human matchmaking, no signalling layer.

## Why CR specifically clears all four

- **#1 (recognizable):** Clash Royale is one of the most-installed mobile
  games of the last decade. The "two lanes, two princess towers, drop cards
  on your half, river in the middle" layout is functionally a cultural meme
  inside the gaming demographic we're targeting (Doc 03).
- **#2 (session length):** Default match is 3 minutes. Onboarding tutorial
  goal (one princess tower) is hittable in ~90 seconds.
- **#3 (cards):** It IS a card collection game. Trivial fit.
- **#4 (single-player):** The game's engine state machine is straightforward
  — units, towers, elixir, lanes, bridges. The AI opponent is a scripted
  policy, not a learned model. We could build this without standing up
  multiplayer infrastructure.

## What we did NOT clone (IP-safety)

| Cloned | Not cloned |
|--------|-----------|
| Two-lane layout | Card names, art, sound effects |
| Elixir bar pacing | Specific card identities (Mini P.E.K.K.A → `mini_warrior` rename — see Doc on sprite pipeline) |
| Bridge-routing for ground units | Crown chest progression, Pass Royale subscription |
| Tower hierarchy (king + 2 princess) | Clan system, Tournament mode |
| 8-card hand-rotation pile | Decay mechanic on losses |

The visual art is **AI-generated dark-fantasy cartoon** with a #b6ff3c neon
lime accent palette, *not* the Supercell pastel-bright style. The shared
language is mechanical (lanes, elixir, towers), not visual.

## Other genres we considered and rejected

- **Match-3 (Candy Crush style):** Strong on session length + variable
  reward, weak on card-shaped rewards. Doesn't compose.
- **Idle / Cookie Clicker style:** Doesn't need user attention at all, so
  the workout-to-play motivation arrow weakens. Player can just leave the
  tab open.
- **JRPG-style turn-based battler:** Better card economy, but sessions run
  10+ minutes and pacing is unbearable. Onboarding would also be 2× longer
  ("here's the turn system, here's the menu, here's the elemental wheel…").
- **Auto-battler (TFT / Hearthstone Battlegrounds):** Right card density,
  wrong session length. 15–25 minute matches.
- **Roguelike deck-builder (Slay the Spire):** Best card-economy fit, but
  the game requires teaching new mechanics every run. PULSE's user already
  resisted complexity in fitness apps; we're not asking them to learn a
  deck-builder.

CR-style is the local optimum across all four constraints.

## What the clone costs us

- **Originality lens.** PULSE looks derivative on first contact. A judge
  thinking "I've seen this before" is a real signal cost. We accept it
  because that exact familiarity is the unlock for constraint #1.
- **IP risk vector.** Even with the rename + AI art, Supercell could
  plausibly object. A real launch would either request a license or further
  diverge the mechanic surface (different tower count, no elixir, etc.).
  v0.2 is evaluation-scope, not launch-scope; the risk is theoretical.
- **Comparison ceiling.** Every player will involuntarily compare us to
  Supercell's polish. We will lose that comparison on every axis except
  "tied to your real workouts" — which is the only axis we asked them to
  evaluate on. The visual quality is intentionally 7/10, not 10/10, because
  10/10 isn't where the product points.

## What makes this defensible as a real product (not just an evaluation)

PvP between friends who both committed to a workout regimen is the v1
unlock. Imagine: "we both ran today, our cards stack up against each
other tonight." The fitness layer becomes the *qualifier* that gates the
play layer. Now Clash Royale's mechanic, plus a fitness moat, equals a
product Supercell genuinely cannot ship — because their hands are tied to
their game-only IP.

v0.2 ships the architecture for that future without paying the cost of
building it yet.
