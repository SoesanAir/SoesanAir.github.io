/* ============================================================
   VOICE — dialogue that changes with how a castaway actually feels.

   The old pools were flat: one bag of 3-6 lines per action, so the same person
   greeted you identically on day 1 and day 20, and a castaway who loathed you
   sounded like one who would take a vote for you.

   Here every action is banded by a FEELING, and each band holds many lines:

     cold   they do not trust you / do not like the subject
     wary   guarded, not hostile
     warm   friendly, cooperative
     close  they are genuinely with you

   Which relationship the band reads depends on the action. Talking ABOUT someone
   reads the speaker's feeling toward that person; talking TO them reads their
   feeling toward the player. Voice.line() resolves it and falls back to the old
   pool if a band is missing, so nothing can end up with no line at all.
   ============================================================ */

/* Blended warmth -> band. Trust leads, affection still counts. */
function feelingBand(npc, towardName) {
  if (!npc || !towardName) return 'wary';
  const w = npc.getTrust(towardName) * 0.55 + npc.getRel(towardName) * 0.45;
  return w < 0.30 ? 'cold' : w < 0.45 ? 'wary' : w < 0.62 ? 'warm' : 'close';
}

const Voice = {
  /* action: key into VOICE. toward: name whose band to read (default: player).
     vars: {tn: '...'} substitutions. fallback: array to use if nothing matches. */
  line(action, npc, opts) {
    const o = opts || {};
    const set = VOICE[action];
    let pool = null;
    if (set) {
      const forced = !!o.band;
      const band = o.band || feelingBand(npc, o.toward || (GAME.player && GAME.player.name));
      pool = set[band] || set.any || null;
      /* Occasionally borrow the neighbouring band so wording cannot be used to
         read the exact numbers off a castaway. Skipped when a band is requested
         explicitly, so callers (and tests) get precisely what they asked for. */
      if (!forced && pool && chance(0.12)) {
        const order = ['cold', 'wary', 'warm', 'close'];
        const i = order.indexOf(band);
        const nb = i >= 0 ? set[order[i + (chance(0.5) ? 1 : -1)]] : null;
        if (nb && nb.length) pool = nb;
      }
    }
    if (!pool || !pool.length) pool = o.fallback || null;
    if (!pool || !pool.length) return '';
    let s = pick(pool);
    /* Census before substitution, so "{tn} worries me" counts as one line rather
       than one per castaway it was said about. Repetition is the complaint this
       project gets most often and it cannot be seen from inside a playthrough. */
    if (typeof LineCensus !== 'undefined') LineCensus.note(action + ':' + (pool.length), s);
    const vars = o.vars || {};
    for (const k of Object.keys(vars)) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
    return s;
  },
  band: feelingBand
};

const VOICE = {
  /* ---------- Greeting: seen at the start of every single conversation ---------- */
  greet: {
    cold: [
      'What.',
      'Make it quick.',
      'You again.',
      'I was actually enjoying the quiet.',
      'If this is another pitch, save it.',
      'Say what you came to say.',
      'I have nothing for you today.',
      'Do we have to do this?',
      'You always show up when you need something.',
      'I am listening. Barely.'
    ],
    wary: [
      'Hey. What is up?',
      'Something on your mind?',
      'You have that look. Go on.',
      'Alright. I am here.',
      'Careful — people are watching.',
      'Quick, before someone wanders over.',
      'What is it this time?',
      'I have a minute. Maybe two.',
      'Sit, but do not get comfortable.',
      'Talk. I am curious what this is.'
    ],
    warm: [
      'Hey you. Sit down.',
      'Good, I wanted to find you anyway.',
      'You have perfect timing.',
      'I was hoping you would come over.',
      'Tell me something good.',
      'Sit. Take the weight off.',
      'You look like you are thinking too hard.',
      'What is going on in that head?',
      'Come on then. Out with it.',
      'Sit down before someone thinks we are strategising.'
    ],
    close: [
      'There you are. I was starting to worry.',
      'Whatever it is, I am in. Ask me anyway.',
      'You do not have to warm me up. Just talk.',
      'Good. I trust almost nobody out here and you are on the short list.',
      'Say it plainly. We are past the dancing.',
      'Sit with me. This island is easier with you around.',
      'I saved you a spot.',
      'You and me. What are we doing today?',
      'Talk to me. Properly.',
      'Anything. Genuinely, anything.'
    ]
  },

  /* ---------- Bond: "Get to know them" ---------- */
  bond: {
    cold: [
      'We are not doing the friendship thing. Sorry.',
      'You do not actually want to know me. You want a number.',
      'I keep my life out of this game.',
      'Ask someone who cares to be asked.',
      'That is a strange question from you.',
      'I have told people things before. It cost me.',
      'Let us just say I have reasons to be quiet.',
      'You are trying very hard. I notice that.',
      'Some other time. Or not.',
      'I would rather talk about anything else.'
    ],
    wary: [
      'Not much to tell. Not yet.',
      'I will trade you one thing. One.',
      'Hm. Nobody has asked me that out here.',
      'I am still deciding how much of me this island gets.',
      'Small stuff only. I am not opening the whole book.',
      'You first, actually. Then maybe.',
      'That is more personal than I expected.',
      'I can do surface. Surface is fine.',
      'Careful. Ask enough of those and I start trusting you.',
      'One honest answer, then I want one back.'
    ],
    warm: [
      'You know what, yeah. Let me tell you about that.',
      'Nobody here has bothered to ask. Thank you.',
      'It is nice to be a person for a minute instead of a vote.',
      'I could talk about home all night. Stop me.',
      'That is the first normal conversation I have had in days.',
      'I like that you asked instead of angling.',
      'Funny — I was thinking about exactly that this morning.',
      'Alright. But this stays off the beach.',
      'Here is something true about me.',
      'You are easier to talk to than you should be.'
    ],
    close: [
      'You already know most of it. Here is the rest.',
      'I have not said this out loud since I got here.',
      'If I do not tell you, who am I telling?',
      'This is the part I do not give people.',
      'You are the reason I am still holding it together, honestly.',
      'When this is over, come and meet my family.',
      'I will tell you the ugly version. You have earned it.',
      'It helps, saying it to you.',
      'Do not let me cry in front of these people.',
      'Whatever happens at that fire, I am glad I met you.'
    ]
  },

  /* ---------- Spend time together ---------- */
  stt: {
    cold: [
      'That was... time. That we spent.',
      'Are we done?',
      'Do not read anything into this.',
      'I have things to do. Most of them are not this.',
      'You can stop trying now.',
      'Well. That happened.',
      'I am no warmer to you than I was an hour ago.',
      'Fine. It was not terrible.',
      'Next time bring a reason.',
      'You are persistent. I will give you persistent.'
    ],
    wary: [
      'That was not bad, actually.',
      'Alright. That was alright.',
      'Huh. I did not hate that.',
      'We should do that again. Probably.',
      'You are less annoying than I assumed.',
      'That killed an hour nicely.',
      'I am revising my opinion of you. Slightly.',
      'Do not tell anyone I enjoyed that.',
      'You are growing on me. Do not push it.',
      'Same time tomorrow? Maybe.'
    ],
    warm: [
      'That was... really nice, actually.',
      'Same time tomorrow. I mean it.',
      'This island is two percent less terrible with you around.',
      'I needed that more than I knew.',
      'You are good company. That is rare here.',
      'I forgot I was starving for a minute.',
      'Best hour I have had all week.',
      'We should do this before every tribal.',
      'You make this place survivable.',
      'I laughed. Out loud. Out here.'
    ],
    close: [
      'I would do this game twice if you were in it both times.',
      'You are my favourite thing about this whole experience.',
      'If it comes down to us two, I will still be glad.',
      'This is the part I will remember. Not the fire.',
      'I am not going to write your name. I want you to know that.',
      'You feel like home and we are on a beach with no walls.',
      'Whatever they do to us, they cannot take this.',
      'I trust you. Fully. That is terrifying out here.',
      'Do not go anywhere. I mean that literally.',
      'We are going to the end together or not at all.'
    ]
  },

  /* ---------- "What are you hearing?" ---------- */
  hearing: {
    cold: [
      'Plenty. None of it for you.',
      'I hear a lot. I repeat none of it.',
      'Ask the people you actually talk to.',
      'Why would I hand you that for free?',
      'Nothing I would tell you.',
      'You are fishing. Badly.',
      'The beach is quiet. For you, anyway.',
      'I am not your informant.',
      'Funny, people ask me about YOU.',
      'Try someone who owes you something.'
    ],
    wary: [
      'Bits. Nothing solid.',
      'There is noise. I am not sure what is under it.',
      'Something is moving. That is all I will say.',
      'I hear names. I am not saying whose.',
      'Ask me again when I know more.',
      'People are talking. People always are.',
      'I would rather listen than repeat right now.',
      'Give me a day and I might have something.',
      'You are not the only one asking me that.',
      'Careful who you ask that in front of.'
    ],
    warm: [
      'Actually, yes. There is something you should know.',
      'I have been meaning to tell you this.',
      'Keep this between us.',
      'You did not hear it from me, but —',
      'I picked something up this morning.',
      'There is a name going round. Sit down.',
      'You should be paying attention to this.',
      'I would want to know, so I am telling you.',
      'Someone has been busy. Let me explain.',
      'This is the part where you owe me one.'
    ],
    close: [
      'Everything I know, you know. Here it is.',
      'I have been holding this until I found you.',
      'Do not react when I say this name.',
      'Listen carefully, because I am only saying it once.',
      'You need to move today. Not tomorrow.',
      'I have been watching for you as much as for me.',
      'If I am wrong about this, I am wrong loudly. But I am not wrong.',
      'They are talking and they are talking about you.',
      'I will say it plainly because I owe you plain.',
      'This is the whole picture as far as I can see it.'
    ]
  },

  /* ---------- Opinion of a third party, by how the speaker feels about THEM ---------- */
  thinkOfSubject: {
    cold: [
      '{tn}? I have no time for {tn}.',
      'Do not get me started on {tn}.',
      '{tn} is a problem. Someone should solve it.',
      'I would not lose sleep if {tn} went home tonight.',
      '{tn} talks a great deal and says nothing.',
      'There is something off about {tn}. I cannot prove it.',
      'I have watched {tn} lie to three people today.',
      '{tn} is playing everyone and doing it badly.',
      'Honestly? {tn} makes my skin crawl.',
      'Put {tn} on a boat and I will wave.'
    ],
    wary: [
      '{tn} is hard to read.',
      'I have not decided about {tn} yet.',
      '{tn} keeps to themselves. That could be anything.',
      'Ask me about {tn} next week.',
      '{tn} has not given me a reason either way.',
      'I keep {tn} at arm’s length. Habit.',
      '{tn} is smarter than they let on.',
      'I do not dislike {tn}. I do not rely on {tn} either.',
      'Quiet ones like {tn} worry me more than the loud ones.',
      '{tn} is a maybe. I have a lot of maybes.'
    ],
    warm: [
      '{tn}? Solid. Genuinely.',
      'I like {tn}. Do not tell them.',
      '{tn} has been good to me out here.',
      'You could do worse than {tn}.',
      '{tn} does the work and does not brag about it.',
      'I would sit next to {tn} at the end, honestly.',
      '{tn} is one of the few people here I would call decent.',
      'Say what you like about {tn}, they are consistent.',
      'I have got no complaints about {tn}.',
      '{tn} carried me through a rough night. I remember that.'
    ],
    close: [
      '{tn} is family. That is where I am on it.',
      'I would take a vote for {tn} and not think twice.',
      'Careful. {tn} is not someone I will help you move against.',
      '{tn} and I have been through things you did not see.',
      'If {tn} goes, I stop caring who wins.',
      'You are asking the wrong person to be objective about {tn}.',
      '{tn} kept me in this game. That is not nothing.',
      'Whatever {tn} told you, believe it.',
      'I would put my game in {tn}’s hands right now.',
      '{tn} is the reason I am still standing.'
    ]
  },

  /* ---------- Pushing a name, by how the listener feels about the target ---------- */
  pushYes: {
    cold: [
      '{tn}. Finally. Yes.',
      'You are preaching to the converted on {tn}.',
      'I have wanted {tn} gone since the first night.',
      'Say the word and {tn} is written.',
      'Oh, {tn}. Gladly.',
      'I was about to come to you with the same name.',
      'Good. I am tired of pretending to like {tn}.',
      'Consider that vote already cast.',
      'You had me before you finished the sentence.',
      'It would be a pleasure.'
    ],
    wary: [
      '{tn}, huh. I could be talked into that.',
      'I have no loyalty to {tn}. Go on.',
      'Give me one more reason and I am there.',
      '{tn} is as good a name as any.',
      'Alright. I am not against it.',
      'I do not owe {tn} anything, so.',
      'You may have a point about {tn}.',
      'I will keep {tn} in mind. Seriously.',
      'That is not the name I expected, but fine.',
      'Convince one more person and it happens.'
    ],
    warm: [
      '{tn}? That is a hard ask. But I hear you.',
      'I like {tn}, but I like staying here more.',
      'You are making me choose. I hate that.',
      'If it has to be someone, I suppose it has to be someone.',
      'Do not make me look {tn} in the eye afterwards.',
      'That will sit badly with me. I will still consider it.',
      'This game is disgusting sometimes.',
      'Alright. But I want it to be quick.',
      'I will not enjoy it. That is not the same as no.',
      'You had better be right about this.'
    ],
    close: [
      'You are asking me to write {tn}? Think about that.',
      'No. Not {tn}. Ask me for anyone else.',
      '{tn} is the one person I will not do that to.',
      'I am going to pretend you did not say that name.',
      'That is a line, and you just walked up to it.',
      'You clearly do not know what {tn} means to me.',
      'Try again with a different name and we are still friends.',
      'I would sooner write yours, honestly.',
      'Do not ask me twice about {tn}.',
      'You just told me a lot about yourself.'
    ]
  },
  pushNo: {
    cold: [
      'No. And I do not need to explain myself to you.',
      'You do not get to point me at people.',
      'Ask someone who takes orders.',
      'That is a no, and it will stay a no.',
      'I make my own list.',
      'Interesting that you came to me with that.',
      'You have shown me exactly what you are doing.',
      'Save your breath.',
      'I will remember you asked.',
      'Not a chance.'
    ],
    wary: [
      'I am not there yet.',
      'Maybe. Not on your word alone.',
      'Bring me something real and ask again.',
      'That is a lot to take on faith.',
      'I need more than a name.',
      'Not tonight.',
      'You are moving faster than I am.',
      'I will think about it. That is honest.',
      'Ask me when the numbers are clearer.',
      'I do not vote on vibes.'
    ],
    warm: [
      'I would help you with almost anything else.',
      'Not {tn}. Anyone but {tn}.',
      'You are putting me in a bad spot and you know it.',
      'I cannot do that one. I am sorry.',
      'Please do not make this the thing we fall out over.',
      'Ask me again if it becomes the only way.',
      'I will not fight you on it. I just will not do it.',
      'That name costs me too much.',
      'Find another route and I am with you.',
      'I want to say yes. I am saying no.'
    ],
    close: [
      'Absolutely not, and I think you knew that.',
      'You are asking me to burn the person who kept me here.',
      'That is the one name that ends this conversation.',
      'I am going to forget you said it. Once.',
      'No. And do not come back to it.',
      'You just spent something asking me that.',
      'If you move on {tn}, you move without me.',
      'I would rather go home myself.',
      'Never.',
      'Ask me anything else. Truly, anything.'
    ]
  },

  /* ---------- Vouching for someone ---------- */
  defend: {
    cold: [
      'You are defending {tn}? To me?',
      'Waste of breath. I know what {tn} is.',
      'One kind word does not undo what {tn} did.',
      'If {tn} sent you, that is worse.',
      'I hear you. I do not believe you.',
      'You are very loyal to the wrong people.',
      'Say what you like. {tn} is still {tn}.',
      'That changes nothing.',
      'Noted, and dismissed.',
      'You are wasting a conversation on {tn}.'
    ],
    wary: [
      'Maybe I have been unfair to {tn}.',
      'Hm. That is not the {tn} I have seen.',
      'I will look again. That is all I will promise.',
      'You clearly see something in {tn}.',
      'Alright. {tn} gets the benefit of the doubt. Once.',
      'That is worth knowing, actually.',
      'People keep saying that about {tn}.',
      'I will stop assuming the worst. For now.',
      'You have moved me a little. Congratulations.',
      'Fine. {tn} is off my list. Provisionally.'
    ],
    warm: [
      'You are right. {tn} deserves better than what this beach says.',
      'Good. I like hearing someone stand up for {tn}.',
      'That matches what I have seen. Thank you.',
      'I have been meaning to give {tn} more credit.',
      'We should look after {tn}, honestly.',
      'You just made me like you more, defending {tn}.',
      'I will tell {tn} you said that. Or I will not. Better.',
      'That is decent of you.',
      'Consider {tn} safe from me.',
      'Two of us saying it makes it true out here.'
    ],
    close: [
      'You do not have to sell me on {tn}. I am already there.',
      'I know. {tn} is the best of us.',
      'It is good that you see it too.',
      'Then we are both in {tn}’s corner. Good.',
      'I would go further than you just did.',
      '{tn} would do the same for you, you know.',
      'That is three of us then. That is a wall.',
      'You are talking to {tn}’s biggest defender.',
      'Say it louder. People need to hear it.',
      'Nothing happens to {tn} while I am here.'
    ]
  },

  /* ---------- Alliance: suggesting you work together ---------- */
  align: {
    cold: [
      'With you? No.',
      'You have not earned that word.',
      'I do not make deals with people I cannot read.',
      'That is very forward of you.',
      'Ask me when I do not flinch at your name.',
      'No. But I appreciate the confidence.',
      'You would sell me by Thursday.',
      'I am going to say no and mean it.',
      'Find someone more trusting.',
      'That is not happening yet. Possibly ever.'
    ],
    wary: [
      'Loose. No promises, no names.',
      'We can talk. That is not the same as an alliance.',
      'Alright — but this is quiet, and it is small.',
      'I will work with you. I am not tying myself to you.',
      'One vote at a time. See how it goes.',
      'Do not tell anyone we had this conversation.',
      'Provisionally. Do not embarrass me.',
      'I am in for now. Now can end.',
      'Prove it once and we can talk properly.',
      'Fine. But if you lie to me, we are done immediately.'
    ],
    warm: [
      'Yes. I was going to ask you.',
      'Good. I would rather be with you than against you.',
      'Us, then. Alright.',
      'I have been hoping you would say that.',
      'That makes my game a lot simpler.',
      'Deal. And I do not say that lightly.',
      'You and me. I like the sound of it.',
      'Finally. I was tired of pretending we were not already.',
      'Consider it done. What do you need?',
      'Yes — and I will hold to it.'
    ],
    close: [
      'We already were. It is nice to say it out loud.',
      'You had that the moment you sat down.',
      'To the end. I mean it.',
      'I am not going to write your name. Ever.',
      'Yes. And if I break that, I deserve to lose.',
      'You are my game now. That is the whole answer.',
      'Say it once more so I can hear it.',
      'There is nobody else I would do this with.',
      'Then whatever happens, happens to both of us.',
      'I would rather lose with you than win with them.'
    ]
  },

  /* ---------- Alliance: promising the next vote ---------- */
  promise: {
    cold: [
      'I am not promising you anything.',
      'My vote is not yours to book.',
      'No. Ask me on the night.',
      'That is a big word from a stranger.',
      'You will find out when everyone does.',
      'I do not make promises I am asked to make.',
      'Try that on someone softer.',
      'Absolutely not.',
      'Cute.',
      'I keep my promises, which is why I do not give them to you.'
    ],
    wary: [
      'One vote. Do not ask again.',
      'This once. Then we reassess.',
      'Alright, but if it goes wrong I never did this.',
      'I will write what you asked. Once.',
      'Consider it a loan, not a gift.',
      'Fine. One night. That is the deal.',
      'I am trusting you further than is sensible.',
      'Do not waste it.',
      'Just this vote. I mean that.',
      'You get one. Spend it well.'
    ],
    warm: [
      'You have my vote. Go on then.',
      'Done. Tell me the name at the fire.',
      'Yes. I will not wobble on it either.',
      'You have it. Now stop worrying.',
      'I will write whatever you need me to.',
      'That is what an alliance is for.',
      'Consider it promised, properly.',
      'Yes, and I will hold the others too if I can.',
      'You do not even have to ask like that.',
      'My vote is yours this round.'
    ],
    close: [
      'My vote was always yours. Say the name.',
      'You never have to ask me that again.',
      'Yes. Every round. Stop checking.',
      'I would write my own name before I crossed you.',
      'You have it, tonight and after.',
      'Whatever you need. I am not being brave, I mean it.',
      'That is not a promise, that is just what happens now.',
      'Tell me at the fire or do not tell me at all. I will follow.',
      'Yes. And if I ever break it, tell everyone what I was.',
      'Done. Go and win this thing.'
    ]
  },

  /* ---------- Being told a real secret ---------- */
  reveal: {
    cold: [
      'Why are you telling ME that?',
      'That is a strange gift to hand someone who does not like you.',
      'Interesting. Filed.',
      'You have just made yourself very useful to me.',
      'I did not need to know that. But I do now.',
      'Bold. Or stupid. I have not decided.',
      'Thank you for the ammunition.',
      'Huh. I will sit with that.',
      'You must want something badly.',
      'That is going to come up again.'
    ],
    wary: [
      'That is a lot to put in my hands.',
      'Alright. I will keep it. Probably.',
      'Why me?',
      'You did not have to say that.',
      'I will not spread it. I will not forget it either.',
      'That is worth something. I know that.',
      'Careful with what you hand out.',
      'You are braver than I thought.',
      'Noted. And I do mean noted.',
      'That buys you a little. Not everything.'
    ],
    warm: [
      'You trusted me with that. I will not waste it.',
      'That stays with me. Genuinely.',
      'Thank you for saying it out loud.',
      'That took something. I know it did.',
      'Nobody else hears that from me.',
      'Alright. Now you have got me.',
      'I will carry that carefully.',
      'You did not have to. That is why it matters.',
      'Consider it buried.',
      'That is the most honest thing anyone has said to me here.'
    ],
    close: [
      'I already suspected. Thank you for saying it anyway.',
      'That dies with me.',
      'You could have told me sooner, you know. I would have understood.',
      'Now I will tell you mine.',
      'We are properly in this together now.',
      'Nothing you tell me leaves this spot. Ever.',
      'I would have done the same. I probably did.',
      'That is trust. Actual trust. Out here.',
      'Whatever comes, that stays ours.',
      'You just made me sure about you.'
    ]
  }
};
