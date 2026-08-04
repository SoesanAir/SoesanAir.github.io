# Pop-up events (dilemmas)

The inbound half of the loop: something arrives unasked, between your own actions,
and every way out of it costs you.

Playtest verdict: *"the pop-up events are AWESOME, however very repetitive (we need
5 times options than what we currently have, and we need to watch for repetitive
things in a season) and sometimes unclear to the player (when one player approaches
me, I don't know who the other one they are talking about is)."*

Four things changed.

## 1. Five times the pool

**6 → 30 events.** The original six are in `js/dilemmas.js` (`DILEMMA_KINDS`); the
24 new ones are in `js/dilemma-pool.js` (`DILEMMA_POOL`), kept separate so the pool
can grow without anybody scrolling past the engine. `Dilemmas.all()` concatenates
them and degrades to the original six if the pool file is missing.

Every situation is taken from something the show actually does — being asked to
throw a challenge, two allies asking you to keep the same secret from each other,
three people cornering you and wanting a commitment in front of each other, being
accused of talking to the other side after a swap, somebody asking whether you
would use an idol on them, being told the whole tribe has already agreed a name
(possibly to make you fall in line).

**`truthful` is derived from live game state, not a coin flip.** Whether the named
accomplice really is allied, whether the claimed majority actually exists (summed
vote weights), whether your challenge score really was below the camp mean, whether
your own secrets ledger says you started that rumour. So checking a claim is a real
skill, and a bluff is a real bluff.

## 2. A season stops repeating itself

The old selector avoided the last three ids. With six events that meant one in two
firings was a recent repeat.

Now anything not yet seen **this season** is strongly preferred, and only once every
eligible event has fired does it reuse — and then it takes the least recently seen
rather than a random one. Measured: **20 firings, 20 distinct events, zero
repeats.** A typical season fires around a dozen, so most seasons should never
repeat at all.

Counted per season, not per playthrough: `history` persists across seasons and
would eventually starve the pool.

## 3. You can see who they are talking about

`about` takes a castaway **or an array of them**, and each one is rendered with
their picture and two bars: **bond** and **trust**, toward the player. Which is the
whole basis for deciding what to do about a claim — a name in a sentence is not.

Falls back to an initial when a sprite has not loaded, because a missing face must
not take the event with it.

**20 of the 24 new events name three or more people.** The original six were
nearly all two-handed, and that was the main reason they felt samey. Two of the new
ones are deliberately two-person — after a run of crowd scenes, one conversation
with nobody else in it lands harder.

## 4. An honest denial is the truth

*"make sure the player always has the option to deny something, and if indeed they
didn't do it — it's the truth."*

There was a real bug behind this. `Lying.outcomeOf` returns `'Caught'` purely on a
low belief score, so a player telling the **truth** to a suspicious, low-trust
castaway came back `'Caught'` — and every caller then applied caught-lie penalties
and recorded a lie against them.

`Lying.evaluate` now downgrades `Caught` to `Doubted` whenever `truth === 'Truth'`.
An honest answer can be **disbelieved** — which costs you the conversation, and
should — but it can never be branded a lie, and it is never recorded as one, so the
retro-validation at tribal cannot later "confirm" a lie that never happened. The
listener records that they wronged an honest person, as a hook for vindication.

Measured against a maximally hostile castaway (no trust, no bond, max suspicion):
**0 of 500 honest denials caught, 500 of 500 lies caught.**

Every event that accuses the player carries a flat-denial option, and its `cost`
text says "they may not believe you" rather than "you will be caught", because that
is now what is true.

## Gaps the pool author flagged

Worth recording rather than losing — these are places an event wants to do
something the engine cannot yet:

1. **No challenge-performance hook**, so agreeing to throw a challenge is
   social-only. A pledge flag read by `Challenges.score` would make it mean what it
   says.
2. **No sit-out/bench mechanic**, so an event about who sits out cannot bench them.
3. **No jury memory of dilemma choices.** Owning something in front of the whole
   camp should be worth something at the final vote and currently vanishes.
4. **`Lying` has no outcome for silence**, so refusing to answer leaves no trace
   that can be checked later the way a lie can.

## Where the code is

- `js/dilemmas.js` — the engine, `open()`, `aboutCard()`, the selector
- `js/dilemma-pool.js` — the 24 new events
- `js/dilemma-pool-lines.js` — their claim and staging pools
- `js/dilemma-lines.js` — the original shared pools
- `js/sim.js` — the `Lying.evaluate` truth guarantee
- `css/style.css` — `.dilemma-about`, `.dab*`
- `tools/social-test.js` — pool size, repeat guard, third-party cards
