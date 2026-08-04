/* ============================================================
   CAMP — the labour economy everybody lives in.

   Before this, camp work was a private menu the player poked at for a trickle of
   relationship points. Nobody else really lived there. Now the camp is a shared
   place with five standing needs that decay every day, and every castaway on the
   island decides for themselves whether to do anything about it.

   Five needs, each 0..1 where 1 is "sorted":

     FIREWOOD  burns down every night. Empty pile, dead fire, cold night.
     WATER     drunk by however many people are still in the game.
     FOOD      the shared store. Eating takes from it. Foraging fills it.
     SHELTER   degrades slowly, and violently in a storm.
     CLEAN     a filthy camp spoils food and attracts things.

   Everything else in this file exists to make that board social:

     WORK_ETHIC     hidden, per temperament. Some castaways graft without being
                    asked. Some genuinely never lift a finger all season.
     Ledger         what the tribe has NOTICED you doing lately, measured against
                    what everyone else is doing. Relative, because "he never
                    helps" is always a comparison.
     Labour         the daily decision. Temperament, fatigue, morale, weather —
                    and how bad the need is, which is the important one.
     CallOut        the player pointing at a need and telling the tribe. Its
                    weight is your own record, so it cannot be spammed.
     Nights         what the camp does back to you while you sleep.

   ---- DESIGN NOTE: the death spiral, and why it does not happen ----
   Mapping this before building it (systems-interaction-mapper) turned up an
   obvious reinforcing loop: camp decays -> bad night -> everyone tired and
   miserable -> nobody works -> camp decays worse. With medivacs already firing
   at hunger > 0.8, that loop ends seasons by attrition instead of by voting.

   The brake is SEVERITY_PUSH in Labour.driveFor: the worse a need gets, the MORE
   likely people are to deal with it. Hungry people forage harder. That single
   term turns the spiral from reinforcing into balancing, and it is why even a
   Villain Arc will fetch water when the water is gone.

   Second brake: decay is proportional to what you have (DECAY_FLOOR), so needs
   settle into a readable band instead of pinning at empty forever.
   ============================================================ */

'use strict';

/* ---------- the board ----------
   `zone` and `act` are on every need because work has to HAPPEN somewhere: the
   castaway walks to the right part of the island and plays the right action.
   `act` is the animation tag — see Beach.sendToWork. */
const CAMP_NEEDS = [
  {
    id: 'firewood', label: 'Firewood', short: 'wood',
    /* The fire burns the same whether nine people are watching it or four, so
       most of this need's drain is the nightly burn in decay(), not here. */
    drainBase: 0.11, perHead: 0,        // one wood run restores 0.26
    call: 'We need firewood.',
    low: 'the woodpile is down to splinters', ok: 'the woodpile is stacked high'
  },
  {
    id: 'water', label: 'Water', short: 'water',
    drainBase: 0.05, perHead: 0.14,     // one water run restores 0.24
    call: 'We need water.',
    low: 'nobody has boiled water since yesterday', ok: 'there is clean water for everyone'
  },
  {
    id: 'food', label: 'Food store', short: 'food',
    drainBase: 0.04, perHead: 0.12,     // one forage restores ~0.20
    call: 'We need food.',
    low: 'the food basket is bare', ok: 'there is food put by'
  },
  {
    id: 'shelter', label: 'Shelter', short: 'shelter',
    drainBase: 0.12, perHead: 0,        // one repair restores 0.24
    call: 'The shelter needs fixing.',
    low: 'the shelter leaks and lists', ok: 'the shelter is tight and dry'
  },
  {
    id: 'clean', label: 'Camp', short: 'camp',
    drainBase: 0.05, perHead: 0.13,     // one clean-up restores 0.30
    call: 'This camp is filthy.',
    low: 'camp is a tip — shells, husks and flies', ok: 'camp is swept and sorted'
  }
];
const needById = id => CAMP_NEEDS.find(n => n.id === id) || null;

/* Weather multiplies the drain on the things weather actually touches. */
const WEATHER_DRAIN = {
  Sunny: {},
  Rainy: { firewood: 1.35, shelter: 1.8, clean: 1.25 },
  Stormy: { firewood: 1.5, shelter: 3.0, clean: 1.5, food: 1.2 },
  Hot: { water: 1.6, food: 1.25, clean: 1.2 }
};

/* Below this, a need is a problem people talk about. */
const NEED_LOW = 0.32;
/* Decay is proportional to the level, so a full store empties faster than an
   empty one, and nothing gets pinned at zero with no way back. */
const DECAY_FLOOR = 0.40;

/* Who this camp actually feeds. Pre-merge there are two camps and eighteen
   castaways alive, but only the player's nine live here — so consumption and
   nightly events both have to be scoped to them. Getting this wrong scaled
   demand to eighteen people against a labour supply of eight, which is what
   collapsed the camp every season regardless of what anyone did. */
function campPool() {
  if (!GAME.player) return [];
  /* Delegates to the one definition of "who shares a camp right now" (game.js),
     so this and the social layer can never disagree about who is present. */
  return campmates(GAME.player);
}

const CampNeeds = {
  /* Stored on GAME so the existing save picks it up. foodStore and shelter
     already existed and are still the same numbers other code reads. */
  ensure() {
    const g = GAME;
    if (g.camp === undefined || g.camp === null) g.camp = {};
    const d = { firewood: 0.55, water: 0.50, food: 0.35, shelter: 0.35, clean: 0.60 };
    for (const n of CAMP_NEEDS) {
      if (typeof g.camp[n.id] !== 'number' || !isFinite(g.camp[n.id])) g.camp[n.id] = d[n.id];
    }
    if (typeof g.campFire !== 'number') g.campFire = 0.45;
    this.mirror();
  },
  get(id) { return (GAME.camp && typeof GAME.camp[id] === 'number') ? GAME.camp[id] : 0; },
  set(id, v) { if (!GAME.camp) GAME.camp = {}; GAME.camp[id] = clamp01(v); this.mirror(); },
  add(id, d) { this.set(id, this.get(id) + d); },

  /* Older code (Morale, the camp readout, the challenge scorer) reads
     GAME.foodStore and GAME.shelter directly. Keep them in step rather than
     hunting down every reader. */
  mirror() {
    if (!GAME.camp) return;
    GAME.foodStore = GAME.camp.food;
    GAME.shelter = GAME.camp.shelter;
  },
  pull() {
    /* The other direction, for the few places that still write foodStore. */
    if (!GAME.camp) return;
    if (typeof GAME.foodStore === 'number') GAME.camp.food = clamp01(GAME.foodStore);
    if (typeof GAME.shelter === 'number') GAME.camp.shelter = clamp01(GAME.shelter);
  },

  /* 0 = fine, 1 = desperate. Drives both the labour AI and what people say. */
  severity(id) { return clamp01((NEED_LOW + 0.18 - this.get(id)) / (NEED_LOW + 0.18)); },
  worst() {
    let best = null, bv = -1;
    for (const n of CAMP_NEEDS) { const s = this.severity(n.id); if (s > bv) { bv = s; best = n; } }
    return { need: best, severity: bv };
  },
  /* Everything below the line, worst first — what the tribe would grumble about. */
  problems() {
    return CAMP_NEEDS.filter(n => this.get(n.id) < NEED_LOW)
      .sort((a, b) => this.get(a.id) - this.get(b.id));
  },
  /* One-line state of the camp, for the feed and the morning. */
  describe() {
    const bad = this.problems();
    if (!bad.length) return 'Camp is in good order.';
    return 'Camp: ' + bad.slice(0, 2).map(n => n.low).join(', and ') + '.';
  },
  label(id) {
    const v = this.get(id);
    return v > 0.72 ? 'good' : v > 0.46 ? 'ok' : v > NEED_LOW ? 'thin' : v > 0.14 ? 'low' : 'gone';
  },

  /* Daily decay, run at nightfall. Proportional, weather-scaled, headcount-scaled. */
  decay(cast) {
    /* Always the camp's own headcount, never everyone left in the game. */
    const heads = Math.max(1, (cast && cast.length ? cast : campPool()).length);
    const wx = WEATHER_DRAIN[Weather.today] || {};
    const before = {};
    for (const n of CAMP_NEEDS) {
      before[n.id] = this.get(n.id);
      const raw = (n.drainBase + n.perHead * (heads / 9)) * (wx[n.id] || 1) * CONFIG.campDrainScale;
      const shaped = raw * (DECAY_FLOOR + (1 - DECAY_FLOOR) * this.get(n.id));
      this.add(n.id, -shaped);
    }
    /* The fire eats the woodpile. No wood and it gutters down rather than
       snapping out, so one bad day is recoverable and three are not. */
    const burn = 0.20 * (0.5 + 0.5 * (GAME.campFire || 0));
    if (this.get('firewood') > 0.05) {
      this.add('firewood', -Math.min(burn, this.get('firewood')));
      GAME.campFire = clamp01((GAME.campFire || 0) + 0.20);
    } else {
      GAME.campFire = clamp01((GAME.campFire || 0) - 0.35);
    }
    DBG.log('sim', 'Camp decay ' + CAMP_NEEDS.map(n =>
      `${n.short} ${before[n.id].toFixed(2)}->${this.get(n.id).toFixed(2)}`).join(' ')
      + ` fire ${(GAME.campFire || 0).toFixed(2)} (${Weather.today}, ${heads} left)`);
  }
};

/* ---------- who actually helps ----------
   Hidden, never shown as a number. This is the answer to "some characters will
   help naturally, other never at all" — Villain Arc and Paranoid Schemer really
   will sit there all season unless the camp is genuinely falling apart. */
const WORK_ETHIC = {
  'Camp Provider': 0.92, 'Loyal Soldier': 0.80, 'Physical Threat': 0.72,
  'Reluctant Hero': 0.68, 'Natural Leader': 0.58, 'Loyal Follower': 0.56,
  'Under The Radar': 0.48, 'Fan Favorite': 0.40, 'Emotional Wildcard': 0.34,
  'Strategic Veteran': 0.28, 'Social Butterfly': 0.24, 'Chaos Agent': 0.20,
  'Paranoid Schemer': 0.18, 'Bitter Veteran': 0.14, 'Villain Arc': 0.10
};
/* And how much they JUDGE everyone else for it. A Camp Provider keeps score all
   season. A Chaos Agent could not tell you who fetched the water. */
const WORK_VALUES = {
  'Camp Provider': 1.00, 'Loyal Soldier': 0.90, 'Physical Threat': 0.85,
  'Reluctant Hero': 0.70, 'Natural Leader': 0.65, 'Loyal Follower': 0.60,
  'Bitter Veteran': 0.55, 'Under The Radar': 0.45, 'Fan Favorite': 0.40,
  'Emotional Wildcard': 0.35, 'Strategic Veteran': 0.25, 'Social Butterfly': 0.20,
  'Chaos Agent': 0.15, 'Paranoid Schemer': 0.15, 'Villain Arc': 0.10
};
/* Which jobs each temperament gravitates to, so the island looks like people
   with habits rather than a work rota. */
const JOB_TASTE = {
  'Camp Provider': { food: 1.6, water: 1.5, clean: 1.2 },
  'Physical Threat': { firewood: 1.7, shelter: 1.6 },
  'Loyal Soldier': { firewood: 1.3, shelter: 1.4, water: 1.2 },
  'Reluctant Hero': { shelter: 1.3, firewood: 1.2 },
  'Natural Leader': { shelter: 1.3, fire: 1.4 },
  'Under The Radar': { clean: 1.6, water: 1.3 },
  'Loyal Follower': { clean: 1.4, water: 1.3 },
  'Social Butterfly': { clean: 1.3, water: 1.2 },
  'Fan Favorite': { food: 1.2, clean: 1.2 },
  'Strategic Veteran': { fire: 1.3, clean: 1.1 },
  'Emotional Wildcard': { food: 1.2 },
  'Bitter Veteran': { firewood: 1.2 },
  'Paranoid Schemer': { fire: 1.2 },
  'Chaos Agent': { firewood: 1.3 },
  'Villain Arc': { fire: 1.2 }
};
const ethicOf = c => {
  if (c._ethic === undefined) {
    const base = WORK_ETHIC[c.cluster] !== undefined ? WORK_ETHIC[c.cluster] : 0.45;
    /* A little personal spread, plus the practical stats. Two Social Butterflies
       are not identically useless. */
    c._ethic = clamp01(base + rr(-0.09, 0.09)
      + (c.stats.background - 0.5) * 0.16 + (c.stats.physicality - 0.5) * 0.10);
  }
  return c._ethic;
};
const valuesWork = c => (WORK_VALUES[c.cluster] !== undefined ? WORK_VALUES[c.cluster] : 0.4);

/* ---------- the jobs ----------
   Each one names the zone the castaway physically goes to and the `act` tag the
   figure plays there, so nothing is done by teleport and every action already
   carries the parameter an animation will hang off later. */
const CAMP_JOBS = [
  {
    id: 'firewood', need: 'firewood', label: 'Haul firewood', hours: 1.0, fatigue: 0.10,
    zone: 'Forest', act: 'chop', gain: 0.26,
    verb: 'dragging wood back from the treeline',
    admire: ['Camp Provider', 'Loyal Soldier', 'Physical Threat', 'Natural Leader', 'Reluctant Hero'],
    done: 'You drag back an armful of dead wood. The pile looks like a pile again.'
  },
  {
    id: 'water', need: 'water', label: 'Boil water', hours: 1.0, fatigue: 0.07,
    zone: 'Well', act: 'haul', gain: 0.24,
    verb: 'hauling and boiling water at the well',
    admire: ['Camp Provider', 'Loyal Soldier', 'Reluctant Hero', 'Loyal Follower', 'Under The Radar'],
    done: 'Clean water for everyone. Nobody says thank you. They noticed.'
  },
  {
    id: 'food', need: 'food', label: 'Forage and fish', hours: 1.5, fatigue: 0.11,
    zone: 'Rocky', act: 'gather', gain: 0.20,
    verb: 'working the rocks for anything edible',
    admire: ['Camp Provider', 'Physical Threat', 'Loyal Soldier', 'Natural Leader'],
    done: null   // result depends on the haul
  },
  {
    id: 'shelter', need: 'shelter', label: 'Shore up the shelter', hours: 1.5, fatigue: 0.12,
    zone: 'Shelter', act: 'build', gain: 0.24,
    verb: 'lashing the shelter frame back together',
    admire: ['Camp Provider', 'Physical Threat', 'Natural Leader', 'Loyal Soldier', 'Reluctant Hero'],
    done: 'It will hold through the next storm. Probably.'
  },
  {
    id: 'clean', need: 'clean', label: 'Clean up camp', hours: 0.5, fatigue: 0.04,
    zone: 'Camp', act: 'tidy', gain: 0.30,
    verb: 'raking husks and shells out of camp',
    admire: ['Camp Provider', 'Under The Radar', 'Loyal Follower', 'Loyal Soldier'],
    done: 'Small thing. Camp stops smelling like a bin.'
  },
  {
    /* The one job that consumes a need instead of filling it — and the only one
       that trains the hidden fire skill the final four turns on. */
    id: 'fire', need: null, label: 'Work the fire', hours: 1.0, fatigue: 0.08,
    zone: 'FirePit', act: 'tend', gain: 0,
    verb: 'crouched over the fire pit',
    admire: ['Camp Provider', 'Loyal Soldier', 'Physical Threat', 'Natural Leader', 'Under The Radar'],
    needsWood: true,
    done: null
  }
];
const jobById = id => CAMP_JOBS.find(j => j.id === id) || null;
/* Effort is what the tribe sees you spend: time on your feet plus how wrecked it
   left you. Keeps a 0.5h tidy from paying like a 1.5h forage. */
const effortOfJob = j => j.hours * 0.5 + j.fatigue * 3;

/* Apply a completed job's effect on the camp. Shared by player and NPCs so the
   two can never drift apart. */
function applyJobEffect(job, worker) {
  if (job.id === 'fire') {
    const wood = CampNeeds.get('firewood');
    if (wood < 0.08) return { ok: false, msg: 'There is no dry wood left to burn. Somebody has to fetch some.' };
    CampNeeds.add('firewood', -0.06);
    GAME.campFire = clamp01((GAME.campFire || 0) + 0.45);
    const gain = Fire.practise(worker);
    return {
      ok: true,
      msg: `The fire takes and climbs. ${Fire.describe(worker)}`
        + (gain > 0.01 ? ' You learned something doing it.' : '')
    };
  }
  if (job.id === 'food') {
    const luck = clamp01(worker.stats.background * 0.5 + worker.stats.physicality * 0.25 + rr(0, 0.45));
    const amount = job.gain * (0.5 + luck);
    CampNeeds.add('food', amount);
    return {
      ok: true,
      msg: luck > 0.62 ? 'A real haul. The whole tribe eats tonight.'
        : luck > 0.30 ? 'Not much, but it is something.'
          : 'Hours of it, and barely a handful.'
    };
  }
  CampNeeds.add(job.need, job.gain);
  return { ok: true, msg: job.done };
}

/* ---------- the ledger ----------
   What the tribe has noticed LATELY, held against what everyone else is doing.
   Relative on purpose: "he never helps" is always a comparison, and it means the
   standard rises when the tribe is grafting and falls when nobody is. */
const Ledger = {
  ensure(c) {
    if (typeof c.workRecent !== 'number' || !isFinite(c.workRecent)) c.workRecent = 0.5;
    if (typeof c.workTotal !== 'number') c.workTotal = 0;
    if (typeof c.workToday !== 'number') c.workToday = 0;
    if (typeof c.slackRun !== 'number') c.slackRun = 0;
    if (!c.campRelGiven) c.campRelGiven = {};
  },
  credit(c, effort, jobId) {
    this.ensure(c);
    c.workToday += effort;
    c.workTotal += effort;
    if (jobId) c.lastJob = jobId;
    c.lastWorkDay = GAME.day;
  },
  /* Roll today into the remembered average. Memory is short — about four days —
     so one lazy day is survivable and one good day is genuinely redemptive. */
  roll(cast) {
    for (const c of cast) {
      this.ensure(c);
      c.workRecent = c.workRecent * 0.70 + c.workToday;
      c.slackRun = c.workToday > 0.05 ? 0 : c.slackRun + 1;
      c.workToday = 0;
    }
  },
  /* 0..1, where 0.5 is "about as much as everyone else". */
  rep(c) {
    this.ensure(c);
    const pool = this.pool();
    if (!pool.length) return 0.5;
    let sum = 0;
    for (const o of pool) { this.ensure(o); sum += o.workRecent; }
    const mean = Math.max(0.35, sum / pool.length);
    return clamp01((c.workRecent / mean) / 2);
  },
  pool() {
    if (!GAME.player) return [];
    return campmates(GAME.player);
  },
  /* Words, never numbers — this is a read on a person, not a stat block.
     Phrased to complete "They reckon you ___", which is its only caller. */
  describe(c) {
    const r = this.rep(c);
    return r > 0.78 ? 'carry this camp'
      : r > 0.60 ? 'pull your weight and then some'
        : r > 0.42 ? 'do your share'
          : r > 0.26 ? 'do the minimum'
            : r > 0.12 ? 'barely lift a finger'
              : 'have not done a thing all season';
  },
  /* Who the tribe would name if you asked "who does nothing?" */
  worstIn(pool) {
    let worst = null, wv = 2;
    for (const c of pool) { const r = this.rep(c); if (r < wv) { wv = r; worst = c; } }
    return { who: worst, rep: wv };
  },
  bestIn(pool) {
    let best = null, bv = -1;
    for (const c of pool) { const r = this.rep(c); if (r > bv) { bv = r; best = c; } }
    return { who: best, rep: bv };
  },

  /* The slow social consequence. Every day, everyone nudges their feeling about
     everyone else by the contribution gap, scaled by how much they care. Tiny
     per day; over a season it is a real force. Capped per pair so it can never
     become the whole relationship. */
  socialDrift(cast) {
    let biggest = null;
    for (const o of cast) {
      if (o.eliminated) continue;
      const care = valuesWork(o);
      if (care < 0.12) continue;
      this.ensure(o);
      for (const s of cast) {
        if (s === o || s.eliminated) continue;
        if (!GAME.merged && s.tribeName !== o.tribeName) continue;
        const d = (this.rep(s) - 0.5) * CONFIG.campRelDriftPerDay * care * 2;
        if (Math.abs(d) < 0.0005) continue;
        const given = o.campRelGiven[s.name] || 0;
        const cap = CONFIG.campRelDriftCap;
        const allowed = d > 0 ? Math.min(d, cap - given) : Math.max(d, -cap - given);
        if (Math.abs(allowed) < 0.0005) continue;
        o.campRelGiven[s.name] = given + allowed;
        o.addRel(s.name, allowed, 'camp contribution');
        o.addTrust(s.name, allowed * 0.4, 'camp contribution');
        if (!biggest || Math.abs(allowed) > Math.abs(biggest.d)) biggest = { o, s, d: allowed };
      }
    }
    if (biggest) DBG.rel && DBG.log('rel',
      `Camp drift strongest: ${biggest.o.displayName} -> ${biggest.s.displayName} ${biggest.d > 0 ? '+' : ''}${biggest.d.toFixed(4)}`);
  },

  /* Vote weight. Capped well under a deliberate push (1.5) so slacking is a real
     liability without ever being the only thing that decides a vote. */
  voteWeight(voter, target) {
    const care = valuesWork(voter);
    if (care < 0.12) return 0;
    const r = this.rep(target);
    let w = 0;
    if (r < 0.42) w += (0.42 - r) / 0.42 * CONFIG.campVoteWeightMax * care;
    /* Post-merge the ledger flips: a work resume is a reason to be scared of you.
       This is the brake on a Camp Provider becoming unvotable. */
    if (GAME.merged && r > 0.68) w += (r - 0.68) / 0.32 * CONFIG.campResumeThreat * (0.4 + voter.stats.gameAwareness * 0.9);
    return w;
  }
};

/* ---------- the daily labour decision ---------- */
const Labour = {
  /* How much work this castaway has in them today, 0..~1.4.
     SEVERITY_PUSH is the brake on the death spiral: the worse things get, the
     harder people work, including the ones who never normally bother. */
  driveFor(c) {
    const parts = [];
    let d = ethicOf(c);
    parts.push(['ethic', d]);
    const sev = CampNeeds.worst().severity;
    const push = sev * CONFIG.campSeverityPush;
    d += push; parts.push(['need', push]);
    /* Tiredness ABOVE the normal island level, not tiredness full stop.
       Everyone out here is knackered all the time; that is the baseline, not an
       excuse, and a tribe where nobody works because everybody is tired is a
       tribe that starves. What actually stops someone working is being unusually
       wrecked. (This was absolute fatigue, calibrated back when fatigue sat near
       zero because a night's sleep cleared more than a day accumulated. Once
       fatigue got a realistic resting level of ~0.5 the same coefficient became a
       permanent 0.18 tax on everyone's work drive, and camp needs started pinning
       empty — caught by tools/camp-test.js.) Matches the hunger term below. */
    const fat = -Math.max(0, c.fatigue - CONFIG.fatigueNormal) * CONFIG.campFatigueDrag;
    d += fat; parts.push(['tired', fat]);
    const mor = (c.morale - 0.55) * CONFIG.campMoraleSwing;
    d += mor; parts.push(['morale', mor]);
    const hun = -Math.max(0, c.hunger - CONFIG.hungerNormal) * 0.30;
    if (hun) { d += hun; parts.push(['hungry', hun]); }
    if (Weather.today === 'Stormy') { d -= 0.28; parts.push(['storm', -0.28]); }
    else if (Weather.today === 'Rainy') { d -= 0.12; parts.push(['rain', -0.12]); }
    else if (Weather.today === 'Hot') { d -= 0.07; parts.push(['heat', -0.07]); }
    /* Somebody asked. Whether that lands depends on who asked — see CallOut. */
    const ask = CallOut.pushFor(c);
    if (ask) { d += ask; parts.push(['asked', ask]); }
    /* Immunity round your neck buys you a day off, and people accept it. */
    if (GAME.todayImmune === c) { d -= 0.10; parts.push(['immune', -0.10]); }
    return { drive: Math.max(0, d), parts };
  },

  /* Which job. Need severity first, personal taste second, so people help with
     what is actually wrong but still in character. */
  chooseJob(c) {
    const taste = JOB_TASTE[c.cluster] || {};
    const opts = [];
    for (const job of CAMP_JOBS) {
      if (job.needsWood && CampNeeds.get('firewood') < 0.12) continue;
      let w;
      if (job.id === 'fire') {
        /* On the rota only when the fire is genuinely down. The everyday
           fire-poking that keeps the hidden skill contested is handled
           separately in runDay, so it does not compete for work hours. */
        w = Math.max(0, 0.55 - (GAME.campFire || 0)) * 1.6;
      } else {
        w = 0.12 + CampNeeds.severity(job.need) * 1.5;
      }
      w *= (taste[job.id] || 1);
      /* A call-out points people at one specific thing. */
      if (CallOut.today && CallOut.today.need === job.need) w *= 1 + CallOut.strength(c) * 1.7;
      if (w > 0.01) opts.push({ job, w });
    }
    if (!opts.length) return null;
    const total = opts.reduce((s, o) => s + o.w, 0);
    let roll = rng() * total;
    for (const o of opts) { roll -= o.w; if (roll <= 0) return o.job; }
    return opts[opts.length - 1].job;
  },

  /* Run one day of tribe labour. Returns the assignments so the beach can walk
     everybody to the right place and play the right action. */
  runDay(cast) {
    CampNeeds.ensure();
    const camp = campPool();
    const assignments = [];
    let jobs = 0;
    for (const c of cast) {
      if (c.eliminated || c.isPlayer) continue;
      Ledger.ensure(c);
      const inCamp = camp.indexOf(c) >= 0;
      const { drive } = this.driveFor(c);
      /* Drive above 1 buys a second job — that is what a grafter looks like. */
      let n = 0;
      if (chance(Math.min(0.95, drive))) n = 1;
      if (n && drive > 1 && chance(Math.min(0.7, drive - 1))) n = 2;
      for (let i = 0; i < n; i++) {
        const job = this.chooseJob(c);
        if (!job) break;
        /* Off-tribe castaways still build a record — they arrive at the merge
           with a reputation — but they cannot stock a camp they are not in. */
        if (inCamp) {
          const res = applyJobEffect(job, c);
          if (!res.ok) continue;
          /* An NPC can turn up an idol out there too, and the player is told
             nothing about it. The only tell is that the finder starts behaving
             like somebody with a card to play. */
          Idols.tryFind(c, job.id);
        }
        const eff = effortOfJob(job);
        Ledger.credit(c, eff, job.id);
        c.fatigue = clamp01(c.fatigue + job.fatigue * 0.8);
        if (inCamp) assignments.push({ name: c.name, job, zone: job.zone, act: job.act });
        jobs++;
      }
      /* And then, separately, people sit over the fire because that is what you
         do in the evening. This is the counter-play on the hidden fire skill:
         without it the player is the only castaway who ever gets better at it
         and the final-four fire is an uncontested win. Partial ledger credit —
         poking the embers is not hauling logs. */
      if (inCamp && CampNeeds.get('firewood') > 0.10 && chance(CONFIG.campFireTendChance)) {
        const fj = jobById('fire');
        if (fj && applyJobEffect(fj, c).ok) {
          Ledger.credit(c, effortOfJob(fj) * 0.4, 'fire');
          assignments.push({ name: c.name, job: fj, zone: fj.zone, act: fj.act });
          jobs++;
        }
      }
    }
    /* Log the whole board so the design log tells the story of the day. */
    DBG.log('sim', `Labour day ${GAME.day}: ${jobs} jobs · `
      + assignments.map(a => `${dnOf(a.name)}:${a.job.id}@${a.zone}`).join(' ')
      + ` · ${CampNeeds.describe()}`);
    return assignments;
  },

  /* A readable list of who did what, for the morning feed. */
  summarise(assignments) {
    if (!assignments.length) return 'Nobody lifted a finger around camp today.';
    const by = new Map();
    for (const a of assignments) {
      if (!by.has(a.name)) by.set(a.name, []);
      by.get(a.name).push(a.job.id);
    }
    const bits = [];
    for (const [name, ids] of by) bits.push(`${dnOf(name)} (${ids.join(', ')})`);
    return 'Around camp: ' + bits.join(', ') + '.';
  }
};

/* ---------- calling it out ----------
   The player pointing at the board and telling the tribe. The whole thing hangs
   off ONE rule, which is also what stops it being spammable: how much weight
   your words carry is your own record. Work, and people move. Do nothing, and
   they tell you where to go.  */
const CallOut = {
  today: null,      // { need, day, standing }
  used: [],         // need ids called today

  reset() { this.today = null; this.used = []; },
  newDay() { this.today = null; this.used = []; },

  /* Your standing to ask, 0..1. */
  standing() {
    const P = GAME.player;
    if (!P) return 0;
    return clamp01(0.10 + Ledger.rep(P) * 1.15);
  },
  /* How much THIS castaway is moved by the player asking. Someone who does not
     care about camp work does not care that you asked, either. */
  strength(c) {
    if (!this.today || this.today.day !== GAME.day) return 0;
    const P = GAME.player;
    const warm = c.getTrust(P.name) * 0.5 + c.getRel(P.name) * 0.5;
    return clamp01(this.today.standing * (0.35 + warm * 0.9) * (0.4 + valuesWork(c) * 0.9));
  },
  pushFor(c) {
    const s = this.strength(c);
    return s > 0 ? s * CONFIG.campCallOutDrive : 0;
  },

  /* Called by the UI. Returns { ok, reactions:[{npc,line,kind}], note }. */
  say(needId) {
    const P = GAME.player;
    const need = needById(needId);
    if (!need) return { ok: false, reactions: [], note: '' };
    const repeat = this.used.indexOf(needId) >= 0;
    const standing = this.standing();
    const pool = campmates(P).filter(c => !c.isPlayer);
    const sev = CampNeeds.severity(needId);
    this.used.push(needId);
    this.today = { need: needId, day: GAME.day, standing: repeat ? standing * 0.3 : standing };

    const reactions = [];
    let listened = 0, pushback = 0;
    for (const c of pool) {
      const cares = valuesWork(c);
      const warm = c.getTrust(P.name) * 0.5 + c.getRel(P.name) * 0.5;
      /* Hypocrisy is the thing they react to, not the request. Telling people to
         fetch wood while you have done nothing all week is its own statement. */
      const hypocrite = standing < 0.42 && cares > 0.35;
      if (repeat) {
        if (chance(0.5)) {
          c.addRel(P.name, -0.012, 'nagging about camp');
          reactions.push({ npc: c, line: CampLines.pick('calloutRepeat', c), kind: 'bad' });
          pushback++;
        }
        continue;
      }
      if (hypocrite && chance(0.55 + cares * 0.3)) {
        c.addRel(P.name, -CONFIG.campHypocriteRel * cares, 'told them to work while doing none');
        c.addSuspicion && c.addSuspicion(P.name, 0.01, 'camp hypocrisy');
        reactions.push({ npc: c, line: CampLines.pick('calloutHypocrite', c, { need: need.short }), kind: 'bad' });
        pushback++;
        continue;
      }
      const str = this.strength(c);
      if (str > 0.30 && chance(0.35 + str * 0.5)) {
        /* Agreeing with someone who has earned it is itself a small bond. */
        c.addRel(P.name, CONFIG.campCallOutRel * str, 'you spoke up about camp');
        c.addTrust(P.name, CONFIG.campCallOutRel * str * 0.5, 'you spoke up about camp');
        reactions.push({ npc: c, line: CampLines.pick('calloutAgree', c, { need: need.short }), kind: 'good' });
        listened++;
      } else if (chance(0.28)) {
        reactions.push({ npc: c, line: CampLines.pick('calloutShrug', c, { need: need.short }), kind: '' });
      }
    }
    DBG.action('Called out camp need', need.label,
      `standing=${standing.toFixed(2)} sev=${sev.toFixed(2)} agreed=${listened} pushback=${pushback}${repeat ? ' REPEAT' : ''}`);
    const note = repeat ? 'You have already said that today.'
      : listened > pushback ? `${listened} of them are on it.`
        : pushback ? 'That did not go the way you wanted.'
          : 'A couple of shrugs. Nothing more.';
    return { ok: true, reactions: reactions.slice(0, 4), note, listened, pushback, repeat };
  }
};

/* ---------- nights ----------
   What the camp does back to you. Graded, never lethal (survival-crafting: no
   instant deaths), one event a night at most, and no two catastrophes running.
   There are GOOD nights too, or the whole system reads as punishment. */
const NIGHTS = [
  {
    id: 'rainin', tag: 'RAIN IN THE SHELTER', bad: true, weight: 1.5,
    when: () => CampNeeds.get('shelter') < 0.40 && (Weather.today === 'Rainy' || Weather.today === 'Stormy'),
    apply(cast) {
      for (const c of cast) { c.fatigue = clamp01(c.fatigue + 0.11); c.morale = clamp01(c.morale - 0.06); }
      CampNeeds.add('shelter', -0.06);
      return { blame: 'shelter', text: 'The rain found every gap in the roof. Nobody was dry, nobody slept properly, and everyone knew whose job the shelter was.' };
    }
  },
  {
    id: 'fireout', tag: 'THE FIRE WENT OUT', bad: true, weight: 1.8,
    when: () => (GAME.campFire || 0) < 0.15,
    apply(cast) {
      GAME.campFire = 0;
      for (const c of cast) { c.morale = clamp01(c.morale - 0.08); c.fatigue = clamp01(c.fatigue + 0.06); }
      return { blame: 'firewood', text: 'The fire died some time after midnight. No embers, no light, no way to boil anything in the morning. Everyone woke up cold and quietly furious.' };
    }
  },
  {
    id: 'rats', tag: 'SOMETHING GOT INTO THE FOOD', bad: true, weight: 1.3,
    when: () => CampNeeds.get('clean') < 0.30 && CampNeeds.get('food') > 0.10,
    apply() {
      const lost = Math.min(CampNeeds.get('food'), 0.16);
      CampNeeds.add('food', -lost);
      CampNeeds.add('clean', -0.08);
      return { blame: 'clean', text: 'Rats, or something like them, worked through the basket in the night. What is left of the food is not worth much.' };
    }
  },
  {
    id: 'stormwreck', tag: 'THE STORM TOOK THE SHELTER', bad: true, big: true, weight: 2.4,
    when: () => Weather.today === 'Stormy' && CampNeeds.get('shelter') < 0.62,
    apply(cast) {
      CampNeeds.set('shelter', CampNeeds.get('shelter') * 0.35);
      CampNeeds.add('firewood', -0.20);
      for (const c of cast) { c.fatigue = clamp01(c.fatigue + 0.16); c.morale = clamp01(c.morale - 0.11); }
      return { blame: 'shelter', text: 'The storm came in sideways at two in the morning and took half the roof with it. The tribe spent the rest of the night holding the frame down by hand.' };
    }
  },
  {
    id: 'thirst', tag: 'THE WATER RAN OUT', bad: true, weight: 1.4,
    when: () => CampNeeds.get('water') < 0.12,
    apply(cast) {
      for (const c of cast) { c.hunger = clamp01(c.hunger + 0.09); c.morale = clamp01(c.morale - 0.05); }
      return { blame: 'water', text: 'Nobody had boiled water since the morning before. A dry night on an island is a long one.' };
    }
  },
  {
    id: 'sick', tag: 'SOMEBODY GOT SICK', bad: true, weight: 1.1,
    when: () => CampNeeds.get('clean') < 0.18,
    apply(cast) {
      /* Never an elimination — attrition and drama only. */
      const who = pick(cast);
      who.fatigue = clamp01(who.fatigue + 0.24);
      who.morale = clamp01(who.morale - 0.14);
      for (const c of cast) if (c !== who) c.morale = clamp01(c.morale - 0.03);
      return { blame: 'clean', who, text: `${who.displayName} was up half the night being sick behind the shelter. Camp being a tip finally caught up with somebody.` };
    }
  },
  {
    id: 'tide', tag: 'THE TIDE TOOK THE GEAR', bad: true, weight: 1.0,
    when: () => CampNeeds.get('clean') < 0.34 && (Weather.today === 'Stormy' || Weather.today === 'Rainy'),
    apply() {
      CampNeeds.add('clean', -0.12);
      CampNeeds.add('firewood', -0.14);
      return { blame: 'clean', text: 'Nothing was tied down and the tide came further up the beach than anyone expected. Half the woodpile is somewhere out at sea.' };
    }
  },
  {
    id: 'nosleep', tag: 'NOBODY SLEPT', bad: true, weight: 1.2,
    when: cast => Weather.today === 'Stormy' && cast.filter(c => c.fatigue > 0.55).length >= Math.ceil(cast.length / 2),
    apply(cast) {
      for (const c of cast) c.fatigue = clamp01(c.fatigue + 0.10);
      GAME.badSleep = true;   // read by applySleepRecovery
      return { blame: null, text: 'Thunder all night and a wind that never settled. Everyone is upright this morning and nobody is rested.' };
    }
  },
  /* ---- and the good ones ---- */
  {
    id: 'goodnight', tag: 'A GOOD NIGHT', bad: false, weight: 2.0,
    when: () => CampNeeds.get('shelter') > 0.58 && (GAME.campFire || 0) > 0.45 && Weather.today !== 'Stormy',
    apply(cast) {
      for (const c of cast) { c.fatigue = clamp01(c.fatigue - 0.07); c.morale = clamp01(c.morale + 0.045); }
      GAME.goodSleep = true;
      return { blame: null, text: 'Dry roof, good fire, flat sea. The tribe slept like people who were not being filmed, and it shows this morning.' };
    }
  },
  {
    id: 'feast', tag: 'A PROPER MEAL', bad: false, weight: 1.4,
    when: () => CampNeeds.get('food') > 0.66 && (GAME.campFire || 0) > 0.40,
    apply(cast) {
      const eaten = Math.min(CampNeeds.get('food'), 0.22);
      CampNeeds.add('food', -eaten);
      for (const c of cast) { c.hunger = clamp01(c.hunger - 0.20); c.morale = clamp01(c.morale + 0.09); }
      return { blame: null, credit: true, text: 'Enough food and a fire hot enough to cook it. For one night this stopped feeling like a survival show and started feeling like a camping trip.' };
    }
  },
  {
    id: 'stars', tag: 'A CLEAR NIGHT', bad: false, weight: 1.2,
    when: () => Weather.today === 'Sunny' && CampNeeds.get('clean') > 0.55,
    apply(cast) {
      for (const c of cast) c.morale = clamp01(c.morale + 0.05);
      /* A quiet night together is worth something socially. */
      for (const a of cast) for (const b of cast) if (a !== b && chance(0.35)) a.addRel(b.name, 0.006, 'a good night by the fire');
      return { blame: null, text: 'No wind, no rain, and a sky absolutely thick with stars. People stayed up talking who would not normally bother.' };
    }
  }
];

const Nights = {
  /* Resolve one night. Returns null or { tag, text, kind, blame } for the
     morning to narrate. */
  roll(cast) {
    if (!cast.length) return null;
    const pool = NIGHTS.filter(n => {
      try { return n.when(cast); } catch (e) { return false; }
    });
    if (!pool.length) return null;
    /* Never two catastrophes back to back — the spiral brake at event level. */
    const usable = pool.filter(n => !(n.big && GAME.lastNightBig));
    const list = usable.length ? usable : pool.filter(n => !n.bad);
    if (!list.length) return null;
    /* A well-kept camp mostly gets good nights; a neglected one mostly does not.
       When neither applies the night is simply uneventful — that has to be the
       baseline, or a rough early camp is guaranteed a disaster every night. */
    const bad = list.filter(n => n.bad), good = list.filter(n => !n.bad);
    const from = (bad.length && chance(this.badOdds())) ? bad : good;
    if (!from.length) return null;
    const total = from.reduce((s, n) => s + n.weight, 0);
    let roll = rng() * total, chosen = from[from.length - 1];
    for (const n of from) { roll -= n.weight; if (roll <= 0) { chosen = n; break; } }

    const res = chosen.apply(cast) || {};
    GAME.lastNightBig = !!chosen.big;
    GAME.lastNight = { id: chosen.id, day: GAME.day, bad: chosen.bad };
    let blameLine = '';
    if (chosen.bad && res.blame) blameLine = this.blame(cast, res.blame);
    DBG.log('sim', `Night: ${chosen.id} (${chosen.bad ? 'bad' : 'good'}) ${res.blame ? 'blame=' + res.blame : ''} ${CampNeeds.describe()}`);
    return {
      tag: chosen.tag, text: res.text, kind: chosen.bad ? 'danger' : 'good',
      blame: blameLine, id: chosen.id, bad: chosen.bad
    };
  },

  /* Odds that tonight goes badly, from the state of the camp. Neglect it and it
     is most nights; keep it and it is rare. */
  badOdds() {
    let sev = 0;
    for (const n of CAMP_NEEDS) sev += CampNeeds.severity(n.id);
    sev /= CAMP_NEEDS.length;
    return clamp01(0.08 + sev * 0.62);
  },

  /* The bit the user actually asked for: a bad night gives the tribe a name to
     say. Whoever has done least gets it, and it moves real vote weight. */
  blame(cast, needId) {
    const job = CAMP_JOBS.find(j => j.need === needId);
    const { who, rep } = Ledger.worstIn(cast.filter(c => !c.eliminated));
    if (!who || rep > 0.40) return '';
    let named = 0;
    for (const c of cast) {
      if (c === who || c.eliminated) continue;
      const care = valuesWork(c);
      if (care < 0.2 || !chance(0.35 + care * 0.5)) continue;
      c.addVW(who.name, CONFIG.campBlameVoteWeight * care, 'never helps around camp');
      c.addRel(who.name, -0.015 * care, 'the night we all paid for');
      named++;
    }
    if (!named) return '';
    /* The player hearing it said out loud is the point. */
    const line = CampLines.blameLine(who, job ? job.id : needId);
    DBG.vw && DBG.log('vw', `Camp blame: ${who.displayName} named by ${named} (rep ${rep.toFixed(2)})`);
    return line;
  }
};

/* ---------- gossip ----------
   Work talk in the ambient NPC-to-NPC chatter, so "he never helps" is something
   the player overhears rather than something the UI tells them. */
const CampGossip = {
  /* Returns a feed line, or null. Called from the social tick. */
  maybe(group) {
    if (!group || group.length < 2) return null;
    const pool = Ledger.pool().filter(c => !c.isPlayer || true);
    if (pool.length < 3) return null;
    const speaker = group.find(c => valuesWork(c) > 0.35);
    if (!speaker) return null;
    if (!chance(CONFIG.campGossipChance * valuesWork(speaker))) return null;
    /* Complain about the worst, or praise the best. Complaining is more common,
       because it is more human and because it is what moves votes. */
    const grumble = chance(0.72);
    const { who, rep } = grumble ? Ledger.worstIn(pool) : Ledger.bestIn(pool);
    if (!who || who === speaker) return null;
    if (grumble && rep > 0.38) return null;
    if (!grumble && rep < 0.62) return null;
    const heard = group.filter(c => c !== speaker);
    for (const l of heard) {
      const care = valuesWork(l);
      if (grumble) {
        l.addVW(who.name, CONFIG.campGossipVoteWeight * care, 'talk about who does nothing');
        l.addRel(who.name, -0.008 * care, 'talk about who does nothing');
      } else {
        l.addRel(who.name, 0.008 * care, 'talk about who carries camp');
      }
    }
    const line = CampLines.gossipLine(speaker, who, grumble);
    DBG.log('sim', `Camp gossip: ${speaker.displayName} ${grumble ? 'grumbles about' : 'praises'} ${who.displayName} to ${heard.map(x => x.displayName).join('/')}`);
    return { text: line, kind: grumble ? 'warn' : '' };
  }
};
