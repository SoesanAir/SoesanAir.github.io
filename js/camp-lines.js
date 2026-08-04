/* ============================================================
   CAMP LINES — the camp economy, spoken out loud.

   A labour system nobody mentions is a spreadsheet. These are the pools that
   turn it into something the player hears: people agreeing to help, people
   telling the player where to go, people grumbling about whoever does nothing,
   and — the part that makes the survival layer feel real — everybody sounding
   like their own hunger, exhaustion and state of mind.

   Banded three ways depending on what the line is about:
     by ETHIC   (grafter / mid / idle)   — how this person feels about work
     by WARMTH  (cold / wary / warm / close) — how they feel about the player
   Whichever actually decides the wording.
   ============================================================ */

'use strict';

const CAMP_VOICE = {

  /* ---------- somebody agrees to help ---------- */
  calloutAgree: {
    grafter: [
      'Already on it. I was going that way anyway.',
      'Thank you. I have been saying that for two days.',
      'Right. Grab the other end and we will do it now.',
      'Finally, someone else noticed.',
      'Yes. Come on, before it gets hot.',
      'Good. I hate being the only one who says it.',
      'Done. I would rather work than sit here thinking.',
      'You and me, then. Everyone else can watch.',
      'That is exactly what I was about to do.',
      'Say it louder next time. Some of them need it twice.'
    ],
    mid: [
      'Yeah, fair. I can do that.',
      'Alright. Give me a minute and I will sort it.',
      'I suppose somebody has to.',
      'Fine. Not like I was doing anything.',
      'You are right, it is getting bad.',
      'Okay. I will take that one.',
      'Sure. Better than sitting in the sun.',
      'I had noticed. I just had not moved yet.',
      'Consider it handled.',
      'Point taken. I will go.'
    ],
    idle: [
      'Ugh. Fine. For you, not for them.',
      'You are lucky I like you.',
      'One trip. That is what you are getting.',
      'I will help. Do not make it a habit of asking.',
      'Only because you asked and not because you told.',
      'Alright, alright. Put the eyes away.',
      'I will do a bit. Do not expect miracles.',
      'This is the last time this week, understand?',
      'You owe me for this. Genuinely.',
      'I am doing this under protest, for the record.'
    ]
  },

  /* ---------- somebody cannot be bothered ---------- */
  calloutShrug: {
    any: [
      'Mm. Someone should.',
      'Yeah, probably.',
      'In a bit.',
      'Is that a job for me or a general announcement?',
      'Noted.',
      'I am sure it will get done.',
      'Somebody will handle it.',
      'It is not that bad yet.',
      'You know where the {need} is, right?',
      'That sounds like a tomorrow problem.',
      'Sure. After I sit here a while longer.',
      'Uh huh.'
    ]
  },

  /* ---------- you told them to work and you have done nothing ----------
     The single most important pool in this file: it is what stops the call-out
     being a free relationship faucet. */
  calloutHypocrite: {
    grafter: [
      'You want {need}? I have not seen you carry a single thing since we got here.',
      'Funny. I do all of it and you do the announcing.',
      'Say that again when your hands are as torn up as mine.',
      'You have got a lot of opinions for someone who has never once helped.',
      'I will get the {need} when you get off the log.',
      'Do you know what would be quicker? You doing it.',
      'You are welcome to point. I am done taking instructions from you.',
      'That is rich, coming from you.',
      'I have been out here since sunrise. Where were you?',
      'You talk about this camp like you live somewhere else.'
    ],
    mid: [
      'Why is it always the people who do nothing who bring it up?',
      'You first, then.',
      'Right. And what have you done today?',
      'I would take that more seriously from someone who lifts things.',
      'You could have fetched it in the time it took to tell me.',
      'Sure. You get the {need} and I will supervise.',
      'Weird how you notice the jobs but never the doing.',
      'Ask me again when you have done one.',
      'I mean — you have got two hands.',
      'Bit rich, that.'
    ]
  },

  /* ---------- you have said it already today ---------- */
  calloutRepeat: {
    any: [
      'You have said. Twice now.',
      'I heard you the first time.',
      'Yes. You mentioned.',
      'Are you going to keep saying it or are we going to do something?',
      'Once was enough.',
      'Do you think it got worse in the last hour?',
      'Nagging is not a camp job.',
      'You are starting to sound like my mother.',
      'I have got ears.',
      'Please stop.'
    ]
  },

  /* ---------- ambient gossip: whoever does nothing ---------- */
  gossipGrumble: {
    any: [
      'Have you ever once seen {tn} carry anything? Once?',
      '{tn} has worked out that if you sit still long enough, someone else goes.',
      'I am not saying vote them out. I am saying {tn} has never fetched water.',
      'Count the jobs {tn} has done. Go on. Count them.',
      '{tn} does that thing where they stand near the work.',
      'It is not even the laziness with {tn}, it is the being seen not to care.',
      'We are all tired. {tn} is not even tired, that is the thing.',
      'I would drag that log twice before I asked {tn} once.',
      'Every camp has a {tn}. Every single one.',
      '{tn} eats first and works never. Note it.',
      'When this goes to a vote, remember who fetched the wood.',
      'I stopped asking {tn}. It was making me angry.',
      '{tn} is very good at holding one small thing while others hold big ones.',
      'Nobody is keeping score. I am keeping score. It is {tn}.'
    ]
  },
  gossipPraise: {
    any: [
      '{tn} has not stopped since we landed. Not once.',
      'Say what you like about the game — {tn} keeps this camp alive.',
      'If {tn} goes home we are eating raw fish and sleeping in the rain.',
      'I would not still be here without {tn}, honestly.',
      '{tn} does the jobs nobody wants and never mentions it.',
      'You notice who works when you are too tired to.',
      'Nobody asked {tn} to do that. That is the point.',
      '{tn} is the reason there is a fire at all.',
      'Whatever happens, {tn} earned their bed.',
      'I owe {tn} about four nights of sleep.'
    ]
  },

  /* ---------- morning after a bad night: naming somebody ---------- */
  blame: {
    any: [
      'Somebody was supposed to be on that. It was not me, and we all know who it was not.',
      'That is what happens. That is exactly what happens.',
      'One person could have stopped that last night. One.',
      'I am too tired to be polite about it. {tn} did nothing again.',
      'We all slept badly and one of us did not earn the right to complain.',
      'Do not look at me. Look at {tn}.',
      'Right. So we are just doing this now, are we? Every night?',
      'I will fix it. Same as last time. Same as next time.',
      'Ask {tn} how the night went. Then ask what they did about it.',
      'Nobody is angry. Everyone is angry.',
      'This is the second time and I have stopped finding it funny.',
      'If it happens again I am putting a name down and it will not be a strategic one.'
    ]
  },

  /* ---------- ambient: a need is bad and somebody says so ---------- */
  needMention: {
    any: [
      'We are nearly out of {need}, by the way.',
      'Has anyone actually looked at the {need} today?',
      'The {need} situation is getting silly.',
      'I am not doing the {need} again. I did it yesterday.',
      'Someone needs to sort the {need} before dark.',
      'Genuine question — who is on {need}?',
      'That {need} is not going to fix itself.',
      'We will regret the {need} tonight.'
    ]
  },

  /* ============================================================
     THE SURVIVAL LAYER, SPOKEN
     What castaways sound like when they are starving, wrecked, or coming apart.
     These override the ordinary banded greeting so hunger and exhaustion are
     things you HEAR rather than things you read off a bar.
     ============================================================ */

  /* ---------- they are starving ---------- */
  stateHungry: {
    cold: [
      'What. I am too hungry for this.',
      'Unless you are holding food, I do not care.',
      'Do not talk to me about the game. Talk to me about rice.',
      'I have not eaten properly in days and you want a chat.',
      'Make it quick, I have got no energy to be polite.',
      'Everything hurts and you are here.',
      'I can hear my own stomach over you.',
      'No. Whatever it is, no.'
    ],
    wary: [
      'Sorry — I am running on nothing. Say it slowly.',
      'I keep losing the thread. I think it is the hunger.',
      'Is there anything left in the basket? Anything at all?',
      'I dreamt about bread. Actual bread. Go on, what is up?',
      'My hands are shaking a bit. It is fine. What do you need?',
      'Talk. Just do not make me stand up.',
      'I am here. Barely, but I am here.',
      'Be honest — do I look as rough as I feel?'
    ],
    warm: [
      'Tell me you found food. Tell me anything.',
      'I am starving and I am glad it is you.',
      'Sit. If we are going to be hungry we may as well be hungry together.',
      'I have decided the hunger is easier when someone is talking.',
      'If you have got a coconut hidden somewhere I will owe you the season.',
      'I would trade every advantage on this island for a hot meal.',
      'Do not let me talk about food. I will not stop.',
      'Distract me. Please. Anything.'
    ],
    close: [
      'I am so hungry I could cry, and you are the only person I would say that to.',
      'Do not tell the others how bad I am. Tell me something instead.',
      'If one of us eats today I want it to be you. I mean that.',
      'We are going to laugh about how hungry we were. Not today though.',
      'Sit with me. I do not have the strength to go and find you later.',
      'Honestly? I am struggling. Properly struggling.',
      'You are the only reason I got up this morning. That is not a line.',
      'Talk to me until the hunger gets boring.'
    ]
  },

  /* ---------- they are wrecked ---------- */
  stateTired: {
    cold: [
      'I have had two hours of sleep. Choose your next words carefully.',
      'No. I am asleep. This is a dream and you are not in it.',
      'Whatever this is, it can wait until I have lain down.',
      'I cannot do strategy on this little sleep.',
      'Please go away. Politely. But go away.',
      'I am so tired I have stopped pretending to like people.',
      'Everything you say is going in one ear and out.',
      'Do not. Not today.'
    ],
    wary: [
      'Sorry, I am half asleep. Run that past me again.',
      'I did not sleep. Nobody slept. What do you want?',
      'If I sit down now I will not get up. So — quickly.',
      'My eyes keep closing. It is not you.',
      'I am about four hours short of being a person.',
      'Say it twice. I will only catch it the second time.',
      'I am upright. That is the best I have got.',
      'Careful, I might agree to anything right now.'
    ],
    warm: [
      'I am wrecked. Sit down and be wrecked with me.',
      'You look as bad as I feel. That is comforting.',
      'If I fall asleep mid-sentence, do not take it personally.',
      'Every bone. Every single bone.',
      'I would sell my vote for a mattress right now.',
      'Do not make me think hard. Make me laugh instead.',
      'This is the part of the show they do not film.',
      'How is anyone doing this? Genuinely, how?'
    ],
    close: [
      'I am running on absolutely nothing and I still came to find you.',
      'Let me just close my eyes while you talk. I am listening.',
      'You can wake me up for anything. Anything at all.',
      'I have not slept properly since we got here and you are the only rest I get.',
      'Tell me it is worth it. I will believe you.',
      'I trust you enough to be honest — I am on my last legs.',
      'Sit. I will prop up on you and pretend it is a chair.',
      'If I go quiet it is exhaustion, not distance.'
    ]
  },

  /* ---------- their head has gone ---------- */
  stateBreaking: {
    cold: [
      'Do not. I am not in a state to be worked.',
      'I am hanging on by a thread and you want something.',
      'Ask someone with anything left to give.',
      'Everyone out here wants a piece and there is not much left.',
      'I do not have it in me today. Any of it.',
      'Leave me be. Truly.',
      'I have nothing for you. Nothing for anyone.',
      'Not now. Not you.'
    ],
    wary: [
      'I am not doing great. That is all I am going to say.',
      'Some days out here get on top of you. This is one.',
      'Can we do this without me having to be clever?',
      'I am fine. I am not, but I am saying I am.',
      'Sorry. My head is not where it usually is.',
      'Do not read anything into it if I go quiet.',
      'I keep thinking about home and it is not helping.',
      'Ask me something easy.'
    ],
    warm: [
      'I have been having a rough one, actually.',
      'Do not tell anyone, but I nearly went and sat in the sea and cried.',
      'It is getting to me. The whole thing.',
      'I am glad you came over. I was in my own head.',
      'Some mornings I forget why I signed up.',
      'I need five minutes of not playing the game. Give me that?',
      'I am wobbling. Not gone, but wobbling.',
      'Talk about something that is not this island.'
    ],
    close: [
      'I think I might be falling apart a bit. You are the only one who gets that.',
      'If you were not here I would have gone home already.',
      'I am not okay. I can say that to you and nobody else.',
      'Hold the line for me today. I will do it for you tomorrow.',
      'I have got nothing left in the tank and I still want you to win this.',
      'Do not let me quit. Actually — promise me that.',
      'I am scared of how much this is getting to me.',
      'Just sit here. You do not have to fix it.'
    ]
  },

  /* ---------- player says "I am starving" ---------- */
  replyHungry: {
    cold: [
      'We are all starving. Get in line.',
      'And? Nobody made you come out here.',
      'Yes, that is the show. That is the whole show.',
      'If you are looking for sympathy the basket is empty too.',
      'Do you know who else is hungry? Everyone.',
      'Tell it to the fire.',
      'Try working for it.',
      'I am not your mother.',
      'You will eat when there is food.',
      'You should have gone fishing instead of talking.'
    ],
    wary: [
      'Yeah. It is the worst part, is not it.',
      'There might be something left in the basket. Might.',
      'Everyone is. Nobody wants to say it first.',
      'It gets easier around day ten. That is a lie, but people say it.',
      'Drink water. It helps for about four minutes.',
      'I have stopped thinking about it. Recommend it.',
      'Do not look at the food store. It makes it worse.',
      'Same. Genuinely, same.',
      'You get used to it. You do not, but you get used to saying you have.',
      'If somebody forages today we all eat. Somebody being anybody.'
    ],
    warm: [
      'Come on. Let us go and find something, the two of us.',
      'I have half a coconut hidden. Do not tell a soul.',
      'Sit down before you fall over. I will sort you out.',
      'Right — I am going out for food and you are coming with me.',
      'You have gone a bit grey. When did you last actually eat?',
      'Take mine. I mean it, take it.',
      'We will fix this. Give me an hour.',
      'You and me on the rocks at low tide. Deal?',
      'You should have said something yesterday.',
      'Nobody on my side of this camp is going hungry while I can walk.'
    ],
    close: [
      'Then we eat together or not at all. That is how this works now.',
      'Take my share. Do not argue, I have already decided.',
      'You do not have to be tough with me. I know exactly how bad it is.',
      'Right. Get up. We are going out and we are not coming back empty.',
      'I have been watching you fade for two days and hoping you would say it.',
      'I will get you food if I have to swim for it.',
      'You are the last person on this island I will let starve.',
      'Say the word and I will go now. Middle of the night, I do not care.',
      'We have both got about one good day left in us. Let us spend it well.',
      'This is the bit we tell people about afterwards. Hold on.'
    ]
  },

  /* ---------- player says "I am exhausted" ---------- */
  replyTired: {
    cold: [
      'Then sleep. Nobody is stopping you.',
      'Everyone is tired. It is not a personality.',
      'That is a strange thing to bring to me.',
      'Being tired is not an alliance pitch.',
      'You look it, if that helps.',
      'Maybe do less talking.',
      'Yes, well.',
      'Take a nap. Watch who notices.',
      'You are not going to get anything from me by being pitiful.',
      'Not my problem, that.'
    ],
    wary: [
      'Nobody sleeps out here. Not properly.',
      'It is the ground. It is always the ground.',
      'Go and lie down for twenty minutes. It is worth more than you think.',
      'I have stopped counting the hours. It helps.',
      'You should sleep before the challenge, not after.',
      'Yeah. My back has been a disaster since night two.',
      'Careful. Tired people make loud mistakes out here.',
      'Everybody hits a wall around now.',
      'Try the far side of the shelter. It is drier.',
      'Sleep when you can. There is not a lot else to protect.'
    ],
    warm: [
      'Go and lie down. I will keep an eye on things.',
      'You have been carrying too much. Sleep, properly.',
      'I will wake you before anything happens. Go.',
      'Sit. Lean on me if you want. Nobody is looking.',
      'I have got the fire tonight. You are off duty.',
      'You are no use to me half dead. Go and sleep.',
      'Twenty minutes. I will guard the spot.',
      'Honestly, you look terrible. Kindly meant.',
      'Rest. The island will still be awful when you wake up.',
      'I will handle camp. Go.'
    ],
    close: [
      'Sleep. I will sit here so nobody comes near you.',
      'You have been running on nothing for me. Go and stop.',
      'I will do your jobs today and I do not want to hear about it.',
      'Lie down. I will wake you if anyone so much as says your name.',
      'You do not have to be the strong one with me. Sleep.',
      'I have got you. Genuinely — go.',
      'Rest properly and let me worry for both of us today.',
      'You are running yourself into the ground and I am not watching it happen.',
      'One of us has to be sharp tonight and today it is me. Go to sleep.',
      'Whatever you need. Always.'
    ]
  },

  /* ---------- player asks what they make of the camp ---------- */
  campRead: {
    grafter: [
      'Half this tribe would starve in a week without three of us. You can guess which three.',
      'I do not mind the work. I mind the ones who watch me do it.',
      'You want the honest answer? {tn} does nothing and everyone has noticed.',
      'The camp is fine. The people are the problem.',
      'I keep a list. Not a strategic one — a personal one.',
      'Ask me who I would sit next to at the end and it will be whoever fetched wood.',
      'I have stopped asking for help. It is quicker.',
      'Work tells you everything about a person out here. Everything.'
    ],
    mid: [
      'It is holding together. Just about.',
      'Some pull, some do not. Same as anywhere.',
      'I do my bit. I am not going to be a martyr about it.',
      'Camp is the least of my worries, if I am honest.',
      'It gets done eventually. Usually by the same people.',
      'I notice, I just do not say much.',
      'There are worse camps. There are better ones.',
      'Everyone has an excuse. Some are better than others.'
    ],
    idle: [
      'The camp? It is a beach with a roof. What do you want me to say.',
      'People get very worked up about firewood out here.',
      'I did not come on this show to build a shed.',
      'Somebody always does it. That is the beauty of a group.',
      'I am here to play, not to sweep.',
      'The ones who work hardest go home first. Look it up.',
      'Let them have their little jobs. It keeps them busy.',
      'You are not about to ask me to help, are you.'
    ]
  }
};

/* ---------- picker ----------
   Keeps a short memory so the same line does not come back twice in a row, which
   is what made the old flat pools feel like cardboard. */
const CampLines = {
  _recent: [],
  _remember(s) {
    this._recent.push(s);
    while (this._recent.length > 26) this._recent.shift();
  },
  ethicBand(c) {
    const e = ethicOf(c);
    return e > 0.62 ? 'grafter' : e > 0.34 ? 'mid' : 'idle';
  },
  /* key: pool name. npc: whose voice. opts.band forces a band; otherwise the
     pool's own shape decides whether it bands by ethic or by warmth. */
  pick(key, npc, vars, band) {
    const set = CAMP_VOICE[key];
    if (!set) return '';
    let pool = null;
    if (band && set[band]) pool = set[band];
    else if (set.any) pool = set.any;
    else if (set.grafter) pool = set[this.ethicBand(npc)] || set.mid || set.any;
    else pool = set[Voice.band(npc, GAME.player && GAME.player.name)] || set.wary;
    if (!pool || !pool.length) return '';
    /* Two tries to avoid an immediate repeat, then take what we are given. */
    let s = pick(pool);
    for (let i = 0; i < 3 && this._recent.indexOf(s) >= 0; i++) s = pick(pool);
    this._remember(s);
    if (typeof LineCensus !== 'undefined') LineCensus.note(key + ':' + pool.length, s);
    const v = vars || {};
    for (const k of Object.keys(v)) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), v[k]);
    return s;
  },

  /* Which state pool a castaway should be speaking from, if any. Worst wins. */
  stateOf(c) {
    if (!c || c.isPlayer) return null;
    if (c.morale < 0.30) return 'breaking';
    if (c.hunger > 0.72) return 'hungry';
    if (c.fatigue > 0.74) return 'tired';
    if (c.morale < 0.38 && chance(0.6)) return 'breaking';
    if (c.hunger > 0.60 && chance(0.5)) return 'hungry';
    if (c.fatigue > 0.62 && chance(0.5)) return 'tired';
    return null;
  },
  /* A greeting that carries how they actually are. Returns '' when they are fine,
     so the caller falls back to the ordinary banded greeting. */
  stateGreeting(c) {
    const st = this.stateOf(c);
    if (!st) return '';
    if (!chance(CONFIG.campStateLineChance)) return '';
    const key = st === 'hungry' ? 'stateHungry' : st === 'tired' ? 'stateTired' : 'stateBreaking';
    return this.pick(key, c);
  },

  gossipLine(speaker, about, grumble) {
    const line = this.pick(grumble ? 'gossipGrumble' : 'gossipPraise', speaker, { tn: about.displayName });
    return `${speaker.displayName}: "${line}"`;
  },
  blameLine(who, needId) {
    const job = jobById(needId);
    const speakers = Ledger.pool().filter(c => !c.isPlayer && c !== who && valuesWork(c) > 0.35);
    const sp = speakers.length ? pick(speakers) : null;
    const line = this.pick('blame', sp || who, { tn: who.displayName, need: job ? job.id : needId });
    return sp ? `${sp.displayName}: "${line}"` : line;
  }
};
