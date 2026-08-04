/* ============================================================
   MAROONING QUESTIONS — the extra pool.

   There were four questions and Peff worked his way through up to six people, so
   with `qs[i % qs.length]` he asked the same thing twice in one opener. The fix is
   both halves of what was asked for: many more questions, and fewer people asked.

   Ten more here, on top of the original four, against two or three NPCs plus the
   player. So a season uses three or four of fourteen, and two seasons running
   will not look the same.

   Every question needs an answer pool for all five archetypes, because any
   castaway can be the one he points at. Nothing here carries positional language
   ("last one", "finally") — the runner adds that only when it is actually true.
   ============================================================ */

'use strict';

const MAROON_QUESTIONS_EXTRA = [
  {
    id: 'weakness',
    peff: '{name} — what is the thing about you that is going to lose you this game?',
    npc: {
      strategist: [
        'I overthink. I will talk myself out of a good move.',
        'I cannot help correcting people. It makes them want me gone.',
        'I am bad at pretending to like anyone.',
        'I will see the right play and do the clever one instead.',
        'My face. It tells everybody everything.',
        'I trust my read more than I should.'
      ],
      social: [
        'I like people too much. I will not want to write the name.',
        'I talk. Constantly. Somebody will get sick of it by day nine.',
        'I am going to make a real friend and it is going to ruin me.',
        'I cannot lie to somebody who is being nice to me.',
        'I need to be liked more than I need to win, probably.',
        'I will hug the person who just voted for me.'
      ],
      physical: [
        'I will win too much and they will take me out for it.',
        'I am no good at sitting still and letting things happen.',
        'I say what I think, immediately, out loud.',
        'Puzzles. Do not put me in front of a puzzle.',
        'I will carry this camp and then be furious nobody noticed.',
        'I am the obvious threat and I know it.'
      ],
      wild: [
        'I get bored. Bored people do stupid things.',
        'I will blow up a perfectly good plan just to see what happens.',
        'My mouth. It has never once helped me.',
        'I cannot leave a quiet day alone.',
        'I will make it personal. I always make it personal.',
        'I am going to be too much for somebody by the first vote.'
      ],
      quiet: [
        'Nobody will remember I am here until they need a number.',
        'I will wait too long to make a move.',
        'I am not going to fight for myself out loud.',
        'I hate being looked at, and this is a show.',
        'I will let somebody else decide and then regret it.',
        'I am too easy to leave until later.'
      ]
    },
    player: [
      { text: 'Nothing. That is the honest answer.', traits: { bold: 1, humble: -0.8, guarded: 0.3 }, think: 'Confident, or arrogant. It depends entirely who is listening.' },
      { text: 'I care what people think of me. Too much.', traits: { honest: 1, humble: 0.7, warm: 0.5, guarded: -0.5 }, think: 'A real answer. The warm ones will hear a friend; the sharks will hear a lever.' },
      { text: 'I will not be able to stop playing hard.', traits: { driven: 1, bold: 0.5, ruthless: 0.4 }, think: 'That is a warning label. Some will respect it, some will note it.' },
      { text: 'Ask my ex-wife, she has a list.', traits: { funny: 1, humble: 0.5, guarded: 0.4 }, think: 'Deflects with a laugh. Nobody learns anything, which may be the point.' }
    ]
  },

  {
    id: 'jury',
    peff: '{name} — thirty-nine days from now, what do you want the jury saying about you?',
    npc: {
      strategist: [
        'That I ran it, and they did not notice until it was over.',
        'That I beat them. They do not have to enjoy saying it.',
        'That every move was mine. I will take the resentment.',
        'I would rather be respected than liked at that table.',
        'That I played, instead of being played.',
        'I want them furious and voting for me anyway.'
      ],
      social: [
        'That I was straight with them, even when I got them out.',
        'That they liked me. Genuinely, that is the goal.',
        'That I never made anybody feel small.',
        'That I was somebody they would have a drink with after.',
        'That I told them the truth about why.',
        'That losing to me was alright.'
      ],
      physical: [
        'That I earned it. Every day of it.',
        'That I never sat down.',
        'That I carried them and did not complain about it.',
        'That I never took an easy round off.',
        'That I fed them. Half of them will forget.',
        'That I did the work nobody wanted.'
      ],
      wild: [
        'That they never had a boring day.',
        'That they still do not know what happened.',
        'That I was the best television they have ever been in.',
        'Anything. As long as it is loud.',
        'That I was worth watching.',
        'That they should have got me out sooner.'
      ],
      quiet: [
        'That I was there the whole time and they missed it.',
        'That I was decent to them. That is enough.',
        'That I did not need to be the loudest to be here at the end.',
        'That I never lied about anything that mattered.',
        'That I surprised them.',
        'That I deserved it, quietly.'
      ]
    },
    player: [
      { text: 'That I outplayed every one of them.', traits: { bold: 1, ruthless: 0.6, humble: -0.6 }, think: 'A statement of intent. Nine people just filed it away.' },
      { text: 'That I never lied to their faces.', traits: { honest: 1, loyal: 0.6, warm: 0.4 }, think: 'A promise you will be held to. Which is the risk and the value.' },
      { text: 'That I was fun to lose to.', traits: { funny: 0.9, warm: 0.7, driven: -0.3 }, think: 'Disarming. Reads as harmless, which cuts both ways.' },
      { text: 'I do not care what they say. I want the cheque.', traits: { ruthless: 1, driven: 0.8, warm: -0.6 }, think: 'Honest and cold. The strategists will nod; nobody else will.' }
    ]
  },

  {
    id: 'lie',
    peff: '{name} — is there a lie you are not willing to tell out here?',
    npc: {
      strategist: [
        'I will not swear on somebody who has died. Everything else is available.',
        'I do not make promises I have already decided to break. I just do not promise.',
        'No. That is what the game is.',
        'I will mislead. I will not swear an oath. There is a difference and it matters.',
        'I have thought about this more than is healthy. Nothing is off the table.',
        'I will not use somebody real. Family stays out of it.'
      ],
      social: [
        'I will not tell somebody I love them to get their vote.',
        'Anything about somebody kids. That is a line.',
        'I could not look someone in the eye and swear it. I would fold.',
        'I will keep a secret badly before I will lie about it.',
        'Nothing cruel. I can live with strategic; I cannot live with cruel.',
        'I am a terrible liar, so the question is a bit academic.'
      ],
      physical: [
        'I will not say I did not do something when I did.',
        'If I write your name I will tell you it was me.',
        'I do not lie about the work. Everything else, maybe.',
        'I will not pretend to be weak. I would rather be a target.',
        'I say what I am doing. It has cost me before.',
        'No oaths. I keep those for outside.'
      ],
      wild: [
        'Absolutely not. Ask me anything and I will make something up right now.',
        'I have already lied twice this morning.',
        'Lines are for people with a plan.',
        'I will lie about the small things for fun and the big ones for money.',
        'The only lie I will not tell is a boring one.',
        'I would sell my own mother for a comfort challenge.'
      ],
      quiet: [
        'I will not lie to somebody who has been straight with me.',
        'I would rather say nothing than say something false.',
        'Not about who I am. The rest is a game.',
        'I do not have the nerve for a big lie, honestly.',
        'I will not swear to anything. Then I have not broken it.',
        'I will lie by keeping quiet. That is about my limit.'
      ]
    },
    player: [
      { text: 'Nothing is off the table. Nothing.', traits: { ruthless: 1, bold: 0.6, honest: 0.4, warm: -0.5 }, think: 'Brutally clear. That is a threat delivered as candour.' },
      { text: 'I will not swear on my family.', traits: { honest: 0.7, warm: 0.6, loyal: 0.6 }, think: 'A line everyone understands. It buys trust and marks the boundary.' },
      { text: 'I will lie. I will just feel awful about it.', traits: { funny: 0.7, humble: 0.6, honest: 0.5 }, think: 'Honest about being a liar, which is oddly reassuring.' },
      { text: 'Ask me again when I am hungry.', traits: { funny: 0.8, guarded: 0.6, ruthless: 0.3 }, think: 'Non-answer, well delivered. Nobody knows anything more than they did.' }
    ]
  },

  {
    id: 'sizeup',
    peff: 'Have a proper look at the other tribe, {name}. What do you see over there?',
    npc: {
      strategist: [
        'Two people who will run that camp and one who will let them.',
        'I see who I would rather face at the end. I am not saying which.',
        'A tribe that does not know yet how much it disagrees.',
        'Numbers. I will learn the names when I need to.',
        'Somebody over there has done this before. I can tell from the standing.',
        'They look organised. That is worse for us.'
      ],
      social: [
        'People I want to meet, honestly.',
        'They look nice. That is a problem.',
        'I see about four people I would get on with. Bad news for me later.',
        'Faces. I am rubbish at strategy on day one.',
        'They are all doing the same nervous smile we are.',
        'I hope they are having as strange a morning as I am.'
      ],
      physical: [
        'Bigger than us. We had better be smarter.',
        'I see two who will pull and the rest who will watch.',
        'I like our chances. I have seen worse.',
        'Someone over there is going to beat me at something. Fine.',
        'They look soft. I could be wrong. I am not usually.',
        'A tribe I would rather compete against than live with.'
      ],
      wild: [
        'Enemies. Obviously. Look at them.',
        'A tribe that has no idea what is coming.',
        'I see about nine people I intend to annoy.',
        'They look boring. Ours is better.',
        'Free advantages, if I am honest.',
        'I already have a favourite and a least favourite.'
      ],
      quiet: [
        'People. Same as us, just further away.',
        'I would not want to guess anything from here.',
        'They look about as frightened as we do.',
        'I will tell you in a fortnight.',
        'Somebody over there is going to matter to me. I do not know who yet.',
        'Not much. It is a long way to be reading faces.'
      ]
    },
    player: [
      { text: 'Nine people I have to beat.', traits: { ruthless: 0.8, driven: 0.7, bold: 0.4 }, think: 'Clean and cold. Your own tribe just heard how you think.' },
      { text: 'Honestly? I am more worried about this side.', traits: { guarded: 0.9, bold: 0.4, warm: -0.4 }, think: 'A shot across your own line-up. Bold, and it will be remembered.' },
      { text: 'People having the same terrifying morning I am.', traits: { warm: 0.9, humble: 0.7, honest: 0.6 }, think: 'Generous. It reads as human, and as no threat at all.' },
      { text: 'Not much from here. I will look properly at the merge.', traits: { guarded: 0.7, driven: 0.5, funny: 0.3 }, think: 'Says you expect to get there. Confident without being loud.' }
    ]
  },

  {
    id: 'giveup',
    peff: '{name} — what did you leave at home to stand on this beach?',
    npc: {
      strategist: [
        'A job that will not be there in six weeks. I did the maths.',
        'Nothing I will not get back.',
        'A very confused set of colleagues.',
        'I planned for this. That is rather the point of me.',
        'Sleep, mostly. I have not slept since I got the call.',
        'Less than the people who will tell you about it at length.'
      ],
      social: [
        'Two kids who think I have gone to work.',
        'My mum cried at the airport. I nearly did not get on the plane.',
        'A wedding. I am missing a wedding for this.',
        'My dog. I know how that sounds.',
        'The people I talk to about everything. That is the hard part.',
        'A whole life that carries on without me for a while.'
      ],
      physical: [
        'A gym, a job, and a routine I love. All of it.',
        'My team. First season I have missed in eleven years.',
        'Not much. I travel light.',
        'A business that will survive if I have hired right.',
        'Everything I know how to do. Which is the point.',
        'My father is ill. He told me to come anyway.'
      ],
      wild: [
        'Nothing worth having. That is why I am here.',
        'A lease I have almost certainly broken.',
        'Whatever it was, it can wait.',
        'I burned it down before I left. Bit dramatic.',
        'A relationship that was going to end anyway.',
        'Honestly? Not a thing. Frightening, is not it.'
      ],
      quiet: [
        'A quiet life I quite liked.',
        'My daughter. She is nine. She thinks this is very funny.',
        'More than I expected to, when it came to it.',
        'A house that will be very still without me in it.',
        'The thing I am best at. I am not that out here.',
        'Nothing I want to talk about on television.'
      ]
    },
    player: [
      { text: 'Two kids who think I have gone to work.', traits: { warm: 1, honest: 0.7, humble: 0.5 }, think: 'The most disarming thing you could have said. It buys real goodwill.' },
      { text: 'Nothing. That is why I can do this.', traits: { ruthless: 0.8, guarded: 0.6, bold: 0.5, warm: -0.4 }, think: 'Reads as free of obligations, which reads as dangerous.' },
      { text: 'A perfectly good sofa and I want it back.', traits: { funny: 1, modest: 0.5, driven: -0.3 }, think: 'Light. Nobody feels threatened by somebody who misses their sofa.' },
      { text: 'More than I want to say standing here.', traits: { guarded: 1, honest: 0.4, humble: 0.4 }, think: 'Holds the line without lying. Some will respect it, some will push.' }
    ]
  },

  {
    id: 'firstout',
    peff: 'Somebody on your tribe goes home first, {name}. What gets them sent?',
    npc: {
      strategist: [
        'Talking. Whoever talks most in the first three days.',
        'Being useless and knowing it. Either is survivable; both is not.',
        'Whoever tries a move before they have the numbers.',
        'The one who cannot stop telling us their plan.',
        'Weakness, if we lose. Threat, if we win.',
        'Whoever makes it about themselves first.'
      ],
      social: [
        'Being unkind. It gets noticed faster than people think.',
        'Whoever cannot get along with anybody. It is always that.',
        'Not helping. Nobody forgives that in week one.',
        'Being cold. You can be useless and warm and survive.',
        'Whoever makes somebody feel bad in front of everyone.',
        'I hope it is nobody. I know that is not how it works.'
      ],
      physical: [
        'Losing us a challenge and then making excuses.',
        'Sitting down. Just sitting down while others work.',
        'Whoever cannot pull their weight and will not admit it.',
        'Being too strong too early, maybe. That happens too.',
        'Whining. I would vote for whining over weakness.',
        'Whoever puts themselves before the camp.'
      ],
      wild: [
        'Being boring. That is a capital offence out here.',
        'Whoever annoys me most, if I get my way.',
        'Bad luck, mostly. Everyone pretends it is strategy.',
        'The first person to say the word alliance out loud.',
        'Whoever is easiest. It is always whoever is easiest.',
        'Me, probably. I am aware.'
      ],
      quiet: [
        'Standing out. Any kind of standing out.',
        'Whoever makes a decision for the group without asking.',
        'Being too keen. It reads as dangerous.',
        'Not much. Sometimes it is nothing at all.',
        'Whoever is on the wrong side of the loudest person.',
        'The one who tries to lead on day two.'
      ]
    },
    player: [
      { text: 'Whoever cannot do the work.', traits: { driven: 0.8, honest: 0.5, ruthless: 0.4 }, think: 'Everybody just checked whether that is them.' },
      { text: 'Whoever plays too hard, too early.', traits: { guarded: 0.8, driven: 0.4, bold: -0.3 }, think: 'A quiet warning to the room, and a signal you are watching.' },
      { text: 'Whoever is unkind. I have no patience for it.', traits: { warm: 1, loyal: 0.6, honest: 0.5 }, think: 'Draws a moral line. The warm ones like it; the sharks note the naivety.' },
      { text: 'Hopefully nobody I have started to like.', traits: { funny: 0.6, warm: 0.7, humble: 0.4 }, think: 'Soft, human, and slightly evasive. Which is fine.' }
    ]
  },

  {
    id: 'onething',
    peff: 'One thing, {name}. What is the one thing you brought that nobody can see?',
    npc: {
      strategist: [
        'Patience. Everybody says they have it and almost nobody does.',
        'A very good memory. It is the only edge that never runs out.',
        'The ability to be quiet while somebody hangs themselves.',
        'I know what I look like to people. Most do not.',
        'A tolerance for being disliked.',
        'I have been thinking about this for eleven years.'
      ],
      social: [
        'I am genuinely interested in people. It is not a tactic.',
        'I can talk to anybody. Anybody.',
        'Warmth. It sounds soft. It is not.',
        'I remember what people tell me about themselves.',
        'I can make a bad day funny. That will matter by day twenty.',
        'People tell me things. I have no idea why.'
      ],
      physical: [
        'I do not stop. That is the whole thing.',
        'I can be cold and wet and still be useful.',
        'I have done harder than this for less money.',
        'Hands that work. You will see.',
        'I do not need to be comfortable to be functional.',
        'Whatever needs doing, I will still be doing it at midnight.'
      ],
      wild: [
        'Absolutely no shame. None.',
        'I do not mind being hated. It is quite freeing.',
        'A willingness to do the thing everybody is thinking about.',
        'I am funnier than everyone here and it will save my life.',
        'Nothing to lose. Best thing you can pack.',
        'A complete inability to leave well alone.'
      ],
      quiet: [
        'I can go a long time without needing anything from anybody.',
        'People underestimate me. I am counting on it.',
        'I notice things. That is most of what I have.',
        'I do not need to win an argument.',
        'I am comfortable being alone. Most people out here are not.',
        'Stubbornness. It does not look like much on day one.'
      ]
    },
    player: [
      { text: 'A memory for exactly who said what.', traits: { guarded: 0.7, driven: 0.6, bold: 0.3 }, think: 'Useful, and a little frightening. People will watch their words.' },
      { text: 'I do not stop. Ever.', traits: { driven: 1, bold: 0.6, modest: -0.3 }, think: 'The grafters heard a partner. The strategists heard a threat.' },
      { text: 'I can make a miserable day bearable.', traits: { funny: 0.8, warm: 0.9, modest: 0.4 }, think: 'By day twenty that is worth more than muscle, and some of them know it.' },
      { text: 'Nothing. I am going to work it out as I go.', traits: { humble: 1, honest: 0.6, guarded: -0.4 }, think: 'Modest to the point of invisible. Which is a strategy.' }
    ]
  },

  {
    id: 'alliance',
    peff: '{name} — do you already know who you want to work with?',
    npc: {
      strategist: [
        'Yes. And I am obviously not going to point.',
        'I have three names. Two of them do not know it yet.',
        'I want whoever nobody else wants. They are loyal and they are cheap.',
        'I will decide after I watch one vote.',
        'Working with people is not the hard part. Choosing is.',
        'I want the second most dangerous person here. Not the first.'
      ],
      social: [
        'I want everybody. That is going to be a problem.',
        'Yes, and I have known for about four minutes.',
        'Whoever talks to me first, honestly.',
        'I do not choose people, I just end up with them.',
        'There are two faces here I already trust and that is stupid of me.',
        'I would rather it happened naturally than be arranged.'
      ],
      physical: [
        'Whoever works. I do not care about anything else.',
        'The people who are still standing at the end of the challenge.',
        'I want one person I can trust and no committee.',
        'Anybody who does not need managing.',
        'Whoever is next to me when it gets hard.',
        'I will know by the end of the first day. It is not complicated.'
      ],
      wild: [
        'No, and I intend to keep it that way as long as possible.',
        'Everyone. Separately. Secretly.',
        'Alliances are just a group of people about to betray each other on camera.',
        'I want whoever is funniest. That is my entire criteria.',
        'I will join every single one of them.',
        'Ask me tonight. It will have changed.'
      ],
      quiet: [
        'I would rather be useful to somebody than pick anybody.',
        'Not yet. That is how people get caught out.',
        'I will go where I am wanted.',
        'Whoever is kind to me on a bad day.',
        'I am not going to be the one who asks.',
        'I have an idea. I am not saying it on day one.'
      ]
    },
    player: [
      { text: 'Yes. And I am not saying who.', traits: { guarded: 0.9, driven: 0.5, bold: 0.4 }, think: 'Everyone now assumes it is somebody else. Which is useful chaos.' },
      { text: 'Whoever does the work. I will find them.', traits: { driven: 0.8, honest: 0.6, warm: 0.3 }, think: 'The grafters just marked you as one of theirs.' },
      { text: 'No. I am going to earn it, not arrange it.', traits: { honest: 0.8, humble: 0.6, guarded: -0.3 }, think: 'Reads as principled. Also reads as unattached, which is an invitation.' },
      { text: 'All of you. Individually. Quietly.', traits: { funny: 0.9, ruthless: 0.5, guarded: 0.4 }, think: 'A joke that is also the plan. Half of them laughed; half of them wrote it down.' }
    ]
  },

  {
    id: 'hardday',
    peff: '{name} — day fifteen, cold, wet, no food. What are you like?',
    npc: {
      strategist: [
        'Quiet. I get very quiet and very accurate.',
        'The same as day one. That is the point of not showing anybody anything.',
        'Worse company. Better player.',
        'I will still be counting. It is the last thing to go.',
        'Short. I get short with people. I know it and I cannot fix it.',
        'Fine, as long as nobody talks to me before noon.'
      ],
      social: [
        'Still talking. Possibly more. Sorry in advance.',
        'I will be the one making everybody laugh about how awful it is.',
        'Weepy, and then fine, and then weepy.',
        'I need people on a bad day. I will be everywhere.',
        'Better, actually. I am good in a bad situation.',
        'Loud. I get loud when I am frightened.'
      ],
      physical: [
        'Working. It is the only thing that helps.',
        'Hungry and useful. Same as any other day.',
        'I have been colder and wetter for worse reasons.',
        'I do not really change. That is my whole thing.',
        'Slower. Still going.',
        'Building something. I cannot sit in it.'
      ],
      wild: [
        'Dangerous. Genuinely, do not talk to me on day fifteen.',
        'Hilarious, or a nightmare. It is a coin toss.',
        'That is when I do something everybody remembers.',
        'Feral. In a fun way. Mostly.',
        'Honest. Horribly, unstoppably honest.',
        'Whatever I am, it will be on the show.'
      ],
      quiet: [
        'Still here. That is all I can promise.',
        'Very small. I go quite small when it is bad.',
        'I will be alright. I am used to being uncomfortable.',
        'You will not notice a difference. I hope.',
        'Cold and unbothered. It is a knack.',
        'I will be the one who has not complained yet.'
      ]
    },
    player: [
      { text: 'Working. It is the only thing that helps.', traits: { driven: 0.9, warm: 0.4, honest: 0.5 }, think: 'The camp providers just heard exactly what they wanted to.' },
      { text: 'Exactly the same. I do not change.', traits: { guarded: 0.8, bold: 0.5, modest: -0.3 }, think: 'A claim you will be measured against for a fortnight.' },
      { text: 'Unbearable, probably. I will apologise now.', traits: { funny: 0.9, humble: 0.8, honest: 0.6 }, think: 'Pre-emptive honesty. It makes the bad day easier to forgive.' },
      { text: 'You will not know. That is the point.', traits: { guarded: 1, ruthless: 0.4, warm: -0.3 }, think: 'Controlled. The readers of people just noted that you plan to hide.' }
    ]
  },

  {
    id: 'why2',
    peff: 'Money, or the thing you want to prove, {name}? Pick one.',
    npc: {
      strategist: [
        'Prove it. The money is how you keep score.',
        'Money. I am not going to dress it up on day one.',
        'Both, and anybody who says otherwise is lying to a camera.',
        'I want to be right. Publicly, and at length.',
        'Prove it. I have been told I could not for a very long time.',
        'The money changes nothing. The winning changes everything.'
      ],
      social: [
        'Prove it. To my kids, mostly.',
        'The money would change our lives. So, money.',
        'Neither, really. I wanted the adventure.',
        'Prove that somebody nice can win this.',
        'Money. There is a roof involved.',
        'I want to prove I am braver than I look.'
      ],
      physical: [
        'Prove it. I have got nothing to prove to you, but plenty to me.',
        'The money. I am not complicated.',
        'I want to know if I am as tough as I think.',
        'Both. But if you made me choose, the proving.',
        'Money. I have got people depending on it.',
        'To prove the last twenty years were not wasted.'
      ],
      wild: [
        'Neither. I am here for the experience of being awful on television.',
        'Money. Obviously money. What is wrong with you.',
        'Prove that somebody like me can get away with it.',
        'I want a story. The cheque is a bonus.',
        'Whichever answer annoys the most people.',
        'Both, and I want it to be messy.'
      ],
      quiet: [
        'Prove it. Quietly, to one person who is not here.',
        'Money. It would mean quite a lot.',
        'I want to know I can do something hard on my own.',
        'Neither sounds right when you say it out loud.',
        'To prove I do not need to be loud to matter.',
        'The money, and I am not embarrassed about it.'
      ]
    },
    player: [
      { text: 'The money. I will not pretend otherwise.', traits: { honest: 0.9, ruthless: 0.5, driven: 0.6 }, think: 'Refreshingly blunt. The strategists respect it more than a nice answer.' },
      { text: 'To prove something. To one person.', traits: { driven: 0.8, warm: 0.6, humble: 0.5 }, think: 'Specific and human. It lands with the ones who came for the same reason.' },
      { text: 'Both, and anyone saying otherwise is lying.', traits: { bold: 0.8, honest: 0.7, funny: 0.4 }, think: 'Calls the room out. Some enjoyed that; some did not.' },
      { text: 'Neither. I wanted to see the island.', traits: { modest: 0.9, funny: 0.5, driven: -0.6 }, think: 'Reads as no threat whatsoever. That is either a gift or a problem.' }
    ]
  }
];
