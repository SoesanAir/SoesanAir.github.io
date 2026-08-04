/* ============================================================
   MAROONING — the season opener.

   Both tribes stand facing the camera. Peff picks 2-5 castaways at random plus
   the player (never first) and asks each of them one question. NPCs answer from
   a pool keyed to their archetype, so a schemer and a camp mum answer the same
   question in completely different voices. Nothing repeats within a playthrough.

   The player picks from ten options, each carrying TRAITS. Everyone watching
   reacts: a castaway who values what you signalled warms to you, one who
   distrusts it cools. That is where first impressions — and the first alliances
   — actually come from.
   ============================================================ */

/* The 15 clusters collapse into 5 answering voices. */
const MAROON_ARCHETYPE = {
  'Strategic Veteran': 'strategist', 'Paranoid Schemer': 'strategist', 'Bitter Veteran': 'strategist',
  'Social Butterfly': 'social', 'Fan Favorite': 'social', 'Loyal Follower': 'social',
  'Physical Threat': 'physical', 'Natural Leader': 'physical', 'Camp Provider': 'physical',
  'Emotional Wildcard': 'wild', 'Chaos Agent': 'wild', 'Villain Arc': 'wild',
  'Under The Radar': 'quiet', 'Loyal Soldier': 'quiet', 'Reluctant Hero': 'quiet'
};
const archetypeOf = c => MAROON_ARCHETYPE[c.cluster] || 'quiet';

/* What a castaway respects. Traits a player answer can carry:
     bold humble funny ruthless warm honest guarded loyal driven modest        */
const ARCHETYPE_VALUES = {
  strategist: { bold: -0.2, humble: 0.3, funny: -0.1, ruthless: 0.6, warm: -0.2, honest: -0.3, guarded: 0.6, loyal: 0.1, driven: 0.4, modest: 0.4 },
  social:     { bold: 0.3, humble: 0.3, funny: 0.7, ruthless: -0.6, warm: 0.8, honest: 0.4, guarded: -0.4, loyal: 0.5, driven: 0.0, modest: 0.2 },
  physical:   { bold: 0.6, humble: 0.1, funny: 0.1, ruthless: 0.1, warm: 0.2, honest: 0.5, guarded: -0.3, loyal: 0.6, driven: 0.7, modest: -0.1 },
  wild:       { bold: 0.7, humble: -0.3, funny: 0.5, ruthless: 0.5, warm: 0.0, honest: 0.2, guarded: -0.2, loyal: -0.3, driven: 0.2, modest: -0.4 },
  quiet:      { bold: -0.4, humble: 0.6, funny: 0.2, ruthless: -0.4, warm: 0.5, honest: 0.6, guarded: 0.4, loyal: 0.5, driven: -0.1, modest: 0.7 }
};

const MAROON_QUESTIONS = [
  {
    id: 'why',
    peff: 'Look around you. Thirty-nine days, one survivor. {name} — why are you here?',
    npc: {
      strategist: [
        'To win. I did not fly out here for the scenery.',
        'Because I have watched people play this badly for years.',
        'I have a plan. I am not going to describe it standing next to it.',
        'Everyone here says family. I say the cheque.',
        'Because I am good at reading people and this is the only sport for it.',
        'I want to see if I am as clever as I think I am.',
        'To beat people better looking than me. That is honest.',
        'Because somebody is going to run this island. Might as well be me.'
      ],
      social: [
        'Honestly? For the people. I already love four of you.',
        'Because I have never met a stranger in my life.',
        'To have the biggest adventure of my life with total lunatics.',
        'I want the stories. The money would be a bonus.',
        'Because my friends dared me and I am incapable of backing down.',
        'To find out who I am when nobody is being polite.',
        'I am here to make thirty-nine days of memories.',
        'Because I talk too much and here that is a superpower.'
      ],
      physical: [
        'To find out what I am made of. Simple as that.',
        'Because I have never quit anything and I am not starting now.',
        'I want to be useful. Give me a job and watch.',
        'To carry a tribe and see how far it goes.',
        'Because comfortable people never learn anything.',
        'I am here to work. The rest will follow.',
        'To earn it. Not talk my way to it.',
        'Because my body has one good season left in it.'
      ],
      wild: [
        'Chaos. Next question.',
        'Because somebody has to make this season watchable.',
        'To burn something down and see what grows.',
        'I want to know how far I will go. Genuinely, I do not know.',
        'Because rules are suggestions and this place has so many.',
        'To find out which of you breaks first.',
        'For the noise. I love noise.',
        'Because I was told not to. Same as always.'
      ],
      quiet: [
        'For my family. That is the whole answer.',
        'Because I have spent my life on the edge of rooms. Not here.',
        'To prove something to one specific person back home.',
        'I am not sure yet. I will let you know on day thirty.',
        'Because I promised someone I would try something frightening.',
        'To be someone who did this, rather than someone who watched it.',
        'I do not need to win. I need to have gone.',
        'Because I am tired of being the sensible one.'
      ]
    },
    /* Player options: ten choices, each signalling traits. */
    player: [
      { text: 'For the money. I am not going to dress it up.', traits: { honest: 1, ruthless: 0.6, warm: -0.3 }, think: 'Blunt. The strategists will nod. The sentimental ones will not.' },
      { text: 'For my family. Everything I do out here is for them.', traits: { warm: 1, humble: 0.6, loyal: 0.6 }, think: 'Safe and sincere. Wins the soft hearts, bores the sharks.' },
      { text: 'Because I intend to run this island, politely.', traits: { bold: 1, driven: 0.8, guarded: -0.4 }, think: 'A target on your back on day one — but nobody will forget you.' },
      { text: 'Honestly? I have no idea. Seemed like a laugh.', traits: { funny: 1, modest: 0.5, driven: -0.5 }, think: 'Disarming. Makes you look harmless, which is its own strategy.' },
      { text: 'To find out who I am with nothing to hide behind.', traits: { honest: 0.8, humble: 0.7, warm: 0.5 }, think: 'Thoughtful. The quiet ones will trust you first.' },
      { text: 'I am here to work. Judge me by what I carry.', traits: { driven: 1, loyal: 0.5, modest: 0.4 }, think: 'The workers will love it. Nobody sees you as a threat yet.' },
      { text: 'Because I am very good at this and you will find out.', traits: { bold: 1, ruthless: 0.5, modest: -0.8 }, think: 'A declaration. Bold as hell. Expect your name early.' },
      { text: 'I will tell you on day thirty-nine.', traits: { guarded: 1, funny: 0.3, honest: -0.3 }, think: 'Gives them nothing. Reads as clever, or as slippery.' },
      { text: 'To beat every single person standing here.', traits: { ruthless: 1, bold: 0.7, warm: -0.5 }, think: 'The villains will respect it. The rest just heard a threat.' },
      { text: 'I mostly want to make friends and eat rice.', traits: { funny: 0.8, warm: 0.8, driven: -0.6 }, think: 'Charming, low-threat. Some will find it a bit much.' }
    ]
  },
  {
    id: 'trust',
    peff: '{name}. Look at the person on your left. Would you trust them with your game?',
    npc: {
      strategist: [
        'Absolutely not. I do not know their surname.',
        'Trust is a currency. I have not been paid yet.',
        'I will trust them the exact moment it is useful.',
        'No. And they should not trust me either.',
        'Ask me after the first vote. That is when people become real.',
        'I trust them to act in their own interest. That is enough.',
        'That is a trap of a question, Peff.',
        'I do not trust anyone standing on this beach. Including me.'
      ],
      social: [
        'Already? Yes. Look at that face.',
        'I trust everyone until they give me a reason. It is a flaw.',
        'We have been friends for ninety seconds and I would die for them.',
        'Yes, and I am aware that is naive.',
        'I would rather be wrong and warm than right and lonely.',
        'Completely. Do not make me regret saying that on camera.',
        'Yes! Are we not all in this together?',
        'I am going to say yes and see what happens.'
      ],
      physical: [
        'I will trust whoever pulls their weight.',
        'Show me they can work and I am with them.',
        'Trust is earned in the shelter, not in a line-up.',
        'Ask me after we have built something together.',
        'I trust them more than I trust standing still.',
        'If they carry, I carry. That is the deal.',
        'Yes, provisionally. Do not embarrass me.',
        'I would trust them to lift. Not yet to vote.'
      ],
      wild: [
        'No, and I hope they heard that.',
        'I would not trust them with a coconut.',
        'Trust? On day one? Peff, be serious.',
        'I trust them exactly as much as they trust me. Which is zero.',
        'I am going to say yes to make things interesting.',
        'They already look like they are lying about something.',
        'Nope. But I like their odds of being fun.',
        'I do not trust anyone who wants to be here.'
      ],
      quiet: [
        'I would like to. That is not the same thing.',
        'I hope so. I am not good at reading people.',
        'I will find out. I usually give people the benefit.',
        'Yes. I would rather start there than the other way.',
        'I do not know them. I will not pretend I do.',
        'Probably more than they should trust me.',
        'I trust easily and it has cost me before.',
        'I will wait and watch. That is my whole game.'
      ]
    },
    player: [
      { text: 'Not for a second. Nothing personal.', traits: { guarded: 1, honest: 0.6, warm: -0.5 }, think: 'Honest and cold. Schemers approve; you just chilled the room.' },
      { text: 'Yes. Somebody has to go first.', traits: { warm: 1, bold: 0.5, honest: 0.5 }, think: 'Generous and a little exposed. The kind ones will remember it.' },
      { text: 'I trust them to look after themselves. Same as me.', traits: { guarded: 0.7, honest: 0.7, ruthless: 0.3 }, think: 'Clear-eyed. Reads as experienced without being nasty.' },
      { text: 'Ask me after the first vote.', traits: { guarded: 0.8, driven: 0.4 }, think: 'Non-answer, but a respectable one. Nobody learns anything.' },
      { text: 'I would trust them before I trusted me.', traits: { funny: 0.8, humble: 0.8, modest: 0.6 }, think: 'Self-deprecating. Lowers the threat, gets a laugh.' },
      { text: 'Completely. And I will say that about all of you.', traits: { warm: 0.9, loyal: 0.6, honest: -0.4 }, think: 'Sweeping and cheap. Some will hear it as flattery.' },
      { text: 'No, but I will still work with them.', traits: { honest: 0.9, driven: 0.5, guarded: 0.4 }, think: 'Pragmatic. The workers and the strategists both nod.' },
      { text: 'I trust whoever carries the water.', traits: { driven: 1, loyal: 0.5, modest: 0.3 }, think: 'Puts the standard on effort. The providers hear an ally.' },
      { text: 'They are already lying to you, Peff.', traits: { bold: 1, ruthless: 0.8, warm: -0.7 }, think: 'A grenade. Enormously memorable. Someone is now your enemy.' },
      { text: 'I do not know them. I am not going to perform certainty.', traits: { honest: 1, modest: 0.7, guarded: 0.4 }, think: 'Measured. The quiet players trust that more than a yes.' }
    ]
  },
  {
    id: 'threat',
    peff: '{name} — who in this line-up frightens you most, and do not say nobody.',
    npc: {
      strategist: [
        'The quiet one. It is always the quiet one.',
        'Whoever answers this question cleverest. So, me.',
        'The likeable ones. You cannot vote out someone everybody loves.',
        'Anybody who has already worked out that this is a social game.',
        'The person who has not said a word yet.',
        'Not the strongest. The most patient.',
        'Whoever is doing the maths right now instead of listening.',
        'I will tell you privately, Peff, in about a week.'
      ],
      social: [
        'Nobody frightens me! ...The big one, a bit.',
        'The serious one. I do not know how to talk to serious.',
        'Whoever does not laugh at my jokes. That is genuinely scary.',
        'The one who is already counting us. You know who you are.',
        'Everyone, in the nicest possible way.',
        'The person who has not smiled once.',
        'Honestly? Being disliked frightens me more than any of them.',
        'The quiet one, and I am going to go and befriend them immediately.'
      ],
      physical: [
        'Nobody here can outwork me. So, nobody.',
        'The clever ones. I cannot punch a conversation.',
        'Whoever is going to talk their way past me.',
        'The one who will still be standing when strength stops mattering.',
        'Anybody who does not need this as much as I do.',
        'The talker. I have seen talkers win.',
        'Not a person. Day twenty. That frightens me.',
        'The smallest one. Always the smallest one.'
      ],
      wild: [
        'None of you. Genuinely. It is a bit sad.',
        'The nice one. Nice people are terrifying.',
        'Whoever is pretending hardest right now.',
        'Me. I frighten me.',
        'The one already looking at me like that.',
        'Nothing here frightens me. Disappointment does.',
        'The boring one. Boring people go far.',
        'Everyone should be frightened of the person who has nothing to lose.'
      ],
      quiet: [
        'All of you, if I am honest.',
        'The loud ones. I do not know how to compete with that.',
        'Whoever is good at this. I will find out who soon enough.',
        'The one who has already made three friends.',
        'Being the first one out frightens me more than any person here.',
        'I would rather not say and make an enemy on day one.',
        'The confident one. Confidence works out here.',
        'Honestly? The camera.'
      ]
    },
    player: [
      { text: 'The quiet one. It is always the quiet one.', traits: { guarded: 0.8, honest: 0.5 }, think: 'Savvy read. The strategists hear a peer. The quiet ones feel seen — or watched.' },
      { text: 'Nobody. And I mean that kindly.', traits: { bold: 0.9, modest: -0.6, warm: 0.3 }, think: 'Confident to the point of a challenge. Expect someone to test it.' },
      { text: 'Whoever is already counting the votes.', traits: { bold: 0.7, guarded: 0.6, ruthless: 0.4 }, think: 'Names the game out loud. The schemers know you are one of them.' },
      { text: 'Me. I am the problem here.', traits: { funny: 1, humble: 0.5, modest: 0.4 }, think: 'Gets the laugh, gives nothing away. Cheap and effective.' },
      { text: 'The strongest one. I would rather say it than pretend.', traits: { honest: 0.9, humble: 0.6, warm: 0.3 }, think: 'Flattering and disarming. The physical players like being noticed.' },
      { text: 'The friendliest person here. That is the real weapon.', traits: { guarded: 0.6, honest: 0.6, funny: 0.3 }, think: 'Insightful. The social players are flattered and slightly exposed.' },
      { text: 'All of you. I would be stupid not to be.', traits: { humble: 1, modest: 0.7, bold: -0.4 }, think: 'Humble and safe. Nobody feels attacked. Nobody is impressed either.' },
      { text: 'Frightened is the wrong word. I am interested.', traits: { guarded: 0.7, bold: 0.5, driven: 0.4 }, think: 'Cool and controlled. Reads as dangerous in a quiet way.' },
      { text: 'Whoever answers this honestly. They are the dangerous one.', traits: { funny: 0.6, guarded: 0.7, bold: 0.4 }, think: 'Clever deflection. Makes everyone else look calculating.' },
      { text: 'None of you frighten me. That should frighten you.', traits: { ruthless: 1, bold: 1, warm: -0.8 }, think: 'A villain edit on day one. Unforgettable. Possibly fatal.' }
    ]
  },
  {
    id: 'sacrifice',
    /* No positional language in a question. These are shuffled, so "Last one"
       landed wherever it felt like and Peff announced the last one three times.
       The runner adds the framing, and only when it is actually true. */
    peff: '{name} — what would you refuse to do to win this?',
    npc: {
      strategist: [
        'Nothing. That is the honest answer and you all knew it.',
        'I would not lie about something that could not be checked. Bad habit.',
        'I will do whatever the game asks. It is a game.',
        'I would not break a promise cheaply. Expensively, yes.',
        'There is nothing on that list. Sorry.',
        'I would not do it badly. That is my only rule.',
        'I would refuse to be boring about it.',
        'Ask me on day thirty-five and I will have a shorter list.'
      ],
      social: [
        'I would not hurt someone for no reason.',
        'I could not be cruel. I have tried, I am terrible at it.',
        'I will not pretend to like someone I do not.',
        'I would not sell out a friend. I would rather go home.',
        'Anything that means I could not look at myself after.',
        'I will lie about a vote. I will not lie about caring.',
        'I could not blindside someone I actually loved. I would cry through it.',
        'I would not make someone feel small. Not for money.'
      ],
      physical: [
        'I will not stop pulling my weight. Whatever it costs.',
        'I would not throw a challenge. Not ever.',
        'I would not let a tribe starve to make a point.',
        'I will not take a shortcut. That is the whole reason I came.',
        'I would not quit. Carry me out on a stretcher.',
        'I would not turn on someone who worked beside me.',
        'Nothing physical. Ask me something harder.',
        'I would not lie about what I can do.'
      ],
      wild: [
        'Nothing. Was that the answer you wanted?',
        'I would refuse to be predictable.',
        'There is no line. That is what makes this fun.',
        'I would not apologise. That is my line.',
        'I will do all of it and sleep beautifully.',
        'I would refuse to lose quietly.',
        'Do not ask me that. You will not like the honesty.',
        'I would not pretend to be a nice person. Too late anyway.'
      ],
      quiet: [
        'I would not become someone my kids could not watch.',
        'I will not humiliate anyone. Beat them, yes. Humiliate, no.',
        'I would not break a promise I made properly.',
        'I could not turn on someone who trusted me. I know that is a weakness.',
        'Nothing that I would have to hide when I got home.',
        'I will not be cruel. Everything else is negotiable.',
        'I would not lie to someone about how they stand with me.',
        'I would rather lose than be ashamed of how I won.'
      ]
    },
    player: [
      { text: 'Nothing. I will do whatever this takes.', traits: { ruthless: 1, honest: 0.7, warm: -0.6 }, think: 'Total honesty about being dangerous. Schemers respect it, everyone fears it.' },
      { text: 'I will not betray someone who trusted me.', traits: { loyal: 1, warm: 0.7, honest: 0.5 }, think: 'A promise you may have to break. But the loyal ones just found their person.' },
      { text: 'I will not be cruel. Everything else is on the table.', traits: { honest: 0.8, warm: 0.5, ruthless: 0.3 }, think: 'Threading the needle. Reads as a real person with a real line.' },
      { text: 'I would not throw a challenge. That is sacred.', traits: { driven: 1, loyal: 0.5, honest: 0.4 }, think: 'Speaks straight to the workers. Nobody else cares much.' },
      { text: 'I would not lie to someone about where they stand.', traits: { honest: 1, loyal: 0.6, guarded: -0.3 }, think: 'A big claim. If you break it, they will all remember this moment.' },
      { text: 'I refuse to be boring about it.', traits: { funny: 1, bold: 0.5, modest: -0.3 }, think: 'Dodges the question with style. The chaotic ones love you.' },
      { text: 'I would not do anything I could not explain at home.', traits: { humble: 0.8, honest: 0.7, warm: 0.5 }, think: 'Grounded and decent. Very hard to dislike.' },
      { text: 'Quit. That is the only thing on the list.', traits: { driven: 1, bold: 0.6, modest: 0.2 }, think: 'Simple and strong. Says nothing about your ethics, which may be smart.' },
      { text: 'I have not found the line yet. I will tell you when I do.', traits: { guarded: 1, honest: 0.5, ruthless: 0.4 }, think: 'Ominous and honest. People will watch you closely now.' },
      { text: 'I would not sell out the people standing beside me.', traits: { loyal: 1, warm: 0.8, bold: 0.3 }, think: 'Said to the whole line. Everyone heard a promise. Everyone will check it.' }
    ]
  }
];

/* ---------- reaction maths ---------- */
/* How much a watching castaway likes what they just heard, -1..1 */
function maroonReaction(npc, traits) {
  const vals = ARCHETYPE_VALUES[archetypeOf(npc)];
  let score = 0, weight = 0;
  for (const k of Object.keys(traits)) {
    const v = vals[k];
    if (v === undefined) continue;
    score += traits[k] * v;
    weight += Math.abs(traits[k]);
  }
  if (!weight) return 0;
  let r = score / weight;
  /* A little personal variance so two identical archetypes are not identical. */
  r += (npc.stats.emotional - 0.5) * 0.15 - (npc.stats.gameAwareness - 0.5) * 0.10;
  return Math.max(-1, Math.min(1, r));
}

/* ---------- the sequence ---------- */
const Marooning = {
  used: new Set(),          // answers already heard this playthrough
  KEY: 'castaway_maroon_used',

  load() { try { this.used = new Set(JSON.parse(localStorage.getItem(this.KEY)) || []); } catch { this.used = new Set(); } },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify([...this.used].slice(-600))); } catch { } },

  /* Never repeat a line within a playthrough; fall back to the least-used pool
     only once every option really is exhausted. */
  freshLine(poolKey, pool) {
    const open = pool.filter(l => !this.used.has(poolKey + '|' + l));
    const line = open.length ? pick(open) : pick(pool);
    this.used.add(poolKey + '|' + line);
    this.save();
    return line;
  },

  /* Peff questions TWO or THREE NPCs plus the player. The player is never first.

     It used to be two to five NPCs against a pool of four questions, drawn with
     `qs[i % qs.length]` — so a six-person opener asked the same question twice.
     Fewer people and many more questions means every question in an opener is a
     different one, and two seasons running do not look alike. */
  allQuestions() {
    const extra = (typeof MAROON_QUESTIONS_EXTRA !== 'undefined') ? MAROON_QUESTIONS_EXTRA : [];
    return MAROON_QUESTIONS.concat(extra);
  },

  buildRunning(cast) {
    const npcs = shuffle(cast.filter(c => !c.isPlayer));
    const n = ri(2, 4);                                  // 2..3 NPCs
    const chosen = npcs.slice(0, Math.min(n, npcs.length));
    const pool = this.allQuestions();
    /* Shuffled and sliced, never cycled, so no question can come up twice. */
    const qs = shuffle([...pool]).slice(0, chosen.length + 1);
    const order = chosen.map((c, i) => ({ who: c, q: qs[i] }));
    /* Insert the player anywhere except position 0. */
    const at = ri(1, order.length + 1);
    order.splice(at, 0, { who: GAME.player, q: qs[qs.length - 1], isPlayer: true });
    DBG.system(`Marooning: pool of ${pool.length} questions, asking ${order.length}`);
    return order;
  },

  /* ---------- the conversation ----------
     Peff and the castaways are turns of the SAME kind, appended to a transcript
     that keeps what has already been said. Previously his question replaced the
     previous line and the reply sat underneath it in a smaller font, which reads
     as a label with a footnote rather than an exchange. */
  say(who, text, kind, tribeName) {
    const box = $('maroon-convo');
    if (!box) return;
    for (const t of box.querySelectorAll('.mc-turn.latest')) t.classList.remove('latest');
    const turn = h('div', 'mc-turn latest ' + (kind || ''));
    turn.appendChild(h('span', 'mc-who', who));
    turn.appendChild(h('span', 'mc-text', text));
    if (tribeName) Tribes.mark(turn, tribeName);
    box.appendChild(turn);
    /* Keep it from growing without limit on a long opener. */
    while (box.children.length > 40) box.removeChild(box.firstChild);
    this.pin();
    return turn;
  },
  peffSays(text, kind) { return this.say('Peff', text, 'peff ' + (kind || '')); },

  /* Pin the transcript to its newest line. Anything that changes the height of
     what sits BELOW the transcript has to call this afterwards — adding the Next
     button or a list of choices re-lays the panel out and pushes the line you
     just added back under the fold, which is the one line you need to read. */
  pin() {
    const box = $('maroon-convo');
    if (!box) return;
    box.scrollTop = box.scrollHeight;
    requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
  },
  clearConvo() { const b = $('maroon-convo'); if (b) b.innerHTML = ''; },

  /* Positional framing, added only when it is true. */
  frame(i, total) {
    if (total <= 1) return '';
    if (i === total - 1) return pick(['Last one. ', 'Final question. ', 'One more and we are done. ']);
    if (i === total - 2 && total > 2) return pick(['', 'Nearly there. ']);
    return '';
  },

  async run(cast) {
    this.load();
    Screens.push('screen-maroon');
    Beach.maroonLine(cast);
    const running = this.buildRunning(cast);
    DBG.system(`Marooning: ${running.length} questions, player at ${running.findIndex(r => r.isPlayer) + 1}`);
    /* Open on black, then the show starts. */
    this.clearConvo();
    $('maroon-choices').innerHTML = '';
    await this.dipIn();

    /* ---- the opening beat ----
       This used to be a line of text and a button reading "Let him speak", which
       is a menu, not an opening. A season should start like a season starts. */
    const season = this.seasonNo();
    const title = $('maroon-title');
    title.innerHTML = '';
    title.appendChild(h('div', 'mt-kicker', 'A NEW SEASON OF'));
    title.appendChild(h('div', 'mt-big', 'CASTAWAY'));
    title.appendChild(h('div', 'mt-sub', `SEASON ${season} · ${CONFIG.totalDays} DAYS · ${cast.length} CASTAWAYS · ONE SURVIVOR`));
    /* The crowd goes inside the card, as the last line of one vertical stack —
       floating it separately put it straight through the kicker. */
    title.appendChild(h('div', 'mt-applause', pick(DIALOGUE.peff.applause)));
    title.classList.add('go');
    $('screen-maroon').classList.add('titling');
    DBG.system(`Marooning: season ${season}`);
    await this.next('Begin');
    title.classList.remove('go');
    $('screen-maroon').classList.remove('titling');
    $('maroon-applause').classList.remove('go');

    /* Now the tribes exist, in colour, before anybody says anything. */
    const live = Tribes.live();
    this.say('Island', `Two tribes. ${live.map(n => Tribes.label(n)).join('  and  ')}.`, 'beat');
    await this.next();
    this.peffSays(pick(DIALOGUE.peff.marooning || ['Welcome to the island.']));
    await this.next();

    for (let i = 0; i < running.length; i++) {
      const step = running[i];
      Beach.maroonFocus(step.who.name);
      this.peffSays(this.frame(i, running.length)
        + step.q.peff.replace('{name}', step.who.displayName));
      await this.next('Hear the answer');

      let traits = null, arch = null;
      if (step.isPlayer) {
        traits = await this.askPlayer(step.q, cast);
      } else {
        arch = archetypeOf(step.who);
        const line = this.freshLine(step.q.id + ':' + arch, step.q.npc[arch]);
        this.say(step.who.displayName, line, 'reply', step.who.tribeName);
        DBG.log('action', `Marooning answer — ${step.who.displayName} (${arch}): ${line}`);
      }

      /* ONE LINE AT A TIME.

         The answer and Peff's comeback used to land together on the same tap, so
         two people spoke at once and the beat where he reacts to what was just
         said was lost. The reply gets the screen to itself; his comeback is a
         separate turn on a separate tap.

         The gate only exists when there IS a comeback — otherwise you would tap
         twice with nothing happening in between. */
      const key = step.isPlayer ? 'sting:player:' + (dominantTrait(traits) || 'none')
        : 'sting:npc:' + arch;
      const pool = step.isPlayer
        ? (PEFF_STINGS[dominantTrait(traits) || ''] || null)
        : PEFF_STINGS_NPC[arch];
      const quip = this.sting(key, pool);
      if (quip) {
        await this.next();
        this.peffSays(quip, 'sting');
        DBG.log('action', `Peff sting: ${quip}`);
      }
      await this.next();
    }
    Beach.maroonFocus(null);
    this.peffSays(pick(DIALOGUE.peff.marooningEnd || ['Tribes — head to your camps.']));
    await this.next('Head to camp');
    Screens.pop();
  },

  /* The player sets the pace. Nothing advances until they press Next — the old
     fixed timers made the whole opener feel like it was happening at you. */
  next(label) {
    return new Promise(res => {
      const box = $('maroon-choices');
      box.innerHTML = '';
      const b = h('button', 'btn primary maroon-next', label || 'Next');
      box.appendChild(b);
      this.pin();
      const screen = $('screen-maroon');
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        screen.removeEventListener('pointerdown', tap);
        box.innerHTML = '';
        res();
      };
      /* A tap ANYWHERE continues.

         This is not just a convenience: the opening card covers the whole screen
         and hides the panel underneath it, so for one beat the Begin button was
         invisible and unclickable and the applause screen was a dead end with no
         way forward at all. A screen-level tap is the reliable way out, and it is
         what you reach for on a phone anyway.

         Only bound while a single Next is pending — never while a list of answers
         is on screen, or a stray tap would pick one for you. */
      const tap = ev => {
        if (ev.target.closest('.maroon-opt')) return;   // never hijack a choice
        go();
      };
      screen.addEventListener('pointerdown', tap);
      b.addEventListener('click', go, { once: true });
      if (GAME.fastMaroon) setTimeout(go, 10);
    });
  },

  /* Fade up from black so the season opens on something. */
  dipIn() {
    const dip = $('maroon-dip');
    if (!dip) return Promise.resolve();
    dip.classList.remove('lift');
    void dip.offsetWidth;
    dip.classList.add('lift');
    return new Promise(r => setTimeout(r, GAME.fastMaroon ? 10 : 1500));
  },

  /* What season we are on WITHOUT advancing it — seasonNo() increments as a side
     effect, so the menu cannot call it just to display the number. */
  currentSeasonNo() {
    try { return (parseInt(localStorage.getItem('castaway_season_no') || '0', 10) || 0) + 1; }
    catch { return 1; }
  },

  seasonNo() {
    let n = 1;
    try { n = parseInt(localStorage.getItem('castaway_season_no') || '0', 10) + 1; } catch { }
    if (!n || n < 1) n = 1;
    try { localStorage.setItem('castaway_season_no', String(n)); } catch { }
    return n;
  },

  applaud() {
    const el = $('maroon-applause');
    if (!el) return;
    el.textContent = pick(DIALOGUE.peff.applause);
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
  },

  /* Peff only speaks if there is something worth saying, and never twice. */
  sting(poolKey, pool) {
    if (!pool || !pool.length) return null;
    if (!GAME.fastMaroon && !chance(CONFIG.maroonStingChance)) return null;
    const open = pool.filter(l => !this.used.has(poolKey + '|' + l));
    if (!open.length) return null;                 // rather silent than repeated
    const line = pick(open);
    this.used.add(poolKey + '|' + line);
    this.save();
    return line;
  },

  askPlayer(q, cast) {
    return new Promise(resolve => {
      const box = $('maroon-choices');
      box.innerHTML = '';
      $('screen-maroon').classList.add('choosing');
      /* Ten options, each showing a thought bubble for what it signals. */
      for (const opt of q.player) {
        const wrap = h('div', 'maroon-opt');
        const b = h('button', 'btn', opt.text);
        const think = h('div', 'maroon-think', opt.think);
        b.addEventListener('click', () => {
          box.innerHTML = '';
          $('screen-maroon').classList.remove('choosing');
          Marooning.say(GAME.player.displayName, opt.text, 'reply', GAME.player.tribeName);
          this.applyPlayerAnswer(opt, cast);
          resolve(opt.traits);
        });
        /* The bubble shows on focus/hover so it reads as the player's own thought. */
        b.addEventListener('mouseenter', () => wrap.classList.add('show'));
        b.addEventListener('mouseleave', () => wrap.classList.remove('show'));
        b.addEventListener('focus', () => wrap.classList.add('show'));
        b.addEventListener('touchstart', () => {
          [...box.children].forEach(c => c.classList.remove('show'));
          wrap.classList.add('show');
        }, { passive: true });
        wrap.appendChild(b);
        wrap.appendChild(think);
        box.appendChild(wrap);
      }
      /* The question being answered must stay visible above the options. */
      this.pin();
    });
  },

  /* Everyone watching reacts — both tribes, because they all heard it. */
  applyPlayerAnswer(opt, cast) {
    const P = GAME.player;
    let up = 0, down = 0;
    const detail = [];
    for (const c of cast) {
      if (c.isPlayer) continue;
      const r = maroonReaction(c, opt.traits);
      const relD = r * CONFIG.maroonRelSwing;
      const trustD = r * CONFIG.maroonTrustSwing;
      c.addRel(P.name, relD, 'first impression at the marooning');
      c.addTrust(P.name, trustD, 'first impression at the marooning');
      if (r > 0.15) up++; else if (r < -0.15) down++;
      detail.push({ n: c.name, arch: archetypeOf(c), r: +r.toFixed(2) });
    }
    DBG.decision('Marooning', 'player answer', {
      traits: opt.traits, warmedTo: up, cooledOn: down, of: cast.length - 1
    });
    DBG.log('sim', 'Marooning reactions', detail);
    Feed.post(`You answered Peff. ${up} liked it, ${down} did not.`, up >= down ? 'good' : 'drama', 1);
  }
};
