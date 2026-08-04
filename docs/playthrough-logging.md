# Getting a season's log off the phone

The design log lived in `localStorage` and the only ways out were "copy to
clipboard" and "download a .txt". Neither gets a 300KB log from a phone to somebody
who can read it, so a season finished on a phone was effectively unanalysable.

## Three destinations

**GitHub gist — primary, durable, private.** A secret gist, PATCHed at the end of
every day and again when the season ends. Holds the full report forever, one gist
per season. Needs a token, and the token lives in `localStorage` on the device and
is **never committed**. That distinction is the whole design: this site is served
from a public repo, so a token in the source would be public, would be found, and
would be revoked by GitHub's secret scanning within the hour. Setup is one paste —
the log screen links straight to a token page with only the `gist` scope
pre-selected.

**ntfy.sh — fallback, zero setup, ~12h.** Takes an anonymous browser POST and is
readable at `https://ntfy.sh/castaway-devlog-soesanair/json?poll=1` with no
credentials at all. Publishes the *brief* report only; the public server caps a
message at 4KB. Worth being plain about: **an ntfy topic is public to anyone who
knows the name.** There is nothing in it but game telemetry and whatever name you
typed, but it is not private, and it is one tap to switch off.

**Share sheet, clipboard, .txt.** Still there, now carrying the report rather than
the raw firehose.

Probed from a real browser before choosing. Of the anonymous endpoints that survive
a CORS preflight, only `tmpfiles.org` (1h retention) and `ntfy.sh` (12h) worked —
`dpaste.org` returned 405, and `paste.rs`, `0x0.st`, `catbox.moe` and
`bashupload.com` all failed outright. Neither is durable enough on its own, which
is why GitHub is the primary and not the optional extra.

## Two artefacts

`Report.brief()` stays under 3.5KB — outcome, camp state, contribution, the shape
of the season, the tribal record, bonds, heat, and the flags. Small enough for a
single ntfy message or a chat paste.

`Report.full()` adds the day-by-day timeline, the cast table, dialogue-pool usage
and the tail of the raw log.

## The journal

`js/journal.js` records the playthrough itself. It carries forward the categories
the Unity build kept — `PlayerAction`, `VoteWeight`, `VoteTalk`, `Lying`,
`ActionWheel` — and adds the arithmetic on top:

- **Every player action**, with day, hour and target.
- **Every option the player was OFFERED**, and whether they took it. This is the
  Unity action wheel. Offered-often-and-never-taken is the dead-option report, and
  there is no other way to discover that a whole branch of the game is invisible to
  real play.
- **Everything the player was shown** — every dialogue line, toast, feed entry,
  modal and screen. Which makes repetition measurable instead of a feeling, and
  shows how much of the writing a playthrough ever reaches.
- **Every ballot, with reasons.** Every `addVW` call in the codebase now carries a
  source string, so a council reads:

  ```
  day 12 — out: Nari · tally Nari 5, Betty 4 · margin 1
     Wafa       -> Nari   because: camp contribution +0.53, likes them -0.38, does not trust them +0.22
     Rukhsana   -> Nari   because: camp contribution +0.68, talk about who does nothing +0.46, likes them -0.32
     Qing       -> Betty  because: likes them -0.48, does not trust them +0.21, camp contribution +0.12
  ```

  Before this pass most weights were unlabelled and the log said "unexplained
  +0.80", which is exactly as useful as not logging it.

It **wraps** the existing functions rather than editing forty call sites. A missing
hook would silently bias every number below it without ever announcing itself, and
a wrapper cannot miss one.

## Is there an easy path to victory?

Every action is counted and its share computed. Dominance fires two ways, because a
pure ratio breaks at both ends — with four options a "3× fair share" bar sits at
75%, which something can duck under while still being three quarters of the entire
playthrough:

- **>40% share with 12+ uses**, or
- **>2.5× fair share with 20+ uses**

Verified against a deliberately lopsided run: 27 Bonds out of 38 actions is
reported as *"Bond is 71% of everything the player did"*.

Also flagged: **one-person play** (>55% of targeted actions aimed at a single
castaway) and **dead options** (offered 25+ times, never taken). Note that
"offered" counts appearances, not menu openings — a dialogue menu re-renders after
every line, so one conversation can offer the same option five times. The
thresholds account for that.

## Was it interesting?

Nine measured axes, reported separately so a flat season says *which* part was flat
rather than handing back one opaque score:

| axis | what it measures |
|---|---|
| **variety** | how many distinct actions the player used |
| **spread** | whether one action ran away with the playthrough |
| **reach** | how many different people they actually dealt with |
| **tension** | how close the councils were — a 5-4 is a story, an 8-1 is a formality |
| **risk** | how often the player was genuinely on the block |
| **surprise** | how often their read of the room was wrong — they wrote a name and somebody else went |
| **movement** | whether the numbers move day to day, or every day is the same |
| **freshness** | how much of the writing a real playthrough reaches |
| **pressure** | whether the survival layer has any say at all |

## Flags — the report writes its own bug reports

These are the things a player cannot see from inside a playthrough:

```
LINE REPEAT x12: "Do we have to do this?"  [pool: greet:10]
NEED PINNED: Firewood was empty on 11 of 14 days
EASY PATH: "Bond" is 71% of everything the player did
DEAD OPTIONS: 4 offered 25+ times and never taken
FLAT: tension is 12/100 — that axis is not doing anything
ONE-PERSON GAME: 66% of targeted actions went at Hala
NO WARM RELATIONSHIPS after 12 days
NO VOTE INTEL gathered all season — nobody ever named a target
EVACUATIONS: 2 this season (real show: 10% of seasons see two, 2% see three)
CAMP TOO EASY: needs averaged 0.84 — the layer may not be biting
```

## Reading a log

Without a token, from anywhere:

```bash
curl -s 'https://ntfy.sh/castaway-devlog-soesanair/json?poll=1'
```

With a token configured, the gist URL is shown on the log screen and is copyable
with a tap.

## Tests

`tools/log-export-test.js` — 30 checks. Plays one real day through the live UI to
prove the `Trace` and `Telemetry` hooks are genuinely wired into the day loop, then
verifies: the report's sections; that the flags fire on deliberately broken states;
that the journal captures actions, offers, shown items and ballots-with-reasons;
that dominance and one-person play are detected; that a bad token reports itself
instead of failing silently; and — the whole point — that the report POSTs to
ntfy.sh from the page and comes back out over plain HTTP with no credentials.

One harness note: the harnesses used fixed debug ports and profile directories, so
a crashed run left a Chrome holding both and the next run silently attached to that
stale instance mid-test rather than booting a fresh page. Ports and profiles are
randomised per run now.
