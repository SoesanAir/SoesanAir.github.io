/* ============================================================
   DILEMMAS — the inbound half of the loop.

   Diagnosis (core-loop-designer): the loop was ACTION(player talks) ->
   FEEDBACK(line) -> REWARD(trust number) -> DECISION(who next). Two phases were
   broken. The ACTION phase only ever fired when the PLAYER pressed something, so
   the island never acted on you; and the DECISION phase had no teeth, because
   every option was some flavour of "gain trust". Nothing could surprise you
   because nothing arrived unasked, and nothing could hurt because nothing cost.

   A dilemma here obeys three rules:
     1. It arrives unasked, between your own actions.
     2. EVERY option costs something. There is no free exit.
     3. What you are told may be false — and the game does not tell you which.

   The player can always find out later: a lie recorded here is retro-validated
   at tribal by the existing Lying system, so believing a liar has a real bill.
   ============================================================ */

const Dilemmas = {
  lastDay: -99,
  firedToday: 0,
  history: [],           // ids fired this playthrough, to bias toward novelty

  /* ---------- scheduling ---------- */
  ready() {
    if (!GAME.seasonActive || GAME.playerEliminated || GAME.watchMode) return false;
    if (GAME.day < CONFIG.dilemmaFirstDay) return false;
    if ($('dialogue-layer').classList.contains('open')) return false;
    if ($('modal-veil').classList.contains('open')) return false;
    if (typeof APPROACH !== 'undefined' && APPROACH.npc) return false;
    if (GAME.day !== this.lastDay) { this.lastDay = GAME.day; this.firedToday = 0; }
    return this.firedToday < CONFIG.dilemmasPerDayMax;
  },

  /* Everything that can fire. The original six live in DILEMMA_KINDS; the rest
     are in js/dilemma-pool.js, kept separate so the pool can grow without anybody
     having to scroll past the engine. Guarded, so a missing pool file degrades to
     the original six instead of taking the season with it. */
  all() {
    const extra = (typeof DILEMMA_POOL !== 'undefined' && Array.isArray(DILEMMA_POOL)) ? DILEMMA_POOL : [];
    return DILEMMA_KINDS.concat(extra);
  },

  maybeFire() {
    if (!this.ready()) return false;
    if (!chance(CONFIG.dilemmaChance)) return false;
    const pool = this.all();
    const usable = pool.filter(k => { try { return k.can(); } catch { return false; } });
    if (!usable.length) return false;

    /* ---- the repeat guard ----
       "the pop-up events are AWESOME, however very repetitive." With six events
       and a rolling window of three, one in two was a repeat of something from the
       last few days. Now:

         1. Anything not yet seen THIS SEASON is strongly preferred. With around
            thirty events and roughly a dozen firings a season, most seasons should
            never repeat at all.
         2. Only once every eligible event has been seen does it start reusing, and
            then it takes the least recently seen rather than a random one.

       Counting per season rather than per playthrough matters: `history` persists
       across seasons and would eventually starve the pool. */
    const seenThisSeason = this.seasonSeen || (this.seasonSeen = {});
    const unseen = usable.filter(k => !seenThisSeason[k.id]);
    let kind;
    if (unseen.length) {
      kind = pick(unseen);
    } else {
      /* Everything has fired. Take the stalest. */
      const sorted = [...usable].sort((a, b) => (seenThisSeason[a.id] || 0) - (seenThisSeason[b.id] || 0));
      kind = sorted[0];
      DBG.log('system', `Dilemma pool exhausted this season (${usable.length} eligible) — reusing ${kind.id}`);
    }
    seenThisSeason[kind.id] = GAME.day;
    this.firedToday++;
    this.history.push(kind.id);
    DBG.decision('Dilemma', 'FIRED', {
      id: kind.id, day: GAME.day, phase: phaseOf(),
      pool: pool.length, eligible: usable.length, unseen: unseen.length
    });
    try { kind.run(); } catch (e) {
      /* A broken event must never eat the player's turn. */
      DBG.log('system', `Dilemma ${kind.id} threw: ${e.message || e}`);
      return false;
    }
    return true;
  },

  resetSeason() { this.seasonSeen = {}; this.history = []; this.lastDay = -99; this.firedToday = 0; },

  /* ---------- shared presentation ---------- */
  /* Every dilemma is the same shape: someone is in front of you, here is what
     they claim, here are options that all cost. `truthful` says whether the
     claim is actually true — the player is never shown it. */
  open(opts) {
    const { npc, title, situation, claim, options, truthful, about } = opts;
    const body = h('div', 'col');
    const head = h('div', 'probe-head');
    head.appendChild(castCard(npc, npc.occupation, truthful === false ? '' : ''));
    const side = h('div', 'col probe-side');
    side.appendChild(h('div', 'dilemma-sit', situation));
    head.appendChild(side);
    body.appendChild(head);
    if (claim) body.appendChild(h('div', 'probe-said', `${npc.displayName}: “${claim}”`));

    /* ---- who they are talking about ----
       Reported problem: "when one player approaches me, I don't know who the other
       one they are talking about is." A name in a sentence is not enough — the
       player needs the face and, more importantly, where they stand with them,
       because that is the whole basis for deciding what to do about it.

       `about` takes one castaway or several, so an event can be three-handed. */
    const list = !about ? [] : (Array.isArray(about) ? about.filter(Boolean) : [about]);
    if (list.length) {
      body.appendChild(h('div', 'dilemma-about-tag',
        list.length === 1 ? 'This is about:' : 'This is about these ' + list.length + ':'));
      const row = h('div', 'dilemma-about');
      for (const c of list) row.appendChild(this.aboutCard(c));
      body.appendChild(row);
    }

    body.appendChild(h('div', 'dilemma-warn', 'Every way out of this costs you something.'));

    const box = h('div', 'col dilemma-opts');
    for (const o of options) {
      const wrap = h('div', 'maroon-opt');
      const b = h('button', 'btn', o.text);
      b.addEventListener('click', () => {
        Modal.close();
        DBG.decision('Dilemma', 'CHOSE', { id: opts.id, choice: o.text.slice(0, 44), truthful });
        o.go();
      });
      wrap.appendChild(b);
      if (o.cost) wrap.appendChild(h('div', 'maroon-think', o.cost));
      wrap.classList.add('show');            // costs are always visible here
      box.appendChild(wrap);
    }
    body.appendChild(box);
    Modal.open(title, body);
  },

  /* A third party, with the two numbers that actually matter for the decision:
     how warm they are on you and how much they trust you. Shown as bars rather
     than digits, matching every other roster card in the game. */
  aboutCard(c) {
    const P = GAME.player;
    const card = h('div', 'dab');
    const pic = h('div', 'dab-pic');
    if (c.spriteURL) {
      const img = h('img');
      img.src = c.spriteURL; img.alt = c.displayName;
      pic.appendChild(img);
    } else {
      /* Sprite loading can fail; a missing face must not take the event with it. */
      pic.appendChild(h('span', 'dab-initial', (c.displayName || '?').slice(0, 1)));
    }
    if (c.tribeName && typeof Tribes !== 'undefined') Tribes.mark(card, c.tribeName);
    card.appendChild(pic);
    card.appendChild(h('div', 'dab-name', c.displayName));
    const mk = (label, v, cls) => {
      const w = h('div', 'dab-meter');
      w.appendChild(h('span', 'dab-lbl', label));
      const bar = h('div', 'dab-bar ' + cls);
      const fill = h('i');
      fill.style.width = (clamp01(v) * 100).toFixed(0) + '%';
      bar.appendChild(fill);
      w.appendChild(bar);
      return w;
    };
    card.appendChild(mk('bond', c.getRel(P.name), 'rel'));
    card.appendChild(mk('trust', c.getTrust(P.name), 'trust'));
    return card;
  }
};

/* Blended warmth helper, local so this file stands alone. */
const dWarm = (a, b) => a.getTrust(b.name) * 0.65 + a.getRel(b.name) * 0.35;
const dAllies = () => alive().filter(c => !c.isPlayer && PlayerAlliances.level(c.name) > 0);
const dClose = () => alive().filter(c => !c.isPlayer && dWarm(c, GAME.player) > 0.5);

const DILEMMA_KINDS = [
  /* ------------------------------------------------------------------
     1. A RUMOUR ABOUT YOU.
     An ally repeats what someone said you were doing. Sometimes it is
     TRUE — pulled from your own secret ledger, so your real scheming
     comes back at you — and sometimes it is invented.
     ------------------------------------------------------------------ */
  {
    id: 'rumour-about-you',
    can: () => dClose().length > 0 && alive().length > 3,
    run() {
      const P = GAME.player;
      const teller = pick(dClose());
      const others = alive().filter(c => !c.isPlayer && c !== teller);
      if (!others.length) return;
      const source = pick(others);
      /* Half the time the accusation is something the player ACTUALLY did. */
      const real = PlayerSecrets.list.filter(s => s.subject !== teller.name &&
        (s.type === 'PushedVote' || s.type === 'SpreadRumor' || s.type === 'PlantedSeed'));
      const useReal = real.length && chance(0.5);
      const secret = useReal ? pick(real) : null;
      const victim = secret ? GAME.cast.find(c => c.name === secret.subject) : teller;
      const truthful = !!secret;
      const claim = truthful
        ? pick(DILEMMA_LINES.rumourTrue).replace(/\{sn\}/g, source.displayName).replace(/\{vn\}/g, victim ? victim.displayName : teller.displayName)
        : pick(DILEMMA_LINES.rumourFalse).replace(/\{sn\}/g, source.displayName).replace(/\{vn\}/g, teller.displayName);

      DBG.log('sim', 'Dilemma rumour', { teller: teller.name, source: source.name, truthful, about: victim && victim.name });

      Dilemmas.open({
        id: 'rumour-about-you', npc: teller, truthful,
        title: `${teller.displayName} has heard something about you`,
        situation: `${teller.displayName} finds you alone. They are not angry yet — they are giving you the chance to explain.`,
        claim,
        options: [
          {
            text: 'Deny it flatly.',
            cost: truthful ? 'It is true. If they ever confirm it, this costs you everything.'
              : 'Honest denial — but you have no proof, and they came here wanting one.',
            go() {
              const outcome = Lying.evaluate(teller, P, truthful ? 'Lie' : 'Truth', 'TargetInfo', source.name);
              if (outcome === 'Caught') {
                teller.addTrust(P.name, -0.18, 'caught denying a true rumour');
                teller.addSuspicion(P.name, 0.20, 'caught denying a true rumour');
                teller.addVW(P.name, 0.7, 'caught denying a true rumour');
                Feed.post(`${teller.displayName} did not believe you. That went badly.`, 'danger', GAME.day);
              } else if (outcome === 'Believed') {
                teller.addTrust(P.name, 0.05, 'accepted your denial');
                teller.addVW(source.name, 0.5, 'suspects they invented it');
                Feed.post(`${teller.displayName} took your word for it — and is now looking at ${source.displayName}.`, 'good', GAME.day);
              } else {
                teller.addSuspicion(P.name, 0.08, 'half-believed your denial');
                Feed.post(`${teller.displayName} is not sure about you.`, 'drama', GAME.day);
              }
            }
          },
          {
            text: 'Admit it. Explain why.',
            cost: truthful ? 'Costs trust now, but honesty is the only thing that survives being checked.'
              : 'You are confessing to something you did not do.',
            go() {
              teller.addTrust(P.name, truthful ? 0.10 : -0.08, truthful ? 'owned up honestly' : 'confessed to something untrue');
              teller.addRel(P.name, truthful ? 0.04 : -0.05, 'confession');
              teller.addVW(P.name, truthful ? -0.2 : 0.3, 'confession', 'how you answered them');
              if (victim) victim.addTrust(P.name, -0.10, 'your admission got back to them');
              PlayerSecrets.add('SpreadRumor', source.name, GAME.day);
              Feed.post(truthful
                ? `You owned it. ${teller.displayName} respects that more than the lie would have cost.`
                : `You admitted to something you never did. ${teller.displayName} filed it away.`,
                truthful ? 'good' : 'danger', GAME.day);
            }
          },
          {
            text: `Turn it around — “${source.displayName} is working you.”`,
            cost: 'Makes an enemy of the source whether you are right or not.',
            go() {
              teller.addVW(source.name, 0.8, 'you redirected them');
              teller.addTrust(P.name, 0.03, 'redirected the heat');
              source.addTrust(P.name, -0.15, 'you named them behind their back');
              source.addVW(P.name, 0.6, 'you named them behind their back');
              addIntel(teller.name, 'heat', source.name, 'you pointed them at the source');
              checkGossipBack(teller, source);
              Feed.post(`You put it on ${source.displayName}. That will not stay quiet.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Say nothing. Let them decide.',
            cost: 'Silence reads as guilt to almost everyone.',
            go() {
              teller.addTrust(P.name, -0.07, 'refused to answer a rumour');
              teller.addSuspicion(P.name, 0.12, 'refused to answer a rumour');
              Feed.post(`You said nothing. ${teller.displayName} drew their own conclusion.`, 'drama', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     2. YOUR ALLY WROTE YOUR NAME — and someone else is telling you.
     ------------------------------------------------------------------ */
  {
    id: 'ally-betrayal-claim',
    can: () => dAllies().length > 0 && alive().length > 3 && GAME.voteHistory && GAME.voteHistory.length > 0,
    run() {
      const P = GAME.player;
      const ally = pick(dAllies());
      const teller = pick(alive().filter(c => !c.isPlayer && c !== ally));
      /* Did the ally actually write the player's name at a past council? */
      const truthful = (GAME.voteHistory || []).some(h => h.votes.some(([v, t]) => v === ally.name && t === P.name));
      DBG.log('sim', 'Dilemma betrayal claim', { ally: ally.name, teller: teller.name, truthful });
      Dilemmas.open({
        id: 'ally-betrayal-claim', npc: teller, truthful, about: ally,
        title: `${teller.displayName} says your ally is playing you`,
        situation: `${teller.displayName} has waited until ${ally.displayName} is out of sight. They want something for this.`,
        claim: pick(DILEMMA_LINES.betrayalClaim).replace(/\{an\}/g, ally.displayName),
        options: [
          {
            text: `Confront ${ally.displayName} with it now.`,
            cost: 'If it is false you have just told your ally you doubt them.',
            go() {
              if (truthful) {
                ally.addTrust(P.name, -0.05, 'confronted with a true betrayal');
                ally.addSuspicion(P.name, 0.05, 'confronted');
                const a = PlayerAlliances.get(ally.name); if (a) a.broken = true;
                P.addTrust(ally.name, -0.25, 'they really did write your name');
                Feed.post(`${ally.displayName} could not deny it. That alliance is finished.`, 'danger', GAME.day);
              } else {
                ally.addTrust(P.name, -0.14, 'accused them on a stranger word');
                ally.addRel(P.name, -0.10, 'accused them on a stranger word');
                Feed.post(`${ally.displayName} was telling the truth, and you just insulted them.`, 'danger', GAME.day);
              }
            }
          },
          {
            text: 'Say nothing and quietly start covering yourself.',
            cost: 'Costs you nothing today. Costs you the benefit of the doubt later.',
            go() {
              P.addTrust(ally.name, -0.10, 'privately doubted them');
              ally.addRel(P.name, -0.03, 'you cooled toward them');
              addIntel(teller.name, 'heat', ally.name, `claims ${ally.displayName} wrote you`);
              Feed.post('You kept it to yourself. Something has changed anyway.', 'drama', GAME.day);
            }
          },
          {
            text: `Tell ${ally.displayName} who is spreading this.`,
            cost: 'Buys your ally back and buys you an enemy.',
            go() {
              ally.addTrust(P.name, 0.12, 'warned them about a whisperer');
              ally.addVW(teller.name, 0.7, 'you named the whisperer');
              teller.addTrust(P.name, -0.20, 'you burned them immediately');
              teller.addVW(P.name, 0.7, 'you burned them immediately');
              Feed.post(`You took it straight to ${ally.displayName}. ${teller.displayName} will not forget that.`, 'drama', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     3. LOYALTY TEST — an ally demands you cut somebody to prove you.
     ------------------------------------------------------------------ */
  {
    id: 'loyalty-test',
    can: () => dAllies().length > 0 && dClose().length > 1,
    run() {
      const P = GAME.player;
      const ally = pick(dAllies());
      const friends = dClose().filter(c => c !== ally);
      if (!friends.length) return;
      const mark = pick(friends);
      DBG.log('sim', 'Dilemma loyalty test', { ally: ally.name, mark: mark.name });
      Dilemmas.open({
        id: 'loyalty-test', npc: ally, truthful: true, about: mark,
        title: `${ally.displayName} wants proof`,
        situation: `${ally.displayName} has decided you are either with them or you are not, and they want it settled tonight.`,
        claim: pick(DILEMMA_LINES.loyaltyTest).replace(/\{mn\}/g, mark.displayName),
        options: [
          {
            text: `Agree. Write ${mark.displayName}.`,
            cost: `Locks in ${ally.displayName} and destroys what you had with ${mark.displayName}.`,
            go() {
              PlayerAlliances.align(ally.name, GAME.day);
              PlayerAlliances.promise(ally.name, GAME.day);
              ally.addTrust(P.name, 0.16, 'passed their loyalty test');
              GAME.player.addVW(mark.name, 1.0, 'promised to write them');
              mark.addTrust(P.name, -0.06, 'sensed something change');
              PlayerSecrets.add('PushedVote', mark.name, GAME.day);
              Feed.post(`You gave ${ally.displayName} a name. It was ${mark.displayName}.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Refuse. Tell them you do not do ultimatums.',
            cost: `${ally.displayName} may walk, and they know your business.`,
            go() {
              ally.addTrust(P.name, -0.14, 'refused their ultimatum');
              ally.addSuspicion(P.name, 0.10, 'refused their ultimatum');
              if (chance(0.5)) {
                const a = PlayerAlliances.get(ally.name); if (a) a.broken = true;
                Feed.post(`${ally.displayName} walked away from you.`, 'danger', GAME.day);
              } else {
                Feed.post(`${ally.displayName} did not like that, but they are still here.`, 'drama', GAME.day);
              }
              mark.addTrust(P.name, 0.06, 'you would not sell them');
            }
          },
          {
            text: `Agree out loud — and warn ${mark.displayName} later.`,
            cost: 'Playing both sides. If either finds out, it is worse than refusing.',
            go() {
              ally.addTrust(P.name, 0.12, 'appeared to pass the test');
              Lying.evaluate(ally, P, 'Lie', 'VoteIntent', mark.name);
              mark.addTrust(P.name, 0.10, 'you warned them');
              mark.addVW(ally.name, 0.6, 'you warned them about the ally');
              PlayerSecrets.add('PushedVote', mark.name, GAME.day);
              if (chance(0.35)) {
                ally.addTrust(P.name, -0.22, 'found out you double-dealt');
                ally.addVW(P.name, 0.8, 'found out you double-dealt');
                Feed.post(`${ally.displayName} found out you went to ${mark.displayName}.`, 'danger', GAME.day);
              } else {
                Feed.post('You are running both sides of this. For now.', 'drama', GAME.day);
              }
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     4. TWO PEOPLE, ONE SEAT. Both ask you to save them.
     ------------------------------------------------------------------ */
  {
    id: 'two-pleas',
    can: () => dClose().length > 1 && isTribalDay(GAME.day),
    run() {
      const P = GAME.player;
      const pool = shuffle([...dClose()]);
      const a = pool[0], b = pool[1];
      DBG.log('sim', 'Dilemma two pleas', { a: a.name, b: b.name });
      Dilemmas.open({
        id: 'two-pleas', npc: a, truthful: true, about: b,
        title: 'Two of them, one of you',
        situation: `${a.displayName} got to you first. ${b.displayName} is already walking over. They both want the same promise and you can only keep one.`,
        claim: pick(DILEMMA_LINES.twoPleas).replace(/\{on\}/g, b.displayName),
        options: [
          {
            text: `Promise ${a.displayName}.`,
            cost: `${b.displayName} will know you chose, and who you chose.`,
            go() { resolveTwoPleas(a, b); }
          },
          {
            text: `Promise ${b.displayName}.`,
            cost: `${a.displayName} asked you first. They will remember that.`,
            go() { resolveTwoPleas(b, a); }
          },
          {
            text: 'Promise them both and hope it never comes up.',
            cost: 'It will come up. One of them will be right to hate you.',
            go() {
              for (const c of [a, b]) {
                c.addTrust(P.name, 0.08, 'promised them protection');
                Lying.evaluate(c, P, 'Lie', 'VoteIntent', '(none)');
              }
              Feed.post('You promised both of them. That is going to land badly on somebody.', 'drama', GAME.day);
            }
          },
          {
            text: 'Refuse both. Keep your hands clean.',
            cost: 'Two people just learned you will not stand up for anyone.',
            go() {
              for (const c of [a, b]) {
                c.addTrust(P.name, -0.10, 'refused to protect them');
                c.addRel(P.name, -0.06, 'refused to protect them');
                c.addVW(P.name, 0.3, 'refused to protect them');
              }
              Feed.post('You promised nobody. Both of them noticed.', 'danger', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     5. A CONFESSION — someone admits they lied to you earlier.
     ------------------------------------------------------------------ */
  {
    id: 'confession',
    can: () => alive().filter(c => !c.isPlayer && c.relEntry(GAME.player.name) &&
      c.relEntry(GAME.player.name).suspicion > 0.05).length > 0,
    run() {
      const P = GAME.player;
      const pool = alive().filter(c => !c.isPlayer && c.relEntry(P.name) && c.relEntry(P.name).suspicion > 0.05);
      const npc = pick(pool);
      DBG.log('sim', 'Dilemma confession', { npc: npc.name });
      Dilemmas.open({
        id: 'confession', npc, truthful: true,
        title: `${npc.displayName} wants to come clean`,
        situation: `${npc.displayName} has clearly been working up to this for a while.`,
        claim: pick(DILEMMA_LINES.confession),
        options: [
          {
            text: 'Forgive them. Properly.',
            cost: 'They may simply be better at this than you are.',
            go() {
              npc.addTrust(P.name, 0.18, 'you forgave a confession');
              npc.addRel(P.name, 0.12, 'you forgave a confession');
              npc.addVW(P.name, -0.6, 'you forgave a confession');
              if (PlayerAlliances.level(npc.name) === 0) PlayerAlliances.align(npc.name, GAME.day);
              Feed.post(`You let it go. ${npc.displayName} will not forget that.`, 'good', GAME.day);
            }
          },
          {
            text: 'Accept it, but tell them the trust is gone.',
            cost: 'Honest, and it keeps them close without keeping them loyal.',
            go() {
              npc.addTrust(P.name, 0.04, 'accepted the confession coldly');
              npc.addRel(P.name, -0.04, 'accepted the confession coldly');
              P.addTrust(npc.name, -0.12, 'they admitted lying to you');
              Feed.post('You accepted it without pretending it was fine.', 'drama', GAME.day);
            }
          },
          {
            text: 'Use it. Ask them for something in return.',
            cost: 'Turns guilt into leverage — and makes you the thing they confessed about.',
            go() {
              npc.addVW(P.name, 0.4, 'you charged them for forgiveness');
              npc.addTrust(P.name, -0.06, 'you charged them for forgiveness');
              GAME.player.addVW(npc.name, -0.4, 'they owe you now');
              const t = pick(alive().filter(c => !c.isPlayer && c !== npc));
              if (t) { npc.addVW(t.name, 0.8, 'the price of your forgiveness'); }
              Feed.post(`You made ${npc.displayName} pay for it.`, 'drama', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     6. AN OVERHEARD CONVERSATION — act now or keep the information.
     ------------------------------------------------------------------ */
  {
    id: 'overheard',
    can: () => alive().filter(c => !c.isPlayer).length > 2,
    run() {
      const P = GAME.player;
      const pool = shuffle(alive().filter(c => !c.isPlayer));
      const a = pool[0], b = pool[1];
      const target = pool[2] || P;
      const aboutPlayer = target === P || chance(0.4);
      DBG.log('sim', 'Dilemma overheard', { a: a.name, b: b.name, aboutPlayer });
      Dilemmas.open({
        id: 'overheard', npc: a, truthful: true, about: b,
        title: 'You were not supposed to hear that',
        situation: `You come round the shelter and ${a.displayName} and ${b.displayName} stop talking a half-second too late.`,
        claim: aboutPlayer ? pick(DILEMMA_LINES.overheardYou) : pick(DILEMMA_LINES.overheardOther).replace(/\{tn\}/g, target.displayName),
        options: [
          {
            text: 'Walk in and ask them straight out.',
            cost: 'They will close ranks, and now they know you heard.',
            go() {
              for (const c of [a, b]) {
                c.addSuspicion(P.name, 0.10, 'caught them talking');
                c.addTrust(P.name, -0.05, 'caught them talking');
              }
              addIntel(a.name, 'overhear', aboutPlayer ? P.name : target.name, 'you confronted them');
              Feed.post(`You walked straight in. ${a.displayName} and ${b.displayName} said very little.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Back off quietly and keep it.',
            cost: 'You keep the information and lose the chance to stop it.',
            go() {
              addIntel(a.name, 'overhear', aboutPlayer ? P.name : target.name, 'overheard, unnoticed');
              if (aboutPlayer) { a.addVW(P.name, 0.3, 'plan you did not interrupt'); b.addVW(P.name, 0.3, 'plan you did not interrupt'); }
              Feed.post('You backed away. Whatever that was, it is still happening.', 'drama', GAME.day);
            }
          },
          {
            text: aboutPlayer ? `Tell the rest of camp what they are doing.` : `Warn ${target.displayName}.`,
            cost: 'Spreads fast, and you become the person who spreads things.',
            go() {
              if (aboutPlayer) {
                for (const c of alive()) {
                  if (c.isPlayer || c === a || c === b) continue;
                  c.addVW(a.name, 0.35, 'you exposed their scheming');
                  c.addVW(b.name, 0.35, 'you exposed their scheming');
                }
                a.addTrust(P.name, -0.18, 'you exposed them'); b.addTrust(P.name, -0.18, 'you exposed them');
                Feed.post(`You told the beach about ${a.displayName} and ${b.displayName}.`, 'danger', GAME.day);
              } else {
                target.addTrust(P.name, 0.14, 'you warned them');
                target.addVW(a.name, 0.7, 'you warned them'); target.addVW(b.name, 0.5, 'you warned them');
                checkGossipBack(target, a);
                Feed.post(`You warned ${target.displayName}.`, 'drama', GAME.day);
              }
              PlayerSecrets.add('SpreadRumor', a.name, GAME.day);
            }
          }
        ]
      });
    }
  }
];

function resolveTwoPleas(chosen, rejected) {
  const P = GAME.player;
  chosen.addTrust(P.name, 0.14, 'you chose them');
  chosen.addRel(P.name, 0.08, 'you chose them');
  chosen.addVW(P.name, -0.5, 'you chose them');
  if (PlayerAlliances.level(chosen.name) === 0) PlayerAlliances.align(chosen.name, GAME.day);
  rejected.addTrust(P.name, -0.16, 'you chose someone else');
  rejected.addRel(P.name, -0.10, 'you chose someone else');
  rejected.addVW(P.name, 0.6, 'you chose someone else');
  Feed.post(`You backed ${chosen.displayName}. ${rejected.displayName} watched you do it.`, 'drama', GAME.day);
}

/* ============================================================
   SHOCKS — trust moving without the player touching anything.
   The island talks while you are not in the room; when a swing is big
   enough to matter, you feel it land.
   ============================================================ */
const Shocks = {
  check() {
    if (!GAME.seasonActive || GAME.playerEliminated) return;
    const P = GAME.player;
    for (const c of alive()) {
      if (c.isPlayer) continue;
      const e = c.relEntry(P.name);
      if (!e) continue;
      if (e._lastSeen === undefined) { e._lastSeen = e.trust; continue; }
      const d = e.trust - e._lastSeen;
      if (Math.abs(d) >= CONFIG.shockTrustDelta) {
        Feed.post(d < 0
          ? `${c.displayName} has cooled on you sharply. Somebody got to them.`
          : `${c.displayName} has warmed to you a lot, and you did not do it.`,
          d < 0 ? 'danger' : 'good', GAME.day);
        DBG.decision('Shock', d < 0 ? 'TRUST DROP' : 'TRUST JUMP',
          { npc: c.name, delta: +d.toFixed(3), now: +e.trust.toFixed(2) });
      }
      e._lastSeen = e.trust;
    }
  }
};
