/* ============================================================
   REWARD CHALLENGES — the other half of a Survivor week.

   An immunity challenge decides who goes to council. A reward decides how
   everybody FEELS for the next few days, which is the slower of the two forces
   and the one this game did not have at all. Nothing in here touches the vote,
   grants immunity, or removes anybody: it moves hunger, fatigue, morale and the
   camp board, and the vote reads all four of those an hour later without ever
   being told a reward happened. That separation is the whole design — keep it.

   Three things make a reward not an immunity challenge:

     THE PRIZE IS KNOWN FIRST. You are shown what you are playing for before you
     play, because that is the format: a tarp and a barbecue are not the same bet
     and the player is entitled to want one of them. An immunity challenge can
     open with "compete"; a reward cannot.

     IT PAYS OVER TIME. A meal is eaten and gone. A tarp is still keeping the rain
     off on day nineteen. Multi-day rewards are an active-effects list ticked once
     per day, so fishing gear won on day nine is still feeding the camp on day
     fifteen — which is both more faithful and more interesting than one number.

     POST-MERGE IT SPLITS THE CAMP. Peff makes the winner pick somebody to come
     with them, and on the bigger prizes he asks for one more. The pick is a gift
     and the snub is a grudge. The ones left on the beach count it, and the
     hungriest or the sharpest of them counts it hardest.

   The challenge itself is a real minigame from the same library immunity draws
   from, run through Challenge.play with the same tribe rails. Nothing is
   simulated: you play for the tarp.
   ============================================================ */

'use strict';

const REWARD_CONFIG = {
  /* ---------- when a reward happens ----------
     Councils sit on the even days (CONFIG.tribalDays), so a reward can only land
     on an odd one — "different days from immunity" comes free from that, and the
     predicate below refuses a tribal day anyway rather than trusting the
     schedule to stay even. */

  /* Of the eligible days, roughly one in three. The show runs a reward about
     every other cycle; a reward every spare day would flood the survival model
     and nobody would ever be hungry again. Twelve odd days in a 26-day season at
     this rate is four or five rewards, which is what a real season gets. */
  dayChance: 0.34,
  /* Day 1 is the marooning and day 2 is the first council. Three is the earliest
     a reward can be played, which is also where the show puts the first one. */
  firstDay: 3,
  /* Minimum days between rewards. Two is a floor rather than a brake, and the
     arithmetic is why: councils sit on the even days, so consecutive rewards are
     already at least two days apart, and a rule that forbids day 5 after day 3
     forbids EVERY second eligible day. That caps a season at three rewards no
     matter what dayChance says — the keep-rate collapses to p(1-p), which peaks
     at 0.25 and cannot reach the one-in-three the format wants. So the spacing is
     left at the floor the schedule already provides, and the thing it was meant
     to prevent — a camp running four stacked multi-day effects — is prevented
     properly by maxActive instead. Raise it if a playtest says rewards bunch. */
  minGap: 2,
  /* Hours the day out costs. One less than immunity (CONFIG.challengeTimeCost is
     4) because there is no council to prepare for afterwards — but it is not
     free, or a reward day would be a bonus day. */
  timeCost: 3,

  /* ---------- what winning does socially ----------
     Winning anything together is a small bond. Held at the same order as the
     immunity equivalent (CONFIG.immunityWinRelBoost, 0.02) because it is the same
     event: you were on the mat together and you won. */
  winBondRel: 0.02,
  winBondTrust: 0.012,

  /* Being picked to share a reward is the loudest positive signal available in
     this game — public, voluntary, and counted by everybody watching. Several
     times a normal social beat on purpose (speaking up about camp is 0.030). */
  pickRel: 0.09,
  pickTrust: 0.05,
  /* People who read letters from home together come back different. Only prizes
     flagged `bonding` pay this, and it runs both ways between every recipient. */
  bondRel: 0.05,

  /* ---------- and what being left behind does ----------
     The snub. A deliberate push is 1.5 and camp blame is 0.45, so this is a real
     reason to write a name and nowhere near enough on its own. It lands on ONE
     person: whoever minded most, which out there means the hungriest or the one
     who reads everything. */
  snubVoteWeight: 0.40,
  snubRel: -0.035,
  /* And a whisper on everybody else who was hungry enough to care, scaled by how
     hungry they actually were. Somebody comfortable does not resent a barbecue. */
  snubCrowdVoteWeight: 0.12,
  /* Below this, hunger is just the island and nobody counts it as a slight.
     Sits above CONFIG.hungerNormal (0.55) so ordinary island hunger is silent. */
  hungerNotice: 0.62,

  /* ---------- the effects list ----------
     A hard ceiling on live multi-day effects. A lucky run of four rewards would
     otherwise stack a tarp, a toolkit, fishing gear and bedding at once and the
     camp economy would stop mattering. Oldest one drops when a fifth arrives. */
  maxActive: 4,

  /* ---------- minigames a reward may not use ----------
     'tipsy' spells the word IMMUNITY in its own arena and that string is
     hard-coded in the game, not in the briefing — so no amount of rewriting the
     description keeps immunity language off a reward screen. Excluded rather than
     patched. Fire games are excluded separately by chal.fire: fire is the
     final-four rite and must not turn up as a prize round. */
  /* Empty now. A Bit Tipsy used to be excluded because it hardcoded the word
     IMMUNITY inside its own arena, so no amount of rewriting the briefing kept
     immunity language off a reward screen. The word is a shell value now
     (Challenge.word), so the game is usable here and spells REWARD instead —
     which is also what the show does, since the blocks spell whatever the
     challenge is for. Fire games are still excluded, separately, by chal.fire:
     fire is the final-four rite and must not turn up as a prize round. */
  excludeGames: [],
  /* What a spelling game spells on a reward screen. */
  spellWord: 'REWARD'
};

/* ============================================================
   THE PRIZE TABLE

   Every prize is taken from something the show has actually walked onto a beach.
   Effects are differentiated on purpose — the interesting decision is not "do I
   want the reward" (you always do) but which one you were hoping for, and
   whether a tarp beats a steak on day eleven.

     instant   applied once, to every recipient.  hunger and fatigue are
               RELIEF, so they are negative; morale is positive.
     camp      applied once to the camp board (CampNeeds ids).
     lasting   { days, camp, self, goodSleep } — ticked once a day at daybreak
               for `days` mornings after the win.
     share     how many people Peff makes the winner take, post-merge.
     bonding   recipients come out of it closer to each other.
   ============================================================ */
const REWARD_PRIZES = [
  {
    id: 'barbecue', name: 'The Barbecue', weight: 1.4, share: 1,
    prize: 'Steak, chicken, cold drinks, and a table to sit at',
    /* The classic. Enormous today, nothing tomorrow — which is exactly how a big
       meal behaves against a hunger model that drifts toward a target: it buys
       you two or three days of being a person before the island takes it back. */
    instant: { hunger: -0.34, fatigue: -0.04, morale: 0.13 },
    peff: 'Steak, chicken, cold drinks and a table to sit at like a human being. Anybody still not interested?'
  },
  {
    id: 'fishing', name: 'Fishing Gear', weight: 1.0, share: 1,
    prize: 'Rod, spear, mask and fins — yours for the rest of the game',
    /* The one that is worth more than it looks. Almost nothing today; six days of
       a rising food store, which is where hunger's target comes from. Players who
       take this over the barbecue are right, and the game should reward that. */
    instant: { hunger: -0.06 },
    camp: { food: 0.10 },
    lasting: { days: 6, camp: { food: 0.055 }, label: 'The fishing gear is still earning.' },
    peff: 'Rod, spear, mask, fins. This one does not feed you today. It feeds you for the rest of the game.'
  },
  {
    id: 'tarp', name: 'Tarp and Shelter Kit', weight: 1.1, share: 1,
    prize: 'Twelve feet of tarp, rope, and a hammer',
    /* Shelter is the biggest term in campComfort(), which is the multiplier on
       every night's fatigue recovery. So a tarp is not a comfort item, it is a
       standing discount on being tired for the rest of the season. */
    instant: { fatigue: -0.03, morale: 0.05 },
    camp: { shelter: 0.28, clean: 0.05 },
    lasting: { days: 5, camp: { shelter: 0.05 }, label: 'The tarp is holding.' },
    peff: 'Twelve foot of tarp, rope and a hammer. It will not taste of anything. You will notice it every single night.'
  },
  {
    id: 'bedding', name: 'Blankets and Pillows', weight: 0.9, share: 1,
    prize: 'Blankets, pillows, and something between you and the sand',
    /* Sleep quality rather than shelter: four nights of the good-night bonus the
       camp model already has (applySleepRecovery reads GAME.goodSleep) plus a
       direct nightly fatigue refund for the people who got them. */
    instant: { fatigue: -0.12, morale: 0.08 },
    lasting: { days: 4, self: { fatigue: -0.055 }, goodSleep: true, label: 'Another night off the sand.' },
    peff: 'Blankets. Pillows. Something between you and eleven hundred miles of sand. Sleep is a weapon out here.'
  },
  {
    id: 'comfort', name: 'The Comfort Trip', weight: 1.0, share: 2,
    prize: 'A hot shower, clean clothes, and a bed for the afternoon',
    /* Morale and rest rather than food, and the show always sends two or three.
       The second pick is the point of this one. */
    instant: { hunger: -0.10, fatigue: -0.22, morale: 0.18 },
    lasting: { days: 2, self: { morale: 0.03 }, label: 'Still smells of soap.' },
    peff: 'Hot water. Soap. Clean clothes and a bed with sheets on it. You have forgotten what you smell like.'
  },
  {
    id: 'coffee', name: 'Coffee and Pastries', weight: 1.0, share: 1,
    prize: 'A pot of real coffee and a tray of pastries',
    /* Small, sharp, and mostly fatigue. The cheap one — it turns up more often
       than it should and nobody has ever turned it down. */
    instant: { hunger: -0.12, fatigue: -0.24, morale: 0.07 },
    peff: 'Coffee. Actual coffee, hot, with a tray of pastries next to it. I can see at least four of you doing sums.'
  },
  {
    id: 'letter', name: 'Letters From Home', weight: 0.8, share: 2, bonding: true,
    prize: 'A bag of letters with your names written on them',
    /* The emotionally biggest one in the table and it should stay that way: the
       largest morale number here by a distance, a three-day tail, and the only
       prize that bonds the people who shared it. It feeds nobody, which is why it
       is the most Survivor thing on the list. */
    instant: { fatigue: -0.05, morale: 0.28 },
    lasting: { days: 3, self: { morale: 0.045 }, label: 'Somebody is reading theirs again.' },
    peff: 'There is a bag on that table with your names on it. Letters from home. I am not going to pretend this one is about food.'
  },
  {
    id: 'fruit', name: 'Fruit Basket', weight: 1.1, share: 1,
    prize: 'Mangoes, papaya, bananas — a basket of it',
    /* The moderate one. Half a barbecue, and some of it keeps. */
    instant: { hunger: -0.18, morale: 0.05 },
    camp: { food: 0.08 },
    peff: 'Mangoes, papaya, bananas. Not a feast. Enough that you would fight somebody for it.'
  },
  {
    id: 'toolkit', name: 'Toolkit and Machete', weight: 1.0, share: 1,
    prize: 'A machete, an axe, a saw and a coil of wire',
    /* Firewood is the need with the biggest nightly drain and the only one the
       fire eats directly, so six days of easier wood is six nights of a fire that
       does not go out — which is a morale and a sleep effect wearing work clothes. */
    instant: { fatigue: -0.02 },
    camp: { firewood: 0.16 },
    lasting: { days: 6, camp: { firewood: 0.05, shelter: 0.02 }, label: 'The axe is doing the work.' },
    peff: 'A machete, an axe, a saw and a coil of wire. Boring. Ask anybody who has broken wood with their hands.'
  }
];

/* Peff on reward day. Same register as DIALOGUE.peff: dry, direct, faintly
   enjoying himself at the castaways' expense. */
const REWARD_PEFF = {
  intro: [
    'No torches tonight. Today you are playing for something you can eat, sleep on, or read.',
    'Nobody goes home off the back of this one. That is not the same as it not mattering.',
    'Today there is nothing at stake but comfort, and I have watched comfort end friendships.',
    'This one is not for your life in this game. It is for the next four days of it.'
  ],
  shareFirst: [
    'You cannot take all of it. Choose somebody to come with you.',
    'One more plate on that table. Who is sitting at it?',
    'Pick somebody. And know that everybody else is watching you pick.',
    'There is room for one more. Say a name out loud.'
  ],
  shareMore: [
    'And one more. Same rules — say it to their faces.',
    'One more seat. This is the one they will remember.',
    'I have got room for one more. Choose carefully.'
  ],
  won: [
    'Enjoy it. Genuinely. You have earned it and it will not last.',
    'Take it. It is yours.',
    'That is yours. Grab your things.'
  ],
  lost: [
    'Nothing for you. Head back to camp.',
    'No reward. I have got nothing for you — grab your flag and go.',
    'You get nothing. On that beach, that is plenty.'
  ]
};

const Rewards = {
  /* ---------- per-season state ----------
     usedGames is the shared record: every minigame id played by ANY challenge
     this season, reward or immunity, so nothing repeats. runChallengeScreen has
     to tell us about the immunity ones (see noteMinigame) — this is deliberately
     one list rather than two, because "I already played that" does not care which
     kind of challenge it was. */
  usedGames: [],
  usedPrizes: [],
  reusedGames: 0,
  lastRewardDay: 0,

  /* Safe to call before a season exists — the harnesses do exactly that. */
  reset() {
    this.usedGames = [];
    this.usedPrizes = [];
    this.reusedGames = 0;
    this.lastRewardDay = 0;
    if (typeof GAME !== 'undefined' && GAME) {
      GAME.rewardEffects = [];
      GAME.lastReward = null;
      GAME.rewardTickedDay = 0;
    }
  },

  /* Save/load. The effects list lives on GAME so it rides the existing save; the
     used-game record does not, so it is handed over explicitly. */
  saveState() {
    return { games: this.usedGames.slice(), prizes: this.usedPrizes.slice(), last: this.lastRewardDay };
  },
  loadState(s) {
    this.usedGames = (s && Array.isArray(s.games)) ? s.games.slice() : [];
    this.usedPrizes = (s && Array.isArray(s.prizes)) ? s.prizes.slice() : [];
    this.lastRewardDay = (s && typeof s.last === 'number') ? s.last : 0;
    this.reusedGames = 0;
  },

  /* ============================================================
     THE SCHEDULE

     A pure predicate, not a rolled list. Two reasons:

       It must answer for any day at any time — the HUD, the morning and a
       harness all ask independently, and a schedule stored in GAME would have to
       survive a save, a reload and a reset to stay consistent.

       It must not touch rng(). The season's random stream is shared with the sim
       and is part of the save; a predicate that consumed from it would make
       "which day is a reward day" depend on how many times anybody asked. So the
       roll is a hash of (seed, day), which is stable, free, and identical on a
       reload.
     ============================================================ */
  _hash(day) {
    const seed = (typeof GAME !== 'undefined' && GAME && GAME.seasonSeed) ? GAME.seasonSeed : 1;
    let x = ((seed ^ Math.imul(day, 2654435761)) + 0x9E3779B9) >>> 0;
    x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0;
    x ^= x >>> 13; x = Math.imul(x, 3266489917) >>> 0;
    x ^= x >>> 16;
    /* The final >>> 0 is load-bearing, not decoration. `^=` produces a SIGNED
       32-bit result, so half of these came out negative, every negative value was
       below dayChance, and the schedule fired on 83% of eligible days instead of
       34% — caught by tools/reward-test.js measuring the rate over 200 seeds
       rather than trusting one season's list to look about right. */
    return (x >>> 0) / 4294967296;
  },

  /* The scheduled councils only — deliberately NOT isTribalDay(), which also
     returns true for every day of the endgame and therefore changes its answer
     about day 9 depending on how many people are still alive. The gap check
     below walks backwards over past days and needs a stable answer for them. */
  _scheduledTribal(day) {
    const days = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.tribalDays) ? CONFIG.tribalDays : [];
    return days.indexOf(day) >= 0;
  },

  /* The raw roll, before the spacing rule. Stable for any day, past or future. */
  _raw(day) {
    if (!(day >= REWARD_CONFIG.firstDay)) return false;
    if (this._scheduledTribal(day)) return false;
    return this._hash(day) < REWARD_CONFIG.dayChance;
  },

  /* Is today a reward day?

     Never on a council day — checked against the LIVE isTribalDay so the endgame,
     where every day is a council, gets no rewards at all. That is correct: the
     show does not run rewards at final five either. */
  isRewardDay(day) {
    const d = Number(day);
    if (!isFinite(d)) return false;
    if (!this._raw(d)) return false;
    try {
      if (typeof isTribalDay === 'function' && isTribalDay(d)) return false;
    } catch { /* no season; the scheduled check in _raw already covered it */ }
    /* Spacing. Walks back over the raw roll, so it does not need any memory of
       what actually happened — a reload cannot desync it. */
    for (let k = 1; k < REWARD_CONFIG.minGap; k++) if (this._raw(d - k)) return false;
    return true;
  },

  /* Handy for the HUD and for reading a season at a glance. */
  scheduleFor(lastDay) {
    const out = [];
    const end = lastDay || ((typeof CONFIG !== 'undefined' && CONFIG.totalDays) ? CONFIG.totalDays : 26);
    for (let d = 1; d <= end; d++) if (this.isRewardDay(d)) out.push(d);
    return out;
  },

  /* ============================================================
     PICKING THE CHALLENGE
     ============================================================ */
  noteMinigame(id) {
    if (!id) return;
    if (this.usedGames.indexOf(id) < 0) this.usedGames.push(id);
  },
  gameUsed(id) { return this.usedGames.indexOf(id) >= 0; },

  /* A real challenge from the shared library, whose minigame nobody has played
     yet this season. Only when the library is genuinely exhausted does it repeat,
     and it says so in the log when it does. */
  pickChallenge() {
    const n = (typeof alive === 'function' && typeof GAME !== 'undefined' && GAME.cast && GAME.cast.length)
      ? alive().length : 12;
    const puzzlesSpent = (typeof Challenges !== 'undefined' && Challenges.puzzlesUsed) || 0;
    const puzzleCap = (typeof CONFIG !== 'undefined' && CONFIG.challengePuzzleMaxPerSeason) || 1;

    const rated = CHALLENGES
      .map((c, i) => ({ c, i, g: Challenge.gameFor(c) }))
      .filter(x => !x.c.finalFourOnly)
      /* Fire is the final-four rite. It is not a prize round. */
      .filter(x => !x.c.fire)
      .filter(x => !(x.c.lateGameOnly && n > 6))
      .filter(x => !(x.c.cat === 'Puzzle' && puzzlesSpent >= puzzleCap))
      .filter(x => REWARD_CONFIG.excludeGames.indexOf(x.g.id) < 0);

    /* Best case: a fresh minigame AND a challenge name immunity has not used. */
    const usedIdx = (typeof Challenges !== 'undefined' && Challenges.usedIdx) ? Challenges.usedIdx : new Set();
    let pool = rated.filter(x => !this.gameUsed(x.g.id) && !usedIdx.has(x.i));
    let reused = false;
    if (!pool.length) pool = rated.filter(x => !this.gameUsed(x.g.id));
    if (!pool.length) {
      pool = rated;
      reused = true;
      this.reusedGames++;
    }
    if (!pool.length) pool = CHALLENGES.map((c, i) => ({ c, i, g: Challenge.gameFor(c) }));

    const wOf = x => (typeof CHALLENGE_CAT_WEIGHTS !== 'undefined' && CHALLENGE_CAT_WEIGHTS[x.c.cat]) || 1;
    const total = pool.reduce((s, x) => s + wOf(x), 0);
    let roll = rr(0, total);
    let chosen = pool[pool.length - 1];
    for (const x of pool) { roll -= wOf(x); if (roll <= 0) { chosen = x; break; } }

    /* Claim it in both ledgers: the minigame so no challenge of any kind replays
       it, and the challenge index so the immunity picker does not re-run the same
       named challenge a week later. */
    this.noteMinigame(chosen.g.id);
    if (typeof Challenges !== 'undefined' && Challenges.usedIdx) Challenges.usedIdx.add(chosen.i);
    if (chosen.c.cat === 'Puzzle' && typeof Challenges !== 'undefined') {
      Challenges.puzzlesUsed = (Challenges.puzzlesUsed || 0) + 1;
    }
    DBG.log('system', `Reward challenge: ${chosen.c.name} -> ${chosen.g.id}`
      + (reused ? ' (MINIGAME LIBRARY EXHAUSTED — reusing a game already played this season)' : '')
      + ` · ${this.usedGames.length}/${MINIGAMES.length} games used`);
    return chosen.c;
  },

  /* The prize. No repeats until the table is spent, because winning the same
     barbecue three times reads as the game running out of ideas. */
  pickPrize() {
    let pool = REWARD_PRIZES.filter(p => this.usedPrizes.indexOf(p.id) < 0);
    if (!pool.length) { this.usedPrizes = []; pool = REWARD_PRIZES.slice(); }
    const total = pool.reduce((s, p) => s + (p.weight || 1), 0);
    let roll = rr(0, total);
    let chosen = pool[pool.length - 1];
    for (const p of pool) { roll -= (p.weight || 1); if (roll <= 0) { chosen = p; break; } }
    this.usedPrizes.push(chosen.id);
    return chosen;
  },

  /* ============================================================
     WHAT A PRIZE IS WORTH, IN WORDS

     Derived from the numbers rather than written next to them, so a card can
     never claim something the effects do not do — the same rule the challenge
     briefing follows about naming the minigame it is actually going to run.
     ============================================================ */
  chipsFor(prize) {
    const out = [];
    const ins = prize.instant || {};
    const camp = prize.camp || {};
    const last = prize.lasting || null;
    if (ins.hunger <= -0.25) out.push('A REAL MEAL');
    else if (ins.hunger <= -0.09) out.push('FOOD');
    if (ins.fatigue <= -0.18) out.push('REST');
    if (ins.morale >= 0.22) out.push('HOME');
    else if (ins.morale >= 0.11) out.push('MORALE');
    if (camp.shelter) out.push('SHELTER');
    if (camp.food && !ins.hunger) out.push('CAMP FOOD');
    if (camp.firewood) out.push('FIREWOOD');
    if (last) {
      out.push(last.days + ' DAYS');
      if (last.goodSleep) out.push('BETTER NIGHTS');
    }
    if (prize.share > 1) out.push('TAKES ' + prize.share);
    return out;
  },

  /* One line for the feed and the log. */
  describe(prize) {
    const bits = [];
    const ins = prize.instant || {};
    if (ins.hunger < 0) bits.push('hunger down');
    if (ins.fatigue < 0) bits.push('rested');
    if (ins.morale > 0) bits.push('spirits up');
    for (const k in (prize.camp || {})) bits.push(k + ' up');
    if (prize.lasting) bits.push('and it keeps paying for ' + prize.lasting.days + ' days');
    return prize.name + ' — ' + (bits.length ? bits.join(', ') : 'something to hold onto') + '.';
  },

  /* ============================================================
     GRANTING IT
     ============================================================ */
  _who(name) {
    if (typeof GAME === 'undefined' || !GAME.cast) return null;
    for (const c of GAME.cast) if (c.name === name) return c;
    return null;
  },
  _applySelf(c, d) {
    if (!c || c.eliminated || !d) return;
    if (typeof d.hunger === 'number') c.hunger = clamp01(c.hunger + d.hunger);
    if (typeof d.fatigue === 'number') c.fatigue = clamp01(c.fatigue + d.fatigue);
    if (typeof d.morale === 'number') c.morale = clamp01(c.morale + d.morale);
  },
  _applyCamp(d) {
    if (!d || typeof CampNeeds === 'undefined') return;
    CampNeeds.ensure();
    for (const k in d) CampNeeds.add(k, d[k]);
  },

  /* toCamp: whether the camp board actually moves.

     Pre-merge that is true only when the winners are the player's tribe, because
     only one camp is modelled — the other tribe is off on a beach we never see,
     and crediting our woodpile for their win would be the same bug dailySurvivalTick
     had to fix.

     Post-merge it is always true, and that is not a mistake: a tarp or a fishing
     kit won post-merge really is carried back to the one shared camp, on the show
     as well as here. The exclusive part of a post-merge reward is what the winners
     ATE and who they got to sit with — which is the personal half, and the half
     the snub hangs off. */
  grant(prize, winners, opts) {
    const o = opts || {};
    const list = (winners || []).filter(c => c && !c.eliminated);
    if (!list.length) return null;
    for (const c of list) this._applySelf(c, prize.instant);
    if (o.toCamp) this._applyCamp(prize.camp);
    if (prize.lasting) this.addEffect(prize, list.map(c => c.name), !!o.toCamp);

    /* Won it together. */
    for (const a of list) {
      for (const b of list) {
        if (a === b) continue;
        a.addRel(b.name, REWARD_CONFIG.winBondRel, 'won a reward together');
        a.addTrust(b.name, REWARD_CONFIG.winBondTrust, 'won a reward together');
        if (prize.bonding) a.addRel(b.name, REWARD_CONFIG.bondRel, 'read letters from home together');
      }
    }
    DBG.log('sim', `Reward granted: ${prize.id} to ${list.length} castaway(s)`
      + (o.toCamp ? ' + camp' : ' (their camp, not ours)')
      + (prize.lasting ? ` · ${prize.lasting.days}-day effect live` : ''));
    return { prize, winners: list.map(c => c.name), toCamp: !!o.toCamp };
  },

  addEffect(prize, names, toCamp) {
    if (typeof GAME === 'undefined' || !GAME) return null;
    if (!Array.isArray(GAME.rewardEffects)) GAME.rewardEffects = [];
    const l = prize.lasting;
    const e = {
      id: prize.id + '@' + ((GAME.day || 0)),
      prize: prize.id,
      label: l.label || prize.name,
      daysLeft: l.days,
      camp: l.camp || null,
      self: l.self || null,
      goodSleep: !!l.goodSleep,
      toCamp: !!toCamp,
      names: names.slice()
    };
    GAME.rewardEffects.push(e);
    /* Oldest out first, so the thing you just won is never the thing that gets
       dropped. */
    while (GAME.rewardEffects.length > REWARD_CONFIG.maxActive) GAME.rewardEffects.shift();
    return e;
  },

  active() {
    if (typeof GAME === 'undefined' || !GAME || !Array.isArray(GAME.rewardEffects)) return [];
    return GAME.rewardEffects;
  },

  /* One tick per day, at daybreak, before sleep is resolved — bedding has to have
     set GAME.goodSleep before applySleepRecovery reads it. Idempotent per day:
     called twice on the same morning it does nothing the second time, because a
     double-applied tarp is a silent balance bug of exactly the kind this codebase
     keeps finding. */
  tickDay() {
    if (typeof GAME === 'undefined' || !GAME) return [];
    const list = this.active();
    if (!list.length) return [];
    if (GAME.rewardTickedDay === GAME.day) return [];
    GAME.rewardTickedDay = GAME.day;
    const lines = [];
    for (const e of list.slice()) {
      if (e.toCamp) this._applyCamp(e.camp);
      if (e.self) for (const n of e.names) this._applySelf(this._who(n), e.self);
      if (e.goodSleep) GAME.goodSleep = true;
      e.daysLeft--;
      lines.push(e.label);
      if (e.daysLeft <= 0) {
        list.splice(list.indexOf(e), 1);
        DBG.log('sim', `Reward effect spent: ${e.prize}`);
      }
    }
    if (lines.length) DBG.log('sim', `Reward effects ticked: ${lines.join(' ')}`);
    return lines;
  },

  /* ============================================================
     THE SHARE, AND THE SNUB
     ============================================================ */

  /* Why you might pick this person, in one word. Shown on the pick buttons
     because it is the actual Survivor calculus: feed the starving one, or feed the
     one who is keeping score. Also a straight telegraph of who the snub will land
     on, which makes the choice a decision rather than a guess. */
  pickHint(c, winner) {
    if (!c) return '';
    if (c.hunger > 0.80) return 'starving';
    if (c.fatigue > 0.82) return 'running on empty';
    if (winner && !c.isPlayer && c.getRel(winner.name) > 0.55) return 'close to you';
    if (c.stats && c.stats.gameAwareness > 0.70) return 'counts everything';
    if (c.morale < 0.35) return 'struggling';
    return '';
  },

  /* An NPC winner picks in public, and picks who you would expect them to. */
  npcPicks(winner, others, n) {
    const picks = [];
    for (let i = 0; i < n && i < others.length; i++) {
      let best = null, bv = -Infinity;
      for (const c of others) {
        if (picks.indexOf(c) >= 0) continue;
        const v = winner.getRel(c.name) * 0.6 + winner.getTrust(c.name) * 0.4 + rr(-0.05, 0.05);
        if (v > bv) { bv = v; best = c; }
      }
      if (best) picks.push(best);
    }
    return picks;
  },

  /* The player picks, one at a time, with Peff asking for each. Resolves with the
     picks. Guarded so a double tap cannot resolve twice. */
  playerPicks(winner, others, n, host) {
    return new Promise(res => {
      const picked = [];
      let settled = false;
      const box = h('div', 'rw-share');
      host.appendChild(box);
      const step = () => {
        box.innerHTML = '';
        box.appendChild(h('div', 'rw-peff',
          '"' + (picked.length ? pick(REWARD_PEFF.shareMore) : pick(REWARD_PEFF.shareFirst)) + '"'));
        const grid = h('div', 'rw-picks');
        for (const c of others) {
          if (picked.indexOf(c) >= 0) continue;
          const b = h('button', 'btn small rw-pick');
          b.appendChild(h('span', 'rw-pick-name', c.displayName));
          const hint = this.pickHint(c, winner);
          if (hint) b.appendChild(h('span', 'rw-pick-hint', hint));
          b.onclick = () => {
            if (settled) return;
            picked.push(c);
            if (picked.length >= n) { settled = true; box.remove(); res(picked); return; }
            step();
          };
          grid.appendChild(b);
        }
        box.appendChild(grid);
      };
      step();
    });
  },

  applyPickSocial(winner, picks) {
    for (const c of picks) {
      if (!c || c.isPlayer) continue;
      c.addRel(winner.name, REWARD_CONFIG.pickRel, 'took them on the reward');
      c.addTrust(winner.name, REWARD_CONFIG.pickTrust, 'took them on the reward');
      /* And it buys a little cover at the vote, the same way any public kindness
         does — negative weight is "I like them", which is how seedVoteWeights
         already spells it. */
      c.addVW(winner.name, -REWARD_CONFIG.snubVoteWeight * 0.5, 'they took me on the reward');
    }
  },

  /* Everybody left on the beach. One of them minds properly — the hungriest, or
     the one who reads everything — and the rest mind in proportion to how empty
     they actually were. Returns whoever minded most, so the screen can name them:
     a snub the player never hears about is not a snub. */
  snub(winner, picks, pool) {
    const left = pool.filter(c => c !== winner && picks.indexOf(c) < 0 && !c.eliminated);
    const npcs = left.filter(c => !c.isPlayer);
    if (!npcs.length) return null;
    const bite = c => Math.max(0, c.hunger - REWARD_CONFIG.hungerNotice)
      / Math.max(0.01, 1 - REWARD_CONFIG.hungerNotice);
    let worst = null, wv = -Infinity;
    for (const c of npcs) {
      const v = bite(c) * 1.4 + (c.stats ? c.stats.gameAwareness : 0.5) * 0.8 + rr(-0.05, 0.05);
      if (v > wv) { wv = v; worst = c; }
    }
    if (worst) {
      worst.addVW(winner.name, REWARD_CONFIG.snubVoteWeight, 'left them on the beach at the reward');
      worst.addRel(winner.name, REWARD_CONFIG.snubRel, 'ate in front of them');
    }
    for (const c of npcs) {
      if (c === worst) continue;
      const b = bite(c);
      if (b < 0.08) continue;
      c.addVW(winner.name, REWARD_CONFIG.snubCrowdVoteWeight * b, 'ate nothing while they ate');
      c.addRel(winner.name, REWARD_CONFIG.snubRel * 0.35 * b, 'ate nothing while they ate');
    }
    DBG.log('vw', `Reward snub: ${worst ? worst.displayName : 'nobody'} minded most`
      + ` (${npcs.length} left behind)`);
    return worst;
  },

  /* ============================================================
     THE SCREEN

     Reuses #screen-challenge, because a reward IS a challenge and the rails, the
     arena and the standings are all already correct for one. Everything that
     would make it read as an immunity challenge is replaced: a banner across the
     top, a different accent, the prize on a card BEFORE the button, and no
     immunity language anywhere on the reward chrome.
     ============================================================ */
  buildBanner() {
    const b = h('div', 'rw-banner');
    b.id = 'rw-banner';
    b.appendChild(h('span', 'rw-banner-tag', 'REWARD'));
    b.appendChild(h('span', 'rw-banner-sub', 'No torches. No vote. Just this.'));
    return b;
  },

  /* The prize card. Built before a single second of the minigame is played,
     because knowing what you are competing for is the format. */
  buildCard(prize) {
    const card = h('div', 'rw-card');
    card.appendChild(h('div', 'rw-card-tag', 'PLAYING FOR'));
    card.appendChild(h('div', 'rw-card-name', prize.name));
    card.appendChild(h('div', 'rw-card-line', prize.prize));
    const chips = h('div', 'rw-chips');
    for (const t of this.chipsFor(prize)) chips.appendChild(h('span', 'rw-chip', t));
    card.appendChild(chips);
    card.appendChild(h('div', 'rw-peff', '"' + prize.peff + '"'));
    return card;
  },

  /* What kind of test it is, named — the same read the immunity briefing gives,
     rebuilt here rather than reached for, because that block lives inline in
     runChallengeScreen and this file does not edit game.js. */
  _statChips(chal, row) {
    row.innerHTML = '';
    const lead = STAT_KEYS.map((k, i) => ({ k, w: chal.w[i] })).sort((a, b) => b.w - a.w);
    if (lead[0] && lead[0].w > 0) {
      row.appendChild(h('span', 'chip', STAT_LABELS[lead[0].k]));
      if (lead[1] && lead[1].w >= lead[0].w * 0.8) row.appendChild(h('span', 'chip', STAT_LABELS[lead[1].k]));
    }
  },

  /* Belt and braces on requirement 6: nothing on a reward screen says immunity.
     One challenge in the library spells the word in its own description (and one
     minigame spells it in its arena — that one is excluded outright above). */
  _clean(s) {
    return String(s || '').replace(/IMMUNITY/g, 'REWARD').replace(/[Ii]mmunity/g, 'reward');
  },

  /* Put the reward clothes on the shared screen. One function rather than a block
     inside runScreen so the harness dresses the screen exactly the way the game
     does — the first version of this left the title to runScreen and the harness
     measured a REWARD banner sitting under the heading "Immunity Challenge",
     which is the precise bug requirement 6 is about. */
  dressScreen(chal, prize) {
    const screen = $('screen-challenge');
    screen.classList.add('rw-on');
    const head = $('chal-title').parentElement;
    const old = $('rw-banner');
    if (old) old.remove();
    head.insertBefore(this.buildBanner(), $('chal-title'));
    $('chal-title').textContent = 'Reward Challenge';
    if (chal) {
      const game = Challenge.gameFor(chal);
      $('chal-name').textContent = `${chal.name} (${chal.cat})`;
      $('chal-desc').textContent = this._clean(chal.desc) + '  —  ' + game.name + ': ' + this._clean(game.how);
      this._statChips(chal, $('chal-stats'));
    }
    const res = $('chal-result');
    res.innerHTML = '';
    res.appendChild(this.buildCard(prize));
    return res;
  },

  undressScreen() {
    const bn = $('rw-banner');
    if (bn) bn.remove();
    /* `resulting` too: left behind, the next immunity BRIEFING would open with its
       description and stat chips already hidden, which is the one screen where that
       information is the whole point. */
    $('screen-challenge').classList.remove('rw-on', 'resulting');
  },

  runScreen() {
    return new Promise(resolve => {
      if (typeof GAME === 'undefined' || !GAME.seasonActive || !GAME.player) { resolve(null); return; }
      /* A storm cancels a reward the same way it cancels immunity — except that
         losing a reward to weather costs nobody their game, so it is a shrug
         rather than a crisis. */
      if (typeof Weather !== 'undefined' && Weather.skipsReward && Weather.skipsReward()) {
        Feed.post('The weather takes the reward challenge with it. Rice again.', 'warn', GAME.day);
        resolve(null); return;
      }
      const chal = this.pickChallenge();
      const game = Challenge.gameFor(chal);
      const prize = this.pickPrize();
      GAME.lastReward = { day: GAME.day, prize: prize.id, chal: chal.name, game: game.id };
      this.lastRewardDay = GAME.day;

      Screens.push('screen-challenge');
      const res = this.dressScreen(chal, prize);

      const goBtn = $('btn-chal-go'), doneBtn = $('btn-chal-done');
      const goWas = goBtn.textContent, doneWas = doneBtn.textContent;
      goBtn.textContent = 'Play for it';
      goBtn.classList.remove('hidden');
      doneBtn.classList.add('hidden');

      const close = () => {
        Challenges.clearPrescore();
        Challenge.onScore = null;
        Challenge.setRoster(null);
        /* Belt and braces: cleared on the happy path too, but if the player backs
           out mid-challenge a stale word would follow them into the next immunity. */
        Challenge.word = null;
        setPlayerChallengePerf(null);
        this.undressScreen();
        goBtn.textContent = goWas;
        doneBtn.textContent = doneWas;
        Screens.pop();
        if (typeof renderHUD === 'function') renderHUD();
        if (typeof renderActions === 'function') renderActions();
        if (typeof renderLineup === 'function') renderLineup();
        resolve(GAME.lastReward);
      };

      goBtn.onclick = async () => {
        goBtn.classList.add('hidden');
        /* The card stays. What you were playing for should still be on screen
           when you find out whether you got it. */
        setPlayerChallengePerf(null);
        const field = GAME.merged ? alive() : aliveTribe('Tidal').concat(aliveTribe('Ember'));
        Challenges.prescore(chal, field);
        Challenge.setRoster(buildChallengeRoster(chal));
        Challenge.onScore = v => { Challenges.projectPlayer(chal, v); };
        /* A spelling game spells REWARD here, not IMMUNITY. */
        Challenge.word = REWARD_CONFIG.spellWord;
        if (!GAME.playerEliminated && !GAME.watchMode) {
          const perf = await Challenge.play(chal, GAME.player);
          setPlayerChallengePerf(perf);
        }
        Challenge.word = null;

        /* Same as immunity: the briefing has done its job, and this screen has to
           fit a prize card AND an outcome on 344px.

           Looked up rather than closed over: `screen` is a local of dressScreen(),
           not of runScreen(), so referencing it here threw a TypeError that killed
           the whole handler — no result, no hours, no journal entry — and reported
           as five unrelated failing checks. */
        $('screen-challenge').classList.add('resulting');
        const out = h('div', 'rw-out');
        res.appendChild(out);

        if (!GAME.merged) {
          /* ---- pre-merge: the whole camp eats ---- */
          const tidal = aliveTribe('Tidal'), ember = aliveTribe('Ember');
          const sideWon = Challenges.runTribal(chal, tidal, ember);
          const winTribe = sideWon === 'A' ? 'Tidal' : 'Ember';
          const winners = aliveTribe(winTribe);
          const ours = winTribe === GAME.player.tribeName;
          this.grant(prize, winners, { toCamp: ours });
          out.appendChild(h('div', 'display rw-win', `${winTribe} wins the reward`));
          out.appendChild(h('div', 'rw-peff', '"' + pick(ours ? REWARD_PEFF.won : REWARD_PEFF.lost) + '"'));
          out.appendChild(h('div', 'rw-effect', ours
            ? this.describe(prize) + ' It goes back to camp with you.'
            : `${prize.name} goes to the other beach. You get nothing, and nothing is what you go back to.`));
          /* The player's own tribe, and no per-castaway "ATE" tag.

             Tagging every member of the winning tribe marked NINE people, and the
             standings keep every tagged row — so the compaction that stops this
             screen overflowing was defeated and eighteen rows came back. Who ate is
             already stated in the line above, once, which is where it belongs. */
          renderChallengeStandings(out, aliveTribe(GAME.player.tribeName), {
            title: `${GAME.player.tribeName}: who carried it`
          });
          Feed.post(`${winTribe} wins the reward — ${prize.name}.`,
            ours ? 'good' : 'warn', GAME.day);
          if (ours) Feed.post(this.describe(prize), 'good', GAME.day);
          Journal.challenge({
            kind: 'reward', chal: chal.name, cat: chal.cat, game: game.id, prize: prize.id,
            perf: GAME.playerPerf, playerScore: +(GAME.player.lastChallengeScore || 0).toFixed(3),
            playerWon: ours, winner: winTribe, field: tidal.length + ember.length
          });
        } else {
          /* ---- post-merge: one winner, and a name to say out loud ---- */
          const pool = alive();
          const winner = Challenges.runIndividual(chal, pool);
          const others = pool.filter(c => c !== winner);
          const n = Math.min(prize.share || 1, others.length);
          out.appendChild(h('div', 'display rw-win', `${winner.displayName} wins the reward`));
          if (typeof Beach !== 'undefined' && Beach.emote) Beach.emote(winner.name, 'cheer');

          let picks = [];
          if (n > 0) {
            picks = winner.isPlayer
              ? await this.playerPicks(winner, others, n, out)
              : this.npcPicks(winner, others, n);
            if (!winner.isPlayer) {
              out.appendChild(h('div', 'rw-peff', '"' + pick(REWARD_PEFF.shareFirst) + '"'));
              out.appendChild(h('div', 'rw-effect',
                `${winner.displayName} takes ${picks.map(c => c.displayName).join(' and ')}.`));
            }
          }
          this.grant(prize, [winner].concat(picks), { toCamp: true });
          this.applyPickSocial(winner, picks);
          const stung = this.snub(winner, picks, pool);

          const took = picks.length
            ? `${winner.displayName} and ${picks.map(c => c.displayName).join(' and ')} take it.`
            : `${winner.displayName} takes it alone.`;
          out.appendChild(h('div', 'rw-effect', took + ' ' + this.describe(prize)));
          if (stung) {
            out.appendChild(h('div', 'rw-sting',
              `${stung.displayName} watched the rest of you go. That will keep.`));
          }
          renderChallengeStandings(out, pool, {
            title: 'Final standings',
            mark: c => (c === winner ? 'WON IT' : picks.indexOf(c) >= 0 ? 'INVITED' : '')
          });
          Feed.post(`${winner.displayName} wins the reward — ${prize.name}.`,
            winner.isPlayer ? 'good' : '', GAME.day);
          if (picks.length) {
            Feed.post(`${picks.map(c => c.displayName).join(' and ')} went along. Everybody else counted.`,
              'drama', GAME.day);
          }
          Journal.challenge({
            kind: 'reward', chal: chal.name, cat: chal.cat, game: game.id, prize: prize.id,
            perf: GAME.playerPerf, playerScore: +(GAME.player.lastChallengeScore || 0).toFixed(3),
            playerWon: winner.isPlayer, winner: winner.displayName,
            shared: picks.map(c => c.displayName), snubbed: stung ? stung.displayName : '',
            field: pool.length
          });
        }

        /* Note what is deliberately NOT here: no GAME.todayImmune, no
           GAME.todayLosingTribe, no applyImmunityWinBoost, no vote weight against
           whoever won. A reward feeds hunger, fatigue, morale and the camp, and
           the council reads those on its own. tools/reward-test.js asserts it,
           because the one way this feature could do real damage is by leaving a
           value behind that tonight's vote picks up. */
        Trace.mark('reward', prize.id);
        GAME.hoursRemaining = Math.max(0, GAME.hoursRemaining - REWARD_CONFIG.timeCost);
        doneBtn.classList.remove('hidden');
      };
      doneBtn.onclick = close;
    });
  }
};
