/* ============================================================
   WHISPERING AT TRIBAL COUNCIL

   The rarest and best thing the show does. Somebody leans over, says a name, and
   within fifteen seconds there are four separate conversations happening on a
   bench in front of eleven people and a host who does not stop it. Then it runs
   out of things to say and stops on its own.

   Three properties matter, and all three are easy to get wrong:

   1. IT IS RARE. Once or twice a season. A council where everybody already knows
      how it is going sits in silence, and that is most councils. So the trigger is
      not a dice roll on the night — it is a question about the ROOM: is there
      somebody here who genuinely does not know how this is going to go, or who
      wants it to go differently than it is about to? If not, nobody whispers.

   2. IT CASCADES. One whisper is not the event. The event is the second, third
      and fourth whisper it sets off between people who were not part of the first
      one. Each round is less likely than the last, so it always terminates.

   3. PEFF DOES NOT STOP IT. He watches, he enjoys it, and he waits. The only
      thing that ends it is running out of momentum. Anything else would be the
      host solving the player's problem for them.

   The player gets a small, hard-capped number of whispers of their own — few
   enough that choosing WHO is the decision, rather than working through the bench.
   ============================================================ */
'use strict';

const Whisper = {
  /* Season state, so "once or twice a season" is enforceable rather than hoped for. */
  councils: 0,
  fired: 0,
  reset() { this.councils = 0; this.fired = 0; if (typeof Whispers !== 'undefined') Whispers.reset(); },

  /* ---------- should tonight be a whispering night? ----------
     Asked of the ROOM, not of the dice. An NPC starts it if their read of the
     night is muddled, or if they can see a name coming that they do not want. */
  unsureOnes(pool) {
    const out = [];
    for (const c of pool) {
      if (c.isPlayer) continue;
      /* How concentrated is their own read of the vote? One clear favourite means
         they are settled; a flat spread across three names means they have no idea,
         and a castaway with no idea is the one who leans over. */
      const reads = pool.filter(o => o !== c).map(o => Math.max(0, c.getVW(o.name)));
      if (!reads.length) continue;
      const total = reads.reduce((a, b) => a + b, 0);
      if (total <= 0.01) { out.push({ c, why: 'no read at all', muddle: 1 }); continue; }
      const top = Math.max(...reads);
      const muddle = 1 - top / total;                 // 0 = certain, 1 = no idea
      /* Or: they can see their OWN name coming, which is the other reason people
         start whispering — not confusion, self-preservation. */
      let heat = 0;
      for (const o of pool) if (o !== c) heat += Math.max(0, o.getVW(c.name));
      heat /= Math.max(1, pool.length - 1);
      const scared = heat > 0.55;
      if (muddle > CONFIG.whisperUnsureBar || scared) {
        out.push({ c, why: scared ? 'sees it coming' : 'cannot read the room', muddle });
      }
    }
    return out;
  },

  shouldFire(pool) {
    if (!GAME.seasonActive) return null;
    if (GAME.day < CONFIG.whisperMinDay) return null;
    if (pool.length < 5) return null;                 // a bench of four cannot whisper
    this.councils++;
    /* Pace it against how much season is left, so the two do not both land in
       week one and leave nothing for the merge. */
    const expected = CONFIG.whisperSeasonTarget;
    if (this.fired >= expected) return null;
    const cands = this.unsureOnes(pool);
    if (!cands.length) return null;
    /* The remaining councils this season, roughly. Spread the remaining budget
       across them, so the chance rises naturally as the season runs out. */
    const councilsLeft = Math.max(1, Math.round((alive().length - 2) / 1));
    const need = expected - this.fired;
    const p = clamp01(need / councilsLeft);
    const roll = chance(p);
    DBG.decision('Whisper', 'trigger check', {
      day: GAME.day, unsure: cands.length, fired: this.fired,
      councilsLeft, p: +p.toFixed(2), roll
    });
    if (!roll) return null;
    cands.sort((a, b) => b.muddle - a.muddle);
    return cands[0];
  },

  /* ---------- the scene ---------- */
  async run(pool) {
    const starter = this.shouldFire(pool);
    /* No starter means no whispering, and the player is offered nothing. That is
       deliberate: an always-available "whisper" button would make it a routine
       phase of every council instead of the thing that happens twice a season. */
    if (!starter) return false;
    this.fired++;

    const P = GAME.player;
    const first = starter.c;
    const partner = this.pickPartner(first, pool);
    if (!partner) return false;

    DBG.action('Whisper', 'council breaks open', `${first.displayName} -> ${partner.displayName} (${starter.why})`);
    Journal.event('whisperNight', { day: GAME.day, starter: first.displayName, why: starter.why });

    Screens.push('screen-whisper');
    $('wh-convo').innerHTML = '';
    $('wh-choices').innerHTML = '';
    this.paintBench(pool);

    this.say('', Whispers.say('cascadeStart', this.subs(pool, { n1: first.displayName, n2: partner.displayName })), 'stage');
    await this.next();
    this.say('', Whispers.say('peffWatches', this.subs(pool)), 'peff');
    await this.next();

    /* Round one is between two NPCs and the player may or may not catch it. */
    await this.npcRound(first, partner, pool);

    /* Then it spreads, with a decaying chance, until it runs out. Peff never
       intervenes; the loop terminates because the probability does. */
    let p = CONFIG.whisperCascadeBase;
    let rounds = 0;
    const involved = new Set([first.name, partner.name]);
    while (rounds < CONFIG.whisperCascadeMax && chance(p)) {
      rounds++;
      const a = pick(pool.filter(c => !c.isPlayer && !involved.has(c.name)))
        || pick(pool.filter(c => !c.isPlayer));
      if (!a) break;
      const b = this.pickPartner(a, pool, involved);
      if (!b) break;
      involved.add(a.name); involved.add(b.name);
      this.say('', Whispers.say('cascadeSpread', this.subs(pool, { n1: a.displayName, n2: b.displayName })), 'stage');
      await this.next();
      await this.npcRound(a, b, pool);
      p *= CONFIG.whisperCascadeDecay;
    }

    /* The player's own turn, while it is still loud enough to be covered. */
    await this.playerTurn(pool, involved);

    this.say('', Whispers.say('cascadeDying', this.subs(pool)), 'stage');
    await this.next();
    this.say('', Whispers.say('cascadeOver', this.subs(pool)), 'stage');
    await this.next();
    this.say('', Whispers.say('peffResumes', this.subs(pool)), 'peff');
    await this.next();

    Screens.pop();
    return true;
  },

  /* ---------- substitutions ----------
     Whispers.say deliberately leaves an unsupplied placeholder VISIBLE rather than
     printing a blank, so that a missing sub is a bug you can see instead of a
     sentence with a hole in it. Which means the caller has to supply every slot any
     line in that pool might use — and the staging pools do use names.

     This builds a complete set from whoever is on the bench, so no pool can render
     with a hole regardless of which line it picks. Caught by tools/tribal-test.js,
     and only under load: the scene has enough branches that a hand-supplied
     two-name set covered it most of the time. */
  subs(pool, extra) {
    const npcs = shuffle(pool.filter(c => !c.isPlayer));
    const nm = i => (npcs[i] ? npcs[i].displayName : (npcs[0] ? npcs[0].displayName : 'somebody'));
    const base = {
      n1: nm(0), n2: nm(1), n3: nm(2),
      me: GAME.player ? GAME.player.displayName : 'you',
      tn: nm(0),
      rest: npcs.length > 3 ? 'and ' + (npcs.length - 3) + ' others' : ''
    };
    return Object.assign(base, extra || {});
  },

  /* Who would this castaway lean over to? Somebody they actually trust, and who
     is sitting within reach — which here means not the person they are planning
     to write down. */
  pickPartner(c, pool, exclude) {
    const cands = pool.filter(o => o !== c && !o.isPlayer
      && (!exclude || !exclude.has(o.name)));
    if (!cands.length) return null;
    let best = null, bs = -Infinity;
    for (const o of cands) {
      const warm = o.getTrust(c.name) * 0.6 + o.getRel(c.name) * 0.4;
      const s = warm + rr(-0.2, 0.2) - Math.max(0, c.getVW(o.name)) * 0.4;
      if (s > bs) { bs = s; best = o; }
    }
    return best;
  },

  /* One exchange between two NPCs. The player catches some of it. */
  async npcRound(a, b, pool) {
    const heard = chance(CONFIG.whisperOverhearChance);
    /* What A is actually doing: pushing their own name, or asking. */
    const targets = pool.filter(x => x !== a && x !== b);
    let want = null, bw = -Infinity;
    for (const t of targets) { const w = a.getVW(t.name); if (w > bw) { bw = w; want = t; } }

    if (!heard) {
      this.say('', Whispers.say('overheardFragment', this.subs(pool)), 'faint');
      await this.next();
    } else {
      this.say(a.displayName, Whispers.say('overheardName',
        this.subs(pool, { tn: want ? want.displayName : 'somebody' })), 'them');
      await this.next();
      const agrees = want && b.getVW(want.name) > -0.2 && b.getTrust(a.name) > 0.35;
      this.say(b.displayName, Whispers.say(agrees ? 'replyLoyalYes' : 'overheardCounter',
        this.subs(pool, { tn: want ? want.displayName : 'somebody' })), 'them');
      await this.next();
      /* And it actually moves the vote, or there was no point in showing it. */
      if (agrees && want) {
        b.addVW(want.name, CONFIG.whisperFlipWeight, `${a.displayName} whispered it at tribal`);
        addIntel(a.name, 'overhear', want.name, 'whispered it at tribal');
        addIntel(b.name, 'agreed', want.name, 'agreed to it at tribal');
      }
    }
  },

  /* ---------- the player's whispers ---------- */
  async playerTurn(pool, involved) {
    const P = GAME.player;
    let left = CONFIG.whisperPlayerMax;
    while (left > 0) {
      const who = await this.pickTarget(pool, left);
      if (!who) break;
      const said = await this.pickLine(who, pool);
      if (!said) continue;
      left--;
      await this.resolvePlayerWhisper(who, said, pool);
    }
  },

  pickTarget(pool, left) {
    return new Promise(res => {
      const box = $('wh-choices');
      box.innerHTML = '';
      const cands = pool.filter(c => !c.isPlayer);
      box.appendChild(h('div', 'tiny dim',
        `You can get to ${left} ${left === 1 ? 'person' : 'people'} before this dies down.`));
      const row = h('div', 'wh-people');
      for (const c of cands) {
        const b = h('button', 'btn wh-person');
        b.appendChild(h('span', 'wh-person-name', c.displayName));
        const read = intelLatestVoteRead(c.name);
        b.appendChild(h('span', 'tiny dim', read ? 'says: ' + dnOf(read.target) : c.occupation));
        if (c.tribeName && typeof Tribes !== 'undefined') Tribes.mark(b, c.tribeName);
        b.onclick = () => { box.innerHTML = ''; res(c); };
        row.appendChild(b);
      }
      box.appendChild(row);
      const skip = h('button', 'btn sand', 'Sit still and let it happen');
      skip.onclick = () => { box.innerHTML = ''; res(null); };
      box.appendChild(skip);
    });
  },

  pickLine(who, pool) {
    return new Promise(res => {
      const box = $('wh-choices');
      box.innerHTML = '';
      const P = GAME.player;
      const others = pool.filter(c => c !== who && !c.isPlayer);
      /* The name the player has been pushing, so "write X" is a real option
         rather than a submenu. */
      let mine = null, bw = -Infinity;
      for (const o of others) { const w = P.getVW(o.name); if (w > bw) { bw = w; mine = o; } }
      const opts = [
        { key: 'askWho', label: 'Ask who they are writing' },
        { key: 'confirm', label: 'Check you are still good' },
        { key: 'warn', label: `Tell them they are the target` },
        { key: 'standDown', label: 'Tell them not to do anything stupid' }
      ];
      if (mine) opts.splice(1, 0, { key: 'pushName', label: `Push ${mine.displayName}`, target: mine });
      if (mine) opts.push({ key: 'flip', label: `Say it has changed — not ${mine.displayName}`, target: mine });
      opts.push({ key: 'bluff', label: 'Bluff about where the numbers are' });
      if (Inventory.has(P, 'idol')) opts.push({ key: 'idolBait', label: 'Hint that you have an idol' });
      else opts.push({ key: 'idolBait', label: 'Hint that you have an idol (you do not)' });

      for (const o of opts) {
        const b = h('button', 'btn', o.label);
        b.onclick = () => { box.innerHTML = ''; res(o); };
        box.appendChild(b);
      }
      const back = h('button', 'btn sand', 'Actually, not them');
      back.onclick = () => { box.innerHTML = ''; res(null); };
      box.appendChild(back);
    });
  },

  async resolvePlayerWhisper(who, said, pool) {
    const P = GAME.player;
    const tn = said.target ? said.target.displayName : '';
    this.say('You', Whispers.say(said.key, this.subs(pool, tn ? { tn } : null)), 'me');
    await this.next();

    /* How they take it: warmth decides whether they engage, game awareness
       decides whether they smell a bluff. */
    const warm = who.getTrust(P.name) * 0.6 + who.getRel(P.name) * 0.4;
    const sharp = who.stats.gameAwareness;
    let replyKey, moved = 0;
    /* The reply's {tn} is not always the name the PLAYER said. When they answer
       with a different name entirely, {tn} has to be THAT name — otherwise
       replyCounterName renders with an empty slot, which is how a pool with a
       placeholder in it ends up printing "I'm writing ." at the fire. */
    let replyTn = tn;

    if (said.key === 'askWho') {
      const read = this.theirName(who, pool);
      if (warm > 0.5 && read) {
        replyKey = 'replyCounterName';
        replyTn = read.displayName;
        addIntel(who.name, 'claim', read.name, 'told you at tribal');
      } else replyKey = warm > 0.35 ? 'replyLoyalStall' : 'replyColdRefuse';
    } else if (said.key === 'pushName' && said.target) {
      if (warm > 0.45) {
        replyKey = warm > 0.66 ? 'replyLoyalYes' : 'replyLoyalStall';
        moved = CONFIG.whisperFlipWeight * (warm > 0.66 ? 1 : 0.5);
        who.addVW(said.target.name, moved, 'you whispered it at tribal');
      } else if (sharp > 0.55) {
        replyKey = 'replyColdRefuse';
        who.addSuspicion(P.name, 0.08, 'whispered a name at you at tribal');
      } else replyKey = 'replyColdFake';
    } else if (said.key === 'warn') {
      /* Telling somebody they are the target is real information, and it is the
         one whisper that can make an idol come out. */
      replyKey = warm > 0.4 ? 'replyPanic' : 'replyOffended';
      who.idolWarnedDay = GAME.day;
      who.addTrust(P.name, warm > 0.4 ? 0.06 : -0.04, 'warned them at tribal');
      addIntel(who.name, 'heat', who.name, 'you warned them at tribal');
    } else if (said.key === 'confirm') {
      replyKey = warm > 0.55 ? 'replyLoyalYes' : warm > 0.35 ? 'replyLoyalStall' : 'replyColdFake';
    } else if (said.key === 'flip' && said.target) {
      if (warm > 0.5) {
        replyKey = 'replyLoyalStall';
        who.addVW(said.target.name, -CONFIG.whisperFlipWeight * 0.7, 'you pulled them off it at tribal');
      } else replyKey = 'replyColdRefuse';
    } else if (said.key === 'bluff') {
      /* A bluff is a lie and goes through the lying system, so it can be caught
         later at the reveal like any other. */
      const outcome = Lying.evaluate(who, P, 'Lie', 'TargetInfo', null);
      replyKey = outcome === 'Believed' ? 'replyAlreadyKnew'
        : outcome === 'Doubted' ? 'replyLoyalStall' : 'replyOffended';
      if (outcome === 'Caught') who.addVW(P.name, 0.6, 'caught bluffing at tribal');
    } else if (said.key === 'idolBait') {
      const real = Inventory.has(P, 'idol');
      replyKey = 'replyIdolFear';
      /* True or not, it makes people put their votes somewhere safer — which is
         the entire reason players do this. A bluff that gets checked costs. */
      for (const o of pool) {
        if (o === P || o.isPlayer) continue;
        if (o.stats.gameAwareness < 0.6 || real) o.addVW(P.name, -0.5, 'they might have an idol');
      }
      if (!real) PlayerSecrets.add('SpreadRumor', P.name, GAME.day);
    } else {
      replyKey = warm > 0.45 ? 'replyLoyalYes' : 'replyNoTime';
    }

    /* Last resort: if the chosen pool wants a name and we have none, fall back to
       a pool that does not. Better a different line than a line with a hole in it. */
    if (!replyTn && /CounterName/.test(replyKey)) replyKey = 'replyLoyalStall';
    this.say(who.displayName, Whispers.say(replyKey, this.subs(pool, replyTn ? { tn: replyTn } : null)), 'them');
    await this.next();
    DBG.decision('Whisper', 'player whisper', {
      to: who.displayName, said: said.key, reply: replyKey,
      warm: +warm.toFixed(2), moved: +moved.toFixed(2)
    });
    Journal.event('whisper', { to: who.displayName, said: said.key, reply: replyKey });
  },

  theirName(who, pool) {
    let best = null, bw = -Infinity;
    for (const o of pool) {
      if (o === who) continue;
      const w = who.getVW(o.name);
      if (w > bw) { bw = w; best = o; }
    }
    return bw > 0.2 ? best : null;
  },

  /* ---------- presentation ---------- */
  paintBench(pool) {
    const host = $('wh-bench');
    host.innerHTML = '';
    for (const c of pool) {
      const chip = h('div', 'wh-seat' + (c.isPlayer ? ' me' : ''), railName(c.displayName));
      if (c.tribeName && typeof Tribes !== 'undefined') Tribes.mark(chip, c.tribeName);
      host.appendChild(chip);
    }
  },

  say(who, text, cls) {
    const box = $('wh-convo');
    const turn = h('div', 'wh-turn ' + (cls || ''));
    if (who) turn.appendChild(h('div', 'wh-who', who));
    turn.appendChild(h('div', 'wh-text', text));
    box.appendChild(turn);
    box.scrollTop = box.scrollHeight;
    while (box.children.length > 8) box.removeChild(box.firstChild);
    return turn;
  },

  /* One line per tap, the same rule the marooning and the pact meeting follow. */
  next() {
    return new Promise(res => {
      const box = $('wh-choices');
      box.innerHTML = '';
      const b = h('button', 'btn small wh-next', '▸');
      box.appendChild(b);
      const layer = $('screen-whisper');
      const go = () => {
        if (!this._adv) return;
        this._adv = null;
        layer.removeEventListener('click', go);
        res();
      };
      this._adv = go;
      b.onclick = go;
      setTimeout(() => { if (this._adv === go) layer.addEventListener('click', go); }, 60);
    });
  }
};
