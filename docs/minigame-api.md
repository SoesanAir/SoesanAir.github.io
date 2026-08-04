# Writing a challenge minigame

Every minigame is a plain object in one of the `js/chal-games-*.js` files. The shell
(`js/chal-shell.js`) owns the arena, the countdown, the clock, the score read-out and the
difficulty maths. A game supplies a verb and a `start(ctx)`.

```js
{
  id: 'brace',                       // unique, short, referenced by Challenge.MAP
  name: 'Chimney Sweep',             // shown in the header and in the briefing
  bucket: 'physical',                // 'physical' | 'mental' | 'nerve' — the fallback pool
  verb: 'sustain',                   // the ONE thing the player does; no two games share one
  tags: ['physicality', 'emotional'],// stat keys that make this game kinder
  how: 'One line of rules, imperative.',
  forChallenges: ['Endurance Hang'], // optional; challenge names this game can serve
  start(ctx) { /* build DOM into ctx.arena, call ctx.done(0..1) exactly once */ }
}
```

## The contract

- `start(ctx)` **must** call `ctx.done(v)` exactly once, with `v` in 0..1. The shell hangs
  forever if you don't, and never resolves the challenge.
- Guard every callback with an `alive`/`done` flag. A timer firing after the game ended and
  calling `ctx.done` twice is the single most common bug in this file set.
- Build into `ctx.arena` only. Never touch anything outside it.
- No canvas, no audio, no images. DOM and CSS only.
- 12–20 seconds of play. These run up to nine times a season; nobody wants a two-minute one.

## ctx

| Member | Purpose |
| --- | --- |
| `ctx.arena` | The element to build into (a flex column). |
| `ctx.ease` | 0..1 from the castaway's relevant stats. |
| `ctx.hard` | `CONFIG.chalDifficulty`. Read it if you need raw difficulty. |
| `ctx.tol(base, easeBonus)` | A window / tolerance / safe zone. Bigger = easier, so hard **divides**. |
| `ctx.rate(base, easeCut)` | A speed / drift / decay. Bigger = harder, so hard **multiplies**. |
| `ctx.span(ms, easeBonus)` | A duration you are **given**. Bigger = easier, so hard **divides**. |
| `ctx.more(base, easeBonus)` | A count you must **reach**. Scales up gently with difficulty. |
| `ctx.setScore(v)` | Update the live score read-out, 0..1. Call it as the player earns. |
| `ctx.clock(ms, onEnd)` | Drive the header countdown bar. Returns `{stop()}`. |
| `ctx.hitstop(ms)` | Brief visual freeze on a hit. |
| `ctx.done(v)` | Finish. Once. |

### Stat weighting is felt as ease, never as points

This is the rule the whole system rests on. `ctx.ease` buys a **kinder game** — a wider
window, a slower drift, a longer look at the pattern, one more dig. It is never added to the
score. A weak castaway who plays well must genuinely be able to beat a strong one who plays
badly, or the minigame is decoration over a stat check.

So: pass ease into `tol`/`span`/`more` as the second argument. Never write
`score += ctx.ease`.

### The `rate()` floor will eat a small value, and the ease with it

`ctx.rate()` clamps with `Math.max(0.02, …)`. Anything you route through it must land
well clear of 0.02 or the clamp returns the same number for a weak and a strong castaway —
the game gets harder than intended **and** silently stops responding to stats. This is a real
bug that shipped once: Last Gasp's tide rise was ~0.008 of the tank per second, `rate()`
handed back 0.02 at both ends of the stat range, and the game was unwinnable and stat-blind
at the same time. If your quantity is naturally tiny, express it in percent and divide at the
point of use.

## Juice

`Juice.fx(el, tier, text)` where tier is `'small' | 'medium' | 'large' | 'bad'` is the normal
call — it bundles pop, shake, particles and a floating label at a consistent intensity.
Also available: `Juice.pop(el, strength)`, `Juice.shake(amount)`, `Juice.flash(colour, ms)`,
`Juice.burst(el, n)`, `Juice.float(el, text, cls)`.

Scale to importance. A routine correct tap is `'small'`. Winning the whole thing is `'large'`.
Shake on every frame is nausea, not feel.

## Helpers in scope

`h(tag, cls, text)` builds an element. `clamp01(x)`, `ri(minInclusive, maxExclusive)`,
`rr(min, max)`, `pick(arr)`, `shuffle(arr)`. `CONFIG` is the global tunables object.

`GAME.cast`, `alive()` and `campmates(c)` exist if a game wants real castaways in it —
`Fallen Comrades` and `Touchy Subjects` do. Guard for their absence so the harnesses, which
run games without a season, don't throw.

## Escalation

Survivor uses five escalation patterns and essentially nothing else. Pick one per game and
commit to it, rather than inventing a sixth:

1. **Add an object at a fixed interval** — Simmotion's extra balls, Roller Ball's extra ball.
2. **Extend or shrink the apparatus in stages** — The Ball Drop's lengthening rod, Chimney
   Sweep's descending foot pegs.
3. **Environmental ramp** — Last Gasp's rising tide, Blue Plate Special's pouring sand.
4. **Mechanical drift as you tire** — Wrist Assured's unwinding rope worsening your leverage.
5. **Temptation** — Probst walks out food and you choose whether to quit for it. The only
   purely social escalation, and the most distinctly Survivor thing in the show.

## Telegraph before you demand

A rhythm or reaction game must show what it wants **before** the moment it wants it, or the
player is guessing. `Log Carry` had a required side and a timing window and displayed
neither; the playtest verdict was "I'm just tapping crazy hoping it will work". Whatever the
input is, there must be something on screen that changes in the second beforehand.

## CSS

One stylesheet per game file, class-prefixed to that file, linked from `index.html`. Shared
widgets (`.cg-lane`, `.cg-dot`, `.cg-grid5`, `.cg-cell`, `.cg-warn`, `.cg-row`, `.cg-b`) live
in `css/challenges.css` — reuse them rather than re-inventing.

Palette variables: `--paper`, `--paper-dim`, `--ink`, `--sand`, `--sand-deep`, `--ember`,
`--ocean`, `--ocean-deep`, `--good`, `--bad`, `--warn`, `--indigo`, `--violet`, `--cream`.
The look is ink on cream paper with 2px black outlines and hard offset shadows — no
gradients except where something is meant to read as sky or water.

Sizing uses `vmin`, never `vh`: the app is CSS-rotated 90° in portrait, so `vh` is the wrong
axis on a phone held upright.

## Testing

`tools/minigame-test.js` walks every entry in `MINIGAMES`, builds a ctx via
`Challenge.makeCtx`, runs `start()`, drives it with synthetic input and asserts that it
resolves. A game that never calls `done()` fails there rather than in someone's season.
