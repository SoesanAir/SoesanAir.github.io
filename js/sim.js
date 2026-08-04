/* ============================================================
   CASTAWAY — sim.js
   The simulation engine, ported from the Unity C# systems:
   relationships, social ticks, alliances, lying, vote weights,
   challenges, weather, survival, random events.
   Adapted from real-time/spatial to turn/menu-driven, with the
   same math everywhere it matters.
   ============================================================ */

'use strict';

/* ---------------- Seeded RNG (mulberry32) ---------------- */
let _rngState = 1;
function seedRng(seed) { _rngState = seed >>> 0 || 1; }
function rng() {
  _rngState |= 0; _rngState = (_rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(_rngState ^ (_rngState >>> 15), 1 | _rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function rr(min, max) { return min + rng() * (max - min); }
function ri(min, maxEx) { return Math.floor(rr(min, maxEx)); }
function pick(arr) { return arr[ri(0, arr.length)]; }
function chance(p) { return rng() < p; }
function clamp01(x) { return Math.min(1, Math.max(0, x)); }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = ri(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------------- Castaway model ---------------- */
/* ============================================================
   Challenge aptitude — which FORMATS suit a castaway
   ============================================================
   See the long note on Challenges.aptitudeOf for why this exists. Short version:
   it replaces anonymous dice with a standing, knowable fact about a person.

   Deliberately mean-zero: being good at puzzles costs you somewhere else, so this
   never makes anyone stronger overall, only more specialised. A castaway with a
   flat profile is a generalist — fine everywhere, dominant nowhere — which is its
   own real Survivor archetype. */
const CHAL_CATS = ['Physical', 'Puzzle', 'Dexterity', 'Endurance', 'Strategy', 'Hybrid'];
const Aptitude = {
  roll(c) {
    const span = CONFIG.chalAptitudeSpan;
    const raw = {};
    let sum = 0;
    for (const cat of CHAL_CATS) { raw[cat] = rr(-span, span); sum += raw[cat]; }
    /* Recentre so the profile sums to zero. Without this a castaway can roll high
       everywhere and quietly become the beast we are trying to remove. */
    const mean = sum / CHAL_CATS.length;
    c.aptitude = {};
    for (const cat of CHAL_CATS) c.aptitude[cat] = +(raw[cat] - mean).toFixed(3);
    /* Hybrid rounds draw on a bit of everything, so a specialist should not get a
       full spike there — halve it. */
    c.aptitude.Hybrid *= 0.5;
    return c.aptitude;
  },
  /* The one or two formats this castaway is visibly built for, best first.
     Used by the UI so the player can learn "Yolanda is a puzzle person" rather
     than being told a number. */
  strengths(c, n) {
    if (!c.aptitude) this.roll(c);
    return CHAL_CATS.slice()
      .sort((a, b) => c.aptitude[b] - c.aptitude[a])
      .slice(0, n || 1);
  },
  weakness(c) {
    if (!c.aptitude) this.roll(c);
    return CHAL_CATS.slice().sort((a, b) => c.aptitude[a] - c.aptitude[b])[0];
  }
};

class Castaway {
  constructor(name) {
    this.name = name;
    this.displayName = name;
    this.age = 25;
    this.gender = 'Female';
    this.occupation = '';
    this.cluster = '';
    // stats: social, emotional, relational, gameAwareness, background, physicality, smarts
    this.stats = { social: 0.5, emotional: 0.5, relational: 0.5, gameAwareness: 0.5, background: 0.5, physicality: 0.5, smarts: 0.5 };
    this.isPlayer = false;
    this.tribeName = '';
    this.hunger = 0; this.fatigue = 0; this.morale = 0.7;
    this.relationships = new Map();   // name -> entry
    this.voteWeights = new Map();     // name -> float
    this.memories = [];
    this.interactionBudget = CONFIG.npcInteractionBudget;
    /* What kind of challenge suits you. Stats say how good you are in general;
       this says which FORMAT you are good at, and it is the reason a season
       produces five different immunity winners instead of one.
       Filled by Aptitude.roll() — see the note there. */
    this.aptitude = null;
    this.lastChallengeScore = 0;
    this.playerConvosThisPhase = 0;
    this.eliminated = false;
    // visuals
    this.bodyKey = 'male_muscular';
    this.skinIdx = 2; this.outfitIdx = 0; this.heightTier = 1; // 0 short 1 reg 2 tall
    this.spriteURL = null;
  }
  relEntry(name) { return this.relationships.get(name) || null; }
  getRel(name) { const e = this.relationships.get(name); return e ? e.rel : 0.5; }
  getTrust(name) { const e = this.relationships.get(name); return e ? e.trust : 0.5; }
  /* Mutators log themselves with a running total, the way CastawayData.cs does,
     so every number in the log can be traced to the action that moved it.
     `src` is an optional label for what caused the change. */
  addRel(name, d, src) {
    const e = this.relationships.get(name); if (!e) return;
    e.rel = clamp01(e.rel + d);
    if (d) DBG.rel(this.name, name, 'bond', d, e.rel, src);
  }
  addTrust(name, d, src) {
    const e = this.relationships.get(name); if (!e) return;
    e.trust = clamp01(e.trust + d);
    if (d) DBG.rel(this.name, name, 'trust', d, e.trust, src);
  }
  addSuspicion(name, d, src) {
    const e = this.relationships.get(name); if (!e) return;
    e.suspicion = clamp01(e.suspicion + d);
    if (d) DBG.rel(this.name, name, 'suspicion', d, e.suspicion, src);
  }
  getVW(name) { return this.voteWeights.get(name) || 0; }
  addVW(name, d, src) {
    this.voteWeights.set(name, this.getVW(name) + d);
    if (d) DBG.vw(this.name, name, d, this.voteWeights.get(name), src);
  }
  resetVW() { this.voteWeights.clear(); }
  topVoteTarget(pool) {
    let best = null, bw = -Infinity;
    for (const c of pool) {
      if (c.name === this.name) continue;
      const w = this.getVW(c.name);
      if (w > bw) { bw = w; best = c; }
    }
    return { target: best, weight: bw };
  }
}

function makeRelEntry(rel, trust) {
  return { rel: clamp01(rel), trust: clamp01(trust), highTrustDays: 0, relBaseline: clamp01(rel), isPerformative: false, grudge: 0, suspicion: 0 };
}

/* ---------------- Relationship seeding (SeasonManager port) ---------------- */
function initializeRelationships(cast) {
  for (const a of cast) {
    a.relationships.clear();
    for (const b of cast) {
      if (a === b) continue;
      let rel = rr(CONFIG.relationshipInitMin, CONFIG.relationshipInitMax);
      let trust = rr(CONFIG.relationshipInitMin * 0.8, CONFIG.relationshipInitMax * 0.9);
      if (a.tribeName === b.tribeName) {
        rel += CONFIG.sameTribeBonus;
        trust += CONFIG.sameTribeBonus * 0.7;
      }
      const simil = 1 - Math.abs(a.stats.social - b.stats.social) * 0.5;
      rel += simil * CONFIG.similarityBonus;
      a.relationships.set(b.name, makeRelEntry(rel, trust));
    }
    a.resetVW();
  }
}

function computeDisplayNames(cast) {
  const firstCount = {};
  for (const c of cast) {
    const first = c.name.split(' ')[0];
    firstCount[first] = (firstCount[first] || 0) + 1;
  }
  for (const c of cast) {
    const parts = c.name.split(' ');
    const first = parts[0];
    c.displayName = firstCount[first] > 1 && parts.length > 1
      ? `${first} ${parts[parts.length - 1][0]}.` : first;
  }
}

/* ---------------- BehaviorEngine (conversation deltas + threat) ---------------- */
const HI = 0.65, LO = 0.35;
const Behavior = {
  convRelDelta(a, b) {
    let base = CONFIG.conversationRelBase;
    if (a.stats.emotional < LO && a.stats.social < LO) base *= 0.5;
    if (b.stats.emotional < LO && b.stats.social < LO) base *= 0.5;
    const compat = 1 - Math.abs(a.stats.social - b.stats.social) * 0.5;
    base += compat * 0.01;
    if (a.stats.emotional > HI && a.stats.social > HI) base += 0.01;
    if (b.stats.emotional > HI && b.stats.social > HI) base += 0.01;
    return base;
  },
  convTrustDelta(a, b) {
    let base = CONFIG.conversationTrustBase;
    if (a.stats.relational < LO && a.stats.smarts > HI)
      base += (b.stats.physicality * 0.3 + b.stats.smarts * 0.3) * 0.02;
    if (a.stats.emotional < LO && a.stats.social < LO) base *= 0.5;
    return base;
  },
  isStressed(c) { return c.hunger > 0.8 || c.morale < 0.3 || c.fatigue > 0.85; },
  ruleFires(voter) {
    const p = this.isStressed(voter) ? CONFIG.behaviorRuleStressedProbability : CONFIG.behaviorRuleProbability;
    return chance(p);
  },
  /* Threat modifier used by vote-weight seeding */
  voteModifier(voter, target, merged) {
    // Desperation override: heavy pressure against the voter makes them wild
    let pressureOnVoter = 0;
    for (const [, w] of voter.voteWeights) pressureOnVoter += Math.max(0, w);
    if (voter.getVW(voter.name) > 2 && chance(CONFIG.desperationOverrideChance)) return rr(-1, 2);

    if (!this.ruleFires(voter)) return 0;
    const t = target.stats;
    let threat;
    if (merged) {
      // jury-threat era: social & strategic power dominate
      threat = (t.social * 0.35 + t.gameAwareness * 0.25 + t.smarts * 0.2 + t.physicality * 0.2) * CONFIG.postMergeThreatWeight * 0.35;
    } else {
      // camp era: weakness stands out, big threats tolerated for challenges
      const weakness = (1 - t.physicality) * 0.3 + (1 - t.emotional) * 0.15;
      const scheming = t.gameAwareness > HI ? 0.25 : 0;
      threat = (weakness + scheming) * CONFIG.preMergeThreatWeight * 0.55;
    }
    // perceptiveness scales how much the voter picks up on it
    threat *= 0.5 + voter.stats.gameAwareness * 0.7;
    return threat;
  },
  passiveMoraleBoost(c) { return (c.stats.emotional > HI && c.stats.social > HI) ? 0.005 : 0; }
};

/* ---------------- SocialDynamics (phase + day drift) ---------------- */
const SocialDynamics = {
  onPhaseAdvance(cast) {
    for (const c of cast) {
      // vote weight decay toward 0
      for (const [k, w] of c.voteWeights) {
        if (w > 0) c.voteWeights.set(k, Math.max(0, w - CONFIG.voteWeightDecayRate));
        else if (w < 0) c.voteWeights.set(k, Math.min(0, w + CONFIG.voteWeightDecayRate));
      }
      c.playerConvosThisPhase = 0;
    }
  },
  onDayStart(cast, day) {
    for (const c of cast) {
      for (const [, e] of c.relationships) {
        // trust -> rel drift
        if (e.trust > 0.7) {
          e.highTrustDays++;
          if (e.highTrustDays >= CONFIG.trustToRelDriftMinDays && e.rel < e.relBaseline + CONFIG.trustToRelDriftCap)
            e.rel = clamp01(e.rel + CONFIG.trustToRelDriftRate);
        } else e.highTrustDays = 0;
        e.isPerformative = e.rel > 0.6 && e.trust < 0.3;
        e.grudge = Math.max(0, e.grudge - CONFIG.grudgeDecayRate);
      }
    }
    // performative detection
    for (const obs of cast) {
      if (obs.stats.gameAwareness < 0.6) continue;
      for (const other of cast) {
        if (other === obs) continue;
        const e = other.relEntry(obs.name);
        if (e && e.isPerformative && chance(CONFIG.performativeDetectionChance))
          obs.addTrust(other.name, -CONFIG.performativeDetectionTrustHit, 'spotted performative bonding');
      }
    }
    NpcAlliances.dailyUpdate(cast, day);
    Coalitions.dailyUpdate(cast);
    /* A bloc that keeps huddling gets noticed, and being noticed costs. Applied
       daily so it accumulates into real heat rather than spiking on one meeting. */
    Coalitions.applyVisibility(cast, GAME.merged);
    /* And the NPCs organise too, which is what makes "who is tight out here" a
       real question rather than a flavour line. */
    NpcBlocs.dailyUpdate(cast, GAME.merged);
    Idols.dailyTick();
  },
  applyGrudges(votes, cast) {
    // votes: Map voterName -> targetName
    for (const [voterName, targetName] of votes) {
      const target = cast.find(c => c.name === targetName && !c.eliminated);
      if (!target) continue;
      const e = target.relEntry(voterName);
      if (!e) continue;
      const spike = e.grudge > 0 ? CONFIG.grudgeRepeatSpike : 0;
      e.grudge = clamp01(e.grudge + CONFIG.grudgeWeight * 0.5 + spike);
      target.addVW(voterName, CONFIG.grudgeWeight * e.grudge, 'paying back a vote against them');
    }
  },
  applyHerdCollapsePrevention(pool, immune) {
    // if too many voters share one target, peel some off
    const counts = {};
    for (const v of pool) {
      const { target } = v.topVoteTarget(pool.filter(p => p !== immune));
      if (target) counts[target.name] = (counts[target.name] || 0) + 1;
    }
    for (const [name, n] of Object.entries(counts)) {
      if (n / pool.length > CONFIG.unanimityThreshold) {
        const peelers = pool.filter(v => v.name !== name && chance(0.3));
        for (const p of peelers) {
          const alts = pool.filter(c => c !== p && c.name !== name && c !== immune);
          if (alts.length) p.addVW(pick(alts).name, rr(0.3, 0.9), 'the herd broke and they picked someone else');
        }
      }
    }
  },
  applyLastMinuteScramble(pool) {
    for (const v of pool) {
      if (!chance(CONFIG.lastMinuteScrambleChance)) continue;
      const others = pool.filter(c => c !== v);
      if (others.length) v.addVW(pick(others).name, rr(0, CONFIG.lastMinuteScrambleMagnitude), 'a last-minute scramble');
    }
  },
  applySurvivalParanoia(votes, eliminated, cast) {
    // whoever received votes but survived gets paranoid at those voters
    for (const [voterName, targetName] of votes) {
      if (targetName === eliminated.name) continue;
      const target = cast.find(c => c.name === targetName && !c.eliminated);
      if (target) target.addTrust(voterName, -CONFIG.survivalParanoiaTrustHit);
    }
  }
};

/* ---------------- NPC pairwise alliances ---------------- */
const NpcAlliances = {
  list: [],
  reset() { this.list = []; },
  key(a, b) { return a < b ? a + '|' + b : b + '|' + a; },
  find(a, b) { return this.list.find(x => !x.broken && ((x.a === a && x.b === b) || (x.a === b && x.b === a))); },
  has(a, b) { return !!this.find(a, b); },
  alliesOf(name) {
    return this.list.filter(x => !x.broken && (x.a === name || x.b === name))
      .map(x => x.a === name ? x.b : x.a);
  },
  dailyUpdate(cast, day) {
    const alive = cast.filter(c => !c.eliminated);
    const byName = Object.fromEntries(alive.map(c => [c.name, c]));
    for (const al of this.list) {
      if (al.broken) continue;
      const A = byName[al.a], B = byName[al.b];
      if (!A || !B) { al.broken = true; al.breakReason = 'partner_eliminated'; continue; }
      const mutual = Math.min(A.getTrust(al.b), B.getTrust(al.a));
      if (mutual < CONFIG.alliancePairBreakTrustThreshold) { al.broken = true; al.breakReason = 'trust_dropped'; al.dayBroken = day; }
      else al.daysActive++;
    }
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const A = alive[i], B = alive[j];
        if (A.isPlayer || B.isPlayer || this.has(A.name, B.name)) continue;
        /* Two castaways on different tribes are not in an alliance, however much
           they trust each other — they never see one another. This loop used to
           pair the whole island. */
        if (A.tribeName !== B.tribeName) continue;
        const eA = A.relEntry(B.name), eB = B.relEntry(A.name);
        if (eA && eB && Math.min(eA.highTrustDays, eB.highTrustDays) >= CONFIG.alliancePairFormMinDays) {
          const old = this.list.find(x => this.key(x.a, x.b) === this.key(A.name, B.name));
          if (old) { old.broken = false; old.daysActive = 0; old.dayFormed = day; }
          else this.list.push({ a: A.name, b: B.name, dayFormed: day, daysActive: 0, broken: false, dayBroken: -1, breakReason: '' });
        }
      }
    }
  },
  processTribalOutcome(votes, eliminated, cast) {
    const betrayers = new Set();
    for (const [voterName, targetName] of votes) {
      if (this.has(voterName, targetName)) {
        const al = this.find(voterName, targetName);
        al.broken = true; al.breakReason = 'betrayal';
        betrayers.add(voterName);
      }
    }
    for (const al of this.list) {
      if (!al.broken && (al.a === eliminated.name || al.b === eliminated.name)) {
        al.broken = true; al.breakReason = 'partner_eliminated';
      }
    }
    const hit = CONFIG.allianceBetrayalTrustHit;
    for (const obs of cast) {
      if (obs.eliminated || obs.stats.gameAwareness < 0.5) continue;
      for (const b of betrayers) {
        if (b === obs.name) continue;
        obs.addTrust(b, -hit);
        obs.addSuspicion(b, hit * 0.6);
        obs.addVW(b, hit * 3, 'caught them in a pair');
      }
    }
    return betrayers;
  }
};

/* ---------------- Player alliances ---------------- */
const PlayerAlliances = {
  list: [],   // {name, level: 1 aligned|2 promised|3 locked, dayFormed, broken, promisedTribal}
  reset() { this.list = []; },
  get(name) { return this.list.find(a => a.name === name && !a.broken); },
  level(name) { const a = this.get(name); return a ? a.level : 0; },
  align(name, day) { if (!this.get(name)) this.list.push({ name, level: 1, dayFormed: day, broken: false, promisedTribal: -1 }); },
  promise(name, day) { const a = this.get(name); if (a) { a.level = Math.max(a.level, 2); a.promisedTribal = day + 1; } },
  lock(name) { const a = this.get(name); if (a) a.level = 3; },
  breakPromise(name, cast) {
    const a = this.get(name);
    if (!a) return;
    a.broken = true;
    const npc = cast.find(c => c.name === name);
    if (npc) npc.addTrust(GAME.player.name, -0.15, 'caught in a lie');
  }
};

/* ---------------- Circles: multi-way player alliances ----------------
   One active circle of 3-4 members (player + NPCs). Members protect
   each other in vote seeding and coordinate on a consensus target;
   low mutual trust fractures it, and voting a fellow member breaks it
   with trust/suspicion/grudge fallout. */
/* NOTE ON NAMING: this is "the Pact" everywhere the player can see it. The
   internal name stayed `Coalitions` because renaming a module this many callers
   deep buys nothing a player can perceive and risks a great deal. Same for
   `CircleMeeting` in js/circle.js and the `circleXxx` CONFIG keys. */
const Coalitions = {
  list: [],   // {members:[names incl player], dayFormed, broken, breakReason}
  /* Was 4. A pact can now be as large as a working majority, because on the show
     that is exactly what a dominant alliance is — six or seven people who all
     know the plan. The size is not what limits it; the FRACTURE check is, and it
     gets harder to pass the more people are in the room, which is also true. A
     pact of seven is possible, powerful, and about a week from collapsing. */
  MAX: 8,
  reset() { this.list = []; },
  active(playerName) { return this.list.find(c => !c.broken && c.members.includes(playerName)); },
  form(members, day) {
    this.list.push({
      members: [...members], dayFormed: day, broken: false, breakReason: '',
      plan: null, visibility: 0, meetings: 0, held: [], leaked: null
    });
  },
  addMember(c, name) { if (!c.members.includes(name)) c.members.push(name); },

  /* ---------- what the circle actually IS, in numbers ----------
     Playtest verdict on the old version: "the alliance circle is unclear — how do
     I talk to all of them at once? how does it actually help?" Both fair. The
     circle had real mechanical effects (a vote shield, a coordinated target) and
     showed the player NONE of them, and there was no way to address the group.
     A benefit you cannot see is not a benefit; it is a rumour.

     So the circle now has three legible numbers, all derived from state that
     already existed, and a meeting where you can act on them. */

  /* Blended warmth, the same measure the admission gate and the fracture check
     use, so one idea of "close" runs through the whole feature. */
  warmth(a, b) { return a.getTrust(b.name) * 0.65 + a.getRel(b.name) * 0.35; },

  /* How solid one member is: mostly what they think of you, partly whether they
     can stand the rest of the circle, less whatever pull they feel elsewhere.
     A member who adores you but loathes your other ally is NOT solid, which is
     the thing that actually breaks three-person alliances on the show. */
  loyaltyOf(circle, m, cast) {
    if (!m || m.isPlayer) return 1;
    const P = GAME.player;
    let toYou = P ? this.warmth(m, P) : 0.5;
    const peers = circle.members
      .map(n => cast.find(x => x.name === n))
      .filter(x => x && !x.eliminated && !x.isPlayer && x !== m);
    let toPeers = 0.5;
    if (peers.length) {
      toPeers = peers.reduce((s, p) => s + this.warmth(m, p), 0) / peers.length;
    }
    /* Somebody outside they like more than anyone inside is a defection risk. */
    const outs = cast.filter(x => !x.eliminated && !circle.members.includes(x.name)
      && (GAME.merged || x.tribeName === m.tribeName));
    let bestOut = 0;
    for (const o of outs) bestOut = Math.max(bestOut, this.warmth(m, o));
    const inside = toYou * 0.62 + toPeers * 0.38;
    return clamp01(inside - Math.max(0, bestOut - inside) * 0.45);
  },

  /* How well the circle holds together as a unit, 0..1. */
  cohesion(circle, cast) {
    const npcs = this.npcMembers(circle, cast);
    if (!npcs.length) return 0;
    let s = 0;
    for (const m of npcs) s += this.loyaltyOf(circle, m, cast);
    return clamp01(s / npcs.length);
  },
  label(v) {
    return v > 0.72 ? 'Ironclad' : v > 0.56 ? 'Solid' : v > 0.42 ? 'Holding'
      : v > 0.28 ? 'Fraying' : 'In name only';
  },

  /* ---------- the plan ----------
     A locked plan is the reason to hold a meeting: it converts a passive
     coordination nudge into an actual agreed name, weighted by how firmly the
     room agreed and how loyal each person in it is. A member who nodded along
     while privately unconvinced does not vote with you, which is correct. */
  setPlan(circle, targetName, agreedNames, cast) {
    const npcs = this.npcMembers(circle, cast);
    const firm = npcs.length ? agreedNames.length / npcs.length : 0;
    circle.plan = {
      target: targetName, day: GAME.day, agreed: [...agreedNames], firm,
      resolved: false
    };
    /* Meeting up is not free. Three people who keep disappearing to talk get
       noticed, and being an obvious bloc is how blocs get picked apart. */
    circle.meetings = (circle.meetings || 0) + 1;
    circle.visibility = Math.min(1, (circle.visibility || 0) + CONFIG.circleMeetingVisibility);
    DBG.decision('Pact', 'plan set', {
      target: dnOf(targetName), firm: +firm.toFixed(2),
      agreed: agreedNames.length, of: npcs.length,
      visibility: +circle.visibility.toFixed(2)
    });
    return circle.plan;
  },

  /* Does anybody run to the target with it? Low loyalty is the whole risk. */
  rollLeak(circle, cast) {
    if (!circle.plan || circle.plan.target === undefined) return null;
    const target = cast.find(x => x.name === circle.plan.target);
    if (!target || target.eliminated) return null;
    for (const m of this.npcMembers(circle, cast)) {
      const loy = this.loyaltyOf(circle, m, cast);
      /* Only somebody who is both wobbly AND closer to the target than to you. */
      const pull = this.warmth(m, target);
      const risk = Math.max(0, (CONFIG.circleLeakBelow - loy)) * 2.0 * Math.max(0.2, pull);
      if (chance(clamp01(risk))) {
        target.addVW(GAME.player.name, CONFIG.circleLeakVoteWeight, 'you were coming for them');
        target.addSuspicion(GAME.player.name, 0.12);
        for (const other of circle.members) {
          if (other === m.name || other === target.name) continue;
          target.addVW(other, CONFIG.circleLeakVoteWeight * 0.6, 'they were in on it');
        }
        circle.leaked = { who: m.name, day: GAME.day, to: target.name };
        DBG.decision('Pact', 'LEAK', { who: m.displayName, to: target.displayName, loyalty: +loy.toFixed(2) });
        return { who: m, to: target };
      }
    }
    return null;
  },

  /* An obvious bloc draws fire. Applied daily, so it builds rather than spikes. */
  applyVisibility(cast, merged) {
    for (const c of this.list) {
      if (c.broken || !c.visibility) continue;
      const seen = c.visibility;
      if (seen < CONFIG.circleNoticedAbove) continue;
      const outs = cast.filter(x => !x.eliminated && !c.members.includes(x.name));
      for (const o of outs) {
        if (!merged && !c.members.some(n => {
          const m = cast.find(y => y.name === n);
          return m && m.tribeName === o.tribeName;
        })) continue;
        /* Sharper players spot it sooner. */
        const sees = clamp01((o.stats.gameAwareness - 0.35) * 1.5) * seen;
        if (sees <= 0.05) continue;
        for (const n of c.members) {
          if (n === o.name) continue;
          o.addVW(n, CONFIG.circleVisibleVoteWeight * sees, 'they move as a bloc');
        }
      }
    }
  },

  /* After the votes are read: did the circle hold? This is the feedback that
     makes the whole thing legible — you find out whether the meeting worked. */
  reviewPlan(circle, votesByName, cast) {
    if (!circle || circle.broken || !circle.plan || circle.plan.resolved) return null;
    const plan = circle.plan;
    plan.resolved = true;
    const kept = [], broke = [];
    for (const n of circle.members) {
      const m = cast.find(x => x.name === n);
      if (!m || m.isPlayer) continue;
      const v = votesByName.get(n);
      if (v === undefined) continue;
      (v === plan.target ? kept : broke).push(m);
    }
    /* Voting the plan together tightens the circle; going rogue costs trust with
       everyone who did stick to it. */
    for (const m of kept) {
      for (const n of circle.members) {
        if (n === m.name) continue;
        const o = cast.find(x => x.name === n);
        if (o && !o.isPlayer) o.addTrust(m.name, CONFIG.circleHeldTrust);
      }
    }
    for (const m of broke) {
      for (const n of circle.members) {
        if (n === m.name) continue;
        const o = cast.find(x => x.name === n);
        if (o && !o.isPlayer) { o.addTrust(m.name, -CONFIG.circleBrokeTrust); o.addSuspicion(m.name, 0.08); }
      }
    }
    circle.held.push({ day: GAME.day, target: plan.target, kept: kept.length, broke: broke.length });
    return { kept, broke, target: plan.target };
  },
  npcMembers(c, cast) {
    return c.members.map(n => cast.find(x => x.name === n)).filter(x => x && !x.eliminated && !x.isPlayer);
  },
  dailyUpdate(cast) {
    for (const c of this.list) {
      if (c.broken) continue;
      c.members = c.members.filter(n => {
        const m = cast.find(x => x.name === n);
        return m && !m.eliminated;
      });
      if (c.members.length < 3) { c.broken = true; c.breakReason = 'too_few'; continue; }
      const npcs = this.npcMembers(c, cast);
      /* Blended warmth, matching the admission gate. Raw trust alone sits below
         any sensible bar on day one, which used to fracture every circle
         immediately. */
      const warmth = (a, b) => a.getTrust(b.name) * 0.65 + a.getRel(b.name) * 0.35;
      /* The bar RELAXES as the pact grows. A four-person pact where everyone must
         like everyone is a reasonable ask; demanding the same of seven people is
         demanding something that has never happened on the show — big alliances
         are held together by shared interest, not by affection, and they contain
         people who cannot stand each other. So a large pact tolerates a colder
         pair, and pays for it in the strain counter below: it survives, but it is
         always one bad day from going. */
      const relax = Math.max(0, npcs.length - 2) * CONFIG.circleSizeTolerance;
      const bar = Math.max(0.10, CONFIG.circleFractureBelow - relax);
      let coldPair = null;
      outer: for (let i = 0; i < npcs.length; i++) {
        for (let j = i + 1; j < npcs.length; j++) {
          if (Math.min(warmth(npcs[i], npcs[j]), warmth(npcs[j], npcs[i])) < bar) {
            coldPair = [npcs[i], npcs[j]];
            break outer;
          }
        }
      }
      /* One cold night is strain, not a break. Two in a row ends it. */
      if (coldPair) {
        c.strain = (c.strain || 0) + 1;
        if (c.strain >= 2) {
          c.broken = true;
          c.breakReason = 'trust_fracture';
          c.brokeOver = [coldPair[0].displayName, coldPair[1].displayName];
        }
      } else if (c.strain) {
        c.strain = 0;
        c.easedOver = true;
      }
    }
  },
  seedEffects(cast, merged) {
    for (const c of this.list) {
      if (c.broken) continue;
      const npcs = this.npcMembers(c, cast);
      // members shield each other
      for (const m of npcs) for (const other of c.members) if (other !== m.name) m.addVW(other, -0.5, 'in their pact');
      // coordination toward the group's consensus target outside the circle
      const outsiders = cast.filter(x => !x.eliminated && !c.members.includes(x.name));
      let best = null, bw = -Infinity;
      for (const t of outsiders) {
        if (!merged && npcs[0] && t.tribeName !== npcs[0].tribeName) continue;
        let w = 0;
        for (const m of npcs) w += m.getVW(t.name);
        if (w > bw) { bw = w; best = t; }
      }
      if (best && bw > 0) for (const m of npcs) m.addVW(best.name, 0.5, 'their pact agreed a name');

      /* An AGREED plan from a meeting is much stronger than the passive drift
         above, and it is weighted per member: somebody who nodded along while
         privately unconvinced does not carry it into the booth. This is the
         mechanical payoff for holding a meeting, and the reason the circle is
         now worth having rather than merely worth being told about. */
      const plan = c.plan;
      if (plan && !plan.resolved && plan.day >= GAME.day - CONFIG.circlePlanStaleDays) {
        const t = cast.find(x => x.name === plan.target);
        /* A SPLIT plan sends half the pact at a second name. On the show this is
           what a majority does when it suspects an idol: three votes on the target
           and three on their closest ally, so an idol played on either one still
           sends the other home. Each member is pushed at the name they were
           actually assigned, which is why a split needs a real majority to work —
           get the arithmetic wrong and you hand the game away. */
        const second = plan.split ? cast.find(x => x.name === plan.split) : null;
        for (const m of npcs) {
          if (!plan.agreed.includes(m.name)) continue;
          const loy = this.loyaltyOf(c, m, cast);
          const push = CONFIG.circlePlanVoteWeight * plan.firm * clamp01(loy + 0.25);
          const onSecond = second && plan.assignB && plan.assignB.indexOf(m.name) >= 0;
          const aim = onSecond ? second : t;
          if (aim && !aim.eliminated) {
            m.addVW(aim.name, push, onSecond ? 'their pact split the vote' : 'the pact agreed this name');
          }
        }
      }
    }
  },
  processTribalOutcome(votesByName, cast) {
    for (const c of this.list) {
      if (c.broken) continue;
      for (const [voter, target] of votesByName) {
        if (c.members.includes(voter) && c.members.includes(target)) {
          c.broken = true; c.breakReason = 'betrayal';
          for (const n of c.members) {
            if (n === voter) continue;
            const m = cast.find(x => x.name === n);
            if (!m || m.isPlayer) continue;
            m.addTrust(voter, -0.15);
            m.addSuspicion(voter, 0.10);
            m.addVW(voter, 0.5, 'they broke the pact');
          }
        }
      }
    }
  }
};

/* ---------------- Player secrets ledger (PlayerSecrets port) ----------------
   Records the player's strategic acts so "Share a secret" has real currency.
   knownBy tracks which NPCs already heard each one. */
const PlayerSecrets = {
  list: [],   // {type: 'PushedVote'|'PlantedSeed'|'SpreadRumor'|'Alliance', subject, day, knownBy: []}
  reset() { this.list = []; },
  add(type, subject, day) {
    if (!this.list.find(s => s.type === type && s.subject === subject)) {
      this.list.push({ type, subject, day, knownBy: [] });
    }
  },
  unknownTo(name) { return this.list.filter(s => !s.knownBy.includes(name) && s.subject !== name); },
  markKnown(secret, name) { if (!secret.knownBy.includes(name)) secret.knownBy.push(name); }
};

/* ---------------- Lying system (belief + consequences) ---------------- */
const Lying = {
  memory: new Map(),   // listenerName -> [{speaker, type, target, truth, outcome}]
  declared: new Map(), // "speaker|listener" -> declared vote target
  reset() { this.memory.clear(); this.declared.clear(); },
  record(listener, rec) {
    const arr = this.memory.get(listener) || [];
    arr.push(rec);
    while (arr.length > 24) arr.shift();
    this.memory.set(listener, arr);
  },
  flags(listener, speaker) {
    const arr = this.memory.get(listener) || [];
    let lies = 0, recent = 0;
    arr.forEach((r, i) => {
      if (r.speaker !== speaker) return;
      if (r.outcome === 'Caught') { lies++; if (i >= arr.length - 5) recent++; }
    });
    return { lies, recent };
  },
  beliefScore(listener, speaker, truth) {
    const e = listener.relEntry(speaker.name);
    const trust = e ? e.trust : 0.3, rel = e ? e.rel : 0.3, sus = e ? e.suspicion : 0;
    let allianceBonus = 0;
    if (speaker.isPlayer) {
      const lvl = PlayerAlliances.level(listener.name);
      allianceBonus = lvl === 3 ? 0.18 : lvl === 2 ? 0.12 : lvl === 1 ? 0.08 : 0;
    }
    let bias = 0;
    if (truth !== 'Truth') bias -= Math.max(0, listener.stats.gameAwareness - 0.5) * 0.30;
    if (listener.stats.emotional > 0.55) bias += (listener.stats.emotional - 0.55) * 0.30;
    if (listener.cluster === 'Paranoid Schemer' || listener.cluster === 'Bitter Veteran') bias -= 0.08;
    if (listener.cluster === 'Loyal Soldier' || listener.cluster === 'Loyal Follower') bias += 0.05;
    if (listener.cluster === 'Villain Arc' && truth === 'Lie') bias -= 0.05;
    const f = this.flags(listener, speaker.name);
    const raw = 0.5 + trust * 0.35 + rel * 0.15 + allianceBonus - sus * 0.50 + bias
      - (f.lies * 0.15 + f.recent * 0.08) + rr(-0.05, 0.05);
    return clamp01(raw);
  },
  outcomeOf(score) { return score > 0.6 ? 'Believed' : score >= 0.3 ? 'Doubted' : 'Caught'; },
  effectDeltas(truth, outcome) {
    const T = {
      Truth:   { Believed: [0.04, 0.02, -0.02], Doubted: [0.01, 0, 0], Caught: [0, 0, 0.05] },
      Partial: { Believed: [0.01, 0, 0], Doubted: [-0.02, 0, 0.02], Caught: [-0.04, -0.01, 0.05] },
      Lie:     { Believed: [0.02, 0, 0.01], Doubted: [-0.04, 0, 0.05], Caught: [-0.08, -0.02, 0.15] }
    };
    return T[truth][outcome]; // [trustD, relD, susD]
  },
  evaluate(listener, speaker, truth, type, target) {
    const score = this.beliefScore(listener, speaker, truth);
    let outcome = this.outcomeOf(score);
    /* AN HONEST ANSWER IS NEVER A CAUGHT LIE.

       outcomeOf works purely off a belief score, so a player telling the truth to
       a suspicious, low-trust castaway came back 'Caught' — and every caller then
       applied caught-lie penalties and recorded a lie against them. That is the
       reported problem: "make sure the player always has the option to deny
       something, and if indeed they didn't do it, it's the truth."

       So a truth can be DOUBTED — they may well not believe you, and that costs
       you the conversation — but it can never be branded a lie, and it is never
       recorded as one. Which also means the retro-validation at tribal cannot
       later "confirm" a lie that never happened. */
    if (truth === 'Truth' && outcome === 'Caught') {
      outcome = 'Doubted';
      /* Remember that they wronged an honest person. Nothing reads this yet, but
         it is the hook for vindication later and it costs nothing to record. */
      if (!listener.wronged) listener.wronged = [];
      listener.wronged.push({ who: speaker.name, day: GAME.day, type });
    }
    const [tD, rD, sD] = this.effectDeltas(truth, outcome);
    listener.addTrust(speaker.name, tD, 'npc conversation');
    listener.addRel(speaker.name, rD, 'npc conversation');
    listener.addSuspicion(speaker.name, sD);
    this.record(listener.name, { speaker: speaker.name, type, target, truth, outcome });
    if (type === 'VoteIntent' && target && target !== '(none)') {
      this.declared.set(speaker.name + '|' + listener.name, { target, truth });
    }
    return outcome;
  },
  /* Post-vote retro-validation of declared intents (player and NPC).
     A sincere claim later abandoned reads as drift; a knowing lie
     that gets exposed is punished hard (Unity retro table). */
  onVoteCast(voter, actualTarget, cast) {
    for (const [key, decl] of this.declared) {
      const [speaker, listenerName] = key.split('|');
      if (speaker !== voter.name) continue;
      const rec = typeof decl === 'string' ? { target: decl, truth: 'Truth' } : decl;
      const listener = cast.find(c => c.name === listenerName && !c.eliminated);
      if (!listener) continue;
      if (rec.target === actualTarget) {
        if (rec.truth === 'Truth') {
          listener.addTrust(voter.name, 0.02);
          listener.addSuspicion(voter.name, -0.02);
        } else {
          // lied but the vote matched anyway — reads straight-shooter
          listener.addTrust(voter.name, 0.01);
        }
      } else if (rec.truth === 'Truth') {
        // meant it when they said it — drift, not exposure
        listener.addTrust(voter.name, -0.02);
        listener.addSuspicion(voter.name, 0.03);
      } else {
        const aligned = voter.isPlayer && PlayerAlliances.level(listenerName) >= 1 ? 0.5 : 0;
        const certainty = clamp01(listener.stats.gameAwareness * 0.4 + listener.getTrust(voter.name) * 0.2 + aligned * 0.2 + 0.3 * 0.2 - rr(0, 0.05));
        const harsh = rec.truth === 'Lie';
        if (certainty > 0.7) {
          listener.addTrust(voter.name, harsh ? -0.08 : -0.05);
          listener.addSuspicion(voter.name, harsh ? 0.15 : 0.09);
          listener.addVW(voter.name, 0.5, 'caught lying about their vote');
        } else if (certainty > 0.4) {
          listener.addTrust(voter.name, -0.02);
          listener.addSuspicion(voter.name, 0.04);
        }
      }
      this.declared.delete(key);
    }
  }
};

/* ---------------- Weather ---------------- */
const Weather = {
  today: 'Sunny',
  roll() {
    const r = rng();
    let acc = CONFIG.weatherSunnyChance;
    if (r < acc) this.today = 'Sunny';
    else if (r < (acc += CONFIG.weatherRainyChance)) this.today = 'Rainy';
    else if (r < (acc += CONFIG.weatherStormyChance)) this.today = 'Stormy';
    else this.today = 'Hot';
    return this.today;
  },
  /* A storm no longer deletes the immunity challenge.

     It used to cancel it outright, and with a 12% storm chance across a dozen
     challenge days that is more than one cancelled challenge a season — plus any
     reward scheduled the same day, so a single storm could wipe the entire day's
     content. Reported as "too many challenges are cancelled due to weather", and
     the reason it grated is that it is not what the show does: they run challenges
     in torrential rain constantly. Weather is atmosphere out there, not a
     postponement.

     So immunity always happens. A storm makes it WILDER instead — see
     Weather.challengeChaos, applied in Challenges.score — which is both more
     faithful and, unlike a cancellation, something the player can watch.

     Rewards are still cancellable, because a reward is a day out and the show
     genuinely does move those. `skipsReward` is the honest name for what this
     always was. */
  skipsReward() { return this.today === 'Stormy' && chance(CONFIG.weatherRewardSkipChance); },
  /* Kept so nothing that still calls it breaks; it is now always false. */
  skipsChallenge() { return false; },
  /* What bad weather does to a challenge.

     The first attempt here subtracted a flat penalty from everyone's score, which
     reads well in a comment and does precisely nothing: an equal penalty applied to
     the whole field cannot change who wins, and both the individual and the tribal
     paths compare scores against each other. It was a no-op with a nice name.

     What bad weather actually does out there is make everything sloppier. Grips
     slip, planks warp, nobody can see, and the result is more upset than usual —
     a storm is a LEVELLER. So it widens everybody's form band instead: the same
     castaways, a wilder day, and a better chance the favourite comes unstuck.
     That is a thing the player can watch happen, which the penalty never was. */
  challengeChaos() {
    return this.today === 'Stormy' ? CONFIG.weatherStormChalChaos
      : this.today === 'Rainy' ? CONFIG.weatherRainChalChaos
        : this.today === 'Hot' ? CONFIG.weatherHotChalChaos : 0;
  },
  hungerMult() { return this.today === 'Stormy' ? CONFIG.weatherStormyHungerMult : this.today === 'Hot' ? CONFIG.weatherHotHungerMult : 1; },
  icon() { return { Sunny: 'Sun', Rainy: 'Rain', Stormy: 'Storm', Hot: 'Heat' }[this.today]; }
};

/* ---------------- Daily survival tick + sleep ---------------- */
/* How much a condition (hunger, fatigue) actually costs, 0..1.

   Zero across the normal band, then quadratic. The quadratic matters: a linear
   ramp from the pain-free point would still make every mildly-hungry castaway
   slightly worse at everything, and "slightly worse at everything, all season,
   for all eighteen people" is exactly the invisible tax this replaced. Squaring
   it keeps the whole middle of the range genuinely free and puts the entire cost
   in the last stretch, where a person visibly falling apart belongs. */
function condBite(v, painFree) {
  const free = painFree === undefined ? 0.6 : painFree;
  const x = Math.max(0, ((v || 0) - free) / Math.max(0.05, 1 - free));
  return x * x;
}

/* Move toward a resting level at a capped daily speed.

   This replaced a climb-minus-relief sum, which turned out to be the wrong shape
   entirely. With a smaller daily climb the constant food relief simply
   overwhelmed it and the whole cast sat at zero hunger — measured, in
   tools/condition-test.js: 0.00 mean hunger on day 24, i.e. nobody on a survival
   show was hungry. Two opposing constants are always going to be that brittle,
   because the balance depends on their difference rather than on either value.

   A target is not brittle in that way. The food store decides WHERE hunger
   settles rather than how fast it falls, so a well-stocked camp means "hungry but
   coping" and an empty one means "genuinely starving", and neither can accidentally
   mean "fine". Coming down is faster than going up, because a full basket does
   fix things quickly and weeks of short rations do not. */
function driftToward(current, target, step, downMult) {
  const now = current || 0;
  const gap = target - now;
  const cap = gap >= 0 ? step : step * (downMult === undefined ? 1.6 : downMult);
  return now + Math.max(-cap, Math.min(cap, gap * 0.55));
}

function dailySurvivalTick(cast) {
  CampNeeds.ensure();
  /* Being short of water is thirst, and thirst reads as hunger here.

     And the tribe EATS. The food store's daily drain in CampNeeds.decay is nine
     people eating; this is the other half of that transaction. Without it only
     the player ever ate anything and every NPC starved to a medivac by the back
     half of the season no matter how well the camp was run. */
  const dry = CampNeeds.severity('water');
  const fed = CampNeeds.get('food');
  /* Only ONE camp is modelled — the player's. Pre-merge the other tribe is off
     running its own beach we never see, so it gets a neutral baseline instead of
     inheriting our woodpile and our empty basket. */
  const here = new Set(campPool().map(c => c.name));
  for (const c of cast) {
    if (c.eliminated) continue;
    const mine = here.has(c.name);
    /* Where this castaway's hunger is HEADED: the island baseline, worse when the
       water is short, better the better stocked the basket is. Never zero — a
       full store out here is rice and a fish, not a buffet. */
    const fedShare = Math.min(1, (mine ? fed : 0.5) / CONFIG.foodStoreFull);
    const hTarget = clamp01(CONFIG.hungerPlateau
      + (mine ? dry : 0.25) * CONFIG.thirstHungerPush
      - fedShare * CONFIG.hungerFedRelief);
    c.hunger = clamp01(driftToward(c.hunger, hTarget, CONFIG.hungerPerDay * Weather.hungerMult()));
    /* Fatigue drifts toward its own resting level; the counterforce is
       applySleepRecovery, and where the two meet is how tired the tribe is. */
    c.fatigue = clamp01(driftToward(c.fatigue, CONFIG.fatiguePlateau, CONFIG.fatiguePerDay));
    if (Weather.today === 'Rainy') c.morale = clamp01(c.morale + CONFIG.weatherRainyMoralePenalty);
  }
}

/* How well the camp lets you sleep, 0..1. Shelter first, then a fire to dry out
   next to, then not sleeping in a tip. */
function campComfort() {
  return clamp01(CampNeeds.get('shelter') * 0.52
    + (GAME.campFire === undefined ? 0.4 : GAME.campFire) * 0.30
    + CampNeeds.get('clean') * 0.18);
}

function applySleepRecovery(cast, early) {
  let rec = early ? CONFIG.earlySleepFatigueRecovery : CONFIG.normalSleepFatigueRecovery;
  /* A leaking roof and a dead fire is a worse night's sleep than a tight camp.
     This is the main channel through which neglect actually costs you: it wears
     the tribe down rather than killing anybody. */
  const comfort = campComfort();
  rec *= CONFIG.campSleepComfortFloor + (1 - CONFIG.campSleepComfortFloor) * comfort;
  if (GAME.badSleep) rec *= 0.5;
  if (GAME.goodSleep) rec *= 1.25;
  DBG.log('sim', `Sleep: comfort ${comfort.toFixed(2)} -> recovery ${rec.toFixed(3)}`
    + (GAME.badSleep ? ' (bad night)' : GAME.goodSleep ? ' (good night)' : ''));
  GAME.badSleep = false; GAME.goodSleep = false;
  for (const c of cast) if (!c.eliminated) c.fatigue = clamp01(c.fatigue - rec);
}

/* ---------------- Evacuations and quits ----------------
   Calibrated against the real show rather than guessed at.

   US Survivor, seasons 1-50: TWENTY-ONE medical evacuations across 14 seasons.

     evacuations in a season   seasons   share
     0                         36        72%
     1                          8        16%
     2                          5        10%
     3                          1         2%     (Kaoh Rong, the worst on record)

   Mean 0.42 a season, and a season with two is a one-in-ten event.

   The old model rolled independent per-castaway, per-day dice — 3% a day for
   anybody past hunger 0.8. That reads reasonable and is not: six castaways in
   poor shape for ten days compounds to an ~84% chance of at least one, and a
   rough camp could produce three or four. Worse, the season-level rate was an
   emergent side effect of numbers nobody could reason about.

   So the SEASON is the unit now. Roll how many evacuations this season gets from
   the real distribution, schedule them, and let conditions decide who and
   exactly when. The headline probability is a parameter you can read off CONFIG
   instead of something you have to simulate to discover.

   Two details taken from the real list rather than invented:

   TIMING is bimodal. Six of the twenty-one happened in the first three days —
   almost all at the opening challenge (Kourtney Moon's wrist, Pat Cusack's back,
   Bruce Perreault's head, Randen Montalvo's spine). The rest need time: an
   infection has to fester and a body has to run down first.

   CAUSE splits about 43/57. Nine were pure accidents that no amount of camp care
   would have prevented — Skupin falling in the fire, a snake bite, a ruptured
   Achilles. The other twelve were infections (six) or the body giving out from
   hunger, heat and dehydration (six), and those ARE camp-linked. So a well-run
   camp genuinely protects your tribe from more than half of it, and no camp
   however well run protects them from all of it. */
const EVAC_SEASON_ODDS = [0.72, 0.16, 0.10, 0.02];   // P(0), P(1), P(2), P(3)
/* Quits are rarer and morale-driven: Osten, Janu, Kathy, NaOnka and Purple Kelly
   in one season, Lindsey, Julie. Roughly one season in seven sees one. */
const QUIT_SEASON_ODDS = [0.85, 0.13, 0.02];

const EVAC_CAUSE = {
  challenge: 'hurt at the challenge',
  accident: 'an accident out here',
  infection: 'an infection that would not stop',
  starved: 'a body running on nothing',
  exhausted: 'sheer exhaustion'
};

const Exits = {
  /* Draw from a distribution given as P(0), P(1), P(2)... */
  rollCount(odds) {
    const r = rng();
    let acc = 0;
    for (let n = 0; n < odds.length; n++) { acc += odds[n]; if (r < acc) return n; }
    return 0;
  },

  /* Rolled once at season start, so the season's shape is decided up front and
     the rate cannot run away mid-game. */
  reset() {
    const last = CONFIG.totalDays;
    const evac = [];
    const n = this.rollCount(EVAC_SEASON_ODDS);
    for (let i = 0; i < n; i++) {
      if (chance(CONFIG.evacEarlyShare)) {
        /* The opening challenge, where a third of them really happen. */
        evac.push({ day: ri(1, 4), kind: 'accident' });
      } else {
        evac.push({
          day: ri(5, Math.max(6, last - 1)),
          kind: chance(CONFIG.evacConditionShare) ? 'condition' : 'accident'
        });
      }
    }
    const quit = [];
    const qn = this.rollCount(QUIT_SEASON_ODDS);
    for (let i = 0; i < qn; i++) quit.push({ day: ri(4, Math.max(5, last - 2)) });
    GAME.exits = { evac, quit };
    DBG.log('system', `Season exits rolled: ${n} evacuation(s)`
      + (n ? ' ' + evac.map(e => `d${e.day}/${e.kind}`).join(' ') : '')
      + `, ${qn} quit(s)` + (qn ? ' ' + quit.map(q => 'd' + q.day).join(' ') : ''));
  },

  /* Who an accident happens to. Nobody is safe from these — that is the point of
     them — but they lean toward whoever is least equipped for a physical
     challenge, since that is where most of the real ones occurred. */
  accidentVictim(pool) {
    let best = null, bw = -1;
    for (const c of pool) {
      const w = (1.4 - c.stats.physicality) * rr(0.5, 1.5);
      if (w > bw) { bw = w; best = c; }
    }
    return best;
  },

  /* Who an infection or a collapse happens to — and whether there is anybody it
     could plausibly happen to at all. This is where camp work pays off: keep
     people fed, rested and out of a filthy camp and these simply do not fire. */
  conditionVictim(pool) {
    const dirt = 1 - CampNeeds.get('clean');
    let worst = null, ws = -1;
    for (const c of pool) {
      /* Measured as distance PAST the normal island condition, not absolutely.
         Everyone out there is hungry and tired; a medical evacuation is for
         somebody who has gone well beyond that, and the same condBite curve that
         governs the challenge penalty governs who is in genuine trouble.

         With absolute hunger and fatigue this stopped discriminating the moment
         the plateau model landed: the WORST castaway in a well-kept camp still sat
         around 0.8 hunger, comfortably over the old bar, so a spotless camp and a
         rotten one lost exactly the same number of people — measured identical at
         0.386 per season in tools/evac-test.js. Keeping camp has to be worth
         something, and this is the channel it is worth it through. */
      const s = condBite(c.hunger, CONFIG.hungerPainFree) * 0.45
        + condBite(c.fatigue, CONFIG.fatiguePainFree) * 0.35
        + dirt * 0.20;
      if (s > ws) { ws = s; worst = c; }
    }
    if (!worst || ws < CONFIG.evacConditionBar) return null;
    const cause = (dirt > 0.55 && chance(0.5)) ? EVAC_CAUSE.infection
      : worst.hunger > worst.fatigue ? EVAC_CAUSE.starved : EVAC_CAUSE.exhausted;
    return { who: worst, cause };
  },

  check(cast) {
    if (!GAME.exits) this.reset();
    /* The player is never pulled. Losing a run to a dice roll they could not see
       or affect is not a game, it is a punishment. */
    const pool = cast.filter(c => !c.eliminated && !c.isPlayer);
    if (!pool.length) return null;
    const day = GAME.day, ex = GAME.exits;

    for (const e of ex.evac) {
      if (e.day > day) continue;
      if (e.kind === 'accident') {
        const who = this.accidentVictim(pool);
        if (!who) continue;
        ex.evac.splice(ex.evac.indexOf(e), 1);
        return { type: 'Medivac', who, cause: day <= 3 ? EVAC_CAUSE.challenge : EVAC_CAUSE.accident };
      }
      const hit = this.conditionVictim(pool);
      if (!hit) {
        /* Nobody is in bad enough shape for this one. It waits — and if the camp
           stays in decent order it runs out of season and never happens at all. */
        e.day = day + 1;
        continue;
      }
      ex.evac.splice(ex.evac.indexOf(e), 1);
      return { type: 'Medivac', who: hit.who, cause: hit.cause };
    }

    for (const q of ex.quit) {
      if (q.day > day) continue;
      let worst = null;
      for (const c of pool) if (!worst || c.morale < worst.morale) worst = c;
      if (!worst || worst.morale > CONFIG.quitMoraleBar) { q.day = day + 1; continue; }
      ex.quit.splice(ex.quit.indexOf(q), 1);
      return { type: 'Quit', who: worst, cause: 'they had had enough' };
    }
    return null;
  }
};

function checkDailyEvent(cast) { return Exits.check(cast); }

/* ---------------- Challenges ---------------- */
const Challenges = {
  usedIdx: new Set(),
  puzzlesUsed: 0,
  reset() { this.usedIdx.clear(); this.puzzlesUsed = 0; },
  pickChallenge() {
    /* Fire is the final-four rite. It must never turn up in week one — which it
       was doing, because nothing gated it. */
      const n = alive().length;
    let avail = CHALLENGES.map((c, i) => ({ c, i }))
      .filter(x => !this.usedIdx.has(x.i))
      .filter(x => !x.c.finalFourOnly)
      /* Some formats are reward events and nothing else — the auction above all.
         Nobody's torch has ever been snuffed over a covered dish. */
      .filter(x => !x.c.rewardOnly)
      .filter(x => !(x.c.lateGameOnly && n > 6))
      .filter(x => !(x.c.cat === 'Puzzle' && this.puzzlesUsed >= CONFIG.challengePuzzleMaxPerSeason));
    if (!avail.length) { this.usedIdx.clear(); return this.pickChallenge(); }
    const total = avail.reduce((s, x) => s + (CHALLENGE_CAT_WEIGHTS[x.c.cat] || 1), 0);
    let roll = rr(0, total);
    for (const x of avail) {
      roll -= (CHALLENGE_CAT_WEIGHTS[x.c.cat] || 1);
      if (roll <= 0) {
        this.usedIdx.add(x.i);
        if (x.c.cat === 'Puzzle') this.puzzlesUsed++;
        return x.c;
      }
    }
    const last = avail[avail.length - 1];
    this.usedIdx.add(last.i);
    return last.c;
  },
  /* ---- pre-scoring, so the challenge can be WATCHED ----
     The tribe rails down the sides of the arena show who is carrying the
     challenge and who is dead weight. For that to mean anything the NPC results
     have to exist while the player is still playing, not be rolled afterwards —
     otherwise the rails are decorative noise and the thing you watched has no
     relationship to the result you get.

     So: every NPC's form is rolled ONCE, up front, and cached. score() hands the
     cached number back for the rest of the challenge instead of re-rolling, which
     it would otherwise do (there is an rr() in there) and produce a different
     answer every call. The player is deliberately NOT pre-scored — their number
     depends on a minigame that has not happened yet. */
  _pre: null,
  prescore(chal, pool) {
    this._pre = { chal: chal.name, day: GAME.day, names: new Set() };
    for (const c of pool) {
      if (c.isPlayer) continue;
      this.score(c, chal);
      this._pre.names.add(c.name);
    }
    return this._pre;
  },
  clearPrescore() { this._pre = null; },
  /* What the player's score WOULD be at this minigame performance. Lets their
     own rail chip climb live as they play, off the same formula that will settle
     it at the end — so the rail never lies to them. */
  projectPlayer(chal, perf) {
    const p = GAME.player;
    if (!p) return 0;
    /* score() writes lastChallengeScore, which is exactly what the rail reads, so
       the projection is allowed to land there. It is not authoritative: the real
       call after the minigame finishes overwrites it with the settled number.
       GAME.playerPerf IS restored, because that one is read by the rest of the
       turn and a half-finished minigame must not leak into it. */
    const was = GAME.playerPerf;
    GAME.playerPerf = clamp01(perf);
    const s = this.score(p, chal);
    GAME.playerPerf = was;
    return s;
  },

  /* ---------- what kind of challenge suits you ----------
     Measured problem this solves. Challenge results used to be raw stats plus a
     form roll of +/-0.51, which is about two and a half times the entire spread of
     the field's stats. Different people won each week, but only because the dice
     said so — nothing about a castaway told you they were going to win the puzzle,
     and no result was ever explicable after the fact.

     The show does not work that way. Different people win because the FORMATS
     differ: the swimmer takes the water round, the puzzle-solver takes the maze,
     and the endurance specialist is still standing at hour four. Ozzy loses the
     puzzle every single time and nobody finds that random.

     So each castaway gets a small fixed bias per challenge category, mean zero, so
     nobody is better overall — only better at some things and worse at others. It
     buys the variety the dice used to buy, but this kind is legible: it is the same
     person who is good at puzzles every week. */
  aptitudeOf(c, cat) {
    if (!c.aptitude) Aptitude.roll(c);
    return c.aptitude[cat] || 0;
  },
  /* Extra form swing for everyone because of the weather — see Weather.challengeChaos.
     Guarded because the harnesses score castaways outside a running season. */
  weatherChaos() {
    return (typeof Weather !== 'undefined' && Weather.challengeChaos)
      ? Weather.challengeChaos() : 0;
  },
  score(c, chal) {
    /* Already rolled this challenge — hand back the same answer. */
    if (this._pre && this._pre.chal === chal.name && this._pre.day === GAME.day
      && !c.isPlayer && this._pre.names.has(c.name)) {
      return c.lastChallengeScore;
    }
    let s = 0;
    STAT_KEYS.forEach((k, i) => s += c.stats[k] * chal.w[i]);
    /* A fire challenge is mostly about whether you can actually make fire — the
       hidden skill everyone starts with at a different level and improves by
       doing it. This is where a season of tending the fire pays off. */
    if (chal.fire && c.fireSkill !== undefined) {
      s = s * (1 - CONFIG.fireChallengeWeight) + c.fireSkill * CONFIG.fireChallengeWeight * 1.6;
    }
    /* Being wrecked shows — but only once you are genuinely wrecked.
       Everybody out there is hungry and tired, so the ordinary version of that
       costs nothing; what costs is being the one person who is actually failing.
       See condBite() and the hunger/fatigue block in data.js. */
    s -= condBite(c.hunger, CONFIG.hungerPainFree) * CONFIG.hungerChallengePenalty;
    s -= condBite(c.fatigue, CONFIG.fatiguePainFree) * CONFIG.fatigueChallengePenalty;
    /* And so does your head. This is the counter-force to "never work, stay
       fresh, win everything": shirking turns the tribe cold on you, that sinks
       morale, and morale is worth about as much out there as the rest you saved. */
    s += ((c.morale === undefined ? 0.6 : c.morale) - 0.55) * CONFIG.moraleChallengeBonus;
    /* Does this FORMAT suit you. Mean-zero across the categories, so it decides who
       wins today without deciding who is better. */
    s += this.aptitudeOf(c, chal.cat);
    /* The player actually PLAYED the challenge, so their roll is replaced by how
       they did. Stats still set the band (they are already summed above); the
       minigame moves them within it. A weak castaway who plays well can beat a
       strong one who fumbles, but not by a landslide. */
    if (c.isPlayer && GAME.playerPerf !== null && GAME.playerPerf !== undefined) {
      /* The player's performance has to land in the SAME band the NPCs draw their
         form from, centred on the same mean — otherwise it is not a contest.

         It used to be `(perf - 0.5) * 0.75 + 0.375`, so the player's bonus averaged
         +0.375 against an NPC average of +0.10, nearly four times as much. Measured
         consequence: a flawless minigame won 100% of individual immunities at
         average stats, 99% at WEAK stats, and field size made no difference at all
         because the bonus swamped everybody.

         Now: same centre as an NPC (half the random weight), and playing well moves
         you within a band comparable to their form. A flawless round is a very good
         day, not a different sport — so the best of eight on their own good day can
         still beat you, which is the whole point of a challenge. */
      s += CONFIG.immunityRandomWeight * 0.5
        + (GAME.playerPerf - 0.5) * 2 * CONFIG.challengeSkillSpan;
      /* And the player gets a day like everybody else.

         This used to be missing, and it was the single worst thing about the
         challenge maths. Every NPC drew a form roll; the player's score was exactly
         determined by their tapping. So the player was a stationary target trying to
         clear the maximum of ten dice — which made the win curve a cliff rather
         than a slope. Measured: at skillSpan 0.40 a flawless run won 31%, at 0.50 it
         won 61%, and in between there was nothing. Playing WELL but not perfectly
         (perf 0.75) won 3-5% at every setting, so there was no reward for improving
         until you were perfect.

         Giving the player the same form band as an NPC smears that step into a
         gradient: a good run usually beats a mediocre one, and occasionally the
         island has other ideas. */
      const pSwing = CONFIG.playerFormSwing + Challenges.weatherChaos();
      s += rr(-pSwing, pSwing);
    } else {
      /* Form on the day. The able are steadier; the weak swing wildly — so a
         strong castaway can still have a shocker and a weak one a blinder. */
      let rel = 0;
      STAT_KEYS.forEach((k, i) => { if (chal.w[i] > 0) rel += c.stats[k] * chal.w[i]; });
      const wsum = chal.w.reduce((a, b) => a + b, 0) || 1;
      const ability = clamp01(rel / wsum);
      const swing = CONFIG.npcFormSwing * (1.25 - ability * 0.55) + Challenges.weatherChaos();
      s += rr(0, CONFIG.immunityRandomWeight) + rr(-swing, swing);
    }
    c.lastChallengeScore = s;
    return s;
  },
  /* The final four always make fire. Nothing else decides that round. */
  finalFourFire() {
    return CHALLENGES.find(c => c.finalFourOnly) || CHALLENGES.find(c => c.fire);
  },
  runTribal(chal, tribeA, tribeB) {
    /* A weighted average. The player counts for more than one castaway, because
       they are the one actually competing — but they are still one of nine, so
       a tribe of strong performers can carry a bad round from the player and a
       tribe of weak ones can lose despite a great one. */
    const side = tribe => {
      let sum = 0, w = 0;
      for (const c of tribe) {
        const sc = this.score(c, chal);
        const weight = c.isPlayer ? CONFIG.playerTribalWeight : 1;
        sum += sc * weight; w += weight;
      }
      return w ? sum / w : 0;
    };
    const a = side(tribeA), b = side(tribeB);
    DBG.decision('Challenge', 'tribal result', {
      chal: chal.name, tidal: +a.toFixed(3), ember: +b.toFixed(3),
      playerWeight: CONFIG.playerTribalWeight
    });
    return a >= b ? 'A' : 'B';
  },
  runIndividual(chal, pool) {
    let best = null, bs = -Infinity;
    for (const c of pool) {
      const s = this.score(c, chal);
      if (s > bs) { bs = s; best = c; }
    }
    return best;
  }
};

/* ---------------- Vote-weight seeding (SeedVoteWeights port) ---------------- */
function seedVoteWeights(cast, merged, playerName) {
  const alive = cast.filter(c => !c.eliminated);
  for (const v of alive) v.resetVW();
  const baseW = CONFIG.voteWeightBaseFromStats;
  for (const voter of alive) {
    for (const target of alive) {
      if (target === voter) continue;
      if (!merged && target.tribeName !== voter.tribeName) continue;
      /* Every one of these carries a reason string. Without them a ballot reads
         "unexplained +0.47" four times over, which is exactly as useful as not
         logging it at all. */
      const threatW = Behavior.voteModifier(voter, target, merged) * baseW;
      if (threatW > 0.4) voter.addVW(target.name, threatW, 'reads as a threat');
      const trust = voter.getTrust(target.name);
      const trustW = (1 - trust) * 0.15;
      if (trust < 0.45 && trustW > 0) voter.addVW(target.name, trustW, 'does not trust them');
      const rel = voter.getRel(target.name);
      const relW = -(rel * 0.6);
      if (relW !== 0) voter.addVW(target.name, relW, 'likes them');
      // standing grudges re-enter the math each seeding
      const e = voter.relEntry(target.name);
      if (e && e.grudge > 0) voter.addVW(target.name, e.grudge * CONFIG.grudgeWeight, 'a standing grudge');
      /* "He never helps." Only from voters who actually care about camp work, and
         capped well under a deliberate push, so it is a real reason to write a
         name without ever being the only reason. Post-merge it inverts: a work
         resume makes you a threat, which is what stops a provider going unvoted
         to the end. */
      const campW = Ledger.voteWeight(voter, target);
      if (campW > 0.02) voter.addVW(target.name, campW, 'camp contribution');
    }
  }
  // player-anchored alliance protection
  for (const al of PlayerAlliances.list) {
    if (al.broken) continue;
    const ally = alive.find(c => c.name === al.name);
    if (!ally) continue;
    if (al.level === 3) ally.addVW(playerName, -0.6, 'locked with you');
    else if (al.level === 2) ally.addVW(playerName, -0.3, 'promised you');
  }
  // NPC alliance coordination
  for (const al of NpcAlliances.list) {
    if (al.broken) continue;
    const A = alive.find(c => c.name === al.a), B = alive.find(c => c.name === al.b);
    if (!A || !B) continue;
    let best = null, bw = -Infinity;
    for (const t of alive) {
      if (t === A || t === B) continue;
      const w = A.getVW(t.name) + B.getVW(t.name);
      if (w > bw) { bw = w; best = t; }
    }
    if (best && CONFIG.allianceCoordinationBoost > 0) {
      A.addVW(best.name, CONFIG.allianceCoordinationBoost, 'their pair agreed a name');
      B.addVW(best.name, CONFIG.allianceCoordinationBoost, 'their pair agreed a name');
    }
  }
  // circle protection + coordination
  Coalitions.seedEffects(cast, merged);
  NpcBlocs.seedEffects(cast, merged);
}

/* ---------------- Autonomous NPC social tick ---------------- */
function advanceSocialTime(hours, cast, merged) {
  const avail = cast.filter(c => !c.eliminated && !c.isPlayer && c.interactionBudget > 0);
  // group by tribe pre-merge
  const groupsMap = {};
  for (const c of avail) {
    const key = merged ? 'all' : c.tribeName;
    (groupsMap[key] = groupsMap[key] || []).push(c);
  }
  const feedLines = [];
  for (const members of Object.values(groupsMap)) {
    if (members.length < 2) continue;
    shuffle(members);
    let i = 0;
    while (i < members.length - 1) {
      const size = (members.length - i >= 3 && chance(0.3)) ? 3 : 2;
      const group = members.slice(i, i + size);
      i += size;
      processConversation(group, hours, cast, merged, feedLines);
    }
  }
  for (const c of avail) c.interactionBudget = Math.max(0, c.interactionBudget - hours);
  return feedLines;
}

function processConversation(group, hours, cast, merged, feedLines) {
  // pairwise bonding
  for (let x = 0; x < group.length; x++) {
    for (let y = x + 1; y < group.length; y++) {
      const a = group[x], b = group[y];
      a.addRel(b.name, Behavior.convRelDelta(a, b) * hours, 'ambient social tick');
      a.addTrust(b.name, Behavior.convTrustDelta(a, b) * hours, 'ambient social tick');
      b.addRel(a.name, Behavior.convRelDelta(b, a) * hours, 'ambient social tick');
      b.addTrust(a.name, Behavior.convTrustDelta(b, a) * hours, 'ambient social tick');
    }
  }
  // passive morale
  for (const m of group) {
    const boost = Behavior.passiveMoraleBoost(m);
    if (boost > 0) for (const o of group) if (o !== m) o.morale = clamp01(o.morale + boost * hours);
  }
  const alive = cast.filter(c => !c.eliminated);
  const pool = merged ? alive : alive.filter(c => c.tribeName === group[0].tribeName);
  // vote discussion
  for (const suggester of group) {
    if (!chance(CONFIG.voteWeightNpcSuggestChance)) continue;
    const { target, weight } = suggester.topVoteTarget(pool);
    if (!target || weight <= 0) continue;
    for (const listener of group) {
      if (listener === suggester) continue;
      if (NpcAlliances.has(listener.name, target.name)) {
        listener.addVW(target.name, -CONFIG.allianceDefenseMagnitude, 'defending an ally');
        continue;
      }
      const influence = (listener.getTrust(suggester.name) - listener.stats.gameAwareness * 0.3) * CONFIG.voteWeightNpcSuggestion;
      if (influence > 0) listener.addVW(target.name, influence, 'talked into it round camp');
    }
  }
  // lobby influence
  for (const lob of group) {
    if (lob.stats.social < HI || lob.stats.relational < HI) continue;
    const { target, weight } = lob.topVoteTarget(pool);
    if (!target || weight <= 0) continue;
    const influence = lob.stats.social * 0.3;
    for (const v of group) {
      if (v === lob) continue;
      const rel = v.getRel(lob.name);
      if (rel > 0.5) v.addVW(target.name, influence * rel, 'a persuasive tribemate');
    }
  }
  /* Camp talk. "Who does nothing round here" is one of the things a group of
     tired people actually discusses, and it moves votes — so it belongs in the
     ambient tick rather than in a menu. */
  const camp = CampGossip.maybe(group);
  if (camp) feedLines.push(camp);
  // occasionally narrate the group to the feed
  else if (chance(0.22)) {
    const maxSoc = Math.max(...group.map(m => m.stats.social));
    const verbs = maxSoc > HI
      ? ['laughing together', 'telling stories', 'cracking jokes', 'bonding']
      : maxSoc > LO ? ['talking quietly', 'chatting', 'passing time'] : ['sitting together in silence'];
    feedLines.push({ text: `${group.map(m => m.displayName).join(' and ')} are ${pick(verbs)}.`, kind: '' });
  }
}

/* Elimination reaction: morale/trust ripple through remaining cast */
function processEliminationReaction(cast, eliminated) {
  for (const c of cast) {
    if (c.eliminated || c === eliminated) continue;
    const rel = c.getRel(eliminated.name);
    if (rel > 0.5) c.morale = clamp01(c.morale - CONFIG.reactionMoraleLossBase * rel);
    // paranoid trust decay across the board
    for (const [, e] of c.relationships) e.trust = clamp01(e.trust - CONFIG.reactionTrustDecayBase * c.stats.gameAwareness * 0.5);
  }
}

function applyImmunityWinBoost(winners) {
  for (const c of winners) {
    c.morale = clamp01(c.morale + CONFIG.immunityWinMoraleBoost);
    for (const o of winners) {
      if (o === c) continue;
      c.addRel(o.name, CONFIG.immunityWinRelBoost);
      c.addTrust(o.name, CONFIG.immunityWinTrustBoost);
    }
  }
}

/* VotingLogic + castaway generation appended below (from data extraction). */

/* ============================================================
   VotingLogic — port of the shortlist/score/gates algorithm
   ============================================================ */
const Voting = {
  inlineThreat(t) { return (t.stats.social + t.stats.physicality + t.stats.smarts) / 3; },

  buildShortlist(voter, eligible) {
    const listed = [];
    for (const t of eligible) {
      const e = voter.relEntry(t.name);
      const trust = voter.getTrust(t.name);
      let reason = false;
      if (trust < 0.45) reason = true;
      if (this.inlineThreat(t) > 0.55) reason = true;
      if (voter.getVW(t.name) > 0.3) reason = true;
      if (e && e.grudge > 0.2) reason = true;
      const back = t.getTrust(voter.name);
      if (Math.min(trust, back) < 0.4 && (!e || e.highTrustDays === 0)) reason = true;
      if (reason) listed.push(t);
    }
    if (listed.length < 2) {
      return [...eligible].sort((a, b) => voter.getTrust(a.name) - voter.getTrust(b.name)).slice(0, 2);
    }
    if (listed.length > 4) {
      listed.sort((a, b) =>
        (this.inlineThreat(b) + voter.getVW(b.name)) - (this.inlineThreat(a) + voter.getVW(a.name)));
      return listed.slice(0, 4);
    }
    return listed;
  },

  scoreCandidates(voter, shortlist, merged) {
    const threatMult = merged ? CONFIG.postMergeThreatWeight : CONFIG.preMergeThreatWeight;
    const selfPressure = voter.getVW(voter.name);
    const selfThreat = clamp01((selfPressure - 0.3) / 0.5);
    return shortlist.map(t => {
      const e = voter.relEntry(t.name);
      const rel = voter.getRel(t.name), trust = voter.getTrust(t.name);
      let score = this.inlineThreat(t) * threatMult;
      score += (1 - rel) * 0.6;
      score += voter.getVW(t.name) * 1.2;
      if (e && e.grudge > 0) score += e.grudge * 1.5;
      if (trust > 0.7) score -= (e && e.isPerformative) ? 0.5 : 2.5;
      if (selfThreat > 0) {
        const pileOn = clamp01(Math.max(0, voter.getVW(t.name)));
        const allianceFactor = trust > 0.7 ? 0.3 : 1.0;
        score += selfThreat * pileOn * allianceFactor;
      }
      if (voter.stats.emotional < 0.35) score += rr(-0.3, 0.5);
      return Math.max(score, 0.05);
    });
  },

  applyOverrides(voter, shortlist, scores, day, playerName) {
    if (shortlist.length <= 1) return 0;
    let gate = 0;
    const topIdx = () => scores.indexOf(Math.max(...scores));
    const secondIdx = () => {
      const t = topIdx();
      let idx = -1, best = -Infinity;
      scores.forEach((s, i) => { if (i !== t && s > best) { best = s; idx = i; } });
      return idx;
    };
    // Gate 1 — alliance exposure
    let ti = topIdx();
    const top = shortlist[ti];
    const mutual = Math.min(voter.getTrust(top.name), top.getTrust(voter.name));
    if (mutual > 0.7) {
      const si = secondIdx();
      scores[ti] = 0.05;
      if (si >= 0) scores[si] = Math.max(scores[si], 0.05) + 2;
      gate = 1;
    }
    // Gate 2 — silent protection of a pressured ally
    if (!gate) {
      for (const [name, e] of voter.relationships) {
        if (e.trust > 0.7 && e.highTrustDays > 2) {
          const allyPressure = GAME.cast.filter(c => !c.eliminated && c !== voter)
            .reduce((s, c) => s + Math.max(0, c.getVW(name)), 0);
          ti = topIdx();
          if (allyPressure > 0.5 && shortlist[ti].name === name) {
            const si = secondIdx();
            scores[ti] = 0.05;
            if (si >= 0) scores[si] = Math.max(scores[si], 0.05) + 2;
            gate = 2;
          }
          break;
        }
      }
    }
    // Gate 3 — panic override
    if (!gate && voter.stats.gameAwareness > 0.5 && voter.getVW(voter.name) > 0.4) {
      let bi = 0, bt = -Infinity;
      shortlist.forEach((t, i) => { const th = this.inlineThreat(t); if (th > bt) { bt = th; bi = i; } });
      scores.forEach((s, i) => scores[i] = i === bi ? s + 5 : 0.05);
      gate = 3;
    }
    // Gate 4 — promise protection of the player
    if (!gate && voter !== GAME.player) {
      const al = PlayerAlliances.get(voter.name);
      if (al && al.level >= 2 && al.promisedTribal >= day) {
        ti = topIdx();
        if (shortlist[ti].name === playerName) {
          const si = secondIdx();
          scores[ti] = 0.05;
          if (si >= 0) scores[si] = Math.max(scores[si], 0.05) + 2;
          gate = 4;
        }
      }
    }
    return gate;
  },

  calculateVote(voter, candidates, immune, merged, day, playerName) {
    let eligible = candidates.filter(c => c !== voter && c !== immune);
    if (!eligible.length) return null;
    if (PlayerAlliances.level(voter.name) === 3) {
      const filtered = eligible.filter(c => !c.isPlayer);
      if (filtered.length) eligible = filtered;
    }
    const shortlist = this.buildShortlist(voter, eligible);
    const scores = this.scoreCandidates(voter, shortlist, merged);
    const gate = this.applyOverrides(voter, shortlist, scores, day, playerName);
    if (gate > 0 || voter.stats.gameAwareness > 0.6) {
      return shortlist[scores.indexOf(Math.max(...scores))];
    }
    const topScore = Math.max(...scores);
    const threshold = topScore * 0.75;
    const pool = [], poolScores = [];
    shortlist.forEach((t, i) => { if (scores[i] >= threshold) { pool.push(t); poolScores.push(scores[i]); } });
    if (pool.length <= 1) return shortlist[scores.indexOf(topScore)];
    let roll = rr(0, poolScores.reduce((a, b) => a + b, 0));
    for (let i = 0; i < pool.length; i++) {
      roll -= poolScores[i];
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  },

  /* votes: Map voterName -> Castaway target. Returns {eliminated|null, tied[], counts}

     `voided` is the list of VOTER names whose votes an idol has cancelled. They
     are still read out at the reveal — that is what makes an idol land — they
     simply do not count here. Passing nothing behaves exactly as before, so every
     existing caller is unaffected.

     A subtlety worth stating: with the idol-holder's votes removed, the holder can
     still appear in `counts` with zero and must not be a candidate for
     elimination, so anyone whose whole count was voided drops out entirely. */
  tally(votes, voided) {
    const skip = voided && voided.length ? new Set(voided) : null;
    const counts = new Map();
    for (const [voterName, t] of votes) {
      if (skip && skip.has(voterName)) continue;
      if (!t) continue;
      counts.set(t.name, (counts.get(t.name) || 0) + 1);
    }
    let max = 0;
    for (const [, n] of counts) max = Math.max(max, n);
    /* Nobody got a countable vote at all — only reachable if an idol wiped out a
       unanimous vote, which is the single most spectacular outcome in the format. */
    if (max === 0) return { eliminated: null, tied: [], counts, noVotes: true };
    const tied = [...counts.entries()].filter(([, n]) => n === max).map(([name]) => name);
    return { eliminated: tied.length === 1 ? tied[0] : null, tied, counts };
  }
};

/* ============================================================
   Jury voting
   ============================================================ */
const Jury = {
  JURY_SIZE: 7,
  FINALIST_COUNT: 2,
  JURY_STARTS_AT: 10,   // elimination ordinal that begins the jury

  castVotes(jury, finalists) {
    const votes = [];
    for (const juror of jury) {
      let best = null, bs = -Infinity, bestReason = '';
      for (const f of finalists) {
        const rel = juror.getRel(f.name), trust = juror.getTrust(f.name);
        const e = juror.relEntry(f.name);
        let score = rel * 2 + trust * 1.5;
        let reason = '';
        if (juror.stats.gameAwareness > 0.6) {
          score += (f.stats.gameAwareness + f.stats.smarts) * juror.stats.gameAwareness * 0.8;
          reason = 'respected their strategy';
        }
        if (juror.stats.emotional > 0.6) {
          score += rel * juror.stats.emotional * 1.2;
          reason = reason || 'felt a genuine connection';
        }
        if (juror.stats.relational > 0.6 && trust < 0.35) {
          score -= (1 - trust) * juror.stats.relational * 2;
          reason = 'felt betrayed';
        }
        if (e && e.grudge > 0.3) {
          score -= e.grudge * 1.5;
          reason = 'held a grudge';
        }
        score += rr(-0.3, 0.3);
        if (score > bs) { bs = score; best = f; bestReason = reason || (rel > 0.5 ? 'liked them' : 'respected their game'); }
      }
      votes.push({ juror, votedFor: best, reason: bestReason });
    }
    return votes;
  }
};

/* ============================================================
   Castaway generation (clusters, validation, names, visuals)
   ============================================================ */
const Generator = {
  usedNames: new Set(),

  validateStats(stats) {
    const vals = STAT_KEYS.map(k => stats[k]);
    const total = vals.reduce((a, b) => a + b, 0);
    const high = vals.filter(v => v > CONFIG.highStatThreshold).length;
    return total >= CONFIG.statTotalMin && total <= CONFIG.statTotalMax && high <= CONFIG.maxStatsAboveThreshold;
  },

  rollStats(cluster) {
    const s = {};
    STAT_KEYS.forEach((k, i) => s[k] = rr(cluster.r[i][0], cluster.r[i][1]));
    return s;
  },

  rollAge() {
    const roll = rng();
    let acc = 0;
    for (const [w, lo, hi] of CONFIG.ageBrackets) {
      acc += w;
      if (roll < acc) return ri(lo, hi);
    }
    return ri(18, 66);
  },

  pickGender() {
    const roll = rng();
    return roll < 0.45 ? 'Male' : roll < 0.90 ? 'Female' : 'Nonbinary';
  },

  /* Names are drawn from the pool matching the gender, so a castaway's
     name never fights their body or pronouns. Omit gender for a free pick. */
  generateName(gender) {
    const pool = gender ? firstNamesFor(gender) : FIRST_NAMES;
    for (let i = 0; i < 40; i++) {
      const first = pick(pool), last = pick(LAST_NAMES);
      if (first === last) continue;               // no "Taylor Taylor"
      const n = first + ' ' + last;
      if (!this.usedNames.has(n)) { this.usedNames.add(n); return n; }
    }
    return pick(pool) + ' ' + pick(LAST_NAMES);
  },

  assignVisuals(c, usedOutfits) {
    const builds = ['skinny', 'muscular', 'curvy'];
    const sex = c.gender === 'Male' ? 'male' : c.gender === 'Female' ? 'female' : (chance(0.5) ? 'male' : 'female');
    // build hint from stats: physical -> muscular bias
    let build;
    if (c.stats.physicality > 0.6) build = chance(0.7) ? 'muscular' : pick(builds);
    else if (c.stats.physicality < 0.3) build = chance(0.6) ? pick(['skinny', 'curvy']) : pick(builds);
    else build = pick(builds);
    c.bodyKey = sex + '_' + build;
    c.skinIdx = ri(0, 6);
    c.heightTier = ri(0, 3);
    // spread outfit colors so the cast reads distinct
    let outfit = ri(0, 12);
    let guard = 0;
    while (usedOutfits.has(outfit) && guard++ < 12) outfit = (outfit + 1) % 12;
    usedOutfits.add(outfit);
    if (usedOutfits.size >= 12) usedOutfits.clear();
    c.outfitIdx = outfit;
  },

  /* Gender is rolled first so the name can be drawn to match it.
     An explicit name still wins (returning players, debug). */
  generateCastaway(name) {
    const gender = this.pickGender();
    const c = new Castaway(name || this.generateName(gender));
    c.gender = gender;
    c.age = this.rollAge();
    c.occupation = pick(OCCUPATIONS);
    let ok = false;
    for (let attempt = 0; attempt < 20 && !ok; attempt++) {
      const cluster = pick(TRAIT_CLUSTERS);
      const stats = this.rollStats(cluster);
      if (this.validateStats(stats)) {
        c.cluster = cluster.name;
        c.stats = stats;
        ok = true;
      }
    }
    if (!ok) {
      c.cluster = 'Reluctant Hero';
      c.stats = { social: 0.45, emotional: 0.45, relational: 0.45, gameAwareness: 0.40, background: 0.40, physicality: 0.40, smarts: 0.40 };
    }
    return c;
  }
};

/* ============================================================
   Returning players (localStorage pool, 20% chance, +0.1 GA)
   ============================================================ */
const Returning = {
  KEY: 'castaway_returning_pool',
  load() { try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch { return []; } },
  save(pool) { try { localStorage.setItem(this.KEY, JSON.stringify(pool.slice(-50))); } catch { /* full */ } },
  tryGet() {
    if (rng() > 0.2) return null;
    const pool = this.load();
    if (!pool.length) return null;
    const saved = pool[ri(0, pool.length)];
    const c = new Castaway(saved.name);
    Object.assign(c.stats, saved.stats);
    c.age = saved.age; c.gender = saved.gender; c.occupation = saved.occupation; c.cluster = saved.cluster;
    // Heal pools written before names were gender-matched: trust the name over the stored gender.
    if (!firstNamesFor(c.gender).includes(c.name.split(' ')[0])) c.gender = genderFromName(c.name);
    c.stats.gameAwareness = clamp01(c.stats.gameAwareness + 0.1);
    c.isReturning = true;
    Generator.usedNames.add(c.name);
    return c;
  },
  recordSeason(eliminatedList) {
    const pool = this.load();
    eliminatedList.forEach((c, i) => {
      if (c.isPlayer) return;
      pool.push({ name: c.name, stats: c.stats, age: c.age, gender: c.gender, occupation: c.occupation, cluster: c.cluster, placedAt: i + 1 });
    });
    this.save(pool);
  }
};
