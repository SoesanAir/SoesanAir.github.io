/* ============================================================
   TRIBAL READ — what Peff noticed.

   The engine that lets tribal council be about something. It reads the last few
   days of this tribe's actual history and emits Facts: ranked, specific things
   that happened, each one already resolved to the people involved.

   THE WHOLE POINT IS WHAT IT REFUSES TO READ.

   Peff is not omniscient and must never sound like he has been handed the save
   file. He knows what he watched at the challenge, what the cameras saw at camp,
   and what was said out loud at a previous council. He does not know who is
   aligned with whom, who is sitting on an idol, or what was whispered on the
   bench thirty seconds ago.

   So every reader below pulls from a PUBLIC source only:

     Journal.challenges   ranks, margins, who lagged        <- he ran the challenge
     Journal.ballots      vote counts, ties, margins        <- he read them out
     CampNeeds / Fire     food, water, fire, shelter        <- cameras at camp
     c.workRecent         who is visibly not working        <- cameras at camp
     c.hunger / .fatigue  who is falling apart              <- he can see them
     Journal.events       fights and confrontations         <- only ones held openly
     GAME.merged / .jury  the shape of the game             <- he announced it

   And these are deliberately NOT imported, even though they would make for juicy
   questions: Coalitions, PlayerAlliances, NpcBlocs, Idols, Whisper, Lying. If a
   future topic wants one of them, the answer is no. That information belongs to
   the castaways, and the drama is them choosing to spend it.

   Each Fact:
     { id, weight, about, also, subs }
       id      matches a topic in the lines files
       weight  how newsworthy — the scene takes the top few
       about   the castaway Peff addresses, or null for the whole bench
       also    others who could be pulled in for a chime
       subs    interpolation values. PUBLIC ONLY. Asserted in the harness.
   ============================================================ */

'use strict';

const TribalRead = {
  /* How far back a question can reach. Two councils ago is ancient history out
     there — people are hungry and the days blur. */
  LOOKBACK: 3,

  /* ---------- helpers ---------- */
  recentChallenges(pool) {
    const day = GAME.day;
    return (Journal.challenges || []).filter(r => day - r.day <= this.LOOKBACK);
  },
  lastBallot() {
    const b = Journal.ballots || [];
    return b.length ? b[b.length - 1] : null;
  },
  /* Only people at THIS council. A question about somebody at the other camp, or
     already gone, is the single most immersion-breaking thing this can do. */
  here(pool, name) {
    return pool.find(c => !c.eliminated && (c.name === name || c.displayName === name)) || null;
  },
  eventsIn(kinds) {
    const day = GAME.day;
    const set = new Set(kinds);
    return (Journal.events || []).filter(e => set.has(e.kind) && day - e.day <= this.LOOKBACK);
  },
  /* Whoever is furthest along a visible axis, so a topic always has a subject. */
  most(pool, fn) {
    let best = null, bv = -Infinity;
    for (const c of pool) {
      if (c.eliminated) continue;
      const v = fn(c);
      if (v > bv) { bv = v; best = c; }
    }
    return { who: best, value: bv };
  },

  /* ============================================================
     The readers. Each returns a Fact or null.
     Weights are on a common scale: 1.0 is worth asking about, 2.0 is the thing
     everybody is already thinking about, below 0.6 gets dropped.
     ============================================================ */

  /* ---------- challenges ---------- */
  fLostAgain(pool) {
    const mine = GAME.player.tribeName;
    const tribal = this.recentChallenges(pool).filter(r => r.kind === 'tribal');
    if (!tribal.length) return null;
    let streak = 0;
    for (let i = tribal.length - 1; i >= 0; i--) {
      if (tribal[i].playerWon) break;
      streak++;
    }
    if (streak < 2) return null;
    return { id: 'lostAgain', weight: 0.9 + streak * 0.35, about: null, also: [], subs: { n: streak } };
  },
  fBlowout(pool) {
    const r = this.recentChallenges(pool).filter(x => x.kind === 'tribal').pop();
    if (!r || r.playerWon) return null;
    return { id: 'blowout', weight: 1.1, about: null, also: [], subs: { chal: r.chal } };
  },
  fWonImmunity(pool) {
    if (!GAME.todayImmune) return null;
    const w = GAME.todayImmune;
    return {
      id: 'wonImmunity', weight: 1.5, about: w, also: [],
      subs: { who: w.displayName, chal: (GAME.lastChallenge && GAME.lastChallenge.name) || 'the challenge' }
    };
  },
  fWeakLink(pool) {
    const r = this.recentChallenges(pool).pop();
    if (!r || !r.weakest) return null;
    const c = this.here(pool, r.weakest);
    if (!c) return null;
    /* Not worth asking if they also won immunity — the bench will laugh. */
    if (GAME.todayImmune === c) return null;
    return {
      id: 'weakLink', weight: 1.4, about: c, also: [],
      subs: { who: c.displayName, chal: r.chal }
    };
  },
  fCarried(pool) {
    const r = this.recentChallenges(pool).pop();
    if (!r || !r.field_scores || !r.field_scores.length) return null;
    const topName = String(r.field_scores[0]).replace(/ [-0-9.]+$/, '');
    const c = this.here(pool, topName);
    if (!c) return null;
    return { id: 'carried', weight: 1.15, about: c, also: [], subs: { who: c.displayName, chal: r.chal } };
  },
  fCloseCall(pool) {
    const r = this.recentChallenges(pool).filter(x => x.kind === 'tribal').pop();
    if (!r) return null;
    /* A near miss reads completely differently from a hammering, and the tribe
       argues about it for days. */
    if (r.playerWon) return null;
    return { id: 'closeCall', weight: 0.85, about: null, also: [], subs: { chal: r.chal } };
  },

  /* ---------- camp and body ---------- */
  fNoFood(pool) {
    if (typeof CampNeeds === 'undefined') return null;
    const s = CampNeeds.severity('food');
    if (s < 0.55) return null;
    return { id: 'noFood', weight: 0.8 + s, about: null, also: [], subs: {} };
  },
  fFireOut(pool) {
    const f = typeof GAME.campFire === 'number' ? GAME.campFire : 1;
    if (f > 0.28) return null;
    return { id: 'fireOut', weight: 1.3, about: null, also: [], subs: {} };
  },
  fShelterBad(pool) {
    if (typeof CampNeeds === 'undefined') return null;
    const s = CampNeeds.severity('shelter');
    if (s < 0.5) return null;
    const wet = typeof Weather !== 'undefined' && (Weather.today === 'Stormy' || Weather.today === 'Rainy');
    return {
      id: 'shelterBad', weight: 0.75 + s + (wet ? 0.4 : 0), about: null, also: [],
      subs: { weather: wet ? String(Weather.today).toLowerCase() : 'the wind' }
    };
  },
  fNotPulling(pool) {
    const m = this.most(pool.filter(c => c !== GAME.todayImmune), c => (c.slackRun || 0));
    if (!m.who || m.value < 2) return null;
    return {
      id: 'notPulling', weight: 0.9 + m.value * 0.2, about: m.who, also: [],
      subs: { who: m.who.displayName, days: m.value }
    };
  },
  fWorker(pool) {
    const m = this.most(pool, c => (c.workRecent || 0));
    if (!m.who || m.value < 1.1) return null;
    return { id: 'worker', weight: 0.85, about: m.who, also: [], subs: { who: m.who.displayName } };
  },
  fWorn(pool) {
    const m = this.most(pool, c => (c.hunger || 0) * 0.5 + (c.fatigue || 0) * 0.5);
    if (!m.who || m.value < 0.72) return null;
    return { id: 'worn', weight: 0.8 + (m.value - 0.72) * 2, about: m.who, also: [], subs: { who: m.who.displayName } };
  },

  /* ---------- the vote, and the shape of the game ---------- */
  fLastUnanimous(pool) {
    const b = this.lastBallot();
    if (!b || !b.tally || b.tally.length !== 1) return null;
    return { id: 'lastUnanimous', weight: 1.0, about: null, also: [], subs: { gone: b.eliminated } };
  },
  fLastSplit(pool) {
    const b = this.lastBallot();
    if (!b || !b.tally || b.tally.length < 2) return null;
    /* margin >= 1, not just <= 1. A margin of ZERO is a tie, which fLastTie owns at
       a higher weight — and if lastTie had already been spent this season, this
       would fire on the same ballot and render "{margin} vote" as "0 vote".
       Caught by the writer of the lines file, not by a test. */
    if (b.margin < 1 || b.margin > 1) return null;
    return { id: 'lastSplit', weight: 1.25, about: null, also: [], subs: { gone: b.eliminated, margin: b.margin } };
  },
  fLastTie(pool) {
    /* Driven by the logged deadlock rather than the ballot, because only the FINAL
       tally is recorded — after a revote nothing in the journal has a zero margin,
       so reading the ballot would mean this topic could never fire. */
    const e = this.eventsIn(['deadlock']).pop();
    if (!e) return null;
    const b = this.lastBallot();
    return {
      id: 'lastTie', weight: 1.55, about: null, also: [],
      subs: { gone: (b && b.eliminated) || 'somebody' }
    };
  },
  fIdolWasPlayed(pool) {
    /* An idol becomes public the moment it is played, and only then. */
    const e = this.eventsIn(['idolPlayed']).pop();
    if (!e) return null;
    return { id: 'idolWasPlayed', weight: 1.6, about: null, also: [], subs: {} };
  },
  fRepeatTarget(pool) {
    /* Who keeps having their name come up. Public, because Peff read the votes. */
    const counts = new Map();
    for (const b of (Journal.ballots || [])) {
      for (const row of (b.tally || [])) {
        const nm = row[0];
        counts.set(nm, (counts.get(nm) || 0) + 1);
      }
    }
    let best = null, bv = 0;
    for (const [nm, n] of counts) {
      const c = this.here(pool, nm);
      if (c && n > bv) { bv = n; best = c; }
    }
    if (!best || bv < 2) return null;
    return { id: 'repeatTarget', weight: 1.2 + bv * 0.2, about: best, also: [], subs: { who: best.displayName, n: bv } };
  },
  fFirstTribal(pool) {
    if ((Journal.ballots || []).length) return null;
    return { id: 'firstTribal', weight: 1.7, about: null, also: [], subs: {} };
  },

  /* ---------- social, in the open ---------- */
  fPublicFight(pool) {
    const e = this.eventsIn(['confront', 'dilemma']).pop();
    if (!e) return null;
    /* The detail string is free text, so pull names out of the pool rather than
       trusting its shape. */
    const named = pool.filter(c => !c.eliminated && String(e.detail || '').indexOf(c.displayName) >= 0);
    if (!named.length) return null;
    return {
      id: 'publicFight', weight: 1.35, about: named[0], also: named.slice(1, 2),
      subs: { who: named[0].displayName, other: named[1] ? named[1].displayName : 'somebody here' }
    };
  },
  fToldToFace(pool) {
    const e = this.eventsIn(['confrontDeal']).pop();
    if (!e) return null;
    const named = pool.filter(c => !c.eliminated && String(e.detail || '').indexOf(c.displayName) >= 0);
    const who = named[0] || null;
    if (!who) return null;
    return {
      id: 'toldToFace', weight: 1.45, about: who, also: [],
      subs: { who: who.displayName, other: GAME.player.displayName }
    };
  },
  fMerged(pool) {
    if (!GAME.merged) return null;
    /* Only the first council after it. After that it is not news. */
    const since = (Journal.ballots || []).filter(b => b.day >= (GAME.mergeDay || 0));
    if (since.length) return null;
    return { id: 'merged', weight: 1.8, about: null, also: [], subs: {} };
  },
  fJuryForming(pool) {
    if (typeof Jury === 'undefined' || !GAME.jury) return null;
    if (!GAME.jury.length) return null;
    return { id: 'juryForming', weight: 1.05, about: null, also: [], subs: { n: GAME.jury.length } };
  },
  fQuietOne(pool) {
    /* Somebody who has barely registered. Low social, and not the loud ones. */
    const m = this.most(pool, c => (c.isPlayer ? -9 : (1 - (c.stats.social || 0.5)) + (1 - (c.stats.relational || 0.5)) * 0.5));
    if (!m.who || m.value < 0.85) return null;
    return { id: 'quietOne', weight: 0.75, about: m.who, also: [], subs: { who: m.who.displayName } };
  },
  fNumbersAgainst(pool) {
    if (!GAME.merged) return null;
    /* Which original tribe still has the numbers. Visible to everyone — they all
       know who they marooned with. */
    const byOrigin = new Map();
    for (const c of pool) {
      if (c.eliminated) continue;
      const o = c.originalTribe || c.tribeName || '?';
      byOrigin.set(o, (byOrigin.get(o) || 0) + 1);
    }
    if (byOrigin.size < 2) return null;
    const rows = [...byOrigin.entries()].sort((a, b) => b[1] - a[1]);
    if (rows[0][1] - rows[1][1] < 2) return null;
    return {
      id: 'numbersAgainst', weight: 1.3, about: null, also: [],
      subs: { big: rows[0][0], small: rows[1][0], gap: rows[0][1] - rows[1][1] }
    };
  },

  /* ============================================================
     Everything, ranked.
     ============================================================ */
  READERS: ['fFirstTribal', 'fMerged', 'fWonImmunity', 'fIdolWasPlayed', 'fLastTie',
    'fToldToFace', 'fWeakLink', 'fPublicFight', 'fNumbersAgainst', 'fLastSplit',
    'fRepeatTarget', 'fCarried', 'fLostAgain', 'fFireOut', 'fJuryForming',
    'fLastUnanimous', 'fNotPulling', 'fShelterBad', 'fBlowout', 'fCloseCall',
    'fWorn', 'fWorker', 'fNoFood', 'fQuietOne'],

  facts(pool) {
    const out = [];
    for (const key of this.READERS) {
      let f = null;
      /* One broken reader must not take the whole council down with it — a tribal
         that throws leaves the player on a dead screen with no way back. */
      try { f = this[key](pool); } catch (err) { f = null; }
      if (f && f.weight >= 0.6) out.push(f);
    }
    /* Never ask about the same person twice in one council, and never re-ask a
       topic the season has already used. */
    /* typeof, not a truthiness check: TribalQA is a const in a script loaded after
       this one, and a bare `TribalQA ?` on an undeclared identifier throws a
       ReferenceError rather than falling through to the default. */
    const usedTopic = typeof TribalQA !== 'undefined' ? TribalQA.usedTopics : new Set();
    return out
      .filter(f => !usedTopic.has(f.id))
      .sort((a, b) => b.weight - a.weight);
  },

  /* How many questions tonight. Early councils are brisk; by the end everybody
     has history with everybody and Peff lets it run. */
  budget() {
    const left = alive().length;
    if (!GAME.merged) return left <= 6 ? 3 : 2;
    if (left <= 5) return 4;
    return 3;
  }
};
