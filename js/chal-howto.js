/* ============================================================
   HOW TO PLAY — the card that goes up before a minigame starts.

   Until now the entire tutorial for forty different minigames was one line of
   prose in `game.how`, printed under the arena in 0.72em grey while a 3-2-1
   countdown ran over the top of it. Nobody reads that. The reported symptom was
   "the challenges need a quick in-game tutorial about each challenge — not just
   words, simplify with symbols and arrows", which is the right diagnosis: the
   problem was never that the sentence was badly written, it was that a sentence
   is the wrong shape for "which button, when, and what kills me".

   So this is a DIAGRAM. Two or three panels left to right, one step each, an
   arrow between them, four words maximum underneath a glyph. And a warning strip
   at the bottom carrying the single most useful fact about any of these games —
   the failure condition — which was previously buried mid-sentence if it was
   stated at all.

   TWO LOOKUPS, IN THIS ORDER.
     HOWTO.byId[game.id]     the game's own card
     HOWTO.byVerb[game.verb] the card for that KIND of game

   The verb map is the fallback so a minigame added tomorrow gets something
   sensible rather than nothing. Thirteen of the forty games ride their verb card
   because the verb genuinely says everything — Island Sprint IS "tap the lit one,
   keep the chain" — and the other twenty-seven override it, almost always because
   the failure condition is specific to the apparatus.

   EVERY CARD WAS WRITTEN FROM start(), NOT FROM how(). Three of the `how` strings
   are out of date and one of them is out of date because of a live bug (see the
   notes on dig, cipher and sequence below). A diagram that lies is worse than the
   text it replaced, so where the code and the prose disagreed, the code won.

   DOM and CSS only, no canvas and no images, per the same rule the minigames
   follow. Sizes live in css/chal-howto.css and are all vmin or px — never vh,
   because #app is rotated 90 degrees on a phone held upright.
   ============================================================ */

/* ---- the shape primitives ----

   A glyph is normally just a character. These exist for the handful of ideas no
   single character carries: a safe zone you can be outside of, a meter with a
   red end, a plank a ball rolls down. Each returns a fixed-size arrangement of
   bordered boxes — the same ink-on-paper vocabulary the arena already uses, so
   the card does not look like it came from a different game.

   They are deliberately schematic rather than accurate. `grid` is 3x3 whatever
   the real board is, because the panel is saying "a grid of pads you tap", not
   "here is the board". The things that must be literally true — which button,
   what ends the run — are in the caption and the warning strip. */
const HW_ART = {
  /* A track with a safe band and a marker in it. Balance and drift games. */
  lane() {
    const el = h('div', 'hw-lane');
    el.appendChild(h('i', 'hw-lane-safe'));
    el.appendChild(h('i', 'hw-lane-dot'));
    return el;
  },
  /* The same track with the marker out past the band — what losing looks like. */
  laneOut() {
    const el = HW_ART.lane();
    el.classList.add('out');
    return el;
  },
  /* A bar part-filled, with the last quarter in the bad colour. Any game where a
     quantity climbing to the end of its track is the thing that beats you. */
  meter() {
    const el = h('div', 'hw-meter');
    el.appendChild(h('i', 'hw-meter-fill'));
    el.appendChild(h('i', 'hw-meter-red'));
    return el;
  },
  /* A grid of pads with one lit. */
  grid() {
    const el = h('div', 'hw-grid');
    for (let i = 0; i < 9; i++) el.appendChild(h('i', 'hw-cell' + (i === 1 ? ' lit' : '')));
    return el;
  },
  /* A plank off level with the ball already running to the low end. */
  plank() {
    const el = h('div', 'hw-plank');
    const bar = h('i', 'hw-plank-bar');
    bar.appendChild(h('b', 'hw-plank-ball'));
    el.appendChild(bar);
    return el;
  },
  /* Two pads, one lit: the "this side, now" telegraph. */
  pads() {
    const el = h('div', 'hw-pads');
    el.appendChild(h('i', 'hw-pad lit'));
    el.appendChild(h('i', 'hw-pad'));
    return el;
  },
  /* A leaning stack. */
  stack() {
    const el = h('div', 'hw-stack');
    for (let i = 0; i < 3; i++) el.appendChild(h('i', 'hw-brick'));
    return el;
  },
  /* A sweeping cursor and the narrow window it has to be inside. */
  sweep() {
    const el = h('div', 'hw-sweep');
    el.appendChild(h('i', 'hw-sweep-win'));
    el.appendChild(h('i', 'hw-sweep-cur'));
    return el;
  },
  /* Four meters, one nearly gone — the triage read. */
  bars() {
    const el = h('div', 'hw-bars');
    [0, 1, 2, 3].forEach(i => {
      const b = h('i', 'hw-bar' + (i === 2 ? ' low' : ''));
      b.appendChild(h('u'));
      el.appendChild(b);
    });
    return el;
  }
};

/* Shorthand so the tables below read as data rather than as constructor calls. */
const A = n => ({ art: n });

const HOWTO = {

  /* ---- fallback by verb ----
     Generic on purpose: these have to be true of the VERB, not of the game that
     happens to use it today, because their whole job is to catch a game that has
     not been written yet. Where a verb is used by exactly one game and that
     game's card would say the same thing, the game has no override and this is
     what it gets. */
  byVerb: {
    hold: {
      head: 'HOLD',
      steps: [['✋', 'press and keep pressing'], ['⏱', 'the longer the better']],
      fail: 'you let go too early'
    },
    rhythm: {
      head: 'KEEP THE BEAT',
      steps: [[A('pads'), 'hit the lit side'], ['↻', 'then the other one']],
      fail: 'you hit late or wrong'
    },
    release: {
      head: 'RELEASE LATE',
      steps: [['✋', 'hold it down'], [A('meter'), 'let go before full']],
      fail: 'the meter fills first'
    },
    correct: {
      head: 'CORRECT THE DRIFT',
      steps: [[A('lane'), 'you drift off centre'], ['◀▶', 'tap back toward middle']],
      fail: 'you drift right out'
    },
    tap: {
      head: 'TAP THE LIT ONE',
      steps: [[A('grid'), 'only the lit one'], ['✦', 'keep the chain going']],
      fail: 'a wrong tap breaks it', tag: 'IT COSTS YOU'
    },
    'push-luck': {
      head: 'BANK BEFORE IT GOES',
      steps: [['▲', 'it keeps growing'], ['✋', 'BANK to keep it']],
      fail: 'you push once too far'
    },
    search: {
      head: 'SEARCH',
      steps: [[A('grid'), 'try a square'], ['◉', 'it says how close']],
      fail: 'the clock beats you'
    },
    drag: {
      head: 'SLIDE THE TILES',
      steps: [[A('grid'), 'tap beside the gap'], ['▶', 'it slides in']],
      fail: 'time runs out unsolved'
    },
    deduce: {
      head: 'WORK IT OUT',
      steps: [['?', 'read the clues'], ['✓', 'then commit to one']],
      fail: 'a wrong answer scores little', tag: 'IT COSTS YOU'
    },
    remember: {
      head: 'REPEAT IT BACK',
      steps: [[A('grid'), 'watch what lights up'], ['↻', 'tap the same again']],
      fail: 'one wrong one ends it'
    },
    bid: {
      head: 'BID OR PASS',
      steps: [['◈', 'one budget, no refill'], ['▲', 'each bid costs more']],
      fail: 'the budget runs dry'
    },
    choose: {
      head: 'CHOOSE WELL',
      steps: [['▣▣▣', 'pick from your campmates'], ['✓', 'the choice is everything']],
      fail: 'a bad pick sinks you'
    },
    sustain: {
      head: 'KEEP THEM ALL UP',
      steps: [[A('bars'), 'several meters, all falling'], ['✋', 'top up the weakest']],
      fail: 'one of them empties'
    },
    intercept: {
      head: 'CATCH IT IN TIME',
      steps: [[A('pads'), 'watch which end lights'], ['✋', 'tap as it lands']],
      fail: 'you miss it entirely'
    },
    endure: {
      head: 'HOLD ON',
      steps: [['✋', 'hold, and keep holding'], ['⏱', 'it gets worse anyway']],
      fail: 'the apparatus wins first'
    },
    resist: {
      head: 'STAY UP',
      steps: [[A('lane'), 'keep yourself steady'], ['✦', 'you will be tempted']],
      fail: 'you fall, or give in'
    },
    time: {
      head: 'TIME THE MOMENT',
      steps: [['∿', 'the window comes around'], ['✋', 'act inside it']],
      fail: 'you act at the wrong moment'
    },
    balance: {
      head: 'KEEP IT LEVEL',
      steps: [['◉', 'it rolls downhill'], ['▲▼◀▶', 'tilt against it']],
      fail: 'it rolls off the edge'
    },
    level: {
      head: 'KEEP IT CENTRED',
      steps: [[A('plank'), 'the ball rolls downhill'], ['◀▶', 'raise the low end']],
      fail: 'it runs off the end'
    },
    counterweight: {
      head: 'LEVEL, THEN ACT',
      steps: [[A('plank'), 'lean it back level'], ['≡', 'only act when still']],
      fail: 'you act on a moving base'
    },
    place: {
      head: 'PLACE IT EXACTLY',
      steps: [[A('sweep'), 'a marker sweeps past'], ['▼', 'drop it dead centre']],
      fail: 'off-centre adds up', tag: 'IT COSTS YOU'
    },
    steer: {
      head: 'STEER IT THROUGH',
      steps: [['▲▼◀▶', 'tilt to roll it'], ['▣', 'reach the far side']],
      fail: 'you drop into a hole', tag: 'IT COSTS YOU'
    },
    aim: {
      head: 'LOCK, THEN FIRE',
      steps: [['⇕', 'tap to lock height'], ['⇔', 'tap again for power']],
      fail: 'a wide shot wastes time', tag: 'IT COSTS YOU'
    },
    swing: {
      head: 'TIME THE SWING',
      steps: [['▼', 'you are moving past'], ['✋', 'swing when they meet']],
      fail: 'you miss and go again', tag: 'IT COSTS YOU'
    },
    pull: {
      head: 'PULL WHEN THEY REST',
      steps: [[A('meter'), 'they rest, then surge'], ['✋', 'pull only in rest']],
      fail: 'you mash and gas out'
    },
    read: {
      head: 'READ THE TELL',
      steps: [['◉', 'they show it first'], ['↻', 'counter what is coming']],
      fail: 'you guess instead of reading'
    },
    untangle: {
      head: 'FIND THE FREE ONE',
      steps: [['✕', 'check every crossing'], ['▬', 'one is over everywhere']],
      fail: 'a wrong pull makes it worse', tag: 'IT COSTS YOU'
    },
    recall: {
      head: 'ANSWER FROM MEMORY',
      steps: [['?', 'about your own season'], ['⏱', 'one tap, clock running']],
      fail: 'too slow counts as wrong', tag: 'IT COSTS YOU'
    },
    predict: {
      head: 'NAME WHO THEY NAMED',
      steps: [['?', 'everyone answered a survey'], ['✓', 'pick the top name']],
      fail: 'wrong names cost you strikes'
    },
    solve: {
      head: 'SOLVE IT',
      steps: [['▣', 'one puzzle, one solution'], ['⏱', 'before the clock stops']],
      fail: 'you leave it unfinished'
    },
    arrange: {
      head: 'ARRANGE THEM',
      steps: [[A('grid'), 'fill every empty tile'], ['✕', 'no repeats allowed']],
      fail: 'a clash scores nothing', tag: 'IT COSTS YOU'
    },
    stomach: {
      head: 'HOLD, THEN BACK OFF',
      steps: [['✋', 'hold to keep going'], [A('meter'), 'watch the meter climb']],
      fail: 'it tops out and you gag'
    }
  },

  /* ---- per-game overrides ----
     Only where the verb card would leave out something the player needs. Mostly
     that is the failure condition, which is apparatus-specific in almost every
     case: "you let go too early" is true of every hold game and useless in all
     of them next to "the bucket touches down". */
  byId: {

    /* The verb card stops at "hold". Hold the Rope also drops you the moment you
       release after gripping — `!held && held_ms > 400` — which is a whole second
       failure mode the one-liner never mentions. */
    rope: {
      head: 'HOLD AND STEER',
      steps: [['✋', 'hold the middle button'], [A('lane'), 'tap left or right']],
      fail: 'you let go, or drift out'
    },
    logcarry: {
      head: 'ALTERNATE',
      steps: [[A('pads'), 'hit the lit foot'], ['↻', 'then the other foot']],
      fail: 'the log tips right over'
    },
    beam: {
      head: 'CORRECT THE DRIFT',
      steps: [[A('lane'), 'tap left or right'], ['⇉', 'gusts shove you sideways']],
      fail: 'you slide off the beam'
    },
    stack: {
      head: 'BANK BEFORE IT FALLS',
      steps: [[A('stack'), 'STACK adds a bag'], ['✋', 'BANK to keep them']],
      fail: 'it topples and you keep nothing'
    },

    /* Not "two are given". `shown` comes from ctx.span(1, 2) and span() floors at
       300, so the loop fills every slot but two — you are shown all of the word
       except a couple of blanks. The card says what the screen actually shows. */
    cipher: {
      head: 'FILL THE BLANKS',
      steps: [['T▢R▢H', 'some letters are given'], ['ABC', 'tap letters in order']],
      fail: 'the finished word is wrong'
    },
    coords: {
      head: 'ONE TAP ONLY',
      steps: [['≡', 'read all three clues'], [A('grid'), 'tap one square, once']],
      fail: 'the further off, the worse', tag: 'IT COSTS YOU'
    },
    matches: {
      head: 'PICK THE FIX',
      steps: [['6+4=4', 'the sum is wrong'], ['✓', 'pick the true one']],
      fail: 'you pick the wrong one'
    },
    /* `lives` is also ctx.span(1, 2), so it is 300 rather than one or two and
       nothing but the clock can end this. Saying "you get two goes" would be a
       straight lie, so the card names the clock instead. */
    sequence: {
      head: 'FIND THE RULE',
      steps: [['2 4 8 ?', 'work out the step'], ['123', 'key the next three']],
      fail: 'the clock stops you mid-code'
    },
    unscramble: {
      head: 'SPELL IT',
      steps: [['CHEAM', 'letters, out of order'], ['1234', 'tap them in order']],
      fail: 'every wrong tap costs score', tag: 'IT COSTS YOU'
    },
    blind: {
      head: 'REBUILD IT',
      steps: [[A('grid'), 'memorise the lit squares'], ['⏱', 'it hides, then rebuild']],
      fail: 'three wrong squares ends it'
    },
    watch: {
      head: 'TAP THE SOUNDS',
      steps: [['♪', 'tap the notes'], ['●', 'never tap the dots']],
      fail: 'a false alarm wakes camp', tag: 'IT COSTS YOU'
    },
    trustfall: {
      head: 'PICK YOUR CATCHER',
      steps: [['▣▣▣', 'choose one campmate'], ['✋', 'their strength counts too']],
      fail: 'a cold partner lets go'
    },
    relay: {
      head: 'ORDER THE LEGS',
      steps: [['1 2 3', 'put people on legs'], [A('grid'), 'then run your own']],
      fail: 'wrong person, wrong leg', tag: 'IT COSTS YOU'
    },

    /* Three panels because Chimney Sweep genuinely has three rules, and the
       middle one is the whole game: a re-set costs the other three limbs, so
       mashing is worse than doing nothing. */
    brace: {
      head: 'TAP THE WEAKEST GRIP',
      steps: [[A('bars'), 'four grips, all sliding'], ['✋', 'resetting drains the rest'],
        ['▼', 'the pegs keep dropping']],
      fail: 'you run out of slips'
    },
    simmo: {
      head: 'CATCH BOTH ENDS',
      steps: [[A('pads'), 'the basket lights up'], ['↔', 'the ends alternate']],
      fail: 'any ball hits the ground'
    },
    bucket: {
      head: 'HOLD, THEN RE-COIL',
      steps: [['✋', 'hold the handle down'], [A('sweep'), 're-grip inside the green']],
      fail: 'the bucket touches down'
    },
    perch: {
      head: 'STAY ON THE PERCH',
      steps: [[A('lane'), 'tap left or right'], ['✦', 'Peff offers you food'],
        ['✕', 'refusing shoves you harder']],
      fail: 'you tip off the perch'
    },
    tide: {
      head: 'BREATHE IN THE TROUGH',
      steps: [['∿', 'the swell rises, falls'], ['✋', 'breathe below your mouth']],
      fail: 'your air meter empties'
    },
    rollerball: {
      head: 'KEEP THEM ON',
      steps: [['◉', 'balls roll on it'], ['▲▼◀▶', 'tilt against the roll'],
        ['●●●', 'more balls keep arriving']],
      fail: 'one ball leaves the disc'
    },
    balldrop: {
      head: 'KEEP IT CENTRED',
      steps: [[A('plank'), 'the ball rolls downhill'], ['◀▶', 'RAISE the low end'],
        ['⟺', 'the rod keeps growing']],
      fail: 'it runs off the end'
    },
    tipsy: {
      head: 'LEVEL, THEN PLACE',
      steps: [[A('plank'), 'lean it back level'], ['≡', 'level AND not moving'],
        [A('stack'), 'PLACE the next letter']],
      fail: 'topple and the stack restarts', tag: 'IT COSTS YOU'
    },
    coins: {
      head: 'DROP ON CENTRE',
      steps: [[A('sweep'), 'a cursor sweeps across'], ['▼', 'DROP inside the window']],
      fail: 'drop wide and it falls'
    },
    sling: {
      head: 'LOCK, THEN FIRE',
      steps: [['⇕', 'tap to lock height'], ['⇔', 'tap again for power'],
        ['▤', 'broken tiles pour sand']],
      fail: 'every miss costs a reload', tag: 'IT COSTS YOU'
    },
    sumo: {
      head: 'READ THE TELL',
      steps: [['◉', 'they tell you first'], ['S▸F▸B', 'each beats the next']],
      fail: 'they shove you into the sea'
    },
    tug: {
      head: 'PULL IN THEIR REST',
      steps: [[A('meter'), 'they rest, then surge'], ['✋', 'pull only in rest'],
        ['▽', 'mashing empties your grip']],
      fail: 'they drag you off the end'
    },
    touchy: {
      head: 'NAME WHO THEY NAMED',
      steps: [['?', 'the tribe was surveyed'], ['✓', 'pick the top name'],
        ['✕✕✕', 'three strikes and out']],
      fail: 'three wrong ends it'
    },
    hanoi: {
      head: 'MOVE THE STACK',
      steps: [[A('stack'), 'tap a post, lift'], ['▶', 'tap another to drop'],
        ['✕', 'never big on small']],
      fail: 'extra moves cost the bonus', tag: 'IT COSTS YOU'
    }
  },

  /* Last resort. A game with a verb nobody has written a card for still gets a
     headline, a glyph and a warning line rather than a blank rectangle, which is
     the whole reason the lookup has three levels instead of two. */
  generic: {
    head: 'READ THE ARENA',
    steps: [['?', 'the buttons are below'], ['⏱', 'before the clock stops']],
    fail: 'you run out of time'
  }
};

const Howto = {

  /* Six seconds. Long enough to read a headline, two panels and a warning line
     out loud; short enough that a player who has already played this one twenty
     times and looked away is not sitting waiting for it. The tap is the real
     dismissal — this is only the floor under someone who is not looking. */
  DWELL: 6000,

  /* id beats verb beats generic. Never throws and never returns undefined,
     because the caller is between the arena being built and the countdown
     starting and has nowhere to put an error. */
  entry(game) {
    const g = game || {};
    return (HOWTO.byId && HOWTO.byId[g.id])
      || (HOWTO.byVerb && HOWTO.byVerb[g.verb])
      || HOWTO.generic;
  },

  /* A glyph is a string, or {art:'name'} for one of the shape arrangements.
     Long strings get a smaller size class: '▲▼◀▶' at full glyph size is wider
     than the panel it lives in, and a panel that clips its own diagram is worse
     than no diagram. */
  glyph(spec) {
    if (spec && typeof spec === 'object' && spec.art && HW_ART[spec.art]) {
      const box = h('div', 'hw-glyph hw-art');
      box.appendChild(HW_ART[spec.art]());
      return box;
    }
    const txt = (spec === null || spec === undefined) ? '?' : String(spec);
    return h('div', 'hw-glyph' + ([...txt].length > 2 ? ' hw-glyph-long' : ''), txt);
  },

  /* Build the card for a game. Returns an element. */
  build(game) {
    const g = game || {};
    const e = this.entry(g);
    const card = h('div', 'hw-card');
    /* The frame's own header is behind this, so the name is repeated here —
       otherwise the card is an anonymous instruction sheet and the player has
       lost track of which challenge they are about to play. */
    card.appendChild(h('div', 'hw-name', g.name || ''));
    card.appendChild(h('div', 'hw-verb', e.head || 'PLAY'));

    const strip = h('div', 'hw-steps');
    /* Three is the hard ceiling. Four panels on a 344px screen means the
       captions wrap to three lines each and the warning strip goes off the
       bottom, which is the exact failure this screen has had before. */
    const steps = (e.steps || []).slice(0, 3);
    steps.forEach((s, i) => {
      if (i) strip.appendChild(h('div', 'hw-arrow', '▶'));
      const p = h('div', 'hw-panel');
      p.appendChild(this.glyph(s[0]));
      p.appendChild(h('div', 'hw-cap', s[1] || ''));
      strip.appendChild(p);
    });
    card.appendChild(strip);

    /* The failure condition, in the warning colour, on its own. It is the single
       most useful sentence about any of these games and in the old one-liner it
       was the clause after the dash that nobody got to. */
    const fail = h('div', 'hw-fail');
    fail.appendChild(h('b', 'hw-fail-tag', e.tag || 'YOU LOSE IF'));
    fail.appendChild(h('span', 'hw-fail-txt', e.fail || 'the clock runs out'));
    card.appendChild(fail);

    card.appendChild(h('div', 'hw-tap', 'TAP TO START'));
    return card;
  },

  /* Show it over the arena and resolve when the player taps on.

     hostEl should be the #chal-game LAYER, not the .cg-frame. At this point in
     play() the arena is still empty — start() has not run — so the frame is
     about sixty pixels tall and has overflow:hidden, which clips the bottom half
     of the card off, warning strip included. The layer is inset:0 on the screen
     and has a height that does not depend on what the arena contains.

     Resolves true if a card was actually shown, false if it was skipped. Never
     rejects: this sits between the arena and the countdown, and a rejected
     promise here would leave a challenge that never starts. */
  show(game, hostEl) {
    return new Promise(resolve => {
      /* The harnesses set fastChallenge to run all forty games headlessly. They
         will hang on anything that waits for a tap, so this has to be the first
         thing checked and it has to resolve without rendering. GAME may not
         exist at all — several tools run pieces of this with no season. */
      let fast = false;
      try { fast = !!(typeof GAME !== 'undefined' && GAME && GAME.fastChallenge); } catch (err) { fast = false; }
      if (fast || !hostEl) return resolve(false);

      let card = null;
      try { card = this.build(game); } catch (err) { card = null; }
      if (!card) return resolve(false);

      let settled = false, timer = null;
      /* A tap anywhere at all — the card AND the dimmed layer around it. A player
         who has to find a small "OK" on a screen they were not reading has been
         given a chore. pointerdown for a finger, click for a keyboard or a
         synthetic harness event; `settled` stops the pair resolving twice.
         Nothing underneath can be pressed by the follow-through, because the
         arena is still empty at this point — start() has not been called yet. */
      const go = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        hostEl.removeEventListener('pointerdown', go);
        hostEl.removeEventListener('click', go);
        card.remove();
        resolve(true);
      };
      card.addEventListener('pointerdown', go);
      card.addEventListener('click', go);
      hostEl.addEventListener('pointerdown', go);
      hostEl.addEventListener('click', go);
      timer = setTimeout(go, this.DWELL);
      hostEl.appendChild(card);
      return undefined;
    });
  }
};
