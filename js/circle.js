/* ============================================================
   THE CIRCLE MEETING — talking to the whole alliance at once.

   Playtest verdict on the old circle: "it is unclear — how do I talk to all of
   them at once? how does it actually help the player?" Both halves were fair.
   The circle had genuine mechanical effects (members shielded each other in vote
   seeding and drifted toward a consensus target) and exposed none of them, and
   the only interface was a dead label in a one-to-one conversation. You could
   form an alliance and never once address it.

   What the show actually does with an alliance is a scene: everybody walks down
   the beach to the well, somebody puts a name up, and you watch the others fall
   in behind it or not. That scene is the feature.

   THREE THINGS MAKE IT A GAME RATHER THAN A MENU

     1. THEY ANSWER EACH OTHER, NOT YOU.
        Members respond in sequence and each one hears what the last one said. A
        second agreement makes a third much more likely; two refusals in a row and
        the room turns. That cascade is the reason a real alliance meeting has an
        order to it, and it means WHO you let speak first matters.

     2. IT COSTS YOU TO BE SEEN.
        Every meeting raises how obvious the bloc is. Sharp players start writing
        your names down together. So the answer to "should I call a meeting" is
        not always yes, which is what makes it a decision.

     3. SOMEBODY IN THE ROOM MIGHT NOT BE SOLID.
        Loyalty is per member and visible. A wobbly member can agree to your face
        and then go straight to the target with it. You can see the risk before
        you take it — you just cannot always afford not to.

   The payoff is a locked plan: a much heavier vote push than the passive drift,
   weighted by how firmly the room agreed and how loyal each person actually is.
   ============================================================ */
'use strict';

const CircleMeeting = {
  open: false,
  circle: null,
  _resolve: null,
  _advance: null,
  turns: 0,

  /* ---------- the scene ---------- */
  async start() {
    const P = GAME.player;
    const c = Coalitions.active(P.name);
    if (!c) { toast('You have no pact to call.'); return; }
    const cast = GAME.cast;
    const npcs = Coalitions.npcMembers(c, cast).filter(m => GAME.merged || m.tribeName === P.tribeName);
    if (npcs.length < 2) {
      toast('There is nobody here to meet with.');
      return;
    }
    this.circle = c;
    this.open = true;
    $('pact-layer').classList.add('open');
    $('ci-convo').innerHTML = '';
    $('ci-choices').innerHTML = '';
    this.turns = 0;
    this.paintHead(c, npcs, cast);
    DBG.action('Pact meeting', '', `${npcs.length} others · cohesion ${Coalitions.cohesion(c, cast).toFixed(2)}`);

    /* An opening beat each, coloured by the room rather than by the player. */
    this.say('You', 'You get them away from the shelter, down where the noise of the surf covers it.', 'stage');
    await this.next();
    for (const m of npcs) {
      this.say(m.displayName, this.openingLine(c, m, npcs, cast), 'them');
      await this.next();
    }
    await this.menu(c, npcs, cast);
  },

  close() {
    this.open = false;
    $('pact-layer').classList.remove('open');
    this._advance = null;
    renderHUD(); renderActions(); renderLineup();
  },

  /* ---------- presentation ---------- */
  paintHead(c, npcs, cast) {
    const coh = Coalitions.cohesion(c, cast);
    const vis = c.visibility || 0;
    $('ci-cohesion').style.width = (coh * 100).toFixed(0) + '%';
    $('ci-visible').style.width = (vis * 100).toFixed(0) + '%';
    const host = $('ci-members');
    host.innerHTML = '';
    for (const m of npcs) {
      const loy = Coalitions.loyaltyOf(c, m, cast);
      const card = h('div', 'ci-mem');
      card.appendChild(h('div', 'ci-mem-name', m.displayName));
      const bar = h('div', 'ci-mem-bar');
      const fill = h('i');
      fill.style.width = (loy * 100).toFixed(0) + '%';
      /* Colour the wobbly ones. The whole point is that you can SEE the risk. */
      if (loy < CONFIG.circleLeakBelow) fill.classList.add('risk');
      else if (loy > 0.66) fill.classList.add('solid');
      bar.appendChild(fill);
      card.appendChild(bar);
      card.appendChild(h('div', 'ci-mem-read', this.loyaltyRead(loy)));
      host.appendChild(card);
    }
  },
  loyaltyRead(v) {
    return v > 0.72 ? 'with you' : v > 0.56 ? 'steady' : v > 0.44 ? 'hard to read'
      : v > 0.30 ? 'drifting' : 'gone already';
  },

  say(who, text, cls) {
    const box = $('ci-convo');
    const turn = h('div', 'ci-turn ' + (cls || ''));
    if (who) turn.appendChild(h('div', 'ci-who', who));
    turn.appendChild(h('div', 'ci-text', text));
    box.appendChild(turn);
    box.scrollTop = box.scrollHeight;
    this.turns++;
    /* Keep the huddle short on screen; older lines scroll off rather than
       squeezing the live one off the bottom on a phone. */
    while (box.children.length > 7) box.removeChild(box.firstChild);
    return turn;
  },

  /* One line per tap, same rule as the marooning. Two people talking at once was
     the single most-reported readability problem in this game. */
  next() {
    return new Promise(res => {
      const box = $('ci-choices');
      box.innerHTML = '';
      const b = h('button', 'btn small ci-next', '▸');
      box.appendChild(b);
      const go = () => {
        if (!this._advance) return;
        this._advance = null;
        $('pact-layer').removeEventListener('click', go);
        res();
      };
      this._advance = go;
      b.onclick = go;
      /* Tap anywhere, not just the small button. */
      setTimeout(() => { if (this._advance === go) $('pact-layer').addEventListener('click', go); }, 60);
    });
  },

  choose(options) {
    return new Promise(res => {
      const box = $('ci-choices');
      box.innerHTML = '';
      for (const o of options) {
        const b = h('button', 'btn ' + (o.cls || ''), o.label);
        if (o.disabled) b.disabled = true;
        b.onclick = () => { box.innerHTML = ''; res(o.id); };
        box.appendChild(b);
      }
    });
  },

  /* ---------- the main menu of the huddle ---------- */
  async menu(c, npcs, cast) {
    this.paintHead(c, npcs, cast);
    const plan = c.plan && !c.plan.resolved && c.plan.day >= GAME.day - CONFIG.circlePlanStaleDays ? c.plan : null;
    const opts = [
      { id: 'name', label: plan ? 'Put a different name up' : 'Put a name up', cls: 'primary' },
      { id: 'reads', label: 'Ask who they would write' },
      { id: 'shore', label: 'Shore it up' }
    ];
    /* Splitting is only offered when there is a plan to split and enough people to
       cover both names. Offering it to a pact of three would be offering them a
       way to lose on purpose. */
    if (plan && npcs.length + 1 >= CONFIG.circleSplitMinMembers) {
      opts.push({ id: 'split', label: plan.split ? 'Change the split' : 'Split the vote' });
    }
    opts.push({ id: 'leave', label: 'Break it up', cls: 'sand' });
    const pick = await this.choose(opts);
    if (pick === 'name') return this.putNameUp(c, npcs, cast);
    if (pick === 'reads') return this.askReads(c, npcs, cast);
    if (pick === 'shore') return this.shoreUp(c, npcs, cast);
    if (pick === 'split') return this.splitVote(c, npcs, cast, plan);
    this.say('You', 'You break it up before anybody wanders down and finds all of you standing in a pact.', 'stage');
    await this.next();
    this.close();
  },

  /* ---------- put a name up ----------
     The cascade lives here. Members answer in order and each hears the running
     tally, so agreement compounds and so does refusal. */
  async putNameUp(c, npcs, cast) {
    const P = GAME.player;
    const outs = campmates(P).filter(x => !c.members.includes(x.name) && !x.isPlayer);
    if (!outs.length) {
      this.say('You', 'There is nobody left outside this pact to write down.', 'stage');
      await this.next();
      return this.menu(c, npcs, cast);
    }
    /* Most dangerous-looking first, so the list reads as a target list. */
    const ranked = [...outs].sort((a, b) =>
      (Ledger.rep(a) - Ledger.rep(b)) + (b.getVW ? 0 : 0) + (a.displayName < b.displayName ? -0.001 : 0.001));
    /* Immunity is named here too. Agreeing a pact plan on somebody who cannot be
       voted for tonight is a wasted meeting, and the meeting has a visibility cost
       — so the one fact that makes the whole exercise pointless has to be on the
       button. These are plain buttons rather than castCards, so the stamp castCard
       adds does not reach them. */
    const opts = ranked.slice(0, 6).map(t => ({
      id: t.name,
      label: t.displayName + (GAME.todayImmune === t ? ' — IMMUNE tonight' : ''),
      cls: GAME.todayImmune === t ? 'sand' : ''
    }));
    opts.push({ id: '__back', label: 'Actually, not yet', cls: 'sand' });
    const chosen = await this.choose(opts);
    if (chosen === '__back') return this.menu(c, npcs, cast);
    const target = cast.find(x => x.name === chosen);

    this.say('You', `"${target.displayName}. Tonight. All of us."`, 'me');
    await this.next();

    /* Speaking order: the most loyal first. That is both realistic — your closest
       ally backs you first — and a genuine tactical fact the player can use,
       because the cascade means the first answer is worth more than the last. */
    const order = [...npcs].sort((a, b) =>
      Coalitions.loyaltyOf(c, b, cast) - Coalitions.loyaltyOf(c, a, cast));
    const agreed = [];
    let momentum = 0;
    for (const m of order) {
      const loy = Coalitions.loyaltyOf(c, m, cast);
      const feels = Coalitions.warmth(m, target);
      /* Their own read on the target, their loyalty to you, and the room. */
      let p = clamp01(0.20 + loy * 0.75 - feels * 0.55 + momentum * CONFIG.circleCascade);
      const yes = chance(p);
      if (yes) { agreed.push(m.name); momentum += 1; }
      else momentum -= 1;
      this.say(m.displayName, this.reactionLine(m, target, yes, agreed, order, momentum), 'them');
      DBG.log('social', `Pact: ${m.displayName} ${yes ? 'agrees' : 'refuses'} on ${target.displayName}`
        + ` (loy ${loy.toFixed(2)} feels ${feels.toFixed(2)} p ${p.toFixed(2)})`);
      await this.next();
    }

    const majority = agreed.length > order.length / 2;
    if (majority) {
      Coalitions.setPlan(c, target.name, agreed, cast);
      addIntel(P.name, 'agreed', target.name, 'the pact agreed it');
      for (const n of agreed) addIntel(n, 'agreed', target.name, 'agreed in the pact');
      this.say('You', `It is agreed. ${agreed.length} of ${order.length} are writing ${target.displayName}.`, 'stage');
      await this.next();
      /* And now find out whether anybody in that room meant it. */
      const leak = Coalitions.rollLeak(c, cast);
      if (leak) {
        this.say('', `${leak.who.displayName} peels off toward the water line, where ${leak.to.displayName} is sitting.`, 'stage bad');
        await this.next();
        Feed.post(`${leak.who.displayName} was seen talking to ${leak.to.displayName} straight after.`, 'danger', GAME.day);
      }
    } else {
      this.say('You', 'It does not take. The name dies in the pact.', 'stage bad');
      /* A meeting that agreed nothing still happened, and was still seen. */
      c.meetings = (c.meetings || 0) + 1;
      c.visibility = Math.min(1, (c.visibility || 0) + CONFIG.circleMeetingVisibility * 0.6);
      await this.next();
    }
    Journal.event('circleMeeting', {
      target: target.displayName, agreed: agreed.length, of: order.length,
      locked: majority, visibility: +(c.visibility || 0).toFixed(2)
    });
    consumeTime(CONFIG.circleMeetingHours);
    this.close();
  },

  /* ---------- split the vote ----------
     What a majority does when it suspects an idol: put three votes on the target
     and three on their closest ally, so an idol played on either one still sends
     the other home. It is the most arithmetic-heavy thing the show does, and
     getting it wrong is how majorities lose — so the numbers are shown plainly and
     the pact will say no to a split it cannot cover. */
  async splitVote(c, npcs, cast, plan) {
    const P = GAME.player;
    const target = cast.find(x => x.name === plan.target);
    if (!target) return this.menu(c, npcs, cast);
    const outs = campmates(P).filter(x => !c.members.includes(x.name) && !x.isPlayer && x !== target);
    if (!outs.length) {
      this.say('You', 'There is nobody else to put the other half of the vote on.', 'stage');
      await this.next();
      return this.menu(c, npcs, cast);
    }
    this.say('You', '"If they have an idol, we lose this. We split it."', 'me');
    await this.next();

    /* The person it makes sense to split onto is whoever the target is closest to
       — that is who they would hand an idol to, and who they would want saved. */
    const ranked = [...outs].sort((a, b) =>
      Coalitions.warmth(b, target) - Coalitions.warmth(a, target));
    const opts = ranked.slice(0, 5).map(t => ({
      id: t.name,
      label: t.displayName + (Coalitions.warmth(t, target) > 0.55 ? ' — close to them' : '')
    }));
    opts.push({ id: '__back', label: 'Leave it on one name', cls: 'sand' });
    const chosen = await this.choose(opts);
    if (chosen === '__back') {
      plan.split = null; plan.assignB = null;
      return this.menu(c, npcs, cast);
    }
    const second = cast.find(x => x.name === chosen);

    /* The arithmetic, out loud. Everyone in the pact writes one of the two names;
       the half on the primary must still outnumber every vote the other side can
       muster, or the split hands them the night. */
    const voters = [P.name, ...npcs.map(m => m.name)];
    const half = Math.ceil(voters.length / 2);
    const onA = voters.slice(0, half);
    const onB = voters.slice(half);
    const opposition = campmates(P).filter(x => !c.members.includes(x.name)).length;
    const safe = onA.length > opposition;

    plan.split = second.name;
    plan.assignB = onB;
    DBG.decision('Pact', 'vote split', {
      primary: target.displayName, second: second.displayName,
      onA: onA.length, onB: onB.length, opposition, safe
    });

    this.say('You', `${onA.length} on ${target.displayName}, ${onB.length} on ${second.displayName}.`
      + ` They can muster ${opposition}.`, 'stage');
    await this.next();
    /* Somebody in the room does the maths too, and says so. That warning is the
       whole point of showing the numbers. */
    const sharpest = [...npcs].sort((a, b) => b.stats.gameAwareness - a.stats.gameAwareness)[0];
    if (sharpest) {
      this.say(sharpest.displayName, safe
        ? pick([
          '"That still works. Even if one of them is safe, the other one goes."',
          '"Fine. Either way somebody leaves and it is not us."',
          '"Numbers hold. I am comfortable."'
        ])
        : pick([
          `"That does not work. If they all write one name we are the ones going home."`,
          '"We do not have the bodies for a split. This is how majorities lose."',
          '"No. Split that thin and they beat us straight up."'
        ]), 'them');
      await this.next();
    }
    if (!safe) {
      /* An unsafe split is allowed — the player can insist — but the pact's
         confidence in the plan drops, which is the honest consequence. */
      plan.firm *= 0.7;
      this.say('You', 'You do it anyway. Half of them are not convinced.', 'stage');
      await this.next();
    }
    Journal.event('pactSplit', {
      primary: target.displayName, second: second.displayName,
      onA: onA.length, onB: onB.length, safe
    });
    Feed.post(`Your pact is splitting the vote: ${target.displayName} and ${second.displayName}.`,
      'drama', GAME.day);
    consumeTime(CONFIG.circleReadsHours);
    this.close();
  },

  /* ---------- ask for their reads ----------
     Cheap, no plan, but it is real intel — and intel from three people at once
     is the other reason to have a circle. */
  async askReads(c, npcs, cast) {
    const P = GAME.player;
    this.say('You', '"Before anything else. If you had to write a name right now, who?"', 'me');
    await this.next();
    for (const m of npcs) {
      const pool = campmates(m).filter(x => x !== m && !x.isPlayer);
      let best = null, bw = -Infinity;
      for (const t of pool) { const w = m.getVW(t.name); if (w > bw) { bw = w; best = t; } }
      if (best && bw > 0.2) {
        this.say(m.displayName, pick([
          `"${best.displayName}. It has been ${best.displayName} for me for a while."`,
          `"${best.displayName}, and I do not think I am the only one."`,
          `"Honestly? ${best.displayName}."`
        ]), 'them');
        addIntel(m.name, 'claim', best.name, 'said so in the pact');
      } else {
        this.say(m.displayName, pick([
          '"I genuinely do not know yet. I will follow the room."',
          '"Nobody. I am waiting to see which way this goes."',
          '"Ask me after the challenge."'
        ]), 'them');
      }
      await this.next();
    }
    consumeTime(CONFIG.circleReadsHours);
    this.close();
  },

  /* ---------- shore it up ----------
     No plan, no target — you spend the hour on the people instead. Raises the
     loyalty of whoever is wobbliest, which is the counter to the leak risk. */
  async shoreUp(c, npcs, cast) {
    const P = GAME.player;
    const weakest = [...npcs].sort((a, b) =>
      Coalitions.loyaltyOf(c, a, cast) - Coalitions.loyaltyOf(c, b, cast))[0];
    this.say('You', '"I am not putting a name up. I want to know we are alright."', 'me');
    await this.next();
    for (const m of npcs) {
      const isWeak = m === weakest;
      const gain = (isWeak ? CONFIG.circleShoreWeak : CONFIG.circleShoreOther);
      m.addTrust(P.name, gain, 'you held the pact together');
      m.addRel(P.name, gain * 0.7, 'you held the pact together');
      /* And they warm to each other a little, which is what cohesion is made of
         and the only lever the player has on NPC-to-NPC warmth in a group. */
      for (const o of npcs) if (o !== m) m.addTrust(o.name, gain * 0.45, 'the pact talked it out');
      this.say(m.displayName, isWeak ? pick([
        '"...Yeah. I needed to hear that, if I am honest."',
        '"I have been wobbling. I will be straight with you about that."',
        '"Alright. Alright. I am here."'
      ]) : pick([
        '"We are alright."', '"Nothing has changed for me."', '"Same page. Always was."'
      ]), 'them');
      await this.next();
    }
    /* A quiet reassurance meeting is much less conspicuous than agreeing a name. */
    c.visibility = Math.min(1, (c.visibility || 0) + CONFIG.circleMeetingVisibility * 0.35);
    Journal.event('circleShoreUp', { weakest: weakest.displayName });
    consumeTime(CONFIG.circleReadsHours);
    this.close();
  },

  /* ---------- voice ----------
     Every line has to be able to reference the ROOM, because that is the whole
     difference between this and a one-to-one. */
  openingLine(c, m, npcs, cast) {
    const P = GAME.player;
    const others = npcs.filter(x => x !== m);
    const loy = Coalitions.loyaltyOf(c, m, cast);
    /* Who in this room do they have an opinion about? */
    let liked = null, disliked = null, lw = 0.55, dw = 0.40;
    for (const o of others) {
      const w = Coalitions.warmth(m, o);
      if (w > lw) { lw = w; liked = o; }
      if (w < dw) { dw = w; disliked = o; }
    }
    const seen = (c.visibility || 0) > CONFIG.circleNoticedAbove;
    if (seen && chance(0.4)) return pick([
      `"We should stop doing this in daylight. People are counting heads."`,
      `"Every time the four of us walk off together somebody watches us go."`,
      `"This is getting obvious. That is the only thing worrying me."`
    ]);
    if (disliked && chance(0.45)) return pick([
      `"I will say it with ${disliked.displayName} standing right here — I am not sure about this."`,
      `"No offence to ${disliked.displayName}, but I do not know that we all want the same thing."`,
      `"Me and ${disliked.displayName} have not exactly been talking."`
    ]);
    if (liked && chance(0.5)) return pick([
      `"Me and ${liked.displayName} were saying the same thing this morning."`,
      `"Whatever ${liked.displayName} says, basically. We are aligned."`,
      `"${liked.displayName} and I already went over this at the water."`
    ]);
    if (loy > 0.66) return pick([
      '"Say it. Whatever it is, say it."',
      '"I am in. I have been in. What do you need?"',
      '"Good. I wanted this conversation."'
    ]);
    if (loy < 0.42) return pick([
      '"Make it quick. I do not want to be down here long."',
      '"I am listening. That is all I am promising."',
      '"...Alright. What is this about?"'
    ]);
    return pick([
      '"What have you got?"',
      '"Go on then."',
      '"I am here. Talk."'
    ]);
  },

  reactionLine(m, target, yes, agreed, order, momentum) {
    const n = agreed.length;
    const lastAgreer = n > 0 ? dnOf(agreed[n - 1]) : null;
    if (yes) {
      if (n === 1) return pick([
        `"Yes. ${target.displayName}. I have been waiting for someone to say it."`,
        `"${target.displayName}. Done. I am with you."`,
        `"Good. That is who I would have named."`
      ]);
      if (momentum >= 2) return pick([
        `"If ${lastAgreer} is in, I am in. ${target.displayName} it is."`,
        `"That is three of us. ${target.displayName} does not survive that."`,
        `"Then it is decided. I will write it."`
      ]);
      return pick([
        `"...Alright. ${target.displayName}."`,
        `"I can live with ${target.displayName}."`,
        `"Fine. But it needs to be all of us."`
      ]);
    }
    if (momentum <= -2) return pick([
      `"No. And I do not think I am alone in that."`,
      `"That is two of us saying no. Read the room."`,
      `"We are not writing ${target.displayName}. Not tonight."`
    ]);
    if (n > 0) return pick([
      `"${lastAgreer} can do what they like. I am not writing ${target.displayName}."`,
      `"I hear you. I am still not doing it."`,
      `"You have your majority without me, then. It will not be my name on it."`
    ]);
    return pick([
      `"${target.displayName}? No. That is the wrong name and the wrong night."`,
      `"I am not there yet. Ask me again tomorrow."`,
      `"No. ${target.displayName} is more use to me here than gone."`
    ]);
  }
};
