# 04 — Intentional Fakes

**Question:** Where in the demo is the user looking at *real* product, and
where are they looking at theatre? An evaluation has to declare its
faked surfaces — pretending they're real is dishonest, hiding them is
suspicious.

## The fakes, listed

| Surface | What's fake | What "real" would look like |
|---------|-------------|------------------------------|
| **Workout logging** | One tap "I exercised" with no validation. We trust the click. | GPS track, HRV, accelerometer integration via Apple Health / Google Fit. |
| **Mock workout (onboarding step 2)** | 30 s countdown ≠ a workout. No data is captured. | Real workout takes 5–60 min and produces metrics; onboarding can't sit there for 5 min. |
| **AI opponent** | Hard-coded archetype scripts in `src/clash/engine/ai.ts`, three difficulty bands. Pretends to be other humans the way casino games pretend other gamblers are real. | Real PvP with matchmaking, ELO, reconnect logic, server-authoritative simulation. |
| **Match finalization** | Client-trust — the browser tells the server "I won, give me gold". A motivated cheater can curl the RPC. | Server-side simulation replay, or the server hosts the engine. |
| **Sprites** | AI-generated single-frame images + frontend tween. There's no idle/walk/attack frame, there are 4 distinct *poses* with synthesized animation in between. | Multi-frame spritesheets hand-drawn by an artist (Supercell ships ~60 frames per card). |
| **Audio** | Web Audio API synth — oscillators, not recordings. No production foley, no music. | Mixed mp3 stems, ambient battlefield audio, voice-over for tower destruction. |
| **Card library size** | 12 cards. Real CR-style products ship 100+ for meta depth. | Same engine, 100+ cards with cycle-balanced kits across a card pool. |
| **Auth** | Supabase anonymous + auto-create. No email, no password, no recovery. | Real signup + email verification + password reset + OAuth providers. |
| **Social** | None. No friends, no leaderboard. v0.1 had these; we removed them in v0.2. | Friends graph, daily leaderboard, replay sharing. |

## Where we draw the line: theatre vs lie

A fake becomes a lie when it claims to be something it isn't. We avoid this
by:

- **No fake user counts.** No "12,438 active users" banner. v0.1 had a stub
  leaderboard with 8 demo opponents; v0.2 deleted it.
- **No fake testimonials.** No "Sarah lost 12 kg with PULSE" carousel.
- **No fake real-time presence.** The PvP-looking AI is labeled "AI" in
  `clash.match.ai_deploys` strings; we don't hide that the opponent isn't a
  human.
- **Reset is explicit.** `/reset?force=1` exists so a judge can prove the
  flow is reproducible from zero — no hidden seeded state.

## The fakes we want to defend

> "Why didn't you build PvP?"

PvP is theatre's expensive cousin — every component costs 5× to get to a
demo state. A signalling layer, latency tolerance, simulation determinism,
reconnect logic, cheat detection. For an evaluation that runs the app once
for 5 minutes, building any of that is throwing away weeks for zero
evaluation gain. Single-player + scripted AI is the right size of fake.

> "Why didn't you build real fitness tracking?"

Because the product hypothesis (Doc 03) is that the user we're after
doesn't *want* fitness tracking — that's the friction we removed. Building
HRV integration would contradict the core thesis. Click-to-log is the
product, not a placeholder for it.

> "Why is the sprite a single frame with tween, not 4-frame anim?"

`docs/product-thinking/asset-prompt-log.md` covers this in detail. Short
answer: gpt-image-2 cross-frame consistency was unreliable; faking motion
in JavaScript is more controllable than faking it in the image model. The
result is "AI-generated cartoon character with applied tween" — which
visibly *is* what it claims to be.

## How to spot the fakes while testing

- Click the **mute toggle** in /clash/match — the sounds are obviously
  synth, that's the audio side honest about itself.
- **Replay a match** and you'll notice the AI uses one of three policies
  (easy/normal/hard) that change reaction speed and elixir thresholds,
  not creativity. Hand-written, not learned.
- **Reset and replay onboarding** — if the experience is identical down to
  the cards revealed in step 3, that proves the chest is scripted, not RNG.

The product is honest about being a demo because a demo that overclaims
fails the evaluation harder than one that underclaims.
