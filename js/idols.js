/* ============================================================
   HIDDEN IMMUNITY IDOLS — and the inventory that holds them.

   On the show an idol does one thing: after the votes are cast and before they
   are read, the holder can play it, and every vote against them stops existing.
   That is the entire mechanic, and it is devastating because of WHEN it happens —
   the room has already committed and cannot take it back.

   What makes idols good television is not the power, it is the misjudgement.
   People play them on nights nobody was coming for them. People hold them one
   council too long and go home with one in their pocket, which has happened many
   times and is always the same shape of mistake: they could not read the room and
   they did not want to waste it. So the NPC decision here is deliberately
   fallible, driven by what a castaway BELIEVES about the vote rather than by what
   the vote actually is. A perfect idol AI would be both unrealistic and boring.

   FINDING one is rare on purpose. There is a small chance per camp job on the
   three jobs that take you out of camp — firewood, water, food — because those
   are the ones that put you alone in the treeline or out on the rocks, which is
   where they are hidden and how they are actually found.

   One concession to the show's reality: production makes sure idols get found.
   The chance ramps very slightly the longer a season goes with none in play, so
   the feature reliably shows up over a season without any single search being
   anything other than a long shot.
   ============================================================ */
'use strict';

/* An item definition. Kept as a table because more items are coming and the
   inventory should not need to know what any of them are. */
const ITEMS = {
  idol: {
    id: 'idol', name: 'Hidden Immunity Idol', short: 'IDOL',
    desc: 'Play it after the votes are cast. Every vote against you stops counting.',
    playableAtTribal: true
  }
};

const Inventory = {
  /* Items live on the castaway so they travel with saves and eliminations. */
  ensure(c) { if (!c.items) c.items = []; return c.items; },
  add(c, itemId) {
    this.ensure(c).push({ id: itemId, day: GAME.day });
    DBG.log('sim', `${c.displayName} now holds a ${ITEMS[itemId] ? ITEMS[itemId].name : itemId}`);
    return true;
  },
  has(c, itemId) { return this.ensure(c).some(x => x.id === itemId); },
  count(c, itemId) { return this.ensure(c).filter(x => x.id === itemId).length; },
  remove(c, itemId) {
    const list = this.ensure(c);
    const i = list.findIndex(x => x.id === itemId);
    if (i < 0) return false;
    list.splice(i, 1);
    return true;
  },
  /* Everything a castaway is carrying, for the UI. */
  list(c) {
    return this.ensure(c).map(x => Object.assign({}, ITEMS[x.id] || { id: x.id, name: x.id }, { foundDay: x.day }));
  },
  clear(c) { c.items = []; }
};

const Idols = {
  /* Season state. `found` counts what has come out of the ground, `played` what
     has actually been burnt at a council. */
  found: 0,
  played: [],
  dryDays: 0,

  reset() {
    this.found = 0;
    this.played = [];
    this.dryDays = 0;
    if (typeof GAME !== 'undefined' && GAME.cast) for (const c of GAME.cast) Inventory.clear(c);
  },

  /* Which jobs can turn one up: the ones that take you away from camp on your
     own. Cleaning up camp and tending the fire happen in front of everybody. */
  JOB_IDS: ['firewood', 'water', 'food'],

  /* The nightly nudge. Every day with no idol in anybody's hands raises the odds
     a little, so a season reliably produces one or two without any individual
     search being better than a long shot. Capped, so a barren season does not
     end up raining idols in the last week. */
  dailyTick() {
    const anyHeld = alive().some(c => Inventory.has(c, 'idol'));
    if (anyHeld || this.found >= CONFIG.idolMaxPerSeason) { this.dryDays = 0; return; }
    this.dryDays = Math.min(CONFIG.idolDryCap, this.dryDays + 1);
  },

  chanceFor(c, jobId) {
    if (this.found >= CONFIG.idolMaxPerSeason) return 0;
    if (this.JOB_IDS.indexOf(jobId) < 0) return 0;
    if (Inventory.has(c, 'idol')) return 0;          // nobody needs two
    let p = CONFIG.idolFindChance;
    /* The player is the one actually looking — they chose this job on purpose and
       the camera is on them. A modest edge, not a different order of magnitude. */
    if (c.isPlayer) p *= CONFIG.idolPlayerEdge;
    p *= 1 + this.dryDays * CONFIG.idolDryRamp;
    return p;
  },

  /* Called from the job resolution. Returns a line to show, or null. */
  tryFind(c, jobId) {
    const p = this.chanceFor(c, jobId);
    if (p <= 0 || !chance(p)) return null;
    Inventory.add(c, 'idol');
    this.found++;
    this.dryDays = 0;
    DBG.decision('Idol', 'FOUND', { who: c.displayName, job: jobId, day: GAME.day, p: +p.toFixed(5) });
    Trace.mark('idolFound', { who: c.displayName, job: jobId });
    if (c.isPlayer) {
      return pick(IDOL_LINES.playerFind);
    }
    /* An NPC finding one is a secret. The player is told nothing — but the finder
       behaves differently from now on, which is the only tell there is. */
    return null;
  },

  /* ---------- the decision to play ----------
     Driven by what the castaway BELIEVES, not by the real tally. Three inputs:

       heat     how much of the tribe they can tell is looking at them, from
                their own vote-weight reads — which are incomplete
       nerves   temperament. A Paranoid Schemer plays it on a quiet night; an
                Under The Radar sits on it until it is too late
       squeeze  how few people are left. Everybody gets twitchier at six than
                at twelve, and the last council you can use it is the one people
                most often fail to use it at

     Deliberately noisy. A castaway who reads the room right keeps their idol for
     the night it matters; one who does not either wastes it or eats a blindside
     with it in their pocket. Both of those are things that happen every season. */
  senseDanger(c, pool) {
    let heat = 0;
    for (const o of pool) {
      if (o === c) continue;
      /* What they think this person thinks of them. Their own read, so it is
         wrong in the ways their stats make it wrong. */
      const read = o.getVW(c.name);
      const sharp = clamp01(c.stats.gameAwareness);
      heat += Math.max(0, read) * (0.35 + sharp * 0.65);
    }
    heat /= Math.max(1, pool.length - 1);
    return clamp01(heat);
  },

  nervesOf(c) {
    const N = {
      'Paranoid Schemer': 0.92, 'Bitter Veteran': 0.74, 'Emotional Wildcard': 0.72,
      'Chaos Agent': 0.70, 'Villain Arc': 0.58, 'Strategic Veteran': 0.46,
      'Social Butterfly': 0.56, 'Fan Favorite': 0.54, 'Natural Leader': 0.44,
      'Physical Threat': 0.42, 'Camp Provider': 0.40, 'Reluctant Hero': 0.40,
      'Loyal Soldier': 0.34, 'Loyal Follower': 0.32, 'Under The Radar': 0.22
    };
    return N[c.cluster] !== undefined ? N[c.cluster] : 0.45;
  },

  /* Would this NPC play it tonight? */
  wouldPlay(c, pool) {
    if (!Inventory.has(c, 'idol')) return false;
    if (GAME.todayImmune === c) return false;          // already safe, even they can see that
    const heat = this.senseDanger(c, pool);
    const nerves = this.nervesOf(c);
    const squeeze = clamp01((CONFIG.idolSqueezeFrom - pool.length) / CONFIG.idolSqueezeFrom);
    /* A castaway who has been told to their face is much more likely to move. */
    const warned = c.idolWarnedDay === GAME.day ? CONFIG.idolWarnedPush : 0;
    let p = heat * CONFIG.idolHeatWeight
      + nerves * CONFIG.idolNervesWeight
      + squeeze * CONFIG.idolSqueezeWeight
      + warned;
    /* The last-council trap, and it is a real one: past this point an unplayed
       idol is worthless, and people STILL walk out holding them. So the pressure
       goes up but never to certainty. */
    p = clamp01(p);
    const play = chance(p);
    DBG.decision('Idol', 'consider', {
      who: c.displayName, heat: +heat.toFixed(2), nerves: +nerves.toFixed(2),
      squeeze: +squeeze.toFixed(2), warned: !!warned, p: +p.toFixed(2), play
    });
    return play;
  },

  /* Burn one. Returns the set of voter names whose votes no longer count. */
  play(c, votes) {
    if (!Inventory.remove(c, 'idol')) return null;
    const voided = [];
    for (const [voterName, target] of votes) {
      if (target && target.name === c.name) voided.push(voterName);
    }
    this.played.push({ who: c.name, day: GAME.day, voided: voided.length });
    DBG.decision('Idol', 'PLAYED', { who: c.displayName, voided: voided.length, day: GAME.day });
    Trace.mark('idolPlayed', { who: c.displayName, voided: voided.length });
    return voided;
  },

  /* Was it worth it? Used for the reaction lines and for the journal, because
     "they played it on nothing" is the interesting half of the story. */
  judge(voidedCount) {
    return voidedCount === 0 ? 'wasted' : voidedCount === 1 ? 'thin' : 'saved';
  },

  /* Anybody still holding one when they are voted out. The most Survivor outcome
     there is, and it deserves to be said out loud. */
  wastedOn(c) {
    return Inventory.has(c, 'idol');
  }
};
