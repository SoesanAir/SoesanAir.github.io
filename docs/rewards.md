# Reward challenges

The days between councils were empty. On the show they are not — a reward
challenge is what fills them, and what a tribe wins changes how the next week
feels rather than who goes home.

## When

`Rewards.isRewardDay(day)`:

- **Never on a council day.** Checked twice: against `CONFIG.tribalDays` (a stable
  answer for past days, needed by the spacing rule) and against the live
  `isTribalDay` (so the endgame, where every day is a council, gets no rewards at
  all — the show does not run rewards at final five either).
- **Roughly one in three** of the remaining days (`dayChance` 0.34). Four or five
  rewards in a 26-day season, which is what a real season gets. A reward every
  spare day would flood the survival model and nobody would ever be hungry.
- From day 3, which is where the show puts the first one.

The schedule is derived from a hash of the day number, not stored, so a reload
cannot desync it.

**A bug worth recording**: the hash returned *negative* values, because `x ^= x >>> 16`
produces a signed int32 and every negative value is below `dayChance`. Rewards
fired on **83% of eligible days instead of 34%**. Eyeballing one season's list
would have passed; measuring the rate across 200 seeds is what caught it.

## No minigame twice a season

`Rewards.noteMinigame(id)` is called by **both** reward and immunity challenges, so
the ledger is shared. Without that, the same game could appear in one of each.

`A Bit Tipsy` used to be excluded from rewards outright, because it hardcoded the
word `IMMUNITY` as the thing you spell inside the arena — no amount of rewriting
the briefing keeps immunity language off a reward screen. The word is now a shell
value (`Challenge.word`), so the game is usable and spells `REWARD` instead. The
show spells whatever the challenge is for.

## The prizes

`hunger` and `fatigue` are relief — negative is better. Camp values are
`CampNeeds` ids. **Lasting** effects pay once per day, ticked in `endDay` before
the camp decays, so a tarp is holding the shelter up rather than topping it up
after the rain got in.

| prize | instant, each | camp, once | lasting | picks |
| --- | --- | --- | --- | --- |
| The Barbecue | hunger −0.34, fatigue −0.04, morale +0.13 | — | — | 1 |
| Fishing Gear | hunger −0.06 | food +0.10 | **6 days** food +0.055 | 1 |
| Tarp and Shelter Kit | fatigue −0.03, morale +0.05 | shelter +0.28, clean +0.05 | **5 days** shelter +0.05 | 1 |
| Blankets and Pillows | fatigue −0.12, morale +0.08 | — | **4 nights** fatigue −0.055, sets `GAME.goodSleep` | 1 |
| The Comfort Trip | hunger −0.10, fatigue −0.22, morale +0.18 | — | **2 days** morale +0.03 | 2 |
| Coffee and Pastries | hunger −0.12, fatigue −0.24, morale +0.07 | — | — | 1 |
| Letters From Home | fatigue −0.05, **morale +0.28** | — | **3 days** morale +0.045 | 2, bonding |
| Fruit Basket | hunger −0.18, morale +0.05 | food +0.08 | — | 1 |
| Toolkit and Machete | fatigue −0.02 | firewood +0.16 | **6 days** firewood +0.05, shelter +0.02 | 1 |

Shelter and firewood reach the sleep model through `campComfort()`; food sets the
hunger *target* in `dailySurvivalTick`; blankets set `GAME.goodSleep`, which
`applySleepRecovery` already reads — so nothing in `sim.js` needed changing.

`maxActive` caps concurrent lasting effects, oldest dropped first. Without it a
camp could run a tarp, a toolkit, fishing gear and bedding at once and the camp
economy would stop mattering.

## Pre-merge it feeds the camp. Post-merge it splits it.

**Pre-merge**: the winning tribe's whole camp gets it. Only the player's camp is
modelled, so a win by the other tribe moves nothing on our board — the same
distinction `dailySurvivalTick` had to make.

**Post-merge**: individual, and then Peff says *"choose someone to join you"*, and
on the bigger prizes he asks for one more. That is mimicked because it is the most
socially loaded thing in the format:

- the person you take gains relationship toward you and steers off you at the vote
- **everybody left on the beach counts it**, and the hungriest and sharpest of them
  count it hardest

The snub is capped below a deliberate vote push, so it is a grudge rather than a
death sentence.

## Visibly not immunity

Same `#screen-challenge`, but with `.rw-on` applied: a REWARD banner, a gold
action button rather than the immunity green, and **the prize shown as a card
before you play**, which stays on screen while you find out whether you got it.

One detail worth keeping: `#btn-chal-go` is `.btn.primary`, so the first attempt at
"repaint it green" made the one control the player actually presses *identical* to
the immunity screen.

A reward can never eliminate anybody and never grants immunity — asserted, along
with "no reward text anywhere says immunity".

## Where the code is

- `js/reward.js` — `REWARD_CONFIG`, `REWARD_PRIZES`, `REWARD_PEFF`, `Rewards`
- `css/reward.css` — the `rw-` theme
- `js/game.js` — the `!isTribalDay` branch in the morning, `noteMinigame`,
  `tickDay` in `endDay`, and save/load of the effect list and used-game ledger
- `tools/reward-test.js` — 81 checks
