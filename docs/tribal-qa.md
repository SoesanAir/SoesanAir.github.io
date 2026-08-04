# Tribal council conversation — the contract

Tribal used to open on the vote grid with one line from Peff and go straight to
tapping a face. Reported as "too in your face". On the show the vote is the *last*
thing that happens: Peff welcomes everybody, then works the bench for ten minutes,
asking about things that actually happened, and the vote is what falls out of it.

This document is the contract between three pieces:

| file | owns |
|---|---|
| `js/tribal-read.js` | **what happened** — reads public history, emits Facts |
| `js/tribal-qa-lines-{a,b,c,d}.js` | **what gets said** — the text pools |
| `js/tribal-qa.js` | **the scene** — picks topics, picks speakers, presents |

## The two rules that matter most

**1. Peff is direct but never reveals a secret.** He is not omniscient. He knows
what he watched, what the cameras saw at camp, and what was said at a previous
tribal. He does *not* know who is aligned with whom, who is holding an idol, or
what was whispered on the bench. So he asks pointed questions about *observable*
things and lets people incriminate themselves.

The split, concretely:

| Peff may raise | Peff may never raise |
|---|---|
| challenge results, ranks, who lagged | who is voting with whom |
| camp state — no food, no fire, wrecked shelter | pact / bloc membership or plans |
| who is visibly not working | an idol nobody has played yet |
| who looks wrecked, who is hurt | anything whispered on the bench |
| previous vote counts, ties, who was unanimous | a lie that was never caught |
| a fight that happened in the open | private promises |

Enforced mechanically: `Facts.subs` may only contain values the reader pulled from
a public source, and a Peff **ask** line may not contain the words *alliance*,
*pact*, *bloc*, *whisper* or *idol*. An **answer** may — a castaway choosing to say
it out loud is the drama, and it is their own information to spend.

**2. No feelings in brackets.** No `(smiling)`, no `(quietly)`, no `*shrugs*`. If a
line needs a tone, the words carry it. A parenthesis anywhere in a line is a test
failure. This is the difference between an answer that reads like a script
direction and one that sounds like a person talking.

## Shape of a topic

Every entry in a lines file:

```js
{
  id: 'weakLink',           // must match a Fact id from tribal-read.js
  ask: [ ... ],             // >= 5 phrasings. Peff opens the topic.
  answers: {                // >= 5 lines in EVERY one of the six stances
    own: [ ... ], deflect: [ ... ], blame: [ ... ],
    defiant: [ ... ], wry: [ ... ], bleak: [ ... ]
  },
  push:  [ ... ],           // optional, >= 4. Peff pushes once more.
  chime: { own: [...], ... },// optional. A SECOND castaway cuts in.
  playerOpts: {             // >= 4 stances. Short button labels, <= 42 chars.
    own: 'Say it was you', ...
  }
}
```

### The six stances

Fixed vocabulary — the engine picks one from the castaway's temperament and
situation, so all four files must use exactly these names.

| stance | the castaway... | picked when |
|---|---|---|
| `own` | takes it, straight, no excuse | high emotional, Loyal Soldier, Reluctant Hero |
| `deflect` | moves it off themselves without naming anyone | high social, low game awareness |
| `blame` | points at a person or gestures at one | high game awareness, already exposed |
| `defiant` | pushes back at Peff or at the premise | Villain Arc, Physical Threat, Chaos Agent |
| `wry` | dry, funny, deflates it | high smarts, decent morale |
| `bleak` | unvarnished about how bad things are | low morale, wrecked condition |

A stance is *how they answer*, not how they feel. `bleak` is not "sad" — it is
"says the true bad thing plainly".

### Writing answers that are worth reading

The failure mode is an answer that restates the question as a mood. Every line
should carry **a fact, an image, or a position** the question did not contain.

```
BAD   "It was rough out there. I'm just trying to keep my head up."
      -- says nothing, could attach to any topic
GOOD  "I counted. I made that turn eleven times and got it wrong eleven times."
      -- a number, and it is his own number

BAD   "(defensive) I do plenty around here."
      -- brackets, and a claim with nothing behind it
GOOD  "I hauled wood at first light while three people were still asleep."
      -- checkable, and it is an accusation without naming anybody
```

Concrete, specific, and in that castaway's mouth. Numbers are good. Objects are
good. Naming a time of day is good.

### Placeholders

Only the subs the topic declares, in `{braces}`. `{who}` is whoever Peff addressed
and is always available. Using an undeclared placeholder is a test failure, because
it ships as literal `{mystery}` on screen.

## Presentation rules

- **One line, one tap.** Every single line — welcome, ask, answer, push, chime —
  waits for a Next tap. Nothing auto-advances. Non-negotiable, and tested.
- 2 to 4 topics per council, more late in the season than early.
- A topic never repeats within a season, and no individual line repeats within a
  season.
- If Peff addresses the **player**, they choose their stance from `playerOpts`
  instead of the engine picking. That choice has small consequences.

## Hard rules, all enforced by `tools/tribalqa-test.js`

1. No parentheses or asterisks in any line.
2. Peff **asks and pushes** contain none of: alliance, pact, bloc, whisper, idol.
3. Every topic id in a lines file resolves to a Fact id in the reader, **and vice
   versa** — a Fact with no writing is a silently skipped question, and a topic no
   reader emits is dead text.
4. All six stances present, >= 4 lines each. >= 5 ask phrasings. >= 3 `playerOpts`.
   (Aim well past these; batch A averages 54 lines per topic. The floor exists to
   catch a stub, not to describe a finished topic.)
5. Asks and pushes <= 140 chars, answers and chimes <= 160, player labels <= 42,
   welcome lines <= 200.
6. No duplicate line anywhere across every pool in every file — including
   `playerOpts` labels, which is the one that actually caught something.
7. Every `{placeholder}` is declared in that topic's subs.
8. Every line needs a tap to advance. Verified live by driving a real council and
   confirming the text does not change without a click.
9. `tribal-read.js` never references Coalitions, PlayerAlliances, NpcBlocs, Idols,
   Whisper or Lying. This is what makes rule 2 structural rather than a promise.
