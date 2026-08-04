/* ============================================================
   DILEMMA POOL LINES — what people actually say in the 24 events in
   dilemma-pool.js.

   Same shape and same job as DILEMMA_LINES: the pools exist because a dilemma
   that arrives with identical words the second time stops being a situation and
   becomes a menu. Every slot has 4-8 alternatives; `dpFill` in dilemma-pool.js
   picks one and substitutes the placeholders.

   Two slots per event:
     <name>      the claim — what the castaway says, in their own mouth
     <name>Sit   the staging — one or two sentences, second person, no dialogue

   Placeholders (any pool may use any of them; dpFill leaves unknown ones alone):
     {sn}  source — whoever said the thing, or the npc's partner in it
     {vn}  victim — the person a plan is aimed at
     {an}  the player's own ally
     {tn}  a third party being discussed
     {n1} {n2} {n3}  members of a named group, in the order given
     {p}   the person the npc wants you to carry something to
   ============================================================ */
const DILEMMA_POOL_LINES = {

  /* 1. Throw the challenge. {vn} target, {sn} the accomplice they name. */
  throwChallenge: [
    'We lose today and {vn} goes home. {sn} is already in. All you have to do is be slow.',
    'Do not win this one. That is the whole ask. {sn} knows about it.',
    'One challenge. We drop it, {vn} goes, and we are still fine after.',
    'I am not going to dress it up. Lose the heat, we vote {vn}.',
    'There is no other way to get {vn} in front of a council. {sn} said you would understand.',
    'You do not have to fall over. Just do not be brilliant.',
    'We will never get a better night for {vn}. Not with {sn} on board.'
  ],
  throwChallengeSit: [
    'They wait until the others have gone ahead, then fall into step beside you.',
    'You are twenty minutes from a challenge and someone has decided this is the moment.',
    'It is asked the way people ask for a favour they have already decided you owe.',
    'They keep their voice under the noise of the surf and do not look at you while they talk.'
  ],

  /* 2. Accused of throwing it. {sn} the one who supposedly noticed first. */
  thrownAccuse: [
    'You did not even try out there. {sn} says that was on purpose.',
    'I have watched you carry a log up that hill. Today you could not hold a rope.',
    'Somebody threw that. {sn} thinks it was you and I am starting to agree.',
    'Nobody is that bad twice. Were you tanking it?',
    'I want to hear you say you were trying. Because {sn} says you were not.',
    'You stopped. I watched you stop.'
  ],
  thrownAccuseSit: [
    'They have been building to this since you came off the mat. Nobody else is here.',
    'You are still wringing seawater out of your shirt when they sit down opposite you.',
    'The rest of the tribe is at the fire. They walked you away from it first.',
    'It is not an accusation yet. It is an invitation to make it not become one.'
  ],

  /* 3. Two allies, one secret. {tn} the other ally, {vn} the shared name. */
  twoSecrets: [
    'Does {tn} know about {vn}? Because I have not told them and I need to know if you have.',
    'Between us — is {tn} on {vn} as well? Just nod.',
    'I told you that about {vn} for a reason. Has it gone anywhere? Has it gone to {tn}?',
    'If {tn} finds out I said {vn} to you first, I am finished. Have they?',
    'You are the only person I said {vn} to. I would like that to still be true.',
    'I am asking about {tn} because {tn} has been odd with me since yesterday.'
  ],
  twoSecretsSit: [
    'They have been circling this for an hour and have finally got you alone.',
    'You are holding two versions of the same secret and only one person is in front of you.',
    'They ask it lightly, which is how you know it is the only reason they came over.',
    'Both of them told you the same thing yesterday. Neither knows the other did.'
  ],

  /* 4. Three of them, tonight. {n1} {n2} the other two, {vn} the name. */
  threeCorner: [
    'We are done with whispers. {vn}, tonight. Say it in front of {n1} and {n2}.',
    'Three of us walked over here. You can see why. We want it out loud.',
    'No more maybe. {n1} has said it, {n2} has said it. Your turn.',
    'This is where we stop being polite. {vn}. Yes or no, with everyone listening.',
    'You have had two days. {n1} and {n2} are finished waiting.',
    'If you cannot say it in front of us, you were never with us.'
  ],
  threeCornerSit: [
    'Three of them come up the beach together, which never happens by accident.',
    'They have arranged themselves so you cannot answer one without the other two hearing it.',
    'Nobody sits down. That tells you how long they expect this to take.',
    'You are not being asked in private, and that is the entire point of it.'
  ],

  /* 5. Carry the switch. {vn} new name, {sn} old name, {p} who to carry it to. */
  carrySwitch: [
    'Change of plan. Not {sn} — {vn}. You have to be the one who tells {p}.',
    'It cannot come from me. Go to {p} and say {vn}. They will listen to you.',
    'I have flipped. {vn} tonight. {p} still thinks it is {sn} and there is no time.',
    'If I walk over to {p} now, half the beach sees it. If you do it, nobody blinks.',
    'Tell {p} it is {vn}, and do not tell them I sent you.',
    '{sn} is not the vote any more. Get to {p} before the torches.'
  ],
  carrySwitchSit: [
    'The sun is nearly down. Whatever is decided in the next ten minutes is what happens.',
    'They catch your arm on the path and are already talking before you turn round.',
    'There is no time to think about this and they are counting on that.',
    'You can hear people collecting their torches from where you are standing.'
  ],

  /* 6. Fourth on the plan. {n1} {n2} the other three's other two, {vn} the target. */
  fourthSeat: [
    'It is me, {n1} and {n2}. We need a fourth and we picked you. {vn} first.',
    'Four beats three. {n1} and {n2} are in. Sit down with us.',
    'You are the fourth or you are the number. That is honestly the choice.',
    'We are solid, the three of us. Do not overthink it.',
    '{n1} wanted somebody else. I said you. Do not make me look stupid.',
    'One seat left. {vn} goes home and then we are the majority.'
  ],
  fourthSeatSit: [
    'They have clearly rehearsed this, and clearly rehearsed it with two other people.',
    'It is offered like a gift. Gifts out here have the price written on the back.',
    'You have watched the three of them all week and you are not sure they like each other.',
    'They keep glancing back up the beach while they talk to you.'
  ],

  /* 7. The name, third time. {vn} the name. */
  nameThreeTimes: [
    'I think it has to be {vn}. Do not tell anyone I said it first.',
    'Just between us — {vn}. Nobody else knows I am on that.',
    'I have been sitting on {vn} all day. You are the first person I have told.',
    'This does not leave the two of us. {vn}.',
    'I trust you with this and nobody else out here. {vn}.',
    'I have not said this out loud to a soul. {vn}.'
  ],
  nameThreeTimesSit: [
    'They say it like a confidence. You have heard the same confidence secondhand already.',
    'This is the third mouth the name has come out of, and they think it is the first.',
    'You already know who else has heard this. They do not know that you know.',
    'They lower their voice for a secret that is currently doing a lap of the camp.'
  ],

  /* 8. Lie to your ally, as a test. {an} the ally. */
  loyaltyLie: [
    'Tell {an} something that is not true, in front of me. Then I will believe you.',
    'I need to see you lie to {an}. That is the test. Nothing else counts.',
    'You say you can play. Fine — go and put a false name in {an}’s head.',
    'Everybody out here says they are ruthless. Show me. {an}.',
    'I am not asking you to vote {an}. I am asking you to lie to them once.',
    'If you can do it to {an}, you can do it for me. That is how this works.'
  ],
  loyaltyLieSit: [
    'They have watched you being decent to people all week and they do not trust it.',
    'It is not a plan. It is an audition, and they are enjoying it.',
    'They want to see the version of you that plays, not the version that talks.',
    'There is no upside on the table. Only the test.'
  ],

  /* 9. Information at a price. {vn} what they are selling, {tn} the price. */
  infoPrice: [
    'I know exactly who is on you. I will trade it. Give me {tn}.',
    'I have something about {vn} you badly need. It costs one name — {tn}.',
    'Information is the only currency here. Mine is {vn}. Yours is {tn}.',
    'You want to know what {vn} said about you? Then tell me something real about {tn}.',
    'I do not do favours. {vn} for {tn}. Even trade.',
    'Something is coming for you and I know the shape of it. Give me {tn} and it is yours.'
  ],
  infoPriceSit: [
    'They open with the price, which at least tells you they have done this before.',
    'They are not pretending to be your friend, which is almost restful.',
    'It is a market stall and you are standing at it.',
    'They wait. They are comfortable waiting.'
  ],

  /* 10. Seen with the other side. {sn} the old tribemate, {tn} the witness. */
  seenOtherSide: [
    '{tn} saw you down at the water with {sn}. What was that?',
    'You were with {sn}. Do not tell me you were not, {tn} watched you.',
    'We are your tribe now. So why are you still talking to {sn}?',
    'Half of us think you are playing your old game with {sn} and waiting us out.',
    '{tn} came to me about you and {sn}. I would rather have heard it from you.',
    'You and {sn}. Twenty minutes. Nobody else around. Explain that.'
  ],
  seenOtherSideSit: [
    'Since the swap you have been the newest thing in this camp and the most watched.',
    'They have been sitting on this for a day and it has not improved.',
    'They are not shouting, which is worse.',
    'You are one of two new faces here, and the other one has already been picked over.'
  ],

  /* 11. Speak for the tribe. {n1} the rival, {n2} the quiet one. */
  spokesperson: [
    'Somebody has to say it and everyone is looking at their feet. {n1} will not. {n2} cannot.',
    'We need one voice for this. If it is not you it is {n1}, and then we are all in trouble.',
    'You are the only one here who talks straight. Do it, or we send {n2} and it goes badly.',
    'Whoever stands up for this is the face of it. That is why nobody has.',
    'Say you will do it. {n1} has already volunteered and nobody wants that.',
    'The tribe wants a mouth. You have one.'
  ],
  spokespersonSit: [
    'The tribe has talked around this all morning and nobody will put their name on it.',
    'Everyone at the fire is suddenly very interested in the fire.',
    'Whoever speaks for this owns it, win or lose, and everybody has worked that out.',
    'They ask you in front of enough people that refusing will be seen.'
  ],

  /* 12. Cover for them. {tn} the one who would notice. */
  coverAtCamp: [
    'I cannot do it today. Tell them I was on the water line. Please.',
    'If {tn} asks, I was working. I need one day where nobody looks at me.',
    'I have not slept and I have not eaten. Tell them I was doing something.',
    'I will not make it if they decide I am the weak one this week.',
    'One lie. That is all. Say you saw me carrying wood.',
    'Do not tell {tn} how bad it is. They will use it.'
  ],
  coverAtCampSit: [
    'They have not been right for two days. Up close it is worse than it looks from across camp.',
    'They ask you sitting down, because standing up has stopped being easy.',
    'This is not a game move, and that is what makes it hard.',
    'Their hands are shaking and they are covering it with the conversation.'
  ],

  /* 13. Pick a side, publicly. {tn} the other one in the fight, {n1} the swing. */
  pickASide: [
    'You saw what {tn} did. Say it. Out loud, where {n1} can hear it.',
    'I am not asking you to hate them. I am asking you to stand next to me while I say it.',
    'If you say nothing, {n1} decides {tn} was right. Is that what you want?',
    'Everybody watched that. Everybody is waiting to see who moves first.',
    'You do not get to be neutral about {tn}. Not after that.',
    'One sentence, in front of {n1}, and this is finished.'
  ],
  pickASideSit: [
    'It went off ten minutes ago and the whole beach heard it. Now the beach is choosing.',
    'Both of them came looking for you separately. This is the one who found you.',
    'Nobody is pretending to work any more. Everyone is watching to see who moves.',
    'You are being asked to be a witness, in public, right now.'
  ],

  /* 14. Picked off in order. {n1} {n2} {n3} the younger bloc. */
  pickedOffInOrder: [
    'It is {n1}, {n2} and {n3}. They have an order. You are on it, just not first.',
    'I have watched a lot of these. {n1}, {n2}, {n3} — they go slowest first, then you.',
    'Nobody my age is in that group and nobody your age is going to be.',
    'They talk while we sleep. {n1} counts on their fingers. I have seen it.',
    'You think you are inside it because they are pleasant to you. That is what pleasant is for.',
    'Three of them, one number each. I am second. You are after me.',
    'They do me this week and you next. That is not a feeling, it is arithmetic.'
  ],
  pickedOffInOrderSit: [
    'They wait until the young ones are all down at the water.',
    'They talk about it the way somebody talks about weather they have seen before.',
    'They are not frightened, only certain, which is harder to argue with.',
    'It is the calmest anybody has been while telling you that you are already dead.'
  ],

  /* 15. Silence, not your vote. {vn} the mutual friend. */
  silenceNotVote: [
    'I am not asking for your vote. I am asking you not to warn {vn}.',
    'Keep your hands clean. Just do not open your mouth about {vn}.',
    'Vote whoever you like. Say nothing to {vn} and we are fine.',
    '{vn} trusts you more than anyone here. That is exactly why I came to you.',
    'If {vn} finds out it came from you, that is on you, not me.',
    'I know you love them. I am not asking you to stop. I am asking for one quiet night.'
  ],
  silenceNotVoteSit: [
    'They are careful to ask for less than you expected. That is the technique.',
    'It is a small ask, which is exactly why it is hard to refuse.',
    'They know what your face does when somebody says that name.',
    'Nothing they want from you requires you to do anything at all.'
  ],

  /* 16. The idol question. No placeholders. */
  idolPromise: [
    'If you had one. If you had it right now. Would you play it for me?',
    'Say I am in trouble and you have something in your pocket. Am I walking out of there?',
    'I need to know what you would actually do, not what you would say at the time.',
    'Nobody has to have anything for this to matter. Would you, or would you not?',
    'I would, for you. I want to hear you say it back.',
    'It is a simple question and you are taking a long time with it.'
  ],
  idolPromiseSit: [
    'It is a hypothetical, and you both know that it is not.',
    'They have thought about how to ask this. It comes out very simply.',
    'There is nothing in either of your pockets. The question still costs something.',
    'They are not asking about idols. They are asking where you stop.'
  ],

  /* 17. The whole tribe has agreed. {vn} the name, {n1} {n2} the two named. */
  wholeTribeAgreed: [
    'It is done. {vn}. {n1} and {n2} are already there. You do not want to be the odd one.',
    'Everybody has agreed on {vn}. I am telling you so you are not the last to know.',
    'Do not make this hard. {n1}, {n2}, me — {vn}. Nobody has to be nervous tonight.',
    'The whole camp is on {vn}. Being the only other name is how people get remembered.',
    'I am doing you a favour. {vn}, tonight, unanimous. Just write it.',
    'It is not a discussion any more. Ask {n1} if you like.'
  ],
  wholeTribeAgreedSit: [
    'They deliver it as news rather than as a plan. That is deliberate.',
    'Either the vote is decided or you are being told it is. There is a difference.',
    'You have heard nothing about this from anybody else all day.',
    'They are watching to see whether you accept a fact or ask for one.'
  ],

  /* 18. Confirm your own rumour. {vn} the subject. */
  confirmRumour: [
    'Say it in front of them. That thing about {vn}. They will believe it from you.',
    'I have repeated it all day. Back me now and {vn} is finished.',
    'Everybody thinks I made it up. Tell them where it came from.',
    'You started this. Do not leave me standing in it on my own.',
    'One word from you and {vn} has nowhere to stand.',
    'I am asking you to say out loud what you already told me about {vn}.'
  ],
  confirmRumourSit: [
    'The thing you said quietly has come back loud, and it has brought a witness.',
    'They have carried your words further than you did and now they want backup.',
    'People are drifting over. Whatever you say next has an audience.',
    'They are holding something you made and asking you to take the other end of it.'
  ],

  /* 19. Where were you. {sn} who they think you were with. */
  whereWereYou: [
    'You were gone a long time. Who with?',
    'Two hours. Nobody saw you. {sn} was gone as well. Coincidence?',
    'I am not your keeper. I would just like to know where you go.',
    'You come back and you will not look at me. Where were you?',
    'People notice when you disappear. {sn} disappears at the same time.',
    'Tell me it was nothing and I will believe you. Probably.'
  ],
  whereWereYouSit: [
    'You have been back at camp ten minutes. They have clearly counted them.',
    'It is asked as small talk. It is not small talk.',
    'They were the only one who noticed you go, which is its own information.',
    'They wait for the answer with a patience that is not friendly.'
  ],

  /* 20. Final two, now. No placeholders. */
  finalTwoNow: [
    'You and me at the end. Shake on it now, while it still means something.',
    'I want this settled before the game makes it complicated. Final two.',
    'Everything else is negotiable. This is not. You and me.',
    'I am not asking for tonight. I am asking for day thirty-nine.',
    'If you shake my hand I will never write your name. That is not strategy, it is a promise.',
    'People do this too late and then it means nothing. I am doing it now.'
  ],
  finalTwoNowSit: [
    'It is far too early for this and they have their hand out anyway.',
    'They mean it, which is the part that should worry you.',
    'Nobody makes this offer without having already done the other calculation.',
    'They have decided this is the most important conversation they will have out here.'
  ],

  /* 21. They will take the fall. {vn} who your scheme was aimed at. */
  takeTheFall: [
    'They are going to work out who put {vn}’s name up. Let them think it was me.',
    'I will say the {vn} thing was my idea. You keep your hands clean.',
    'You cannot survive being the one who did that to {vn}. I can.',
    'Let me take it. I am not going to want anything for it. Not today.',
    'Somebody has to wear this. It might as well be the one nobody is watching.',
    'I will stand up and say {vn} was mine. All I need from you is quiet.'
  ],
  takeTheFallSit: [
    'They know what you did. They have known for a day and said nothing until now.',
    'It is offered like kindness and it lands like an invoice.',
    'Nobody offers to carry something this heavy for free.',
    'They are very calm about it, which means they have thought it through.'
  ],

  /* 22. Two for one bench. {tn} the other one who wants it, {n1} who plays instead. */
  sitOutFight: [
    'Sit me out. My shoulder is gone. {tn} is fine, they just do not want to be seen losing.',
    'I cannot do this one. If you make me, we lose and it is my fault.',
    'Do not put {n1} in there for me. Put me on the bench and I will owe you.',
    'You are the one they listen to. Say my name for the bench.',
    '{tn} sat out last time. Everyone knows it. Ask them.',
    'If I play I let the tribe down, and then I go home for it.'
  ],
  sitOutFightSit: [
    'Two of them want the bench and there is one bench. Somebody has to say a name.',
    'They got to you first, which is the only advantage on offer.',
    'The tribe is already lining up. This gets decided in a minute, by you or by somebody else.',
    'You did not ask to be the one who chooses, and you are the one who chooses.'
  ],

  /* 23. Are you in an alliance. No placeholders. */
  inAnAlliance: [
    'Straight question. Are you in an alliance?',
    'I am not going to be clever about this. Do you have people or not?',
    'Everybody says no. I am asking anyway, and I am watching your face.',
    'If you tell me no and I find out otherwise, that is the end of us.',
    'You do not have to tell me who. Tell me whether.',
    'I have been counting and the numbers do not work unless you are in something.'
  ],
  inAnAllianceSit: [
    'No preamble. They have walked over here specifically to watch you answer.',
    'It is the question everyone avoids, asked by the one person who will not.',
    'They ask it flat, in daylight, with nobody else near.',
    'There is no clever way to be asked this.'
  ],

  /* 24. Who took the food. {sn} the accused, {tn} the loudest accuser. */
  foodMissing: [
    'The basket is light again and {tn} says it was {sn}. You were up. What did you see?',
    'Somebody has been at the food. {tn} wants a name and {sn} is the name they want.',
    'I am asking everybody the same thing. Did you see {sn} near the basket?',
    'This is going to get ugly. {tn} has decided it was {sn} and half of them agree.',
    'You sleep nearest the fire. You would have seen it.',
    'If nobody says anything, {tn} picks a name and we all live with it.'
  ],
  foodMissingSit: [
    'The basket has been light two mornings running and the camp has stopped being polite.',
    'They are taking statements, essentially, and yours is the one that matters.',
    'Everybody is hungry, which is when a camp starts needing somebody to blame.',
    'Nobody has said your name yet. Nobody has ruled it out either.'
  ]
};
