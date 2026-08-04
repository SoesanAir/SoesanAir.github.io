/* ============================================================
   CASTAWAY — game.js
   Season orchestration: creation → camp days → challenges →
   tribal councils → swap/merge → finale → jury → aftershow.
   ============================================================ */

'use strict';

/* ---------------- Global game state ---------------- */
const GAME = {
  cast: [], player: null,
  tribes: { Tidal: [], Ember: [] },
  day: 1, hoursRemaining: CONFIG.hoursPerDay, phase: 'Morning',
  merged: false, swapped: false,
  seasonSeed: 0, seasonActive: false, playerEliminated: false,
  eliminatedPreFinal: [], jury: [], totalEliminated: 0,
  tribalLog: [], sharedWins: [], voteHistory: [], namedResponses: [], todayImmune: null, todayLosingTribe: null, stormDouble: false,
  lastChallenge: null, probeDoneToday: false,
  watchMode: false,
  intel: []   // player-known vote reads: {who, kind, target, note, day}
};

const $ = id => document.getElementById(id);
const alive = () => GAME.cast.filter(c => !c.eliminated);
const aliveTribe = t => alive().filter(c => c.tribeName === t);
/* Everyone this castaway actually shares a camp and a council with RIGHT NOW.

   After a swap the tribe on somebody's card is the only one that counts: they
   cannot vote for, scheme about, overhear, or form an alliance with a person who
   is not there. Reported from real play as "who are you voting for, past tribe
   swap, will still yield people from the old tribe".

   The bug was never that this rule was unknown — pickTarget already scoped
   correctly. It was that a dozen other pools reached for a bare alive() instead,
   so the rule held in some answers and not others. One helper, used everywhere,
   is the only version of this that stays fixed. */
const campmates = c => (GAME.merged || !c ? alive() : aliveTribe(c.tribeName));
/* Scheduled councils, plus one every day once the field is small enough. The
   endgame keeps the full day structure — challenge, hours, tribal — instead of
   collapsing into consecutive votes. */
const isTribalDay = d => CONFIG.tribalDays.includes(d)
  || (GAME.seasonActive && !!GAME.cast.length && alive().length <= CONFIG.endgameDailyTribalFrom);

/* Does the PLAYER actually attend tonight's tribal?
   true = yes, false = the other tribe votes without them,
   null = it is a tribal day but the challenge has not decided who yet. */
/* The season is over when the finalists are decided — not on a date. Getting from
   the last scheduled council down to the final two is the endgame, and it is played
   out day by day with challenges rather than resolved by a run of votes. The day
   cap is a backstop only; it should never be what ends a season. */
function seasonShouldEnd() {
  if (!GAME.seasonActive) return true;
  if (alive().length <= Jury.FINALIST_COUNT) return true;
  return GAME.day >= CONFIG.totalDays + CONFIG.endgameHardCapDays;
}

function playerFacesTribal() {
  if (!isTribalDay(GAME.day)) return false;
  if (GAME.merged || GAME.stormDouble) return true;
  if (!GAME.todayLosingTribe) return null;                 // challenge not run yet
  return GAME.todayLosingTribe === GAME.player.tribeName;
}

function phaseOf() {
  const f = GAME.hoursRemaining / CONFIG.hoursPerDay;
  return f > 0.66 ? 'Morning' : f > 0.33 ? 'Afternoon' : 'Night';
}

/* ---------------- Save / Load (localStorage) ---------------- */
const SAVE_KEY = 'castaway_save_v1';
const Save = {
  has() { return !!localStorage.getItem(SAVE_KEY); },
  del() { localStorage.removeItem(SAVE_KEY); },
  write() {
    if (!GAME.seasonActive) return;
    const data = {
      v: 1, seed: GAME.seasonSeed, rngState: _rngState,
      day: GAME.day, hours: GAME.hoursRemaining, merged: GAME.merged, swapped: GAME.swapped,
      playerEliminated: GAME.playerEliminated, totalEliminated: GAME.totalEliminated,
      weather: Weather.today,
      cast: GAME.cast.map(c => ({
        name: c.name, displayName: c.displayName, age: c.age, gender: c.gender,
        occupation: c.occupation, cluster: c.cluster, stats: c.stats, isPlayer: c.isPlayer,
        isReturning: !!c.isReturning, tribeName: c.tribeName, hunger: c.hunger, fatigue: c.fatigue,
        morale: c.morale, eliminated: c.eliminated, budget: c.interactionBudget,
        bodyKey: c.bodyKey, skinIdx: c.skinIdx, outfitIdx: c.outfitIdx, heightTier: c.heightTier,
        fireSkill: c.fireSkill, firesMade: c.firesMade,
        ethic: c._ethic, workRecent: c.workRecent, workTotal: c.workTotal,
        workToday: c.workToday, slackRun: c.slackRun, campRelGiven: c.campRelGiven,
        choreRelGiven: c.choreRelGiven,
        rels: [...c.relationships.entries()],
        vws: [...c.voteWeights.entries()],
        memories: c.memories,
        /* Inventory travels with the castaway. An idol that vanishes on reload is
           the worst possible bug in this feature — the player would find one, come
           back tomorrow, and it would be gone with no explanation. */
        items: c.items || []
      })),
      elimPre: GAME.eliminatedPreFinal.map(c => c.name),
      jury: GAME.jury.map(c => c.name),
      playerAlliances: PlayerAlliances.list,
      npcAlliances: NpcAlliances.list,
      declared: [...Lying.declared.entries()],
      secrets: PlayerSecrets.list,
      coalitions: Coalitions.list,
      intel: GAME.intel,
      usedChal: [...Challenges.usedIdx], puzzlesUsed: Challenges.puzzlesUsed,
      /* Everything added this pass. Missing any one of these is a reload that
         silently loses live state: a tarp still paying out, the ledger that stops
         a minigame appearing twice, who found an idol, which blocs exist, and how
         many whispering nights the season has already spent. */
      rewardUsed: (typeof Rewards !== 'undefined') ? Rewards.saveState() : null,
      rewardEffects: GAME.rewardEffects || [],
      rewardTickedDay: GAME.rewardTickedDay || 0,
      idols: { found: Idols.found, played: Idols.played, dryDays: Idols.dryDays },
      npcBlocs: NpcBlocs.list,
      whisper: { councils: Whisper.councils, fired: Whisper.fired },
      dilemmaSeen: Dilemmas.seasonSeen || {},
      tribalLog: GAME.tribalLog,
      sharedWins: GAME.sharedWins,
      voteHistory: GAME.voteHistory,
      foodStore: GAME.foodStore, campFire: GAME.campFire, shelter: GAME.shelter,
      camp: GAME.camp, lastNight: GAME.lastNight, lastNightBig: GAME.lastNightBig,
      exits: GAME.exits,
      namedResponses: GAME.namedResponses
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* storage full */ }
  },
  async load() {
    let d;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return false; }
    if (!d || !d.cast) return false;
    seedRng(d.seed); _rngState = d.rngState;
    GAME.seasonSeed = d.seed; GAME.day = d.day; GAME.hoursRemaining = d.hours;
    GAME.merged = d.merged; GAME.swapped = d.swapped;
    GAME.playerEliminated = d.playerEliminated; GAME.totalEliminated = d.totalEliminated;
    Weather.today = d.weather || 'Sunny';
    GAME.cast = d.cast.map(s => {
      const c = new Castaway(s.name);
      Object.assign(c, {
        displayName: s.displayName, age: s.age, gender: s.gender, occupation: s.occupation,
        cluster: s.cluster, stats: s.stats, isPlayer: s.isPlayer, isReturning: s.isReturning,
        tribeName: s.tribeName, hunger: s.hunger, fatigue: s.fatigue, morale: s.morale,
        eliminated: s.eliminated, interactionBudget: s.budget,
        bodyKey: s.bodyKey, skinIdx: s.skinIdx, outfitIdx: s.outfitIdx, heightTier: s.heightTier,
        fireSkill: s.fireSkill, firesMade: s.firesMade,
        _ethic: s.ethic, workRecent: s.workRecent, workTotal: s.workTotal,
        workToday: s.workToday, slackRun: s.slackRun, campRelGiven: s.campRelGiven || {},
        choreRelGiven: s.choreRelGiven || {},
        memories: s.memories || [],
        items: s.items || []
      });
      c.relationships = new Map(s.rels);
      c.voteWeights = new Map(s.vws);
      return c;
    });
    GAME.player = GAME.cast.find(c => c.isPlayer);
    const byName = Object.fromEntries(GAME.cast.map(c => [c.name, c]));
    GAME.eliminatedPreFinal = (d.elimPre || []).map(n => byName[n]).filter(Boolean);
    GAME.jury = (d.jury || []).map(n => byName[n]).filter(Boolean);
    PlayerAlliances.list = d.playerAlliances || [];
    NpcAlliances.list = d.npcAlliances || [];
    Lying.reset();
    Lying.declared = new Map(d.declared || []);
    PlayerSecrets.list = d.secrets || [];
    Coalitions.list = d.coalitions || [];
    GAME.intel = d.intel || [];
    Challenges.usedIdx = new Set(d.usedChal || []);
    Challenges.puzzlesUsed = d.puzzlesUsed || 0;
    /* The state added this pass. All defaulted, so a save written before these
       existed loads as a season that simply has not found an idol yet. */
    if (typeof Rewards !== 'undefined') Rewards.loadState(d.rewardUsed);
    GAME.rewardEffects = d.rewardEffects || [];
    GAME.rewardTickedDay = d.rewardTickedDay || 0;
    if (d.idols) {
      Idols.found = d.idols.found || 0;
      Idols.played = d.idols.played || [];
      Idols.dryDays = d.idols.dryDays || 0;
    }
    NpcBlocs.list = d.npcBlocs || [];
    if (d.whisper) { Whisper.councils = d.whisper.councils || 0; Whisper.fired = d.whisper.fired || 0; }
    Dilemmas.seasonSeen = d.dilemmaSeen || {};
    GAME.tribalLog = d.tribalLog || [];
    GAME.sharedWins = d.sharedWins || [];
    GAME.voteHistory = d.voteHistory || [];
    GAME.foodStore = d.foodStore !== undefined ? d.foodStore : 0.35;
    GAME.campFire = d.campFire !== undefined ? d.campFire : 0.4;
    GAME.shelter = d.shelter !== undefined ? d.shelter : 0.3;
    GAME.camp = d.camp || null;
    GAME.lastNight = d.lastNight || null;
    GAME.lastNightBig = !!d.lastNightBig;
    GAME.exits = d.exits || null;
    if (!GAME.exits) Exits.reset();
    CampNeeds.ensure();
    CampNeeds.pull();
    CallOut.reset();
    for (const c of GAME.cast) { ethicOf(c); Ledger.ensure(c); }
    GAME.namedResponses = d.namedResponses || [];
    GAME.seasonActive = true;
    await buildAllSprites();
    Beach.reset();
    return true;
  }
};

/* ---------------- Sprites ----------------
   A portrait that will not build is a cosmetic problem. It used to be a fatal one:
   this awaited each sprite in a loop, so a single failed image rejected the whole
   call, beginSeason died on that await, and the player sat on the creation screen
   with no error and no way forward. Now each castaway is allowed to fail on their
   own and the season starts regardless. */
async function buildAllSprites() {
  const failed = [];
  for (const c of GAME.cast) {
    try {
      c.spriteURL = await SpriteFactory.get(c.bodyKey, c.skinIdx, c.outfitIdx);
    } catch (e) {
      c.spriteURL = null;
      failed.push(c.displayName || c.name);
      DBG.log('system', `Sprite failed for ${c.name} (${c.bodyKey}): ${e && e.message}`);
    }
  }
  if (failed.length) {
    DBG.log('system', `${failed.length}/${GAME.cast.length} sprites failed: ${failed.join(', ')}`);
    toast(`${failed.length} portrait${failed.length > 1 ? 's' : ''} did not load.`);
  }
  return failed.length;
}
function heightScale(tier) { return [0.9, 1.0, 1.08][tier] || 1; }

/* ---------------- Title screen ---------------- */
function initTitle() {
  $('title-version').textContent = 'a season of 18 · every vote is math';
  $('btn-continue').classList.toggle('hidden', !Save.has());
  Screens.replace('screen-title');
}
$('btn-new-game').addEventListener('click', () => { Save.del(); openCreation(); });
$('btn-continue').addEventListener('click', async () => {
  toast('Loading season…');
  if (await Save.load()) { enterCamp(); } else { toast('Save was unreadable.'); initTitle(); }
});

/* ---------------- Character creation ---------------- */
const CREATE = { gender: 'Female', build: 'muscular', skinIdx: 2, occIdx: -1, stats: null, cluster: '' };

function seg(el, options, current, onPick) {
  el.innerHTML = '';
  options.forEach(o => {
    const b = document.createElement('button');
    b.textContent = o.label;
    if (o.value === current) b.classList.add('on');
    b.addEventListener('click', () => {
      el.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      onPick(o.value);
    });
    el.appendChild(b);
  });
}

async function refreshCreatePreview() {
  const sex = CREATE.gender === 'Male' ? 'male' : CREATE.gender === 'Female' ? 'female' : (CREATE.previewSex || 'female');
  const url = await SpriteFactory.get(sex + '_' + CREATE.build, CREATE.skinIdx, 3);
  $('create-preview-img').src = url;
  $('create-name-chip').textContent = $('create-name').value.trim() || 'Castaway';
}

function rollCreationStats() {
  for (let i = 0; i < 30; i++) {
    const cluster = pick(TRAIT_CLUSTERS);
    const stats = Generator.rollStats(cluster);
    if (Generator.validateStats(stats)) { CREATE.stats = stats; CREATE.cluster = cluster.name; return; }
  }
  CREATE.stats = { social: 0.45, emotional: 0.45, relational: 0.45, gameAwareness: 0.45, background: 0.45, physicality: 0.45, smarts: 0.45 };
  CREATE.cluster = 'Reluctant Hero';
}

function renderStatRoll() {
  const wrap = $('stat-alloc');
  wrap.innerHTML = '';
  const head = h('div', 'row');
  head.appendChild(h('b', 'display', 'Your strengths'));
  const chip = h('span', 'chip', CREATE.cluster);
  head.appendChild(chip);
  const reroll = h('button', 'btn small sand', 'Reroll');
  reroll.addEventListener('click', () => { rollCreationStats(); renderStatRoll(); });
  head.appendChild(reroll);
  wrap.appendChild(head);
  for (const k of STAT_KEYS) {
    const row = h('div', 'stat-row');
    row.appendChild(h('span', 'lbl', STAT_LABELS[k]));
    const meter = h('div', 'meter');
    const fill = h('i');
    fill.style.width = pct(CREATE.stats[k]);
    meter.appendChild(fill);
    meter.style.flex = '1';
    row.appendChild(meter);
    row.appendChild(h('span', 'tiny dim', pct(CREATE.stats[k])));
    wrap.appendChild(row);
  }
}

function openCreation() {
  seedRng(Date.now() & 0x7fffffff);
  rollCreationStats();
  seg($('seg-gender'), [
    { label: 'Female', value: 'Female' }, { label: 'Male', value: 'Male' }, { label: 'Nonbinary', value: 'Nonbinary' }
  ], CREATE.gender, v => { CREATE.gender = v; if (v === 'Nonbinary') CREATE.previewSex = chance(0.5) ? 'male' : 'female'; refreshCreatePreview(); });
  seg($('seg-body'), [
    { label: 'Slim', value: 'skinny' }, { label: 'Athletic', value: 'muscular' }, { label: 'Curvy', value: 'curvy' }
  ], CREATE.build, v => { CREATE.build = v; refreshCreatePreview(); });
  seg($('seg-look'), SpriteFactory.SKIN_TONES.map((t, i) => ({ label: t.name, value: i })), CREATE.skinIdx,
    v => { CREATE.skinIdx = v; refreshCreatePreview(); });
  CREATE.occIdx = ri(0, OCCUPATIONS.length);
  $('occ-label').textContent = OCCUPATIONS[CREATE.occIdx];
  renderStatRoll();
  refreshCreatePreview();
  Screens.replace('screen-create');
}
$('btn-occ-cycle').addEventListener('click', () => {
  CREATE.occIdx = ri(0, OCCUPATIONS.length);
  $('occ-label').textContent = OCCUPATIONS[CREATE.occIdx];
});
$('create-name').addEventListener('input', refreshCreatePreview);
$('btn-create-back').addEventListener('click', initTitle);
$('btn-create-go').addEventListener('click', beginSeason);

/* ---------------- Season start ---------------- */
async function beginSeason() {
  GAME.seasonSeed = Date.now() & 0x7fffffff;
  seedRng(GAME.seasonSeed);
  Generator.usedNames.clear();
  Challenges.reset(); NpcAlliances.reset(); PlayerAlliances.reset(); Lying.reset(); PlayerSecrets.reset(); Coalitions.reset();
  /* Everything else with per-season state. Missing one of these is how a new
     season inherits the last one's idols, blocs or spent dialogue pools. */
  NpcBlocs.reset(); Idols.reset(); Whisper.reset(); Dilemmas.resetSeason();
  /* Topics and lines are spent per season, so a new season gets the whole pool
     back. Missing this is how season two ends up with nothing left to ask. */
  if (typeof TribalQA !== 'undefined') TribalQA.reset();
  if (typeof Rewards !== 'undefined') Rewards.reset();
  if (typeof BlocTalk !== 'undefined') BlocTalk.reset();
  if (typeof Whispers !== 'undefined') Whispers.reset();
  Object.assign(GAME, {
    day: 1, hoursRemaining: CONFIG.hoursPerDay, merged: false, swapped: false,
    playerEliminated: false, eliminatedPreFinal: [], jury: [], totalEliminated: 0,
    tribalLog: [], sharedWins: [], voteHistory: [], namedResponses: [], todayImmune: null, stormDouble: false, watchMode: false, seasonActive: true,
    intel: [],
    /* GAME.winner was NOT reset here, and Report.outcome() reads it first. So the
       day-one report of a brand new season announced the PREVIOUS season's result:
       a fresh cast with eighteen people alive on day one, headed "lost — Betty
       won", where Betty was somebody from the season before and not in the cast at
       all. Caught in a real playtest report. */
    winner: null,
    lastReward: null, rewardEffects: [], rewardTickedDay: 0,
    lastEliminatedName: null, lastVoteWentMyWay: null, gotVotesLastTribal: false
  });

  // player
  const p = new Castaway($('create-name').value.trim() || Generator.generateName(CREATE.gender));
  p.isPlayer = true;
  p.gender = CREATE.gender;
  p.age = Generator.rollAge();
  p.occupation = OCCUPATIONS[CREATE.occIdx];
  p.stats = CREATE.stats; p.cluster = CREATE.cluster;
  const sex = CREATE.gender === 'Male' ? 'male' : CREATE.gender === 'Female' ? 'female' : (CREATE.previewSex || 'female');
  p.bodyKey = sex + '_' + CREATE.build;
  p.skinIdx = CREATE.skinIdx; p.outfitIdx = 3; p.heightTier = 1;
  Generator.usedNames.add(p.name);

  // 17 NPCs, one may be returning
  const cast = [];
  let hasReturning = false;
  const usedOutfits = new Set([3]);
  for (let i = 0; i < 17; i++) {
    let npc = null;
    if (!hasReturning) { npc = Returning.tryGet(); if (npc) hasReturning = true; }
    if (!npc) npc = Generator.generateCastaway();  // rolls gender, then a matching name
    Generator.assignVisuals(npc, usedOutfits);
    cast.push(npc);
  }
  cast.splice(ri(0, cast.length + 1), 0, p);
  shuffle(cast);
  cast.forEach((c, i) => c.tribeName = i < 9 ? 'Tidal' : 'Ember');
  GAME.cast = cast; GAME.player = p;
  computeDisplayNames(cast);
  initializeRelationships(cast);
  Fire.seed(cast);
  /* The camp starts rough — day one is a bare beach and a pile of nothing. */
  GAME.camp = { firewood: 0.30, water: 0.28, food: 0.30, shelter: 0.20, clean: 0.55 };
  GAME.campFire = 0.25;
  GAME.lastNight = null; GAME.lastNightBig = false;
  CampNeeds.ensure();
  CallOut.reset();
  Exits.reset();
  Report.reset();
  Telemetry.cfg.gistId = '';        // a new season gets its own gist
  Telemetry.save();
  for (const c of cast) { ethicOf(c); Ledger.ensure(c); }

  toast('Meeting your tribe…');
  await buildAllSprites();
  Beach.reset();
  Feed.clear();
  /* The marooning: Peff works the line before anyone reaches camp. First
     impressions here set the opening relationships. */
  await Marooning.run(cast);
  Feed.post(`Season begins. ${p.displayName} joins tribe ${p.tribeName}.`, 'good', 1);
  if (hasReturning) {
    const ret = cast.find(c => c.isReturning);
    if (ret) Feed.post(`${ret.displayName} is BACK — a returning player walks among you.`, 'drama', 1);
  }
  GAME.hoursRemaining -= CONFIG.day1ArrivalHold;
  Save.write();
  enterCamp();
  runMorning();
}

/* ---------------- Camp rendering ---------------- */
function enterCamp() {
  Screens.replace('screen-camp');
  renderHUD(); renderLineup(); renderActions();
  setTimeout(() => Beach.camToPlayer(true), 80);
  Tutorial.maybeIntro();
}

function renderHUD() {
  $('hud-day').textContent = `Day ${GAME.day}`;
  GAME.phase = phaseOf();
  /* Name whose council it is, so a tribal day the player sits out reads clearly. */
  const faces = playerFacesTribal();
  const tribalNote = !isTribalDay(GAME.day) ? ''
    : faces === true ? ' — your tribal tonight'
    : faces === null ? ' — tribal tonight'
    : ` — ${GAME.todayLosingTribe} votes tonight`;
  $('hud-phase').textContent = `${GAME.phase}${tribalNote} · ${Math.max(0, GAME.hoursRemaining).toFixed(1)}h`;
  /* Condition, so hunger/fatigue/morale are things you watch rather than
     invisible numbers that quietly ruin your challenges. */
  const P = GAME.player;
  const cond = $('hud-cond');
  if (cond) {
    const hun = Math.round(P.hunger * 100), fat = Math.round(P.fatigue * 100);
    cond.innerHTML = '';
    const chip = (txt, cls) => { const e = h('span', 'chip ' + cls, txt); cond.appendChild(e); };
    /* Only what needs attention. On a landscape phone this row is the most
       expensive real estate in the game, and "Fed 100%" is not news — a full
       readout with meters lives one tap away in the camp menu. Morale always
       shows because it is the headline your castaway is playing through. */
    if (hun >= 30) chip('Fed ' + (100 - hun), hun > 70 ? 'bad' : hun > 45 ? 'warn' : 'good');
    if (fat >= 30) chip('Rest ' + (100 - fat), fat > 70 ? 'bad' : fat > 45 ? 'warn' : 'good');
    chip(Morale.label(P.morale), P.morale < 0.35 ? 'bad' : P.morale < 0.55 ? 'warn' : 'good');
    /* The camp's worst problem, so it is something you watch rather than
       something you discover after a bad night. */
    const w = CampNeeds.worst();
    if (w.need && w.severity > 0.28) {
      chip(w.need.short + ' ' + CampNeeds.label(w.need.id), w.severity > 0.62 ? 'bad' : 'warn');
    }
  }
  const wx = $('hud-weather');
  wx.textContent = Weather.icon();
  wx.className = 'chip wx-' + Weather.today.toLowerCase();
  const tr = $('hud-tribe');
  /* Colour and mark together, always. The merge gets its own colour rather than
     borrowing Ember's, so it reads as a change of state. */
  const tName = GAME.merged ? 'Solara' : GAME.player.tribeName;
  tr.textContent = Tribes.label(tName);
  tr.className = 'chip tribe-chip';
  Tribes.mark(tr, tName);
  $('btn-alliances').classList.toggle('hidden', !Tutorial.unlocked('alliance'));
  $('btn-intel').classList.toggle('hidden', !Tutorial.unlocked('scheme'));
  Beach.night(GAME.phase === 'Night');
  Beach.storm(Weather.today === 'Stormy');
}

function renderLineup() {
  Beach.sync();
}

function renderActions() {
  const bar = $('action-bar');
  bar.innerHTML = '';
  const mk = (label, cls, fn, disabled) => {
    const b = h('button', 'btn ' + cls, label);
    if (disabled) b.disabled = true;
    b.addEventListener('click', fn);
    bar.appendChild(b);
    return b;
  };
  if (GAME.playerEliminated || GAME.watchMode) {
    mk('Watch the rest of the season', 'ember', watchRestOfSeason);
    return;
  }
  const night = phaseOf() === 'Night';
  const talkBtn = mk('Talk', 'primary', pickSomeoneToTalk, night && GAME.hoursRemaining <= 0);
  mk('Wander · 0.5h', 'ocean', () => doWander(), GAME.hoursRemaining < CONFIG.wanderTimeCost);
  mk('Camp', 'sand', openCampMenu, false);
  /* The circle is only a button when you actually have one. A permanently
     greyed-out "Pact" would just be a nag. */
  const myCircle = Coalitions.active(GAME.player.name);
  if (myCircle) {
    const cast = GAME.cast;
    const seen = (myCircle.visibility || 0) > CONFIG.circleNoticedAbove;
    mk('Pact' + (seen ? ' ⚠' : '') + ' · 1h', 'violet',
      () => CircleMeeting.start(),
      GAME.hoursRemaining < CONFIG.circleReadsHours);
  }
  if (Tutorial.unlocked('observe')) {
    mk('Observe · 1h', 'sand', pickSomeoneToObserve, GAME.hoursRemaining < CONFIG.observeTimeCost);
  } else {
    mk('Observe · locked', 'sand', () => {}, true);
  }
  /* Only offer "Go to Tribal" when the player is actually going. When the other
     tribe lost, their night ends normally — it is their council, not yours. */
  const faces = playerFacesTribal();
  const label = night
    ? (faces === true ? 'Go to Tribal' : faces === null ? 'End Day — Tribal Tonight' : 'Sleep')
    : (faces === true ? 'End Day — Tribal Tonight'
      : faces === null ? 'End Day — Tribal Tonight' : 'End Day');
  const endBtn = mk(label, faces === false ? '' : (isTribalDay(GAME.day) ? 'danger' : ''), endDay);
  if (Tutorial.active()) {
    talkBtn.classList.toggle('tut-pulse', Tutorial.stage <= 1);
    endBtn.classList.toggle('tut-pulse', Tutorial.stage === 4);
  }
}

/* ---------------- Time ---------------- */
function consumeTime(hours) {
  if (!GAME.seasonActive || GAME.playerEliminated) return;
  const before = phaseOf();
  GAME.hoursRemaining = Math.max(0, GAME.hoursRemaining - hours);
  const lines = advanceSocialTime(hours, GAME.cast, GAME.merged);
  lines.slice(0, 2).forEach(l => Feed.post(l.text, l.kind, GAME.day));
  const after = phaseOf();
  if (after !== before) {
    SocialDynamics.onPhaseAdvance(alive());
    if (after === 'Night' && isTribalDay(GAME.day) && !GAME.probeDoneToday) tryNpcProbe();
  }
  /* The island acts on you between your own actions. Dilemmas first — if one
     fires it takes the moment, so you never get two interruptions at once. */
  Morale.tick(alive());
  Shocks.check();
  if (!Dilemmas.maybeFire()) maybeNpcApproach();
  renderHUD(); renderActions(); renderLineup();
}

/* ---------------- Player intel (what YOU know about their votes) ---------------- */
function addIntel(who, kind, target, note) {
  GAME.intel.push({ who, kind, target: target || null, note: note || '', day: GAME.day });
  while (GAME.intel.length > 60) GAME.intel.shift();
}
/* Did the player actually HEAR `who` name `target`? Only what the player has
   genuinely learned counts — never the raw sim state — so a warning is only
   "true" if there is real intel behind it. */
function intelSaysNamed(whoName, targetName) {
  for (let i = GAME.intel.length - 1; i >= 0; i--) {
    const e = GAME.intel[i];
    if (e.who === whoName && e.target === targetName &&
      ['claim', 'agreed', 'observe', 'overhear', 'heat', 'pastvote'].includes(e.kind)) return e;
  }
  return null;
}

function intelLatestVoteRead(name) {
  for (let i = GAME.intel.length - 1; i >= 0; i--) {
    const e = GAME.intel[i];
    if (e.who === name && ['claim', 'agreed', 'observe', 'overhear'].includes(e.kind) && e.target) {
      const t = GAME.cast.find(c => c.name === e.target);
      if (t && !t.eliminated) return e;
    }
  }
  return null;
}

/* ---------------- Talk / dialogue ---------------- */
let DLG = { npc: null };

function pickSomeoneToTalk() {
  const pool = campmates(GAME.player).filter(c => !c.isPlayer);
  openCastPicker('Talk to whom?', pool, c => { Modal.close(); goTalkTo(c); });
}

function bondTrustBars(c) {
  const wrap = h('div', 'cc-bars');
  const mk = (label, val, cls) => {
    const row = h('div', 'cc-bar-row');
    row.appendChild(h('span', 'cc-bar-label', label));
    const m = h('div', 'meter' + cls + (val < 0.3 ? ' low' : ''));
    m.appendChild(h('i'));
    m.lastChild.style.width = pct(val);
    row.appendChild(m);
    return row;
  };
  wrap.appendChild(mk('Bond', c.getRel(GAME.player.name), ''));
  wrap.appendChild(mk('Trust', c.getTrust(GAME.player.name), ' trust'));
  return wrap;
}

function castCard(c, sub, subCls) {
  const card = h('div', 'cast-card');
  /* A coloured spine down the card. On a vote screen full of faces the tribe is
     the fastest thing to read, and post-swap it is the thing you most need. */
  Tribes.mark(card, c.tribeName);
  const port = h('div', 'portrait');
  const img = document.createElement('img');
  img.src = c.spriteURL || '';
  port.appendChild(img);
  card.appendChild(port);
  card.appendChild(h('div', 'cc-name', c.displayName));
  card.appendChild(h('div', 'cc-sub' + (subCls ? ' ' + subCls : ''), sub));
  if (!c.isPlayer) card.appendChild(bondTrustBars(c));
  /* Immunity, on every card everywhere.

     It started as a ballot-only marker, but immunity is the single most important
     fact about a castaway on the day they hold it and it was invisible in the two
     places you do your thinking: the bonds menu and the name pickers you use when
     you are discussing the vote. Putting it in castCard rather than at each call
     site means it cannot be missing from one of them — the same reason Tribes.mark
     lives here.

     `has-immunity` only draws the stamp. Dimming and disabling is `immune-card`,
     which the ballot adds separately, because on the bonds menu immunity is
     information and not a restriction. */
  if (typeof GAME !== 'undefined' && GAME.todayImmune === c) {
    card.classList.add('has-immunity');
    card.appendChild(h('div', 'cc-immune', 'IMMUNE'));
  }
  return card;
}

/* subClsFn lets a picker colour its subtitle — used to mark which claims are
   backed by real intel and which would be invented. */
function openCastPicker(title, pool, onPick, subFn, subClsFn, note) {
  const wrap = h('div', 'col');
  if (note) wrap.appendChild(h('div', 'tiny dim', note));
  const grid = h('div', 'cast-grid');
  grid.style.padding = '4px 0';
  for (const c of pool) {
    const card = castCard(c, subFn ? subFn(c) : c.occupation, subClsFn ? subClsFn(c) : '');
    card.addEventListener('click', () => onPick(c));
    grid.appendChild(card);
  }
  wrap.appendChild(grid);
  Modal.open(title, wrap);
}

function goTalkTo(npc) {
  if (GAME.playerEliminated || !GAME.seasonActive) return;
  DBG.action('Talk to', npc.displayName,
    `bond=${npc.getRel(GAME.player.name).toFixed(2)} trust=${npc.getTrust(GAME.player.name).toFixed(2)} cluster=${npc.cluster} morale=${npc.morale.toFixed(2)}`);
  Beach.travelToNpc(npc, () => openTalkMenu(npc));
}

function openTalkMenu(npc) {
  DLG.npc = npc;
  $('dlg-portrait').querySelector('img').src = npc.spriteURL || '';
  $('dlg-speaker').textContent = `${npc.displayName} · ${npc.occupation}`;
  $('dialogue-layer').classList.add('open');
  /* Somebody who has not eaten in three days does not open with small talk.
     Falls through to the ordinary banded greeting when they are basically fine. */
  typeText($('dlg-text'), CampLines.stateGreeting(npc)
    || Voice.line('greet', npc, { fallback: DIALOGUE.greetings }));
  renderTalkChoices(npc);
  Tutorial.tip('talk', 'How talking works',
    'Start with BOND — friendly choices raise their bond and trust. Careful: pestering the same person over and over makes them suspicious.');
}

function closeDialogue() {
  $('dialogue-layer').classList.remove('open');
  renderHUD(); renderActions(); renderLineup();
}
/* Tap anywhere outside the dialogue box to walk away */
$('dialogue-layer').addEventListener('click', e => {
  if (e.target.id === 'dialogue-layer') closeDialogue();
});

function dlgChoice(label, fn, cost) {
  const b = h('button', 'btn', label + (cost ? `  ·  ${cost}h` : ''));
  if (cost && GAME.hoursRemaining < cost) b.disabled = true;
  b.addEventListener('click', fn);
  return b;
}

function lockedChoice(label) {
  const b = h('button', 'btn', label + '  ·  locked');
  b.disabled = true;
  return b;
}

/* ============================================================
   "My name was on the line" — responding to votes against you.
   Surviving a council with your name read out is the most charged moment the
   game has, and it used to pass in silence. Five ways to answer it, each with a
   different cost: ask, confront, absolve, threaten, or use it with an ally.
   ============================================================ */

/* Votes against the player at the last council they actually SAT AT — you only
   know who wrote your name because you watched the reveal. Stale after a day. */
function votesAgainstPlayer() {
  for (let i = GAME.voteHistory.length - 1; i >= 0; i--) {
    const h = GAME.voteHistory[i];
    if (!h.witnessed) continue;
    if (GAME.day - h.day > 1) return null;
    const voters = h.votes.filter(([, t]) => t === GAME.player.name).map(([v]) => v);
    return voters.length ? { day: h.day, voters, eliminated: h.eliminated } : null;
  }
  return null;
}
const wroteMyName = name => {
  const v = votesAgainstPlayer();
  return !!v && v.voters.includes(name);
};
const respondKey = (day, name, kind) => `${day}|${name}|${kind}`;
const alreadyResponded = (day, name, kind) => GAME.namedResponses.includes(respondKey(day, name, kind));
const markResponded = (day, name, kind) => GAME.namedResponses.push(respondKey(day, name, kind));

function renderNamedChoices(npc) {
  const v = votesAgainstPlayer();
  const box = $('dlg-choices');
  box.innerHTML = '';
  const add = b => box.appendChild(b);
  const others = v.voters.filter(n => n !== npc.name).length;
  typeText($('dlg-text'), pick(NPC_LINES.namedOpen));
  const mk = (label, kind, fn, cost) => {
    const b = dlgChoice(label, fn, cost);
    if (alreadyResponded(v.day, npc.name, kind)) b.disabled = true;
    add(b);
  };
  mk('“Why my name?”', 'why', () => doAskWhyMe(npc, v), 0.5);
  mk('“You wrote my name.” — make them answer for it', 'confront', () => doConfrontVote(npc, v), 0.5);
  mk('“We are square.” — let it go', 'absolve', () => doAbsolveVoter(npc, v), 0.5);
  mk('“You are on my list now.”', 'mark', () => doMarkVoter(npc, v), 0.5);
  add(dlgChoice(`Back${others ? ` (${others} other${others > 1 ? 's' : ''} wrote it too)` : ''}`,
    () => renderTalkChoices(npc), 0));
}

/* 1. Ask why — cheapest, and points you at whoever started it. */
function doAskWhyMe(npc, v) {
  markResponded(v.day, npc.name, 'why');
  const truth = npcTruthfulness(npc);
  /* Who actually drove it: the highest vote weight on the player among the cast. */
  let instigator = null, best = 0;
  for (const c of alive()) {
    if (c.isPlayer) continue;
    const w = c.getVW(GAME.player.name);
    if (w > best) { best = w; instigator = c; }
  }
  let named = instigator;
  if (truth === 'Lie') {
    const alts = campmates(npc).filter(c => !c.isPlayer && c !== npc && c !== instigator);
    named = alts.length ? pick(alts) : instigator;
  }
  DBG.action('Ask why my name', npc.displayName,
    `truth=${truth} realInstigator=${instigator ? instigator.displayName : 'none'} named=${named ? named.displayName : 'none'}`);
  if (truth === 'Partial' || !named) {
    applyRelTrust(npc, 0.01, 0, false, 'asked why they voted you');
    typeText($('dlg-text'), pick(NPC_LINES.whyMeDodge));
    addIntel(npc.name, 'hedged', null, 'would not say why they wrote you');
  } else {
    addIntel(npc.name, 'heat', named.name, `says ${named.displayName} drove the vote on you`);
    Lying.evaluate(GAME.player, npc, truth, 'TargetInfo', named.name);
    typeText($('dlg-text'), `${Voice.line('whyMeTell', npc, { vars: { sn: named.displayName }, fallback: NPC_LINES.whyMeTell })} (They sound ${npcInfoTone(npc, truth)}.)`);
  }
  DBG.decision('NamedResponse', 'why', { npc: npc.name, truth, named: named ? named.name : null });
  consumeTime(0.5);
  renderNamedChoices(npc);
}

/* 2. Confront — they own it, fold, or deny something you watched happen. */
function doConfrontVote(npc, v) {
  markResponded(v.day, npc.name, 'confront');
  const trust = npc.getTrust(GAME.player.name);
  const allied = PlayerAlliances.level(npc.name) > 0;
  const soft = npc.stats.emotional > 0.55 || trust > 0.55 || allied;
  const denier = ['Paranoid Schemer', 'Villain Arc', 'Strategic Veteran'].includes(npc.cluster) && !soft;
  DBG.action('Confront over vote', npc.displayName, `trust=${trust.toFixed(2)} allied=${allied} soft=${soft} denier=${denier}`);

  if (denier) {
    /* You watched the reveal, so the denial is worthless — and you both know it. */
    npc.addSuspicion(GAME.player.name, 0.10, 'confronted them over a vote');
    npc.addVW(GAME.player.name, 0.4, 'confronted them over a vote');
    GAME.player.addTrust(npc.name, -0.10, 'denied a vote you watched them cast');
    addIntel(npc.name, 'refused', null, 'denied a vote you watched them cast');
    typeText($('dlg-text'), Voice.line('confrontVote', npc, { band: 'cold', fallback: NPC_LINES.confrontVoteDeny }));
    Feed.post(`${npc.displayName} denied writing your name. You were there.`, 'danger', GAME.day);
    DBG.decision('NamedResponse', 'confront:DENIED', { npc: npc.name });
  } else if (soft) {
    /* They fold. Being held to account can actually pull someone closer. */
    applyRelTrust(npc, 0.04, 0.08, false, 'owned up to voting for you');
    npc.addVW(GAME.player.name, -0.5, 'promised not to again');
    if (!allied && trust > 0.5) PlayerAlliances.align(npc.name, GAME.day);
    typeText($('dlg-text'), Voice.line('confrontVote', npc, { fallback: NPC_LINES.confrontVoteFold }));
    Feed.post(`${npc.displayName} owned it. That took something.`, 'good', GAME.day);
    DBG.decision('NamedResponse', 'confront:FOLDED', { npc: npc.name });
  } else {
    /* They own it defiantly. Now it is open war and everyone can see it. */
    applyRelTrust(npc, -0.10, -0.08, false, 'stood by voting for you');
    npc.addVW(GAME.player.name, 0.6, 'stood by voting for you');
    const e = npc.relEntry(GAME.player.name);
    if (e) e.grudge = clamp01(e.grudge + 0.25);
    typeText($('dlg-text'), Voice.line('confrontVote', npc, { fallback: NPC_LINES.confrontVoteOwn }));
    Feed.post(`${npc.displayName} stood by it. That is out in the open now.`, 'drama', GAME.day);
    DBG.decision('NamedResponse', 'confront:OWNED', { npc: npc.name });
  }
  consumeTime(0.5);
  renderNamedChoices(npc);
}

/* 3. Absolve — costs nothing material and buys real loyalty, unless they read
      mercy as weakness. */
function doAbsolveVoter(npc, v) {
  markResponded(v.day, npc.name, 'absolve');
  const cynic = ['Paranoid Schemer', 'Villain Arc', 'Strategic Veteran', 'Bitter Veteran'].includes(npc.cluster);
  DBG.action('Absolve voter', npc.displayName, `cluster=${npc.cluster} cynic=${cynic}`);
  applyRelTrust(npc, CONFIG.absolveRelGain, CONFIG.absolveTrustGain, false, 'let their vote go');
  npc.addVW(GAME.player.name, -CONFIG.absolveVoteWeightRelief, 'you let it go');
  npc.morale = clamp01(npc.morale + 0.06);
  if (cynic) {
    /* Read as an opening rather than grace. */
    npc.addVW(GAME.player.name, 0.25, 'read your mercy as weakness');
    typeText($('dlg-text'), Voice.line('absolve', npc, { band: 'cold', fallback: NPC_LINES.absolveCynic }));
    DBG.decision('NamedResponse', 'absolve:READ-AS-WEAK', { npc: npc.name });
  } else {
    if (PlayerAlliances.level(npc.name) === 0 && npc.getTrust(GAME.player.name) > 0.5)
      PlayerAlliances.align(npc.name, GAME.day);
    typeText($('dlg-text'), Voice.line('absolve', npc, { fallback: NPC_LINES.absolveWarm }));
    Feed.post(`You let ${npc.displayName} off the hook. They will remember that.`, 'good', GAME.day);
    DBG.decision('NamedResponse', 'absolve:GRATEFUL', { npc: npc.name });
  }
  Beach.emote(npc.name, 'wave');
  consumeTime(0.5);
  renderNamedChoices(npc);
}

/* 4. Mark them — a declared vendetta. Rallies anyone who already dislikes them,
      and puts a target on your own back. */
function doMarkVoter(npc, v) {
  markResponded(v.day, npc.name, 'mark');
  DBG.action('Mark voter', npc.displayName, 'declared vendetta');
  applyRelTrust(npc, -0.06, -0.05, false, 'threatened them');
  npc.addVW(GAME.player.name, 0.5, 'you threatened them');
  const e = npc.relEntry(GAME.player.name);
  if (e) e.grudge = clamp01(e.grudge + 0.2);
  PlayerSecrets.add('PushedVote', npc.name, GAME.day);

  /* Anyone already cold on them is happy to pile on; anyone close to them is not. */
  let joined = 0, warned = 0;
  for (const c of alive()) {
    if (c.isPlayer || c === npc) continue;
    if (c.getRel(npc.name) < 0.4 && c.getTrust(GAME.player.name) > 0.35) {
      c.addVW(npc.name, 0.45, 'joined your vendetta');
      joined++;
    } else if (c.getRel(npc.name) > 0.6) {
      c.addVW(GAME.player.name, 0.3, 'you threatened their friend');
      c.addTrust(GAME.player.name, -0.04, 'you threatened their friend');
      warned++;
    }
  }
  DBG.decision('NamedResponse', 'mark', { npc: npc.name, joined, closedRanks: warned });
  typeText($('dlg-text'), Voice.line('markVoter', npc, { fallback: NPC_LINES.markVoter }));
  Feed.post(`You put ${npc.displayName} on notice. ${joined} ${joined === 1 ? 'person' : 'people'} liked hearing it` +
    `${warned ? `, ${warned} did not` : ''}.`, 'drama', GAME.day);
  Beach.emote(npc.name, 'shrug');
  consumeTime(0.5);
  renderNamedChoices(npc);
}

/* 5. Use it with an ally — proof you need protecting. And if THEY were one of
      the names on your ballot, this is where that comes out. */
function doDemandProtection(npc) {
  const v = votesAgainstPlayer();
  if (!v) return;
  markResponded(v.day, npc.name, 'protect');
  const betrayed = v.voters.includes(npc.name);
  DBG.action('Demand protection', npc.displayName, `votesAgainstMe=${v.voters.length} theyVotedMe=${betrayed}`);

  if (betrayed) {
    /* Asking for protection from one of the people who wrote your name. */
    applyRelTrust(npc, -0.08, -0.15, false, 'caught them voting you while allied');
    npc.addSuspicion(GAME.player.name, 0.05, 'called out');
    const a = PlayerAlliances.get(npc.name);
    if (a) a.broken = true;
    GAME.player.addTrust(npc.name, -0.2, 'they wrote your name while allied');
    typeText($('dlg-text'), pick(NPC_LINES.protectBetrayed));
    Feed.post(`${npc.displayName} wrote your name and still called you an ally. That is over.`, 'danger', GAME.day);
    DBG.decision('NamedResponse', 'protect:BETRAYAL EXPOSED', { npc: npc.name });
    consumeTime(0.5);
    renderAllianceChoices(npc);
    return;
  }

  const lvl = PlayerAlliances.level(npc.name);
  const willing = npc.getTrust(GAME.player.name) > 0.45 || lvl >= 2;
  if (willing) {
    applyRelTrust(npc, 0.03, 0.07, false, 'agreed to shield you');
    /* They start looking at the people who came for you. */
    for (const n of v.voters) npc.addVW(n, CONFIG.protectVoteWeightShift, 'they came for your ally');
    npc.addVW(GAME.player.name, -0.4, 'agreed to shield you');
    if (lvl === 0) PlayerAlliances.align(npc.name, GAME.day);
    else if (lvl === 1) PlayerAlliances.promise(npc.name, GAME.day);
    typeText($('dlg-text'), Voice.line('protect', npc, { vars: { n: v.voters.length }, fallback: NPC_LINES.protectYes }));
    Feed.post(`${npc.displayName} is watching the people who came for you.`, 'good', GAME.day);
    DBG.decision('NamedResponse', 'protect:AGREED', { npc: npc.name, shifted: v.voters.length });
  } else {
    npc.addSuspicion(GAME.player.name, 0.05, 'leaned on them for protection');
    typeText($('dlg-text'), Voice.line('protect', npc, { band: 'cold', fallback: NPC_LINES.protectNo }));
    DBG.decision('NamedResponse', 'protect:REFUSED', { npc: npc.name });
  }
  consumeTime(0.5);
  renderAllianceChoices(npc);
}

function renderTalkChoices(npc) {
  const box = $('dlg-choices');
  box.innerHTML = '';
  const add = b => box.appendChild(b);
  /* Top of the list: they wrote your name last night. */
  if (wroteMyName(npc.name))
    add(dlgChoice('⚑ About last night — you wrote my name', () => renderNamedChoices(npc), 0));
  add(dlgChoice('Bond', () => renderBondChoices(npc), 0));
  add(Tutorial.unlocked('scheme') ? dlgChoice('Ask them', () => renderAskChoices(npc), 0) : lockedChoice('Ask them'));
  add(Tutorial.unlocked('scheme') ? dlgChoice('Game talk', () => renderSchemeChoices(npc), 0) : lockedChoice('Game talk'));
  add(Tutorial.unlocked('alliance') ? dlgChoice('Alliance', () => renderAllianceChoices(npc), 0) : lockedChoice('Alliance'));
  add(Tutorial.unlocked('alliance') ? dlgChoice('Risky', () => renderRiskyChoices(npc), 0) : lockedChoice('Risky'));
  add(dlgChoice('Walk away', () => closeDialogue(), 0));
}

function renderBondChoices(npc) {
  const box = $('dlg-choices');
  box.innerHTML = '';
  const add = b => box.appendChild(b);
  add(dlgChoice('Get to know them', () => doBond(npc), CONFIG.personalLifeTopicCost));
  add(dlgChoice('Ask about home', () => doFamily(npc), CONFIG.personalLifeTopicCost));
  add(dlgChoice('Small talk', () => doSmallTalk(npc), CONFIG.personalLifeTopicCost));
  add(dlgChoice('Open up about yourself', () => doOpenUp(npc), CONFIG.personalLifeTopicCost));
  add(dlgChoice('Tell a joke', () => doJoke(npc), CONFIG.funTopicCost));
  add(dlgChoice('Offer help with camp work', () => doOfferHelp(npc), CONFIG.personalLifeTopicCost));
  /* Only offered when it is true, so admitting it is a real disclosure rather
     than a menu item. */
  if (GAME.player.hunger > 0.50)
    add(dlgChoice('Say you are starving', () => doSayHungry(npc), CONFIG.foodTopicCost));
  if (GAME.player.fatigue > 0.50)
    add(dlgChoice('Say you are running on empty', () => doSayTired(npc), CONFIG.foodTopicCost));
  add(dlgChoice('Spend time together', () => doSpendTime(npc), CONFIG.sttTickHours * CONFIG.sttMaxTicks));
  add(dlgChoice('Back', () => renderTalkChoices(npc), 0));
}

function renderAskChoices(npc) {
  Tutorial.tip('ask', 'Asking around',
    'They answer through the same trust math you play by — low-trust and paranoid types lie to you. The tone of the answer is your tell.');
  const box = $('dlg-choices');
  box.innerHTML = '';
  const add = b => box.appendChild(b);
  add(dlgChoice('What are you hearing?', () => doAskHearing(npc), CONFIG.personalLifeTopicCost));
  add(dlgChoice('Who are you thinking of voting?', () => doAskThinking(npc), CONFIG.personalLifeTopicCost));
  add(dlgChoice('What do you make of someone?', () => pickTarget(npc, doAskThinkOf), CONFIG.personalLifeTopicCost));
  add(dlgChoice('How do you find camp?', () => doAskCamp(npc), CONFIG.foodTopicCost));
  /* Only meaningful once a council has actually happened. */
  if (hasTribalHistory() && lastVoteOf(npc.name))
    add(dlgChoice('Who did you vote for last tribal?', () => doAskLastVote(npc), CONFIG.personalLifeTopicCost));
  add(dlgChoice('Back', () => renderTalkChoices(npc), 0));
}

/* ---- Past ballots ----
   Asking about a vote you WITNESSED is a lie detector: they either match the
   reveal or they do not, and the game says so plainly. Asking about a council
   you missed is how you learn what happened at the other tribe. */
function doAskLastVote(npc) {
  const rec = lastVoteOf(npc.name);
  if (!rec) { typeText($('dlg-text'), 'They have not sat at a council yet.'); return; }
  const truth = npcTruthfulness(npc);
  const realDn = dnOf(rec.target);
  let claimed = rec.target;
  if (truth === 'Lie') {
    /* Name someone else who was at that council, so the lie is plausible. */
    const h = GAME.voteHistory.find(x => x.day === rec.day);
    const alts = [...new Set(h.votes.flat())].filter(n => n !== npc.name && n !== rec.target);
    claimed = alts.length ? pick(alts) : rec.target;
  }
  const claimedDn = dnOf(claimed);
  const tone = npcInfoTone(npc, truth);
  DBG.action('Ask last vote', npc.displayName,
    `theirRealVote=${realDn} claimed=${claimedDn} truth=${truth} witnessed=${rec.witnessed}`);

  let line;
  if (truth === 'Partial') {
    line = pick(NPC_LINES.pastVoteDodge);
    addIntel(npc.name, 'hedged', null, 'would not say who they voted');
  } else {
    line = pick(NPC_LINES.pastVoteTell).replace(/\{tn\}/g, claimedDn);
    addIntel(npc.name, 'pastvote', claimed, truth === 'Lie' && rec.witnessed ? 'contradicts the reveal' : `said they voted ${claimedDn}`);
  }
  Lying.evaluate(GAME.player, npc, truth, 'PastVote', claimed);

  /* You sat there. If the story does not match the reveal, you know it. */
  let caught = false;
  if (rec.witnessed && truth === 'Lie') {
    caught = true;
    GAME.player.addTrust(npc.name, -0.12, 'lied about a vote you witnessed');
    Feed.post(`${npc.displayName} says they voted ${claimedDn} — you watched them write ${realDn}.`, 'danger', GAME.day);
  }
  DBG.decision('PastVote', caught ? 'CAUGHT-BY-PLAYER' : truth, { npc: npc.name, real: rec.target, claimed, witnessed: rec.witnessed });

  typeText($('dlg-text'), `${line} (They sound ${tone}.)` +
    (caught ? ` — You were there. That is not the name they wrote.` : ''));
  Tutorial.notify('scheme');
  consumeTime(CONFIG.personalLifeTopicCost);
  renderAskChoices(npc);
}

/* Telling them your own ballot. Honest alignment is worth a lot; lying to
   someone who sat at the same council is a straightforward mistake. */
function shareMyVoteMenu(npc) {
  const mine = lastVoteOf(GAME.player.name);
  if (!mine) { typeText($('dlg-text'), 'You have not voted at a council yet.'); return; }
  const h = GAME.voteHistory.find(x => x.day === mine.day);
  /* Everyone the council involved — voters AND the names written, since the
     person you actually voted for is usually the one who went home and would
     otherwise be missing from the list, leaving you unable to tell the truth. */
  const names = new Set();
  h.votes.forEach(([v, tgt]) => { names.add(v); names.add(tgt); });
  const pool = [...names].map(n => GAME.cast.find(c => c.name === n))
    .filter(c => c && !c.isPlayer && c !== npc);
  const theyWereThere = attendedTribal(mine.day, npc.name);
  openCastPicker('Tell them you voted for…', pool,
    c => { Modal.close(); doShareMyVote(npc, c, mine); },
    c => c.name === mine.target ? '✓ the truth'
      : (theyWereThere ? 'a lie — they were there' : 'a lie'),
    c => c.name === mine.target ? 'intel' : 'invented',
    theyWereThere
      ? `${npc.displayName} sat at that council. They saw the reveal — a false name will not survive.`
      : `${npc.displayName} was not there, so they only have your word for it.`);
}

function doShareMyVote(npc, claim, mine) {
  const honest = claim.name === mine.target;
  const theyWereThere = attendedTribal(mine.day, npc.name);
  const theirVote = lastVoteOf(npc.name);
  const aligned = honest && theirVote && theirVote.day === mine.day && theirVote.target === mine.target;
  DBG.action('Share own vote', npc.displayName,
    `claimed=${claim.displayName} real=${dnOf(mine.target)} honest=${honest} theyWereThere=${theyWereThere} aligned=${aligned}`);

  /* A witness cannot be fooled — the reveal already told them. */
  if (!honest && theyWereThere) {
    npc.addTrust(GAME.player.name, -0.12, 'lied about a vote they witnessed');
    npc.addSuspicion(GAME.player.name, 0.15, 'lied about a vote they witnessed');
    npc.addVW(GAME.player.name, 0.5, 'lied about a vote they witnessed');
    Lying.evaluate(npc, GAME.player, 'Lie', 'PastVote', claim.name);
    DBG.decision('ShareOwnVote', 'CAUGHT-WITNESS', { npc: npc.name, claimed: claim.name });
    typeText($('dlg-text'), pick(NPC_LINES.myVoteBusted).replace(/\{tn\}/g, dnOf(mine.target)));
    Feed.post(`${npc.displayName} was at that council — they know who you wrote.`, 'danger', GAME.day);
    consumeTime(CONFIG.personalLifeTopicCost);
    renderRiskyChoices(npc);
    return;
  }

  const outcome = Lying.evaluate(npc, GAME.player, honest ? 'Truth' : 'Lie', 'PastVote', claim.name);
  DBG.decision('ShareOwnVote', outcome, { npc: npc.name, honest, aligned, claimed: claim.name });
  if (aligned) {
    /* You both wrote the same name and you owned up to it first. */
    applyRelTrust(npc, 0.04, CONFIG.shareVoteAlignedTrust, false, 'admitted a matching vote');
    npc.addVW(GAME.player.name, -0.35, 'you voted together');
    typeText($('dlg-text'), pick(NPC_LINES.myVoteAligned).replace(/\{tn\}/g, dnOf(mine.target)));
  } else if (honest) {
    applyRelTrust(npc, 0.02, CONFIG.shareVoteHonestTrust, false, 'was straight about their vote');
    /* Owning a vote against someone they were close to still stings. */
    if (npc.getRel(mine.target) > 0.55) {
      npc.addTrust(GAME.player.name, -0.05, 'voted someone they liked');
      npc.addVW(GAME.player.name, 0.25, 'voted someone they liked');
    }
    typeText($('dlg-text'), pick(NPC_LINES.myVoteHonest).replace(/\{tn\}/g, dnOf(mine.target)));
  } else if (outcome === 'Caught') {
    npc.addVW(GAME.player.name, 0.4, 'caught lying about their vote');
    typeText($('dlg-text'), pick(NPC_LINES.lieCaught));
  } else {
    npc.addVW(claim.name, 0.3, 'believed you voted them');
    typeText($('dlg-text'), pick(NPC_LINES.myVoteHonest).replace(/\{tn\}/g, claim.displayName));
  }
  PlayerSecrets.add('PushedVote', mine.target, mine.day);
  consumeTime(CONFIG.personalLifeTopicCost);
  renderRiskyChoices(npc);
}

function renderSchemeChoices(npc) {
  Tutorial.tip('scheme', 'Game talk',
    'Game talk moves their VOTE — push a name, plant a seed, spread a rumor. Sharp players catch schemes, and trust drops.');
  const box = $('dlg-choices');
  box.innerHTML = '';
  const add = b => box.appendChild(b);
  add(dlgChoice('Push a vote (name a target)', () => pickTarget(npc, doPushVote), CONFIG.playersTopicCost));
  add(dlgChoice('Plant a quiet seed', () => pickTarget(npc, doPlantSeed), CONFIG.gameTopicCost));
  add(dlgChoice('Read the room with them', () => doReadRoom(npc), CONFIG.personalLifeTopicCost));
  add(dlgChoice('Defend someone', () => pickTarget(npc, doDefend), CONFIG.gameTopicCost));
  add(dlgChoice('Undermine someone', () => pickTarget(npc, doUndermine), CONFIG.personalLifeTopicCost));
  add(dlgChoice('Attack their character', () => pickTarget(npc, doAttack), 0.75));
  add(dlgChoice('Spread a rumor', () => pickTarget(npc, doRumor), CONFIG.playersTopicCost));
  add(dlgChoice('Tell them my vote', () => doTellVote(npc), CONFIG.foodTopicCost));
  add(dlgChoice('Back', () => renderTalkChoices(npc), 0));
}

function renderAllianceChoices(npc) {
  Tutorial.tip('ally', 'Alliances',
    'Align, then Promise, then Lock. Allies shield you at tribal — but locked deals can be seen, and broken promises spread.');
  const box = $('dlg-choices');
  box.innerHTML = '';
  const add = b => box.appendChild(b);
  const lvl = PlayerAlliances.level(npc.name);
  /* Top of the list while it is fresh — this is the beat you want to catch. */
  const win = freshSharedWin(npc.name);
  if (win) add(dlgChoice(`“That ${dnOf(win.target)} vote worked” — celebrate it`,
    () => doCelebrateVote(npc), CONFIG.celebrateTimeCost));
  const vAgainst = votesAgainstPlayer();
  if (vAgainst && !alreadyResponded(vAgainst.day, npc.name, 'protect'))
    add(dlgChoice(`“They came for me last night. I need your word.”`,
      () => doDemandProtection(npc), 0.5));
  if (lvl === 0) add(dlgChoice('Suggest working together', () => doAlign(npc), 0.5));
  if (lvl === 1) add(dlgChoice('Promise the next vote', () => doPromise(npc), 0.5));
  if (lvl >= 1 && lvl < 3) add(dlgChoice('Lock it in (needs trust)', () => doLock(npc), 1));
  add(dlgChoice('Back me up tonight (name a target)', () => pickTarget(npc, doBackMeUp), 0.5));
  const circle = Coalitions.active(GAME.player.name);
  if (lvl >= 1 && !circle) add(dlgChoice('Start a pact (bring a third in)', () => doCircle(npc), 1));
  else if (circle && circle.members.includes(npc.name) && circle.members.length < Coalitions.MAX)
    add(dlgChoice('Grow the pact', () => doCircle(npc), 1));
  else if (circle && !circle.members.includes(npc.name) && lvl >= 1 && circle.members.length < Coalitions.MAX)
    add(dlgChoice('Bring them into the pact', () => doCircle(npc), 1));
  /* This used to be a dead label that did nothing when tapped — the single most
     concrete version of "the pact is unclear". It now walks you to the room. */
  if (circle && circle.members.includes(npc.name)) {
    add(dlgChoice('Get the pact together', () => { closeDialogue(); CircleMeeting.start(); }, 0));
  }
  if (lvl > 0) add(dlgChoice("This isn't working (break it off)", () => doBreakAlliance(npc), 0));
  if (lvl > 0) {
    const names = { 1: 'Aligned', 2: 'Promised', 3: 'Locked' };
    add(dlgChoice(`Current: ${names[lvl]}`, () => {}, 0));
  }
  add(dlgChoice('Back', () => renderTalkChoices(npc), 0));
}

function renderRiskyChoices(npc) {
  Tutorial.tip('risky', 'Risky moves',
    'Sharing a real secret is the biggest trust gain in the game — but schemers file it away. Confronting someone almost always costs you.');
  const box = $('dlg-choices');
  box.innerHTML = '';
  const add = b => box.appendChild(b);
  add(dlgChoice('Share a secret', () => doShareSecret(npc), CONFIG.personalLifeTopicCost));
  add(dlgChoice('Confront them', () => doConfront(npc), CONFIG.personalLifeTopicCost));
  add(dlgChoice('Back', () => renderTalkChoices(npc), 0));
}

function pickTarget(npc, fn) {
  const pool = campmates(npc)
    .filter(c => c !== npc && c !== GAME.player);
  openCastPicker('About whom?', pool, t => { Modal.close(); fn(npc, t); });
}

/* Diminishing returns + overtalk (ChatWindow.ApplyRelTrust port) */
function applyRelTrust(npc, relD, trustD, reciprocal, src) {
  npc.playerConvosThisPhase++;
  const n = npc.playerConvosThisPhase;
  const mult = n <= 2 ? 1.0 : n === 3 ? 0.6 : n === 4 ? 0.3 : 0.1;
  const why = `${src || 'conversation'} (convo #${n}, x${mult})`;
  npc.addRel(GAME.player.name, relD * mult, why);
  npc.addTrust(GAME.player.name, trustD * mult, why);
  if (n >= 4 && chance(n === 4 ? 0.25 : 0.5)) {
    npc.addTrust(GAME.player.name, -0.04, 'overtalked - suspicious');
    Feed.post(DIALOGUE.feedStrings.overtalk.replace('{name}', npc.displayName), 'danger', GAME.day);
  }
  if (reciprocal && relD !== 0) GAME.player.addRel(npc.name, relD * 0.5, 'reciprocal');
}

function doBond(npc) {
  const rel = npc.getRel(GAME.player.name);
  let relD, trustD, line;
  /* Deltas still follow morale and bond; the WORDS follow how they feel about you. */
  if (npc.morale < 0.35) { relD = 0.02; trustD = 0.01; line = pick(NPC_LINES.bondLowMorale); }
  else if (rel > 0.65) { relD = 0.06; trustD = 0.03; line = Voice.line('bond', npc, { fallback: NPC_LINES.bondHigh }); }
  else if (rel >= 0.35) { relD = 0.03; trustD = 0.01; line = Voice.line('bond', npc, { fallback: NPC_LINES.bondMid }); }
  else { relD = 0.01; trustD = 0; line = Voice.line('bond', npc, { fallback: NPC_LINES.bondCold }); }
  applyRelTrust(npc, relD, trustD, true);
  typeText($('dlg-text'), line);
  Tutorial.notify('friendly', npc);
  consumeTime(CONFIG.personalLifeTopicCost);
  renderBondChoices(npc);
}

function doFamily(npc) {
  const groupA = ['Fan Favorite', 'Emotional Wildcard', 'Social Butterfly', 'Loyal Follower'];
  const groupB = ['Loyal Soldier', 'Camp Provider', 'Reluctant Hero', 'Physical Threat'];
  const groupC = ['Natural Leader', 'Under The Radar'];
  const groupD = ['Strategic Veteran', 'Paranoid Schemer', 'Bitter Veteran'];
  let relD = 0.04, trustD = 0.02;
  if (groupA.includes(npc.cluster)) { relD = 0.08; trustD = 0.05; }
  else if (groupB.includes(npc.cluster)) { relD = 0.06; trustD = 0.03; }
  else if (groupC.includes(npc.cluster)) { relD = 0.04; trustD = 0.02; }
  else if (groupD.includes(npc.cluster)) { relD = 0.02; trustD = 0.01; }
  else if (['Villain Arc', 'Chaos Agent'].includes(npc.cluster)) { relD = 0.01; trustD = 0; }
  const mems = NPC_LINES.famMems;
  let line;
  const known = npc.memories.find(m => m.startsWith('family:'));
  if (known) line = pick(NPC_LINES.famKnown).replace('{mem}', known.slice(7));
  else {
    const mem = pick(mems);
    if (npc.memories.length < 3) npc.memories.push('family:' + mem);
    line = pick(relD >= 0.06 ? NPC_LINES.famFirstDeep : NPC_LINES.famFirstGuard).replace('{mem}', mem);
  }
  applyRelTrust(npc, relD, trustD, true);
  typeText($('dlg-text'), line);
  Tutorial.notify('friendly', npc);
  consumeTime(CONFIG.personalLifeTopicCost);
  renderBondChoices(npc);
}

function doJoke(npc) {
  const receptive = npc.stats.emotional > 0.6;
  let relD, trustD, line;
  if (receptive) {
    relD = ['Chaos Agent', 'Fan Favorite'].includes(npc.cluster) ? 0.08 : 0.06;
    trustD = 0.02;
    line = pick(NPC_LINES.jokeHit);
  } else {
    relD = 0.02;
    trustD = ['Paranoid Schemer', 'Bitter Veteran', 'Villain Arc'].includes(npc.cluster) ? -0.01 : 0;
    line = pick(NPC_LINES.jokeMiss);
  }
  applyRelTrust(npc, relD, trustD, true);
  typeText($('dlg-text'), line);
  Tutorial.notify('friendly', npc);
  consumeTime(CONFIG.funTopicCost);
  renderBondChoices(npc);
}

function doSpendTime(npc) {
  // 3 ticks x 1h, with STT chance events
  const cost = CONFIG.sttTickHours * CONFIG.sttMaxTicks;
  if (GAME.hoursRemaining < cost) { typeText($('dlg-text'), 'Not enough daylight left for that.'); return; }
  const persMult = {
    'Social Butterfly': 1.3, 'Fan Favorite': 1.3, 'Loyal Soldier': 1.1, 'Loyal Follower': 1.1,
    'Natural Leader': 1.0, 'Emotional Wildcard': 1.0, 'Camp Provider': 0.9, 'Reluctant Hero': 0.9,
    'Strategic Veteran': 0.7, 'Villain Arc': 0.7, 'Paranoid Schemer': 0.5, 'Bitter Veteran': 0.5,
    'Chaos Agent': 0.8, 'Under The Radar': 0.8, 'Physical Threat': 0.9
  }[npc.cluster] || 1.0;
  let relTotal = 0;
  for (let tick = 0; tick < CONFIG.sttMaxTicks; tick++) {
    let relGain = CONFIG.sttBaseRelPerTick * persMult;
    if (npc.morale > 0.5 && GAME.player.morale > 0.5) relGain += 0.005;
    npc.addRel(GAME.player.name, relGain);
    npc.addTrust(GAME.player.name, CONFIG.sttBaseTrustPerTick * persMult);
    relTotal += relGain;
    if (chance(CONFIG.sttSeenTogetherChance)) {
      const observers = campmates(npc).filter(c => c !== npc && c !== GAME.player && c.stats.gameAwareness > 0.6);
      if (observers.length) {
        const obs = pick(observers);
        obs.addVW(GAME.player.name, 0.1, 'seen scheming together'); obs.addVW(npc.name, 0.1, 'seen scheming together');
        Feed.post(DIALOGUE.feedStrings.seenTogether.replace('{obs}', obs.displayName).replace('{npc}', npc.displayName), 'drama', GAME.day);
      }
    } else if (chance(CONFIG.sttOverhearChance)) {
      // passive intel: overhear a nearby tribemate's lean (STT overhear port)
      const others = campmates(GAME.player).filter(c => c !== npc && !c.isPlayer);
      if (others.length) {
        const o = pick(others);
        const lean = o.topVoteTarget(campmates(o));
        if (lean.target && lean.weight > 0.3) {
          addIntel(o.name, 'overhear', lean.target.name);
          Feed.post(`You overhear: ${o.displayName} keeps coming back to ${lean.target.displayName}.`, 'drama', GAME.day);
        } else {
          Feed.post(DIALOGUE.feedStrings.overhear, '', GAME.day);
        }
      }
    } else if (chance(CONFIG.sttQuietMomentChance)) {
      npc.addRel(GAME.player.name, 0.03); npc.addTrust(GAME.player.name, 0.01);
      Feed.post(DIALOGUE.feedStrings.quietMoment.replace('{npc}', npc.displayName), 'good', GAME.day);
    } else if (chance(CONFIG.sttAwkwardSilenceChance)) {
      Feed.post(DIALOGUE.feedStrings.awkward, '', GAME.day);
    }
  }
  typeText($('dlg-text'), Voice.line('stt', npc,
    { fallback: relTotal > 0.05 ? NPC_LINES.sttGood : NPC_LINES.sttOk }));
  Tutorial.notify('friendly', npc);
  consumeTime(cost);
  renderBondChoices(npc);
}

function doPushVote(npc, target) {
  const trustBefore = npc.getTrust(GAME.player.name);
  const receptive = trustBefore > 0.5;
  const tn = target.displayName;
  DBG.action('Push vote', npc.displayName, `target=${tn} trustInPlayer=${trustBefore.toFixed(2)} receptive=${receptive}`);
  if (receptive) {
    npc.addVW(target.name, CONFIG.talkAboutPushVoteWeight, 'player pushed this name');
    applyRelTrust(npc, 0, 0.02, false);
    // the mirror of vouching: naming someone cools the listener on them
    npc.addTrust(target.name, -CONFIG.badmouthTrustLoss, 'player pushed a vote onto them');
    addIntel(npc.name, 'agreed', target.name);
    typeText($('dlg-text'), Voice.line('pushYes', npc,
      { toward: target.name, vars: { tn }, fallback: NPC_LINES.pushYes }));
  } else {
    npc.addVW(target.name, 0.3, 'player pushed this name (resisted)');
    applyRelTrust(npc, 0, -0.04, false);
    typeText($('dlg-text'), Voice.line('pushNo', npc,
      { toward: target.name, vars: { tn }, fallback: NPC_LINES.pushNo }));
  }
  Lying.evaluate(npc, GAME.player, 'Truth', 'VoteIntent', target.name);
  PlayerSecrets.add('PushedVote', target.name, GAME.day);
  // deeply resistant listeners warn the target (WarnTarget port)
  if (trustBefore < 0.35) target.addTrust(GAME.player.name, -CONFIG.talkAboutWarnTrustHit);
  checkGossipBack(npc, target);
  Tutorial.notify('scheme');
  consumeTime(CONFIG.playersTopicCost);
  renderSchemeChoices(npc);
}

function doPlantSeed(npc, target) {
  const caught = npc.stats.gameAwareness > 0.65;
  DBG.action('Plant seed', npc.displayName, `target=${target.displayName} ga=${npc.stats.gameAwareness.toFixed(2)} caught=${caught}`);
  const tn = target.displayName;
  if (caught) {
    applyRelTrust(npc, -0.01, ['Paranoid Schemer', 'Strategic Veteran'].includes(npc.cluster) ? -0.05 : -0.03, false);
    typeText($('dlg-text'), pick(NPC_LINES.seedCaught));
  } else {
    npc.addVW(target.name, CONFIG.talkAboutPlantSeedVoteWeight, 'you planted the idea');
    applyRelTrust(npc, 0.01, ['Social Butterfly', 'Fan Favorite'].includes(npc.cluster) ? 0.02 : 0.01, false);
    typeText($('dlg-text'), pick(NPC_LINES.seedTook).replace('{tn}', tn));
  }
  PlayerSecrets.add('PlantedSeed', target.name, GAME.day);
  Tutorial.notify('scheme');
  consumeTime(CONFIG.gameTopicCost);
  renderSchemeChoices(npc);
}

function doDefend(npc, target) {
  DBG.action('Defend someone', npc.displayName, `subject=${target.displayName}`);
  npc.addVW(target.name, CONFIG.talkAboutDefendVoteWeight, 'player defended them');
  const allied = npc.getTrust(GAME.player.name) > 0.6;
  applyRelTrust(npc, allied ? 0.05 : 0.02, allied ? 0.03 : 0.01, false);
  /* Vouching moves how the LISTENER sees the person defended — the player's only
     lever on NPC-to-NPC warmth, and what makes a cold circle pairing fixable.
     Weighted by how much they trust you: your word is worth what you are. */
  const weight = 0.5 + npc.getTrust(GAME.player.name);
  npc.addTrust(target.name, CONFIG.vouchTrustGain * weight, `player vouched for them`);
  npc.addRel(target.name, CONFIG.vouchRelGain * weight, `player vouched for them`);
  typeText($('dlg-text'), Voice.line('defend', npc,
    { toward: target.name, vars: { tn: target.displayName }, fallback: NPC_LINES.defendOk }));
  Tutorial.notify('scheme');
  consumeTime(CONFIG.gameTopicCost);
  renderSchemeChoices(npc);
}

function doRumor(npc, target) {
  const caught = npc.stats.gameAwareness > 0.65;
  DBG.action('Spread rumor', npc.displayName, `target=${target.displayName} ga=${npc.stats.gameAwareness.toFixed(2)} caught=${caught}`);
  if (caught) {
    applyRelTrust(npc, -0.02, ['Paranoid Schemer', 'Strategic Veteran'].includes(npc.cluster) ? -0.07 : -0.05, false);
    target.addTrust(GAME.player.name, -CONFIG.talkAboutWarnTrustHit);
    typeText($('dlg-text'), pick(NPC_LINES.rumorCaught));
    Feed.post(DIALOGUE.feedStrings.gossipBack.replace('{name}', npc.displayName).replace('{target}', target.displayName), 'danger', GAME.day);
  } else {
    npc.addVW(target.name, CONFIG.talkAboutRumorVoteWeight, 'a rumour you spread');
    applyRelTrust(npc, 0.01, 0.01, false);
    const line = (npc.cluster === 'Chaos Agent' ? pick(NPC_LINES.rumorChaos) : pick(NPC_LINES.rumorSpread)).replace('{tn}', target.displayName);
    typeText($('dlg-text'), line);
    checkGossipBack(npc, target);
  }
  PlayerSecrets.add('SpreadRumor', target.name, GAME.day);
  Tutorial.notify('scheme');
  consumeTime(CONFIG.playersTopicCost);
  renderSchemeChoices(npc);
}

function checkGossipBack(npc, target) {
  const gossipChance = clamp01(npc.stats.relational * 0.3 + Math.max(0, npc.getTrust(target.name) - npc.getTrust(GAME.player.name)) * 0.4);
  if (chance(gossipChance)) {
    target.addTrust(GAME.player.name, -CONFIG.talkAboutWarnTrustHit);
    Feed.post(DIALOGUE.feedStrings.gossipBack.replace('{name}', npc.displayName).replace('{target}', target.displayName), 'danger', GAME.day);
  }
}

function doTellVote(npc) {
  const box = $('dlg-choices');
  box.innerHTML = '';
  const add = b => box.appendChild(b);
  const pool = campmates(GAME.player).filter(c => !c.isPlayer && c !== npc);
  add(dlgChoice('Tell the truth — name my real target', () => {
    openCastPicker('Who are you really on?', pool, t => { Modal.close(); tellVoteAs(npc, t, 'Truth'); });
  }, 0));
  add(dlgChoice('Feed them a decoy', () => {
    openCastPicker('Name the decoy:', pool, t => { Modal.close(); tellVoteAs(npc, t, 'Lie'); });
  }, 0));
  add(dlgChoice('Back', () => renderSchemeChoices(npc), 0));
}

function tellVoteAs(npc, target, truth) {
  const outcome = Lying.evaluate(npc, GAME.player, truth, 'VoteIntent', target.name);
  if (outcome === 'Believed') npc.addVW(target.name, truth === 'Truth' ? 0.15 : 0.12, 'a secret you shared');
  else if (outcome === 'Doubted') { npc.addVW(target.name, 0.05, 'a secret you shared'); npc.addVW(GAME.player.name, 0.20, 'they doubted your story'); }
  else npc.addVW(GAME.player.name, 0.40, 'they caught you lying');
  typeText($('dlg-text'), `"${target.displayName}." — ${pick(DIALOGUE.probeReact[outcome])}`);
  Tutorial.notify('scheme');
  consumeTime(CONFIG.foodTopicCost);
  renderSchemeChoices(npc);
}

function doAlign(npc) {
  PlayerAlliances.align(npc.name, GAME.day);
  PlayerSecrets.add('Alliance', npc.name, GAME.day);
  applyRelTrust(npc, 0.04, 0.06, true);
  Tutorial.notify('align');
  typeText($('dlg-text'), Voice.line('align', npc, {
    fallback: (npc.cluster === 'Loyal Soldier' || npc.cluster === 'Loyal Follower')
      ? NPC_LINES.alignLoyal : NPC_LINES.alignStd }));
  consumeTime(0.5);
  renderAllianceChoices(npc);
}

function doPromise(npc) {
  PlayerAlliances.promise(npc.name, GAME.day);
  applyRelTrust(npc, 0.06, 0.08, true);
  typeText($('dlg-text'), Voice.line('promise', npc, { fallback: NPC_LINES.promiseOk }));
  consumeTime(0.5);
  renderAllianceChoices(npc);
}

function doLock(npc) {
  if (npc.getTrust(GAME.player.name) <= 0.6) {
    typeText($('dlg-text'), pick(NPC_LINES.lockRefuse));
    return;
  }
  PlayerAlliances.lock(npc.name);
  applyRelTrust(npc, 0.10, 0.12, true);
  // observer risk
  const observers = campmates(npc).filter(c => c !== npc && c !== GAME.player && c.stats.gameAwareness > 0.65);
  for (const obs of observers) {
    if (chance(0.4)) {
      obs.addVW(GAME.player.name, 0.8, 'overheard you attacking someone');
      obs.addVW(npc.name, 0.6, 'overheard them attacking someone');
      Feed.post(DIALOGUE.feedStrings.lockObserved.replace('{obs}', obs.displayName), 'drama', GAME.day);
      break;
    }
  }
  typeText($('dlg-text'), pick(npc.cluster === 'Emotional Wildcard' ? NPC_LINES.lockEmo : NPC_LINES.lockStd));
  consumeTime(1);
  renderAllianceChoices(npc);
}

/* ============================================================
   Action Wheel port — the verbs the Unity wheel had that the
   first web pass cut. Deltas match ActionWheel.cs / ChatWindow.cs.
   ============================================================ */

/* ---- Bond additions ---- */
function doSmallTalk(npc) {
  let line;
  if (npc.hunger > 0.6) {
    npc.morale = clamp01(npc.morale + 0.02);
    GAME.player.morale = clamp01(GAME.player.morale + 0.02);
    applyRelTrust(npc, 0.01, 0, true);
    line = pick(NPC_LINES.smallHunger);
  } else if (chance(0.5)) {
    applyRelTrust(npc, 0.01, 0, true);
    line = pick(NPC_LINES.smallFood);
  } else {
    line = pick(NPC_LINES.smallSing);   // pure flavor, like Unity's DoSing
  }
  typeText($('dlg-text'), line);
  Tutorial.notify('friendly', npc);
  consumeTime(CONFIG.personalLifeTopicCost);
  renderBondChoices(npc);
}

function doOpenUp(npc) {
  const memory = chance(0.5);   // story vs memory variant
  let relD, trustD, key;
  if (npc.morale < 0.35) { relD = memory ? 0.03 : 0.02; trustD = 0.01; key = 'openLow'; }
  else if (npc.stats.relational > 0.65) { relD = memory ? 0.07 : 0.06; trustD = memory ? 0.04 : 0.03; key = 'openHigh'; }
  else if (npc.stats.relational >= 0.35) { relD = memory ? 0.04 : 0.03; trustD = memory ? 0.02 : 0.01; key = 'openMid'; }
  else { relD = 0.01; trustD = 0; key = 'openCold'; }
  applyRelTrust(npc, relD, trustD, false);
  typeText($('dlg-text'), pick(NPC_LINES[key]));
  Tutorial.notify('friendly', npc);
  consumeTime(CONFIG.personalLifeTopicCost);
  renderBondChoices(npc);
}

function doOfferHelp(npc) {
  // Unity applies this directly — bypasses diminishing returns
  npc.addRel(GAME.player.name, 0.03);
  npc.addTrust(GAME.player.name, 0.04);
  typeText($('dlg-text'), pick(NPC_LINES.helpThanks));
  Tutorial.notify('friendly', npc);
  consumeTime(CONFIG.personalLifeTopicCost);
  renderBondChoices(npc);
}

/* ---- Telling somebody you are struggling ----
   A real decision rather than flavour. Say it to someone who is with you and
   they may actually feed you or cover your work. Say it to someone who is not
   and you have just told them you are weak, which is worth a vote to them. */
function doSayHungry(npc) {
  const P = GAME.player;
  const band = Voice.band(npc, P.name);
  let note = '';
  if (band === 'close' || (band === 'warm' && chance(0.6))) {
    const give = Math.min(CampNeeds.get('food'), 0.12);
    if (give > 0.03) {
      CampNeeds.add('food', -give);
      P.hunger = clamp01(P.hunger - give * 1.6);
      note = ' They dig out a share of the food and put it in your hands.';
    } else {
      note = ' There is nothing in the basket to give, so they just sit with you.';
    }
    applyRelTrust(npc, 0.035, 0.025, false, 'you were honest about struggling');
    P.morale = clamp01(P.morale + 0.04);
  } else if (band === 'cold') {
    npc.addVW(P.name, CONFIG.campWeaknessVoteWeight, 'you told them you were weak');
    npc.addSuspicion(P.name, 0.02, 'you showed weakness');
    note = ' You watch them file that away somewhere useful.';
  } else {
    applyRelTrust(npc, 0.012, 0.005, false, 'a small honest moment');
  }
  DBG.action('Said you are starving', npc.displayName,
    `band=${band} hunger=${P.hunger.toFixed(2)} store=${CampNeeds.get('food').toFixed(2)}`);
  typeText($('dlg-text'), CampLines.pick('replyHungry', npc, {}, band) + note);
  consumeTime(CONFIG.foodTopicCost);
  renderBondChoices(npc);
}

function doSayTired(npc) {
  const P = GAME.player;
  const band = Voice.band(npc, P.name);
  let note = '';
  if (band === 'close' || (band === 'warm' && chance(0.55))) {
    /* They pick up a job for you. Their credit, your camp. */
    const worst = CampNeeds.worst();
    const job = worst.severity > 0.25 ? CAMP_JOBS.find(j => j.need === worst.need.id) : null;
    if (job) {
      applyJobEffect(job, npc);
      Ledger.credit(npc, effortOfJob(job), job.id);
      npc.fatigue = clamp01(npc.fatigue + job.fatigue * 0.8);
      Beach.sendToWork(npc.name, job.zone, job.act, 4200);
      note = ` They get up and go and ${job.verb} instead of you.`;
    } else {
      note = ' They tell you to go and lie down, and mean it.';
    }
    applyRelTrust(npc, 0.030, 0.025, false, 'you were honest about struggling');
    P.morale = clamp01(P.morale + 0.04);
  } else if (band === 'cold') {
    npc.addVW(P.name, CONFIG.campWeaknessVoteWeight, 'you told them you were weak');
    note = ' They look at you a beat too long.';
  } else {
    applyRelTrust(npc, 0.012, 0.005, false, 'a small honest moment');
  }
  DBG.action('Said you are exhausted', npc.displayName,
    `band=${band} fatigue=${P.fatigue.toFixed(2)}`);
  typeText($('dlg-text'), CampLines.pick('replyTired', npc, {}, band) + note);
  consumeTime(CONFIG.foodTopicCost);
  renderBondChoices(npc);
}

/* ---- "How do you find camp?" ----
   Where "he never helps" reaches the player directly. A grafter has been keeping
   score all season and will hand you the name; somebody who does not care about
   work cannot tell you anything, which is itself a read on them. */
function doAskCamp(npc) {
  const pool = Ledger.pool().filter(c => c !== npc);
  const band = CampLines.ethicBand(npc);
  const worst = Ledger.worstIn(pool);
  const best = Ledger.bestIn(pool);
  const namesWorst = band === 'grafter' && worst.who && worst.rep < 0.40;
  const line = CampLines.pick('campRead', npc,
    { tn: (namesWorst ? worst.who : best.who || npc).displayName }, band);
  let note = '';
  if (namesWorst) {
    note = ` (They clearly mean it about ${worst.who.displayName}.)`;
    Feed.post(`${npc.displayName} reckons ${worst.who.displayName} does nothing around camp.`, 'warn', GAME.day);
    /* Agreeing with someone about work is a cheap bond, and it is how camp
       resentment spreads to the player's own ballot thinking. */
    applyRelTrust(npc, 0.020, 0.015, false, 'agreed with them about camp');
  } else if (band === 'idle') {
    note = ' (Nothing about camp has ever crossed their mind.)';
  } else {
    applyRelTrust(npc, 0.010, 0.005, false, 'talked about camp');
  }
  DBG.action('Asked about camp', npc.displayName,
    `ethic=${band} theirRep=${Ledger.rep(npc).toFixed(2)} named=${namesWorst ? worst.who.displayName : 'nobody'}`);
  typeText($('dlg-text'), line + note);
  consumeTime(CONFIG.foodTopicCost);
  renderAskChoices(npc);
}

/* ---- Info-ask engine: NPCs answer through the lying system ---- */
function npcTruthfulness(npc) {
  const trust = npc.getTrust(GAME.player.name);
  let lie = clamp01((1 - trust) * 0.55);
  if (['Paranoid Schemer', 'Villain Arc', 'Bitter Veteran'].includes(npc.cluster)) lie += 0.15;
  if (['Loyal Soldier', 'Loyal Follower', 'Fan Favorite'].includes(npc.cluster)) lie -= 0.15;
  if (npc.stats.gameAwareness > 0.65) lie += 0.08;
  if (npc.stats.emotional > 0.65) lie -= 0.15;
  const roll = rng();
  if (roll < lie) return 'Lie';
  if (roll < lie + 0.25) return 'Partial';
  return 'Truth';
}

function npcInfoTier(npc) {
  const lvl = PlayerAlliances.level(npc.name);
  const adj = npc.getTrust(GAME.player.name) + (lvl === 3 ? 0.3 : lvl === 2 ? 0.2 : lvl === 1 ? 0.1 : 0);
  return adj > 0.6 ? 'High' : adj >= 0.35 ? 'Medium' : 'Low';
}

function npcInfoTone(npc, truth) {
  if (truth === 'Lie') return npc.stats.gameAwareness > 0.6 ? 'evasive' : npc.stats.emotional > 0.6 ? 'anxious' : 'cold';
  if (truth === 'Partial') return 'hesitant';
  const cl = npc.cluster;
  if (cl === 'Strategic Veteran' || cl === 'Paranoid Schemer') return 'coded';
  if (cl === 'Social Butterfly' || cl === 'Fan Favorite') return 'warm';
  if (cl === 'Physical Threat' || cl === 'Bitter Veteran') return 'blunt';
  if (cl === 'Emotional Wildcard') return 'anxious';
  return 'confident';
}

function dnOf(name) {
  const c = GAME.cast.find(x => x.name === name);
  return c ? c.displayName : name;
}

function topPressureSubject() {
  let topName = null, top = 0;
  const here = campmates(GAME.player);
  for (const s of here) {
    if (s.isPlayer) continue;
    let p = 0;
    for (const o of here) if (o !== s) p += Math.max(0, o.getVW(s.name));
    if (p > top) { top = p; topName = s.name; }
  }
  return top >= 0.5 ? topName : null;
}

function renderHearingLine(npc, subjectName, truth, tier) {
  const cl = npc.cluster;
  const s = subjectName ? dnOf(subjectName) : 'anyone in particular';
  if (cl === 'Emotional Wildcard' && truth === 'Truth')
    return `Oh god, YES — ${s}'s name is everywhere. I'm so stressed. Please don't tell anyone.`;
  if (cl === 'Chaos Agent' && truth === 'Truth')
    return "Here's the fun part — nobody's SAID anything but they're all staring at each other. Delicious.";
  if (cl === 'Paranoid Schemer' && truth === 'Truth')
    return "I'm hearing what I'm hearing. You should be asking yourself why I'd tell you.";
  if (cl === 'Physical Threat' && truth === 'Truth')
    return subjectName ? `${s}. That's what I got.` : 'Nothing solid yet.';
  if (cl === 'Villain Arc' && truth === 'Lie')
    return "You'd think I'd tell you what I know? Adorable.";
  if (truth === 'Truth') {
    if (tier === 'High') return `Three people have mentioned ${s}. If you're looking for numbers, they're there.`;
    if (tier === 'Medium') return `A couple names are floating. ${s} keeps coming up.`;
    return 'Nothing much. Rumblings.';
  }
  if (truth === 'Partial') {
    if (tier === 'High') return 'A couple names, honestly. Nothing locked.';
    if (tier === 'Medium') return "I'm hearing stuff. Too early to commit.";
    return "Not much. You'd know as soon as I did.";
  }
  return pick(["People are talking but nobody's said anything concrete yet.",
    "It's quiet. Really quiet. That's what's weird.",
    "Nothing. It's quiet tonight."]);
}

function renderThinkingLine(npc, claimName, truth, tier) {
  const cl = npc.cluster;
  const c = claimName ? dnOf(claimName) : 'undecided';
  if (cl === 'Emotional Wildcard' && truth === 'Truth' && claimName)
    return `${c.toUpperCase()}. I can't keep it in. ${c}. Please don't tell them.`;
  if (cl === 'Paranoid Schemer' && truth !== 'Truth')
    return "Why are you asking? That's the more interesting question.";
  if (cl === 'Loyal Soldier' && truth === 'Truth')
    return "You first. If we're in this together, you get my name. Otherwise I keep it.";
  if (cl === 'Social Butterfly' && truth === 'Truth')
    return `Okay I'll tell you but please tell me yours too — ${c}.`;
  if (cl === 'Strategic Veteran' && truth === 'Partial')
    return "Let's just say I've narrowed it. Want to compare shortlists?";
  if (cl === 'Chaos Agent')
    return truth === 'Truth'
      ? `I'll vote whoever makes the best face at tribal. ${c}'s close.`
      : 'Could be anyone. I run on vibes.';
  if (cl === 'Villain Arc' && truth === 'Lie') return `${c}. Simple, clean, necessary.`;
  if (cl === 'Bitter Veteran' && truth === 'Lie') return 'Same name as last week. Figure it out.';
  if (truth === 'Truth') {
    if (tier === 'High') return `${c}. I've been on ${c} since yesterday.`;
    return `${c}, probably. Still open.`;
  }
  if (truth === 'Partial') {
    return claimName ? `Between ${c} and someone else. Depends on who commits.` : "I'm still weighing it.";
  }
  return pick([`${c}. Locked in.`, `${c}. That's where I'm at.`, "I'm still weighing it."]);
}

function renderThinkOfLine(npc, subject, sentiment, truth) {
  const x = subject.displayName;
  /* Cluster flavour, ten deep per case. Taken most of the time but not always,
     so the feeling-banded pool stays in rotation and nobody has a catchphrase.
     These used to be single hardcoded lines that always won. */
  if (chance(0.6)) {
    const flavoured = thinkOfClusterLine(npc, subject, sentiment, truth);
    if (flavoured) return flavoured;
  }
  /* The sentiment they PRESENT selects the band, not their private feeling —
     otherwise a lie would sound like the truth. */
  const band = sentiment === 'positive' ? (chance(0.5) ? 'warm' : 'close')
    : sentiment === 'negative' ? 'cold' : 'wary';
  const banded = Voice.line('thinkOfSubject', npc, { band, vars: { tn: x } });
  if (banded) return banded;
  if (truth === 'Truth') {
    if (sentiment === 'positive') return `${x}'s solid. Been straight with me.`;
    if (sentiment === 'negative') return `${x}'s a problem. I don't trust what they're selling.`;
    return `${x}? I haven't read them yet. I'm watching.`;
  }
  if (truth === 'Partial') return `${x}'s fine, I think. Ask me in two days.`;
  if (sentiment === 'positive') return `${x}? Great. No issues.`;
  if (sentiment === 'negative') return `I don't love ${x}. Something's off.`;
  return "Honestly? I'd rather not get into it.";
}

function doAskHearing(npc) {
  let truth = npcTruthfulness(npc);
  let subject = topPressureSubject();
  if (!subject) {
    if (truth === 'Truth') truth = 'Partial';
    if (truth === 'Lie') {
      const others = campmates(npc).filter(c => !c.isPlayer && c !== npc);
      subject = others.length ? pick(others).name : null;
    }
  }
  const tone = npcInfoTone(npc, truth);
  /* Warmth should buy CONCRETE information, so when they feel close to you and
     there is a name to give, use the renderer that actually names it. The banded
     lines cover the guarded cases and the "nothing to report" case, where the
     wording is the whole content anyway. */
  const band = Voice.band(npc, GAME.player.name);
  const guarded = band === 'cold' || band === 'wary';
  const banded = Voice.line('hearing', npc, { band });
  const line = (!subject || guarded) && banded
    ? banded
    : renderHearingLine(npc, subject, truth, npcInfoTier(npc));
  Lying.evaluate(GAME.player, npc, truth, 'TargetInfo', subject || '(none)');
  if (subject) addIntel(npc.name, 'heat', subject, tone);
  typeText($('dlg-text'), `${line} (They sound ${tone}.)`);
  Tutorial.notify('scheme');
  consumeTime(CONFIG.personalLifeTopicCost);
  renderAskChoices(npc);
}

/* Who they would write if pressed right now, and how settled they are on it.
   Vote weights are only seeded on tribal mornings, so on every other day the map
   is empty — the old read required a weight above a 0.3 floor, found nobody, and
   forced a dodge. This falls back to the same considerations the seeding uses, so
   there is always a considered answer behind the question. */
function npcLeanTarget(npc) {
  const pool = campmates(npc).filter(c => c !== npc);
  if (!pool.length) return null;
  const scored = pool.map(c => {
    const e = npc.relEntry(c.name);
    let s = npc.getVW(c.name);                        // seeded weight, when there is one
    s += (1 - npc.getTrust(c.name)) * 0.35;           // distrust
    s -= npc.getRel(c.name) * 0.45;                   // affection protects
    if (e) s += e.suspicion * 0.40 + e.grudge * 0.50;
    if (npc.stats.gameAwareness > 0.55) s += c.stats.gameAwareness * 0.20;  // sharp players read threat
    return { c, s };
  }).sort((a, b) => b.s - a.s);
  const top = scored[0];
  const second = scored[1] ? scored[1].s : top.s - 0.3;
  /* How far clear their top is of the next name = how settled they sound. */
  const conviction = clamp01(((top.s - second) / 0.18) * 0.65 +
    clamp01((top.s - scored[scored.length - 1].s) / 0.55) * 0.35);
  return { target: top.c, conviction: +conviction.toFixed(2), score: +top.s.toFixed(2) };
}

function doAskThinking(npc) {
  let truth = npcTruthfulness(npc);
  const lean = npcLeanTarget(npc);
  const tier = npcInfoTier(npc);

  /* Dodging is a real answer, but it should be the exception. It gets likelier
     when they genuinely have not settled and when they do not trust you. */
  let pDodge = 0.05 + (1 - (lean ? lean.conviction : 0)) * 0.18
    + (tier === 'Low' ? 0.12 : tier === 'Medium' ? 0.03 : 0);
  if (['Paranoid Schemer', 'Strategic Veteran'].includes(npc.cluster)) pDodge += 0.08;
  if (['Social Butterfly', 'Emotional Wildcard', 'Fan Favorite'].includes(npc.cluster)) pDodge -= 0.10;
  pDodge = Math.max(0.03, Math.min(0.45, pDodge));

  let leanName = lean ? lean.target.name : null;
  /* Nobody tells you to your face that you are the name — they deflect instead. */
  const leaningOnPlayer = leanName === GAME.player.name;
  if (leaningOnPlayer && truth === 'Truth') truth = 'Lie';

  let claim = null;
  if (!leanName || chance(pDodge)) {
    truth = 'Partial';
  } else if (truth === 'Lie' || leaningOnPlayer) {
    const alts = campmates(npc).filter(c => !c.isPlayer && c !== npc && c.name !== leanName);
    claim = alts.length ? pick(alts).name : leanName;
    truth = 'Lie';
  } else {
    claim = leanName;
  }
  DBG.action('Ask who they are voting', npc.displayName,
    `lean=${leanName ? dnOf(leanName) : 'none'} conviction=${lean ? lean.conviction : 0} ` +
    `pDodge=${pDodge.toFixed(2)} tier=${tier} said=${claim ? dnOf(claim) : 'undecided'} truth=${truth}`);
  const tone = npcInfoTone(npc, truth);
  const line = renderThinkingLine(npc, claim, truth, npcInfoTier(npc));
  // VoteIntent: their claim is declared and retro-validated when they actually vote
  Lying.evaluate(GAME.player, npc, truth, 'VoteIntent', claim || '(none)');
  addIntel(npc.name, claim ? 'claim' : 'hedged', claim, `sounded ${tone}`);
  if (!claim) Beach.emote(npc.name, 'shrug');     // they dodged — body language says so
  typeText($('dlg-text'), `${line} (They sound ${tone}.)`);
  Tutorial.notify('scheme');
  consumeTime(CONFIG.personalLifeTopicCost);
  renderAskChoices(npc);
}

function doAskThinkOf(npc, subject) {
  const real = npc.getRel(subject.name);
  DBG.action('Ask opinion of', npc.displayName,
    `subject=${subject.displayName} theirBond=${real.toFixed(2)} theirTrust=${npc.getTrust(subject.name).toFixed(2)}`);
  const realSent = real > 0.55 ? 'positive' : real < 0.35 ? 'negative' : 'neutral';
  const truth = npcTruthfulness(npc);
  let shown = realSent;
  if (truth === 'Lie') shown = realSent === 'positive' ? 'negative' : realSent === 'negative' ? 'positive' : (chance(0.5) ? 'positive' : 'negative');
  else if (truth === 'Partial') shown = 'neutral';
  const tone = npcInfoTone(npc, truth);
  const line = renderThinkOfLine(npc, subject, shown, truth);
  Lying.evaluate(GAME.player, npc, truth, 'TargetInfo', subject.name);
  addIntel(npc.name, 'read', subject.name, shown);
  typeText($('dlg-text'), `${line} (They sound ${tone}.)`);
  Tutorial.notify('scheme');
  consumeTime(CONFIG.personalLifeTopicCost);
  renderAskChoices(npc);
}

/* ---- Game talk additions ---- */
function doReadRoom(npc) {
  const ga = npc.stats.gameAwareness;
  let relD, trustD, key;
  if (ga > 0.65) { relD = 0.02; trustD = 0.02; key = 'readHighGA'; }
  else if (ga >= 0.35) { relD = 0.03; trustD = 0.01; key = 'readMidGA'; }
  else { relD = 0.04; trustD = 0; key = 'readLowGA'; }
  if (npc.stats.emotional > 0.7) relD += 0.01;
  applyRelTrust(npc, relD, trustD, false);
  /* What they think they have spotted about who is tight with whom. This is the
     whole point of asking somebody to read the room, and it used to be a flavour
     line with no content. The read may be right, vague, or confidently wrong, and
     nothing in the phrasing distinguishes them — the only way to check is to ask
     somebody else, which is exactly the game. */
  const read = NpcBlocs.readBy(npc, GAME.cast, GAME.merged);
  let text = pick(NPC_LINES[key]);
  if (read.kind !== 'nothing') {
    text += ' ' + NpcBlocs.lineFor(read, npc);
    /* Logged as INTEL, tagged with whether it was actually true, so the season
       report can tell the player afterwards who had been feeding them nonsense. */
    if (read.group.length) {
      addIntel(npc.name, 'bloc', read.group[0].name,
        read.group.map(g => g.displayName).join(' + ') + (read.kind === 'wrong' ? ' (wrong)' : ''));
    }
    DBG.log('social', `Bloc read from ${npc.displayName}: ${read.kind}`
      + (read.group.length ? ' — ' + read.group.map(g => g.displayName).join(', ') : ''));
    Journal.event('blocRead', {
      from: npc.displayName, kind: read.kind,
      named: read.group.map(g => g.displayName), ga: +ga.toFixed(2)
    });
  }
  typeText($('dlg-text'), text);
  Tutorial.notify('scheme');
  consumeTime(CONFIG.personalLifeTopicCost);
  renderSchemeChoices(npc);
}

function doUndermine(npc, target) {
  npc.addVW(target.name, 0.4, 'you asked them to back you');
  const trusts = npc.getTrust(target.name) > 0.5;
  applyRelTrust(npc, trusts ? -0.05 : 0.02, trusts ? -0.03 : 0.01, false);
  typeText($('dlg-text'), pick(trusts ? NPC_LINES.underDefend : NPC_LINES.underBuy).replace(/\{tn\}/g, target.displayName));
  Tutorial.notify('scheme');
  consumeTime(CONFIG.personalLifeTopicCost);
  renderSchemeChoices(npc);
}

function doAttack(npc, target) {
  const caught = npc.stats.gameAwareness > 0.65;
  if (caught) {
    applyRelTrust(npc, -0.04, -0.08, false);
    typeText($('dlg-text'), pick(NPC_LINES.attackCaught).replace(/\{tn\}/g, target.displayName));
  } else {
    npc.addVW(target.name, 0.6, 'they agreed to back you');
    applyRelTrust(npc, 0, -0.02, false);
    typeText($('dlg-text'), pick(NPC_LINES.attackTook).replace(/\{tn\}/g, target.displayName));
  }
  Tutorial.notify('scheme');
  consumeTime(0.75);
  renderSchemeChoices(npc);
}

/* ---- Alliance additions ---- */
/* ---- "Back me up tonight" ----
   The centrepiece ask, so nothing here is fixed. Whether they like the idea
   depends on where that name already sits on THEIR list and how they feel about
   them; whether they commit depends on how much they trust you; and whether they
   MEAN it is a separate question again. A false promise is declared as a lie and
   the existing retro-validation punishes it when their real vote lands. */
function backMeUpAppraisal(npc, target) {
  const P = GAME.player;
  const trustInPlayer = npc.getTrust(P.name);
  const lvl = PlayerAlliances.level(npc.name);
  const relTarget = npc.getRel(target.name);
  const trustTarget = npc.getTrust(target.name);

  /* Where the target already sits on their own list — asking for someone they
     were already circling is easy; asking for their last choice is not. */
  const others = campmates(npc).filter(c => c !== npc);
  const ranked = others.map(c => ({ name: c.name, w: npc.getVW(c.name) })).sort((a, b) => b.w - a.w);
  const rank = ranked.findIndex(r => r.name === target.name) + 1;
  const topW = ranked.length ? ranked[0].w : 0;
  const ownAppetite = topW > 0.1 ? clamp01(npc.getVW(target.name) / topW) : 0.35;

  const alliedWithTarget = NpcAlliances.has(npc.name, target.name);
  const circle = Coalitions.active(P.name);
  const circleWithTarget = !!circle && circle.members.includes(npc.name) && circle.members.includes(target.name);
  const threatFromPlayer = Math.max(0, npc.getVW(P.name));

  let score = 0;
  score += (ownAppetite - 0.35) * 0.55;
  score += (trustInPlayer - 0.42) * 0.85;
  score += [0, 0.07, 0.14, 0.20][lvl] || 0;
  score -= Math.max(0, relTarget - 0.45) * 0.95;
  score -= Math.max(0, trustTarget - 0.45) * 0.45;
  if (alliedWithTarget) score -= 0.65;
  if (circleWithTarget) score -= 0.55;
  if (['Loyal Soldier', 'Loyal Follower'].includes(npc.cluster)) score += 0.08;
  if (['Paranoid Schemer', 'Strategic Veteran', 'Bitter Veteran'].includes(npc.cluster)) score -= 0.08;
  if (npc.morale < 0.35) score -= 0.05;
  score -= threatFromPlayer * 0.12;

  const stance = score >= 0.30 ? 'Committed' : score >= 0.12 ? 'Leaning'
    : score >= -0.06 ? 'Noncommittal' : 'Refused';

  /* Saying yes and meaning it are different questions. */
  let honesty = 0.50 + (trustInPlayer - 0.40) * 0.70 + ([0, 0.05, 0.12, 0.18][lvl] || 0)
    - threatFromPlayer * 0.18;
  if (['Paranoid Schemer', 'Villain Arc', 'Strategic Veteran'].includes(npc.cluster)) honesty -= 0.15;
  if (['Loyal Soldier', 'Loyal Follower', 'Fan Favorite'].includes(npc.cluster)) honesty += 0.15;
  honesty = clamp01(honesty);

  /* Which consideration dominates decides what they actually say. */
  let reason = 'neutral';
  if (alliedWithTarget || circleWithTarget) reason = 'bound';
  else if (relTarget > 0.6) reason = 'likesTarget';
  else if (trustInPlayer < 0.35) reason = 'distrustsYou';
  else if (ownAppetite > 0.8 && rank === 1) reason = 'alreadyWanted';
  else if (rank >= Math.max(3, ranked.length - 1)) reason = 'targetHarmless';
  else if (threatFromPlayer > 0.8) reason = 'youAreTheThreat';

  return {
    stance, reason, score: +score.toFixed(3), honesty: +honesty.toFixed(2),
    rank, of: ranked.length, ownAppetite: +ownAppetite.toFixed(2),
    trustInPlayer: +trustInPlayer.toFixed(2), relTarget: +relTarget.toFixed(2),
    trustTarget: +trustTarget.toFixed(2), lvl, alliedWithTarget, circleWithTarget
  };
}

function doBackMeUp(npc, target) {
  const a = backMeUpAppraisal(npc, target);
  const tn = target.displayName;
  DBG.action('Back me up', npc.displayName, `target=${tn} stance=${a.stance} reason=${a.reason}`);
  DBG.decision('BackMeUp', a.stance, a);

  if (a.stance === 'Refused') {
    npc.addSuspicion(GAME.player.name, 0.05, 'pushed a name they would not write');
    Lying.evaluate(npc, GAME.player, 'Truth', 'AllianceClaim', npc.name);
    addIntel(npc.name, 'refused', target.name, `would not write ${tn}`);
    typeText($('dlg-text'), backMeUpLine(a, tn, npc));
    /* Refusing and then telling them is exactly what a loyal ally would do. */
    if (a.alliedWithTarget || a.relTarget > 0.6) checkGossipBack(npc, target);
    consumeTime(0.5);
    renderAllianceChoices(npc);
    return;
  }

  if (a.stance === 'Noncommittal') {
    npc.addVW(target.name, 0.15, 'player floated the name');
    Lying.evaluate(GAME.player, npc, 'Partial', 'VoteIntent', target.name);   // their hedge
    addIntel(npc.name, 'hedged', target.name, `would not promise a vote on ${tn}`);
    typeText($('dlg-text'), backMeUpLine(a, tn, npc));
    consumeTime(0.5);
    renderAllianceChoices(npc);
    return;
  }

  /* They said yes. Do they mean it? */
  const sincere = chance(a.honesty);
  const weight = a.stance === 'Committed' ? 0.85 : 0.45;
  if (sincere) {
    npc.addVW(target.name, weight, 'agreed to write that name');
    Lying.evaluate(GAME.player, npc, 'Truth', 'VoteIntent', target.name);      // their promise
    Lying.evaluate(npc, GAME.player, 'Truth', 'VoteIntent', target.name);      // yours, in return
    if (a.stance === 'Committed') {
      PlayerAlliances.align(npc.name, GAME.day);
      if (a.trustInPlayer > 0.5) PlayerAlliances.promise(npc.name, GAME.day);
      PlayerSecrets.add('Alliance', npc.name, GAME.day);
    }
  } else {
    /* A promise they do not intend to keep. Declared as a lie, so when their
       real vote lands the existing retro-validation exposes it. */
    npc.addVW(target.name, 0.1, 'nodded along without meaning it');
    npc.addVW(GAME.player.name, 0.25, 'you showed them your hand');
    /* Their promise, declared as a lie: when their real vote lands, the existing
       retro-validation exposes it to the player. */
    Lying.evaluate(GAME.player, npc, 'Lie', 'VoteIntent', target.name);
    Lying.evaluate(npc, GAME.player, 'Truth', 'VoteIntent', target.name);
  }
  addIntel(npc.name, 'agreed', target.name,
    a.stance === 'Committed' ? `gave you their word on ${tn}` : `sounded close to ${tn}`);
  DBG.decision('BackMeUp', sincere ? 'SINCERE' : 'FALSE PROMISE', { npc: npc.name, honesty: a.honesty, weight });
  typeText($('dlg-text'), backMeUpLine(a, tn, npc, sincere));
  Tutorial.notify('align');
  consumeTime(0.5);
  renderAllianceChoices(npc);
}

/* Builds the answer out of their actual reasoning, with a tone tell at the end
   that leaks whether they meant it. */
function backMeUpLine(a, tn, npc, sincere) {
  const open = pick(NPC_LINES.backStance[a.stance]).replace(/\{tn\}/g, tn);
  const why = NPC_LINES.backReason[a.reason];
  const reason = why ? ' ' + pick(why).replace(/\{tn\}/g, tn) : '';
  const truth = a.stance === 'Refused' ? 'Truth'
    : a.stance === 'Noncommittal' ? 'Partial'
      : (sincere ? 'Truth' : 'Lie');
  return `${open}${reason} (They sound ${npcInfoTone(npc, truth)}.)`;
}

function doBreakAlliance(npc) {
  const a = PlayerAlliances.get(npc.name);
  if (a) a.broken = true;
  npc.addRel(GAME.player.name, -0.08);
  npc.addTrust(GAME.player.name, -0.20);
  npc.addSuspicion(GAME.player.name, 0.10);
  npc.addVW(GAME.player.name, 0.8, 'you tried to force a pact');
  Lying.evaluate(npc, GAME.player, 'Truth', 'AllianceClaim', npc.name);
  typeText($('dlg-text'), pick(NPC_LINES.breakLine));
  Feed.post(`You ended things with ${npc.displayName}. They'll carry that.`, 'danger', GAME.day);
  renderAllianceChoices(npc);
}

/* ---- "That vote worked" — celebrating a landed blindside with a partner ----
   The payoff beat the scheming systems never had: shared success is how real
   alliances harden. Rewarding, but not free — it is a private admission that you
   two coordinated, and someone may be watching. */
function doCelebrateVote(npc) {
  const win = freshSharedWin(npc.name);
  if (!win) { typeText($('dlg-text'), 'That moment has passed.'); return; }
  win.celebrated = true;
  const targetDn = dnOf(win.target);
  const lvl = PlayerAlliances.level(npc.name);
  DBG.action('Celebrate vote', npc.displayName,
    `target=${targetDn} theirBondWithTarget=${win.bondWithTarget} allianceLvl=${lvl}`);

  /* They liked the person you took out — reading this as a victory is a misread. */
  if (win.bondWithTarget > CONFIG.celebrateBondSourGate) {
    npc.addTrust(GAME.player.name, -0.05, 'gloated over someone they liked');
    npc.addRel(GAME.player.name, -0.04, 'gloated over someone they liked');
    npc.morale = clamp01(npc.morale - 0.05);
    npc.addVW(GAME.player.name, 0.35, 'gloated over someone they liked');
    DBG.decision('Celebrate', 'BACKFIRED', { npc: npc.name, bondWithTarget: win.bondWithTarget });
    typeText($('dlg-text'), pick(NPC_LINES.celebrateSour).replace(/\{tn\}/g, targetDn));
    Feed.post(`${npc.displayName} did not enjoy that vote as much as you did.`, 'danger', GAME.day);
    Beach.emote(npc.name, 'slump');
    consumeTime(CONFIG.celebrateTimeCost);
    renderAllianceChoices(npc);
    return;
  }

  /* Warmth scales with temperament: schemers file it away, followers glow. */
  const warm = ['Loyal Follower', 'Social Butterfly', 'Fan Favorite', 'Loyal Soldier', 'Reluctant Hero'].includes(npc.cluster) ? 1.3
    : ['Villain Arc', 'Chaos Agent'].includes(npc.cluster) ? 1.2
      : ['Paranoid Schemer', 'Strategic Veteran', 'Bitter Veteran'].includes(npc.cluster) ? 0.6 : 1;
  const trustD = CONFIG.celebrateTrustGain * warm;
  const relD = CONFIG.celebrateRelGain * warm;
  npc.addTrust(GAME.player.name, trustD, 'shared a winning vote');
  npc.addRel(GAME.player.name, relD, 'shared a winning vote');
  GAME.player.addRel(npc.name, relD * 0.6, 'shared a winning vote');
  npc.addVW(GAME.player.name, -CONFIG.celebrateVoteWeightRelief, 'proved reliable in a vote');
  npc.morale = clamp01(npc.morale + 0.10);
  GAME.player.morale = clamp01(GAME.player.morale + 0.08);
  if (npc.memories.length < 6) npc.memories.push('sharedwin:' + win.target);

  /* A landed vote together is exactly how a loose alliance becomes a real one. */
  let promoted = null;
  if (lvl === 0 && npc.getTrust(GAME.player.name) > 0.5) { PlayerAlliances.align(npc.name, GAME.day); promoted = 'Aligned'; }
  else if (lvl === 1 && chance(0.6)) { PlayerAlliances.promise(npc.name, GAME.day); promoted = 'Promised'; }

  /* Schemers enjoy it and note your appetite for blindsides. */
  if (['Paranoid Schemer', 'Strategic Veteran'].includes(npc.cluster)) {
    npc.addVW(GAME.player.name, 0.2, 'noted your appetite for blindsides');
  }
  PlayerSecrets.add('Blindside', win.target, GAME.day);

  DBG.decision('Celebrate', 'LANDED', {
    npc: npc.name, cluster: npc.cluster, warmMult: warm,
    trustD: +trustD.toFixed(3), relD: +relD.toFixed(3), promoted
  });

  typeText($('dlg-text'), pick(NPC_LINES.celebrateYes).replace(/\{tn\}/g, targetDn));
  Beach.emote(npc.name, 'cheer');
  Beach.emote(GAME.player.name, 'cheer');
  Feed.post(`You and ${npc.displayName} savour the ${targetDn} vote.`, 'good', GAME.day);
  if (promoted) Feed.post(`That sealed something — you and ${npc.displayName} are ${promoted}.`, 'good', GAME.day);

  /* Celebrating in the open is still a tell. Someone sharp may pair you up. */
  const obs = campmates(npc).filter(c => !c.isPlayer && c !== npc && c.stats.gameAwareness > 0.6);
  for (const o of obs) {
    if (chance(CONFIG.celebrateSpottedChance)) {
      o.addVW(GAME.player.name, 0.4, 'saw you celebrating a vote together');
      o.addVW(npc.name, 0.4, 'saw them celebrating a vote together');
      Feed.post(`${o.displayName} watched you two enjoying that a little too much.`, 'drama', GAME.day);
      DBG.decision('Celebrate', 'SPOTTED', { by: o.name, ga: +o.stats.gameAwareness.toFixed(2) });
      break;
    }
  }
  Tutorial.notify('align');
  consumeTime(CONFIG.celebrateTimeCost);
  renderAllianceChoices(npc);
}

/* ---- Circles: multi-way alliances built in conversation ---- */
function doCircle(npc) {
  const circle = Coalitions.active(GAME.player.name);
  if (circle && !circle.members.includes(npc.name)) {
    // this NPC is the candidate for the existing circle
    tryAddToCircle(npc, npc, circle);
    return;
  }
  if (circle && circle.members.length >= Coalitions.MAX) {
    typeText($('dlg-text'), 'The pact is as big as it can safely get.');
    return;
  }
  const existing = circle ? circle.members : [GAME.player.name, npc.name];
  const pool = campmates(npc)
    .filter(c => !c.isPlayer && !existing.includes(c.name));
  if (!pool.length) { typeText($('dlg-text'), 'There is nobody left to bring in.'); return; }
  openCastPicker('Bring in whom?', pool, cand => { Modal.close(); tryAddToCircle(npc, cand, circle); });
}

/* How warm a pair is, blending bond and trust. Trust dominates, but a strong
   bond counts — otherwise vouching for someone (which moves both) can't help. */
function pairWarmth(a, b) { return a.getTrust(b.name) * 0.65 + a.getRel(b.name) * 0.35; }

/* Can `cand` be brought into a circle whose members are `memberNames`?
   Returns a structured reason so the refusal can be phrased by the right mouth
   and the whole decision can be written to the log with its numbers.
   reason: 'distrusts-player' | 'cand-cold-on-member' | 'member-cold-on-cand' */
function circleAccepts(cand, memberNames) {
  const P = GAME.player;
  const candTrustsPlayer = cand.getTrust(P.name);
  /* A candidate who trusts you a lot extends some benefit of the doubt to the
     people you vouch for; one who barely knows you demands more. */
  const vouch = Math.max(0, candTrustsPlayer - 0.5) * 0.30;
  const need = CONFIG.circleWarmthNeeded - vouch;
  const detail = { cand: cand.name, trustInPlayer: +candTrustsPlayer.toFixed(2), need: +need.toFixed(2), pairs: [] };

  if (candTrustsPlayer < CONFIG.circleTrustInPlayerNeeded) {
    DBG.gate('Pact', 'trust-in-player', true,
      { ...detail, needed: CONFIG.circleTrustInPlayerNeeded });
    return { ok: false, reason: 'distrusts-player', who: P, need };
  }

  for (const n of memberNames) {
    if (n === P.name || n === cand.name) continue;
    const m = GAME.cast.find(x => x.name === n);
    if (!m) continue;
    const candToM = pairWarmth(cand, m), mToCand = pairWarmth(m, cand);
    detail.pairs.push({ member: m.name, candToMember: +candToM.toFixed(2), memberToCand: +mToCand.toFixed(2) });
    /* Report whichever SIDE is cold, because that decides who objects out loud
       and therefore which name the refusal is allowed to mention. */
    if (candToM < need || mToCand < need) {
      const candIsColder = candToM <= mToCand;
      DBG.gate('Pact', 'pair-warmth', true,
        { ...detail, blockedBy: m.name, side: candIsColder ? 'candidate' : 'member' });
      return {
        ok: false,
        reason: candIsColder ? 'cand-cold-on-member' : 'member-cold-on-cand',
        who: m, need
      };
    }
  }
  DBG.gate('Pact', 'all', false, detail);
  return { ok: true, need };
}

function tryAddToCircle(npc, cand, circle) {
  const members = circle ? circle.members : [GAME.player.name, npc.name];
  DBG.action('Pact invite', npc.displayName,
    `candidate=${cand.displayName} members=[${members.map(dnOf).join(', ')}]`);
  const res = circleAccepts(cand, members);
  if (!res.ok) {
    cand.addSuspicion(GAME.player.name, 0.05, 'pact refusal');
    if (cand.stats.gameAwareness > 0.6) cand.addVW(GAME.player.name, 0.3, 'pact refusal');

    /* Phrase the refusal in the right mouth. The speaker is `npc`, so the line
       must never name `npc` or `cand` as the person being distrusted — that was
       producing "that mix doesn't work, <speaker> worries me". */
    const blockerIsSpeaker = res.who.name === npc.name;
    let lines, tn;
    if (res.reason === 'distrusts-player') {
      lines = NPC_LINES.circleNoYou; tn = cand.displayName;      // "get {cand} on side first"
    } else if (res.reason === 'member-cold-on-cand' && blockerIsSpeaker) {
      lines = NPC_LINES.circleNo; tn = cand.displayName;          // speaker distrusts the candidate
    } else if (res.reason === 'member-cold-on-cand') {
      lines = NPC_LINES.circleNoMember; tn = res.who.displayName; // a third member objects
    } else if (blockerIsSpeaker) {
      lines = NPC_LINES.circleNoCandOnMe; tn = cand.displayName;  // candidate is cold on the SPEAKER
    } else {
      lines = NPC_LINES.circleNoCand; tn = res.who.displayName;   // candidate is cold on a third member
    }
    const text = pick(lines).replace(/\{tn\}/g, tn).replace(/\{cand\}/g, cand.displayName);
    DBG.decision('Pact', 'REFUSED', { reason: res.reason, blocker: res.who.name, spokenBy: npc.name, named: tn });
    typeText($('dlg-text'), text);
    Feed.post(`${cand.displayName} was not brought in — ${res.reason === 'distrusts-player'
      ? 'they do not trust you enough yet' : 'the mix is too cold'}.`, 'drama', GAME.day);
    renderAllianceChoices(npc);
    return;
  }
  DBG.decision('Pact', 'ACCEPTED', { cand: cand.name, size: members.length + 1 });
  if (circle) Coalitions.addMember(circle, cand.name);
  else Coalitions.form([GAME.player.name, npc.name, cand.name], GAME.day);
  cand.addRel(GAME.player.name, 0.03);
  cand.addTrust(GAME.player.name, 0.04);
  npc.addTrust(GAME.player.name, 0.03);
  cand.addTrust(npc.name, 0.03);
  npc.addTrust(cand.name, 0.03);
  PlayerSecrets.add('Alliance', cand.name, GAME.day);
  typeText($('dlg-text'), pick(circle ? NPC_LINES.circleGrow : NPC_LINES.circleYes));
  if (cand !== npc) Beach.approach(cand, () => {});   // call them over
  const mem = Coalitions.active(GAME.player.name).members;
  Feed.post(`A pact of ${mem.length} forms quietly.`, 'good', GAME.day);
  // forming in the open: high-GA observers may clock it (risk scales with size)
  const obsPool = campmates(GAME.player).filter(c => !c.isPlayer && !mem.includes(c.name) && c.stats.gameAwareness > 0.65);
  for (const obs of obsPool) {
    if (chance(0.15 + 0.1 * (mem.length - 2))) {
      for (const n of mem) obs.addVW(n, 0.4, 'a secret about them got out');
      Feed.post(DIALOGUE.feedStrings.lockObserved.replace('{obs}', obs.displayName), 'drama', GAME.day);
      break;
    }
  }
  Tutorial.notify('align');
  consumeTime(1);
  renderAllianceChoices(npc);
}

/* ---- Risky ---- */
function secretLabel(s) {
  const dn = dnOf(s.subject);
  return {
    PushedVote: `I've been pushing votes onto ${dn}`,
    Blindside: `I celebrated blindsiding ${dn}`,
    PlantedSeed: `I planted doubts about ${dn}`,
    SpreadRumor: `That rumor about ${dn}? It was me`,
    Alliance: `I'm working with ${dn}`
  }[s.type] || `Something about ${dn}`;
}

/* Three ways to trade information: give them something real, feed them
   something false, or warn them a name came up. The last one is the useful one
   socially — and the picker marks which warnings you can actually back up. */
function doShareSecret(npc) {
  const box = $('dlg-choices');
  box.innerHTML = '';
  const add = b => box.appendChild(b);
  const truths = liveSecrets(PlayerSecrets.unknownTo(npc.name));
  const truthBtn = dlgChoice(truths.length ? 'Tell them something true about your game'
    : 'Nothing true left to tell them', () => shareTruthMenu(npc, truths), 0);
  if (!truths.length) truthBtn.disabled = true;
  add(truthBtn);
  add(dlgChoice('Feed them something false', () => shareLieMenu(npc), 0));
  add(dlgChoice('“I heard your name come up”', () => warnNameMenu(npc), 0));
  if (hasTribalHistory() && lastVoteOf(GAME.player.name))
    add(dlgChoice('Tell them who you voted for', () => shareMyVoteMenu(npc), 0));
  add(dlgChoice('Back', () => renderRiskyChoices(npc), 0));
  typeText($('dlg-text'), pick(NPC_LINES.shareOpen));
}

/* Secrets about a castaway who has left the game are moot — a vote you pushed
   onto someone already voted out is not leverage any more. */
function liveSecrets(list) {
  return list.filter(s => {
    if (s.type !== 'PushedVote') return true;
    const subj = GAME.cast.find(c => c.name === s.subject);
    return !subj || !subj.eliminated;
  });
}

function shareTruthMenu(npc, truths) {
  const box = h('div', 'col');
  for (const s of truths.slice(-6)) {
    const b = h('button', 'btn', secretLabel(s));
    b.addEventListener('click', () => { Modal.close(); revealSecret(npc, s); });
    box.appendChild(b);
  }
  Modal.open('Tell them the truth about…', box);
}

/* A lie is a claim about something you did NOT do. Built from the gaps in your
   own secret list so it stays plausible and can be caught out later. */
function fabricableSecrets(npc) {
  const pool = campmates(GAME.player)
    .filter(c => !c.isPlayer && c !== npc);
  const out = [];
  for (const c of pool) {
    if (!PlayerSecrets.list.some(s => s.type === 'Alliance' && s.subject === c.name))
      out.push({ type: 'Alliance', subject: c.name });
    if (!PlayerSecrets.list.some(s => s.type === 'PushedVote' && s.subject === c.name))
      out.push({ type: 'PushedVote', subject: c.name });
  }
  return shuffle(out).slice(0, 6);
}

function shareLieMenu(npc) {
  const fakes = fabricableSecrets(npc);
  if (!fakes.length) { typeText($('dlg-text'), 'Nothing convincing comes to mind.'); return; }
  const box = h('div', 'col');
  box.appendChild(h('div', 'tiny dim', 'None of these are true. If they catch it, it costs you.'));
  for (const s of fakes) {
    const b = h('button', 'btn', secretLabel(s));
    b.addEventListener('click', () => { Modal.close(); tellFalseSecret(npc, s); });
    box.appendChild(b);
  }
  Modal.open('Feed them what?', box);
}

/* "I heard your name come up" — pick who supposedly said it. The card subtitle
   marks whether you genuinely heard that, so bluffing is a deliberate choice
   rather than an accident. */
function warnNameMenu(npc) {
  const pool = campmates(npc)
    .filter(c => !c.isPlayer && c !== npc);
  if (!pool.length) { typeText($('dlg-text'), 'There is nobody to point at.'); return; }
  openCastPicker(`Who brought up ${npc.displayName}?`, pool,
    src => { Modal.close(); doWarnName(npc, src); },
    src => intelSaysNamed(src.name, npc.name) ? '✓ you heard this' : 'you would be inventing it',
    src => intelSaysNamed(src.name, npc.name) ? 'intel' : 'invented',
    'Ticked names are ones you actually heard aim at them. The rest would be a bluff.');
}

function revealSecret(npc, s) {
  PlayerSecrets.markKnown(s, npc.name);
  applyRelTrust(npc, 0.05, 0.15, false);
  const stmtType = s.type === 'PushedVote' ? 'VoteIntent' : s.type === 'Alliance' ? 'AllianceClaim' : 'TargetInfo';
  Lying.evaluate(npc, GAME.player, 'Truth', stmtType, s.subject);
  const wary = ['Paranoid Schemer', 'Villain Arc'].includes(npc.cluster) ? 0.6
    : (npc.stats.gameAwareness > 0.65 || npc.getTrust(GAME.player.name) < 0.5) ? 0.35 : 0;
  typeText($('dlg-text'), Voice.line('reveal', npc,
    { fallback: wary > 0 ? NPC_LINES.revealWary : NPC_LINES.revealWarm }));
  if (wary > 0 && chance(wary)) Feed.post(`${npc.displayName} filed that away carefully.`, 'drama', GAME.day);
  consumeTime(CONFIG.personalLifeTopicCost);
  renderRiskyChoices(npc);
}

/* A fabricated confession. Believed, it buys trust on false credit; caught, the
   Lying system remembers it and the trust hit is the worst in the game. */
function tellFalseSecret(npc, s) {
  DBG.action('Share false secret', npc.displayName, `claim=${s.type} about=${dnOf(s.subject)}`);
  const stmtType = s.type === 'PushedVote' ? 'VoteIntent' : 'AllianceClaim';
  const outcome = Lying.evaluate(npc, GAME.player, 'Lie', stmtType, s.subject);
  DBG.decision('FalseSecret', outcome, { npc: npc.name, claim: s.type, about: s.subject });
  if (outcome === 'Caught') {
    npc.addVW(GAME.player.name, 0.5, 'caught you inventing a confession');
    typeText($('dlg-text'), pick(NPC_LINES.lieCaught));
    Feed.post(`${npc.displayName} did not buy that.`, 'danger', GAME.day);
  } else if (outcome === 'Doubted') {
    typeText($('dlg-text'), pick(NPC_LINES.lieDoubted));
  } else {
    applyRelTrust(npc, 0.02, 0.06, false, 'believed a false confession');
    typeText($('dlg-text'), pick(NPC_LINES.revealWarm));
    /* They now think you are working with / against the named castaway. */
    if (s.type === 'Alliance') npc.addVW(s.subject, 0.3, 'believed you are working with them');
    else npc.addVW(s.subject, 0.4, 'believed you are pushing votes onto them');
  }
  consumeTime(CONFIG.personalLifeTopicCost);
  renderRiskyChoices(npc);
}

/* Warning someone their name came up. Real intel is the most valuable social
   currency in the game; a bluff can still land, but it is on record. */
function doWarnName(npc, src) {
  const evidence = intelSaysNamed(src.name, npc.name);
  const truth = evidence ? 'Truth' : 'Lie';
  DBG.action('Warn about name', npc.displayName,
    `accused=${src.displayName} backedByIntel=${!!evidence}${evidence ? ' (D' + evidence.day + ' ' + evidence.kind + ')' : ''}`);
  const outcome = Lying.evaluate(npc, GAME.player, truth, 'TargetInfo', src.name);
  DBG.decision('WarnName', outcome, {
    npc: npc.name, accused: src.name, truth,
    theirTrustInYou: +npc.getTrust(GAME.player.name).toFixed(2),
    ga: +npc.stats.gameAwareness.toFixed(2)
  });

  if (outcome === 'Caught') {
    npc.addVW(GAME.player.name, 0.45, 'caught you inventing a threat');
    npc.addSuspicion(GAME.player.name, 0.08, 'invented a threat');
    typeText($('dlg-text'), pick(NPC_LINES.warnCaught).replace(/\{sn\}/g, src.displayName));
    Feed.post(`${npc.displayName} thinks you made that up about ${src.displayName}.`, 'danger', GAME.day);
  } else if (outcome === 'Believed') {
    /* They turn on the named castaway. Real intel moves them harder than a
       bluff, because it survives checking later. */
    const push = evidence ? CONFIG.warnNameVoteWeightTrue : CONFIG.warnNameVoteWeightBluff;
    npc.addVW(src.name, push, evidence ? 'warned they were named' : 'believed a bluff');
    npc.addVW(GAME.player.name, -0.25, 'you warned them');
    if (evidence) applyRelTrust(npc, 0.03, CONFIG.warnNameTrustGain, false, 'gave them real intel');
    addIntel(npc.name, 'heat', src.name, 'you warned them');
    typeText($('dlg-text'), pick(NPC_LINES.warnBelieved).replace(/\{sn\}/g, src.displayName));
    Feed.post(`${npc.displayName} is watching ${src.displayName} now.`, 'drama', GAME.day);
  } else {
    /* Half-believed. They will keep an eye on the name, but a warning they only
       half-buy earns the player nothing — and an unbacked one costs a little. */
    const push = evidence ? CONFIG.warnNameVoteWeightTrue : CONFIG.warnNameVoteWeightBluff;
    npc.addVW(src.name, push * 0.4, 'half-believed a warning');
    if (!evidence) npc.addSuspicion(GAME.player.name, 0.04, 'unconvincing warning');
    addIntel(npc.name, 'heat', src.name, 'you warned them');
    typeText($('dlg-text'), pick(NPC_LINES.warnDoubted).replace(/\{sn\}/g, src.displayName));
  }

  /* Naming someone behind their back can get back to them either way. */
  checkGossipBack(npc, src);
  PlayerSecrets.add('SpreadRumor', src.name, GAME.day);
  Tutorial.notify('scheme');
  consumeTime(CONFIG.personalLifeTopicCost);
  renderRiskyChoices(npc);
}

function doConfront(npc) {
  let pressure = 0;
  for (const o of alive()) if (o !== npc) pressure += Math.max(0, o.getVW(npc.name));
  const truthful = pressure > 0.5 ? 'Truth' : 'Lie';   // bluffing an empty threat is detectable
  const emo = npc.stats.emotional > 0.6;
  if (emo) {
    applyRelTrust(npc, -0.15, -0.10, false);
  } else {
    applyRelTrust(npc, -0.08, -0.05, false);
    npc.addVW(GAME.player.name, 0.5, 'you confronted them');
  }
  Lying.evaluate(npc, GAME.player, truthful, 'ThreatWarning', null);
  typeText($('dlg-text'), pick(emo ? NPC_LINES.confrontFold : NPC_LINES.confrontDefy));
  Feed.post(`${npc.displayName} didn't like that.`, 'drama', GAME.day);
  consumeTime(CONFIG.personalLifeTopicCost);
  renderRiskyChoices(npc);
}

/* ---------------- Observe / wander ---------------- */
function pickSomeoneToObserve() {
  const pool = campmates(GAME.player).filter(c => !c.isPlayer);
  openCastPicker('Watch whom?', pool, c => {
    Modal.close();
    const s = c.stats;
    let hint;
    if (s.gameAwareness > 0.65) hint = pick(NPC_LINES.observeStrategic);
    else if (s.social > 0.65) hint = pick(NPC_LINES.observeSocial);
    else if (s.physicality > 0.65) hint = pick(NPC_LINES.observePhys);
    else if (c.morale < 0.35) hint = pick(NPC_LINES.observeMorale);
    else if (c.fatigue > 0.7) hint = pick(NPC_LINES.observeTired);
    else hint = pick(NPC_LINES.observeGuarded);
    const { target } = c.topVoteTarget(campmates(c));
    if (target && c.getVW(target.name) > 1 && chance(0.5 + GAME.player.stats.gameAwareness * 0.4)) {
      hint += ` They keep drifting away from ${target.displayName}.`;
      addIntel(c.name, 'observe', target.name);
    }
    Feed.post(`${c.displayName}: ${hint}`, '', GAME.day);
    consumeTime(CONFIG.observeTimeCost);
  }, c => c.cluster && GAME.player.stats.gameAwareness > 0.6 ? c.cluster : c.occupation);
}

function doWander() {
  const pf = Beach.figures.get(GAME.player.name);
  if (pf) Beach.playerWalkTo(Math.max(2, Math.min(98, pf.x + (Math.random() < 0.5 ? -11 : 11))));
  const lines = advanceSocialTime(0.25, GAME.cast, GAME.merged);
  Feed.post(pick(NPC_LINES.wander), '', GAME.day);
  lines.slice(0, 1).forEach(l => Feed.post(l.text, l.kind, GAME.day));
  consumeTime(CONFIG.wanderTimeCost);
}

function showSelf() {
  const p = GAME.player;
  const box = h('div', 'col');
  for (const k of STAT_KEYS) {
    const row = h('div', 'stat-row');
    row.appendChild(h('span', 'lbl', STAT_LABELS[k]));
    const meter = h('div', 'meter'); meter.style.flex = '1';
    const fill = h('i'); fill.style.width = pct(p.stats[k]);
    meter.appendChild(fill); row.appendChild(meter);
    box.appendChild(row);
  }
  box.appendChild(h('div', 'tiny dim', `Morale ${pct(p.morale)} · Hunger ${pct(p.hunger)} · Fatigue ${pct(p.fatigue)}`));
  Modal.open(`${p.displayName} — ${p.occupation}`, box);
}

/* ---------------- NPC approach + probes ---------------- */
const APPROACH = { npc: null, timer: null };

function showApproachPrompt(npc) {
  dismissApproach();
  if (GAME.playerEliminated || !GAME.seasonActive) return;
  const bar = h('div', 'approach-bar');
  bar.id = 'approach-bar';
  bar.appendChild(h('span', 'ap-tag', 'Incoming'));
  bar.appendChild(h('span', 'ap-text', `${npc.displayName} wants a word`));
  const talk = h('button', 'btn small primary', 'Talk');
  talk.addEventListener('click', () => { dismissApproach(); openTalkMenu(npc); });
  const no = h('button', 'btn small sand', 'Not now');
  no.addEventListener('click', () => dismissApproach());
  bar.appendChild(talk);
  bar.appendChild(no);
  $('screen-camp').appendChild(bar);
  APPROACH.npc = npc;
  APPROACH.timer = setTimeout(dismissApproach, 14000);
}

function dismissApproach() {
  clearTimeout(APPROACH.timer);
  const b = $('approach-bar');
  if (b) b.remove();
  APPROACH.npc = null;
}

function maybeNpcApproach() {
  if (GAME.playerEliminated || phaseOf() === 'Night' || APPROACH.npc) return;
  // never interrupt an open conversation or modal
  if ($('dialogue-layer').classList.contains('open') || $('modal-veil').classList.contains('open')) return;
  const pool = campmates(GAME.player).filter(c => !c.isPlayer);
  for (const npc of pool) {
    const p = CONFIG.npcApproachChance + npc.stats.social * 0.02 + npc.stats.relational * 0.02;
    if (chance(p)) {
      Feed.post(`${npc.displayName} wants a word with you.`, 'good', GAME.day);
      Beach.approach(npc, () => showApproachPrompt(npc));
      return;
    }
  }
}

function tryNpcProbe() {
  GAME.probeDoneToday = true;
  const pool = campmates(GAME.player).filter(c => !c.isPlayer);
  for (const npc of shuffle([...pool])) {
    const lvl = PlayerAlliances.level(npc.name);
    const elig = clamp01(npc.stats.social * 0.25 + npc.stats.gameAwareness * 0.35
      + (npc.stats.emotional > 0.6 ? 0.2 : 0)
      + (lvl >= 2 ? 0.3 : lvl === 1 ? 0.2 : 0)
      + (npc.getVW(GAME.player.name) > 0.4 ? 0.15 : 0));
    if (!chance(elig * CONFIG.npcVoteTalkChanceBase * 3)) continue;
    const trust = npc.getTrust(GAME.player.name);
    const tone = trust > 0.6 ? 'Warm'
      : npc.cluster === 'Paranoid Schemer' || (trust < 0.35 && npc.stats.gameAwareness > 0.55) ? 'Paranoid'
      : npc.stats.gameAwareness > 0.65 ? 'Coded'
      : npc.stats.emotional > 0.6 ? 'Urgent'
      : (npc.stats.social < 0.4 && npc.stats.relational < 0.4) ? 'Blunt' : 'Coded';
    showProbeModal(npc, tone);
    return;
  }
}

/* How well does the player actually know this person? Drives the framing:
   a locked ally asking for your vote is routine; a near-stranger doing it out of
   nowhere is an event, and the game should say so. */
function probeFamiliarity(npc) {
  const lvl = PlayerAlliances.level(npc.name);
  const band = Voice.band(npc, GAME.player.name);
  if (lvl >= 2) return 'ally';
  if (lvl === 1 || band === 'close' || band === 'warm') return 'known';
  return 'stranger';
}

function showProbeModal(npc, tone) {
  Tutorial.tip('probe', 'Someone wants your vote plans',
    'Truth builds trust. A believed lie steers them; a caught lie never heals. Deflecting is safe but earns nothing.');
  const fam = probeFamiliarity(npc);
  const body = h('div', 'col');

  /* Who is this? Portrait plus where you actually stand with them, because the
     whole decision turns on that and the player should not have to remember. */
  const head = h('div', 'probe-head');
  head.appendChild(castCard(npc, npc.occupation, fam === 'stranger' ? 'invented' : ''));
  const side = h('div', 'col probe-side');
  side.appendChild(h('div', 'probe-frame ' + fam, pick(DIALOGUE.probeFraming[fam])
    .replace(/\{n\}/g, npc.displayName)));
  if (fam === 'stranger') {
    const spoken = GAME.intel.some(e => e.who === npc.name);
    side.appendChild(h('div', 'tiny dim', spoken
      ? 'You have barely spoken. Whatever this is, they came to you.'
      : 'You have never really talked. They sought you out.'));
  }
  head.appendChild(side);
  body.appendChild(head);
  DBG.action('NPC probe', npc.displayName,
    `familiarity=${fam} allianceLvl=${PlayerAlliances.level(npc.name)} ` +
    `bond=${npc.getRel(GAME.player.name).toFixed(2)} trust=${npc.getTrust(GAME.player.name).toFixed(2)} tone=${tone}`);
  body.appendChild(h('div', 'probe-said', `${npc.displayName}: “${pick(DIALOGUE.probes[tone])}”`));
  const answer = (truth, claimed) => {
    Modal.close();
    const outcome = Lying.evaluate(npc, GAME.player, truth, 'VoteIntent', claimed ? claimed.name : '(none)');
    if (outcome === 'Believed' && claimed) npc.addVW(claimed.name, truth === 'Truth' ? 0.15 : 0.12, 'a name you gave them');
    else if (outcome === 'Doubted') { if (claimed) npc.addVW(claimed.name, 0.05, 'a name you gave them'); npc.addVW(GAME.player.name, 0.20, 'they doubted your answer'); }
    else if (outcome === 'Caught') npc.addVW(GAME.player.name, 0.40, 'they caught you lying at the probe');
    Feed.post(`${npc.displayName}: "${pick(DIALOGUE.probeReact[outcome])}"`, outcome === 'Caught' ? 'danger' : '', GAME.day);
  };
  const pool = campmates(GAME.player).filter(c => !c.isPlayer && c !== npc);
  const pickAndAnswer = truth => {
    Modal.close();
    openCastPicker(truth === 'Truth' ? 'The truth — who are you really on?' : 'The lie — feed them a name:',
      pool, t => answer(truth, t));
  };
  const btnRow = h('div', 'col');
  const truthBtn = h('button', 'btn primary', 'Truth — name my real target');
  truthBtn.addEventListener('click', () => pickAndAnswer('Truth'));
  const lieBtn = h('button', 'btn danger', 'Lie — feed them a name');
  lieBtn.addEventListener('click', () => pickAndAnswer('Lie'));
  /* "It's you."

     The one answer that takes nerve was the one answer the game did not allow: the
     asker was filtered out of every name list, so you could tell them about anybody
     except themselves. It is not a variant of naming a third party either — it is a
     different act with different consequences, so it gets its own button rather than
     hiding at the bottom of a picker where it would be missed. */
  const mine = playerTopTarget(npc);
  const itsThem = h('button', 'btn ember',
    mine === npc ? 'Tell them straight — "It\'s you."'
      : 'Tell them it\'s them — whether it is or not');
  const wrap = h('div', 'col');
  wrap.appendChild(itsThem);
  wrap.appendChild(h('div', 'tiny dim', mine === npc
    ? 'True, and they will know it. Expect them to move tonight.'
    : 'Not actually your plan. A threat, and they may call it.'));
  itsThem.addEventListener('click', () => { Modal.close(); confrontAtProbe(npc, mine === npc); });
  const deflectBtn = h('button', 'btn sand', 'Deflect — "Still listening around."');
  deflectBtn.addEventListener('click', () => answer('Partial', null));
  btnRow.appendChild(truthBtn); btnRow.appendChild(lieBtn);
  btnRow.appendChild(wrap); btnRow.appendChild(deflectBtn);
  body.appendChild(btnRow);
  Modal.open(fam === 'stranger' ? `${npc.displayName} wants a word — out of nowhere`
    : fam === 'ally' ? `${npc.displayName} needs your numbers`
      : `A quiet word with ${npc.displayName}`, body);
}

/* A beat with NO speaker attribution.

   peffMoment renders inside .peff-line with a "Peff" tag, which is right at a
   council and wrong everywhere else — a confrontation on the beach would have come
   out as "Peff: it's you, I'm writing your name". Same screen, same one-tap rhythm,
   tag suppressed by the class the idol silence already uses. */
function sceneMoment(text) {
  return new Promise(res => {
    const screen = $('screen-finale');
    Screens.push('screen-finale');
    screen.classList.add('silent-beat');
    $('finale-peff-text').textContent = '';
    const body = $('finale-body');
    body.innerHTML = '';
    body.appendChild(h('div', 'scene-line', text));
    const b = $('btn-finale-next');
    b.textContent = 'Continue';
    b.onclick = () => {
      screen.classList.remove('silent-beat');
      Screens.pop();
      res();
    };
  });
}

/* Who the player has actually been pushing hardest, among people they could vote
   for. Used to tell an honest confrontation from a bluff. */
function playerTopTarget(exclude) {
  const P = GAME.player;
  let best = null, bw = -Infinity;
  for (const c of campmates(P)) {
    if (c.isPlayer) continue;
    const w = P.getVW(c.name);
    if (w > bw) { bw = w; best = c; }
  }
  return bw > 0.15 ? best : null;
}

/* ---------------- "It's you." ----------------
   Telling somebody to their face that you are writing their name.

   The consequences are deliberately asymmetric and mostly bad, because that is
   what makes it a real decision rather than a free honesty bonus:

     - THEY KNOW. That is the big one. A warned castaway is far more likely to play
       an idol (idolWarnedDay is read by Idols.wouldPlay) and will spend the rest of
       the day working the beach against you.
     - THEIR PEOPLE HEAR IT. Their closest ally picks it up and turns too.
     - SOME OF THEM RESPECT IT. Temperament decides, and the ones who do are worth
       having: a jury remembers who told them straight.
     - AND SOME OF THEM DEAL. The interesting outcome — they offer you a name to
       take instead, and delivering it is worth more than the vote you gave up.

   Nothing here is a dice roll on its own: which reaction you get is that
   castaway's temperament and how they stood with you, so the same act on two
   different people is two different scenes. */
async function confrontAtProbe(npc, honest) {
  const P = GAME.player;
  const trust = npc.getTrust(P.name);
  const bond = npc.getRel(P.name);
  const warm = trust * 0.6 + bond * 0.4;

  /* How they take it. Temperament first, then how close you were. */
  const C = npc.cluster;
  let kind;
  if (['Villain Arc', 'Physical Threat', 'Chaos Agent', 'Bitter Veteran'].indexOf(C) >= 0) kind = 'defiant';
  else if (['Paranoid Schemer', 'Social Butterfly', 'Fan Favorite'].indexOf(C) >= 0) kind = 'scramble';
  else if (['Loyal Soldier', 'Natural Leader', 'Camp Provider', 'Reluctant Hero'].indexOf(C) >= 0) kind = 'respect';
  else if (['Emotional Wildcard', 'Loyal Follower'].indexOf(C) >= 0) kind = 'wounded';
  else if (['Strategic Veteran', 'Under The Radar'].indexOf(C) >= 0) kind = 'cold';
  else kind = 'scramble';
  /* Somebody you were genuinely close to takes it personally whatever their type,
     and somebody holding an idol would rather bluff than beg. */
  if (warm > 0.66 && kind !== 'respect') kind = 'wounded';
  if (Inventory.has(npc, 'idol') && chance(0.7)) kind = 'bluffBack';

  const say = (k, subs) => {
    let s = pick(CONFRONT_LINES[k]);
    for (const key in (subs || {})) s = s.split('{' + key + '}').join(subs[key]);
    return s;
  };

  await sceneMoment(say('playerSays'));
  await sceneMoment(say(kind));

  /* ---- the consequences ---- */
  npc.idolWarnedDay = GAME.day;                    // read by Idols.wouldPlay
  npc.addVW(P.name, CONFIG.confrontVoteWeight, 'you told them it was them');
  /* Their closest ally hears about it within the hour. */
  const mates = campmates(P).filter(c => c !== npc && !c.isPlayer);
  let ally = null, aw = -Infinity;
  for (const c of mates) { const w = npc.getTrust(c.name) * 0.6 + npc.getRel(c.name) * 0.4; if (w > aw) { aw = w; ally = c; } }
  if (ally && aw > 0.5) ally.addVW(P.name, CONFIG.confrontAllyVoteWeight, 'their friend told them straight');

  if (kind === 'respect') {
    /* The jury remembers who told them the truth. Trust up even as they go. */
    npc.addTrust(P.name, CONFIG.confrontRespectTrust, 'you told them to their face');
    npc.addRel(P.name, CONFIG.confrontRespectTrust * 0.6, 'you told them to their face');
  } else if (kind === 'wounded') {
    npc.addRel(P.name, -CONFIG.confrontWoundedRel, 'you told them it was them');
  } else if (kind === 'defiant') {
    npc.addVW(P.name, CONFIG.confrontDefiantExtra, 'they took it as a declaration');
  }
  /* Lying-wise this is a statement of intent. Honest if it really is your plan;
     a threat if it is not, and one they can find out about later. */
  Lying.evaluate(npc, P, honest ? 'Truth' : 'Lie', 'VoteIntent', npc.name);
  if (!honest) PlayerSecrets.add('SpreadRumor', npc.name, GAME.day);
  addIntel(npc.name, 'heat', npc.name, 'you told them to their face');
  Feed.post(say('wordSpreads', { me: P.displayName }), 'drama', GAME.day);
  Journal.event('confront', {
    who: npc.displayName, honest, reaction: kind,
    warm: +warm.toFixed(2), cluster: C
  });
  DBG.decision('Confront', 'told to their face', {
    who: npc.displayName, honest, reaction: kind, warm: +warm.toFixed(2)
  });

  /* ---- and some of them try to buy their way out ---- */
  const desperate = kind === 'scramble' || kind === 'wounded' || (kind === 'respect' && chance(0.4));
  const offerable = mates.filter(c => c !== ally || aw <= 0.5);
  if (desperate && offerable.length && chance(CONFIG.confrontDealChance)) {
    /* They offer whoever THEY would most like gone — real information about them. */
    let give = null, gw = -Infinity;
    for (const c of offerable) { const w = npc.getVW(c.name); if (w > gw) { gw = w; give = c; } }
    if (!give) give = pick(offerable);
    const took = await new Promise(res => {
      const body = h('div', 'col');
      body.appendChild(h('div', 'probe-said', `${npc.displayName}: “${say('dealOffer', { tn: give.displayName })}”`));
      body.appendChild(h('div', 'tiny dim',
        'Their vote and their legwork, in exchange for tonight. Taking it means you have given your word.'));
      const row = h('div', 'col dilemma-opts');
      const yes = h('button', 'btn primary', `Take the deal — write ${give.displayName}`);
      const no = h('button', 'btn sand', 'No. It is still you.');
      yes.onclick = () => { Modal.close(); res(true); };
      no.onclick = () => { Modal.close(); res(false); };
      row.appendChild(yes); row.appendChild(no);
      body.appendChild(row);
      Modal.open(`${npc.displayName} is offering you something`, body);
    });
    if (took) {
      await sceneMoment(say('dealAccepted', { tn: give.displayName }));
      /* They deliver: hard onto the name, off you, and they bring their friend. */
      npc.addVW(give.name, CONFIG.confrontDealWeight, 'they bought their way out with this name');
      npc.addVW(P.name, -CONFIG.confrontVoteWeight * 1.2, 'you took their deal');
      npc.addTrust(P.name, CONFIG.confrontDealTrust, 'you took their deal');
      if (ally && aw > 0.5) ally.addVW(give.name, CONFIG.confrontDealWeight * 0.6, 'their friend asked them to');
      addIntel(npc.name, 'agreed', give.name, 'they offered this name to save themselves');
      Feed.post(`${npc.displayName} will write ${give.displayName} — and says they can bring one more.`, 'good', GAME.day);
      Journal.event('confrontDeal', { who: npc.displayName, gave: give.displayName, taken: true });
    } else {
      await sceneMoment(say('dealRefused'));
      npc.addVW(P.name, CONFIG.confrontRefusedExtra, 'you turned down their offer');
      Journal.event('confrontDeal', { who: npc.displayName, gave: give.displayName, taken: false });
    }
  }
  renderHUD(); renderActions(); renderLineup();
}

/* ---------------- Morning / challenge ---------------- */
async function runMorning() {
  GAME.probeDoneToday = false;
  GAME.todayImmune = null; GAME.todayLosingTribe = null; GAME.stormDouble = false;
  Weather.roll();
  renderHUD();
  Feed.post(`Day ${GAME.day}. Weather: ${Weather.today}.`, '', GAME.day);
  reportNight();
  /* The tribe gets on with the day. Everyone decides for themselves whether to
     do anything about the camp, and then actually walks off and does it. */
  const work = TribeWork.dailyTick(alive());
  Trace.mark('jobs', (work || []).length);
  if (work && work.length) {
    Beach.stageWork(work);
    if (chance(0.6)) Feed.post(Labour.summarise(work), '', GAME.day);
  } else if (CampNeeds.problems().length) {
    Feed.post('Nobody has lifted a finger around camp today.', 'warn', GAME.day);
  }
  const bad = CampNeeds.problems();
  if (bad.length) Feed.post(CampNeeds.describe(), bad.length > 2 ? 'danger' : 'warn', GAME.day);
  if (!isTribalDay(GAME.day)) {
    /* A reward challenge, on a day with no council. That placement is the whole
       point: on the show a reward is what fills the days between votes, and
       putting one on a tribal day would make it compete with immunity for the
       same morning. Rewards.isRewardDay never returns true on a tribal day, and
       fires on roughly one in three of the rest. */
    if (typeof Rewards !== 'undefined' && Rewards.isRewardDay(GAME.day)
      && !GAME.playerEliminated && !GAME.watchMode) {
      await Rewards.runScreen();
    }
    dailySituation();
    return;
  }

  Tutorial.tip('tribalday', 'Tribal day',
    'Immunity challenge this morning — lose it and your tribe votes tonight. Lock your numbers before dark.');
  seedVoteWeights(GAME.cast, GAME.merged, GAME.player.name);

  /* The weather no longer cancels immunity — see Weather.skipsChallenge, which is
     now always false. A storm makes the challenge harder for everybody instead,
     which is what the show does and, unlike a cancellation, is something you get
     to play. The branch stays because the double-tribal it triggers is a real
     feature worth keeping for a future event that DOES cancel a challenge. */
  if (Weather.skipsChallenge()) {
    if (!GAME.merged) {
      GAME.stormDouble = true;
      Feed.post('The storm cancels the challenge. BOTH tribes go to tribal tonight.', 'danger', GAME.day);
    } else {
      Feed.post('The storm cancels the challenge. No immunity tonight — everyone is exposed.', 'danger', GAME.day);
    }
    dailySituation();
    return;
  }
  if (Weather.today === 'Stormy') {
    Feed.post('The challenge goes ahead in the storm. Nobody is going to enjoy this.', 'drama', GAME.day);
  }
  await runChallengeScreen();
  dailySituation();
}

function dailySituation() {
  // danger + opportunity read
  const p = GAME.player;
  const pool = campmates(p).filter(c => !c.isPlayer);
  let pressure = 0;
  for (const c of pool) pressure += Math.max(0, c.getVW(p.name));
  if (pressure > 1.5) Feed.post('Your name is out there this morning. Move carefully.', 'danger', GAME.day);
  else if (pressure > 0.6) Feed.post('A little heat on you today. Not fatal. Yet.', 'drama', GAME.day);
  const friend = pool.filter(c => c.getRel(p.name) > 0.55 && (GAME.merged || c.tribeName === p.tribeName));
  if (friend.length) Feed.post(`${pick(friend).displayName} seems open to you today.`, 'good', GAME.day);
}

/* Who stands down each side of the arena.

   Pre-merge that is the two tribes, which is the shape the show uses and the
   shape the result takes. Post-merge there are no tribes, so the field is split
   down the middle purely so nine names fit on a phone — the two columns mean
   nothing there and are not labelled as if they do. */
function buildChallengeRoster(chal) {
  if (!GAME.merged) {
    return {
      sides: [
        { label: 'TIDAL', tribe: 'Tidal', members: aliveTribe('Tidal') },
        { label: 'EMBER', tribe: 'Ember', members: aliveTribe('Ember') }
      ]
    };
  }
  const pool = alive();
  const half = Math.ceil(pool.length / 2);
  return {
    sides: [
      { label: 'THE FIELD', tribe: pool[0] ? pool[0].tribeName : null, members: pool.slice(0, half) },
      { label: '', tribe: pool[0] ? pool[0].tribeName : null, members: pool.slice(half) }
    ]
  };
}

/* The order the challenge finished in, kept on the summary screen.

   The rails vanish with the arena, and the point of watching who carried it is
   being able to act on that at camp — so the standings outlive the animation. But
   ALL of them does not: the first version listed the entire field, which pre-merge
   is eighteen rows of bar chart, and it pushed the Continue button clean off a
   344px-tall screen that does not scroll. The player was trapped.

   Two things were wrong and only one of them was the height. Because scores
   cluster, eighteen bars normalised across the field all come out roughly the same
   length — a great deal of screen for almost no signal. So this now shows the few
   rows that carry information:

     - the podium
     - the player, wherever they actually finished
     - whoever is being called out (dead weight, or immune)

   with a rank number on each, because "you were 7th of 12" is the fact the player
   wanted and a bar four fifths as long as the leader's does not say it. */
function renderChallengeStandings(host, pool, opts) {
  const o = opts || {};
  const limit = o.limit || 3;
  const ranked = [...pool].sort((a, b) => b.lastChallengeScore - a.lastChallengeScore);
  if (!ranked.length) return;
  const lo = ranked[ranked.length - 1].lastChallengeScore;
  const hi = ranked[0].lastChallengeScore;
  const span = Math.max(0.12, hi - lo);

  /* Who earns a row: the podium, the player, and anybody tagged. */
  const keep = new Set(ranked.slice(0, limit));
  const me = ranked.find(c => c.isPlayer);
  if (me) keep.add(me);
  if (o.mark) for (const c of ranked) if (o.mark(c)) keep.add(c);

  const box = h('div', 'chal-standings');
  const head = h('div', 'cs-head');
  head.appendChild(h('span', 'tiny dim', o.title || 'How they performed'));
  /* The player's placing as a plain sentence, so it is legible even if their own
     row is the one that got cut on a very small screen. */
  if (me) {
    head.appendChild(h('span', 'cs-rank-note',
      `you: ${ordinal(ranked.indexOf(me) + 1)} of ${ranked.length}`));
  }
  box.appendChild(head);

  let skipped = 0;
  ranked.forEach((c, i) => {
    if (!keep.has(c)) { skipped++; return; }
    /* One gap marker for however many rows were dropped, so the list never
       pretends to be complete. */
    if (skipped) {
      box.appendChild(h('div', 'cs-gap', `+${skipped} more`));
      skipped = 0;
    }
    const row = h('div', 'cs-row' + (c.isPlayer ? ' me' : ''));
    if (c.tribeName && typeof Tribes !== 'undefined') Tribes.mark(row, c.tribeName);
    row.appendChild(h('span', 'cs-pos', String(i + 1)));
    row.appendChild(h('span', 'cs-name', c.displayName));
    const bar = h('div', 'cs-bar');
    const fill = h('i');
    fill.style.width = (clamp01((c.lastChallengeScore - lo) / span) * 100).toFixed(0) + '%';
    bar.appendChild(fill);
    row.appendChild(bar);
    if (o.mark && o.mark(c)) row.appendChild(h('span', 'cs-tag', o.mark(c)));
    box.appendChild(row);
  });
  if (skipped) box.appendChild(h('div', 'cs-gap', `+${skipped} more`));
  host.appendChild(box);
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function runChallengeScreen() {
  return new Promise(resolve => {
    const chal = (alive().length <= 4 ? Challenges.finalFourFire() : Challenges.pickChallenge());
    GAME.lastChallenge = chal;
    /* Name the minigame that is actually about to run, and use ITS rules line, so
       the briefing and the game can never describe different things. */
    const game = Challenge.gameFor(chal);
    /* Immunity spends a minigame too, so the reward system's "no minigame twice a
       season" rule has to hear about it or the same game turns up in both. */
    if (typeof Rewards !== 'undefined') Rewards.noteMinigame(game.id);
    Screens.push('screen-challenge');
    $('chal-title').textContent = GAME.merged ? 'Individual Immunity' : 'Tribal Immunity';
    $('chal-name').textContent = `${chal.name} (${chal.cat})`;
    /* The challenge's own flavour, then the rules of the game you will actually
       play. Previously only the flavour was shown and the minigame could be
       something else entirely. */
    $('chal-desc').textContent = chal.desc + '  —  ' + game.name + ': ' + game.how;
    const statsRow = $('chal-stats');
    statsRow.innerHTML = '';
    /* What this challenge is ABOUT, named — not the weight vector.
       It used to print every stat with its raw multiplier ("Physicality ×0.9"),
       which is the designer's spreadsheet leaking onto the screen: the number is
       meaningless without the others to compare it against, and no commentator
       has ever said "this one is zero point nine physicality". A castaway is told
       what kind of test it is, so the player is too. A genuine co-lead gets named
       as well, because "physical AND mental" is real information; a mere
       second-place weight does not. */
    const lead = STAT_KEYS
      .map((k, i) => ({ k, w: chal.w[i] }))
      .sort((a, b) => b.w - a.w);
    if (lead[0] && lead[0].w > 0) {
      statsRow.appendChild(h('span', 'chip', STAT_LABELS[lead[0].k]));
      if (lead[1] && lead[1].w >= lead[0].w * 0.8) {
        statsRow.appendChild(h('span', 'chip', STAT_LABELS[lead[1].k]));
      }
    }
    $('chal-result').innerHTML = '';
    $('btn-chal-go').classList.remove('hidden');
    $('btn-chal-done').classList.add('hidden');

    $('btn-chal-go').onclick = async () => {
      $('btn-chal-go').classList.add('hidden');
      const res = $('chal-result');
      res.innerHTML = '';
      /* The player actually competes. Eliminated / watch-mode players sit it out
         and fall back to the stat roll. */
      setPlayerChallengePerf(null);
      /* Roll everyone's form BEFORE the player plays, so the rails down the sides
         of the arena can show a real contest rather than an animation. The player
         is not pre-rolled — their number is the minigame they are about to play. */
      const field = GAME.merged ? alive() : aliveTribe('Tidal').concat(aliveTribe('Ember'));
      Challenges.prescore(chal, field);
      Challenge.setRoster(buildChallengeRoster(chal));
      /* The player's own chip climbs off their live minigame score, projected
         through the same formula that will settle it. */
      Challenge.onScore = v => { Challenges.projectPlayer(chal, v); };
      if (!GAME.playerEliminated && !GAME.watchMode) {
        const perf = await Challenge.play(chal, GAME.player);
        setPlayerChallengePerf(perf);
      }
      if (!GAME.merged) {
        const tidal = aliveTribe('Tidal'), ember = aliveTribe('Ember');
        const winner = Challenges.runTribal(chal, tidal, ember);
        const winTribe = winner === 'A' ? 'Tidal' : 'Ember';
        const loseTribe = winner === 'A' ? 'Ember' : 'Tidal';
        GAME.todayLosingTribe = loseTribe;
        applyImmunityWinBoost(winner === 'A' ? tidal : ember);
        // weakest on losing tribe takes heat
        const losers = aliveTribe(loseTribe);
        const weakest = losers.reduce((a, b) => a.lastChallengeScore < b.lastChallengeScore ? a : b);
        for (const m of losers) if (m !== weakest) m.addVW(weakest.name, CONFIG.voteWeightChallengeFailPreMerge, 'they lost the challenge for us');
        res.appendChild(h('div', 'display', `${winTribe} wins immunity`));
        res.appendChild(h('div', '', `${loseTribe} goes to tribal council tonight.`));
        /* The player's OWN tribe only. The other tribe's internal ordering is
           information the player cannot act on — they do not live there and cannot
           talk to them — and showing both put eighteen rows on a screen that fits
           about six. The losing tribe's weak link still gets said out loud below
           when it is somebody else's problem. */
        const mine = aliveTribe(GAME.player.tribeName);
        renderChallengeStandings(res, mine, {
          title: `${GAME.player.tribeName}: who carried it`,
          mark: c => (c === weakest ? 'dead weight' : '')
        });
        /* Only as a line when the weak link is on the OTHER tribe — on ours the
           standings row already says it, and saying it twice was half the clutter. */
        if (mine.indexOf(weakest) < 0) {
          res.appendChild(h('div', 'tiny dim', `${weakest.displayName} struggled for ${loseTribe}.`));
        }
        Feed.post(`${winTribe} wins the ${chal.name}. ${loseTribe} faces the fire.`, winTribe === GAME.player.tribeName ? 'good' : 'danger', GAME.day);
        Journal.challenge({
          kind: 'tribal', chal: chal.name, cat: chal.cat, game: game.id,
          perf: GAME.playerPerf, playerScore: +(GAME.player.lastChallengeScore || 0).toFixed(3),
          playerWon: winTribe === GAME.player.tribeName, winner: winTribe,
          field: aliveTribe(GAME.player.tribeName).length, weakest: weakest.displayName
        });
      } else {
        const pool = alive();
        const winner = Challenges.runIndividual(chal, pool);
        GAME.todayImmune = winner;
        winner.morale = clamp01(winner.morale + CONFIG.immunityWinMoraleBoost);
        if (!winner.isPlayer) {
          for (const v of pool) if (v !== winner && v.stats.gameAwareness > 0.5)
            v.addVW(winner.name, CONFIG.voteWeightChallengeStrongPostMerge, 'too strong to leave in');
        }
        res.appendChild(h('div', 'display', `${winner.displayName} wins individual immunity`));
        renderChallengeStandings(res, pool, {
          title: 'Final standings',
          mark: c => (c === winner ? 'IMMUNE' : '')
        });
        Feed.post(`${winner.displayName} wins immunity at ${chal.name}.`, winner.isPlayer ? 'good' : '', GAME.day);
        Beach.emote(winner.name, 'cheer');
        const ranked = [...pool].sort((a, b) => b.lastChallengeScore - a.lastChallengeScore);
        Journal.challenge({
          kind: 'individual', chal: chal.name, cat: chal.cat, game: game.id,
          perf: GAME.playerPerf, playerScore: +(GAME.player.lastChallengeScore || 0).toFixed(3),
          playerWon: winner.isPlayer, winner: winner.displayName,
          rank: ranked.indexOf(GAME.player) + 1, field: pool.length,
          field_scores: ranked.slice(0, 5).map(c => c.displayName + ' ' + c.lastChallengeScore.toFixed(2))
        });
      }
      GAME.hoursRemaining = Math.max(0, GAME.hoursRemaining - CONFIG.challengeTimeCost);
      /* The briefing is spent. Collapsing it is what keeps the result inside the
         viewport — see the .resulting rules in css/challenges.css. */
      $('screen-challenge').classList.add('resulting');
      $('btn-chal-done').classList.remove('hidden');
    };
    $('btn-chal-done').onclick = () => {
      /* The cached form is only good for this challenge. Left set, the next one
         would hand back yesterday's rolls. */
      Challenges.clearPrescore();
      Challenge.onScore = null;
      Challenge.setRoster(null);
      $('screen-challenge').classList.remove('resulting');
      Screens.pop();
      renderHUD(); renderActions(); renderLineup();
      resolve();
    };
  });
}

/* ---------------- End day / night sequence ---------------- */
async function endDay() {
  Tutorial.notify('endday');
  dismissApproach();
  GAME.hoursRemaining = 0;
  renderHUD();
  dailySurvivalTick(alive());
  /* Rewards that last more than a night — a tarp, blankets, fishing gear — pay out
     once per day here, BEFORE the camp decays, so a tarp is actually holding the
     shelter up rather than topping it up after the rain got in. */
  if (typeof Rewards !== 'undefined') Rewards.tickDay();
  /* Nightfall on the camp: everything runs down, then the tribe quietly settles
     up on who has been carrying it and who has not. */
  CampNeeds.decay(campPool());
  Ledger.roll(alive());
  Ledger.socialDrift(alive());

  // random events
  const ev = checkDailyEvent(alive());
  if (ev) {
    const line = pick(ev.type === 'Medivac' ? DIALOGUE.peff.medivac : DIALOGUE.peff.quit).replace('{name}', ev.who.displayName);
    await peffMoment(ev.type === 'Medivac' ? 'MEDICAL EVACUATION' : 'QUIT', line);
    removeFromGame(ev.who, ev.type.toLowerCase());
    Trace.mark('left', { who: ev.who.displayName, kind: ev.type, cause: ev.cause || '' });
    Feed.post(`${ev.who.displayName} has left the game — ${ev.cause || ev.type.toLowerCase()}.`,
      'danger', GAME.day);
    await advanceDay();
    return;
  }

  if (isTribalDay(GAME.day)) {
    if (GAME.stormDouble && !GAME.merged) {
      // both tribes vote — player's tribe interactive first? order: player's tribe last for drama
      const other = GAME.player.tribeName === 'Tidal' ? 'Ember' : 'Tidal';
      await runAutoTribal(aliveTribe(other));
      if (!GAME.playerEliminated) await runTribal(aliveTribe(GAME.player.tribeName));
    } else if (GAME.merged) {
      await runTribal(alive());
    } else {
      const losing = GAME.todayLosingTribe || (GAME.player.tribeName === 'Tidal' ? 'Ember' : 'Tidal');
      const pool = aliveTribe(losing);
      if (losing === GAME.player.tribeName) await runTribal(pool);
      else await runAutoTribal(pool);
    }
    if (!GAME.seasonActive) return;

    // swap & merge
    if (GAME.day === CONFIG.swapAfterDay && !GAME.merged && !GAME.swapped) doTribeSwap();
    if (!GAME.merged && GAME.day >= CONFIG.mergeAfterDay) doMerge();
  }

  /* Close the day's trace row and publish. Every single day, so a season that
     ends on a phone is already readable by the time anybody asks about it. */
  Trace.close();
  const done = seasonShouldEnd();
  Telemetry.ping(done ? 'season' : 'day');

  if (done) { await runFinale(); return; }
  await advanceDay();
}

async function advanceDay() {
  GAME.day++;
  if (isTribalDay(GAME.day - 1) && !GAME.playerEliminated) Tutorial.notify('survived');
  if (seasonShouldEnd()) { await runFinale(); return; }
  GAME.hoursRemaining = CONFIG.hoursPerDay;
  /* What the camp does back to you while you sleep. Resolved before recovery so
     a night that wrecked everyone actually costs the tribe its rest. */
  GAME.nightEvent = Nights.roll(campPool());
  applySleepRecovery(alive(), false);
  CallOut.newDay();
  for (const c of alive()) { c.interactionBudget = CONFIG.npcInteractionBudget; c.playerConvosThisPhase = 0; }
  const circleBefore = Coalitions.active(GAME.player.name);
  SocialDynamics.onDayStart(alive(), GAME.day);
  if (circleBefore && circleBefore.broken) {
    Feed.post(circleBefore.breakReason === 'trust_fracture'
      ? 'Your pact fractured overnight — the trust broke down.'
      : 'Your pact is gone.', 'danger', GAME.day);
  }
  Save.write();
  enterCamp();
  await runMorning();
}

function removeFromGame(c, reason) {
  c.eliminated = true;
  GAME.totalEliminated++;
  if (GAME.totalEliminated >= Jury.JURY_STARTS_AT && GAME.jury.length < Jury.JURY_SIZE) GAME.jury.push(c);
  else GAME.eliminatedPreFinal.push(c);
  processEliminationReaction(GAME.cast, c);
  if (c.isPlayer) {
    GAME.playerEliminated = true;
    Tutorial.forceComplete();
    /* Your run just ended. Get it uploaded now rather than hoping another day
       loop comes around to do it. */
    Trace.close();
    Telemetry.ping('season');
  }
}

/* ---------------- Tribal council (interactive) ---------------- */
function peffMoment(tag, text) {
  return new Promise(res => {
    Screens.push('screen-finale');
    $('finale-peff-text').textContent = text;
    $('finale-body').innerHTML = '';
    const b = $('btn-finale-next');
    b.textContent = 'Continue';
    b.onclick = () => { Screens.pop(); res(); };
  });
}

async function runTribal(pool) {
  SocialDynamics.applyHerdCollapsePrevention(pool, GAME.todayImmune);
  SocialDynamics.applyLastMinuteScramble(pool.filter(c => !c.isPlayer));

  /* Peff welcomes them in, then works the bench about things that actually
     happened this week. This runs FIRST, before the whispering and long before the
     grid of faces, because arriving straight at "tap who to vote out" is what made
     council feel like a menu instead of a scene. See docs/tribal-qa.md. */
  await TribalQA.run(pool);

  /* Before anybody votes: the bench. On the show this is where a council either
     stays a formality or comes apart, and it happens BEFORE the vote because
     afterwards there is nothing left to change. */
  await Whisper.run(pool);

  const playerVote = await tribalVoteScreen(pool);
  const votes = new Map();
  if (playerVote) votes.set(GAME.player.name, playerVote);
  for (const v of pool) {
    if (v.isPlayer) continue;
    const t = Voting.calculateVote(v, pool, GAME.todayImmune, GAME.merged, GAME.day, GAME.player.name);
    if (t) votes.set(v.name, t);
  }
  // promise breaks
  if (playerVote) {
    const al = PlayerAlliances.get(playerVote.name);
    if (al && al.level >= 2 && al.promisedTribal === GAME.day) {
      PlayerAlliances.breakPromise(playerVote.name, GAME.cast);
      Feed.post(DIALOGUE.feedStrings.promiseBreak.replace('{name}', playerVote.displayName), 'danger', GAME.day);
    }
  }
  await revealVotes(votes, pool);
}

async function runAutoTribal(pool) {
  const votes = new Map();
  for (const v of pool) {
    const t = Voting.calculateVote(v, pool, null, GAME.merged, GAME.day, GAME.player.name);
    if (t) votes.set(v.name, t);
  }
  let { eliminated, tied } = Voting.tally(votes);
  const elimName = eliminated || pick(tied);
  const elim = pool.find(c => c.name === elimName);
  finishTribal(votes, elim, pool, false);
  Feed.post(`At the other tribe's council, ${elim.displayName} was voted out.`, 'drama', GAME.day);
  toast(`${elim.displayName} was voted out at the other tribal.`);
}

function tribalVoteScreen(pool) {
  return new Promise(resolve => {
    Screens.push('screen-tribal');
    $('tribal-peff-text').textContent = pick(DIALOGUE.peff.voteTime);
    Tutorial.tip('vote', 'Casting your vote',
      'Tap who you want gone, then confirm. Everyone weighs trust, threat and promises — a lie told earlier can surface at the reveal.');
    const grid = $('tribal-grid');
    grid.innerHTML = '';
    let selected = null;
    const confirm = $('btn-vote-confirm');
    confirm.disabled = true;
    /* EVERYBODY is shown, including whoever holds immunity — they are just not
       selectable.

       Reported as a bug: "when i reach the final vote one of the options (somehow
       it's always the one i'm aiming for) disappears when i get to tribal, i can't
       vote for them." The exclusion was correct; showing nothing was not. A name
       that was on the beach all day and is simply absent from the ballot reads as
       the game losing it, and the player is left with no idea why.

       The "always the one I'm aiming for" part is real and is not the game
       cheating: you aim at the biggest threat, and the biggest threat is the most
       likely person to win immunity. That is Survivor. But it is only fair if you
       can SEE that is what happened, which is what this fixes. */
    const shown = pool.filter(c => c !== GAME.player);
    const immune = GAME.todayImmune;
    /* Post-merge the roster is big; drop to a tighter card so a full jury-era
       tribe still fits the screen instead of scrolling. */
    const dense = shown.length > 9;
    grid.classList.toggle('dense', dense);
    $('screen-tribal').classList.toggle('dense-roster', dense);
    /* Immune last, so the ballot proper reads first and the unavailable card does
       not sit in the middle of the people you can actually pick. */
    const ordered = shown.filter(c => c !== immune).concat(shown.filter(c => c === immune));
    for (const c of ordered) {
      const safe = c === immune;
      /* Same card as every other roster — so the bond/trust bars are right there
         while voting, which is exactly when you want to read them. */
      const read = intelLatestVoteRead(c.name);
      const vw = GAME.player.getVW(c.name);
      const sub = safe ? 'wears the necklace'
        : read ? `says: ${dnOf(read.target)}` : (vw > 0.5 ? 'your target' : c.occupation);
      const card = castCard(c, sub, read && !safe ? 'intel' : '');
      if (safe) {
        /* The stamp itself comes from castCard now, so it is identical everywhere.
           This class is only the ballot's extra: dimmed and not selectable. */
        card.classList.add('immune-card');
        /* Tapping it explains itself rather than doing nothing, because a dead tap
           is how the player concluded the name had gone missing in the first place. */
        card.addEventListener('click', () => {
          toast(`${c.displayName} won immunity tonight. They cannot be voted for.`);
        });
      } else {
        card.addEventListener('click', () => {
          grid.querySelectorAll('.cast-card').forEach(x => x.classList.remove('selected'));
          card.classList.add('selected');
          selected = c;
          confirm.disabled = false;
          confirm.textContent = `Vote ${c.displayName}`;
        });
      }
      grid.appendChild(card);
    }
    /* And say it in words at the top, where Peff would. */
    if (immune) {
      $('tribal-peff-text').textContent = pick(DIALOGUE.peff.voteTime)
        + ` ${immune.displayName} is wearing immunity and cannot be voted for.`;
    }
    /* Nobody left to vote for. Reachable if an evacuation or a storm double drops
       the council to the player plus one immune castaway — rare, but the confirm
       button is disabled until something is selected, so without this the player
       sits on a screen with no way forward at all. revealVotes copes fine with the
       player simply not appearing in the votes map. */
    if (!ordered.some(c => c !== immune)) {
      grid.appendChild(h('div', 'tiny dim',
        'There is nobody here you are allowed to vote for.'));
      confirm.disabled = false;
      confirm.textContent = 'No vote to cast';
    }
    confirm.onclick = () => {
      Screens.pop();
      resolve(selected);
    };
  });
}

/* One round of vote-reading, one parchment at a time.

   Extracted so a deadlock can be WATCHED instead of computed. The old version
   resolved the tie silently, reassigned `votes` to the revote, and then revealed
   only the revote — so a deadlock arrived as a fait accompli and the player never
   saw the votes that produced it. That is the reported bug: "never go straight to
   the draw, first show me the votes leading up to it."

   `landOn` is the name whose vote should be read last, so the round builds to its
   own conclusion. On a tie there is no such name and the order is simply shuffled,
   which is correct — a tie has no decisive vote, and pretending otherwise would
   telegraph the outcome. */
function revealRound(votes, opts) {
  const o = opts || {};
  return new Promise(resolve => {
    Screens.push('screen-reveal');
    $('reveal-peff-text').textContent = o.headline || pick(DIALOGUE.peff.voteRead);
    const slot = $('reveal-slot');
    const tallyRow = $('reveal-tally');
    slot.innerHTML = ''; tallyRow.innerHTML = '';
    const order = shuffle([...votes.entries()]);
    if (o.landOn) {
      const idx = order.findIndex(([, t]) => t && t.name === o.landOn);
      if (idx >= 0) order.push(...order.splice(idx, 1));
    }
    const running = {};
    let i = 0;
    const btn = $('btn-reveal-next');
    btn.textContent = o.firstLabel || 'Read the votes';
    btn.onclick = () => {
      if (i < order.length) {
        const [voterName, target] = order[i];
        slot.innerHTML = '';
        const p = h('div', 'vote-parchment', target.displayName);
        slot.appendChild(p);
        /* A vote voided by an idol is still READ — that is what makes an idol
           land — it just does not count toward anything. */
        const voided = o.voided && o.voided.indexOf(voterName) >= 0;
        if (voided) {
          p.classList.add('voided');
          slot.appendChild(h('div', 'tiny dim', 'Does not count.'));
        } else {
          running[target.name] = (running[target.name] || 0) + 1;
        }
        tallyRow.innerHTML = '';
        const last = i === order.length - 1;
        for (const [n, ct] of Object.entries(running)) {
          const c = GAME.cast.find(x => x.name === n);
          const hot = last && o.landOn && n === o.landOn;
          tallyRow.appendChild(h('span', 'chip' + (hot ? ' bad' : ''), `${c ? c.displayName : n}: ${ct}`));
        }
        i++;
        if (i >= order.length) btn.textContent = o.lastLabel || 'The tribe has spoken';
      } else {
        Screens.pop();
        resolve();
      }
    };
  });
}

async function revealVotes(votes, pool) {
  // Lying retro-validation
  for (const [voterName, target] of votes) {
    const voter = GAME.cast.find(c => c.name === voterName);
    if (voter) Lying.onVoteCast(voter, target.name, GAME.cast);
  }

  /* ---- the idol beat ----
     Votes are in, nothing has been read. This is the one moment an idol works,
     and it is the most dramatic thirty seconds in the format precisely because
     the room has already committed and cannot take it back. */
  const idol = await idolBeat(votes, pool);
  const voided = idol ? idol.voided : [];

  let { eliminated, tied, counts } = Voting.tally(votes, voided);
  let hadRocks = false;

  /* Round one, in full, whatever it produces. */
  await revealRound(votes, {
    headline: pick(DIALOGUE.peff.voteRead),
    landOn: eliminated || null,
    voided,
    lastLabel: eliminated ? 'The tribe has spoken' : 'That is a tie'
  });

  let elimName = eliminated;

  /* An idol that wiped out EVERY vote. The rarest thing this format produces, and
     it needs its own branch: there is no tie to break because there is nothing to
     count. The show's answer is a fresh vote with the idol-holder off the table,
     so that is the answer here. Without this the deadlock branch below would run
     with an empty tie list and hand out an undefined name. */
  if (!elimName && (!tied || !tied.length)) {
    const safe = idol ? idol.who : null;
    const revoters = pool.filter(c => c !== safe);
    const targets = pool.filter(c => c !== safe && c !== GAME.todayImmune);
    await peffMoment('EVERY VOTE, GONE',
      'That idol cancelled every vote cast tonight. There is nothing to count.'
      + (safe ? ` ${safe.displayName} cannot be voted for. Everybody else, again.` : ''));
    const rv = new Map();
    for (const v of revoters) {
      if (v.isPlayer) {
        const opts = targets.filter(c => !c.isPlayer);
        if (!opts.length) break;
        const t = await new Promise(res => {
          openCastPicker('VOTE AGAIN — the idol wiped the slate.', opts, c => { Modal.close(); res(c); });
        });
        rv.set(v.name, t);
      } else {
        const t = Voting.calculateVote(v, targets.concat([v]), safe, GAME.merged, GAME.day, GAME.player.name);
        if (t && t !== safe) rv.set(v.name, t);
      }
    }
    const again = Voting.tally(rv);
    await revealRound(rv, {
      headline: 'Again. And this one counts.',
      landOn: again.eliminated || null,
      firstLabel: 'Read them'
    });
    elimName = again.eliminated || (again.tied.length ? pick(again.tied) : (targets[0] && targets[0].name));
    votes = rv;
    counts = again.counts;
    tied = [];
  }

  if (!elimName) {
    /* A deadlock, announced only now that it has been watched happening. */
    const tiedCast = tied.map(n => pool.find(c => c.name === n)).filter(Boolean);
    const names = tiedCast.map(c => c.displayName).join(' and ');
    /* Leave a trace. Only the FINAL tally gets recorded as the ballot, so after a
       revote there is nothing in the journal with a zero margin and a council that
       deadlocked looks identical to one that did not. Peff should be able to bring
       up a tie at the next council, and it is unambiguously public — he announced
       it to the room himself. Read by TribalRead.fLastTie. */
    Journal.event('deadlock', names);
    await peffMoment('DEADLOCK',
      `${names}. We have a tie. We will go again — and this time ${names} do not vote,`
      + ` and nobody else can vote for anyone but them.`);
    /* And the warning the player asked for, before they commit to round two. */
    await peffMoment('THIS CAN GET STICKY',
      'If it ties a second time, nobody votes again. The two of them are safe, and'
      + ' everybody else draws a rock. Whoever draws the odd one out goes home.'
      + ' Think about that before you write a name.');

    const revoters = pool.filter(c => !tied.includes(c.name));
    const rv = new Map();
    for (const v of revoters) {
      if (v.isPlayer) {
        const t = await new Promise(res => {
          openCastPicker('REVOTE — one of these two. A second tie means rocks.',
            tiedCast, c => { Modal.close(); res(c); });
        });
        rv.set(v.name, t);
      } else {
        const t = Voting.calculateVote(v, [...tiedCast, v], null, GAME.merged, GAME.day, GAME.player.name);
        rv.set(v.name, t && tied.includes(t.name) ? t : pick(tiedCast));
      }
    }
    const second = Voting.tally(rv);
    await revealRound(rv, {
      headline: 'Second vote. Same two names.',
      landOn: second.eliminated || null,
      firstLabel: 'Read them',
      lastLabel: second.eliminated ? 'The tribe has spoken' : 'Tied again'
    });

    if (second.eliminated) {
      elimName = second.eliminated;
    } else {
      hadRocks = true;
      const rockEligible = pool.filter(c => !tied.includes(c.name) && c !== GAME.todayImmune);
      const src = rockEligible.length ? rockEligible : tiedCast;
      const drawn = pick(src);
      await peffMoment('ROCKS',
        'Tied again. ' + names + ' are safe. Everybody else draws.'
        + ' There is one purple rock in the bag and it decides this.');
      await peffMoment('THE ODD ROCK', `${drawn.displayName} draws the purple rock.`);
      elimName = drawn.name;
    }
    votes = rv;
    counts = Voting.tally(rv).counts;
  }

  const elim = pool.find(c => c.name === elimName) || GAME.cast.find(c => c.name === elimName);

  /* Going home with one in your pocket. It happens on the show constantly and it
     is always worth saying out loud. */
  if (elim && !elim.isPlayer && Idols.wastedOn(elim)) {
    Inventory.remove(elim, 'idol');
    await peffMoment('IT WAS IN THEIR POCKET',
      pick(IDOL_LINES.reactionUnplayed).replace(/\{name\}/g, elim.displayName));
    Feed.post(`${elim.displayName} left with a hidden immunity idol they never played.`, 'drama', GAME.day);
  }

  const snuffLine = elim.isPlayer ? pick(DIALOGUE.peff.playerOut) : pick(DIALOGUE.peff.snuff).replace('{name}', elim.name);
  await peffMoment(hadRocks ? 'SNUFF' : 'SNUFF', snuffLine);
  finishTribal(votes, elim, pool, true);
  if (elim.isPlayer) {
    Feed.post('Your torch is out. But the season goes on…', 'danger', GAME.day);
    GAME.watchMode = true;
  } else {
    Feed.post(`${elim.displayName} — the tribe has spoken. (${counts.get(elimName) || '?'} votes)`, 'danger', GAME.day);
  }
  Save.write();
}

/* ---- "If anybody has a hidden immunity idol..." ----
   Asked of everybody, answered by whoever is holding one. The player gets a real
   decision with no hint attached; the NPCs decide from what they BELIEVE the vote
   is, which is how idols get wasted. Returns {who, voided} or null. */
/* The silence after the question. Its own beat, because that is what it is on the
   show: Peff asks, and then nothing happens for a while, and everybody looks at
   everybody. The answer is "…" and then either the council moves on or somebody
   stands up. */
function idolSilence() {
  return new Promise(res => {
    const screen = $('screen-finale');
    Screens.push('screen-finale');
    /* The "…" is the ROOM's answer, not Peff's line — so the Peff tag comes off
       for this beat. Left on, the screen reads "Peff: …", which attributes the
       silence to the one person in the clearing who is not being silent. */
    screen.classList.add('silent-beat');
    $('finale-peff-text').textContent = '';
    const body = $('finale-body');
    body.innerHTML = '';
    body.appendChild(h('div', 'idol-dots', '…'));
    /* What the silence looks like tonight. The ritual is identical every council;
       the room never is. */
    body.appendChild(h('div', 'idol-silence', pick(IDOL_LINES.silence)));
    const b = $('btn-finale-next');
    b.textContent = 'Continue';
    b.onclick = () => {
      screen.classList.remove('silent-beat');
      Screens.pop();
      res();
    };
  });
}

async function idolBeat(votes, pool) {
  /* ASKED EVERY COUNCIL, whether or not anybody is holding one.

     This used to be gated on somebody actually having an idol, on the reasoning
     that asking every night would wear the moment out. That was wrong twice over.

     First, the repetition IS the moment: the night somebody stands up only lands
     because you have watched nobody stand up nine times. Peff asks at every single
     council on the show, without exception, and the pause afterwards is the most
     reliably tense fifteen seconds in the format.

     Second — and this is the real bug — gating it LEAKED INFORMATION. The question
     appearing at all told the player that an idol was in play, which is precisely
     the thing nobody is supposed to know. Now the ritual is constant and carries
     no signal, so the only way to suspect an idol is to have earned that suspicion
     some other way. */
  await peffMoment('HIDDEN IMMUNITY IDOL', pick(IDOL_LINES.peffAsk));
  await idolSilence();

  const holders = pool.filter(c => Inventory.has(c, 'idol') && c !== GAME.todayImmune);
  /* Nobody has one. The council simply continues — no extra screen, because the
     silence WAS the answer. */
  if (!holders.length) return null;

  let player = null, wasPrompted = false;
  if (Inventory.has(GAME.player, 'idol') && !GAME.playerEliminated && GAME.todayImmune !== GAME.player) {
    wasPrompted = true;
    const heat = pool.reduce((s, c) => s + (c === GAME.player ? 0 : Math.max(0, c.getVW(GAME.player.name))), 0);
    const chosen = await new Promise(res => {
      const body = h('div', 'col');
      body.appendChild(h('div', '', pick(IDOL_LINES.playerPrompt)));
      /* The only read they get is the one they have earned — their own sense of
         the heat on them, described rather than numbered. Never the tally. */
      body.appendChild(h('div', 'tiny dim', heat > 1.6 ? 'Your name has been everywhere today.'
        : heat > 0.7 ? 'There was some heat on you today.'
          : 'You have not heard your own name much today. That is not the same as being safe.'));
      const row = h('div', 'col dilemma-opts');
      const playBtn = h('button', 'btn danger', pick(IDOL_LINES.playerPlay));
      const holdBtn = h('button', 'btn', pick(IDOL_LINES.playerHold));
      playBtn.onclick = () => { Modal.close(); res(true); };
      holdBtn.onclick = () => { Modal.close(); res(false); };
      row.appendChild(playBtn); row.appendChild(holdBtn);
      body.appendChild(row);
      Modal.open('You are holding an idol', body);
    });
    if (chosen) player = GAME.player;
  }

  /* NPCs, in a fixed order so two idols in one night resolve deterministically. */
  let npcPlayer = null;
  for (const c of holders) {
    if (c.isPlayer) continue;
    if (Idols.wouldPlay(c, pool)) { npcPlayer = c; break; }
  }

  const who = player || npcPlayer;
  if (!who) {
    /* Nobody stood up. The number of screens the player taps through has to be
       IDENTICAL to a council where nobody was holding one at all — otherwise the
       screen count itself is a tell, and a player who notices "three beats
       tonight instead of two" has learned an idol is in play for free. Same
       reasoning as un-gating the question in the first place.

       The one exception is when the PLAYER was the holder and declined: they
       already know what they just did, so a beat acknowledging it leaks nothing
       and the decision deserves the punctuation. */
    if (wasPrompted) await peffMoment('NO IDOL', pick(IDOL_LINES.peffNoIdol));
    return null;
  }

  const voided = Idols.play(who, votes);
  const verdict = Idols.judge(voided.length);
  await peffMoment(who.isPlayer ? 'YOU PLAY IT' : 'AN IDOL',
    (voided.length ? pick(IDOL_LINES.peffIdolValid) : pick(IDOL_LINES.peffIdolWasted))
      .replace(/\{name\}/g, who.displayName));
  await peffMoment('THE BENCH',
    voided.length ? pick(IDOL_LINES.reactionShock) : pick(IDOL_LINES.reactionWasted));

  Feed.post(voided.length
    ? `${who.displayName} played a hidden immunity idol. ${voided.length} vote${voided.length === 1 ? '' : 's'} wiped out.`
    : `${who.displayName} played an idol on a night nobody was coming for them.`,
    voided.length ? 'drama' : 'good', GAME.day);
  Journal.event('idolPlayed', {
    who: who.displayName, voided: voided.length, verdict, day: GAME.day, byPlayer: !!who.isPlayer
  });
  /* Playing one is a statement. Everybody now knows this person had a card and is
     capable of hiding it, and post-merge that is a threat read. */
  for (const o of pool) {
    if (o === who || o.isPlayer) continue;
    o.addVW(who.name, CONFIG.idolPlayedThreat, 'they had an idol and hid it');
  }
  return { who, voided };
}

function finishTribal(votes, elim, pool, interactive) {
  const votesByName = new Map([...votes.entries()].map(([v, t]) => [v, t.name]));
  removeFromGame(elim, 'voted out');
  const betrayers = NpcAlliances.processTribalOutcome(votesByName, elim, GAME.cast);
  /* Did the plan hold? Reviewed BEFORE processTribalOutcome, because that one can
     break the circle for betrayal and there would be nothing left to review. This
     is the feedback that makes a meeting worth having: you called the name, and
     now you find out who actually wrote it. */
  const myCircle = Coalitions.active(GAME.player.name);
  const review = myCircle ? Coalitions.reviewPlan(myCircle, votesByName, GAME.cast) : null;
  if (review && interactive) {
    const tn = dnOf(review.target);
    if (review.broke.length === 0) {
      Feed.post(`Your pact held. Every one of them wrote ${tn}.`, 'good', GAME.day);
    } else if (review.kept.length === 0) {
      Feed.post(`Nobody in your pact wrote ${tn}. You were on your own in there.`, 'danger', GAME.day);
    } else {
      Feed.post(`${review.broke.map(m => m.displayName).join(' and ')} went off the plan.`
        + ` ${review.kept.length} of you wrote ${tn}.`, 'drama', GAME.day);
    }
  }
  Coalitions.processTribalOutcome(votesByName, GAME.cast);
  for (const b of betrayers) {
    const c = GAME.cast.find(x => x.name === b);
    if (c && interactive) Feed.post(`${c.displayName} flipped on an ally. People saw.`, 'drama', GAME.day);
  }
  SocialDynamics.applySurvivalParanoia(votesByName, elim, GAME.cast);
  SocialDynamics.applyGrudges(votesByName, GAME.cast);
  GAME.tribalLog.push({
    day: GAME.day,
    votes: [...votesByName.entries()].map(([v, t]) => {
      const vc = GAME.cast.find(c => c.name === v), tc = GAME.cast.find(c => c.name === t);
      return `${vc ? vc.displayName : v} → ${tc ? tc.displayName : t}`;
    }),
    eliminated: elim.displayName
  });
  /* Machine-readable ballot history, so castaways can be asked about past votes
     and caught contradicting a council the player actually sat through. */
  GAME.voteHistory.push({
    day: GAME.day, eliminated: elim.name,
    votes: [...votesByName.entries()],
    witnessed: !!interactive && !GAME.playerEliminated
  });
  while (GAME.voteHistory.length > 8) GAME.voteHistory.shift();
  /* Morale cares whether the vote went your way and whether you took votes. */
  if (interactive && !GAME.playerEliminated) {
    const myVote = votesByName.get(GAME.player.name);
    GAME.lastVoteWentMyWay = myVote ? (myVote === elim.name) : null;
    GAME.gotVotesLastTribal = [...votesByName.values()].indexOf(GAME.player.name) >= 0;
  }
  GAME.lastEliminatedName = elim.name;
  recordSharedWins(votesByName, elim, interactive);
}

/* The most recent council this castaway actually sat at, with their ballot. */
function lastVoteOf(name) {
  for (let i = GAME.voteHistory.length - 1; i >= 0; i--) {
    const h = GAME.voteHistory[i];
    const entry = h.votes.find(([v]) => v === name);
    if (entry) return { day: h.day, target: entry[1], witnessed: h.witnessed, eliminated: h.eliminated };
  }
  return null;
}
/* Everyone who sat at that council — they saw the reveal, so they cannot be
   lied to about it. */
function attendedTribal(day, name) {
  const h = GAME.voteHistory.find(x => x.day === day);
  return !!h && h.votes.some(([v]) => v === name);
}
const hasTribalHistory = () => GAME.voteHistory.length > 0;

/* ---- Shared wins: "that vote worked" ----
   Anyone who wrote the same name as the player on a night the player was there
   and that name went home. Snapshot how each voter felt about the target at the
   time, because celebrating over someone they actually liked should land badly
   even if their stored bond drifts later. */
function recordSharedWins(votesByName, elim, interactive) {
  if (!interactive || GAME.playerEliminated) return;
  const myVote = votesByName.get(GAME.player.name);
  if (!myVote || myVote !== elim.name) return;
  for (const [voter, target] of votesByName.entries()) {
    if (voter === GAME.player.name || target !== elim.name) continue;
    const c = GAME.cast.find(x => x.name === voter);
    if (!c || c.eliminated) continue;
    GAME.sharedWins.push({
      name: voter, target: elim.name, day: GAME.day,
      bondWithTarget: +c.getRel(elim.name).toFixed(3),
      celebrated: false
    });
  }
  const partners = GAME.sharedWins.filter(w => w.day === GAME.day).map(w => dnOf(w.name));
  DBG.decision('SharedWin', 'recorded', { target: elim.name, day: GAME.day, partners });
  if (partners.length) {
    Feed.post(`Your vote landed. ${partners.length === 1 ? partners[0] + ' wrote it too' :
      partners.length + ' others wrote it too'} — worth marking.`, 'good', GAME.day);
  }
}

/* Fresh = the vote was last night. Gloating days later is not a celebration. */
function freshSharedWin(name) {
  return GAME.sharedWins.find(w => w.name === name && !w.celebrated && GAME.day - w.day <= 1);
}

/* ---------------- Swap & merge ---------------- */
function doTribeSwap() {
  GAME.swapped = true;
  const before = Object.fromEntries(alive().map(c => [c.name, c.tribeName]));
  const pool = shuffle([...alive()]);
  pool.forEach((c, i) => c.tribeName = i % 2 === 0 ? 'Tidal' : 'Ember');
  separateTribes(before);
  Feed.post('TRIBE SWAP — ' + DIALOGUE.peff.swapAnnounce, 'drama', GAME.day);
  toast('Tribe swap! Check your new tribe.');
}

/* A swap does not just relabel people, it SEPARATES them — and everything that
   was aimed across the new line has to go with them.

   Scoping the pools that generate names was only half the fix: an NPC still
   carried vote weight on their old tribemates, so "who are you voting for" read
   the highest weight on their list and answered with somebody who will not be at
   their council. Weights are about a council, so they do not survive one. */
function separateTribes(before) {
  let dropped = 0, pairsBroken = 0;
  for (const c of alive()) {
    for (const name of [...c.voteWeights.keys()]) {
      const other = GAME.cast.find(x => x.name === name);
      if (!other || other.eliminated || other.tribeName !== c.tribeName) {
        c.voteWeights.delete(name);
        dropped++;
      }
    }
  }
  /* Pairwise alliances split by the swap are over as working alliances. The trust
     stays — that is a relationship, and relationships travel. */
  for (const al of NpcAlliances.list) {
    if (al.broken) continue;
    const A = GAME.cast.find(x => x.name === al.a), B = GAME.cast.find(x => x.name === al.b);
    if (!A || !B || A.tribeName !== B.tribeName) {
      al.broken = true; al.breakReason = 'split_by_swap'; al.dayBroken = GAME.day;
      pairsBroken++;
    }
  }
  /* Same for the player's circle: a circle that is not in one camp is not a
     circle. */
  const circle = Coalitions.active(GAME.player.name);
  if (circle) {
    const tribes = new Set(circle.members
      .map(n => GAME.cast.find(x => x.name === n))
      .filter(c => c && !c.eliminated)
      .map(c => c.tribeName));
    if (tribes.size > 1) {
      circle.broken = true; circle.breakReason = 'split_by_swap';
      Feed.post('The swap split your pact. Whatever that was, it is not that any more.', 'danger', GAME.day);
    }
  }
  /* Intel about people who are no longer at your camp is a memory, not a read.
     Keep it — the player learned it fairly — but stamp it so the Intel panel can
     say it is from before the swap rather than presenting it as current. */
  for (const i of GAME.intel) if (!i.staleFrom) i.staleFrom = GAME.day;
  DBG.log('system', `Tribe swap: dropped ${dropped} cross-tribe vote weights, broke ${pairsBroken} split pairs`);
}

function doMerge() {
  GAME.merged = true;
  /* Remember the day and who came from where. Both were being thrown away, and the
     old-tribe divide is the single biggest dynamic of a post-merge Survivor season
     — everybody at that council knows exactly who they marooned with, so it is
     public information the game should be able to talk about. Read by
     TribalRead.fNumbersAgainst and fMerged. */
  GAME.mergeDay = GAME.day;
  for (const c of alive()) if (!c.originalTribe) c.originalTribe = c.tribeName;
  for (const c of alive()) c.tribeName = 'Solara';
  Feed.post('MERGE — ' + DIALOGUE.peff.mergeAnnounce, 'drama', GAME.day);
  toast('Merged! Individual game begins.');
}

/* ---------------- Watch mode (player eliminated) ---------------- */
async function watchRestOfSeason() {
  toast('Simulating the rest of the season…');
  while (!seasonShouldEnd()) {
    GAME.day++;
    Weather.roll();
    dailySurvivalTick(alive());
    CampNeeds.decay(campPool());
    Nights.roll(campPool());
    applySleepRecovery(alive(), false);
    TribeWork.dailyTick(alive());
    Ledger.roll(alive());
    Ledger.socialDrift(alive());
    /* Report circle strain and breaks — this used to happen silently overnight. */
    const circleBefore = Coalitions.active(GAME.player.name);
    SocialDynamics.onDayStart(alive(), GAME.day);
    if (circleBefore) {
      if (circleBefore.broken && circleBefore.breakReason === 'trust_fracture') {
        const who = circleBefore.brokeOver ? circleBefore.brokeOver.join(' and ') : 'two of them';
        Feed.post(`Your pact fell apart — ${who} could not hold it together.`, 'danger', GAME.day);
        DBG.decision('Pact', 'FRACTURED', { over: circleBefore.brokeOver || null });
      } else if (circleBefore.broken && circleBefore.breakReason === 'too_few') {
        Feed.post('Your pact is down to too few people to mean anything.', 'drama', GAME.day);
      } else if (circleBefore.strain === 1) {
        Feed.post('Your pact is straining — someone in it has stopped trusting someone else.', 'drama', GAME.day);
        DBG.decision('Pact', 'STRAINED', { day: GAME.day });
      } else if (circleBefore.easedOver) {
        circleBefore.easedOver = false;
        Feed.post('Whatever was wrong in your pact has settled.', 'good', GAME.day);
      }
    }
    advanceSocialTime(6, GAME.cast, GAME.merged);
    if (!GAME.merged && GAME.day >= CONFIG.mergeAfterDay) doMerge();
    if (isTribalDay(GAME.day) && alive().length > 2) {
      seedVoteWeights(GAME.cast, GAME.merged, GAME.player.name);
      let pool;
      if (GAME.merged) {
        const chal = (alive().length <= 4 ? Challenges.finalFourFire() : Challenges.pickChallenge());
        GAME.todayImmune = Challenges.runIndividual(chal, alive());
        pool = alive();
      } else {
        const chal = (alive().length <= 4 ? Challenges.finalFourFire() : Challenges.pickChallenge());
        const w = Challenges.runTribal(chal, aliveTribe('Tidal'), aliveTribe('Ember'));
        pool = aliveTribe(w === 'A' ? 'Ember' : 'Tidal');
        GAME.todayImmune = null;
      }
      const votes = new Map();
      for (const v of pool) {
        const t = Voting.calculateVote(v, pool, GAME.todayImmune, GAME.merged, GAME.day, GAME.player.name);
        if (t) votes.set(v.name, t);
      }
      const { eliminated, tied } = Voting.tally(votes);
      const elimName = eliminated || pick(tied);
      const elim = pool.find(c => c.name === elimName);
      if (elim) {
        finishTribal(votes, elim, pool, false);
        Feed.post(`Day ${GAME.day}: ${elim.displayName} voted out.`, '', GAME.day);
      }
    }
  }
  await runFinale();
}

/* Publishing the finished season is the whole point of the exercise — a season
   that ends and is never uploaded is the problem this replaced. */
function publishFinishedSeason(winner) {
  GAME.winner = winner || null;
  Trace.close();
  Telemetry.ping('season');
}

/* ---------------- Finale + jury ---------------- */
async function runFinale() {
  /* This used to trim the field to two with consecutive bare votes — no morning,
     no immunity, nothing to play. Those rounds are real days now (see
     isTribalDay and seasonShouldEnd), so by the time we get here the finalists
     are already decided and this function does one job: the jury.

     The loop below only runs if the hard day cap fired, which means something
     upstream stalled. It is a safety net, not the normal path. */
  while (alive().length > Jury.FINALIST_COUNT) {
    DBG.log('system', `Finale fallback trim at ${alive().length} alive — the endgame rounds did not complete`);
    const pool = alive();
    const votes = new Map();
    for (const v of pool) {
      const t = v.isPlayer && !GAME.playerEliminated
        ? await new Promise(res => openCastPicker('FINAL VOTE — someone must go:', pool.filter(c => !c.isPlayer), c => { Modal.close(); res(c); }))
        : Voting.calculateVote(v, pool, null, true, GAME.day, GAME.player.name);
      if (t) votes.set(v.name, t);
    }
    const { eliminated, tied } = Voting.tally(votes);
    const elimName = eliminated || pick(tied);
    const elim = pool.find(c => c.name === elimName);
    finishTribal(votes, elim, pool, false);
    Feed.post(`${elim.displayName} falls at ${alive().length + 1}.`, 'drama', GAME.day);
    if (elim.isPlayer) GAME.watchMode = true;
  }

  const finalists = alive();
  const jury = GAME.jury;
  await peffMoment('FINALE', DIALOGUE.peff.finaleIntro);

  const juryVotes = Jury.castVotes(jury, finalists);
  const tallyMap = new Map();
  for (const v of juryVotes) tallyMap.set(v.votedFor.name, (tallyMap.get(v.votedFor.name) || 0) + 1);
  let winner = finalists[0], wv = -1;
  for (const f of finalists) {
    const n = tallyMap.get(f.name) || 0;
    if (n > wv) { wv = n; winner = f; }
  }

  // dramatic jury reveal
  await new Promise(resolve => {
    Screens.replace('screen-reveal');
    $('reveal-peff-text').textContent = `${finalists.map(f => f.displayName).join(' vs ')}. The jury has voted.`;
    const slot = $('reveal-slot'), tallyRow = $('reveal-tally');
    slot.innerHTML = ''; tallyRow.innerHTML = '';
    const order = shuffle([...juryVotes]);
    const decisive = order.findIndex(v => v.votedFor === winner);
    if (decisive >= 0) order.push(...order.splice(decisive, 1));
    const running = {};
    let i = 0;
    const btn = $('btn-reveal-next');
    btn.textContent = 'Read a vote';
    btn.onclick = () => {
      if (i < order.length) {
        const v = order[i];
        slot.innerHTML = '';
        slot.appendChild(h('div', 'vote-parchment', v.votedFor.displayName));
        slot.appendChild(h('div', 'tiny ritual-text', `${v.juror.displayName} ${v.reason}`));
        running[v.votedFor.name] = (running[v.votedFor.name] || 0) + 1;
        tallyRow.innerHTML = '';
        for (const [n, ct] of Object.entries(running)) {
          const c = GAME.cast.find(x => x.name === n);
          tallyRow.appendChild(h('span', 'chip', `${c ? c.displayName : n}: ${ct}`));
        }
        i++;
        if (i >= order.length) btn.textContent = 'Crown the winner';
      } else { resolve(); }
    };
  });

  await peffMoment('WINNER', winner.isPlayer
    ? `The tribe has spoken — and it spoke YOUR name. ${winner.name} wins it all, ${wv}–${jury.length - wv}!`
    : `${winner.name}, ${winner.age}, ${winner.occupation} — sole survivor, ${wv}–${jury.length - wv}.`);

  Returning.recordSeason([...GAME.eliminatedPreFinal, ...GAME.jury]);
  Save.del();
  GAME.seasonActive = false;
  publishFinishedSeason(winner);
  showAftershow(winner, wv, juryVotes);
}

/* ---------------- Aftershow ---------------- */
function showAftershow(winner, winVotes, juryVotes) {
  Screens.replace('screen-aftershow');
  const body = $('aftershow-body');
  body.innerHTML = '';
  const sec = (title) => { const s = h('div', 'panel col'); s.style.padding = '12px 16px'; s.appendChild(h('b', 'display', title)); body.appendChild(s); return s; };

  const w = sec('Winner');
  w.appendChild(h('div', '', `${winner.name}, ${winner.age} — ${winner.occupation} (${winner.cluster || 'self-made'})`));
  w.appendChild(h('div', 'tiny dim', `Jury vote: ${winVotes}–${GAME.jury.length - winVotes}`));

  const all = GAME.cast;
  const sup = sec('Superlatives');
  const byStat = k => [...all].sort((a, b) => b.stats[k] - a.stats[k])[0];
  sup.appendChild(h('div', 'tiny', `Most Social: ${byStat('social').displayName} · Most Physical: ${byStat('physicality').displayName} · Smartest: ${byStat('smarts').displayName} · Most Strategic: ${byStat('gameAwareness').displayName}`));
  const brokest = [...all].sort((a, b) => a.morale - b.morale)[0];
  sup.appendChild(h('div', 'tiny', `Most Broken Spirit: ${brokest.displayName}`));

  const order = sec('Elimination order');
  GAME.eliminatedPreFinal.forEach((c, i) => order.appendChild(h('div', 'tiny', `${i + 1}. ${c.displayName} (${c.cluster || 'player'})`)));
  GAME.jury.forEach((c, i) => order.appendChild(h('div', 'tiny', `Juror ${i + 1}: ${c.displayName}`)));
  alive().forEach(c => order.appendChild(h('div', 'tiny', `Finalist: ${c.displayName}${c === winner ? ' — WINNER' : ''}`)));

  const log = sec('Tribal council log');
  for (const t of GAME.tribalLog.slice(-8)) {
    log.appendChild(h('div', 'tiny', `Day ${t.day}: ${t.eliminated} out — ${t.votes.join(', ')}`));
  }

  // biggest betrayal
  let worst = null, drop = 0;
  for (const c of all) for (const [n, e] of c.relationships) {
    const d = e.relBaseline - e.trust;
    if (d > drop) { drop = d; worst = { from: c, to: n }; }
  }
  if (worst) {
    const s = sec('Biggest betrayal');
    const other = all.find(c => c.name === worst.to);
    s.appendChild(h('div', 'tiny', `${worst.from.displayName} → ${other ? other.displayName : worst.to} (trust collapsed ${Math.round(drop * 100)} pts)`));
  }

  const dangerous = [...alive()].sort((a, b) =>
    (b.stats.gameAwareness + b.stats.smarts + b.stats.social) - (a.stats.gameAwareness + a.stats.smarts + a.stats.social))[0];
  if (dangerous) {
    const s = sec('Most dangerous never eliminated');
    s.appendChild(h('div', 'tiny', `${dangerous.displayName} (${dangerous.cluster || 'player'})`));
  }

  const seedS = sec('Season seed');
  seedS.appendChild(h('div', 'tiny dim', String(GAME.seasonSeed)));
}
$('btn-back-to-title').addEventListener('click', initTitle);

/* ---------------- Bonds / Alliances panels ---------------- */
$('btn-relations').addEventListener('click', () => {
  Tutorial.notify('bonds');
  const pool = campmates(GAME.player).filter(c => !c.isPlayer);
  const box = h('div', 'col');
  box.appendChild(h('div', 'tiny dim', 'Bond = they like you. Trust = they protect you. Tap someone to spot them on the beach.'));
  const grid = h('div', 'cast-grid');
  grid.style.padding = '4px 0';
  for (const c of pool) {
    const ally = PlayerAlliances.level(c.name);
    const card = castCard(c, ally ? '★ ALLY' : c.occupation, ally ? 'ally' : '');
    card.addEventListener('click', () => { Modal.close(); focusOnCastaway(c); });
    grid.appendChild(card);
  }
  box.appendChild(grid);
  Modal.open('How they feel about you', box);
});

function focusOnCastaway(c) {
  /* Was reaching into the figure record for `fig.el` and putting a CSS class on it.
     That only worked while figures WERE DOM nodes; in the 3D renderer a figure is a
     mesh and has no element. Both renderers expose spotlight() instead. */
  Beach.spotlight(c.name);
}

$('btn-alliances').addEventListener('click', () => {
  const box = h('div', 'col');
  const mine = PlayerAlliances.list.filter(a => !a.broken);
  box.appendChild(h('b', 'display', 'Your alliances'));
  if (!mine.length) box.appendChild(h('div', 'tiny dim', 'None yet. Talk → Alliance to start one.'));
  const lvlName = { 1: 'Aligned', 2: 'Promised', 3: 'Locked' };
  for (const a of mine) {
    const c = GAME.cast.find(x => x.name === a.name);
    box.appendChild(h('div', 'tiny', `${c ? c.displayName : a.name} — ${lvlName[a.level]} (day ${a.dayFormed})`));
  }
  const circle = Coalitions.active(GAME.player.name);
  box.appendChild(h('b', 'display', 'Your pact'));
  if (circle) box.appendChild(h('div', 'tiny',
    circle.members.filter(n => n !== GAME.player.name).map(dnOf).join(' + ') + ` — since day ${circle.dayFormed}`));
  else box.appendChild(h('div', 'tiny dim', 'None. Ally with someone, then bring a third in.'));
  const visible = NpcAlliances.list.filter(al => !al.broken).filter(al => {
    const A = GAME.cast.find(c => c.name === al.a), B = GAME.cast.find(c => c.name === al.b);
    return A && B && !A.eliminated && !B.eliminated && GAME.player.stats.gameAwareness > 0.45 && chance(0.99);
  });
  box.appendChild(h('b', 'display', 'Whispers around camp'));
  if (!visible.length) box.appendChild(h('div', 'tiny dim', 'Nothing solid. Keep watching.'));
  for (const al of visible.slice(0, 5)) {
    const A = GAME.cast.find(c => c.name === al.a), B = GAME.cast.find(c => c.name === al.b);
    box.appendChild(h('div', 'tiny', `${A.displayName} + ${B.displayName} keep ending up together…`));
  }
  Modal.open('Alliances', box);
});

$('btn-intel').addEventListener('click', () => {
  const box = h('div', 'col');
  box.appendChild(h('div', 'tiny dim', 'What you have heard, seen and been promised. Old intel goes stale — people change their minds, and a swap can move the person they named.'));
  const pool = campmates(GAME.player).filter(c => !c.isPlayer);
  let any = false;
  for (const c of pool) {
    const entries = GAME.intel.filter(e => e.who === c.name).slice(-3).reverse();
    if (!entries.length) continue;
    any = true;
    box.appendChild(h('b', 'display tiny', c.displayName));
    for (const e of entries) {
      const stale = e.day < GAME.day - 2;
      /* Intel about a vote from before the swap is history, not a read: whoever
         they named may not even be at their council any more. Keep it — the player
         earned it — but say so rather than presenting it as current. */
      const preSwap = e.staleFrom && e.day <= e.staleFrom;
      const t = e.target ? dnOf(e.target) : '';
      const txt = {
        claim: `told you they're voting ${t}${e.note ? ` (${e.note})` : ''}`,
        hedged: 'dodged your vote question',
        agreed: `agreed to vote ${t}`,
        observe: `keeps drifting away from ${t}`,
        overhear: `overheard leaning ${t}`,
        heat: `says the heat is on ${t}`,
        pastvote: `${e.note || 'said they voted ' + t}`,
        refused: `${e.note || 'refused to write ' + t}`,
        read: `reads ${t} as ${e.note}`
      }[e.kind] || e.note;
      box.appendChild(h('div', 'tiny' + (stale || preSwap ? ' dim' : ''),
        `D${e.day} — ${txt}` + (preSwap ? '  (before the swap)' : '')));
    }
  }
  if (!any) box.appendChild(h('div', 'tiny dim', 'Nothing yet. Ask people directly, observe them, and keep your ears open.'));
  Modal.open('Intel', box);
});

$('btn-feed-filter').addEventListener('click', () => {
  const on = $('feed').classList.toggle('only-me');
  $('btn-feed-filter').textContent = on ? 'You' : 'All';
});

/* Minimize the Camp Log to a single flickering line, and back. */
$('btn-feed-min').addEventListener('click', () => Feed.setCollapsed(true));
$('feed-ticker').addEventListener('click', () => Feed.setCollapsed(false));

/* One menu, two doors: the camp HUD and the title screen. Everything in here
   used to assume a live season because there was no way to reach it otherwise —
   so the season-specific entries are now conditional rather than hidden behind
   a second copy of the menu that would drift out of sync with this one. */
function openMenu() {
  const inSeason = GAME.seasonActive && !!GAME.player;
  const box = h('div', 'col');
  if (inSeason) {
    box.appendChild(h('div', 'tiny', `Season seed: ${GAME.seasonSeed}`));
    box.appendChild(h('div', 'tiny dim', 'Progress auto-saves at dawn each day.'));
  } else {
    box.appendChild(h('div', 'tiny dim', 'No season in progress.'
      + (Save.has() ? ' Continue picks up where you left off.' : '')));
  }
  /* Phones often ship with Reduce Motion on, which mutes the character
     animation. Let the player override the OS either way. */
  const motionBtn = h('button', 'btn sand', `Motion: ${Motion.labels[Motion.mode]}`);
  motionBtn.addEventListener('click', () => {
    Motion.cycle();
    motionBtn.textContent = `Motion: ${Motion.labels[Motion.mode]}`;
  });
  box.appendChild(motionBtn);
  box.appendChild(h('div', 'tiny dim',
    Motion.osReduced()
      ? 'Your device asks for reduced motion, so ambient idling is muted. Pick FULL to animate everything.'
      : 'Full character animation is on.'));

  /* ---------- the 3D island ----------
     Two settings, both here because the right value depends on a phone that cannot
     be measured from a build machine. The island is about 1,900 props and 1.2M
     triangles at full density; if that is too much for a device, turning it down is
     far better than the game running badly with no way out. Both reload, because the
     island is built once and re-dressing mid-season would shuffle it under the
     player. */
  if (typeof Island3D !== 'undefined' && typeof Scene3D !== 'undefined') {
    const on = Scene3D.ok && Scene3D.ready && Beach3D.active;
    const glBtn = h('button', 'btn ocean', '3D island: ' + (on ? 'ON' : 'OFF'));
    glBtn.addEventListener('click', () => Island3D.set(!Island3D.wanted()));
    box.appendChild(glBtn);
    if (on) {
      const STEPS = [0.5, 0.75, 1, 1.35];
      const cur = typeof BEACH3D_DENSITY !== 'undefined' ? BEACH3D_DENSITY : 1;
      const label = d => d < 0.6 ? 'Sparse' : d < 0.9 ? 'Light' : d < 1.2 ? 'Full' : 'Lush';
      const dBtn = h('button', 'btn sand', 'Island detail: ' + label(cur));
      dBtn.addEventListener('click', () => {
        const next = STEPS[(STEPS.findIndex(s => Math.abs(s - cur) < 0.01) + 1) % STEPS.length];
        try { localStorage.setItem('castaway_density', String(next)); } catch { }
        location.reload();
      });
      box.appendChild(dBtn);
      box.appendChild(h('div', 'tiny dim',
        'Lower the detail if the island runs rough on this device. It reloads to rebuild.'));
    } else {
      box.appendChild(h('div', 'tiny dim',
        Scene3D.ok === false ? 'This device did not give us WebGL, so the flat island is running.'
          : '3D is off. The flat island is running.'));
    }
  }
  const dbg = h('button', 'btn ocean', `Design log (${DBG.count()} lines)`);
  dbg.addEventListener('click', () => { Modal.close(); openDesignLog(); });
  box.appendChild(dbg);
  if (inSeason) {
    const quit = h('button', 'btn danger', 'Abandon season');
    quit.addEventListener('click', () => { Save.del(); GAME.seasonActive = false; Modal.close(); initTitle(); });
    box.appendChild(quit);
  }

  /* ---- start the whole history over ----
     Several things accumulate across seasons and never reset: the season number
     Peff announces at the marooning, the pool of returning players, which of his
     opening lines have been used, and the archive of finished reports. Handy until
     you want a clean slate to test from, at which point there was no way to get
     one short of clearing site data. Two taps, because it cannot be undone. */
  const resetWrap = h('div', 'col');
  const resetBtn = h('button', 'btn ghost', 'Reset all season counts');
  resetBtn.addEventListener('click', () => {
    resetWrap.innerHTML = '';
    resetWrap.appendChild(h('div', 'tiny warn',
      `This clears the season counter (currently on season ${Marooning.currentSeasonNo()}), `
      + 'every returning player, the used-up marooning lines and the saved reports. '
      + 'It does not touch a season in progress.'));
    const row2 = h('div', 'row');
    const yes = h('button', 'btn danger', 'Reset everything');
    yes.addEventListener('click', () => {
      const n = Season.resetCounts();
      Modal.close();
      toast(`Reset — ${n} stored item${n === 1 ? '' : 's'} cleared. Next is season 1.`);
    });
    const no = h('button', 'btn sand', 'Keep it');
    no.addEventListener('click', () => { Modal.close(); openMenu(); });
    row2.appendChild(yes); row2.appendChild(no);
    resetWrap.appendChild(row2);
  });
  resetWrap.appendChild(resetBtn);
  box.appendChild(resetWrap);

  Modal.open('Menu', box);
}
$('btn-menu').addEventListener('click', openMenu);
$('btn-title-menu').addEventListener('click', openMenu);

/* ---------------- Season history ----------------
   Everything that survives between seasons, in one place so that "start over"
   is a list you can read rather than a guess about which keys matter.

   Deliberately NOT included: the motion preference, the telemetry setup (gist
   token, ntfy topic) and the tutorial-seen flags. Those are settings about the
   device and the person, not a record of seasons played, and wiping them would
   mean re-entering a GitHub token to clear a season counter. */
const Season = {
  /* Keys are read off their owning modules rather than retyped here. Retyping them
     is how you get a reset button that silently clears nothing — the report archive
     is 'castaway_reports_v1', and the hand-written 'castaway_reports_v' I first put
     here would have looked like it worked. */
  keys() {
    const k = ['castaway_season_no'];   // owned by Marooning.seasonNo, inline there
    if (typeof Returning !== 'undefined' && Returning.KEY) k.push(Returning.KEY);
    if (typeof Marooning !== 'undefined' && Marooning.KEY) k.push(Marooning.KEY);
    if (typeof Telemetry !== 'undefined' && Telemetry.AKEY) k.push(Telemetry.AKEY);
    return k;
  },
  resetCounts() {
    let n = 0;
    for (const k of this.keys()) {
      try { if (localStorage.getItem(k) !== null) { localStorage.removeItem(k); n++; } } catch { }
    }
    /* In-memory copies would otherwise write themselves straight back. */
    try { if (typeof Marooning !== 'undefined' && Marooning.used) Marooning.used.clear(); } catch { }
    DBG.system(`Season history reset — ${n} stored items cleared`);
    return n;
  }
};

/* ---------------- Motion preference ----------------
   auto  = follow the OS (ambient loops muted if it asks for reduced motion,
           walking and gestures still play)
   full  = animate everything regardless of the OS setting
   off   = no character animation at all */
const Motion = {
  KEY: 'castaway_motion',
  mode: 'auto',
  labels: { auto: 'AUTO', full: 'FULL', off: 'OFF' },
  osReduced() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  },
  apply() {
    const r = document.documentElement;
    r.classList.toggle('motion-full', this.mode === 'full');
    r.classList.toggle('motion-off', this.mode === 'off');
    DBG.system(`Motion mode=${this.mode} osReduced=${this.osReduced()}`);
  },
  cycle() {
    this.mode = this.mode === 'auto' ? 'full' : this.mode === 'full' ? 'off' : 'auto';
    try { localStorage.setItem(this.KEY, this.mode); } catch { }
    this.apply();
    toast(`Motion: ${this.labels[this.mode]}`);
  },
  init() {
    try { this.mode = localStorage.getItem(this.KEY) || 'auto'; } catch { }
    if (!this.labels[this.mode]) this.mode = 'auto';
    this.apply();
  }
};

/* ---------------- Studio splash ----------------
   The So Sun card, over the title screen, once per page load.

   Deliberately not a .screen. Boot already does Screens.replace('screen-title')
   on load, and threading a fifth state through the stack would make Continue and
   Save.has() depend on splash timing for no gain. This is an overlay that deletes
   itself instead — which is also the whole of the "never comes back when you move
   between screens" requirement, since after the first play there is no element.

   Look and timing live in css/splash.css, including the reduced-motion variant;
   this side only decides WHEN the clock starts and cleans up after it. */
const Splash = {
  el: null,
  done: false,
  _fallback: null,

  start() {
    this.el = $('splash');
    if (!this.el) return;
    /* pointerdown, not click: a skip should land on touch rather than on
       release, because the reason anyone taps here is impatience. */
    this.el.addEventListener('pointerdown', () => this.finish('tapped'));
    this.el.addEventListener('animationend', e => {
      if (e.target === this.el) this.finish('played');
    });

    /* Do not start the fade over an empty box. The logo is a 1.2MB PNG and on a
       cold load it can still be decoding when the card would already be halfway
       out, which shows the player a dark flash and no studio name at all. Wait
       for it — but a slow image must not be able to hold the splash open, hence
       the grace timer. */
    const img = $('splash-logo');
    if (img && !img.complete) {
      const go = () => this._go();
      img.addEventListener('load', go, { once: true });
      img.addEventListener('error', go, { once: true });
      setTimeout(go, 1500);
    } else {
      this._go();
    }
  },

  _go() {
    if (this.done || !this.el || this.el.classList.contains('go')) return;
    this.el.classList.add('go');
    /* animationend is the normal exit. The backstop is for the cases where it
       never arrives — a hidden tab throttling the animation, or a browser that
       drops the event entirely. A splash that sticks is worse than one that
       never played, so something always takes it down. */
    this._fallback = setTimeout(() => this.finish('timeout'), 4000);
  },

  finish(why) {
    if (this.done) return;
    this.done = true;
    clearTimeout(this._fallback);
    if (this.el) { this.el.remove(); this.el = null; }
    DBG.system(`Splash cleared (${why})`);
  }
};
/* At parse time, not on load: the card has to be running before the browser
   waits on fonts and body sprites, which is exactly the pause it exists to fill. */
Splash.start();

/* ---------------- Camp: the needs board ----------------
   The other half of the day, and now a shared place rather than a private menu.
   Five standing needs everybody can see, what the tribe makes of your own
   contribution, a way to say out loud that something needs doing, and the jobs
   themselves — each of which walks you to the part of the island where that work
   actually happens. */
function openCampMenu() {
  const P = GAME.player;
  CampNeeds.ensure();
  const box = h('div', 'col');

  /* ---- your own condition ---- */
  const cond = h('div', 'camp-cond');
  const meter = (label, v, invert) => {
    const row = h('div', 'cc-bar-row');
    row.appendChild(h('span', 'cc-bar-label', label));
    const m = h('div', 'meter' + ((invert ? 1 - v : v) < 0.3 ? ' low' : ''));
    m.appendChild(h('i')); m.lastChild.style.width = pct(invert ? 1 - v : v);
    row.appendChild(m);
    return row;
  };
  cond.appendChild(meter('Fed', P.hunger, true));
  cond.appendChild(meter('Rest', P.fatigue, true));
  cond.appendChild(meter('Mind', P.morale, false));
  box.appendChild(cond);
  box.appendChild(h('div', 'tiny dim', 'Your head: ' + Morale.label(P.morale)
    + ' — ' + Morale.reasons(P, 3).join(', ') + '.'));

  /* ---- the board ---- */
  box.appendChild(h('div', 'camp-head', 'The camp'));
  const board = h('div', 'needs-board');
  const bar = (name, v, state) => {
    const row = h('div', 'nb-row' + (v < 0.32 ? ' bad' : v > 0.68 ? ' good' : ''));
    row.appendChild(h('span', 'nb-name', name));
    const m = h('div', 'nb-meter' + (v < 0.32 ? ' low' : ''));
    m.appendChild(h('i')); m.lastChild.style.width = pct(v);
    row.appendChild(m);
    row.appendChild(h('span', 'nb-state', state));
    board.appendChild(row);
  };
  for (const n of CAMP_NEEDS) bar(n.label, CampNeeds.get(n.id), CampNeeds.label(n.id));
  const f = GAME.campFire || 0;
  bar('The fire', f, f > 0.5 ? 'burning' : f > 0.15 ? 'low' : 'out');
  box.appendChild(board);

  /* ---- how the tribe sees your effort. Words, never a number. ---- */
  const rep = Ledger.rep(P);
  const judges = campmates(P)
    .filter(c => !c.isPlayer && valuesWork(c) > 0.55).length;
  box.appendChild(h('div', 'tiny ' + (rep < 0.3 ? 'warn-text' : 'dim'),
    'They reckon you ' + Ledger.describe(P) + '.'
    + (judges ? ' ' + judges + ' of them keep score.' : ' Nobody here keeps score.')));

  const add = (label, hours, fn, disabled, note, cls) => {
    const wrap = h('div', 'maroon-opt show');
    const b = h('button', 'btn ' + (cls || ''), label + (hours ? '  ·  ' + hours + 'h' : ''));
    if (disabled || GAME.hoursRemaining < hours) b.disabled = true;
    b.addEventListener('click', () => { Modal.close(); fn(); });
    wrap.appendChild(b);
    if (note) wrap.appendChild(h('div', 'maroon-think', note));
    box.appendChild(wrap);
    return b;
  };

  /* ---- say something about it ---- */
  const worst = CampNeeds.worst();
  add('Tell the tribe what needs doing', CONFIG.foodTopicCost, openCallOutMenu, false,
    worst.severity > 0.3
      ? 'Worst right now: ' + worst.need.label.toLowerCase()
        + '. They listen in proportion to what you have done yourself.'
      : 'Camp is in decent shape. Telling people what to do anyway rarely lands well.',
    'ocean');

  add('Eat something', CONFIG.eatHours, () => {
    const r = Camp.eat();
    toast(r.msg);
    if (r.ok) { Beach.playerWork('Camp', 'eat', 1200); consumeTime(CONFIG.eatHours); }
    renderHUD();
  }, CampNeeds.get('food') < 0.03, 'Takes the edge off the hunger. Costs half an hour.');

  add('Nap in the shade', CONFIG.napHours, () => {
    const msg = Camp.nap();
    Beach.playerWork('Shelter', 'sleep', 2000, () => toast(msg));
    consumeTime(CONFIG.napHours);
    renderHUD();
  }, false, 'Real rest — but two hours of daylight you will not get back.');

  /* ---- the jobs ---- */
  for (const job of CAMP_JOBS) {
    const admirers = campmates(P)
      .filter(c => !c.isPlayer && job.admire.indexOf(c.cluster) >= 0).length;
    const sev = job.need ? CampNeeds.severity(job.need) : 0;
    const noWood = job.needsWood && CampNeeds.get('firewood') < 0.08;
    const where = (Beach.ZONES.find(z => z.id === job.zone) || {}).label || job.zone;
    const note = (noWood ? 'No dry wood to burn — fetch some first. '
      : job.need ? (sev > 0.6 ? 'Badly needed. ' : sev > 0.3 ? 'Could use it. ' : 'Not urgent. ') : '')
      + 'You will head to the ' + where + '. '
      + (admirers ? admirers + ' here respect this kind of work.' : 'Nobody here especially values this.');
    add(job.label, job.hours, () => doCampJob(job), noWood, note);
  }

  add('Back', 0, () => { }, false, null);
  Modal.open('Camp', box);
}

/* Walk to the biome, play the action, THEN the work lands. The `act` tag on the
   figure is the animation hook (see Beach.sendToWork). */
function doCampJob(job) {
  Trace.mark('playerJobs', (Trace.today().playerJobs || []).concat(job.id));
  Beach.playerWork(job.zone, job.act, job.hours > 1 ? 2200 : 1500, () => {
    const res = Camp.doJob(job);
    toast((res && res.msg) || 'Done.');
    renderHUD();
  });
  consumeTime(job.hours);
}

/* ---------------- Calling out a need ----------------
   The one rule that holds this together: how much weight your words carry is
   your own record. Work, and people move. Do nothing, and they tell you where to
   go — which is also what stops this being free standing on tap. */
function openCallOutMenu() {
  const box = h('div', 'col');
  const standing = CallOut.standing();
  box.appendChild(h('div', 'tiny dim',
    standing > 0.62 ? 'You have done the work. When you speak about camp, people move.'
      : standing > 0.40 ? 'You have done enough that they will hear you out.'
        : 'You have barely lifted a finger. Telling people what to do will not go well.'));
  for (const n of CAMP_NEEDS) {
    const v = CampNeeds.get(n.id);
    const said = CallOut.used.indexOf(n.id) >= 0;
    const wrap = h('div', 'maroon-opt show');
    const b = h('button', 'btn' + (v < 0.32 ? ' ember' : ''), '"' + n.call + '"');
    if (said) b.disabled = true;
    b.addEventListener('click', () => { Modal.close(); doCallOut(n.id); });
    wrap.appendChild(b);
    wrap.appendChild(h('div', 'maroon-think',
      said ? 'You have already said that today.' : n.label + ': ' + CampNeeds.label(n.id) + '.'));
    box.appendChild(wrap);
  }
  const back = h('div', 'maroon-opt show');
  const bb = h('button', 'btn', 'Say nothing');
  bb.addEventListener('click', () => Modal.close());
  back.appendChild(bb);
  box.appendChild(back);
  Modal.open('Speak up', box);
}

function doCallOut(needId) {
  const res = CallOut.say(needId);
  const need = needById(needId);
  const box = h('div', 'col');
  box.appendChild(h('div', 'peff-line', '"' + need.call + '"'));
  if (!res.reactions.length) box.appendChild(h('div', 'tiny dim', 'Nobody says anything at all.'));
  for (const r of res.reactions) {
    const row = h('div', 'callout-reply' + (r.kind ? ' ' + r.kind : ''));
    row.appendChild(h('b', '', r.npc.displayName));
    row.appendChild(h('span', '', ' "' + r.line + '"'));
    box.appendChild(row);
    Beach.bubble(r.npc.name, r.line, 3800);
  }
  box.appendChild(h('div', 'tiny dim', res.note));
  Feed.post('You told the tribe: "' + need.call + '" — ' + res.note,
    res.pushback > res.listened ? 'warn' : 'good', GAME.day);
  Modal.open('You spoke up', box);
  consumeTime(CONFIG.foodTopicCost);
}

/* ---------------- The night, reported ----------------
   A bad night is a moment, not a log line: you wake up to it, you read what it
   cost, and you hear somebody say a name. */
function reportNight() {
  const ev = GAME.nightEvent;
  GAME.nightEvent = null;
  if (!ev) return;
  Trace.mark('night', { tag: ev.tag, bad: ev.bad, id: ev.id });
  Feed.post(ev.text, ev.kind, GAME.day);
  if (ev.blame) Feed.post(ev.blame, 'drama', GAME.day);
  if (!ev.bad) { toast(ev.tag); return; }
  const box = h('div', 'col');
  box.appendChild(h('div', 'night-tag', ev.tag));
  box.appendChild(h('div', 'night-text', ev.text));
  if (ev.blame) box.appendChild(h('div', 'night-blame', ev.blame));
  box.appendChild(h('div', 'tiny dim', CampNeeds.describe()));
  const wrap = h('div', 'maroon-opt show');
  const b = h('button', 'btn primary', 'Get up');
  b.addEventListener('click', () => Modal.close());
  wrap.appendChild(b);
  box.appendChild(wrap);
  Modal.open('Overnight', box);
}

/* ---------------- Design log viewer ----------------
   Three jobs, in order of how often they are needed:

     1. SEND IT. The season report is uploaded automatically every day, but this
        screen shows where it went, whether it worked, and gives a one-tap retry
        and a share sheet — because the previous version's only exits were a
        clipboard and a .txt download, neither of which gets a log off a phone
        and to anybody who can read it.
     2. READ IT. The condensed report first, since that is what anybody actually
        wants; the raw firehose behind a tab.
     3. SET IT UP. Pasting a GitHub token once turns on durable private uploads.
        The token stays in this device's localStorage and is never committed —
        this site is served from a public repo, so a token in the source would be
        public within the hour.
   ============================================================ */
function openDesignLog() {
  const box = h('div', 'col');

  /* ---- where the log is going ---- */
  const st = h('div', 'tel-panel');
  const line = (label, value, cls) => {
    const r = h('div', 'tel-row');
    r.appendChild(h('span', 'tel-label', label));
    r.appendChild(h('span', 'tel-value ' + (cls || ''), value));
    return r;
  };
  const renderStatus = () => {
    st.innerHTML = '';
    st.appendChild(h('div', 'camp-head', 'Uploads'));
    const okGist = /uploaded/.test(Telemetry.status.gist);
    const okNtfy = /sent/.test(Telemetry.status.ntfy);
    st.appendChild(line('GitHub gist', Telemetry.status.gist,
      okGist ? 'good' : Telemetry.configured() ? 'warn' : 'dim'));
    if (Telemetry.gistUrl()) {
      const a = h('div', 'tel-url', Telemetry.gistUrl());
      a.addEventListener('click', () => {
        navigator.clipboard && navigator.clipboard.writeText(Telemetry.gistUrl());
        toast('Gist link copied.');
      });
      st.appendChild(a);
    }
    st.appendChild(line('ntfy.sh', Telemetry.cfg.ntfy ? Telemetry.status.ntfy : 'off',
      okNtfy ? 'good' : 'dim'));
    const nu = h('div', 'tel-url', Telemetry.ntfyUrl());
    nu.addEventListener('click', () => {
      navigator.clipboard && navigator.clipboard.writeText(Telemetry.ntfyUrl());
      toast('ntfy topic copied.');
    });
    st.appendChild(nu);
    st.appendChild(h('div', 'tiny dim',
      Telemetry.configured()
        ? 'The full report goes to a secret gist every day. The short version also goes to ntfy.sh, which is public to anyone who knows the topic name.'
        : 'Right now only the short report is going out, to ntfy.sh — public to anyone who knows the topic, and it expires after about twelve hours. Add a GitHub token below for durable private uploads of the full log.'));
  };
  renderStatus();
  box.appendChild(st);

  /* ---- finished seasons kept on this device ----
     ntfy forgets a message after about twelve hours, and until now a finished
     season was gone with it. These can be resent whenever. */
  const arch = Telemetry.archived();
  if (arch.length) {
    const box2 = h('div', 'tel-panel');
    box2.appendChild(h('div', 'camp-head', 'Finished seasons on this device'));
    for (const e of arch.slice().reverse()) {
      const row = h('div', 'maroon-opt show');
      const b2 = h('button', 'btn small ocean', `Resend: ${e.who} — ${e.outcome}`);
      b2.addEventListener('click', async () => {
        b2.disabled = true; b2.textContent = 'Sending…';
        const r = await Telemetry.resend(e.seed);
        b2.disabled = false;
        b2.textContent = `Resend: ${e.who} — ${e.outcome}`;
        toast(r.ok ? 'Season resent.' : 'Could not resend: ' + r.msg);
        renderStatus();
      });
      row.appendChild(b2);
      row.appendChild(h('div', 'maroon-think', `seed ${e.seed} · day ${e.day} · saved ${e.at}`));
      box2.appendChild(row);
    }
    box.appendChild(box2);
  }

  /* ---- send it now ---- */
  const sendRow = h('div', 'row');
  sendRow.style.flexWrap = 'wrap';
  const mk = (label, cls, fn) => {
    const b = h('button', 'btn small ' + cls, label);
    b.addEventListener('click', fn);
    sendRow.appendChild(b);
    return b;
  };
  const sendBtn = mk('Send now', 'primary', async () => {
    sendBtn.disabled = true; sendBtn.textContent = 'Sending…';
    await Telemetry.push('manual');
    sendBtn.disabled = false; sendBtn.textContent = 'Send now';
    renderStatus();
    toast(/uploaded|sent/.test(Telemetry.status.gist + Telemetry.status.ntfy)
      ? 'Report sent.' : 'Upload failed — see the status above.');
  });
  /* The native share sheet is the shortest path from a phone to a person. */
  if (navigator.share) {
    mk('Share report', 'ocean', async () => {
      try { await navigator.share({ title: 'Castaway season report', text: Report.brief() }); }
      catch { /* dismissed */ }
    });
  }
  mk('Copy report', 'sand', async () => {
    const txt = Report.full();
    try { await navigator.clipboard.writeText(txt); toast('Full report copied.'); }
    catch { toast('Could not copy — use Download.'); }
  });
  mk('Download .txt', 'sand', () => {
    const blob = new Blob([Report.full()], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = Telemetry.filename();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
  /* Everything, in a normal browser tab.

     The textarea below is fine for a glance and awful for actually reading a
     season: the whole app is rotated 90 degrees on a phone, so it is a small
     sideways box with its own scrollbar. A plain tab gets real scrolling, real
     text selection, find-on-page, and the browser's own share and save — which is
     what "allow me to access the whole log somehow" is asking for. */
  mk('Open full log', 'ocean', () => {
    const st = DBG.stats();
    const parts = [
      Report.full(),
      '',
      '=== LOG COMPLETENESS ===',
      st.whole
        ? `complete — all ${st.total} lines of this season are below`
        : `TRUNCATED — ${st.dropped} early lines were dropped, ${st.kept} kept`,
      `(${st.persisted} of these also survive a reload; the rest live only in this tab)`,
      '',
      DBG.text(null)
    ];
    const blob = new Blob([parts.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) { toast('Allow pop-ups to open the log in a tab.'); URL.revokeObjectURL(url); return; }
    /* Revoked late: a phone browser can take a moment to actually load the tab. */
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
  box.appendChild(sendRow);

  /* How much of the season this log actually contains, stated up front rather than
     left for the reader to work out. */
  const st0 = DBG.stats();
  const compl = h('div', 'tiny ' + (st0.whole ? 'dim' : 'warn'),
    st0.whole
      ? `Log holds all ${st0.total} lines of this season.`
      : `Log is truncated: the first ${st0.dropped} lines were dropped, ${st0.kept} kept.`);
  box.appendChild(compl);

  /* ---- the log itself ---- */
  const VIEWS = ['report', 'full', 'action', 'rel', 'vote', 'alliance', 'system', 'lying', 'sim', 'all'];
  let view = 'report';
  const pre = document.createElement('textarea');
  pre.readOnly = true;
  pre.className = 'dbg-dump';
  const refresh = () => {
    pre.value = view === 'report' ? Report.brief()
      : view === 'full' ? Report.full()
        : DBG.text(view === 'all' ? null : view);
  };
  const row = h('div', 'row');
  row.style.flexWrap = 'wrap';
  VIEWS.forEach(t => {
    const b = h('button', 'btn small' + (t === view ? ' sand' : ''), t);
    b.addEventListener('click', () => {
      view = t; refresh();
      [...row.children].forEach(c => c.classList.remove('sand'));
      b.classList.add('sand');
    });
    row.appendChild(b);
  });
  box.appendChild(row);
  refresh();
  box.appendChild(pre);

  /* ---- setup ---- */
  const setup = h('div', 'tel-panel');
  const renderSetup = () => {
    setup.innerHTML = '';
    setup.appendChild(h('div', 'camp-head', 'GitHub upload'));
    if (Telemetry.configured()) {
      setup.appendChild(h('div', 'tiny dim',
        'A token is stored on this device. It is never sent anywhere except GitHub, and never committed.'));
      const f = h('button', 'btn small danger', 'Forget token');
      f.addEventListener('click', () => { Telemetry.forget(); renderSetup(); renderStatus(); toast('Token removed.'); });
      setup.appendChild(f);
      return;
    }
    setup.appendChild(h('div', 'tiny dim',
      'One-time: make a token with only the "gist" scope, paste it here. It stays on this phone.'));
    const link = h('a', 'tel-url', Telemetry.tokenPageUrl());
    link.href = Telemetry.tokenPageUrl();
    link.target = '_blank'; link.rel = 'noopener';
    link.textContent = 'Open the GitHub token page (gist scope pre-selected)';
    setup.appendChild(link);
    const inp = document.createElement('input');
    inp.type = 'password';
    inp.placeholder = 'github_pat_… or ghp_…';
    inp.autocomplete = 'off';
    inp.className = 'tel-input';
    setup.appendChild(inp);
    const save = h('button', 'btn small primary', 'Save token and upload');
    save.addEventListener('click', async () => {
      if (!inp.value.trim()) { toast('Paste a token first.'); return; }
      Telemetry.setToken(inp.value);
      inp.value = '';
      save.disabled = true; save.textContent = 'Uploading…';
      await Telemetry.push('manual');
      save.disabled = false;
      renderSetup(); renderStatus();
      toast(/uploaded/.test(Telemetry.status.gist) ? 'Gist created.' : 'Failed: ' + Telemetry.status.gist);
    });
    setup.appendChild(save);
  };
  renderSetup();
  box.appendChild(setup);

  /* ---- switches ---- */
  const opts = h('div', 'row');
  opts.style.flexWrap = 'wrap';
  const toggle = (label, get, set) => {
    const b = h('button', 'btn small' + (get() ? ' sand' : ''), label + ': ' + (get() ? 'on' : 'off'));
    b.addEventListener('click', () => {
      set(!get()); Telemetry.save();
      b.textContent = label + ': ' + (get() ? 'on' : 'off');
      b.classList.toggle('sand', get());
      renderStatus();
    });
    opts.appendChild(b);
  };
  toggle('Auto-upload', () => Telemetry.cfg.auto, v => Telemetry.cfg.auto = v);
  toggle('ntfy.sh', () => Telemetry.cfg.ntfy, v => Telemetry.cfg.ntfy = v);
  const snap = h('button', 'btn small', 'Snapshot cast');
  snap.addEventListener('click', () => { DBG.snapshot('manual'); refresh(); toast('Snapshot added.'); });
  opts.appendChild(snap);
  const clr = h('button', 'btn small danger', 'Clear raw log');
  clr.addEventListener('click', () => { DBG.clear(); refresh(); });
  opts.appendChild(clr);
  box.appendChild(opts);

  Modal.open('Design log', box);
}

/* ---------------- Boot ---------------- */
window.addEventListener('load', () => {
  DBG.load();
  Marooning.load();
  DBG.system(`Boot. build=web ua=${navigator.userAgent.slice(0, 60)}`);
  Motion.init();
  Feed.init();
  Beach.start();
  initTitle();
});

/* ============================================================
   Tutorial — progressive onboarding.
   A 4-card welcome tour (skippable), then an OBJECTIVE ladder
   that introduces one mechanic at a time. Game talk, Observe and
   Alliances start locked and unlock as objectives complete
   (with a day-2 fallback so nothing can ever stall). One-time
   contextual tips stay short. "?" opens the Field Guide.
   Progress persists in localStorage across sessions.
   ============================================================ */
const Tutorial = {
  KEY: 'castaway_tutorial_v2',
  LEGACY_KEY: 'castaway_tutorial_v1',
  DONE: 99,
  seen: {},
  stage: 0,
  _active: false,
  _talked: new Set(),
  TIP_KEYS: ['talk', 'scheme', 'ally', 'ask', 'risky', 'tribalday', 'vote', 'probe'],

  TASKS: [
    'Break the ice — talk to a tribemate',
    'First impressions — meet three tribemates',
    'Open BONDS — see who is warming to you',
    'Use GAME TALK — push a name or plant a seed',
    'End the day when your hours are spent',
    'Form an alliance — Talk, then Alliance',
    'Survive the first tribal — stay off the parchment'
  ],

  load() {
    try {
      const d = JSON.parse(localStorage.getItem(this.KEY));
      if (d) { this.seen = d.seen || {}; this.stage = typeof d.stage === 'number' ? d.stage : 0; return; }
    } catch { /* fall through */ }
    try {
      const old = JSON.parse(localStorage.getItem(this.LEGACY_KEY));
      if (old && old.intro) { this.seen = old; this.stage = this.DONE; this.save(); return; }
    } catch { /* fall through */ }
    this.seen = {}; this.stage = 0;
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify({ seen: this.seen, stage: this.stage })); } catch { /* full */ } },
  mark(k) { this.seen[k] = 1; this.save(); },
  done(k) { return !!this.seen[k]; },
  active() { return this.stage < this.DONE; },

  /* Feature gates. Stage-based, with a day fallback: by day 2 the
     full toolkit is open even if the player ignores objectives. */
  unlocked(f) {
    if (!this.active()) return true;
    const day = GAME.day || 1;
    if (f === 'scheme' || f === 'observe') return this.stage >= 3 || day >= 2;
    if (f === 'alliance') return this.stage >= 5 || day >= 2;
    return true;
  },

  _clear() {
    document.querySelectorAll('.tut-veil, .tut-ring, .tut-card').forEach(e => e.remove());
  },

  /* Show one coach-mark card; resolves 'primary' or 'secondary'.
     Overlays mount inside #app so they rotate with the forced-landscape
     transform; screen-space rects convert to app-local coordinates. */
  step({ title, text, target, btnLabel, dots, secondaryLabel }) {
    return new Promise(res => {
      this._clear();
      const mount = $('app');
      const portrait = typeof window.matchMedia === 'function'
        && window.matchMedia('(orientation: portrait)').matches;
      const localVH = portrait ? window.innerWidth : window.innerHeight;
      const veil = h('div', 'tut-veil');
      mount.appendChild(veil);
      let placeBottom = true;
      if (target) {
        const el = document.getElementById(target);
        if (el) {
          const r0 = el.getBoundingClientRect();
          // portrait: screen coords -> rotated app-local coords
          const r = portrait
            ? { left: r0.top, top: window.innerWidth - r0.right, width: r0.height, height: r0.width }
            : r0;
          const ring = h('div', 'tut-ring');
          ring.style.left = (r.left - 6) + 'px';
          ring.style.top = (r.top - 6) + 'px';
          ring.style.width = (r.width + 12) + 'px';
          ring.style.height = (r.height + 12) + 'px';
          mount.appendChild(ring);
          placeBottom = (r.top + r.height / 2) < localVH / 2;
        }
      }
      const card = h('div', 'tut-card');
      card.appendChild(h('h3', '', title));
      const p = h('p'); p.textContent = text; card.appendChild(p);
      const row = h('div', 'row');
      if (dots) row.appendChild(h('span', 'tut-dots', dots));
      if (secondaryLabel) {
        const sk = h('button', 'btn small sand', secondaryLabel);
        sk.addEventListener('click', () => { this._clear(); res('secondary'); });
        row.appendChild(sk);
      }
      const btn = h('button', 'btn primary small', btnLabel || 'Next');
      btn.addEventListener('click', () => { this._clear(); res('primary'); });
      row.appendChild(btn);
      card.appendChild(row);
      if (placeBottom) card.style.bottom = '14px'; else card.style.top = '14px';
      mount.appendChild(card);
    });
  },

  /* One-time contextual tip. */
  async tip(key, title, text) {
    if (this.done(key) || this._active) return;
    this.mark(key);
    this._active = true;
    await this.step({ title, text, btnLabel: 'Got it' });
    this._active = false;
  },

  /* ---------- Objective ladder ---------- */
  renderObjective() {
    const bar = $('objective-bar');
    if (!bar) return;
    if (!this.active() || GAME.playerEliminated) { bar.classList.add('hidden'); this._pulse(); return; }
    bar.classList.remove('hidden');
    let text = this.TASKS[this.stage] || '';
    if (this.stage === 1) text += ` (${Math.min(this._talked.size, 3)}/3)`;
    if (this.stage === 6 && GAME.day < 2) text = 'Tomorrow: the first tribal council';
    $('objective-text').textContent = text;
    this._pulse();
  },

  /* Pulse the HUD button the current objective points at
     (action-bar buttons handle their own pulse in renderActions). */
  _pulse() {
    $('btn-relations').classList.toggle('tut-pulse', this.active() && this.stage === 2);
  },

  notify(evt, data) {
    if (!this.active() || GAME.playerEliminated) return;
    const s = this.stage;
    if ((s === 0 || s === 1) && evt === 'friendly' && data) {
      this._talked.add(data.name);
      if (s === 0) this._advance();
      else if (this._talked.size >= 3) this._advance();
      else this.renderObjective();
    }
    else if (s === 2 && evt === 'bonds') {
      this._advance();
      if (this.unlocked('scheme')) toast('Unlocked: Game talk + Observe');
    }
    else if (s === 3 && evt === 'scheme') this._advance();
    else if (s === 4 && evt === 'endday') {
      this._advance();
      toast('Unlocked: Alliances');
    }
    else if (s === 5 && evt === 'align') this._advance();
    else if (s === 6 && evt === 'survived') this._advance();
  },

  _advance() {
    this.stage++;
    this.save();
    const bar = $('objective-bar');
    if (bar) {
      bar.classList.add('flash');
      setTimeout(() => bar.classList.remove('flash'), 900);
    }
    if (this.stage >= this.TASKS.length) {
      this.stage = this.DONE;
      this.save();
      this.renderObjective();
      if (GAME.seasonActive) { renderHUD(); renderActions(); }
      this._finale();
      return;
    }
    this.renderObjective();
    if (GAME.seasonActive) { renderHUD(); renderActions(); }
  },

  async _finale() {
    if (this._active) return;
    this._active = true;
    await this.step({
      title: 'You know the game now',
      text: 'That is the whole toolkit. From here every vote is politics — read the camp log, count your numbers, and never give them a reason to write your name.',
      btnLabel: 'The island is yours'
    });
    this._active = false;
  },

  forceComplete() {
    if (!this.active()) return;
    this.stage = this.DONE;
    this.save();
    this.renderObjective();
  },

  skipAll() {
    this.stage = this.DONE;
    this.seen.intro = 1;
    for (const k of this.TIP_KEYS) this.seen[k] = 1;
    this.save();
    this.renderObjective();
    if (GAME.seasonActive) { renderHUD(); renderActions(); }
    toast('Tutorial skipped — everything unlocked.');
  },

  /* ---------- Welcome tour ---------- */
  async maybeIntro() {
    this.renderObjective();
    if (this.done('intro') || this._active) return;
    this._active = true;
    const skipped = await this.step({
      title: 'Welcome to the island',
      text: 'Eighteen castaways. Twenty-six days. A jury of the people you help vote out crowns the winner. You learn by playing — one step at a time.',
      dots: '1 / 4', btnLabel: 'Show me', secondaryLabel: 'Skip tutorial'
    });
    if (skipped === 'secondary') { this._active = false; this.skipAll(); return; }
    await this.step({
      title: 'Your hours', target: 'hud-phase',
      text: 'Everything you do costs hours, and you get 12 a day. When they run out, night falls. Spend them on people.',
      dots: '2 / 4'
    });
    await this.step({
      title: 'The island', target: 'camp-scene',
      text: 'Swipe the scene sideways to explore the whole island. Tap a castaway and you will walk over to talk.',
      dots: '3 / 4'
    });
    await this.step({
      title: 'Your objective', target: 'objective-bar',
      text: 'This tag always shows your next move. First up: break the ice.',
      dots: '4 / 4', btnLabel: "Let's play"
    });
    this.mark('intro');
    this._active = false;
  },

  async replayTour() {
    if (this._active) return;
    delete this.seen.intro;
    this.save();
    await this.maybeIntro();
  }
};
Tutorial.load();
Telemetry.load();

/* ---------------- Field Guide ("?") ---------------- */
$('btn-help').addEventListener('click', () => {
  const box = h('div', 'col');
  const GUIDE = [
    ['The goal', 'Survive 26 days of tribal councils. A jury of eliminated players crowns the winner at the end.'],
    ['Hours', 'You get 12 hours a day. Every action costs time. Night falls when they run out.'],
    ['Bond', 'Friendly topics raise BOND (they like you) and TRUST (they protect you). Pestering one person over and over backfires.'],
    ['Ask them', 'Ask what they are hearing, who they are voting, or what they make of someone. They answer through the same trust math — low trust means lies. The tone is your tell, and vote claims get checked against their real vote at tribal.'],
    ['Game talk', 'Push a name, plant a seed, undermine, attack, spread a rumor — steers who they vote for. Sharp players catch schemes, and trust drops.'],
    ['Alliances', 'Align, then Promise, then Lock. Allies shield you at tribal. "Back me up tonight" buys one vote; breaking it off makes an enemy.'],
    ['Pacts', 'A three- or four-way alliance. Everyone must trust everyone, members shield each other and vote together — but pacts are visible, fragile, and betrayal at tribal shatters them.'],
    ['Intel', 'Everything you learn — claims, promises, observations, overheard leans — collects in the INTEL panel and shows on the vote screen. Claims can be lies, and old intel goes stale.'],
    ['Risky', 'Share a real secret for the biggest trust gain in the game — but schemers file it away. Confronting someone almost always backfires.'],
    ['Tribal days', 'Every even day. Immunity challenge in the morning; the losing side votes at night. IMMUNE on a name tag means safe tonight.'],
    ['The vote', 'Everyone weighs trust, threat, grudges and promises. It does not matter if they like you — as long as nobody has a reason to write your name.'],
    ['Probes', 'Before tribal, someone may ask your plan. Truth builds trust. A believed lie steers them; a caught lie never heals.'],
    ['The camp', 'Five standing needs — firewood, water, food, shelter, and the state of camp — run down every day, and the whole tribe decides for itself whether to do anything about them. Some castaways graft without being asked. Some genuinely never lift a finger all season.'],
    ['Pulling your weight', 'Camp work costs hours and fatigue and earns you standing with the castaways who value effort. Nobody keeps a scoreboard you can read, but they are keeping one: work gets talked about, and so does not working. "Yeah, but he never helps" wins votes out here.'],
    ['Speaking up', 'You can tell the tribe what needs doing. How much that moves anybody depends entirely on what YOU have been doing — a grafter gets people on their feet, and somebody who has done nothing all week gets told where to go. Saying it twice in one day just annoys people.'],
    ['Nights', 'What you did about camp shows up while you sleep. A tight shelter and a good fire means real rest. A dead fire, a leaking roof or a filthy camp means a rough night for everybody — and in the morning somebody will say a name.'],
    ['Hunger and sleep', 'Eat from the food store, and nap if you must — a nap costs daylight you cannot get back. Being starved, wrecked or miserable all drag your challenge performance. So does being disliked.'],
    ['Camp log', 'The island talks. Red entries are trouble — watch for your name circulating.']
  ];
  for (const [t, d] of GUIDE) {
    box.appendChild(h('b', 'display tiny', t));
    box.appendChild(h('div', 'tiny dim', d));
  }
  const replay = h('button', 'btn small sand', 'Replay island tour');
  replay.addEventListener('click', () => { Modal.close(); Tutorial.replayTour(); });
  box.appendChild(replay);
  Modal.open('Field guide', box);
});
