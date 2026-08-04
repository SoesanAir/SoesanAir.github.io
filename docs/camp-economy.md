# The camp labour economy

The camp used to be a private menu the player poked at for a trickle of relationship
points. Nobody else lived there. This is the design of the version that replaced it,
and — more usefully — the record of what the balance work found.

## The board

Five standing needs, each `0..1` where 1 is "sorted". They decay daily, scaled by
weather and by how many people the camp is feeding.

| Need | What it is | Weather that hurts it | Restored by |
|---|---|---|---|
| **Firewood** | The pile the fire eats every night | Rain, storm (wet wood) | Haul firewood — *Forest*, `chop` |
| **Water** | Boiled drinking water | Heat | Boil water — *The Well*, `haul` |
| **Food store** | The shared basket | Storm, heat | Forage and fish — *Rocks*, `gather` |
| **Shelter** | The roof | Rain, and violently in a storm | Shore up the shelter — *Shelter*, `build` |
| **Camp** | Cleanliness | Everything | Clean up camp — *Camp*, `tidy` |

Plus **the fire**, which is derived rather than worked directly: it burns the woodpile
down each night, and with no wood it gutters out. `Work the fire` (*Fire Pit*, `tend`)
converts wood into fire and is the only thing that trains the hidden fire-making skill
the final four turns on.

Everything happens somewhere. A castaway on firewood walks into the treeline; somebody
on water goes to the well. Each job carries an `act` tag (`chop`, `haul`, `gather`,
`build`, `tidy`, `tend`, `eat`, `sleep`) which `Beach.sendToWork` writes onto the figure
as `data-act` plus an `.act-<name>` class. That is the animation hook — a real per-action
rig animation drops into `css/style.css` without the labour system needing to know.

## Who helps

`WORK_ETHIC` is hidden, per temperament, and never shown as a number. Camp Provider
sits at 0.92; Villain Arc at 0.10. Personal spread and the practical stats move it a
little either way, so two Social Butterflies are not identically useless.

Measured over 24 days across 20 re-rolled tribes:

```
Camp Provider     ~30 jobs      Bitter Veteran    ~13 jobs
Loyal Soldier     ~30           Strategic Vet     ~10
Reluctant Hero    ~26           Paranoid Schemer  ~11
Fan Favorite      ~21           Villain Arc       ~2
Under The Radar   ~18
```

`WORK_VALUES` is the other half: how much each temperament *judges* everyone else for
it. A Camp Provider keeps score all season. A Chaos Agent could not tell you who
fetched the water. This is why the same behaviour lands differently in different tribes.

## The ledger

`Ledger.rep(c)` is what the tribe has noticed **lately**, measured against what everyone
else is doing — relative, because "he never helps" is always a comparison. Memory is a
four-day EWMA, so one lazy day is survivable and one good day is genuinely redemptive.

It feeds four things:
- **Daily opinion drift** — tiny per day, scaled by how much the observer cares, capped
  at `campRelDriftCap` (0.22) per pair so it can never become the whole relationship.
- **Vote weight** — capped at `campVoteWeightMax` (0.90), well under a deliberate push
  (1.5). A real reason to write a name, never the only one.
- **Gossip** — ambient NPC-to-NPC talk the player overhears, which moves votes.
- **Morale** — being the one who carries camp lifts you; being the one everybody has
  noticed doing nothing sits on you.

## Calling it out

The player can tell the tribe what needs doing. The whole mechanic hangs on one rule:
**how much weight your words carry is your own record.** Work, and people move. Do
nothing, and they tell you where to go. Measured: a grafter (standing 1.0) gets ~7 of 8
on their feet; a shirker (standing 0.17) gets ~8 of 8 pushing back and loses bond for it.
Saying the same thing twice in a day is ignored and costs you.

That rule is also what makes the feature un-spammable, which is why it is the rule and
not a cooldown.

## Nights

One event a night at most, graded, and **never lethal** — no night event can eliminate
anybody. Eight bad (rain in the shelter, the fire out, rats in the food, the storm
taking the roof, the water running out, somebody getting sick, the tide taking the gear,
nobody sleeping) and three good (a good night, a proper meal, a clear night). A quiet,
uneventful night is the baseline.

A bad night also produces **blame**: whoever has done least gets named, which moves real
vote weight. That is the "yeah, let's get him out, he never helps" loop closing.

Camp state also sets how well anyone sleeps — `campComfort()` scales fatigue recovery
between `campSleepComfortFloor` (0.55) and full. This is the main channel through which
neglect actually costs you: it wears the tribe down rather than killing anybody.

## What the balance work found

Every one of these was a real defect caught by `tools/camp-test.js` and fixed. They are
recorded because the fixes look arbitrary without them.

1. **The death spiral.** Mapping this before building it (`systems-interaction-mapper`)
   turned up the obvious reinforcing loop: camp decays → bad night → everyone tired and
   miserable → nobody works → camp decays worse. With medivacs already firing at hunger
   > 0.8, that ends seasons by attrition instead of by voting.
   **Fix:** `campSeverityPush` (0.50) is deliberately larger than `campFatigueDrag`
   (0.35) — the worse a need gets, the *more* likely people are to deal with it. Hungry
   people forage harder. A desperate camp pulls a Villain Arc's work drive from 0.00 to
   0.48. Do not invert those two numbers.

2. **Demand scaled to the wrong tribe.** Pre-merge there are 18 castaways alive but only
   the player's 9 live in the modelled camp. `CampNeeds.decay` was scaling consumption to
   all 18 against a labour supply of 8, which collapsed the camp every season no matter
   what anyone did. Everything camp-scoped now goes through `campPool()`.

3. **Nobody but the player ever ate.** The food store's daily drain *is* nine people
   eating, but nothing on the other side reduced anyone's hunger, so every NPC starved to
   a medivac by the back half of the season. The food store now sets **where hunger
   settles** rather than subtracting from it each day — see the section below.

### Hunger and fatigue are a plateau, not a ramp

Superseding the original model, after the note that *"hunger and fatigue should be way, way
lower — players in Survivor are always hungry, they nap a lot, they have bad nights all the
time."* Which is exactly right, and the old model said the opposite: hunger ramped to the
ceiling and being hungry-and-tired cost up to **0.56** off a challenge score, more than the
entire stat contribution. Everyone was starving, everyone was penalised, and the penalty
quietly decided immunities.

The shape now has two parts.

**A plateau.** Hunger and fatigue climb hard in week one and then flatten toward a high,
permanent resting level. `driftToward` moves each toward a *target* at a capped daily speed,
and the food store sets the hunger target — `hungerPlateau` minus `hungerFedRelief × fedShare`.
A well-stocked tribe settles around 0.44, an empty one at 0.72, and neither can reach zero,
because a full basket out here is rice and a fish.

This replaced a climb-minus-relief sum, which was structurally brittle: with a smaller daily
climb the constant relief simply overwhelmed it and the whole cast sat at **0.00** hunger —
measured, in `tools/condition-test.js`. Two opposing constants always depend on their
difference. A target does not.

**A tail.** The challenge penalty is zero across the normal band and quadratic past it
(`condBite`, with `hungerPainFree` / `fatiguePainFree`). Being hungry costs nothing, because
everyone is. Actually breaking down costs a lot:

| condition | cost at a challenge |
| --- | --- |
| fresh (0.20 / 0.20) | −0.000 |
| the normal island plateau | −0.022 |
| rough (0.85 / 0.85) | −0.101 |
| breaking down (1.0 / 1.0) | −0.250 |

For scale, a full stat range is worth 1.00 and a day's form swings ±0.54. So condition never
outweighs having a bad day, which is correct — nobody on that show loses immunity *because*
they were hungry.

Measured over 8 re-rolled seasons: hunger settles at **0.52**, fatigue at **0.51**, morale at
**0.51**. Permanently hungry, permanently tired, still competing.

Two consequences that had to be fixed alongside:

- **Sleep recovery was larger than a day's accumulation** (0.35 against 0.06), so fatigue was
  fully cleared every night and the whole tired-castaway layer did nothing. Now 0.16, below
  the daily climb plus a day's work — so the people doing the work are the tired ones.
- **`campFatigueDrag` was calibrated when fatigue sat near zero.** Once fatigue had a real
  resting level of ~0.5, the same coefficient became a permanent 0.18 tax on everyone's work
  drive and camp needs started pinning empty (caught by `camp-test.js`). It now applies to
  fatigue *above* `fatigueNormal`, matching the hunger term: everyone out here is knackered,
  and that is the baseline rather than an excuse.

4. **An unshaped sink.** Every other drain is proportional to what you have, so needs
   settle into a band instead of pinning at empty. The nightly wood burn was flat, which
   pinned firewood at zero. It now scales with the fire's own level — a guttering fire
   eats less wood than a roaring one.

5. **Unbalanced per-need demand.** Water alone needed 2.3 jobs a day against a total
   supply of about 4.5 across five needs, so it pinned at empty and dragged the whole
   board down. Each need's drain is now set against what one job of that type restores.

6. **Fire tending competed with the rota.** Giving the fire job a base weight kept the
   hidden fire skill contested but stole hours from the needs board — the camp starved so
   the final four could be interesting. Everyday fire-poking now happens *on top of* the
   rota at `campFireTendChance`, with partial ledger credit.

7. **Chore reward was an uncapped season-long faucet.** Within-day decay stops
   chore-spamming inside one day; over 24 days an uncapped trickle still maxed everybody
   out and chores quietly became a better relationship engine than talking.
   **Fix:** `choreRelSeasonCap` (0.30) per pair. Past it the work still counts for the
   camp and the ledger — it just stops buying affection you have not earned in
   conversation.

8. **The provider-capture loop.** A grafter accrues bond with everyone and becomes
   unvotable. Survivor already has the counter-force, so the ledger inverts post-merge:
   a work résumé above 0.68 adds threat weight (`campResumeThreat`).

9. **The inverted incentive.** Working costs fatigue, fatigue costs challenge score — so
   the system punished exactly the behaviour it wanted, and "never work, stay fresh, win
   immunity" was the optimal line. **Fix:** `moraleChallengeBonus` (0.22). Shirking turns
   the tribe cold on you, that sinks morale, and morale is worth about as much out there
   as the rest you saved. Measured: a shirker scores 0.46 to a worker's 0.54.

10. **Tidy was a dead option** with no mechanical output. Camp cleanliness now gates the
    rats, sickness and tide events, and feeds sleep comfort.

## The lever

`CONFIG.campDrainScale` multiplies every need's drain, so the whole economy tightens or
loosens with one number instead of five. Set by measurement with `tools/camp-sweep.js`:

```
scale  idle needMean  pinned  bad nights  good  morale  medivacs | working: needMean  bad
1.4    0.36-0.38      0.04    3.1-3.9     8-10  0.73    0.5-0.75 | 0.47-0.49          1.7
1.7 <- 0.28-0.30      0.08    5.0-5.7     4.6-5 0.69    0.55-0.7 | 0.41               2.7
2.0    0.20           0.18    8.6-9.0     1.6   0.63    0.7-1.0  | 0.32-0.34          4.7
2.3    0.14-0.15      0.29    9.8-11.3    0.5   0.59    1.2-1.6  | 0.25-0.26          7.8
```

**1.7** is the shipped value. A tribe left to itself holds the camp around 0.28 — thin,
visibly short of things, livable. Roughly five rough nights and five good ones a season.
A player doing two jobs a day lifts it to 0.41 and halves the rough nights. Both ends of
that are the point: the camp is worth attending to, and ignoring it is survivable.

Raise it and camp becomes a second job. Lower it and the whole layer stops mattering.

## Is "never work" viable?

It has to be — a pure social player is a legitimate way to play this game. Measured over
20 seasons:

```
                  mean bond    vote weight on you    challenge score
never works       0.23         3.8                   0.46
works 2 jobs/day  0.83         0.0                   0.54
```

Real cost, real heat, and a real challenge penalty via morale — but survivable, and the
bond gap stays under 0.75, so camp standing is one axis rather than the whole game.

## Tests

- `tools/camp-test.js` — 40 checks: the spiral brake, the needs band, the ledger spread,
  the hypocrisy gate, vote-weight caps, night grading and lethality, job efficiency,
  biome/act routing, state dialogue, gossip variety, shirking viability, drift caps.
  Re-rolls tribe composition every simulated season, so the numbers describe the system
  rather than one lucky cast.
- `tools/camp-ui-test.js` — the layer as the player meets it, with real clicks: the board
  renders, a job walks you to the right biome and tags the action, a call-out produces
  spoken reactions, the rota puts people on-site, a bad night wakes you with a story, and
  a starving ally actually hands you food.
- `tools/camp-sweep.js` — the drain-scale sweep above.

## Evacuation rates

Calibrated against the real show, not guessed at. US Survivor seasons 1–50 had
**21 medical evacuations across 14 seasons**:

| Evacuations in a season | Seasons | Share |
|---|---|---|
| 0 | 36 | 72% |
| 1 | 8 | 16% |
| 2 | 5 | 10% |
| 3 | 1 | 2% (Kaôh Rōng, the worst on record) |

Mean **0.42 a season**. Two in one season is a one-in-ten event, not a freak
occurrence — but it should feel like one.

Two facts from the real list shaped the model:

**Timing is bimodal.** Six of the 21 happened in the first three days, nearly all
at the opening challenge — Kourtney Moon's wrist, Pat Cusack's back, Bruce
Perreault's head, Randen Montalvo's spine. The rest need time: an infection has to
fester and a body has to run down.

**Cause splits 43/57.** Nine were pure accidents no amount of camp care would have
prevented (Skupin falling in the fire, a snake bite, a ruptured Achilles). Twelve
were infections (6) or the body giving out from hunger, heat and dehydration (6) —
and those *are* camp-linked. So keeping camp protects your tribe from more than
half of it, and no camp however well run protects them from all of it.

### What changed

The old model rolled independent per-castaway, per-day dice — 3%/day for anyone
past hunger 0.8. Measured over 500 simulated seasons that produced 37% of seasons
with at least one (real: 28%) and a mean of 0.478 (real: 0.42). Not wildly wrong,
but the season-level rate was an emergent side effect of numbers nobody could
reason about, and it was unbounded — a rough camp could stack four.

The season is now the unit. `EVAC_SEASON_ODDS` in `sim.js` is the real table;
the count is drawn from it at season start, the events are scheduled (29% into the
first three days), and conditions decide who and exactly when. A condition-linked
evacuation that has nobody in poor enough shape to happen to *waits*, and runs out
of season if the camp stays in order.

Measured over 500 seasons after the change:

```
                  0 evacs   1     2     3    mean   >=1
real show          72%     16%   10%    2%   0.42   28%
old per-day dice    -       -     9%    1%   0.478  37%   (22pp total error)
calibrated          80%    14%    5%    0%   0.256  20%   (16pp total error)

camp kept well     mean 0.256   — accidents only
camp left to rot   mean 0.374   — accidents plus infection and starvation
```

Deliberately a little conservative: erring toward fewer evacuations, and the
shortfall against 0.42 is the player's camp care earning it. `tools/evac-test.js`
measures both models side by side.
