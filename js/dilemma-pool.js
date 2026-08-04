/* ============================================================
   DILEMMA POOL — twenty-four more inbound events.

   Why this file exists: the original six read as repetitive after a week of
   play, and the reason was structural rather than textual. Nearly all of them
   were two-person — one castaway, one accusation, one answer — so the island
   only ever arrived at you as a single voice. On the show the pressure almost
   never comes from one person. It comes from three people standing in front of
   you at once, or from two allies who each think they are your only ally, or
   from a name you have now heard from three separate mouths that each believe
   they told you first. Fifteen of the events below put two or more OTHER
   castaways on screen with the speaker, and they are all passed through `about`
   so the player can see whose bond and trust they are actually spending.

   Rules inherited from dilemmas.js and not negotiable:
     1. It arrives unasked.
     2. EVERY option costs something. There is no free exit.
     3. What you are told may be false, and the game never says which.

   One rule added from playtest: when an event accuses the player of something,
   one option is a flat denial marked `deny: true`. An honest denial can fail to
   convince, but it can never be scored as a caught lie — otherwise the game
   punishes innocence, which players correctly read as broken.

   Where possible `truthful` is derived from real simulation state rather than a
   coin flip: whether the accomplice they name really is allied to them, whether
   the majority they describe really exists, whether your challenge score really
   was bad. That is what makes checking things worth doing.
   ============================================================ */

/* ---------- local helpers ----------
   All prefixed dp- because dilemmas.js already owns dWarm/dAllies/dClose at
   global scope and a second const of the same name is a load-time error. */

const dpWarm = (a, b) => a.getTrust(b.name) * 0.65 + a.getRel(b.name) * 0.35;

/* Everyone the player actually shares a camp and a council with RIGHT NOW.
   Never alive(): pre-merge that pulls in the other tribe, which is the
   cross-tribe leak we have already fixed twice elsewhere. */
const dpHere = () => campmates(GAME.player).filter(c => !c.isPlayer && !c.eliminated);
const dpAllies = () => dpHere().filter(c => PlayerAlliances.level(c.name) > 0);
const dpClose = () => dpHere().filter(c => dpWarm(c, GAME.player) > 0.5);
const dpCold = () => dpHere().filter(c => dpWarm(c, GAME.player) < 0.45);

/* Every can() opens with this. No player, no cast, not enough people left in
   camp to make a triangle — no event. */
const dpBase = n => !!GAME.player && !GAME.playerEliminated && !!GAME.cast.length
  && dpHere().length >= (n || 2);

/* Substitute the {sn}/{vn}/{an}/{tn}/{n1}… placeholders. Unknown keys are left
   alone rather than blanked, so a missing name is visible in testing instead of
   producing a sentence with a hole in it. */
function dpFill(pool, map) {
  let s = pick(pool) || '';
  for (const k in map) {
    if (map[k] === undefined || map[k] === null) continue;
    s = s.split('{' + k + '}').join(map[k]);
  }
  return s;
}

function dpPickN(pool, n) { return shuffle([...pool]).slice(0, n); }
function dpBestOf(npc, pool) {
  return pool.length ? pool.reduce((a, b) => dpWarm(npc, a) >= dpWarm(npc, b) ? a : b) : null;
}
function dpWorstOf(npc, pool) {
  return pool.length ? pool.reduce((a, b) => dpWarm(npc, a) <= dpWarm(npc, b) ? a : b) : null;
}
/* Warmth is directional. When an event needs "the one who would listen to you"
   or "the one who is not yours", the measure is how THEY feel about the player,
   not how the player feels about them — those come apart badly by day ten and
   using the wrong one is why a "close ally" can turn out to be a stranger. */
function dpWarmestToYou(pool) {
  return pool.length ? pool.reduce((a, b) => dpWarm(a, GAME.player) >= dpWarm(b, GAME.player) ? a : b) : null;
}
function dpCoolestToYou(pool) {
  return pool.length ? pool.reduce((a, b) => dpWarm(a, GAME.player) <= dpWarm(b, GAME.player) ? a : b) : null;
}

/* The name this castaway is genuinely carrying, scoped to their own camp.
   Used to decide whether what they tell you is TRUE. */
function dpLean(c) {
  const pool = campmates(c).filter(x => x !== c && !x.eliminated);
  if (!pool.length) return null;
  const t = c.topVoteTarget(pool);
  return t && t.weight > 0 ? t.target : null;
}

/* A target for an event: their real lean if it is somebody in `pool`, otherwise
   whoever in `pool` they like least, so an event always has a name to use. */
function dpTargetFor(npc, pool) {
  if (!pool.length) return null;
  const lean = dpLean(npc);
  if (lean && pool.includes(lean)) return lean;
  return dpWorstOf(npc, pool);
}

/* Combined vote pressure a group is putting on one person. The honest test for
   "everybody has agreed on this name" and "they are picking you off in order". */
function dpPressure(group, victimName) {
  let w = 0;
  for (const g of group) w += Math.max(0, g.getVW(victimName));
  return w;
}

/* "A, B and C" — the group in `about` should read the same in the prose as it
   does on the cards. */
function dpNames(list) {
  const n = list.map(c => c.displayName);
  if (n.length <= 1) return n[0] || 'nobody';
  return n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
}

/* ---------- denials ----------
   `guilty` is whether the player actually did the thing, and it decides the ONE
   thing that matters: an innocent denial goes into Lying.evaluate as 'Truth'.
   The guarantee that an honest denial is never scored as a caught lie lives in
   Lying.evaluate itself — 'Truth' cannot return 'Caught' — so every denial in
   this file only has to be honest about which it is. The extra branch below is
   belt and braces for the day somebody calls this with a fourth outcome. */
function dpDeny(npc, guilty, type, target) {
  const out = Lying.evaluate(npc, GAME.player, guilty ? 'Lie' : 'Truth', type, target || '(none)');
  return (!guilty && out === 'Caught') ? 'Disbelieved' : out;
}

/* The shape of a denial's fallout, so seven events do not each invent one. */
function dpDenyFallout(npc, guilty, out, what) {
  const P = GAME.player;
  if (out === 'Caught') {
    npc.addTrust(P.name, -0.17, 'caught denying ' + what);
    npc.addSuspicion(P.name, 0.20, 'caught denying ' + what);
    npc.addVW(P.name, 0.7, 'caught denying ' + what);
    Feed.post(`${npc.displayName} knows you are lying about ${what}.`, 'danger', GAME.day);
  } else if (out === 'Believed') {
    npc.addTrust(P.name, guilty ? 0.03 : 0.07, 'your denial landed');
    npc.addSuspicion(P.name, -0.05, 'your denial landed');
    Feed.post(`${npc.displayName} took your word about ${what}.`, 'good', GAME.day);
  } else {
    npc.addTrust(P.name, -0.03, 'half-believed your denial');
    npc.addSuspicion(P.name, guilty ? 0.12 : 0.09, 'half-believed your denial');
    Feed.post(`${npc.displayName} is not sure they believe you about ${what}.`, 'drama', GAME.day);
  }
  return out;
}

/* Something the whole camp sees. Used sparingly — a public act should be rarer
   and heavier than a private one. */
function dpCampSees(fn, except) {
  for (const c of dpHere()) {
    if (except && except.includes(c)) continue;
    fn(c);
  }
}

const DILEMMA_POOL = [

  /* ------------------------------------------------------------------
     1. THROW THE CHALLENGE.
     The thing that makes tribe games political: the fastest route to a council
     is losing on purpose, and it needs an accomplice. The claim under test is
     "{sn} is already in" — true only if they really are paired, so a player who
     has been reading alliances can catch a solo schemer inventing a majority.
     ------------------------------------------------------------------ */
  {
    id: 'throw-the-challenge',
    can: () => dpBase(3) && !GAME.merged && dpClose().length >= 1,
    run() {
      const P = GAME.player;
      const npc = pick(dpClose());
      const rest = dpHere().filter(c => c !== npc);
      if (rest.length < 2) return;
      const partner = dpBestOf(npc, rest);
      const target = dpTargetFor(npc, rest.filter(c => c !== partner));
      if (!partner || !target) return;
      const truthful = NpcAlliances.has(npc.name, partner.name)
        || dpWarm(partner, npc) > 0.62;
      DBG.log('sim', 'Dilemma throw challenge', { npc: npc.name, partner: partner.name, target: target.name, truthful });
      Dilemmas.open({
        id: 'throw-the-challenge', npc, truthful, about: [partner, target],
        title: `${npc.displayName} wants to lose today`,
        situation: pick(DILEMMA_POOL_LINES.throwChallengeSit),
        claim: dpFill(DILEMMA_POOL_LINES.throwChallenge, { sn: partner.displayName, vn: target.displayName }),
        options: [
          {
            text: 'Go along with it. Be slow.',
            cost: 'Anyone sharp enough to notice will notice, and they will not need proof.',
            go() {
              npc.addTrust(P.name, 0.15, 'threw the challenge with them');
              npc.addRel(P.name, 0.06, 'threw the challenge with them');
              npc.addVW(P.name, -0.5, 'threw the challenge with them');
              P.addVW(target.name, 0.8, `${npc.displayName}'s plan`);
              PlayerSecrets.add('PushedVote', target.name, GAME.day);
              /* The cost is not the challenge. It is the audience. */
              for (const c of dpHere()) {
                if (c === npc || c.stats.gameAwareness < 0.55) continue;
                c.addVW(P.name, 0.45, 'read you as tanking it');
                c.addSuspicion(P.name, 0.10, 'read you as tanking it');
              }
              if (truthful) partner.addTrust(P.name, 0.08, 'you played your part');
              else {
                partner.addSuspicion(P.name, 0.14, 'you assumed they were in on something');
                partner.addVW(P.name, 0.4, 'you assumed they were in on something');
              }
              Feed.post(truthful
                ? `You did not try. ${npc.displayName} noticed. So did two other people.`
                : `You did not try — and ${partner.displayName} was never part of this.`,
                truthful ? 'drama' : 'danger', GAME.day);
            }
          },
          {
            text: 'Refuse, and keep it between you.',
            cost: `${npc.displayName} asked you for the one thing you would not do. They will remember which.`,
            go() {
              npc.addTrust(P.name, -0.11, 'refused to throw it');
              npc.addSuspicion(P.name, 0.08, 'refused to throw it');
              target.addTrust(P.name, 0.04, 'you competed honestly');
              addIntel(npc.name, 'heat', target.name, 'wanted to throw the challenge to reach them');
              Feed.post(`You said no and left it there. ${npc.displayName} went quiet.`, 'drama', GAME.day);
            }
          },
          {
            text: `Refuse, and tell ${target.displayName} what was asked.`,
            cost: 'Buys a grateful target and two enemies who now have a reason.',
            go() {
              target.addTrust(P.name, 0.16, 'you warned them');
              target.addRel(P.name, 0.07, 'you warned them');
              target.addVW(npc.name, 0.8, 'you warned them');
              if (truthful) target.addVW(partner.name, 0.4, 'you named them too');
              npc.addTrust(P.name, -0.20, 'you took it straight to the target');
              npc.addVW(P.name, 0.7, 'you took it straight to the target');
              checkGossipBack(target, npc);
              Feed.post(`${target.displayName} knows. ${npc.displayName} will find out that they know.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Say yes. Then compete flat out.',
            cost: 'Free today. Expensive the moment they look at the scores.',
            go() {
              npc.addTrust(P.name, 0.10, 'agreed to throw it');
              const out = Lying.evaluate(npc, P, 'Lie', 'TargetInfo', target.name);
              if (out === 'Caught' || chance(0.35)) {
                npc.addTrust(P.name, -0.24, 'agreed to throw it and did not');
                npc.addVW(P.name, 0.8, 'agreed to throw it and did not');
                npc.addSuspicion(P.name, 0.18, 'agreed to throw it and did not');
                Feed.post(`${npc.displayName} worked out that you never intended to lose.`, 'danger', GAME.day);
              } else {
                Feed.post('You nodded along and then ran the whole thing. For now that holds.', 'drama', GAME.day);
              }
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     2. ACCUSED OF THROWING IT.
     The mirror of the above, and the reason the accusation stings: there is no
     "throw" flag in the sim, so the evidence is exactly what the tribe can
     actually see — your score against theirs. `truthful` means the accusation
     has real grounds, not that the player intended anything.
     ------------------------------------------------------------------ */
  {
    id: 'thrown-it-accusation',
    can: () => dpBase(2) && !!GAME.lastChallenge && (GAME.player.lastChallengeScore || 0) > 0,
    run() {
      const P = GAME.player;
      const mates = dpHere();
      const npc = pick(mates.filter(c => c.stats.gameAwareness > 0.45).length
        ? mates.filter(c => c.stats.gameAwareness > 0.45) : mates);
      const others = mates.filter(c => c !== npc);
      const source = others.length ? pick(others) : npc;
      const scores = mates.map(c => c.lastChallengeScore || 0);
      const mean = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
      const truthful = (P.lastChallengeScore || 0) < mean - 0.08;
      DBG.log('sim', 'Dilemma thrown-it', { npc: npc.name, source: source.name, truthful, mean: +mean.toFixed(2) });
      Dilemmas.open({
        id: 'thrown-it-accusation', npc, truthful, about: [source],
        title: `${npc.displayName} thinks you tanked it`,
        situation: pick(DILEMMA_POOL_LINES.thrownAccuseSit),
        claim: dpFill(DILEMMA_POOL_LINES.thrownAccuse, { sn: source.displayName }),
        options: [
          {
            text: 'Deny it. You were trying.',
            deny: true,
            cost: truthful
              ? 'Your score says otherwise, and they have already looked at it.'
              : 'True, and unprovable. They came here wanting a confession.',
            go() {
              const out = dpDeny(npc, truthful, 'TargetInfo', source.name);
              dpDenyFallout(npc, truthful, out, 'the challenge');
              if (out === 'Believed') npc.addVW(source.name, 0.4, 'decided the accusation was invented');
            }
          },
          {
            text: 'Own the performance. Blame your body.',
            cost: 'Nobody votes out a schemer as fast as they vote out a liability.',
            go() {
              npc.addTrust(P.name, 0.09, 'straight about a bad day');
              npc.addSuspicion(P.name, -0.06, 'straight about a bad day');
              npc.addVW(P.name, 0.55, 'reads as weak in challenges');
              for (const c of dpHere()) if (c !== npc && c.stats.gameAwareness > 0.6) c.addVW(P.name, 0.25, 'word got round you are struggling');
              Feed.post('You told them you were empty out there. They believed that part.', 'drama', GAME.day);
            }
          },
          {
            text: `Put it on ${source.displayName} — “they wanted this said.”`,
            cost: 'Turns a question about you into a fight with somebody else.',
            go() {
              npc.addVW(source.name, 0.75, 'you redirected them');
              npc.addSuspicion(P.name, 0.05, 'you would not answer directly');
              source.addTrust(P.name, -0.16, 'you named them behind their back');
              source.addVW(P.name, 0.6, 'you named them behind their back');
              addIntel(npc.name, 'heat', source.name, 'you pointed them at the accuser');
              checkGossipBack(npc, source);
              Feed.post(`You made it about ${source.displayName}. That will travel.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Let them think what they like.',
            cost: 'Cheapest answer available and it confirms every version of you.',
            go() {
              npc.addSuspicion(P.name, 0.14, 'would not answer the accusation');
              npc.addVW(P.name, 0.5, 'would not answer the accusation');
              npc.addRel(P.name, -0.04, 'would not answer the accusation');
              Feed.post(`You did not bother answering. ${npc.displayName} took that as an answer.`, 'danger', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     3. TWO ALLIES, ONE SECRET.
     Both of them told you the same name and each swore you to secrecy from the
     other, so you are the only person who knows the plan is already shared.
     Three-person: the ally in front of you, the ally behind you, the name.
     ------------------------------------------------------------------ */
  {
    id: 'two-secrets-one-mouth',
    can: () => dpBase(3) && dpClose().length >= 2,
    run() {
      const P = GAME.player;
      const two = dpPickN(dpClose(), 2);
      const npc = two[0], other = two[1];
      const rest = dpHere().filter(c => c !== npc && c !== other);
      if (!rest.length) return;
      const name = dpTargetFor(npc, rest);
      if (!name) return;
      DBG.log('sim', 'Dilemma two secrets', { npc: npc.name, other: other.name, name: name.name });
      Dilemmas.open({
        id: 'two-secrets-one-mouth', npc, truthful: true, about: [other, name],
        title: 'Both of them swore you to secrecy',
        situation: pick(DILEMMA_POOL_LINES.twoSecretsSit),
        claim: dpFill(DILEMMA_POOL_LINES.twoSecrets, { tn: other.displayName, vn: name.displayName }),
        options: [
          {
            text: `Tell them the truth — ${other.displayName} is already on it.`,
            cost: `Breaks the promise you made to ${other.displayName} to keep the one you made here.`,
            go() {
              npc.addTrust(P.name, 0.14, 'told them the truth about the other');
              npc.addRel(P.name, 0.05, 'told them the truth about the other');
              other.addTrust(P.name, -0.13, 'you repeated what they told you');
              other.addSuspicion(P.name, 0.10, 'you repeated what they told you');
              addIntel(other.name, 'claim', name.name, `also carrying ${name.displayName}`);
              /* Two people who thought they were alone now know they are not.
                 That is a bloc, and it moves without you. */
              npc.addVW(name.name, 0.4, 'found out they were not alone on it');
              other.addVW(name.name, 0.4, 'found out they were not alone on it');
              Feed.post(`${npc.displayName} and ${other.displayName} are on the same name and now they both know it.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Keep both secrets. Tell them nothing came to you.',
            cost: 'Holds today. You are now the only join between two people who will compare notes.',
            go() {
              const out = Lying.evaluate(npc, P, 'Lie', 'TargetInfo', other.name);
              if (out === 'Caught') {
                npc.addTrust(P.name, -0.15, 'caught holding the middle');
                npc.addSuspicion(P.name, 0.16, 'caught holding the middle');
                Feed.post(`${npc.displayName} did not believe you and now wonders what else you hold.`, 'danger', GAME.day);
              } else {
                npc.addTrust(P.name, 0.06, 'kept a confidence');
                other.addTrust(P.name, 0.06, 'kept a confidence');
                PlayerSecrets.add('PlantedSeed', name.name, GAME.day);
                Feed.post('You held both halves. Nobody has caught you yet.', 'drama', GAME.day);
              }
            }
          },
          {
            text: 'You never repeated it. Say so plainly.',
            deny: true,
            cost: 'True — you heard it twice, from two people. They may not believe that.',
            go() {
              const out = dpDeny(npc, false, 'TargetInfo', other.name);
              dpDenyFallout(npc, false, out, 'what you passed on');
              if (out !== 'Believed') npc.addRel(P.name, -0.05, 'did not accept your word');
            }
          },
          {
            text: 'Tell both of them you are done being the middle.',
            cost: 'Honest, public, and it costs you the position that made you useful.',
            go() {
              for (const c of [npc, other]) {
                c.addTrust(P.name, -0.05, 'stepped out of the middle');
                c.addRel(P.name, 0.04, 'was straight about it');
                c.addVW(P.name, 0.2, 'no longer needs you');
              }
              name.addTrust(P.name, 0.05, 'sensed you were not part of it');
              Feed.post('You handed the middle back. It was the only thing you had over either of them.', 'drama', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     4. THREE OF THEM, TONIGHT.
     Four castaways on screen. The point is that the commitment is demanded in
     front of each other, so there is no version of yes that only one of them
     hears — the private hedge every other event allows is unavailable here.
     ------------------------------------------------------------------ */
  {
    id: 'three-of-them-tonight',
    can: () => dpBase(4),
    run() {
      const P = GAME.player;
      const three = dpPickN(dpHere(), 3);
      const npc = three[0], b = three[1], c = three[2];
      const rest = dpHere().filter(x => !three.includes(x));
      if (!rest.length) return;
      const target = dpTargetFor(npc, rest);
      if (!target) return;
      /* "We are all on this" is true only if at least two of the three really are. */
      const agreeing = three.filter(x => { const l = dpLean(x); return l && l === target; }).length;
      const truthful = agreeing >= 2;
      DBG.log('sim', 'Dilemma three corner', { three: three.map(x => x.name), target: target.name, truthful, agreeing });
      Dilemmas.open({
        id: 'three-of-them-tonight', npc, truthful, about: [b, c, target],
        title: 'Three of them want it said out loud',
        situation: pick(DILEMMA_POOL_LINES.threeCornerSit),
        claim: dpFill(DILEMMA_POOL_LINES.threeCorner, { n1: b.displayName, n2: c.displayName, vn: target.displayName }),
        options: [
          {
            text: `Say it. ${target.displayName}, in front of all three.`,
            cost: 'Three witnesses to a promise you cannot quietly walk back.',
            go() {
              for (const x of three) {
                x.addTrust(P.name, 0.11, 'committed in front of the group');
                x.addVW(P.name, -0.4, 'committed in front of the group');
                if (PlayerAlliances.level(x.name) === 0) PlayerAlliances.align(x.name, GAME.day);
                Lying.evaluate(x, P, 'Truth', 'VoteIntent', target.name);
              }
              P.addVW(target.name, 1.0, 'committed in front of three people');
              PlayerSecrets.add('PushedVote', target.name, GAME.day);
              target.addTrust(P.name, -0.09, 'felt the room change');
              target.addVW(P.name, 0.5, 'you are in the group that is coming');
              Feed.post(`You said ${target.displayName}'s name with three people watching. That is on the record now.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Give them tonight only. Nothing beyond it.',
            cost: 'Half a promise, and all three of them heard which half.',
            go() {
              for (const x of three) {
                x.addTrust(P.name, 0.04, 'gave them one night');
                x.addSuspicion(P.name, 0.06, 'would only commit to one night');
                Lying.evaluate(x, P, 'Partial', 'VoteIntent', target.name);
              }
              P.addVW(target.name, 0.5, 'promised for one night');
              Feed.post('You gave them the night and kept the week. They noticed the difference.', 'drama', GAME.day);
            }
          },
          {
            text: 'Refuse. In front of all three.',
            cost: 'The most expensive sentence available, and the only one nobody can misquote.',
            go() {
              for (const x of three) {
                x.addTrust(P.name, -0.13, 'refused the group to its face');
                x.addVW(P.name, 0.55, 'refused the group to its face');
                x.addRel(P.name, -0.04, 'refused the group to its face');
              }
              target.addTrust(P.name, 0.15, 'you would not join the three');
              target.addRel(P.name, 0.08, 'you would not join the three');
              target.addVW(P.name, -0.6, 'you would not join the three');
              Feed.post(`You said no with all three of them standing there. ${target.displayName} watched you do it.`, 'danger', GAME.day);
            }
          },
          {
            text: `Commit to ${npc.displayName} and ${b.displayName}, and look past ${c.displayName}.`,
            cost: `A three-person deal with two people in it. ${c.displayName} is standing right there.`,
            go() {
              for (const x of [npc, b]) {
                x.addTrust(P.name, 0.10, 'committed to them specifically');
                if (PlayerAlliances.level(x.name) === 0) PlayerAlliances.align(x.name, GAME.day);
              }
              c.addTrust(P.name, -0.18, 'you cut them out in front of everyone');
              c.addRel(P.name, -0.12, 'you cut them out in front of everyone');
              c.addVW(P.name, 0.8, 'you cut them out in front of everyone');
              npc.addVW(c.name, 0.35, 'the group is now two and a spare');
              b.addVW(c.name, 0.35, 'the group is now two and a spare');
              P.addVW(target.name, 0.6, 'partial commitment');
              Feed.post(`You picked two of the three. ${c.displayName} has not said anything yet.`, 'drama', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     5. CARRY THE SWITCH.
     A last-minute flip that only works if somebody else delivers it. Being the
     courier means the third person hears the new name in YOUR voice, so if the
     switch is a trap it has your fingerprints on it. Truthful means the flip is
     real: the new name genuinely is what they are carrying.
     ------------------------------------------------------------------ */
  {
    id: 'carry-the-switch',
    can: () => dpBase(3) && isTribalDay(GAME.day),
    run() {
      const P = GAME.player;
      const npc = pick(dpHere());
      const rest = dpHere().filter(c => c !== npc);
      if (rest.length < 2) return;
      const carrier = dpWarmestToYou(rest) || rest[0];
      const pool = rest.filter(c => c !== carrier);
      if (pool.length < 2) return;
      const shuf = shuffle([...pool]);
      const newT = shuf[0], oldT = shuf[1];
      const lean = dpLean(npc);
      const truthful = !!lean && lean === newT;
      DBG.log('sim', 'Dilemma carry switch', { npc: npc.name, carrier: carrier.name, newT: newT.name, oldT: oldT.name, truthful });
      Dilemmas.open({
        id: 'carry-the-switch', npc, truthful, about: [newT, carrier, oldT],
        title: `${npc.displayName} is changing the name`,
        situation: pick(DILEMMA_POOL_LINES.carrySwitchSit),
        claim: dpFill(DILEMMA_POOL_LINES.carrySwitch, { vn: newT.displayName, sn: oldT.displayName, p: carrier.displayName }),
        options: [
          {
            text: `Carry it. Tell ${carrier.displayName} it is ${newT.displayName}.`,
            cost: `In ${carrier.displayName}'s head the switch is now yours, not theirs.`,
            go() {
              npc.addTrust(P.name, 0.13, 'carried their switch');
              npc.addVW(P.name, -0.4, 'carried their switch');
              carrier.addVW(newT.name, truthful ? 0.9 : 0.5, `you brought them ${newT.displayName}`);
              carrier.addVW(P.name, 0.3, 'you were the one who moved the vote');
              Lying.evaluate(carrier, P, truthful ? 'Truth' : 'Partial', 'VoteIntent', newT.name);
              newT.addVW(P.name, 0.4, 'the switch had your voice on it');
              PlayerSecrets.add('PushedVote', newT.name, GAME.day);
              Feed.post(`${carrier.displayName} has the new name and it came from you.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Refuse. There is no time to check any of this.',
            cost: 'Their plan dies in your hands and they know whose hands it was.',
            go() {
              npc.addTrust(P.name, -0.12, 'would not carry the switch');
              npc.addVW(P.name, 0.45, 'would not carry the switch');
              oldT.addVW(P.name, -0.3, 'the vote stayed where it was');
              addIntel(npc.name, 'claim', newT.name, 'tried to switch the vote at the last minute');
              Feed.post('You would not run it. The vote stays wherever it was.', 'drama', GAME.day);
            }
          },
          {
            text: `Carry it, but put ${npc.displayName}'s name on it.`,
            cost: `Keeps you clean with ${carrier.displayName} and tells ${npc.displayName} you will not shield them.`,
            go() {
              carrier.addTrust(P.name, 0.12, 'told them where the switch came from');
              carrier.addVW(newT.name, truthful ? 0.7 : 0.35, `${npc.displayName}'s switch`);
              carrier.addVW(npc.name, 0.4, 'they moved the vote late');
              npc.addTrust(P.name, -0.15, 'you attributed it to them');
              npc.addSuspicion(P.name, 0.10, 'you attributed it to them');
              addIntel(npc.name, 'claim', newT.name, 'the late switch was theirs');
              Feed.post(`You delivered it as ${npc.displayName}'s idea, because it was.`, 'drama', GAME.day);
            }
          },
          {
            text: `Go to ${oldT.displayName} instead and tell them they are safe.`,
            cost: 'Buys one person entirely and burns the two who were counting on you.',
            go() {
              oldT.addTrust(P.name, 0.17, 'you told them the vote had moved');
              oldT.addRel(P.name, 0.08, 'you told them the vote had moved');
              oldT.addVW(npc.name, 0.7, 'you told them who moved it');
              npc.addTrust(P.name, -0.19, 'you warned the old target');
              npc.addVW(P.name, 0.7, 'you warned the old target');
              carrier.addSuspicion(P.name, 0.08, 'you were somewhere else at the crucial moment');
              checkGossipBack(oldT, npc);
              Feed.post(`${oldT.displayName} knows they were the name. They also know who told them.`, 'drama', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     6. FOURTH ON A PLAN THAT DOES NOT HOLD.
     Four on screen. The offer is real; the claim "we are solid" is what is
     under test, and it is measured off the actual mutual trust between the
     three of them. Being the fourth on a fracturing three is worse than being
     nobody's fourth, and the player can only find that out by looking at the
     bars on the cards.
     ------------------------------------------------------------------ */
  {
    id: 'fourth-on-the-plan',
    can: () => dpBase(4),
    run() {
      const P = GAME.player;
      const three = dpPickN(dpHere(), 3);
      const npc = three[0], b = three[1], c = three[2];
      const rest = dpHere().filter(x => !three.includes(x));
      if (!rest.length) return;
      const target = dpTargetFor(npc, rest);
      if (!target) return;
      const pairs = [[npc, b], [npc, c], [b, c]];
      const weakest = pairs.reduce((a, x) =>
        Math.min(dpWarm(a[0], a[1]), dpWarm(a[1], a[0])) <= Math.min(dpWarm(x[0], x[1]), dpWarm(x[1], x[0])) ? a : x);
      const floor = Math.min(dpWarm(weakest[0], weakest[1]), dpWarm(weakest[1], weakest[0]));
      const truthful = floor >= 0.50;
      DBG.log('sim', 'Dilemma fourth seat', { three: three.map(x => x.name), floor: +floor.toFixed(2), truthful });
      Dilemmas.open({
        id: 'fourth-on-the-plan', npc, truthful, about: [b, c, target],
        title: 'They want a fourth',
        situation: pick(DILEMMA_POOL_LINES.fourthSeatSit),
        claim: dpFill(DILEMMA_POOL_LINES.fourthSeat, { n1: b.displayName, n2: c.displayName, vn: target.displayName }),
        options: [
          {
            text: 'Take the seat.',
            cost: 'You are the newest of four and the first one any of them can afford to lose.',
            go() {
              for (const x of three) {
                x.addTrust(P.name, 0.09, 'took the fourth seat');
                if (PlayerAlliances.level(x.name) === 0) PlayerAlliances.align(x.name, GAME.day);
              }
              P.addVW(target.name, 0.7, 'the group you joined');
              PlayerSecrets.add('Alliance', npc.name, GAME.day);
              target.addVW(P.name, 0.45, 'you joined the group coming for them');
              if (!truthful) {
                /* The three do not hold. Being the fourth of a fracturing three
                   makes you the obvious loose end when it goes. */
                weakest[0].addVW(P.name, 0.4, 'the group is not what it looks like');
                weakest[1].addSuspicion(P.name, 0.10, 'the group is not what it looks like');
                Feed.post(`You are the fourth. ${weakest[0].displayName} and ${weakest[1].displayName} cannot stand each other.`, 'danger', GAME.day);
              } else {
                Feed.post(`You are in with ${dpNames(three)}. It looks solid from here.`, 'good', GAME.day);
              }
            }
          },
          {
            text: `Take it, and tell ${weakest[0].displayName} you know they are the loose one.`,
            cost: 'Buys one of them completely and puts your read on the record with the wrong person.',
            go() {
              for (const x of three) x.addTrust(P.name, 0.06, 'took the fourth seat');
              if (PlayerAlliances.level(weakest[0].name) === 0) PlayerAlliances.align(weakest[0].name, GAME.day);
              weakest[0].addTrust(P.name, 0.15, 'you were honest about the group');
              weakest[0].addVW(weakest[1].name, 0.6, 'you told them where the crack was');
              weakest[1].addSuspicion(P.name, 0.12, 'you have been talking about them');
              addIntel(weakest[0].name, 'heat', weakest[1].name, 'the weak join in the three');
              checkGossipBack(weakest[0], weakest[1]);
              Feed.post(`${weakest[0].displayName} heard your read on their own alliance.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Refuse. Stay unattached.',
            cost: 'Three people just learned you are available to somebody else.',
            go() {
              for (const x of three) {
                x.addTrust(P.name, -0.08, 'turned down the seat');
                x.addSuspicion(P.name, 0.09, 'turned down the seat');
                x.addVW(P.name, 0.3, 'unattached and therefore unreadable');
              }
              Feed.post('You stayed free. Free is another word for spare.', 'drama', GAME.day);
            }
          },
          {
            text: `Refuse, and warn ${target.displayName} there are three of them.`,
            cost: 'One person owes you everything and three of them have a name for tonight.',
            go() {
              target.addTrust(P.name, 0.18, 'you warned them about the three');
              target.addRel(P.name, 0.09, 'you warned them about the three');
              for (const x of three) {
                target.addVW(x.name, 0.55, 'you named the three');
                x.addTrust(P.name, -0.12, 'you refused and then talked');
                x.addVW(P.name, 0.5, 'you refused and then talked');
              }
              PlayerSecrets.add('SpreadRumor', npc.name, GAME.day);
              checkGossipBack(target, npc);
              Feed.post(`${target.displayName} knows there are three of them and who they are.`, 'danger', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     7. THE NAME, THIRD TIME.
     They give you a name as an exclusive. You have already heard, from
     somebody else, that they gave the same name away. Truthful here means the
     intel actually corroborates — so this event only fires when the player has
     genuinely earned the catch, and it rewards having listened.
     ------------------------------------------------------------------ */
  {
    id: 'the-name-third-time',
    can() {
      if (!dpBase(3)) return false;
      const here = dpHere().map(c => c.name);
      return (GAME.intel || []).some(e => here.includes(e.who) && e.target
        && ['claim', 'agreed', 'heat', 'observe'].includes(e.kind));
    },
    run() {
      const P = GAME.player;
      const here = dpHere();
      const names = here.map(c => c.name);
      const recs = (GAME.intel || []).filter(e => names.includes(e.who) && e.target
        && ['claim', 'agreed', 'heat', 'observe'].includes(e.kind));
      if (!recs.length) return;
      const rec = pick(recs);
      const npc = here.find(c => c.name === rec.who);
      if (!npc) return;
      const named = here.find(c => c.name === rec.target) || dpTargetFor(npc, here.filter(c => c !== npc));
      if (!named || named === npc) return;
      /* The other mouth has to be a third person. If the only candidates are the
         speaker and the name, there is no "third time" to catch. */
      const tellers = here.filter(c => c !== npc && c !== named);
      if (!tellers.length) return;
      const otherTeller = pick(tellers);
      /* They are saying the same name to you that your intel says they said
         elsewhere — so the "nobody else knows" part is the lie. */
      const truthful = false;
      DBG.log('sim', 'Dilemma name third time', { npc: npc.name, named: named.name, via: otherTeller.name });
      Dilemmas.open({
        id: 'the-name-third-time', npc, truthful, about: [named, otherTeller],
        title: `${npc.displayName} has a name for you`,
        situation: pick(DILEMMA_POOL_LINES.nameThreeTimesSit)
          + ` ${otherTeller.displayName} already told you they had heard it.`,
        claim: dpFill(DILEMMA_POOL_LINES.nameThreeTimes, { vn: named.displayName }),
        options: [
          {
            text: 'Call it. You have heard this from two other people.',
            cost: `They will work out that ${otherTeller.displayName} talks to you.`,
            go() {
              npc.addTrust(P.name, -0.06, 'you caught them repeating themselves');
              npc.addSuspicion(P.name, 0.12, 'you caught them repeating themselves');
              npc.addVW(P.name, 0.35, 'you are keeping score of what they say');
              npc.addVW(otherTeller.name, 0.7, 'worked out who repeated them');
              otherTeller.addTrust(P.name, -0.14, 'you gave away that they talk to you');
              otherTeller.addSuspicion(P.name, 0.10, 'you gave away that they talk to you');
              addIntel(npc.name, 'claim', named.name, 'said this name to at least three people');
              Feed.post(`You told ${npc.displayName} you had heard it before. ${otherTeller.displayName} is now exposed.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Take it like it is news. Say nothing.',
            cost: `Costs nothing now, and ${npc.displayName} keeps believing you are their only confidant.`,
            go() {
              npc.addTrust(P.name, 0.07, 'received a confidence well');
              addIntel(npc.name, 'claim', named.name, 'told you the same name they told others');
              /* You are inside their picture of themselves. That is worth more
                 than the catch, and it is also how people get used. */
              P.addVW(named.name, 0.25, 'a name you keep hearing');
              Feed.post(`You let ${npc.displayName} think you were the first. You know exactly what you are worth to them.`, 'drama', GAME.day);
            }
          },
          {
            text: `Take it to ${named.displayName} with a count of mouths.`,
            cost: 'Makes you the person who tells people things, and everybody works out who.',
            go() {
              named.addTrust(P.name, 0.16, 'you told them how far their name had gone');
              named.addVW(npc.name, 0.8, 'you named the source');
              named.addVW(otherTeller.name, 0.3, 'you named the other mouth');
              npc.addTrust(P.name, -0.17, 'you carried their name to the subject');
              npc.addVW(P.name, 0.6, 'you carried their name to the subject');
              PlayerSecrets.add('SpreadRumor', npc.name, GAME.day);
              checkGossipBack(named, npc);
              Feed.post(`${named.displayName} knows how many people have said their name today.`, 'danger', GAME.day);
            }
          },
          {
            text: `Ask what they told ${otherTeller.displayName}.`,
            cost: 'You learn something and you show them exactly how you think.',
            go() {
              npc.addSuspicion(P.name, 0.14, 'you asked what they tell other people');
              npc.addTrust(P.name, -0.04, 'you asked what they tell other people');
              const lean = dpLean(npc);
              if (lean) addIntel(npc.name, 'claim', lean.name, 'what they are really carrying');
              else addIntel(npc.name, 'claim', named.name, 'would not say what they told the other');
              Feed.post(`You asked ${npc.displayName} what else they had been saying. They answered carefully.`, 'drama', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     8. LIE TO YOUR ALLY, AS A TEST.
     No plan, no target, no upside — just somebody who will not believe you can
     play until they have watched you do it to the person you are closest to.
     Models the audition, which on the show is how outsiders buy their way in.
     ------------------------------------------------------------------ */
  {
    id: 'lie-to-your-ally',
    can: () => dpBase(3) && dpAllies().length >= 1
      && dpHere().some(c => PlayerAlliances.level(c.name) === 0),
    run() {
      const P = GAME.player;
      const ally = dpWarmestToYou(dpAllies()) || pick(dpAllies());
      const outsiders = dpHere().filter(c => c !== ally && PlayerAlliances.level(c.name) === 0);
      if (!outsiders.length || !ally) return;
      const npc = pick(outsiders);
      DBG.log('sim', 'Dilemma loyalty lie', { npc: npc.name, ally: ally.name });
      Dilemmas.open({
        id: 'lie-to-your-ally', npc, truthful: true, about: [ally],
        title: `${npc.displayName} wants to watch you do it`,
        situation: pick(DILEMMA_POOL_LINES.loyaltyLieSit),
        claim: dpFill(DILEMMA_POOL_LINES.loyaltyLie, { an: ally.displayName }),
        options: [
          {
            text: `Do it. Put a false name in ${ally.displayName}'s head.`,
            cost: 'A lie that gets retro-checked at the vote, told for somebody who owes you nothing yet.',
            go() {
              const decoy = dpTargetFor(npc, dpHere().filter(c => c !== ally && c !== npc));
              const out = Lying.evaluate(ally, P, 'Lie', 'VoteIntent', decoy ? decoy.name : '(none)');
              npc.addTrust(P.name, 0.17, 'passed the test');
              npc.addRel(P.name, 0.06, 'passed the test');
              npc.addVW(P.name, -0.4, 'passed the test');
              PlayerAlliances.align(npc.name, GAME.day);
              if (out === 'Caught') {
                ally.addTrust(P.name, -0.20, 'caught lying to their face');
                ally.addVW(P.name, 0.8, 'caught lying to their face');
                Feed.post(`${ally.displayName} caught it as it left your mouth. ${npc.displayName} enjoyed that.`, 'danger', GAME.day);
              } else {
                Feed.post(`${ally.displayName} believed you. ${npc.displayName} has what they wanted.`, 'drama', GAME.day);
              }
            }
          },
          {
            text: 'Refuse. Tell them what you will and will not do.',
            cost: 'They will read that as weakness and say so to somebody else.',
            go() {
              npc.addTrust(P.name, -0.10, 'refused the test');
              npc.addRel(P.name, -0.05, 'refused the test');
              npc.addVW(P.name, 0.4, 'refused the test');
              ally.addTrust(P.name, 0.05, 'something in how you were with them');
              for (const c of dpHere()) if (c !== npc && c !== ally && chance(0.4))
                c.addTrust(P.name, 0.03, 'word that you would not turn on your own');
              Feed.post(`You said no. ${npc.displayName} did not argue, which is not the same as agreeing.`, 'drama', GAME.day);
            }
          },
          {
            text: `Tell ${ally.displayName} about the test instead.`,
            cost: 'Locks your ally in and hands the outsider a reason to come for you.',
            go() {
              ally.addTrust(P.name, 0.16, 'you told them about the test');
              ally.addRel(P.name, 0.08, 'you told them about the test');
              ally.addVW(npc.name, 0.8, 'you told them who was testing you');
              PlayerAlliances.promise(ally.name, GAME.day);
              npc.addTrust(P.name, -0.18, 'you took the test to them');
              npc.addVW(P.name, 0.65, 'you took the test to them');
              addIntel(npc.name, 'heat', ally.name, 'asked you to lie to them as a test');
              Feed.post(`${ally.displayName} knows what ${npc.displayName} asked you to do.`, 'drama', GAME.day);
            }
          },
          {
            text: `Stage it. Warn ${ally.displayName} first, then perform.`,
            cost: 'Both of them think they are inside it. That only holds while neither compares notes.',
            go() {
              ally.addTrust(P.name, 0.10, 'you staged it with them');
              npc.addTrust(P.name, 0.12, 'appeared to pass the test');
              Lying.evaluate(npc, P, 'Lie', 'AllianceClaim', ally.name);
              PlayerSecrets.add('PlantedSeed', npc.name, GAME.day);
              if (chance(0.35)) {
                npc.addTrust(P.name, -0.22, 'worked out the test was staged');
                npc.addSuspicion(P.name, 0.18, 'worked out the test was staged');
                npc.addVW(P.name, 0.8, 'worked out the test was staged');
                Feed.post(`${npc.displayName} worked out that ${ally.displayName} was in on it.`, 'danger', GAME.day);
              } else {
                Feed.post('You performed a lie for an audience of one and told the victim first.', 'drama', GAME.day);
              }
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     9. INFORMATION AT A PRICE.
     The only event where the other person opens with the invoice. What makes it
     a dilemma rather than a shop is that the price is a name from your own side,
     and you cannot tell whether what you are buying is real until you have paid
     for it. Truthful means they genuinely are carrying what they are selling.
     ------------------------------------------------------------------ */
  {
    id: 'price-of-information',
    can: () => dpBase(3),
    run() {
      const P = GAME.player;
      const cold = dpCold();
      const npc = pick(cold.length ? cold : dpHere());
      const rest = dpHere().filter(c => c !== npc);
      if (rest.length < 2) return;
      const subject = dpTargetFor(npc, rest);
      const priceable = rest.filter(c => c !== subject);
      if (!priceable.length) return;
      /* They ask for whoever you are closest to. That is what makes it a price. */
      const price = dpWarmestToYou(priceable) || priceable[0];
      const lean = dpLean(npc);
      const truthful = !!lean && (lean === subject || lean === P);
      DBG.log('sim', 'Dilemma info price', { npc: npc.name, subject: subject.name, price: price.name, truthful });
      Dilemmas.open({
        id: 'price-of-information', npc, truthful, about: [subject, price],
        title: `${npc.displayName} is selling`,
        situation: pick(DILEMMA_POOL_LINES.infoPriceSit),
        claim: dpFill(DILEMMA_POOL_LINES.infoPrice, { vn: subject.displayName, tn: price.displayName }),
        options: [
          {
            text: `Pay. Tell them something true about ${price.displayName}.`,
            cost: `${price.displayName} finds out eventually. People always find out who sold them.`,
            go() {
              npc.addTrust(P.name, 0.12, 'paid the price honestly');
              npc.addVW(price.name, 0.7, 'you sold them information');
              PlayerSecrets.add('SpreadRumor', price.name, GAME.day);
              if (truthful) {
                addIntel(npc.name, 'claim', subject.name, 'bought information — it was real');
                P.addVW(subject.name, 0.4, 'information you paid for');
                Feed.post(`What ${npc.displayName} sold you was real. ${price.displayName} paid for it.`, 'drama', GAME.day);
              } else {
                addIntel(npc.name, 'claim', subject.name, 'bought information — thin at best');
                Feed.post(`You paid with ${price.displayName} and got very little back.`, 'danger', GAME.day);
              }
              checkGossipBack(npc, price);
            }
          },
          {
            text: `Pay with something invented about ${price.displayName}.`,
            cost: 'Costs nothing today. It becomes the thing they hold over you the day they check.',
            go() {
              const out = Lying.evaluate(npc, P, 'Lie', 'TargetInfo', price.name);
              if (out === 'Caught') {
                npc.addTrust(P.name, -0.16, 'caught paying in lies');
                npc.addSuspicion(P.name, 0.18, 'caught paying in lies');
                npc.addVW(P.name, 0.6, 'caught paying in lies');
                Feed.post(`${npc.displayName} knew that was invented before you finished saying it.`, 'danger', GAME.day);
              } else {
                npc.addTrust(P.name, 0.08, 'paid the price');
                npc.addVW(price.name, 0.45, 'believed something untrue about them');
                addIntel(npc.name, 'claim', subject.name, 'traded for it with a lie');
                PlayerSecrets.add('PlantedSeed', price.name, GAME.day);
                Feed.post(`It held. ${npc.displayName} thinks they got a real name.`, 'drama', GAME.day);
              }
            }
          },
          {
            text: 'Refuse the price. Offer them your vote instead.',
            cost: 'Cheaper today than a name, and it is a promise that gets checked at the torches.',
            go() {
              const alt = dpTargetFor(npc, rest.filter(c => c !== price));
              npc.addTrust(P.name, 0.05, 'paid in loyalty instead of names');
              npc.addSuspicion(P.name, 0.06, 'would not pay in names');
              if (alt) {
                Lying.evaluate(npc, P, 'Partial', 'VoteIntent', alt.name);
                P.addVW(alt.name, 0.5, `the price of ${npc.displayName}'s information`);
              }
              addIntel(npc.name, 'claim', subject.name, 'gave you a thinner version for free');
              Feed.post(`You paid in a promise. ${npc.displayName} took it and gave you the short version.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Walk away from it.',
            cost: 'Something is coming for you and you have just chosen not to know its shape.',
            go() {
              npc.addRel(P.name, -0.06, 'walked away from a trade');
              npc.addVW(P.name, 0.3, 'no use to them');
              /* The information existed. It goes to whoever buys it instead. */
              const buyer = pick(rest.filter(c => c !== price)) || price;
              if (buyer) { buyer.addVW(P.name, 0.35, `bought what you would not`); }
              Feed.post(`You left it. ${npc.displayName} will find another buyer by dark.`, 'drama', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     10. SEEN WITH THE OTHER SIDE.
     Post-swap paranoia. Note that the third party here is deliberately NOT a
     campmate — they are on the other tribe now, which is exactly why the
     accusation bites. The npc is always a campmate; only the person you are
     accused of meeting is across the water.
     ------------------------------------------------------------------ */
  {
    id: 'seen-with-the-other-side',
    can: () => dpBase(2) && GAME.swapped && !GAME.merged
      && alive().some(c => !c.isPlayer && c.tribeName !== GAME.player.tribeName),
    run() {
      const P = GAME.player;
      const npc = pick(dpHere());
      const away = alive().filter(c => !c.isPlayer && c.tribeName !== P.tribeName);
      if (!away.length) return;
      /* Whoever you actually have history with reads as the likeliest meeting. */
      const oldFriend = dpWarmestToYou(away) || away[0];
      const witness = pick(dpHere().filter(c => c !== npc)) || npc;
      const truthful = PlayerAlliances.level(oldFriend.name) > 0
        || PlayerSecrets.list.some(s => s.type === 'Alliance' && s.subject === oldFriend.name);
      DBG.log('sim', 'Dilemma other side', { npc: npc.name, friend: oldFriend.name, truthful });
      Dilemmas.open({
        id: 'seen-with-the-other-side', npc, truthful, about: [oldFriend, witness],
        title: `${npc.displayName} does not think you switched`,
        situation: pick(DILEMMA_POOL_LINES.seenOtherSideSit),
        claim: dpFill(DILEMMA_POOL_LINES.seenOtherSide, { sn: oldFriend.displayName, tn: witness.displayName }),
        options: [
          {
            text: 'Deny it. You have not spoken to them.',
            deny: true,
            cost: truthful
              ? `You are still working with ${oldFriend.displayName}. If that surfaces, this is the lie they remember.`
              : 'True — and there is nothing here you can prove, only a witness who is sure.',
            go() {
              const out = dpDeny(npc, truthful, 'AllianceClaim', oldFriend.name);
              dpDenyFallout(npc, truthful, out, `${oldFriend.displayName}`);
              if (out === 'Believed') npc.addVW(witness.name, 0.45, 'decided the witness was wrong');
              else witness.addVW(P.name, 0.3, 'stands by what they saw');
            }
          },
          {
            text: 'Admit it. Say exactly what was said.',
            cost: 'Honest, and it tells this camp your loyalties were made somewhere else.',
            go() {
              npc.addTrust(P.name, truthful ? 0.11 : -0.06, truthful ? 'straight about the other side' : 'admitted something untrue');
              npc.addSuspicion(P.name, truthful ? -0.04 : 0.10);
              npc.addVW(P.name, 0.4, 'openly still tied to the old tribe');
              for (const c of dpHere()) if (c !== npc && c.stats.gameAwareness > 0.55)
                c.addVW(P.name, 0.3, 'admitted to talking across the boundary');
              PlayerSecrets.add('Alliance', oldFriend.name, GAME.day);
              Feed.post('You told them the truth about it. Truth was not the safe option here.', 'drama', GAME.day);
            }
          },
          {
            text: `Turn it round — ask what ${witness.displayName} was doing there.`,
            cost: 'Costs you the witness permanently and does not answer the question.',
            go() {
              npc.addVW(witness.name, 0.6, 'you turned it on the witness');
              npc.addSuspicion(P.name, 0.08, 'answered a question with a question');
              witness.addTrust(P.name, -0.17, 'you accused them to cover yourself');
              witness.addVW(P.name, 0.65, 'you accused them to cover yourself');
              addIntel(npc.name, 'heat', witness.name, 'you put the boundary story on them');
              checkGossipBack(npc, witness);
              Feed.post(`You made it about ${witness.displayName}. Nobody in this camp forgets that move.`, 'drama', GAME.day);
            }
          },
          {
            text: `Offer them what ${oldFriend.displayName} told you.`,
            cost: 'Buys this camp with the last person from your old one.',
            go() {
              npc.addTrust(P.name, 0.15, 'traded the old tribe for this one');
              npc.addRel(P.name, 0.06, 'traded the old tribe for this one');
              if (PlayerAlliances.level(oldFriend.name) > 0) PlayerAlliances.breakPromise(oldFriend.name, GAME.cast);
              oldFriend.addTrust(P.name, -0.20, 'you sold what they told you');
              oldFriend.addVW(P.name, 0.8, 'you sold what they told you');
              addIntel(oldFriend.name, 'claim', npc.name, 'what you traded away');
              Feed.post(`${npc.displayName} is satisfied. ${oldFriend.displayName} will hear about it eventually.`, 'drama', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     11. SPEAK FOR THE TRIBE.
     The only event where the cost is pure visibility. Nothing here is a
     betrayal; the whole risk is that whoever puts their name on a group problem
     becomes the group's name for the problem. Modelled off every camp on the
     show that needed somebody to say the unpopular thing out loud.
     ------------------------------------------------------------------ */
  {
    id: 'speak-for-the-tribe',
    can: () => dpBase(3),
    run() {
      const P = GAME.player;
      const three = dpPickN(dpHere(), 3);
      const npc = three[0];
      /* The rival is whoever most wants the platform; the quiet one is whoever
         would sink under it. */
      const others = three.slice(1);
      const rival = others.reduce((a, b) => a.stats.social >= b.stats.social ? a : b);
      const quiet = others.find(c => c !== rival) || others[0];
      const need = (typeof CampNeeds !== 'undefined')
        ? ['food', 'water', 'firewood', 'shelter', 'clean'].reduce((a, b) => CampNeeds.get(a) <= CampNeeds.get(b) ? a : b)
        : 'food';
      DBG.log('sim', 'Dilemma spokesperson', { npc: npc.name, rival: rival.name, quiet: quiet.name, need });
      Dilemmas.open({
        id: 'speak-for-the-tribe', npc, truthful: true, about: [rival, quiet],
        title: 'Somebody has to say it',
        situation: pick(DILEMMA_POOL_LINES.spokespersonSit) + ` It is about the ${need}.`,
        claim: dpFill(DILEMMA_POOL_LINES.spokesperson, { n1: rival.displayName, n2: quiet.displayName }),
        options: [
          {
            text: 'Do it. Put your name on it.',
            cost: 'Everyone learns who you are. That includes the people counting threats.',
            go() {
              dpCampSees(c => {
                c.addRel(P.name, 0.07, 'you spoke for the tribe');
                c.addTrust(P.name, 0.05, 'you spoke for the tribe');
                if (c.stats.gameAwareness > 0.6) c.addVW(P.name, 0.4, 'reads as a leader, therefore a threat');
              });
              rival.addRel(P.name, -0.08, 'you took the platform they wanted');
              rival.addVW(P.name, 0.5, 'you took the platform they wanted');
              if (typeof CampNeeds !== 'undefined') CampNeeds.add(need, 0.10);
              Feed.post('You stood up and said it. Everybody now knows your voice.', 'good', GAME.day);
            }
          },
          {
            text: `Put ${rival.displayName} forward.`,
            cost: 'Hands the exposure to the one person who will enjoy having it.',
            go() {
              rival.addRel(P.name, 0.10, 'you nominated them');
              rival.addTrust(P.name, 0.08, 'you nominated them');
              dpCampSees(c => { if (c.stats.gameAwareness > 0.55) c.addVW(rival.name, 0.35, 'became the face of the camp'); }, [rival]);
              npc.addSuspicion(P.name, 0.07, 'would not do it themselves');
              if (typeof CampNeeds !== 'undefined') CampNeeds.add(need, 0.06);
              Feed.post(`${rival.displayName} spoke for the tribe, which is what they wanted all along.`, 'drama', GAME.day);
            }
          },
          {
            text: `Put ${quiet.displayName} forward.`,
            cost: 'They will not manage it, and you chose them knowing that.',
            go() {
              quiet.addTrust(P.name, -0.12, 'you put them in front of everyone');
              quiet.addRel(P.name, -0.09, 'you put them in front of everyone');
              quiet.addVW(P.name, 0.5, 'you put them in front of everyone');
              quiet.morale = clamp01(quiet.morale - 0.12);
              dpCampSees(c => { if (c.stats.gameAwareness > 0.5) c.addVW(quiet.name, 0.45, 'fell apart speaking for the camp'); }, [quiet]);
              npc.addTrust(P.name, -0.05, 'you picked the one who could not');
              Feed.post(`${quiet.displayName} tried and it did not go well. Everybody saw who sent them.`, 'danger', GAME.day);
            }
          },
          {
            text: 'Refuse, and let it stay unsaid.',
            cost: `Nothing gets fixed and the ${need} keeps getting worse.`,
            go() {
              npc.addRel(P.name, -0.07, 'refused to speak');
              npc.addTrust(P.name, -0.05, 'refused to speak');
              if (typeof CampNeeds !== 'undefined') CampNeeds.add(need, -0.06);
              dpCampSees(c => { c.morale = clamp01(c.morale - 0.04); });
              Feed.post('Nobody said anything. It will come up again, worse.', 'drama', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     12. COVER FOR THEM AT CAMP.
     Deliberately not a strategy event. Somebody is genuinely coming apart —
     the can() checks real morale and hunger, so this only fires when the sim
     agrees — and what they want is a small lie told for a human reason. The
     interesting cost is that doing the decent thing costs YOU labour, which the
     rest of the island prices as weakness later.
     ------------------------------------------------------------------ */
  {
    id: 'cover-for-them',
    can: () => dpBase(3) && dpHere().some(c => c.morale < 0.40 || c.hunger > 0.80),
    run() {
      const P = GAME.player;
      const struggling = dpHere().filter(c => c.morale < 0.40 || c.hunger > 0.80);
      if (!struggling.length) return;
      const npc = pick(struggling);
      const rest = dpHere().filter(c => c !== npc);
      if (!rest.length) return;
      /* Whoever keeps score at camp is who they are afraid of. */
      const noticer = rest.reduce((a, b) => a.stats.gameAwareness >= b.stats.gameAwareness ? a : b);
      DBG.log('sim', 'Dilemma cover for them', { npc: npc.name, morale: +npc.morale.toFixed(2), noticer: noticer.name });
      Dilemmas.open({
        id: 'cover-for-them', npc, truthful: true, about: [noticer],
        title: `${npc.displayName} is not coping`,
        situation: pick(DILEMMA_POOL_LINES.coverAtCampSit),
        claim: dpFill(DILEMMA_POOL_LINES.coverAtCamp, { tn: noticer.displayName }),
        options: [
          {
            text: 'Cover for them. Say you saw them working.',
            cost: 'A lie told to the most observant person in camp, for no gain at all.',
            go() {
              const out = Lying.evaluate(noticer, P, 'Lie', 'TargetInfo', npc.name);
              npc.addTrust(P.name, 0.18, 'you covered for them');
              npc.addRel(P.name, 0.12, 'you covered for them');
              npc.addVW(P.name, -0.7, 'you covered for them');
              npc.morale = clamp01(npc.morale + 0.10);
              if (out === 'Caught') {
                noticer.addTrust(P.name, -0.14, 'caught covering for somebody');
                noticer.addSuspicion(P.name, 0.14, 'caught covering for somebody');
                noticer.addVW(npc.name, 0.5, 'worked out who was not working');
                Feed.post(`${noticer.displayName} did not buy it, and now knows about ${npc.displayName} as well.`, 'danger', GAME.day);
              } else {
                Feed.post(`You covered. ${npc.displayName} will not forget who did that.`, 'good', GAME.day);
              }
            }
          },
          {
            text: 'Cover for them and do the work yourself.',
            cost: 'Nobody finds out and you pay for it in the only currency that does not lie.',
            go() {
              npc.addTrust(P.name, 0.20, 'you did their work for them');
              npc.addRel(P.name, 0.15, 'you did their work for them');
              npc.addVW(P.name, -0.8, 'you did their work for them');
              npc.morale = clamp01(npc.morale + 0.14);
              P.fatigue = clamp01(P.fatigue + 0.14);
              P.hunger = clamp01(P.hunger + 0.06);
              if (typeof CampNeeds !== 'undefined') CampNeeds.add('firewood', 0.08);
              Feed.post('You did both jobs. Nobody noticed either of them.', 'good', GAME.day);
            }
          },
          {
            text: 'Refuse, gently. You will not lie about it.',
            cost: 'They asked one person for help and now they know the answer.',
            go() {
              npc.addTrust(P.name, -0.08, 'would not cover for them');
              npc.addRel(P.name, -0.10, 'would not cover for them');
              npc.morale = clamp01(npc.morale - 0.10);
              npc.addVW(P.name, 0.35, 'would not cover for them');
              noticer.addTrust(P.name, 0.04, 'you did not lie to them');
              Feed.post(`You told ${npc.displayName} no. They took it quietly.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Tell the tribe they need a day off.',
            cost: 'It might actually help them. It also hangs a label on them in public.',
            go() {
              npc.morale = clamp01(npc.morale + 0.06);
              npc.hunger = clamp01(npc.hunger - 0.05);
              npc.addTrust(P.name, -0.06, 'you said it in front of everyone');
              npc.addRel(P.name, 0.05, 'you were trying to help');
              dpCampSees(c => {
                c.addRel(P.name, 0.04, 'you were straight about the camp');
                if (c.stats.gameAwareness > 0.5) c.addVW(npc.name, 0.45, 'publicly the weak one this week');
              }, [npc]);
              Feed.post(`You said it out loud. ${npc.displayName} gets a rest and a label.`, 'drama', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     13. PICK A SIDE, PUBLICLY.
     Fires off a real fracture: can() requires two campmates whose mutual
     warmth has genuinely collapsed. Three others on screen because the fight is
     not the point — the swing vote watching it is.
     ------------------------------------------------------------------ */
  {
    id: 'pick-a-side-publicly',
    can() {
      if (!dpBase(3)) return false;
      const here = dpHere();
      for (let i = 0; i < here.length; i++)
        for (let j = i + 1; j < here.length; j++)
          if (Math.min(dpWarm(here[i], here[j]), dpWarm(here[j], here[i])) < 0.38) return true;
      return false;
    },
    run() {
      const P = GAME.player;
      const here = dpHere();
      const pairs = [];
      for (let i = 0; i < here.length; i++)
        for (let j = i + 1; j < here.length; j++)
          if (Math.min(dpWarm(here[i], here[j]), dpWarm(here[j], here[i])) < 0.38) pairs.push([here[i], here[j]]);
      if (!pairs.length) return;
      const [a, b] = pick(pairs);
      const npc = chance(0.5) ? a : b;
      const foe = npc === a ? b : a;
      const swingPool = here.filter(c => c !== a && c !== b);
      if (!swingPool.length) return;
      const swing = dpCoolestToYou(swingPool) || swingPool[0];
      DBG.log('sim', 'Dilemma pick a side', { npc: npc.name, foe: foe.name, swing: swing.name });
      Dilemmas.open({
        id: 'pick-a-side-publicly', npc, truthful: true, about: [foe, swing],
        title: 'They both want a witness',
        situation: pick(DILEMMA_POOL_LINES.pickASideSit),
        claim: dpFill(DILEMMA_POOL_LINES.pickASide, { tn: foe.displayName, n1: swing.displayName }),
        options: [
          {
            text: `Back ${npc.displayName}. Out loud, where it counts.`,
            cost: `${foe.displayName} now has a reason, and ${swing.displayName} has seen you pick.`,
            go() {
              npc.addTrust(P.name, 0.17, 'backed them in public');
              npc.addRel(P.name, 0.10, 'backed them in public');
              npc.addVW(P.name, -0.6, 'backed them in public');
              foe.addTrust(P.name, -0.19, 'took the other side in public');
              foe.addVW(P.name, 0.75, 'took the other side in public');
              swing.addVW(P.name, 0.25, 'you are attached to that fight now');
              swing.addSuspicion(P.name, 0.06, 'you are attached to that fight now');
              Feed.post(`You said it in front of everyone. ${foe.displayName} heard all of it.`, 'drama', GAME.day);
            }
          },
          {
            text: `Back ${foe.displayName} instead.`,
            cost: 'The one who came to you for help watched you help the other one.',
            go() {
              foe.addTrust(P.name, 0.19, 'backed them against the one who asked you');
              foe.addRel(P.name, 0.10, 'backed them against the one who asked you');
              foe.addVW(P.name, -0.6, 'backed them');
              npc.addTrust(P.name, -0.22, 'asked you for help and you sided against them');
              npc.addRel(P.name, -0.14, 'asked you for help and you sided against them');
              npc.addVW(P.name, 0.85, 'asked you for help and you sided against them');
              swing.addRel(P.name, 0.05, 'you did not just follow the loudest one');
              Feed.post(`You backed ${foe.displayName}. ${npc.displayName} asked you first and you know it.`, 'danger', GAME.day);
            }
          },
          {
            text: 'Refuse to take a side at all.',
            cost: 'Both of them cool on you, and one of them will say you are with the other anyway.',
            go() {
              for (const c of [npc, foe]) {
                c.addTrust(P.name, -0.09, 'would not take a side');
                c.addVW(P.name, 0.3, 'would not take a side');
              }
              swing.addTrust(P.name, 0.12, 'stayed out of it');
              swing.addRel(P.name, 0.07, 'stayed out of it');
              Feed.post(`You stayed out of it. ${swing.displayName} was the only one who liked that.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Make them settle it in front of you.',
            cost: 'Might end it. Might make you the reason it got worse, in front of witnesses.',
            go() {
              if (chance(0.45)) {
                npc.addTrust(foe.name, 0.10, 'forced to settle it');
                foe.addTrust(npc.name, 0.10, 'forced to settle it');
                for (const c of [npc, foe]) { c.addRel(P.name, 0.09, 'you made them fix it'); c.addVW(P.name, -0.3, 'you made them fix it'); }
                Feed.post('They shook hands. Nobody can quite believe it held.', 'good', GAME.day);
              } else {
                for (const c of [npc, foe]) {
                  c.addRel(P.name, -0.11, 'you dragged it out in public');
                  c.addVW(P.name, 0.5, 'you dragged it out in public');
                }
                swing.addVW(P.name, 0.3, 'you made the camp worse');
                dpCampSees(c => { c.morale = clamp01(c.morale - 0.05); });
                Feed.post('It got louder. Everybody watched you make it louder.', 'danger', GAME.day);
              }
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     14. PICKED OFF IN ORDER.
     Uses the real age spread in the cast: the oldest campmate, the three
     youngest. Five castaways on screen and no ask at all — just a claim, which
     is either the most useful information in the game or a lonely person
     recruiting you with fear. Measured against real vote pressure.
     ------------------------------------------------------------------ */
  {
    id: 'picked-off-in-order',
    can() {
      if (!dpBase(4)) return false;
      const here = dpHere();
      const ages = here.map(c => c.age || 30).sort((x, y) => x - y);
      return (ages[ages.length - 1] - ages[0]) >= 12;
    },
    run() {
      const P = GAME.player;
      const here = [...dpHere()].sort((a, b) => (b.age || 30) - (a.age || 30));
      const npc = here[0];
      const young = here.slice(-3).reverse();
      if (young.length < 3 || young.includes(npc)) return;
      const pressureOnYou = dpPressure(young, P.name);
      const pressureOnThem = dpPressure(young, npc.name);
      const truthful = pressureOnYou > 0.5 || pressureOnThem > 0.8;
      DBG.log('sim', 'Dilemma picked off in order', {
        npc: npc.name, young: young.map(c => c.name), truthful,
        onYou: +pressureOnYou.toFixed(2), onThem: +pressureOnThem.toFixed(2)
      });
      Dilemmas.open({
        id: 'picked-off-in-order', npc, truthful, about: young,
        title: `${npc.displayName} has counted it out`,
        situation: pick(DILEMMA_POOL_LINES.pickedOffInOrderSit),
        claim: dpFill(DILEMMA_POOL_LINES.pickedOffInOrder, {
          n1: young[0].displayName, n2: young[1].displayName, n3: young[2].displayName
        }),
        options: [
          {
            text: 'Believe them. Start building the other side.',
            cost: 'Commits you to the smaller half of the camp on one person\'s arithmetic.',
            go() {
              PlayerAlliances.align(npc.name, GAME.day);
              npc.addTrust(P.name, 0.16, 'believed their read');
              npc.addRel(P.name, 0.08, 'believed their read');
              for (const y of young) {
                P.addVW(y.name, 0.4, `${npc.displayName}'s count`);
                addIntel(npc.name, 'heat', y.name, 'named as part of the young bloc');
              }
              if (!truthful) {
                /* No bloc, and you have just started behaving as if there is one. */
                for (const y of young) y.addSuspicion(P.name, 0.10, 'you have started treating them as a bloc');
                Feed.post(`You are now playing against three people who were not working together.`, 'danger', GAME.day);
              } else {
                Feed.post(`${npc.displayName} may have just saved you a week.`, 'good', GAME.day);
              }
            }
          },
          {
            text: `Take it to ${young[0].displayName} and watch their face.`,
            cost: 'The cheapest way to check, and it tells the bloc that somebody is counting them.',
            go() {
              const y = young[0];
              y.addSuspicion(P.name, 0.12, 'you asked them about a bloc');
              y.addVW(npc.name, 0.7, 'worked out who is talking about them');
              if (truthful) {
                addIntel(y.name, 'observe', P.name, 'reacted badly to being asked');
                P.addVW(y.name, 0.5, 'their face answered the question');
                Feed.post(`${y.displayName} answered too fast. That was an answer.`, 'drama', GAME.day);
              } else {
                y.addTrust(P.name, -0.10, 'accused them of running a bloc');
                addIntel(y.name, 'observe', null, 'genuinely had no idea what you meant');
                Feed.post(`${y.displayName} had no idea what you were talking about.`, 'drama', GAME.day);
              }
              npc.addTrust(P.name, -0.10, 'you took their read straight to the subject');
              checkGossipBack(y, npc);
            }
          },
          {
            text: 'Tell them you are not being recruited by fear.',
            cost: 'The one person watching the whole board stops sharing what they see.',
            go() {
              npc.addTrust(P.name, -0.13, 'dismissed their read');
              npc.addRel(P.name, -0.08, 'dismissed their read');
              npc.addVW(P.name, 0.4, 'dismissed their read');
              for (const y of young) if (chance(0.4)) y.addTrust(P.name, 0.04, 'you did not join the count against them');
              Feed.post(`You told ${npc.displayName} no. They will not bring you the next one.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Say nothing and keep the count.',
            cost: 'You keep the information and neither side thinks you are theirs.',
            go() {
              for (const y of young) addIntel(npc.name, 'heat', y.name, 'claims they move as a bloc');
              npc.addSuspicion(P.name, 0.08, 'gave them nothing back');
              npc.addVW(P.name, 0.25, 'gave them nothing back');
              Feed.post('You wrote it down and gave nothing back. That is a position of sorts.', 'drama', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     15. SILENCE, NOT YOUR VOTE.
     The cleverest ask on the show, because it is smaller than the one you were
     braced for. They do not need you to do anything — which means every option
     that costs you something is a choice you made for free.
     ------------------------------------------------------------------ */
  {
    id: 'silence-not-your-vote',
    can: () => dpBase(3) && dpClose().length >= 1 && dpHere().length >= 3,
    run() {
      const P = GAME.player;
      const friend = dpWarmestToYou(dpClose()) || pick(dpClose());
      const rest = dpHere().filter(c => c !== friend);
      if (!rest.length) return;
      const npc = dpBestOf(friend, rest) || pick(rest);
      const lean = dpLean(npc);
      const truthful = !!lean && lean === friend;
      DBG.log('sim', 'Dilemma silence not vote', { npc: npc.name, friend: friend.name, truthful });
      Dilemmas.open({
        id: 'silence-not-your-vote', npc, truthful, about: [friend],
        title: `${npc.displayName} only wants your silence`,
        situation: pick(DILEMMA_POOL_LINES.silenceNotVoteSit),
        claim: dpFill(DILEMMA_POOL_LINES.silenceNotVote, { vn: friend.displayName }),
        options: [
          {
            text: 'Give them the silence.',
            cost: `Costs nothing tonight. Costs ${friend.displayName}, and they will work out you knew.`,
            go() {
              npc.addTrust(P.name, 0.12, 'gave them a quiet night');
              npc.addVW(P.name, -0.5, 'gave them a quiet night');
              npc.addVW(friend.name, 0.5, 'nobody warned the target');
              PlayerSecrets.add('Blindside', friend.name, GAME.day);
              /* Silence is not free, it is deferred. If it lands, the friend knows. */
              if (truthful && chance(0.5)) {
                friend.addSuspicion(P.name, 0.14, 'you were very quiet that day');
                friend.addTrust(P.name, -0.08, 'you were very quiet that day');
              }
              Feed.post('You said nothing. Nothing is a decision.', 'drama', GAME.day);
            }
          },
          {
            text: `Warn ${friend.displayName}.`,
            cost: 'Keeps the person and loses the one who trusted you enough to ask.',
            go() {
              friend.addTrust(P.name, 0.18, 'you warned them');
              friend.addRel(P.name, 0.09, 'you warned them');
              friend.addVW(npc.name, 0.85, 'you named who was coming');
              npc.addTrust(P.name, -0.20, 'you broke the one thing they asked for');
              npc.addVW(P.name, 0.75, 'you broke the one thing they asked for');
              PlayerAlliances.promise(friend.name, GAME.day);
              checkGossipBack(friend, npc);
              Feed.post(`${friend.displayName} knows. ${npc.displayName} asked you for one thing.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Tell them plainly you will not stay quiet.',
            cost: 'Honest, and it turns their plan toward the person who announced they would spoil it.',
            go() {
              npc.addTrust(P.name, -0.07, 'refused them to their face');
              npc.addRel(P.name, 0.03, 'at least they were straight');
              npc.addVW(P.name, 0.6, 'announced they would spoil the plan');
              friend.addTrust(P.name, 0.06, 'something in how you have been');
              addIntel(npc.name, 'claim', friend.name, 'wanted your silence for a blindside');
              Feed.post(`You told ${npc.displayName} where you stood. Now they have to plan around you.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Ask to be in on it properly instead.',
            cost: 'Stops being something you allowed and starts being something you did.',
            go() {
              npc.addTrust(P.name, 0.15, 'asked to be inside the plan');
              PlayerAlliances.align(npc.name, GAME.day);
              P.addVW(friend.name, 0.9, 'you joined the blindside');
              PlayerSecrets.add('PushedVote', friend.name, GAME.day);
              Lying.evaluate(npc, P, 'Truth', 'VoteIntent', friend.name);
              friend.addSuspicion(P.name, 0.10, 'you have been somewhere else lately');
              Feed.post(`You are in it now, properly. ${friend.displayName} still thinks you are theirs.`, 'drama', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     16. THE IDOL QUESTION.
     There is no idol in this game, and it does not matter: the ask is a
     hypothetical and every answer is a real promise about where you stop.
     Deliberately two-person — after five events with a crowd in them, one
     conversation with nobody else in it lands harder. `truthful` is whether
     they would actually do the same for you.
     ------------------------------------------------------------------ */
  {
    id: 'idol-hypothetical',
    can: () => dpBase(2) && dpClose().length >= 1,
    run() {
      const P = GAME.player;
      const npc = pick(dpClose());
      const truthful = npc.getVW(P.name) <= 0 && dpWarm(npc, P) > 0.58;
      DBG.log('sim', 'Dilemma idol question', { npc: npc.name, truthful, vw: +npc.getVW(P.name).toFixed(2) });
      Dilemmas.open({
        id: 'idol-hypothetical', npc, truthful,
        title: `${npc.displayName} asks a hypothetical`,
        situation: pick(DILEMMA_POOL_LINES.idolPromiseSit),
        claim: pick(DILEMMA_POOL_LINES.idolPromise),
        options: [
          {
            text: 'Yes. Without thinking about it.',
            cost: 'They will hold you to a promise about something neither of you has.',
            go() {
              npc.addTrust(P.name, 0.19, 'promised to protect them');
              npc.addRel(P.name, 0.10, 'promised to protect them');
              npc.addVW(P.name, -0.7, 'promised to protect them');
              PlayerAlliances.promise(npc.name, GAME.day);
              Lying.evaluate(npc, P, truthful ? 'Truth' : 'Partial', 'AllianceClaim', npc.name);
              /* A promise made this warmly gets repeated, and being somebody's
                 guarantee is a thing other people count. */
              for (const c of dpHere()) if (c !== npc && c.stats.gameAwareness > 0.6)
                c.addVW(P.name, 0.25, 'word that you are somebody\'s insurance');
              Feed.post(`You promised. ${npc.displayName} believed you completely.`, 'good', GAME.day);
            }
          },
          {
            text: 'No. Tell them why.',
            cost: 'The most honest thing you can say here and it ends something.',
            go() {
              npc.addTrust(P.name, -0.06, 'told them the truth about the limit');
              npc.addRel(P.name, -0.12, 'told them the truth about the limit');
              npc.addVW(P.name, 0.3, 'will not protect them');
              npc.addSuspicion(P.name, -0.06, 'at least they were honest');
              npc.morale = clamp01(npc.morale - 0.06);
              Feed.post(`You told ${npc.displayName} the truth. They said they understood.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Say you would and mean nothing by it.',
            cost: 'Free unless it ever gets tested, and this game tests everything eventually.',
            go() {
              npc.addTrust(P.name, 0.14, 'said the right thing');
              const out = Lying.evaluate(npc, P, 'Lie', 'AllianceClaim', npc.name);
              PlayerSecrets.add('Alliance', npc.name, GAME.day);
              if (out === 'Caught') {
                npc.addTrust(P.name, -0.20, 'heard the hollow in it');
                npc.addSuspicion(P.name, 0.16, 'heard the hollow in it');
                Feed.post(`${npc.displayName} heard something hollow in that and did not say so.`, 'danger', GAME.day);
              } else {
                Feed.post('You said the right words. They will be quoted back to you.', 'drama', GAME.day);
              }
            }
          },
          {
            text: 'Turn it round. Ask if they would.',
            cost: 'Buys you the answer and tells them you were not going to give one.',
            go() {
              npc.addSuspicion(P.name, 0.11, 'answered a promise with a question');
              npc.addRel(P.name, -0.05, 'answered a promise with a question');
              if (truthful) {
                addIntel(npc.name, 'agreed', P.name, 'said yes without hesitating');
                npc.addTrust(P.name, 0.05, 'the question was fair');
                Feed.post(`${npc.displayName} said yes straight away. They meant it.`, 'good', GAME.day);
              } else {
                addIntel(npc.name, 'observe', P.name, 'would not answer the same question');
                P.addVW(npc.name, 0.35, 'they would not answer their own question');
                Feed.post(`${npc.displayName} did not answer. That is the answer.`, 'drama', GAME.day);
              }
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     17. THE WHOLE TRIBE HAS AGREED.
     The oldest bluff on the show: present the vote as settled so the last
     undecided person falls in without asking. `truthful` is measured against
     actual vote pressure from the people named, so checking is a real skill and
     the bluff is a real bluff.
     ------------------------------------------------------------------ */
  {
    id: 'the-whole-tribe-agreed',
    can: () => dpBase(4) && isTribalDay(GAME.day),
    run() {
      const P = GAME.player;
      const npc = pick(dpHere());
      const rest = dpHere().filter(c => c !== npc);
      if (rest.length < 3) return;
      const target = dpTargetFor(npc, rest);
      const backers = dpPickN(rest.filter(c => c !== target), 2);
      if (!target || backers.length < 2) return;
      const group = [npc, ...backers];
      const truthful = dpPressure(group, target.name) >= 1.2;
      DBG.log('sim', 'Dilemma whole tribe agreed', {
        npc: npc.name, target: target.name, backers: backers.map(c => c.name),
        truthful, pressure: +dpPressure(group, target.name).toFixed(2)
      });
      Dilemmas.open({
        id: 'the-whole-tribe-agreed', npc, truthful, about: [target, backers[0], backers[1]],
        title: 'You are being told it is decided',
        situation: pick(DILEMMA_POOL_LINES.wholeTribeAgreedSit),
        claim: dpFill(DILEMMA_POOL_LINES.wholeTribeAgreed, {
          vn: target.displayName, n1: backers[0].displayName, n2: backers[1].displayName
        }),
        options: [
          {
            text: 'Fall in line. Write the name.',
            cost: 'Safe if it is true. If it is a bluff you are the only vote on it.',
            go() {
              P.addVW(target.name, 1.0, 'told the vote was already decided');
              Lying.evaluate(npc, P, 'Truth', 'VoteIntent', target.name);
              npc.addTrust(P.name, 0.10, 'fell in line without argument');
              npc.addVW(P.name, -0.4, 'fell in line without argument');
              if (truthful) {
                for (const b of backers) b.addTrust(P.name, 0.05, 'was where they said they would be');
                Feed.post('It was true. You are on the right side of a clean vote.', 'good', GAME.day);
              } else {
                /* Nobody else was on it. You are the odd name at the read. */
                for (const b of backers) b.addSuspicion(P.name, 0.12, 'voted somewhere nobody else did');
                target.addVW(P.name, 0.8, 'you wrote their name alone');
                Feed.post(`Nobody else was on ${target.displayName}. That was never agreed.`, 'danger', GAME.day);
              }
            }
          },
          {
            text: `Go and ask ${backers[0].displayName} directly.`,
            cost: 'The only way to know, and it tells them you check what you are told.',
            go() {
              const b = backers[0];
              const on = b.getVW(target.name) > 0.3;
              addIntel(b.name, on ? 'agreed' : 'observe', on ? target.name : null,
                on ? 'confirmed the name' : 'had not heard the name at all');
              b.addSuspicion(P.name, 0.08, 'you went round checking');
              npc.addTrust(P.name, -0.08, 'you did not take their word');
              npc.addSuspicion(P.name, 0.09, 'you did not take their word');
              if (on) {
                P.addVW(target.name, 0.6, 'confirmed by a second mouth');
                Feed.post(`${b.displayName} confirmed it. ${npc.displayName} knows you checked.`, 'drama', GAME.day);
              } else {
                npc.addVW(P.name, 0.45, 'caught them inventing a majority');
                P.addVW(npc.name, 0.7, 'invented a majority to move you');
                Feed.post(`${b.displayName} had never heard it. ${npc.displayName} made that up.`, 'good', GAME.day);
              }
            }
          },
          {
            text: `Tell ${target.displayName} the camp has their name.`,
            cost: 'Turns a rumour into a scramble, with you standing at the start of it.',
            go() {
              target.addTrust(P.name, 0.17, 'you told them the camp had agreed');
              target.addRel(P.name, 0.08, 'you told them the camp had agreed');
              for (const g of group) {
                target.addVW(g.name, 0.5, 'you named the group');
                g.addTrust(P.name, -0.12, 'you took it to the target');
                g.addVW(P.name, 0.5, 'you took it to the target');
              }
              PlayerSecrets.add('SpreadRumor', npc.name, GAME.day);
              checkGossipBack(target, npc);
              Feed.post(`${target.displayName} is scrambling and everybody knows who started them off.`, 'danger', GAME.day);
            }
          },
          {
            text: 'Agree out loud and write somebody else.',
            cost: 'Nobody can argue with you tonight. The read tells them everything.',
            go() {
              npc.addTrust(P.name, 0.09, 'appeared to fall in line');
              Lying.evaluate(npc, P, 'Lie', 'VoteIntent', target.name);
              const alt = dpTargetFor(P, rest.filter(c => c !== target)) || backers[0];
              P.addVW(alt.name, 0.9, 'quietly voted elsewhere');
              PlayerSecrets.add('PushedVote', alt.name, GAME.day);
              Feed.post('You said the name and you are not going to write it.', 'drama', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     18. CONFIRM YOUR OWN RUMOUR.
     The bill for the scheme phase. `truthful` reads the player's own secret
     ledger, so this only accuses you of something the game has a record of —
     and if you never started it, the denial is honest and the engine treats it
     as such.
     ------------------------------------------------------------------ */
  {
    id: 'confirm-your-own-rumour',
    can: () => dpBase(3) && PlayerSecrets.list.some(s =>
      (s.type === 'SpreadRumor' || s.type === 'PlantedSeed')
      && dpHere().some(c => c.name === s.subject)),
    run() {
      const P = GAME.player;
      const mine = PlayerSecrets.list.filter(s =>
        (s.type === 'SpreadRumor' || s.type === 'PlantedSeed')
        && dpHere().some(c => c.name === s.subject));
      if (!mine.length) return;
      const secret = pick(mine);
      const subject = dpHere().find(c => c.name === secret.subject);
      const rest = dpHere().filter(c => c !== subject);
      if (!subject || !rest.length) return;
      const npc = pick(rest);
      const truthful = true;   /* the record says you did start it */
      DBG.log('sim', 'Dilemma confirm rumour', { npc: npc.name, subject: subject.name, secret: secret.type });
      Dilemmas.open({
        id: 'confirm-your-own-rumour', npc, truthful, about: [subject],
        title: `${npc.displayName} wants you to say it publicly`,
        situation: pick(DILEMMA_POOL_LINES.confirmRumourSit),
        claim: dpFill(DILEMMA_POOL_LINES.confirmRumour, { vn: subject.displayName }),
        options: [
          {
            text: 'Confirm it. Out loud, in front of people.',
            cost: `It becomes yours in public, and ${subject.displayName} will know exactly whose it was.`,
            go() {
              npc.addTrust(P.name, 0.15, 'backed them in public');
              npc.addVW(P.name, -0.5, 'backed them in public');
              npc.addVW(subject.name, 0.8, 'you confirmed it');
              subject.addTrust(P.name, -0.24, 'you confirmed a rumour about them');
              subject.addRel(P.name, -0.16, 'you confirmed a rumour about them');
              subject.addVW(P.name, 0.9, 'you confirmed a rumour about them');
              dpCampSees(c => {
                c.addVW(subject.name, 0.35, 'the rumour was confirmed');
                if (c.stats.gameAwareness > 0.6) c.addSuspicion(P.name, 0.09, 'you are the source of things');
              }, [npc, subject]);
              Feed.post(`You said it where everybody could hear. ${subject.displayName} heard it too.`, 'danger', GAME.day);
            }
          },
          {
            text: 'Refuse to confirm it. Do not deny it either.',
            cost: `${npc.displayName} is left holding your words on their own.`,
            go() {
              npc.addTrust(P.name, -0.15, 'left them holding it');
              npc.addRel(P.name, -0.10, 'left them holding it');
              npc.addVW(P.name, 0.55, 'left them holding it');
              dpCampSees(c => { if (c.stats.gameAwareness > 0.5) c.addVW(npc.name, 0.4, 'looked like the sole source'); }, [npc]);
              subject.addVW(npc.name, 0.6, 'assumed the rumour was theirs');
              Feed.post(`You said nothing either way. ${npc.displayName} is wearing it alone.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Deny it. You never said that.',
            deny: true,
            cost: 'You did say it, and there is somebody standing here who heard you.',
            go() {
              const out = dpDeny(npc, true, 'TargetInfo', subject.name);
              dpDenyFallout(npc, true, out, `the ${subject.displayName} rumour`);
              if (out !== 'Caught') {
                subject.addTrust(P.name, 0.06, 'you were not the one repeating it');
                npc.addVW(subject.name, 0.3, 'still believes the rumour');
              } else {
                subject.addVW(P.name, 0.6, 'word got round it started with you');
              }
            }
          },
          {
            text: 'Tell them privately that it came from you.',
            cost: 'Hands one person a loaded weapon in exchange for their loyalty.',
            go() {
              npc.addTrust(P.name, 0.12, 'trusted them with the truth');
              npc.addRel(P.name, 0.07, 'trusted them with the truth');
              PlayerSecrets.markKnown(secret, npc.name);
              /* They know something that ends you. That is what loyalty costs. */
              npc.addVW(P.name, 0.3, 'holds something over you');
              if (PlayerAlliances.level(npc.name) === 0) PlayerAlliances.align(npc.name, GAME.day);
              if (chance(0.30)) {
                subject.addTrust(P.name, -0.18, 'it got back to them');
                subject.addVW(P.name, 0.7, 'it got back to them');
                Feed.post(`${npc.displayName} did not keep it. ${subject.displayName} knows.`, 'danger', GAME.day);
              } else {
                Feed.post(`${npc.displayName} knows it was you and is keeping it. For now.`, 'drama', GAME.day);
              }
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     19. WHERE WERE YOU.
     Small, early, and cheap to trigger — the pre-swap version of being watched.
     The third option is the interesting one: a lie about camp work that the
     camp's actual need levels can contradict, so the game can catch you with a
     number rather than a coin flip.
     ------------------------------------------------------------------ */
  {
    id: 'where-were-you',
    can: () => dpBase(3) && !GAME.merged && !GAME.swapped,
    run() {
      const P = GAME.player;
      const npc = pick(dpHere());
      const rest = dpHere().filter(c => c !== npc);
      if (!rest.length) return;
      const suspected = dpWarmestToYou(rest) || rest[0];
      const truthful = PlayerAlliances.level(suspected.name) > 0
        || PlayerSecrets.list.some(s => s.subject === suspected.name);
      const workChecks = (typeof CampNeeds !== 'undefined') && CampNeeds.get('firewood') > 0.5;
      DBG.log('sim', 'Dilemma where were you', { npc: npc.name, suspected: suspected.name, truthful, workChecks });
      Dilemmas.open({
        id: 'where-were-you', npc, truthful, about: [suspected],
        title: `${npc.displayName} noticed you were gone`,
        situation: pick(DILEMMA_POOL_LINES.whereWereYouSit),
        claim: dpFill(DILEMMA_POOL_LINES.whereWereYou, { sn: suspected.displayName }),
        options: [
          {
            text: `Deny it. You were not with ${suspected.displayName}.`,
            deny: true,
            cost: truthful
              ? `You are working with ${suspected.displayName} and one wrong word from them ends this.`
              : 'True, and there is no way to show it. They have already decided what they think.',
            go() {
              const out = dpDeny(npc, truthful, 'AllianceClaim', suspected.name);
              dpDenyFallout(npc, truthful, out, 'where you were');
              if (out === 'Caught') suspected.addSuspicion(P.name, 0.10, 'your denial pointed at them');
            }
          },
          {
            text: 'Tell them the truth about who you were with.',
            cost: 'Buys this one and puts the other one on the board.',
            go() {
              npc.addTrust(P.name, 0.13, 'told them straight');
              npc.addSuspicion(P.name, -0.07, 'told them straight');
              npc.addVW(suspected.name, 0.55, 'learned who you go off with');
              suspected.addTrust(P.name, -0.13, 'you named them to somebody');
              suspected.addSuspicion(P.name, 0.10, 'you named them to somebody');
              addIntel(npc.name, 'heat', suspected.name, 'now watching them because of you');
              checkGossipBack(npc, suspected);
              Feed.post(`${npc.displayName} appreciated the honesty. ${suspected.displayName} will not.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Say you were collecting wood.',
            cost: workChecks
              ? 'There is wood at camp, so the story stands up if anyone looks.'
              : 'There is no wood at camp. Anyone who looks at the pile knows.',
            go() {
              const out = Lying.evaluate(npc, P, 'Lie', 'TargetInfo', '(none)');
              if (!workChecks || out === 'Caught') {
                npc.addTrust(P.name, -0.15, 'told a story the woodpile contradicts');
                npc.addSuspicion(P.name, 0.17, 'told a story the woodpile contradicts');
                npc.addVW(P.name, 0.5, 'told a story the woodpile contradicts');
                Feed.post(`${npc.displayName} looked at the woodpile. There was nothing new on it.`, 'danger', GAME.day);
              } else {
                npc.addTrust(P.name, 0.06, 'the story held up');
                Feed.post('The pile backed you up. That was luck as much as anything.', 'good', GAME.day);
              }
            }
          },
          {
            text: 'Tell them it is not their business.',
            cost: 'Everybody who hears about it fills the gap in themselves.',
            go() {
              npc.addTrust(P.name, -0.10, 'refused to say');
              npc.addRel(P.name, -0.08, 'refused to say');
              npc.addSuspicion(P.name, 0.15, 'refused to say');
              for (const c of rest) if (chance(0.4)) c.addSuspicion(P.name, 0.07, 'word that you would not account for yourself');
              Feed.post('You shut it down. It will be repeated as something worse.', 'drama', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     20. FINAL TWO, THIS EARLY.
     Two-person and quiet. What makes it a dilemma is that a handshake this
     early is worth almost nothing strategically and everything emotionally, and
     the person offering it will behave as though it is binding for the rest of
     the season. `truthful` is whether you really are their number one.
     ------------------------------------------------------------------ */
  {
    id: 'final-two-now',
    can: () => dpBase(2) && dpClose().length >= 1 && alive().length > 6,
    run() {
      const P = GAME.player;
      const npc = pick(dpClose());
      const rivals = dpHere().filter(c => c !== npc);
      const best = rivals.length ? rivals.reduce((a, b) => dpWarm(npc, a) >= dpWarm(npc, b) ? a : b) : null;
      const truthful = !best || dpWarm(npc, P) >= dpWarm(npc, best);
      DBG.log('sim', 'Dilemma final two', { npc: npc.name, truthful });
      Dilemmas.open({
        id: 'final-two-now', npc, truthful,
        title: `${npc.displayName} wants a handshake`,
        situation: pick(DILEMMA_POOL_LINES.finalTwoNowSit),
        claim: pick(DILEMMA_POOL_LINES.finalTwoNow),
        options: [
          {
            text: 'Shake on it. Mean it.',
            cost: 'A promise for day thirty-nine, made on day ' + GAME.day + ', and they will never let it go.',
            go() {
              PlayerAlliances.align(npc.name, GAME.day);
              PlayerAlliances.promise(npc.name, GAME.day);
              PlayerAlliances.lock(npc.name);
              npc.addTrust(P.name, 0.22, 'shook on a final two');
              npc.addRel(P.name, 0.12, 'shook on a final two');
              npc.addVW(P.name, -1.0, 'shook on a final two');
              PlayerSecrets.add('Alliance', npc.name, GAME.day);
              /* A pair this visible is the thing the rest of the camp breaks up. */
              for (const c of dpHere()) if (c !== npc && c.stats.gameAwareness > 0.55) {
                c.addVW(P.name, 0.3, 'reads as half of a pair');
                c.addVW(npc.name, 0.3, 'reads as half of a pair');
              }
              Feed.post(`You and ${npc.displayName} shook on the end of the game. People notice pairs.`, 'good', GAME.day);
            }
          },
          {
            text: 'Shake on it and keep your options.',
            cost: 'Costs nothing now. They will play the whole season as though it is real.',
            go() {
              npc.addTrust(P.name, 0.18, 'shook on a final two');
              npc.addVW(P.name, -0.8, 'shook on a final two');
              const out = Lying.evaluate(npc, P, 'Lie', 'AllianceClaim', npc.name);
              PlayerAlliances.align(npc.name, GAME.day);
              if (out === 'Caught') {
                npc.addTrust(P.name, -0.16, 'felt the handshake was hollow');
                npc.addSuspicion(P.name, 0.14, 'felt the handshake was hollow');
                Feed.post(`${npc.displayName} shook your hand and did not look happy about it.`, 'drama', GAME.day);
              } else {
                Feed.post(`${npc.displayName} thinks that was the most important moment of their game.`, 'drama', GAME.day);
              }
            }
          },
          {
            text: 'Refuse the handshake. Offer them tonight instead.',
            cost: 'Honest, and smaller than what they came for.',
            go() {
              npc.addTrust(P.name, 0.04, 'gave them something smaller and real');
              npc.addRel(P.name, -0.07, 'would not shake on the end');
              npc.morale = clamp01(npc.morale - 0.05);
              if (PlayerAlliances.level(npc.name) === 0) PlayerAlliances.align(npc.name, GAME.day);
              PlayerAlliances.promise(npc.name, GAME.day);
              Feed.post(`You gave ${npc.displayName} tonight and not day thirty-nine.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Refuse it outright. It is too early.',
            cost: 'The person most attached to you learns there is a limit, on the day they asked.',
            go() {
              npc.addTrust(P.name, -0.14, 'refused the handshake');
              npc.addRel(P.name, -0.13, 'refused the handshake');
              npc.addVW(P.name, 0.45, 'refused the handshake');
              npc.morale = clamp01(npc.morale - 0.09);
              if (!truthful) npc.addVW(P.name, 0.2, 'they were already looking elsewhere');
              Feed.post(`${npc.displayName} put their hand out and you left it there.`, 'danger', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     21. THEY WILL TAKE THE FALL.
     Only fires when the ledger says you actually did something, so the offer is
     always for a real crime. `truthful` is whether they mean it — someone who
     already has your name in their vote weights is buying a debt, not paying one.
     ------------------------------------------------------------------ */
  {
    id: 'take-the-fall',
    can: () => dpBase(3) && PlayerSecrets.list.some(s =>
      (s.type === 'PushedVote' || s.type === 'SpreadRumor' || s.type === 'PlantedSeed')
      && dpHere().some(c => c.name === s.subject)),
    run() {
      const P = GAME.player;
      const mine = PlayerSecrets.list.filter(s =>
        (s.type === 'PushedVote' || s.type === 'SpreadRumor' || s.type === 'PlantedSeed')
        && dpHere().some(c => c.name === s.subject));
      if (!mine.length) return;
      const secret = pick(mine);
      const victim = dpHere().find(c => c.name === secret.subject);
      const rest = dpHere().filter(c => c !== victim);
      if (!victim || !rest.length) return;
      const npc = pick(rest);
      const truthful = npc.getVW(P.name) <= 0.2;
      DBG.log('sim', 'Dilemma take the fall', { npc: npc.name, victim: victim.name, truthful });
      Dilemmas.open({
        id: 'take-the-fall', npc, truthful, about: [victim],
        title: `${npc.displayName} offers to wear it`,
        situation: pick(DILEMMA_POOL_LINES.takeTheFallSit),
        claim: dpFill(DILEMMA_POOL_LINES.takeTheFall, { vn: victim.displayName }),
        options: [
          {
            text: 'Let them take it.',
            cost: 'You owe them the rest of the season, and only they decide what that is worth.',
            go() {
              npc.addVW(P.name, truthful ? -0.4 : 0.5, 'took the fall for you');
              P.addVW(npc.name, -0.6, 'they carried something of yours');
              victim.addVW(npc.name, 0.8, 'blamed them for it');
              victim.addTrust(npc.name, -0.18, 'blamed them for it');
              PlayerSecrets.markKnown(secret, npc.name);
              if (truthful) {
                npc.addTrust(P.name, 0.10, 'you accepted the offer');
                if (PlayerAlliances.level(npc.name) === 0) PlayerAlliances.align(npc.name, GAME.day);
                Feed.post(`${npc.displayName} took it. You are in their debt and they have not named the price.`, 'drama', GAME.day);
              } else {
                /* They wanted the leverage, not the blame. */
                npc.addSuspicion(P.name, 0.05, 'now holds one of your secrets');
                if (chance(0.5)) {
                  dpCampSees(c => { if (c.stats.gameAwareness > 0.55) c.addSuspicion(P.name, 0.10, 'the story came apart'); }, [npc]);
                  Feed.post(`${npc.displayName} took the blame and then let it slip whose it was.`, 'danger', GAME.day);
                } else {
                  Feed.post(`${npc.displayName} is holding it. They are enjoying holding it.`, 'drama', GAME.day);
                }
              }
            }
          },
          {
            text: 'Refuse. Own it yourself in front of everyone.',
            cost: 'The most expensive honest thing in the game, and the only one nobody can use later.',
            go() {
              victim.addTrust(P.name, -0.16, 'you admitted it was you');
              victim.addRel(P.name, -0.05, 'you admitted it was you');
              victim.addVW(P.name, 0.7, 'you admitted it was you');
              dpCampSees(c => {
                c.addRel(P.name, 0.07, 'you stood up and said it');
                c.addSuspicion(P.name, -0.06, 'you stood up and said it');
              }, [victim]);
              npc.addRel(P.name, 0.09, 'you would not let them carry it');
              npc.addTrust(P.name, 0.12, 'you would not let them carry it');
              Feed.post('You owned it in front of the camp. That cost exactly what you thought it would.', 'drama', GAME.day);
            }
          },
          {
            text: 'Let them take it and pay them now, in a vote.',
            cost: 'Settles the debt today by committing you to something tonight.',
            go() {
              const price = dpTargetFor(npc, rest.filter(c => c !== npc)) || victim;
              npc.addTrust(P.name, 0.14, 'paid them straight away');
              npc.addVW(P.name, -0.6, 'paid them straight away');
              P.addVW(price.name, 0.9, `the price of ${npc.displayName} taking the fall`);
              Lying.evaluate(npc, P, 'Truth', 'VoteIntent', price.name);
              PlayerSecrets.add('PushedVote', price.name, GAME.day);
              victim.addVW(npc.name, 0.6, 'blamed them for it');
              Feed.post(`${npc.displayName} wore it and you paid for it in advance.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Ask why they are offering.',
            cost: 'You learn something and they learn that you do not take gifts.',
            go() {
              npc.addRel(P.name, -0.06, 'you questioned the offer');
              npc.addSuspicion(P.name, 0.06, 'you questioned the offer');
              const lean = dpLean(npc);
              if (truthful) {
                npc.addTrust(P.name, 0.06, 'the question was fair');
                if (lean) addIntel(npc.name, 'claim', lean.name, 'told you what they actually want');
                Feed.post(`${npc.displayName} told you the real reason. It was simpler than you expected.`, 'good', GAME.day);
              } else {
                npc.addVW(P.name, 0.4, 'you saw through the offer');
                addIntel(npc.name, 'observe', victim.name, 'the offer was for leverage, not kindness');
                Feed.post(`${npc.displayName} did not have an answer ready. That was the answer.`, 'drama', GAME.day);
              }
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     22. TWO FOR ONE BENCH.
     There is no sit-out mechanic in the sim, which does not matter: the whole
     event is who you make play. Whoever you bench owes you, whoever you make
     play resents you, and the third person only got dragged in because two
     other people did not want to be seen losing.
     ------------------------------------------------------------------ */
  {
    id: 'two-for-one-bench',
    can: () => dpBase(4) && !GAME.merged,
    run() {
      const P = GAME.player;
      const trio = dpPickN(dpHere(), 3);
      const npc = trio[0], rival = trio[1], stuck = trio[2];
      if (!npc || !rival || !stuck) return;
      const truthful = npc.fatigue > 0.70 || npc.hunger > 0.80 || npc.morale < 0.35;
      DBG.log('sim', 'Dilemma bench', { npc: npc.name, rival: rival.name, stuck: stuck.name, truthful });
      Dilemmas.open({
        id: 'two-for-one-bench', npc, truthful, about: [rival, stuck],
        title: 'Two of them want the bench',
        situation: pick(DILEMMA_POOL_LINES.sitOutFightSit),
        claim: dpFill(DILEMMA_POOL_LINES.sitOutFight, { tn: rival.displayName, n1: stuck.displayName }),
        options: [
          {
            text: `Bench ${npc.displayName}.`,
            cost: truthful
              ? `${rival.displayName} wanted it too and will decide you have a favourite.`
              : `They are not injured. ${rival.displayName} knows that as well as you do.`,
            go() {
              npc.addTrust(P.name, 0.15, 'you gave them the bench');
              npc.addRel(P.name, 0.08, 'you gave them the bench');
              npc.addVW(P.name, -0.6, 'you gave them the bench');
              rival.addTrust(P.name, -0.14, 'you gave the bench to somebody else');
              rival.addVW(P.name, 0.5, 'you gave the bench to somebody else');
              rival.fatigue = clamp01(rival.fatigue + 0.10);
              if (!truthful) {
                dpCampSees(c => { if (c.stats.gameAwareness > 0.55) c.addVW(npc.name, 0.35, 'sat out without a reason'); }, [npc]);
                Feed.post(`You benched ${npc.displayName} and half the camp knows they were fine.`, 'danger', GAME.day);
              } else {
                Feed.post(`${npc.displayName} sat out. ${rival.displayName} played and did not enjoy it.`, 'drama', GAME.day);
              }
            }
          },
          {
            text: `Bench ${rival.displayName} instead.`,
            cost: 'The one who asked you first watched you give it away.',
            go() {
              rival.addTrust(P.name, 0.16, 'you gave them the bench');
              rival.addRel(P.name, 0.08, 'you gave them the bench');
              rival.addVW(P.name, -0.6, 'you gave them the bench');
              npc.addTrust(P.name, -0.18, 'asked you first and got nothing');
              npc.addRel(P.name, -0.10, 'asked you first and got nothing');
              npc.addVW(P.name, 0.65, 'asked you first and got nothing');
              npc.fatigue = clamp01(npc.fatigue + 0.14);
              if (truthful) npc.morale = clamp01(npc.morale - 0.10);
              Feed.post(`${rival.displayName} got the bench. ${npc.displayName} played hurt.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Sit out yourself and let them both play.',
            cost: 'Two of them owe you and the whole tribe watched you choose not to compete.',
            go() {
              for (const c of [npc, rival]) {
                c.addTrust(P.name, 0.13, 'you took the bench for them');
                c.addRel(P.name, 0.09, 'you took the bench for them');
                c.addVW(P.name, -0.5, 'you took the bench for them');
              }
              dpCampSees(c => { if (c.stats.gameAwareness > 0.6) c.addVW(P.name, 0.4, 'sat out a challenge by choice'); }, [npc, rival]);
              stuck.addRel(P.name, 0.05, 'you did not put it on them');
              Feed.post('You benched yourself. Two people owe you and everyone else made a note.', 'drama', GAME.day);
            }
          },
          {
            text: `Make them both play. Bench ${stuck.displayName}.`,
            cost: 'The one person who never asked for anything gets the decision made about them.',
            go() {
              for (const c of [npc, rival]) {
                c.addTrust(P.name, -0.11, 'made them play anyway');
                c.addVW(P.name, 0.4, 'made them play anyway');
                c.fatigue = clamp01(c.fatigue + 0.12);
              }
              if (truthful) { npc.morale = clamp01(npc.morale - 0.12); npc.addVW(P.name, 0.3, 'made them play injured'); }
              stuck.addSuspicion(P.name, 0.09, 'you decided about them without asking');
              stuck.addRel(P.name, -0.05, 'you decided about them without asking');
              Feed.post(`${stuck.displayName} sat out a challenge they never asked to miss.`, 'drama', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     23. ARE YOU IN AN ALLIANCE.
     The flattest question in the game. It is here because the honest answer is
     sometimes no — the denial is only a lie if the ledger says you have people,
     and then it is a lie that gets retro-checked when the votes are read.
     `about` shows whoever you actually have, so the player can see what they
     are being asked to deny.
     ------------------------------------------------------------------ */
  {
    id: 'are-you-in-an-alliance',
    can: () => dpBase(2),
    run() {
      const P = GAME.player;
      const mine = dpAllies();
      const npc = pick(dpHere().filter(c => PlayerAlliances.level(c.name) === 0).length
        ? dpHere().filter(c => PlayerAlliances.level(c.name) === 0) : dpHere());
      if (!npc) return;
      const shown = mine.filter(c => c !== npc);
      const truthful = shown.length > 0;
      DBG.log('sim', 'Dilemma in an alliance', { npc: npc.name, truthful, allies: shown.map(c => c.name) });
      Dilemmas.open({
        id: 'are-you-in-an-alliance', npc, truthful,
        about: shown.length ? shown : undefined,
        title: `${npc.displayName} asks it straight`,
        situation: pick(DILEMMA_POOL_LINES.inAnAllianceSit),
        claim: pick(DILEMMA_POOL_LINES.inAnAlliance),
        options: [
          {
            text: 'Deny it. You are not in anything.',
            deny: true,
            cost: truthful
              ? `You have ${shown.length === 1 ? shown[0].displayName : dpNames(shown)}. This is checked when the votes are read.`
              : 'True. They will still leave here thinking you dodged it.',
            go() {
              const out = dpDeny(npc, truthful, 'AllianceClaim', shown.length ? shown[0].name : '(none)');
              dpDenyFallout(npc, truthful, out, 'having people');
              if (truthful && out === 'Caught') for (const a of shown) a.addSuspicion(P.name, 0.06, 'your denial named the shape of it');
              if (!truthful && out === 'Believed') { npc.addRel(P.name, 0.06, 'believed you were alone'); npc.addVW(P.name, -0.3, 'believed you were alone'); }
            }
          },
          {
            text: 'Admit it. Name nobody.',
            cost: 'Honest and useless to them, which is its own kind of insult.',
            go() {
              npc.addTrust(P.name, 0.09, 'admitted it without naming anyone');
              npc.addSuspicion(P.name, 0.07, 'would not say who');
              npc.addVW(P.name, 0.4, 'confirmed they have numbers');
              Lying.evaluate(npc, P, truthful ? 'Truth' : 'Partial', 'AllianceClaim', '(none)');
              Feed.post(`You told ${npc.displayName} that you have people. Not which people.`, 'drama', GAME.day);
            }
          },
          {
            text: shown.length ? `Admit it and name ${shown[0].displayName}.` : 'Offer to be in one with them.',
            cost: shown.length
              ? `Buys ${npc.displayName} outright and puts ${shown[0].displayName} on somebody's list.`
              : 'Turns a question into a commitment you did not plan to make.',
            go() {
              if (shown.length) {
                const a = shown[0];
                npc.addTrust(P.name, 0.16, 'named a real ally');
                npc.addRel(P.name, 0.07, 'named a real ally');
                npc.addVW(a.name, 0.7, 'you named them');
                a.addTrust(P.name, -0.15, 'you gave their name away');
                a.addSuspicion(P.name, 0.12, 'you gave their name away');
                PlayerSecrets.add('Alliance', a.name, GAME.day);
                addIntel(npc.name, 'heat', a.name, 'you named your own ally');
                checkGossipBack(npc, a);
                Feed.post(`${npc.displayName} has a name now, and it is one of yours.`, 'drama', GAME.day);
              } else {
                PlayerAlliances.align(npc.name, GAME.day);
                npc.addTrust(P.name, 0.14, 'offered them an alliance on the spot');
                npc.addRel(P.name, 0.08, 'offered them an alliance on the spot');
                PlayerSecrets.add('Alliance', npc.name, GAME.day);
                Feed.post(`You answered a question with an offer. ${npc.displayName} took it.`, 'good', GAME.day);
              }
            }
          },
          {
            text: 'Ask them the same question first.',
            cost: 'Nobody answers, both of you know it, and now they are certain.',
            go() {
              npc.addSuspicion(P.name, 0.13, 'would not answer a straight question');
              npc.addVW(P.name, 0.35, 'would not answer a straight question');
              const allies = NpcAlliances.alliesOf(npc.name).filter(n => dpHere().some(c => c.name === n));
              if (allies.length) addIntel(npc.name, 'claim', allies[0], 'let something slip while dodging');
              else addIntel(npc.name, 'observe', null, 'dodged it as hard as you did');
              Feed.post('Neither of you answered. Both of you noticed.', 'drama', GAME.day);
            }
          }
        ]
      });
    }
  },

  /* ------------------------------------------------------------------
     24. WHO TOOK THE FOOD.
     Camp politics with no vote in it, which is why it fires on real need
     levels. The complication is fixed and stated: the accused already gave you
     some. So the honest denial is true, the useful answer is a betrayal, and
     saying nothing leaves the suspicion where it currently is — which the
     event measures off actual suspicion in the camp.
     ------------------------------------------------------------------ */
  {
    id: 'who-took-the-food',
    can: () => dpBase(3) && (typeof CampNeeds === 'undefined' || CampNeeds.get('food') < 0.45),
    run() {
      const P = GAME.player;
      const here = dpHere();
      const npc = pick(here);
      const rest = here.filter(c => c !== npc);
      if (rest.length < 2) return;
      /* The accused is whoever the camp already likes least — that is how camps
         choose. The accuser is the loudest one who is not the accused. */
      const accused = rest.reduce((a, b) => dpPressure(here, a.name) >= dpPressure(here, b.name) ? a : b);
      const accuserPool = rest.filter(c => c !== accused);
      if (!accuserPool.length) return;
      const accuser = accuserPool.reduce((a, b) => a.stats.social >= b.stats.social ? a : b);
      const truthful = Math.max(...here.map(c => {
        const e = c.relEntry(P.name); return e ? e.suspicion : 0;
      })) > 0.25;
      DBG.log('sim', 'Dilemma food theft', { npc: npc.name, accused: accused.name, accuser: accuser.name, truthful });
      Dilemmas.open({
        id: 'who-took-the-food', npc, truthful, about: [accused, accuser],
        title: 'The camp wants a name',
        situation: pick(DILEMMA_POOL_LINES.foodMissingSit)
          + ` Two days ago ${accused.displayName} pushed a handful of rice at you and told you to eat it quickly. Nobody saw that either.`,
        claim: dpFill(DILEMMA_POOL_LINES.foodMissing, { sn: accused.displayName, tn: accuser.displayName }),
        options: [
          {
            text: `Name ${accused.displayName}. Say what you saw.`,
            cost: 'Buys the camp and destroys the one person out here who shared with you.',
            go() {
              accused.addTrust(P.name, -0.28, 'you gave their name to the camp');
              accused.addRel(P.name, -0.20, 'you gave their name to the camp');
              accused.addVW(P.name, 1.0, 'you gave their name to the camp');
              accuser.addTrust(P.name, 0.16, 'backed them up');
              accuser.addRel(P.name, 0.08, 'backed them up');
              npc.addTrust(P.name, 0.12, 'gave a straight answer');
              dpCampSees(c => {
                c.addVW(accused.name, 0.6, 'named as the one who took the food');
                c.addTrust(P.name, 0.05, 'told the camp what they saw');
              }, [accused]);
              Feed.post(`You named ${accused.displayName}. The camp has what it wanted.`, 'drama', GAME.day);
            }
          },
          {
            text: 'Say you saw nothing.',
            cost: truthful
              ? 'Your own name is already being said. Silence keeps it there.'
              : 'Protects them, and the camp will keep looking until it finds somebody.',
            go() {
              accused.addTrust(P.name, 0.20, 'you did not give them up');
              accused.addRel(P.name, 0.10, 'you did not give them up');
              accused.addVW(P.name, -0.8, 'you did not give them up');
              accuser.addSuspicion(P.name, 0.14, 'saw nothing, apparently');
              accuser.addVW(P.name, 0.5, 'saw nothing, apparently');
              if (truthful) {
                dpCampSees(c => { if (c.stats.gameAwareness > 0.5) c.addSuspicion(P.name, 0.09, 'the missing food is still unexplained'); }, [accused]);
                Feed.post(`You said nothing. Your name is still in the conversation.`, 'danger', GAME.day);
              } else {
                Feed.post(`You said nothing. ${accused.displayName} will remember that you did.`, 'drama', GAME.day);
              }
            }
          },
          {
            text: 'You never went near the basket. Say it plainly.',
            deny: true,
            cost: 'True — it was put into your hand. They may not hear the difference.',
            go() {
              const out = dpDeny(npc, false, 'TargetInfo', accused.name);
              dpDenyFallout(npc, false, out, 'the food');
              if (out === 'Believed') npc.addVW(accused.name, 0.4, 'went back to the obvious name');
              else {
                accuser.addVW(P.name, 0.4, 'not satisfied with your answer');
                accused.addSuspicion(P.name, 0.08, 'wondering what else you said');
              }
            }
          },
          {
            text: 'Take it yourself. Say you ate it.',
            cost: 'The camp turns on you today and one person owes you everything.',
            go() {
              dpCampSees(c => {
                c.addTrust(P.name, -0.14, 'admitted taking the food');
                c.addRel(P.name, -0.10, 'admitted taking the food');
                c.addVW(P.name, 0.65, 'admitted taking the food');
              }, [accused]);
              accused.addTrust(P.name, 0.30, 'you took it for them');
              accused.addRel(P.name, 0.20, 'you took it for them');
              accused.addVW(P.name, -1.2, 'you took it for them');
              if (PlayerAlliances.level(accused.name) === 0) PlayerAlliances.align(accused.name, GAME.day);
              npc.addRel(P.name, 0.05, 'at least somebody said something');
              Feed.post(`You said it was you. ${accused.displayName} did not look at you once.`, 'danger', GAME.day);
            }
          }
        ]
      });
    }
  }
];
