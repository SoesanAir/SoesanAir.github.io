/* ============================================================
   SURVIVAL — hunger, fatigue, morale, and camp work.

   These three existed as numbers that drifted 0.02/day and never surfaced. Now
   they are the second thing the player manages, alongside the social game:

     HUNGER   climbs daily, faster in bad weather. Eating costs time. High hunger
              drags morale and challenge performance.
     FATIGUE  climbs with everything you DO. Sleeping at night clears most of it;
              a nap clears some but burns daylight you cannot get back.
     MORALE   the mental state. Driven by a dozen inputs (below), not one.

   Camp work is the exchange rate between them: chores cost fatigue and hours,
   and buy you standing with the castaways who actually value effort.
   ============================================================ */

/* ---------- hidden fire-making skill ----------
   Everyone arrives able to make fire to a different degree, by temperament, and
   nobody is told their number. It improves every time you actually do it — so a
   player who tends the fire all season arrives at the final four with an edge
   that they earned and can feel. */
const FIRE_START = {
  'Camp Provider': 0.55, 'Physical Threat': 0.40, 'Natural Leader': 0.40,
  'Loyal Soldier': 0.38, 'Reluctant Hero': 0.34, 'Under The Radar': 0.32,
  'Strategic Veteran': 0.30, 'Bitter Veteran': 0.30, 'Loyal Follower': 0.28,
  'Paranoid Schemer': 0.24, 'Chaos Agent': 0.24, 'Emotional Wildcard': 0.20,
  'Social Butterfly': 0.18, 'Fan Favorite': 0.18, 'Villain Arc': 0.22
};
const fireStartFor = c => (FIRE_START[c.cluster] !== undefined ? FIRE_START[c.cluster] : 0.30);

const Fire = {
  seed(cast) {
    for (const c of cast) {
      if (c.fireSkill === undefined || c.fireSkill === null) {
        /* A little personal spread on top of the temperament baseline. */
        c.fireSkill = clamp01(fireStartFor(c) + rr(-0.06, 0.06) + (c.stats.smarts - 0.5) * 0.10);
        c.firesMade = 0;
      }
    }
  },
  /* Practice pays, with diminishing returns so it cannot run away. */
  practise(c) {
    const before = c.fireSkill;
    const room = 1 - c.fireSkill;
    c.fireSkill = clamp01(c.fireSkill + CONFIG.fireSkillGain * room);
    c.firesMade = (c.firesMade || 0) + 1;
    DBG.log('sim', `Fire skill ${c.displayName} ${before.toFixed(3)} -> ${c.fireSkill.toFixed(3)} (fire #${c.firesMade})`);
    return c.fireSkill - before;
  },
  /* Described, never numbered, so it stays a hidden stat. */
  describe(c) {
    const s = c.fireSkill || 0;
    return s > 0.8 ? 'You could do this in your sleep.'
      : s > 0.62 ? 'Your hands know what they are doing now.'
        : s > 0.45 ? 'You are getting the knack of it.'
          : s > 0.3 ? 'You can do it, slowly.'
            : 'You are still fighting the tinder.';
  }
};

/* ---------- morale ----------
   A dozen inputs, each small, recomputed every phase. Morale is a MOOD, so it
   drifts toward a target rather than snapping, which stops it flickering. */
const Morale = {
  /* Returns {target, parts} so the reason can be shown to the player. */
  targetFor(c) {
    const parts = [];
    let t = 0.62;
    const add = (v, why) => { if (Math.abs(v) > 0.001) { t += v; parts.push({ v: +v.toFixed(3), why }); } };

    /* Hunger and exhaustion are a permanent drag on the mood — you never stop
       noticing them — but the normal island version of each is a background ache,
       not a crisis. A flat share plus a sharper term past the normal level, so
       everybody is a bit worn down and the person actually in trouble is
       visibly worse. Previously this was -0.30 and -0.26 straight off the top,
       which at a settled hunger of 0.72 pinned the whole cast at "Struggling"
       from week two and left morale nothing else to say. */
    add(-c.hunger * 0.13 - Math.max(0, c.hunger - CONFIG.hungerNormal) * 0.40, 'hunger');
    add(-c.fatigue * 0.11 - Math.max(0, c.fatigue - CONFIG.fatigueNormal) * 0.34, 'exhaustion');
    if (Weather.today === 'Rainy') add(-0.07, 'the rain');
    if (Weather.today === 'Stormy') add(-0.13, 'the storm');
    if (Weather.today === 'Sunny') add(+0.04, 'good weather');
    if (Weather.today === 'Hot') add(-0.05, 'the heat');

    /* Social standing: being liked by the people around you. */
    const others = alive().filter(x => x !== c);
    if (others.length) {
      let warm = 0;
      for (const o of others) warm += o.getTrust(c.name) * 0.55 + o.getRel(c.name) * 0.45;
      warm /= others.length;
      add((warm - 0.35) * 0.34, warm > 0.45 ? 'people like you' : 'nobody is close to you');
    }
    /* Having anyone at all in your corner. */
    if (c.isPlayer) {
      const allies = PlayerAlliances.list.filter(a => !a.broken).length;
      if (allies) add(Math.min(0.10, allies * 0.045), 'you have people');
      else add(-0.06, 'you are alone out here');
      if (Coalitions.active(c.name)) add(0.04, 'your pact');
    }
    /* Pressure: how much of the tribe is looking at you. */
    let heat = 0;
    for (const o of others) heat += Math.max(0, o.getVW(c.name));
    add(-Math.min(0.16, heat * 0.05), 'your name is being said');

    if (GAME.todayImmune === c) add(0.16, 'immunity round your neck');
    if (c.lastChallengeScore && c.lastChallengeScore > 0) {
      /* Doing badly in front of everyone stings; doing well lifts you. */
      const field = alive().map(x => x.lastChallengeScore || 0);
      const mean = field.reduce((s, v) => s + v, 0) / Math.max(1, field.length);
      add(clamp01(0.5 + (c.lastChallengeScore - mean)) * 0.14 - 0.07,
        c.lastChallengeScore >= mean ? 'you competed well' : 'you struggled out there');
    }
    /* The vote going your way, or not. */
    if (c.isPlayer && GAME.lastVoteWentMyWay === true) add(0.10, 'the vote went your way');
    if (c.isPlayer && GAME.lastVoteWentMyWay === false) add(-0.10, 'the vote did not go your way');
    if (c.isPlayer && GAME.gotVotesLastTribal) add(-0.08, 'your name was read out');
    /* Camp comfort — the work people do actually shows up in how they feel. */
    add((CampNeeds.get('shelter') - 0.4) * 0.11, 'the shelter');
    add(((GAME.campFire === undefined ? 0.4 : GAME.campFire) - 0.4) * 0.09, 'the fire');
    add((CampNeeds.get('food') - 0.25) * 0.10, 'the food store');
    add((CampNeeds.get('water') - 0.35) * 0.08, 'the water');
    add((CampNeeds.get('clean') - 0.40) * 0.06, 'the state of camp');
    /* How you are seen as a worker. Being the one who carries camp lifts you;
       being the one everybody has noticed doing nothing sits on you. */
    const rep = Ledger.rep(c);
    add((rep - 0.5) * 0.14, rep > 0.5 ? 'you are pulling your weight' : 'you know they have noticed');
    /* Last night, if it was memorable either way. */
    if (GAME.lastNight && GAME.lastNight.day === GAME.day - 1) {
      add(GAME.lastNight.bad ? -0.07 : +0.06, GAME.lastNight.bad ? 'a rough night' : 'a good night');
    }
    /* Losing somebody you were close to. */
    if (GAME.lastEliminatedName && GAME.lastEliminatedName !== c.name) {
      const wasClose = c.getRel(GAME.lastEliminatedName);
      if (wasClose > 0.55) add(-0.09, 'losing ' + dnOf(GAME.lastEliminatedName));
    }
    /* Long haul. */
    add(Math.min(0.08, GAME.day * 0.004), 'you are still here');
    if (c.isPlayer && GAME.merged) add(0.05, 'you made the merge');

    return { target: clamp01(t), parts: parts.sort((a, b) => Math.abs(b.v) - Math.abs(a.v)) };
  },

  /* Drift toward the target so morale reads as a mood, not a readout. */
  tick(cast) {
    for (const c of cast) {
      if (c.eliminated) continue;
      const { target } = this.targetFor(c);
      c.morale = clamp01(c.morale + (target - c.morale) * CONFIG.moraleDrift);
    }
  },

  label(v) {
    return v > 0.78 ? 'Flying' : v > 0.62 ? 'Steady' : v > 0.45 ? 'Wobbling'
      : v > 0.28 ? 'Struggling' : 'Breaking';
  },
  /* The top few reasons, for the player's own readout. */
  reasons(c, n) {
    return this.targetFor(c).parts.slice(0, n || 4)
      .map(p => (p.v > 0 ? '+ ' : '− ') + p.why);
  }
};

/* ---------- camp work ----------
   The jobs, the needs board, who works and what the tribe makes of it all now
   live in camp.js. What is left here is the PLAYER's side of it: doing a job,
   eating, and sleeping in the afternoon. TribeWork stays as the name the day
   loop calls, and hands straight over to the labour AI. */
const TribeWork = {
  dailyTick(cast) { return Labour.runDay(cast); }
};

const Camp = {
  effortOf(job) { return effortOfJob(job); },

  /* Doing the work is seen — but the fifth job of the day is not news. Steep
     within-day decay stops chores replacing conversation as a rel engine.
     The lasting consequence is not this instant nudge, it is the ledger: what
     the tribe notices over days, which is where the real weight sits. */
  doJob(job) {
    const P = GAME.player;
    const res = applyJobEffect(job, P);
    if (!res.ok) return res;
    P.fatigue = clamp01(P.fatigue + job.fatigue);
    if (GAME.choreDay !== GAME.day) { GAME.choreDay = GAME.day; GAME.choresToday = 0; }
    const decay = 1 / (1 + GAME.choresToday * CONFIG.choreDayDecay);
    GAME.choresToday++;
    const effort = this.effortOf(job);
    Ledger.credit(P, effort, job.id);
    let noticed = 0, capped = 0;
    for (const c of aliveTribe(P.tribeName)) {
      if (c.isPlayer) continue;
      const admires = job.admire.indexOf(c.cluster) >= 0;
      let d = (admires ? CONFIG.choreEffortRelAdmire : CONFIG.choreEffortRel) * effort * decay;
      /* Season-long ceiling. Within-day decay stops chore-spamming in one day;
         this stops it over twenty-four of them. Past the cap the work still
         counts for the camp and for the ledger — it just stops buying affection
         you have not actually earned in conversation. */
      if (!c.choreRelGiven) c.choreRelGiven = {};
      const given = c.choreRelGiven[P.name] || 0;
      d = Math.min(d, Math.max(0, CONFIG.choreRelSeasonCap - given));
      if (d <= 0.0001) { capped++; if (admires) noticed++; continue; }
      c.choreRelGiven[P.name] = given + d;
      c.addRel(P.name, d, 'you did camp work');
      c.addTrust(P.name, d * 0.5, 'you did camp work');
      if (admires) noticed++;
    }
    DBG.action('Camp work', job.label,
      `effort=${effort.toFixed(2)} decay=${decay.toFixed(2)} fatigue+${job.fatigue} admired by ${noticed}`
      + ` · ${job.need || 'fire'} now ${(job.need ? CampNeeds.get(job.need) : (GAME.campFire || 0)).toFixed(2)}`);
    Feed.post(res.msg + (noticed && decay > 0.5 ? ` ${noticed} of them clocked it.` : ''), 'good', GAME.day);
    /* Out in the treeline on your own is where idols are actually found. Reported
       separately and loudly, because it is the single biggest thing that can come
       out of a chore and it must never read as part of the chore's flavour text. */
    const idol = Idols.tryFind(P, job.id);
    if (idol) {
      res.idol = idol;
      Feed.post(idol, 'good', GAME.day);
    }
    return res;
  },

  eat() {
    const P = GAME.player;
    CampNeeds.ensure();
    const have = CampNeeds.get('food');
    if (have < 0.03) return { ok: false, msg: 'There is nothing to eat. Somebody needs to forage.' };
    const amount = Math.min(have, 0.20);
    CampNeeds.set('food', have - amount);
    P.hunger = clamp01(P.hunger - amount * 1.6);
    P.morale = clamp01(P.morale + 0.04);
    /* Taking a full share out of a nearly empty basket is a thing people see. */
    let seen = 0;
    if (have < 0.26) {
      for (const c of aliveTribe(P.tribeName)) {
        if (c.isPlayer) continue;
        if (valuesWork(c) > 0.5 && Ledger.rep(P) < 0.45 && chance(0.5)) {
          c.addRel(P.name, -0.012 * valuesWork(c), 'ate from an empty basket');
          seen++;
        }
      }
    }
    DBG.action('Ate', '', `hunger now ${P.hunger.toFixed(2)} store ${CampNeeds.get('food').toFixed(2)}`
      + (seen ? ` · ${seen} noticed you taking from a thin basket` : ''));
    return {
      ok: true,
      msg: 'You eat. It is not much, but the ache backs off.'
        + (seen ? ' A couple of them watch you do it, and say nothing.' : '')
    };
  },

  /* A nap costs daylight you cannot get back — that is the whole trade. */
  nap() {
    const P = GAME.player;
    /* Real rest, so it does more the worse you are. A nap when fresh is a waste
       of daylight; a nap when you are falling apart is the right call. */
    const gain = CONFIG.napFatigueRecovery + P.fatigue * CONFIG.napFatigueScale;
    P.fatigue = clamp01(P.fatigue - gain);
    P.morale = clamp01(P.morale + 0.03);
    DBG.action('Napped', '', `fatigue now ${P.fatigue.toFixed(2)}`);
    /* Sleeping through the afternoon is noticed by the people carrying you — but
       only really resented when there is something that needed doing. A nap in a
       camp that is in good order is just a nap. */
    const sev = CampNeeds.worst().severity;
    let seen = 0;
    for (const c of aliveTribe(P.tribeName)) {
      if (c.isPlayer) continue;
      const care = valuesWork(c);
      if (care > 0.45 && sev > 0.35) {
        c.addRel(P.name, -0.022 * care * sev, 'you slept while they worked');
        seen++;
      }
    }
    return seen
      ? 'You sleep through the worst of the heat. A couple of them watched you do it, and there was work going on.'
      : 'You sleep through the worst of the heat. Camp is in decent order — nobody minds.';
  }
};
