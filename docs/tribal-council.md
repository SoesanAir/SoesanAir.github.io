# Tribal council

Four requests landed on this one flow, and three of them are the same request in
different clothes: **stop telling me the result, show me it happening.**

The order of a council is now:

```
whispers (rare)  →  vote  →  "if anybody has an idol..."  →  read the votes
                                                              ↓ tie
                                                          DEADLOCK announced
                                                              ↓
                                                     "this can get sticky" warning
                                                              ↓
                                                       revote, read again
                                                              ↓ tie again
                                                            rocks
```

## The tie is watched, not computed

The old `revealVotes` tallied, found a tie, ran the revote, reassigned
`votes = revote`, and revealed **only the revote**. So a deadlock arrived fully
formed and the player never saw the votes that caused it.

`revealRound(votes, opts)` is now a reusable one-parchment-at-a-time reveal, and
the flow calls it once per round. Round one always shows every original vote.
`opts.landOn` puts the decisive vote last so a round builds to its own conclusion;
on a tie there is no such vote and the order is simply shuffled, because
pretending otherwise would telegraph the outcome.

Before round two the player gets an explicit warning that a second tie means rocks.
That was the specific ask — *"warn me that it might get sticky"* — and it matters
because the revote is a real decision that the player is making with incomplete
information about what happens next.

Asserted in `tools/tribal-test.js`: the first round reveals all 8 of 8 votes, the
Peff beats run `DEADLOCK → THIS CAN GET STICKY → SNUFF`, and the revote gets its
own round.

## Hidden immunity idols

`js/idols.js`. An idol does one thing: played after the votes are cast and before
they are read, every vote against the holder stops counting.

**Finding one.** A small chance per camp job, and only on the three jobs that take
you out of camp alone — firewood, water, food. Cleaning up camp and tending the
fire happen in front of everybody. Measured at 0.25 finds per 1000 qualifying jobs
at the base rate.

One concession to how the show actually works: production makes sure idols get
found. `dryDays` ramps the chance slightly for every day nobody is holding one, so
a season reliably produces one or two without any single search being anything but
a long shot.

**The question is asked at every single council**, whether or not anybody is
holding one, and the answer is a beat showing `…`. Then either the council moves on
or somebody stands up.

It was originally gated on somebody actually having an idol, on the reasoning that
asking every night would wear the moment out. That was wrong twice:

1. **The repetition is the moment.** The night somebody stands only lands because
   you have watched nobody stand nine times. Peff asks at every council on the show
   without exception, and the pause is the most reliably tense fifteen seconds in
   the format.
2. **Gating it leaked information.** The question appearing at all told the player
   an idol was in play — precisely the thing nobody is supposed to know.

The same leak applies to the *number of beats*, so a council where an NPC holds one
and declines shows **exactly** the same two screens as a council where nobody holds
one. A player who could count "three beats tonight instead of two" would learn an
idol was out there for free. Asserted directly in `tools/tribal-test.js`:

```
nobody holding : HIDDEN IMMUNITY IDOL -> silence
NPC holds+keeps: HIDDEN IMMUNITY IDOL -> silence     <- identical
NPC plays it   : HIDDEN IMMUNITY IDOL -> silence -> AN IDOL -> THE BENCH
```

The one exception: if the **player** was the holder and declined, they get an extra
beat, because they already know what they just did and it leaks nothing.

`IDOL_LINES.silence` has 20 descriptions of what the silence looks like, and none of
them may ever hint at whether an idol is actually in play — every line has to read
the same on the night somebody stands as on the eight nights nobody does.

**Playing one.** This is the part that matters, and the design goal is *fallibility*.
What makes idols good television is not the power, it is the misjudgement — people
play them on nights nobody was coming, and people go home with one in their pocket.
So `wouldPlay` is driven by what the castaway **believes**:

| input | what it is |
| --- | --- |
| `heat` | how much of the tribe they can tell is looking at them, from their own incomplete vote-weight reads |
| `nerves` | temperament. A Paranoid Schemer plays it on a quiet night; an Under The Radar sits on it until it is too late |
| `squeeze` | everybody is twitchier at six than at twelve |
| `warned` | somebody told them to their face today — including via a whisper |

Measured: **83%** play it when genuinely cornered, **27%** waste it on a quiet
night. Both of those numbers are the point. A perfect idol AI would be
unrealistic and boring.

**Voided votes are still read.** `Voting.tally(votes, voided)` skips them in the
count, and `revealRound` still shows each one, struck through, with "does not
count" underneath. That is what makes an idol land.

**The wipeout case.** An idol that cancels every vote leaves nothing to count.
`tally` returns `noVotes: true` and the flow revotes with the holder off the table,
which is what the show does. Without that branch the deadlock code would have run
with an empty tie list.

**Going home holding one** is announced, because it happens constantly on the show
and it is always the same shape of mistake.

## Whispering

`js/whisper.js`, lines in `js/whisper-lines.js` (28 pools, 390 lines, no
duplicates).

Three properties, all easy to get wrong:

1. **It is rare.** Once or twice a season — measured at 0.8. And the trigger is not
   a dice roll on the night, it is a question about the room: *is there somebody
   here who genuinely does not know how this is going to go, or who can see their
   own name coming?* A bench that is sure of itself sits in silence, which is most
   councils. `unsureOnes` measures how flat an NPC's read of the vote is.
2. **It cascades.** One whisper is not the event; the second and third are. Each
   round is less likely than the last (`whisperCascadeDecay`) and there is a hard
   cap, so it always terminates.
3. **Peff does not stop it.** He watches and waits. The only thing that ends it is
   running out of momentum. A host who broke it up would be solving the player's
   problem for them.

The player gets two whispers — few enough that choosing *who* is the decision.
Eight things to say, including a bluff (which goes through the lying system and can
be caught later) and an idol hint (which works whether or not you have one, and
costs you if it gets checked).

`warn` is the one that reaches into the idol system: telling somebody they are the
target sets `idolWarnedDay`, which is a large push on whether they play theirs.

## Tunables

Idols: `idolFindChance` 0.0012, `idolPlayerEdge` 2.2, `idolMaxPerSeason` 2,
`idolDryRamp` 0.16, `idolDryCap` 14, `idolHeatWeight` 0.62, `idolNervesWeight` 0.30,
`idolSqueezeWeight` 0.26, `idolSqueezeFrom` 10, `idolWarnedPush` 0.34,
`idolPlayedThreat` 0.55.

Whispers: `whisperSeasonTarget` 2, `whisperMinDay` 5, `whisperUnsureBar` 0.34,
`whisperPlayerMax` 2, `whisperCascadeBase` 0.62, `whisperCascadeDecay` 0.72,
`whisperCascadeMax` 5, `whisperFlipWeight` 0.85, `whisperOverhearChance` 0.55.

## Where the code is

- `js/idols.js` — `Inventory`, `ITEMS`, `Idols`
- `js/idol-lines.js` — Peff's liturgy and the bench's reactions
- `js/whisper.js` — `Whisper`: the trigger, the cascade, the player's turn
- `js/whisper-lines.js` — `WHISPER_LINES`, `Whispers` picker
- `js/game.js` — `revealRound`, `revealVotes`, `idolBeat`
- `js/sim.js` — `Voting.tally(votes, voided)`
- `css/whisper.css` — the bench
- `tools/tribal-test.js` — all of the above
