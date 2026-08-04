# The circle

A multi-way player alliance of three or four. It existed before this pass and had real
mechanical effects that the player was never shown, which produced the playtest verdict:
*"the alliance circle is unclear — how do I talk to all of them at once? how does it
actually help the player?"*

Both halves of that were fair. Members shielded each other in vote seeding and drifted toward
a consensus target, and the only interface was a label in a one-to-one conversation that did
nothing when tapped. A benefit you cannot see is not a benefit.

## What it is now

Three numbers and a meeting.

| | What it is | Where it comes from |
| --- | --- | --- |
| **Loyalty** (per member) | How solid that one person is | Their warmth to you (62%), their warmth to the *other members* (38%), minus the pull of anyone outside they like more |
| **Cohesion** | How solid the circle is as a unit | Mean loyalty across members |
| **Visibility** | How obvious the bloc is to everyone else | Rises with every meeting; never falls |

Loyalty counting warmth to *peers* is the load-bearing part. A member who adores you but
cannot stand your other ally is **not** solid, and that is what actually breaks three-person
alliances on the show.

## The meeting

`Circle · 1h` in the action bar, or "Get the circle together" from any member's conversation.
A full-screen huddle: the loyalty bars along the top, then one line of speech at a time.

Four things you can do:

- **Put a name up** — the main event. See below.
- **Ask who they would write** — no plan, but three reads at once, logged as real intel.
  Cheap in time and much less conspicuous.
- **Shore it up** — spend the hour on the people instead. Raises the wobbliest member most,
  and warms the members to *each other*, which is the only lever the player has on
  NPC-to-NPC warmth inside a group.
- **Break it up** — leave without being seen to agree anything.

### Putting a name up: the cascade

Members answer **in sequence, most loyal first**, and each one hears the running tally:

```
p(agree) = 0.20 + loyalty*0.75 - their_warmth_to_target*0.55 + momentum*circleCascade
```

`momentum` is agreements minus refusals so far. So a second yes makes a third much more
likely, and two refusals in a row turn the room. This is why speaking order matters and why
your closest ally answering first is worth more than their vote alone.

A majority locks the plan. Each member who agreed gets a vote-weight push toward the target
of `circlePlanVoteWeight × firmness × loyalty` — much heavier than the passive drift, which is
the whole mechanical payoff for holding a meeting. Somebody who nodded along while privately
unconvinced does not carry it into the booth.

### The two prices

**Being seen.** Every meeting raises `visibility`. Past `circleNoticedAbove`, outsiders start
adding vote weight against *every member*, scaled by their game awareness — sharp players spot
a bloc sooner. So "should I call a meeting" is a real decision rather than a free action.

**The leak.** After a plan locks, each member rolls:

```
risk = max(0, circleLeakBelow - loyalty) * 2.0 * their_warmth_to_target
```

Only somebody both wobbly *and* closer to the target than to you. A leak hands the target a
heavy vote weight against you and a lesser one against the rest, and they start scrambling.
The loyalty bars mean you can **see** this risk before you commit — you just cannot always
afford not to.

## Afterwards

At the next council the plan is reviewed before anything else can break the circle, and the
player is told plainly: the circle held, or *who* went off it. Keeping to a plan tightens
trust among everyone who also kept to it; going rogue costs trust with all of them.

That feedback is what makes the whole loop legible. You called a name, you watched the room
take it or not, and then you find out who actually wrote it.

## Tunables

All in `CONFIG` (`js/data.js`), all prefixed `circle`:

`circlePlanVoteWeight` 1.6 · `circlePlanStaleDays` 2 · `circleMeetingVisibility` 0.34 ·
`circleNoticedAbove` 0.30 · `circleVisibleVoteWeight` 0.55 · `circleLeakBelow` 0.46 ·
`circleLeakVoteWeight` 1.3 · `circleHeldTrust` 0.05 · `circleBrokeTrust` 0.14 ·
`circleCascade` 0.16 · `circleMeetingHours` 1.0 · `circleReadsHours` 0.5 ·
`circleShoreWeak` 0.055 · `circleShoreOther` 0.022

Admission and fracture keep their existing keys: `circleWarmthNeeded`, `circleFractureBelow`,
`circleTrustInPlayerNeeded`.

## Where the code lives

- `js/sim.js` — `Coalitions`: state, loyalty, cohesion, `setPlan`, `rollLeak`,
  `applyVisibility`, `reviewPlan`, and the plan's contribution to `seedEffects`.
- `js/circle.js` — `CircleMeeting`: the scene, the cascade, and the voice.
- `css/circle.css` — the huddle.
- `tools/circle-meeting-test.js` — asserts the payoff is measurable and the prices are real.
  (`tools/circle-test.js` is older and covers a separate vouching bug.)
