/* ============================================================
   TRIBAL Q&A — the scene.

   Reported problem: "tribals are too in your face". You arrived at council and
   were immediately looking at a grid of faces with a Cast vote button under it.
   No throat-clearing, no context, nothing to react to. The vote is the only thing
   that ever happened.

   On the show the vote is the LAST thing that happens. Peff welcomes everybody,
   works the bench for ten minutes about things that actually happened that week,
   and the vote falls out of the conversation. That ordering is not decoration: it
   is what makes the vote feel like a consequence instead of a menu.

   This file is the scene. It owns four decisions:

     1. WHICH TOPICS. From TribalRead's ranked Facts, respecting a per-season
        no-repeat rule so a 26-day season never asks the same thing twice.
     2. WHO ANSWERS. Facts that name somebody get that person. Facts about the
        whole bench get whoever has the most business answering.
     3. HOW THEY ANSWER. The stance, from temperament and situation — the thing
        that makes the same topic produce a different scene with a different cast.
     4. ONE LINE, ONE TAP. Every line waits for the player. Nothing auto-advances.

   WHY STANCES RATHER THAN PER-CHARACTER LINES. Writing bespoke answers per
   castaway would mean the text pool has to grow with the cast, and the cast is
   generated. Stances make the pool multiply instead of divide: six ways to answer
   any topic, chosen by who is answering, so twenty-four topics cover thousands of
   distinct councils and a Villain Arc genuinely does not sound like a Loyal
   Soldier.

   See docs/tribal-qa.md for the contract the lines files are written against.
   ============================================================ */

'use strict';

const TribalQA = {
  /* Per-season memory. A topic asked once is spent, and so is every individual
     line — repetition at council is the most visible repetition in the game
     because it is the one screen the player cannot skip. */
  usedTopics: new Set(),
  usedLines: new Set(),
  seenWelcome: new Set(),

  reset() {
    this.usedTopics = new Set();
    this.usedLines = new Set();
    this.seenWelcome = new Set();
  },

  /* ---------- the topic table, assembled from the four lines files ---------- */
  topics() {
    if (this._topics) return this._topics;
    const all = [];
    for (const batch of [
      typeof TRIBAL_TOPICS_A !== 'undefined' ? TRIBAL_TOPICS_A : [],
      typeof TRIBAL_TOPICS_B !== 'undefined' ? TRIBAL_TOPICS_B : [],
      typeof TRIBAL_TOPICS_C !== 'undefined' ? TRIBAL_TOPICS_C : [],
      typeof TRIBAL_TOPICS_D !== 'undefined' ? TRIBAL_TOPICS_D : []
    ]) for (const t of batch) all.push(t);
    this._topics = new Map(all.map(t => [t.id, t]));
    return this._topics;
  },

  /* ---------- picking a line ----------
     Prefers something unseen this season, but NEVER returns nothing: a council
     that silently drops a beat is worse than one repeated line in week four. */
  say(pool, subs) {
    if (!pool || !pool.length) return null;
    const fresh = pool.filter(l => !this.usedLines.has(l));
    const line = (fresh.length ? pick(fresh) : pick(pool));
    this.usedLines.add(line);
    return this.fill(line, subs);
  },
  fill(line, subs) {
    let out = String(line);
    for (const k in (subs || {})) {
      out = out.split('{' + k + '}').join(String(subs[k]));
    }
    /* Any placeholder left over is a bug in a lines file — a topic used a sub it
       never declared. Strip the braces rather than shipping "{mystery}" to the
       screen, and shout about it in the design log so it gets fixed. */
    if (out.indexOf('{') >= 0) {
      DBG.decision('TribalQA', 'unfilled placeholder', { line: out.slice(0, 80) });
      out = out.replace(/\{[a-zA-Z]+\}/g, 'them');
    }
    return out;
  },

  /* ---------- who answers ----------
     A Fact that names somebody has already chosen. For the ones about the whole
     bench, pick the person with the most standing to speak: somebody with an
     opinion, who has not just answered, and who is not the immune winner every
     single time. */
  speakerFor(fact, pool, alreadySpoke) {
    if (fact.about && !fact.about.eliminated) return fact.about;
    const cands = pool.filter(c => !c.eliminated && !alreadySpoke.has(c.name));
    if (!cands.length) return pool.find(c => !c.eliminated) || null;
    /* Weight towards people who talk: high social or high game awareness, plus a
       nudge for whoever is having the worst time, because they are the ones who
       say something worth hearing. */
    let best = null, bw = -Infinity;
    for (const c of cands) {
      const w = (c.stats.social || 0.5) * 0.5
        + (c.stats.gameAwareness || 0.5) * 0.35
        + (c.hunger || 0) * 0.2 + (c.fatigue || 0) * 0.2
        + (c.isPlayer ? 0.30 : 0)      /* the player gets asked more than average */
        + rr(0, 0.45);
      if (w > bw) { bw = w; best = c; }
    }
    return best;
  },

  /* ---------- how they answer ----------
     Temperament first, then situation. The order matters: a Villain Arc who is
     starving is still a Villain Arc, but a Loyal Soldier who is starving stops
     being reassuring and starts telling the truth.

     Returns one of: own deflect blame defiant wry bleak */
  stanceFor(c, fact) {
    const C = c.cluster || '';
    const morale = c.morale === undefined ? 0.6 : c.morale;
    const wrecked = (c.hunger || 0) * 0.5 + (c.fatigue || 0) * 0.5;
    const score = {
      own: 0.35, deflect: 0.35, blame: 0.25, defiant: 0.2, wry: 0.25, bleak: 0.15
    };

    /* Temperament. These clusters exist elsewhere in the sim; the mapping is the
       same one confrontAtProbe uses so a castaway reads consistently across the
       two scenes where they are put on the spot. */
    if (['Villain Arc', 'Physical Threat', 'Chaos Agent', 'Bitter Veteran'].indexOf(C) >= 0) {
      score.defiant += 0.55; score.blame += 0.30; score.own -= 0.20;
    }
    if (['Loyal Soldier', 'Reluctant Hero', 'Provider'].indexOf(C) >= 0) {
      score.own += 0.50; score.deflect += 0.15; score.blame -= 0.15;
    }
    if (['Social Butterfly', 'Natural Leader', 'Lobbyist'].indexOf(C) >= 0) {
      score.deflect += 0.45; score.wry += 0.15;
    }
    if (['Strategist', 'Puppet Master', 'Quiet Threat'].indexOf(C) >= 0) {
      score.blame += 0.35; score.deflect += 0.25; score.own -= 0.10;
    }

    /* Stats. Smart people are funnier under pressure; emotionally open people own
       things; game-aware people redirect. */
    score.wry += ((c.stats.smarts || 0.5) - 0.5) * 0.7;
    score.own += ((c.stats.emotional || 0.5) - 0.5) * 0.8;
    score.blame += ((c.stats.gameAwareness || 0.5) - 0.5) * 0.7;
    score.deflect += ((c.stats.social || 0.5) - 0.5) * 0.5;

    /* Situation. Low morale and a wrecked body push towards the unvarnished
       answer, and away from being funny about it. */
    score.bleak += (0.55 - morale) * 1.4 + Math.max(0, wrecked - 0.6) * 1.6;
    score.wry -= Math.max(0, wrecked - 0.7) * 1.2;
    if (morale > 0.7) { score.wry += 0.20; score.bleak -= 0.35; }

    /* Being the subject of the question rather than a bystander hardens people. */
    if (fact.about === c) { score.defiant += 0.18; score.own += 0.12; score.deflect -= 0.10; }

    /* Immunity is a licence to be relaxed about all of it. */
    if (GAME.todayImmune === c) { score.defiant += 0.20; score.wry += 0.20; score.bleak -= 0.20; }

    let best = 'own', bv = -Infinity;
    for (const k in score) {
      const v = score[k] + rr(0, 0.42);      /* never fully deterministic */
      if (v > bv) { bv = v; best = k; }
    }
    return best;
  },

  /* ---------- presentation ----------
     One line, one tap. Everything below routes through here, which is how the
     "every line requires a Next button tap" requirement is guaranteed
     structurally rather than by remembering to do it at each call site. */
  line(speaker, text, opts) {
    const o = opts || {};
    return new Promise(res => {
      Screens.push('screen-tribalqa');
      const who = $('tqa-who');
      const body = $('tqa-text');
      const port = $('tqa-portrait');
      const stage = $('screen-tribalqa');
      stage.classList.toggle('is-peff', !!o.peff);
      who.textContent = o.peff ? 'Peff' : (speaker ? speaker.displayName : '');
      body.textContent = text;
      port.innerHTML = '';
      if (!o.peff && speaker) {
        const img = document.createElement('img');
        img.src = speaker.spriteURL || '';
        img.alt = '';
        port.appendChild(img);
      }
      /* Journal.show(kind, text, who) — every line the player was shown, so the
         season report can measure how much of this writing a real run reaches. */
      Journal.show(o.peff ? 'peffTribal' : 'tribalAnswer', text, o.peff ? 'Peff' : (speaker && speaker.name));
      const b = $('btn-tqa-next');
      b.textContent = o.last ? 'Ready to vote' : 'Next';
      b.onclick = () => { Screens.pop(); res(); };
    });
  },

  /* The player is asked, so they choose their own stance. This is the one place
     the conversation is a decision rather than a scene, and it is worth having:
     being put on the spot in front of everybody is the most Survivor thing that
     can happen to you, and picking how you handle it is a real choice. */
  askPlayer(topic, fact, subs) {
    return new Promise(res => {
      Screens.push('screen-tribalqa');
      const stage = $('screen-tribalqa');
      stage.classList.remove('is-peff');
      $('tqa-who').textContent = GAME.player.displayName;
      $('tqa-text').textContent = 'Peff is waiting.';
      const port = $('tqa-portrait');
      port.innerHTML = '';
      const img = document.createElement('img');
      img.src = GAME.player.spriteURL || '';
      img.alt = '';
      port.appendChild(img);

      const box = $('tqa-choices');
      box.innerHTML = '';
      const opts = topic.playerOpts || {};
      const keys = Object.keys(opts).filter(k => (topic.answers || {})[k]);
      /* Three at a time. Four buttons on a phone in landscape crowds the line
         they are supposed to be reacting to. */
      const offer = shuffle(keys.slice()).slice(0, 3);
      $('btn-tqa-next').onclick = null;
      $('btn-tqa-next').classList.add('hidden');
      for (const k of offer) {
        const btn = h('button', 'btn small tqa-opt', this.fill(opts[k], subs));
        btn.onclick = () => {
          box.innerHTML = '';
          $('btn-tqa-next').classList.remove('hidden');
          Screens.pop();
          Journal.act('tribal answer: ' + k, null, 0);
          res(k);
        };
        box.appendChild(btn);
      }
    });
  },

  /* ---------- the welcome ---------- */
  welcomeLine() {
    const W = typeof TRIBAL_WELCOME !== 'undefined' ? TRIBAL_WELCOME : null;
    if (!W) return 'Bring in your torches.';
    const left = alive().length;
    const keys = ['any'];
    if (!(Journal.ballots || []).length) keys.push('first');
    else if (!GAME.merged) keys.push('early');
    if (GAME.merged && !(Journal.ballots || []).some(b => b.day >= (GAME.mergeDay || 0))) keys.push('merged');
    if (GAME.jury && GAME.jury.length) keys.push('jury');
    if (left <= 5) keys.push('late');
    if (typeof Weather !== 'undefined' && (Weather.today === 'Stormy' || Weather.today === 'Rainy')) keys.push('storm');
    /* Contextual pools get two entries against 'any' one, so the night's
       situation usually shows in the greeting without ever being the only voice. */
    const bag = [];
    for (const k of keys) {
      const pool = W[k] || [];
      const times = k === 'any' ? 1 : 2;
      for (let i = 0; i < times; i++) for (const l of pool) bag.push(l);
    }
    return this.say(bag, {}) || 'Bring in your torches.';
  },

  /* ============================================================
     THE SCENE
     ============================================================ */
  async run(pool) {
    /* A council that throws leaves the player on a dead screen with no way to
       vote and no way back, which is the worst bug this feature could have. So
       the whole conversation is best-effort: if anything in here breaks, the
       vote still happens. */
    try {
      await this.line(null, this.welcomeLine(), { peff: true });
      await this.conversation(pool);
    } catch (err) {
      DBG.decision('TribalQA', 'scene aborted', { err: String(err && err.message) });
    }
  },

  async conversation(pool) {
    const facts = TribalRead.facts(pool);
    if (!facts.length) return;
    const budget = TribalRead.budget();
    const table = this.topics();
    const spoke = new Set();
    let asked = 0;

    for (const fact of facts) {
      if (asked >= budget) break;
      const topic = table.get(fact.id);
      if (!topic) continue;                 /* a Fact with no writing yet */

      const speaker = this.speakerFor(fact, pool, spoke);
      if (!speaker) continue;
      /* subs always carry {who} as the person actually answering, so a lines file
         can address them without knowing how the Fact was built. */
      const subs = Object.assign({}, fact.subs, { who: speaker.displayName });

      this.usedTopics.add(fact.id);
      spoke.add(speaker.name);
      asked++;

      await this.line(null, this.say(topic.ask, subs), { peff: true });

      let stance;
      if (speaker.isPlayer && topic.playerOpts) {
        stance = await this.askPlayer(topic, fact, subs);
        this.playerAnswered(stance, fact, pool);
      } else {
        stance = this.stanceFor(speaker, fact);
      }
      const answers = (topic.answers || {})[stance] || (topic.answers || {}).own;
      await this.line(speaker, this.say(answers, subs), {});

      /* Peff pushes sometimes. Not every time — a council where he follows up on
         everything is exhausting, and the pushes land harder when they are rare. */
      if (topic.push && chance(CONFIG.tribalPushChance)) {
        await this.line(null, this.say(topic.push, subs), { peff: true });
        const second = this.speakerFor({ about: null, subs: {} }, pool, spoke);
        if (second) {
          spoke.add(second.name);
          const st2 = this.stanceFor(second, fact);
          const chimePool = (topic.chime || {})[st2]
            || (topic.chime || {})[Object.keys(topic.chime || {})[0]]
            || (topic.answers || {})[st2];
          await this.line(second, this.say(chimePool, subs), {});
        }
      }
    }
  },

  /* What the player's chosen stance actually costs or buys.
     Deliberately small. This is a conversation, not a challenge — it should
     colour how people see you, not decide the season. But it must do SOMETHING,
     or the choice is decoration. */
  playerAnswered(stance, fact, pool) {
    const P = GAME.player;
    const mates = pool.filter(c => !c.isPlayer && !c.eliminated);
    const subject = fact.about;
    const k = CONFIG.tribalAnswerWeight;
    switch (stance) {
      case 'own':
        /* Taking it on the chin in public reads well to almost everybody. */
        for (const c of mates) { c.addRel(P.name, 0.022 * k, 'owned it at tribal'); c.addTrust(P.name, 0.030 * k, 'owned it at tribal'); }
        break;
      case 'blame':
        /* Naming somebody at council is the expensive one, and the person you
           named is not the only one who notices. */
        if (subject && subject !== P) {
          subject.addRel(P.name, -0.11 * k, 'blamed me at tribal');
          subject.addTrust(P.name, -0.09 * k, 'blamed me at tribal');
          subject.addVW(P.name, 0.13 * k, 'blamed me at tribal');
        }
        for (const c of mates) if (c !== subject) c.addTrust(P.name, -0.018 * k, 'saw me turn on somebody');
        break;
      case 'defiant':
        /* Splits the room by temperament, which is exactly what it should do. */
        for (const c of mates) {
          const hard = ['Villain Arc', 'Physical Threat', 'Chaos Agent', 'Bitter Veteran'].indexOf(c.cluster || '') >= 0;
          c.addRel(P.name, (hard ? 0.030 : -0.030) * k, 'stood my ground at tribal');
        }
        break;
      case 'wry':
        /* Cheap, safe, and slightly hollow — it buys warmth, not belief. */
        for (const c of mates) c.addRel(P.name, 0.018 * k, 'made them laugh at tribal');
        break;
      case 'deflect':
        for (const c of mates) c.addTrust(P.name, -0.010 * k, 'dodged a question at tribal');
        break;
      case 'bleak':
        /* Honesty about being finished earns sympathy and paints a target. */
        for (const c of mates) {
          c.addRel(P.name, 0.026 * k, 'was honest at tribal');
          c.addVW(P.name, 0.035 * k, 'looks finished');
        }
        break;
    }
    Journal.event('tribalAnswer', stance + ' on ' + fact.id);
  }
};
