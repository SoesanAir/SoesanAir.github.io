# 20 Challenge Minigames — design set

Today every challenge is one stat roll behind a "Compete" button. The result is
decided before you press it, so a challenge is an announcement, not a contest.

## Design rules for the set

1. **Under 30 seconds.** Landscape phone, one thumb, no tutorial.
2. **Stat-weighted, not stat-decided.** A castaway's stats set the difficulty band
   and the NPC field's scores; player skill moves the result inside that band. A
   weak-physicality player can still steal a physical challenge — rarely.
3. **NPCs must produce plausible scores on the same scale**, so the leaderboard
   reads honestly without simulating their play.
4. **One verb each.** Tap, hold, drag, time, remember, choose. Never two.
5. **Reusable shell.** `Challenge.run(minigame)` handles intro, countdown, the
   scoring curve, the NPC field and the result screen; a minigame only needs
   `start(ctx)` and to resolve with a 0..1 score.
6. **Readable failure.** You always know *why* you lost.

Mapped to the existing challenge stat tags so the current library can keep its
`physicality / smarts / emotional` weighting.

---

## Physical (weights physicality, some emotional)

**1. Hold the Rope** — hold a button. A wobble meter drifts; nudge left/right taps
to keep it centred. Release or drift out and you drop. *Endurance Hang, Flame
Endurance, Willpower Wall.*

**2. Log Carry Rhythm** — tap alternating left/right in time with a footstep
metronome that speeds up. Mistimed taps stumble you. *Log Carry, Shoulder the Load.*

**3. Breath Hold** — hold to submerge. A rising urge-to-breathe bar; release
exactly at the edge. Overhold and you black out to zero. Pure nerve. *Breath Hold.*

**4. Balance Beam** — tilt-free version: a drifting dot in a narrow lane, tap left
or right to correct. Gusts of wind shove it. *Balance Beam, Rope Bridge.*

**5. Island Sprint** — mash-free: tap the *next* stepping stone as it lights, chain
without missing. Miss and you reset the chain. *Island Sprint.*

**6. Sandbag Stack** — drag bags onto a tower that leans with each placement.
Place off-centre and it topples. Greed vs. safety: bank early or keep stacking.
*Sandbag Stack.*

**7. Dig for Cache** — swipe to dig across a grid; a heat indicator warms as you
near the buried token. Limited swipes. *new.*

---

## Mental (weights smarts)

**8. Slide Puzzle** — 3x3 tile slide, scored on moves and time remaining.
*Slide Puzzle, Maze Crawl.*

**9. Cipher Decode** — a short substitution cipher with two letters given. Tap
letters to fill. *Cipher Decode.*

**10. Memory Grid** — Simon-style: a lengthening sequence of lit tiles to repeat.
Directly rewards the memory stat band. *Memory Grid.*

**11. Coordinates** — a grid and three clues ("north of the palm", "not row 2");
deduce and tap one cell. One guess. *Coordinates.*

**12. Matchstick Math** — a wrong equation in matchsticks; move exactly one to make
it true. *Matchstick Math.*

**13. Sequence Lock** — infer the rule (2, 4, 8, …) and tap the next three values
from a keypad. Wrong entry costs a life. *Sequence Lock.*

**14. Word Unscramble** — anagram of an island word against a timer, with a
letter-reveal hint that costs score. *Word Unscramble.*

**15. Blind Build** — a shape is shown for two seconds, then hidden; rebuild it
from memory by dragging pieces. *Blind Build.*

---

## Social / nerve (weights emotional, gameAwareness)

**16. Starvation Auction** — bid against NPCs for food lots with a shared budget.
Overpay and you starve later; underbid and you get nothing. Real economy,
no dexterity. *Starvation Auction.*

**17. Night Watch** — stay awake: tap each faint sound as it appears, ignore
decoys. False taps wake the camp and cost score. *Night Watch.*

**18. Hold Your Nerve** — a rising pot; tap BANK to take it or hold for more while
NPCs drop out one by one. Last one holding takes double, busts take nothing.
Pure chicken. *new — the most Survivor thing on this list.*

**19. Trust Fall** — pick a partner from the tribe; your score is the average of
your input and *their* stat, but a low-trust partner may deliberately drop you.
Turns the relationship graph into a challenge input. *new — highest value.*

**20. Puzzle Relay** — you do a fast 3-tile sort, then hand off to two tribemates
whose legs auto-resolve from their stats; you choose the running order. Ordering
IS the game. *new — makes tribe composition matter.*

---

## Build order if implemented

1. **Shell first** (`Challenge.run`, scoring curve, NPC field, result screen) —
   nothing else is testable without it.
2. **#1 Hold the Rope, #10 Memory Grid, #18 Hold Your Nerve** — one per category,
   proves the shell across a hold, a memory and a nerve verb.
3. **#19 Trust Fall and #20 Puzzle Relay** — these two feed the social sim back
   into challenges, which is the thing no other Survivor game does.
4. The remaining 15 are then content, not engineering.

## Balance note

Each minigame needs a `difficultyFor(castaway)` that widens the tolerance window
for high-stat players rather than granting bonus points, so the stat is felt as
*ease*, not as an invisible additive advantage. Verify with a Monte Carlo sweep:
a 0.8-physicality castaway should win a physical challenge roughly 55-65% of the
time against a field, never 95%.
