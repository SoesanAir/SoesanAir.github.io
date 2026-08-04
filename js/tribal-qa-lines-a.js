/* ============================================================
   TRIBAL Q&A — the challenge topics.

   Six things Peff can open with that came out of the challenge itself. This is the
   safest ground he has: he ran the event, he watched it, so nothing here risks
   telling the bench something they did not already see. Which is exactly why the
   show opens here most nights and works round to the dangerous questions later.

   See docs/tribal-qa.md for the contract. Two rules worth restating because they
   are the ones that make these read like people instead of a script:

   NO BRACKETS. Not one. A line that needs "(quietly)" to land is a line that has
   not been written yet.

   EVERY ANSWER CARRIES SOMETHING THE QUESTION DID NOT. A fact, an image, or a
   position. "It was rough out there" is not an answer, it is a noise a person
   makes. "I had the knot in my hands and I dropped it" is an answer.

   On {who}: it is always the person speaking or being spoken to. For wonImmunity,
   weakLink and carried that is the named castaway. For lostAgain, blowout and
   closeCall the bench as a whole is on the hook and the engine picks who answers,
   so {who} is whoever that turned out to be — which is why the answers in those
   three are written in the first person and leave {who} to Peff.
   ============================================================ */

'use strict';

const TRIBAL_TOPICS_A = [

  /* ---------------------------------------------------------------
     LOST AGAIN — {n} in a row. The question everybody has been dreading
     on the walk in, and the one that starts fights, because a streak forces
     the tribe to explain itself rather than blame one bad day.
     --------------------------------------------------------------- */
  {
    id: 'lostAgain',
    ask: [
      'That is {n} in a row now. {who}, at what point does a run like that stop being bad luck?',
      '{n} straight losses. {who}, is this tribe unlucky or is this tribe just worse?',
      '{who}, you have walked up that hill and lost {n} times. What is actually going wrong?',
      'Nobody here has won in {n} tries. {who}, what does that do to a camp?',
      '{who}, {n} losses. Is anybody saying the hard thing out loud back at camp, or is everyone being polite?',
      'I have watched this tribe lose {n} times now. {who}, what changes tomorrow?'
    ],
    answers: {
      own: [
        'It is us. There is no gremlin in the mat. We are getting beaten by people doing it better.',
        'I have been on the losing end of every one of them, so I am not about to point anywhere but here.',
        'We keep losing the same way. Same spot, same panic, same result. That is on all of us to fix.',
        'Three days ago I said we would fix the caller problem. We did not fix the caller problem.',
        'I can tell you exactly where we lost all of them. It is the same forty seconds every time.'
      ],
      deflect: [
        'We have been running on half a coconut a day. At some point the body stops arguing with you.',
        'The gap is not as wide as the scoreboard says. We lose the end, not the middle.',
        'We are a young tribe at this. They have found their rhythm and we are still learning ours.',
        'Nobody out there is quitting. That is not the problem we have.',
        'We have not been beaten by better people. We have been beaten by a better plan.'
      ],
      blame: [
        'We keep putting the same person in the same spot and it keeps going the same way.',
        'There is somebody here who calls every challenge and has not been right once.',
        'You want honest? Two people carry it and the rest of us are ballast, and I am tired of pretending otherwise.',
        'I have asked to swap positions twice. Both times I got told to stay where I was.',
        'When it matters, some people are shouting and nobody is listening. That is a choice somebody made.'
      ],
      defiant: [
        'Ask me after the next one. I am not doing an autopsy on a body that is still walking.',
        'We lost. You were there. I do not know what you want me to add to that.',
        'You keep saying {n} like it is a verdict. It is a number.',
        'I have not lost anything yet. I am sat right here.',
        'If you are waiting for somebody to fall apart at this council, it will not be me.'
      ],
      wry: [
        'We have got very good at the walk back. Best in the game at the walk back.',
        'At this point I know the way to this beach better than the way to camp.',
        'I have started to think the mat is where we live and the challenge is the commute.',
        'We are undefeated at showing up. It is the other part.',
        'Give us a challenge where you lose on purpose and we will finally have a dynasty.'
      ],
      bleak: [
        'It is {n} because we are hungry and slow and the other tribe is not. That is the whole answer.',
        'Every loss costs us a person, and every person we lose makes the next one easier to lose.',
        'We are eating less than them and sleeping worse than them, and it shows in the last minute of every one.',
        'The truth is we are not going to win one. We are going to keep coming here until there is nobody left.',
        'There are five of us and there should be eight. You cannot out-work a hole that big.'
      ]
    },
    push: [
      'That is a diagnosis. Is anybody doing anything about it?',
      'So who at this camp is going to say that to the person it is about?',
      'You have all just agreed with each other. Somebody here must disagree.',
      'Then tonight is not about the challenge at all, is it.',
      'Does everybody see it the way you just described it?'
    ],
    chime: {
      own: [
        'He is right and I am the spot he is talking about. I know I am.',
        'I would like the record to show I have not won one either.',
        'Everything he just said, we said at camp. Nobody argued then.'
      ],
      blame: [
        'That is a very generous way of saying it and I am not going to be that generous.',
        'He says all of us. It is not all of us and everybody sat here knows the number.',
        'Funny how the person who calls it is the person explaining why we lost it.'
      ],
      wry: [
        'I want to say something helpful and I have got absolutely nothing.',
        'We could try winning. Just as an experiment.',
        'I have heard this speech three times. It is getting shorter.'
      ]
    },
    playerOpts: {
      own: 'It is on all of us, me included',
      blame: 'Name the problem',
      defiant: 'Refuse the premise',
      wry: 'Make a joke of it'
    }
  },

  /* ---------------------------------------------------------------
     BLOWOUT — beaten badly at {chal}. Different scene from a near miss.
     A hammering does not let anybody say "we were nearly there", so the
     bench either owns it or turns on somebody.
     --------------------------------------------------------------- */
  {
    id: 'blowout',
    ask: [
      '{who}, that was not close. What happened out there at {chal}?',
      'I have seen tribes lose {chal}. I have not seen one lose it like that. {who}?',
      '{who}, you were beaten before the halfway point. Did you know it at the time?',
      'That was a hammering. {who}, when did you realise it was gone?',
      '{who}, nobody could look at {chal} and call it unlucky. So what was it?',
      'They finished and you were still working. {who}, talk to me about that walk.'
    ],
    answers: {
      own: [
        'We were beaten badly and I would rather say that than dress it up.',
        'I knew at the first turn. I could hear them ahead of us and it never got closer.',
        'That is the worst I have been at anything in my life and I am not going to pretend otherwise.',
        'We had no plan for {chal} and it showed inside a minute.',
        'I stopped being useful about a third of the way in. I felt it go.'
      ],
      deflect: [
        'They are built for {chal} and we are not. Some days the draw beats you.',
        'You saw the same thing I did. There is not a lot to unpack.',
        'It was over early, so the rest of it was just finishing politely.',
        'We will not see {chal} again. I am more worried about the next one.',
        'A bad day at the wrong challenge looks exactly like this.'
      ],
      blame: [
        'We were told how to run it by somebody who had clearly never run anything.',
        'Two of us were doing it properly. I will let you work out the rest.',
        'I said put me at the front. I got put at the back and you saw the back.',
        'Somebody here gave up out there, and everybody here saw who.',
        'When it fell apart, one person stopped and the rest of us had to carry the gap.'
      ],
      defiant: [
        'It was bad. I am not going to perform being upset about it for you.',
        'You want me to name somebody. I am not naming somebody.',
        'Losing badly and losing narrowly get you to the same beach.',
        'I have had worse days than that one and I am still here.',
        'Say what you want about it. My hands were on the thing the whole time.'
      ],
      wry: [
        'We gave them a very comfortable afternoon. They should send a note.',
        'I would call it a rout, but that implies we were briefly in it.',
        'At one point I considered helping them, for pace.',
        'They had time to have a conversation. About us, probably.',
        'I have never felt so strongly that I was in somebody else highlight reel.'
      ],
      bleak: [
        'We have not eaten properly in four days. That is what {chal} looked like.',
        'There is nothing left in any of us. You are looking at the bottom of it.',
        'That is what a tribe looks like when it stops believing it can win.',
        'I could not lift my arms above my head. That is not effort, that is food.',
        'We are going to keep losing like that, and everybody sat here already knows it.'
      ]
    },
    push: [
      'Does anybody sat here disagree with that?',
      'So who is responsible? Somebody must have a name in their head.',
      'You said we. Is it we, or is that just the polite word tonight?',
      'Then what is different at the next one?',
      'Is that what gets said at camp, or is that the version for me?'
    ],
    chime: {
      own: [
        'I was the back he is talking about. It was me and I know it was me.',
        'We had no plan. I could have made one and I did not.',
        'It was worse from the inside than it looked from where you were stood.'
      ],
      defiant: [
        'I am not sitting here while that gets pinned on one person.',
        'He is being modest. Somebody else should be less modest.',
        'You are asking who quit. Nobody quit. That is a nasty word to put on a hungry person.'
      ],
      bleak: [
        'We have got no fire and no food. This is what that buys you.',
        'The gap is not effort. The gap is calories and everybody knows it.',
        'That was not the worst it will get, is the thing.'
      ]
    },
    playerOpts: {
      own: 'Own how bad it was',
      blame: 'Point at the reason',
      deflect: 'Blame the draw, not a person',
      wry: 'Deflate it'
    }
  },

  /* ---------------------------------------------------------------
     WON IMMUNITY — {who} is safe. Peff asks the safe person about the
     unsafe people, which on the show is where the necklace stops being a
     prize and starts being a spotlight.
     --------------------------------------------------------------- */
  {
    id: 'wonImmunity',
    ask: [
      '{who}, you cannot go home tonight. Does that make this easier or harder to sit through?',
      '{who}, you won {chal} and you are safe. Everybody else here is not. What do you do with that?',
      '{who}, you are the only person at this council with nothing to lose. Where does that leave you?',
      '{who}, does winning {chal} change who you write down, or was that decided before you won it?',
      '{who}, safety is worth something. Has anybody tried to buy it off you tonight?',
      'You are untouchable tonight, {who}. Has anybody looked at you differently since {chal}?'
    ],
    answers: {
      own: [
        'Harder. I have spent the whole walk here doing arithmetic on people I like.',
        'I needed it. I was going home tonight and everybody sat here knows I was.',
        'It changes nothing about my vote. It changes everything about how I sleep.',
        'It is a strange thing to be the only person here who gets to be honest.',
        'I won {chal} and then I sat down and realised the hard part had not started.'
      ],
      deflect: [
        'One night of safety in a game this long does not make me comfortable.',
        'I would rather have the win than not. That is as far as I have thought about it.',
        'It is a necklace. Tomorrow it goes back on the pole and I am like everybody else.',
        'I am not going to sit here and pretend it is a burden.',
        'Everybody keeps asking what it means. It means I am here next week.'
      ],
      blame: [
        'I know why I needed to win it. There were people counting me out days ago.',
        'Two people have been very warm to me since I put this on. They were not warm before.',
        'Somebody here spent yesterday telling people I was the problem. Now they need me.',
        'The people who wanted me gone are the people asking me for a favour tonight.',
        'It is not a coincidence who has been sitting next to me since {chal}.'
      ],
      defiant: [
        'I won it. That is the answer to all of this.',
        'I do not owe anybody at this council an explanation for having it.',
        'You are all welcome to try and take it off me next time.',
        'It does not make me a target. It makes me correct.',
        'I am not going to apologise for being the best at {chal}.'
      ],
      wry: [
        'It is the first thing I have owned in eleven days. I am quite attached.',
        'I have never been so popular. Suspiciously popular.',
        'Everybody has been extremely lovely to me all afternoon. I am not falling for it.',
        'The necklace is heavy and I have never enjoyed anything more.',
        'I would like to make clear I am sleeping with it on.'
      ],
      bleak: [
        'I won a night. That is all it is. There are a lot more of these.',
        'It means somebody else goes home instead of me, and I have to look at them right now.',
        'I am safe and I still feel awful, which nobody warned me about.',
        'Everybody here is deciding something and I have to watch and say nothing.',
        'I got a night off from the worst feeling I have ever had. It comes back tomorrow.'
      ]
    },
    push: [
      'Then somebody here is going home because you won. Have you thought about who?',
      'Does anybody at this council believe that answer?',
      'Has anybody asked you for anything since you won it?',
      'You said your vote was already decided. When?',
      'Is there anybody here you would have given it to?'
    ],
    chime: {
      own: [
        'She earned it and I am not going to be bitter about it out loud.',
        'I tried to take it off her and I was not close.',
        'If anybody here deserved a night off it was her.'
      ],
      blame: [
        'She has been extremely popular since about four o clock. Make of that what you like.',
        'Ask her who came and found her first. Go on.',
        'It is amazing how many friends a necklace makes.'
      ],
      wry: [
        'I have decided to be her best friend, starting immediately.',
        'I would like it noted that I congratulated her before the others did.',
        'She has not put it down once. Not once.'
      ]
    },
    playerOpts: {
      own: 'Admit you needed it',
      blame: 'Say who has gone quiet',
      defiant: 'You won it, no apology',
      wry: 'Enjoy it out loud'
    }
  },

  /* ---------------------------------------------------------------
     WEAK LINK — {who} was visibly worst at {chal}. The cruellest question
     Peff can ask from public information, which is why the reader refuses
     to ask it of somebody who also won immunity.
     --------------------------------------------------------------- */
  {
    id: 'weakLink',
    ask: [
      '{who}, you struggled at {chal} and everybody out there saw it. How worried should you be tonight?',
      '{who}, you were last. Does this tribe hold that against you?',
      '{who}, I watched you at {chal}. Talk to me about what was happening.',
      '{who}, if this tribe votes on performance tonight, you go home. Do you know that?',
      '{who}, you have got a case to make and about a minute to make it. Go.',
      'Everybody here can do the maths on {chal}, {who}. What do you say to them?'
    ],
    answers: {
      own: [
        'I was last. I am not going to insult anybody here by arguing with what they watched.',
        'It was me. I lost it for us at {chal} and I have said that to every person at camp already.',
        'Very worried. I would be writing my name down if I were them.',
        'I have got nothing to say about the challenge. I was bad. I want to be better and I might not be.',
        'I stood there for a long time knowing I could not do it. That is the honest version.'
      ],
      deflect: [
        'One challenge is one challenge. I have hauled every log at that camp for nine days.',
        'I cannot do {chal}. There will be others I can do.',
        'You are looking at the twenty minutes I was bad at. I would point at the rest of the week.',
        'I am not the strongest here and I have never pretended to be.',
        'If this tribe wants a machine it should have marooned a machine.'
      ],
      blame: [
        'I was put in a position nobody asked me if I could do.',
        'I was last, and the person who put me there is sat right here saying nothing.',
        'I asked for a swap twice. Ask them what they said.',
        'I will take my share. I am not taking somebody else share as well.',
        'I was not the only one struggling. I was just the one you could see.'
      ],
      defiant: [
        'Then vote me. I am not going to beg at a fire.',
        'I have heard the number. I do not need it read back to me.',
        'You have decided I am the weak one. That is your word, not mine.',
        'I am still here and some very strong people are not.',
        'Ask this tribe who fetches the water. Then ask them again about {chal}.'
      ],
      wry: [
        'I would like {chal} struck from the record and we all move on.',
        'I have been told I have an unusual technique. That is the kind version.',
        'I peaked during the instructions.',
        'I was excellent right up until we started.',
        'On the plus side, I now know exactly what I am bad at.'
      ],
      bleak: [
        'I have not eaten in two days and I could not hold my own weight. That is what you watched.',
        'I am the oldest person here and this island has taken more from me than from them.',
        'My hands do not work like they did on day one. Nobody wants to hear that but it is true.',
        'I know what I am. I am the person you vote out when there is nothing else wrong.',
        'I could not feel my fingers. I have not been able to feel them since the storm.'
      ]
    },
    push: [
      'Does this tribe agree that one challenge is one challenge?',
      'Somebody here has to answer that. Does the camp work count tonight?',
      'You said you asked for a swap. Who did you ask?',
      'Is there anybody here who would speak up for you?',
      'Then you are asking them to keep somebody who cannot win a challenge. Why would they?'
    ],
    chime: {
      own: [
        'She asked me for the swap and I said no. That is on me, not her.',
        'I put her there. If we are doing honesty, I put her there.',
        'She does more at camp than any two of us. That is just a fact.'
      ],
      deflect: [
        'We do not lose challenges one person at a time. We lose them together.',
        'If we voted on {chal} we would have voted half of us out by now.',
        'She has fed this camp all week. I am not throwing that away over twenty minutes.'
      ],
      blame: [
        'She was last. I am not going to sit here and pretend that does not matter.',
        'We keep protecting people and we keep losing. At some point those are the same sentence.',
        'Everybody loves her. Nobody wants to say the obvious thing.'
      ]
    },
    playerOpts: {
      own: 'Take it fully',
      deflect: 'Point at your camp work',
      blame: 'Say who put you there',
      defiant: 'Refuse to beg'
    }
  },

  /* ---------------------------------------------------------------
     CARRIED — {who} was clearly the best at {chal} and the tribe still
     lost, or won because of them. Either way it makes them visible, and
     visible is dangerous. The show calls this being too good.
     --------------------------------------------------------------- */
  {
    id: 'carried',
    ask: [
      '{who}, you were the best out there at {chal} by a distance. Is that a good thing to be tonight?',
      '{who}, you carried this tribe today. Does anybody thank you for that, or does it just make you a threat?',
      '{who}, everybody watched you do that. How does being the strongest person here play at a vote?',
      '{who}, you were extraordinary at {chal} and you are still sat at this council. How does that feel?',
      '{who}, you keep winning things for people who might write your name down. Where does that end?',
      'I want to ask the room, but I will ask you first, {who}. Is being the best at {chal} worth anything tonight?'
    ],
    answers: {
      own: [
        'I would rather be useful and at risk than safe and useless. Ask me again in a week.',
        'I did what I could do and we still ended up here, so I am not feeling clever about it.',
        'It makes me a threat. I have known that since day two and I keep doing it anyway.',
        'I am not going to hold back to look harmless. That is not why I came.',
        'If they vote me out for being good at this, at least I know what it was for.'
      ],
      deflect: [
        'It was not just me. Two other people did the hard part and nobody is asking them.',
        'I had one good day at one challenge that happened to suit me.',
        'Anybody here could have done my job. I just happened to be stood there.',
        'You are making it a story. It was a rope and I pulled it.',
        'I am not the strongest here. I am the loudest, which is different.'
      ],
      blame: [
        'I did my part. I would very much like somebody to ask about the parts that did not get done.',
        'It is easy to be the best when the bar has been set where it has been set.',
        'I carried it, and somebody sat here spent the afternoon telling people I am dangerous.',
        'I know exactly who benefits from me going home, and so do they.',
        'The people cheering the loudest at the mat went very quiet on the walk back.'
      ],
      defiant: [
        'Good. Let them look at me. I would rather be looked at than ignored.',
        'If being the best at something is a reason to go home, this is a strange game.',
        'I am not going to shrink so somebody feels comfortable.',
        'Write my name down then. I will win the next one too.',
        'Everybody here needs me tomorrow. That is not arrogance, it is arithmetic.'
      ],
      wry: [
        'Apparently the reward for winning is a nice long think about your own mortality.',
        'I have been told I am a threat about six times today, always very warmly.',
        'It turns out you can be too good at pulling a rope. Who knew.',
        'I would like to be slightly worse at things, going forward.',
        'Next time I will fall over halfway and see if anybody likes me more.'
      ],
      bleak: [
        'I gave everything I had and we are still sat at this fire. That is the part that gets me.',
        'It buys me nothing. Everybody here is nice to me and somebody is still writing my name.',
        'I am doing the work of two people on the food of half of one.',
        'Being needed and being safe are not the same thing, and I found that out the hard way.',
        'There is a version of tonight where I win everything today and go home anyway.'
      ]
    },
    push: [
      'Does anybody here disagree that they carried it?',
      'So is being strong a reason to keep somebody, or a reason to get rid of them?',
      'Has anybody at this camp told you you are a threat to your face?',
      'You said you know who benefits. Are you going to say the name?',
      'Then what protects you? Anything?'
    ],
    chime: {
      own: [
        'He carried it. If we lose him we lose the next three as well.',
        'I could not have done what he did today and I am not going to pretend I could.',
        'We would have been beaten by twice as much without him.'
      ],
      blame: [
        'He is very good at challenges. He is also very good at counting, which is the bit that worries me.',
        'Strong people go home in this game. That is not cruelty, that is the game.',
        'Everybody keeps saying we need him. We said that about the last one too.'
      ],
      wry: [
        'I helped. Somewhere in the middle there, I helped.',
        'I would like it on the record that I held a rope at one point.',
        'He was magnificent and I have never been more irrelevant.'
      ]
    },
    playerOpts: {
      own: 'Accept being a threat',
      deflect: 'Share the credit',
      defiant: 'Dare them to vote you',
      wry: 'Joke about the reward'
    }
  },

  /* ---------------------------------------------------------------
     CLOSE CALL — lost {chal} by nothing. The most argued-about kind of
     loss, because a near miss gives everybody a different last-second
     moment to be angry about.
     --------------------------------------------------------------- */
  {
    id: 'closeCall',
    ask: [
      '{who}, {chal} came down to seconds. Does that make tonight easier or worse?',
      'You were one move away at {chal}. {who}, what was the moment?',
      '{who}, that was as close as it gets. Is there one thing you would take back?',
      '{who}, a loss is a loss, but that one was nearly a win. Does the camp see it that way?',
      '{who}, somebody is going home tonight over about four seconds. Talk to me about that.',
      'I could not call {chal} until the end. {who}, when did you know?'
    ],
    answers: {
      own: [
        'Worse. If we get hammered I can live with it. That one was mine to win and I did not.',
        'I know the moment. I went left and I should have gone right and I will think about it for years.',
        'Four seconds. I have been doing those four seconds in my head all the way here.',
        'We were good enough today. That is the hard part. We were good enough and we still lost.',
        'I had it. I want to be very clear that I had it and I let it go.'
      ],
      deflect: [
        'Close is close. It does not come with a prize.',
        'We were right there, and that tells me the next one is winnable.',
        'I would rather lose like that than the way we lost the last one.',
        'Nobody here has anything to be ashamed of out of {chal}.',
        'Every one of us did our job today. The clock just did not agree.'
      ],
      blame: [
        'We lost it in one spot and everybody at this fire knows which spot.',
        'I was screaming a direction. Somebody chose not to hear it.',
        'One person froze for about three seconds. That was the challenge.',
        'We had it won and it got talked away by somebody who would not stop calling.',
        'I am not going home over somebody else four seconds.'
      ],
      defiant: [
        'We lost. Close is a word people use to feel better.',
        'I am not doing regret at a fire on camera.',
        'Ask me what I would take back and my answer is nothing.',
        'It was four seconds. It is not a character flaw.',
        'You are trying to get somebody to crack. It will not be over {chal}.'
      ],
      wry: [
        'We have perfected losing narrowly. It is a real skill and it is worth nothing.',
        'I am told moral victories do not go on the board. I have checked twice.',
        'So close. So very close. So entirely irrelevant.',
        'We have decided to lose interestingly from now on.',
        'If they gave a necklace for nearly, we would be unbeatable.'
      ],
      bleak: [
        'Close means somebody still goes home. It just means we get to argue about why first.',
        'We were four seconds from keeping all of us. Now we pick one.',
        'That was the best we have got and it was not enough. Work out what that means for tomorrow.',
        'The worst part is knowing we can nearly do it. That will eat this camp alive.',
        'Everybody is going to remember a different four seconds and blame a different person.'
      ]
    },
    push: [
      'Then does tonight come down to those four seconds, or to something older?',
      'Does anybody else here have a different moment in their head?',
      'You said one spot. Everybody here just looked at the same person.',
      'Is that what got said on the walk back?',
      'So is anybody voting on {chal} tonight, or was that already settled?'
    ],
    chime: {
      own: [
        'It was my spot. He is being kind by not saying it.',
        'I froze. I want to say that before somebody else says it for me.',
        'We all had a moment. Mine came about ten seconds before his.'
      ],
      blame: [
        'There is a version of that where we win, and it does not need any of us to be stronger.',
        'Four seconds is not bad luck when it is the same four seconds every time.',
        'He will not say the name. I might.'
      ],
      bleak: [
        'It does not matter how close it was. There are five of us and there will be four.',
        'We lost the same way we always lose. It was just prettier this time.',
        'Nearly winning has kept this camp arguing for three days now.'
      ]
    },
    playerOpts: {
      own: 'Take the moment on yourself',
      blame: 'Name the spot it went wrong',
      deflect: 'Close means we can win',
      wry: 'Nearly is worth nothing'
    }
  }
];
