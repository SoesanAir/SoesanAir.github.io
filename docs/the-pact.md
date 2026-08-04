# The Pact, and everybody else's

Formerly "the alliance circle". The rename was asked for and it was the right ask:
the game already calls a two-person deal an **alliance**, so calling a six-person
one a *circle* was a second word for the same idea plus a shape nobody could
picture. **Pact** is short, distinct, fits a phone button (`Pact · 1h`), and works
in an NPC's mouth — "there's a pact between those three."

Internally the module is still `Coalitions` and the CONFIG keys are still
`circleXxx`. That is deliberate: renaming them would touch a lot of working code
for no player-visible benefit, and every touch is a chance to break something. The
definition sites say so.

## As big as it needs to be

`Coalitions.MAX` was 4, now 8 — a working majority. What limits a pact is not the
cap, it is the **fracture check**, and that is the honest limiter.

The fracture bar now *relaxes* as the pact grows (`circleSizeTolerance` per member
beyond two). A four-person pact where everyone must like everyone is a reasonable
ask; demanding it of seven is demanding something that has never happened on the
show. Big alliances are held together by shared interest, not affection, and they
contain people who cannot stand each other. So a large pact tolerates a colder
pair and pays for it in permanent strain instead: possible, powerful, and about a
week from collapsing.

## Splitting the vote

What a majority does when it suspects an idol: three votes on the target, three on
their closest ally, so an idol played on either one still sends the other home.

The pact meeting offers it only when there is a plan to split and at least
`circleSplitMinMembers` people to cover both names — offering it to a pact of three
would be offering them a way to lose on purpose.

The split is chosen by proximity: the game ranks candidates by how close they are
to the primary target, because that is who they would hand an idol to and who they
would want saved.

Then it does the arithmetic **out loud**:

```
4 on Marcus, 3 on Dana. They can muster 5.
```

and the sharpest person in the room says whether that holds. If it does not, the
player can still insist — and `plan.firm` drops by 30%, because half the room is
not convinced. That is the honest consequence, and the arithmetic lesson is the
point of the mechanic.

`seedEffects` pushes each agreed member at the name they were **assigned**, not at
a shared target, so a split that does not add up genuinely loses.

## NPC blocs

`js/blocs.js`. The player could organise more than two people and nobody else
could, which is backwards — on the show the player is usually *not* in the dominant
alliance, and most of a season is spent working out whose it is.

A bloc starts as a mutually warm **triangle** (two people is already
`NpcAlliances`) and grows by absorbing anyone warm to everybody already in. It
shields its members at the vote and converges on a shared name, both more weakly
than an agreed pact plan — because nobody held a meeting.

Blocs break on going cold for two days, on dropping below three, and on a swap
that splits them across two beaches. That last one is what a swap is *for*.

## Reading the room

`NpcBlocs.readBy(observer)` returns what a given castaway **believes** about the
groupings. This is the payload for "I think X, Y and Z are getting close", and it
surfaces through **Read the room** in conversation.

Measured over 600 reads on a live season:

| read | count | what it is |
| --- | --- | --- |
| `sure3` | 237 | a real grouping, named correctly |
| `nothing` | 136 | they have not noticed anything |
| `mine` | 95 | they hint at their own bloc without admitting it |
| `vague` | 77 | they sense something but cannot name it |
| `wrong` | 55 | a confidently-held grouping that does not exist |

**The wrong ones are the feature.** They are phrased with exactly the same
confidence as the correct ones — verified: zero hedge words in either pool,
matched average length, matched sentence count, same mix of registers. A player
cannot tell from the phrasing. The only ways to check are to ask somebody else or
to have watched.

Who gives you a bad read is not random: `blocWrongBase` scales by how
*unobservant* they are, so bad information comes from the people whose information
is bad. And the player's own pact is a bloc other people can spot — gated on the
`visibility` number the pact meeting has been quietly raising.

Every read is logged as intel tagged with whether it was true, so the season report
can tell the player afterwards who had been feeding them nonsense.

## Tunables

Pact: `circlePlanVoteWeight` 1.6, `circleCascade` 0.16, `circleMeetingVisibility`
0.34, `circleNoticedAbove` 0.30, `circleVisibleVoteWeight` 0.55, `circleLeakBelow`
0.46, `circleSizeTolerance` 0.035, `circleSplitMinMembers` 4.

Blocs: `blocFormMinDay` 4, `blocFormChance` 0.22, `blocFormAbove` 0.52,
`blocJoinAbove` 0.48, `blocGrowChance` 0.30, `blocBreakBelow` 0.30, `blocMax` 5,
`blocShield` 0.45, `blocConverge` 0.40, `blocWrongBase` 0.26.

## Where the code is

- `js/sim.js` — `Coalitions`: size, fracture tolerance, the split in `seedEffects`
- `js/circle.js` — `CircleMeeting`, including `splitVote`
- `js/blocs.js` — `NpcBlocs`: formation, effects, `readBy`, `lineFor`
- `js/bloc-lines.js` — `BLOC_LINES` (14 pools, 234 lines), `BlocTalk` picker
- `js/game.js` — `doReadRoom` surfaces the read
- `tools/social-test.js` — asserts blocs form, reads are graded, and wrong reads exist
