/* ============================================================
   TRIBAL Q&A — camp and body.

   Six topics about the part of the game the cameras see but the challenge does
   not: an empty food bin, a dead fire, a shelter that leaks, and the people
   holding it all together or visibly not.

   These are the questions that turn a council nasty, because unlike a challenge
   result they are ABOUT SOMEBODY. A tribe can lose a challenge together. Nobody
   fails to fetch water together. So `notPulling` and `worker` are two halves of
   the same argument and the engine will happily run both in one night.

   The show does this constantly and it is always the same shape: Peff names a
   condition, somebody explains it, and in explaining it they reveal how the camp
   really divides. The condition is the excuse. The division is the content.

   See docs/tribal-qa.md. No brackets, no asterisks, and every answer carries a
   fact, an image or a position that the question did not.
   ============================================================ */

'use strict';

const TRIBAL_TOPICS_B = [

  /* ---------------------------------------------------------------
     NO FOOD — the bin is empty. Fires the hunger topic that every real
     season runs on: people who have not eaten make worse decisions and
     say things they would not say fed.
     --------------------------------------------------------------- */
  {
    id: 'noFood',
    ask: [
      '{who}, there is no food at that camp. What does day after day of that do to a group of people?',
      '{who}, when did you last eat something you would call a meal?',
      'I have seen what is left in your bin, {who}. How is anybody making a decision on that?',
      '{who}, hunger changes people. Has it changed anybody at your camp?',
      '{who}, you are all starving. Does that make tonight more honest or less?',
      'Talk to me about food, {who}. Or the absence of it.'
    ],
    answers: {
      own: [
        'Four days on rice water. I have started dreaming about bread and I am not being poetic.',
        'I am hungry enough that I have stopped being nice, and I do not like what that looks like.',
        'We had two crabs between six of us on Tuesday. That is the last time I chewed anything.',
        'It has changed me. I snapped at somebody over a coconut shell yesterday and I meant it.',
        'I have lost my belt two holes and I am still wearing the same knot.'
      ],
      deflect: [
        'We are all in the same boat and nobody is complaining about it out loud.',
        'You get used to it. Around day six the hunger goes quiet and you just get slow.',
        'Everybody is hungry. It is not a reason and it is not an excuse.',
        'We will fix the food problem tomorrow. Tonight is not about food.',
        'I did not come here for the catering.'
      ],
      blame: [
        'There is no food because the people who said they would fish came back with a story.',
        'We had food. We had food and it got eaten by people who did not gather it.',
        'Ask who has been going out with a spear and ask who has been going out for a walk.',
        'Some of us are hungry. Some of us are hungrier, and that is not an accident.',
        'The bin is empty and I can tell you which two people it emptied for.'
      ],
      defiant: [
        'I am not going to sit here and be pitied over rice.',
        'I have been hungry before. This is not the worst thing that has happened to me.',
        'You are trying to make hunger the story. The story is the vote.',
        'We are fine. We are hungry and we are fine and those are both true.',
        'I could go another week. Ask somebody else if they could.'
      ],
      wry: [
        'I have developed extremely strong opinions about a single grain of rice.',
        'I ate a snail on Monday and I would like it noted I would do it again.',
        'We are on a diet of coconut and resentment and we are running low on coconut.',
        'I have started ranking everybody here by how much I would eat them. It is not a short list.',
        'The good news is nobody has to decide whose turn it is to cook.'
      ],
      bleak: [
        'I cannot stand up quickly any more. That is not drama, that is just what is happening.',
        'None of us are thinking straight and everybody in this game is about to make a decision.',
        'You lose the part of you that plans first. Then you lose the part that cares.',
        'Two of us have stopped talking at camp entirely. Not out of anger. There is nothing left for it.',
        'We are not playing a game at that camp. We are getting through the hours.'
      ]
    },
    push: [
      'Then how does anybody here trust a decision made on an empty stomach?',
      'Is there anybody at this camp who is less hungry than the rest?',
      'You said it has changed people. Changed who?',
      'Does everybody agree nobody is complaining?',
      'So does hunger decide tonight, or does something else?'
    ],
    chime: {
      own: [
        'She is being polite. I heard her crying about it and I pretended I did not.',
        'I have not eaten since the day before yesterday and I did not tell anybody.',
        'We are worse than we are letting on and I would rather say so.'
      ],
      blame: [
        'There is one person who eats first every single time and everybody here knows it.',
        'We are hungry because of decisions, not because of the island.',
        'It is amazing how the food runs out in a very consistent direction.'
      ],
      wry: [
        'I would like to formally apologise for whatever I said on Tuesday.',
        'I have never been so interested in a bird.',
        'Nine days without a proper meal and I am still the most reasonable person here.'
      ]
    },
    playerOpts: {
      own: 'Say how bad it has got',
      blame: 'Say who is eating',
      defiant: 'Refuse the pity',
      wry: 'Joke about the rice'
    }
  },

  /* ---------------------------------------------------------------
     FIRE OUT — no flame at camp. In the show this is the single most
     shameful camp failure there is, because fire is the one thing a tribe
     is judged on and the one thing that is entirely their own fault.
     --------------------------------------------------------------- */
  {
    id: 'fireOut',
    ask: [
      '{who}, you have no fire. Twelve days in. How does that happen?',
      '{who}, no fire means no water and no food. Who is responsible for that?',
      'I have to ask, {who}. Whose job was the fire?',
      '{who}, is your fire out because nobody could make it or because nobody watched it?',
      '{who}, a tribe with no fire is a tribe in trouble. Is your camp in trouble?',
      '{who}, tell me about the last time you had a flame at that camp.'
    ],
    answers: {
      own: [
        'It went out on my watch. I fell asleep sitting up next to it and I woke up to smoke.',
        'It is out because I did not put wood on it at three in the morning. Simple as that.',
        'Nobody at that camp can make fire without the flint and we have been careless with the flint.',
        'I have tried for two days. My hands are torn up and I have got nothing to show for it.',
        'We let it go out. All of us. It was not one person and it was definitely partly me.'
      ],
      deflect: [
        'It rained for nine hours. There is not a tribe in this game that keeps a fire through that.',
        'We will have it back tomorrow. It is a setback, not a crisis.',
        'Everything at that camp is soaked through. You cannot burn water.',
        'It is out. We know it is out. We do not need to hold a trial about it.',
        'We have had it out before and we got it back before.'
      ],
      blame: [
        'One person said they would sit with it. One person did not sit with it.',
        'The fire was somebody job and that somebody is sat at this fire looking at me.',
        'I asked twice for wood to be brought in dry. It came in wet both times.',
        'We have got no fire because the person who wanted to be in charge of it wanted the title, not the night shift.',
        'Two of us gather wood. Everybody warms their hands.'
      ],
      defiant: [
        'It is a fire. We will make another one. This is not the end of the world.',
        'I am not going to be shamed at a council over a pile of wet sticks.',
        'You are asking who is responsible so somebody says a name. I am not saying a name.',
        'It went out. Fires do that. Vote me out over it if that is what this is.',
        'Everybody here has let it go out at least once and everybody here is being very quiet.'
      ],
      wry: [
        'We are the first tribe in history to lose a fire indoors.',
        'We have a lovely pile of extremely damp wood if anybody is interested.',
        'On the plus side, no washing up.',
        'It is not out. It is resting.',
        'I have never held a stronger opinion about a pair of dry socks.'
      ],
      bleak: [
        'No fire means no clean water. We have been drinking what we can and two of us are not right.',
        'It has been out for two days and nobody has tried since yesterday. That is the bit that scares me.',
        'We stopped trying. That is what has actually gone out.',
        'It is cold at night and nobody is sleeping and it shows in everything we do.',
        'A camp with no fire stops being a camp. We are just six people on a beach now.'
      ]
    },
    push: [
      'So does anybody here want to say the name?',
      'Is there one person at that camp who can actually make fire?',
      'You said all of you. Does everybody accept that?',
      'Then who is sitting with it tonight?',
      'Has anybody tried today? Anybody?'
    ],
    chime: {
      own: [
        'It was my watch too and I said nothing. I should have said something at camp.',
        'I cannot make fire. I have never been able to and I should have admitted that on day one.',
        'We all walked past it. Every one of us walked past it.'
      ],
      blame: [
        'He is covering for somebody and everybody sat here knows who.',
        'It is not the rain. It was out before the rain.',
        'I would like to know why the person who took the flint is not saying anything.'
      ],
      bleak: [
        'We have not had hot water in three days. That is why half of us look like this.',
        'It is not about the fire. Nothing at that camp gets finished any more.',
        'The fire going out was the second thing to go. The first was anybody caring.'
      ]
    },
    playerOpts: {
      own: 'Admit it was your watch',
      blame: 'Say whose job it was',
      deflect: 'Blame the weather',
      wry: 'Make light of it'
    }
  },

  /* ---------------------------------------------------------------
     SHELTER BAD — it leaks, and {weather} is doing the rest. A physical
     complaint that is really about labour: somebody built it badly, or
     nobody built it at all.
     --------------------------------------------------------------- */
  {
    id: 'shelterBad',
    ask: [
      '{who}, that shelter is not keeping {weather} out. Has anybody slept?',
      '{who}, twelve days and the roof still leaks. What is going on with that build?',
      '{who}, tell me about your nights. Because I have seen where you sleep.',
      '{who}, {weather} is coming through the roof and nobody has fixed it. Why not?',
      '{who}, is that shelter a shelter or is it a pile of palm?',
      '{who}, does a bad night change how people treat each other the next day?'
    ],
    answers: {
      own: [
        'Nobody has slept properly in four nights. I lie there and count the drips.',
        'I built the middle section and the middle section is where it comes through. That is mine.',
        'We built it fast on day one and we have never gone back and done it right.',
        'I have had about two hours a night for a week. I know exactly what that has done to me.',
        'It leaks because we made the pitch too shallow and nobody wanted to pull it apart and start again.'
      ],
      deflect: [
        'It is dry at one end. We rotate. It works out.',
        'It has held through worse than {weather} and it will hold through tonight.',
        'You do not come out here for a comfortable bed.',
        'The shelter is the least of what is wrong at that camp.',
        'We will patch it tomorrow. It is on the list.'
      ],
      blame: [
        'Three of us built that shelter. The other three have opinions about it.',
        'The people complaining loudest about the leak are the people who were asleep while it went up.',
        'Somebody moved the good palm to make themselves a mattress. Look around and you will work out who.',
        'It leaks where one person stopped weaving because they got bored.',
        'The dry end always seems to have the same two people in it.'
      ],
      defiant: [
        'I sleep fine. I am not going to perform being tired for anybody.',
        'It is a beach. It rains. I did not expect a hotel.',
        'You want me to blame somebody for the weather now.',
        'I have slept worse places than that and I am still standing.',
        'A leaky roof is not why anybody goes home tonight.'
      ],
      wry: [
        'We have built a very effective way of getting rained on while lying down.',
        'The roof works beautifully as long as it is not raining.',
        'I have found the one dry spot and I am prepared to fight for it.',
        'We call it the shelter for morale reasons.',
        'It keeps out about forty percent of the weather. We are quite proud of the forty.'
      ],
      bleak: [
        'Nobody sleeps, so nobody thinks, so everybody argues. You can trace all of it back to that roof.',
        'Four nights awake and cold and everybody at this fire is making a decision tonight anyway.',
        'It is not the wet. It is what happens to people who have not slept in a week.',
        'Two of us have been shivering since Tuesday and there is nothing to do about it.',
        'The nights are longer than the days now. That is the part nobody tells you.'
      ]
    },
    push: [
      'So who was supposed to fix it?',
      'Does everybody sleep at that dry end, or just some of you?',
      'You said it is on the list. Whose list?',
      'Has a bad night made anybody here say something they regret?',
      'Then is tonight about the shelter, or about who has been sleeping in it?'
    ],
    chime: {
      own: [
        'I stopped weaving. That is the gap he is talking about and it is mine.',
        'I have not slept either. I just have not made a thing of it.',
        'We should have rebuilt it in week one and we all knew it.'
      ],
      blame: [
        'It is very interesting who ends up dry every night.',
        'The people who built it are the people who are tired. Funny how that works out.',
        'I would like everybody to notice who has not mentioned the roof once.'
      ],
      wry: [
        'I have moved outside. Genuinely. It is better outside.',
        'I sleep under the canoe now and I recommend it.',
        'We have a leak, a draught and a resident crab. It is a full household.'
      ]
    },
    playerOpts: {
      own: 'Admit the build was rushed',
      blame: 'Say who sleeps dry',
      deflect: 'It has held through worse',
      wry: 'Joke about the roof'
    }
  },

  /* ---------------------------------------------------------------
     NOT PULLING — {who} has not worked in {days} days and the cameras
     saw it. The single most dangerous public fact in the game, because
     unlike a challenge result there is no luck in it.
     --------------------------------------------------------------- */
  {
    id: 'notPulling',
    ask: [
      '{who}, I am told you have not done a job at that camp in {days} days. Is that fair?',
      '{who}, does this tribe think you pull your weight?',
      '{who}, {days} days without picking anything up. Tell me why.',
      '{who}, if effort decides tonight, where do you sit?',
      '{who}, everybody at that camp knows who works and who does not. Which are you?',
      'I want to put something to you, {who}. This tribe has been carrying you. True or not?'
    ],
    answers: {
      own: [
        'It is fair. I have been useless for {days} days and I have watched other people do my share.',
        'I have not pulled my weight and I have no excuse ready, which is probably the point.',
        'I got comfortable. That is the honest answer and it is not a good one.',
        'They have been carrying me. I would like the chance to stop that being true.',
        'If effort decides tonight I go home, and I would understand it.'
      ],
      deflect: [
        'I do the things nobody counts. I keep the water going and nobody sees water.',
        'There is not enough work at that camp for six people to look busy.',
        'I have been saving what I have got for the challenges. That was a choice.',
        'Ask what I did on day three before you decide what I am.',
        'I am not the only person sat here who had a quiet week.'
      ],
      blame: [
        'I have not worked because every time I start, somebody takes it off me to do it their way.',
        'There are two people at that camp who want to do everything and then want credit for it.',
        'I am being made the lazy one because somebody needed a lazy one.',
        'Ask who counted my days. Ask why they were counting.',
        'I stopped offering because I got told no three times in a row.'
      ],
      defiant: [
        'I am not here to build somebody a house. I am here to win a game.',
        'Nobody at that camp is my employer.',
        'You have a number and you are very pleased with it. It does not describe me.',
        'I have got nothing to prove by carrying a log.',
        'Vote me out for resting. I will sleep well either way.'
      ],
      wry: [
        'I am pacing myself. It is a long season.',
        'I prefer to think of it as supervising.',
        'Somebody has to sit down or the rest of them have nobody to feel superior to.',
        'I have been extremely busy conserving energy.',
        'I did offer to help. I offered from quite far away.'
      ],
      bleak: [
        'I have not worked because I cannot. I have not been able to keep food down since the storm.',
        'I get up and my head goes and I sit back down. That is the whole of my {days} days.',
        'I know how it looks. I do not have the body to make it look different.',
        'There is nothing left in me and admitting that here is probably how I go home.',
        'I am not lazy. I am finished, and those look the same from outside.'
      ]
    },
    push: [
      'Does this tribe accept that?',
      'Somebody here has been doing that work. Do you want to answer them?',
      'You said you cannot. Have you told anybody at camp that?',
      'Is there one person here who will say you have pulled your weight?',
      'So is effort worth a vote tonight, or is it not?'
    ],
    chime: {
      own: [
        'I have picked up a lot of his share and I never said a word about it until now.',
        'He is right and I am one of the people who has been carrying it.',
        'I did not want this to come up here. But it is true.'
      ],
      blame: [
        'I do not think anybody sat here believes that answer.',
        'I have been up at first light every day of this game. He has not been up once.',
        'We can all be tired. Some of us are tired from doing something.'
      ],
      deflect: [
        'I would rather lose a worker than a challenge winner, and that is where I am on it.',
        'Camp work does not win this game. It just makes the losing more comfortable.',
        'Everybody has had a bad few days. His were just easier to count.'
      ]
    },
    playerOpts: {
      own: 'Admit it and ask for a chance',
      deflect: 'Point at unseen work',
      blame: 'Say you were pushed out',
      defiant: 'Tell them you owe them nothing'
    }
  },

  /* ---------------------------------------------------------------
     WORKER — {who} does everything. The mirror of notPulling, and just
     as dangerous: on the show, being indispensable at camp is exactly
     the argument people use to keep you until it is convenient.
     --------------------------------------------------------------- */
  {
    id: 'worker',
    ask: [
      '{who}, every camera I have seen has you working. Does anybody notice?',
      '{who}, you do more than anybody at that camp. Does that buy you anything tonight?',
      '{who}, is doing all the work a strategy or is it just who you are?',
      '{who}, you have built and fetched and cooked for twelve days. What has it got you?',
      '{who}, does this tribe need you, or do they just find you useful?',
      '{who}, is there resentment in that? There would be in me.'
    ],
    answers: {
      own: [
        'They notice. Whether it counts tonight is a completely different question.',
        'I cannot sit still while things need doing. It is not strategy, it is just how I am built.',
        'I would do it again tomorrow. I would just like somebody to bring the second load.',
        'It has got me a sore back and a lot of goodwill I cannot spend.',
        'I do it because somebody has to, and I stopped waiting for the somebody.'
      ],
      deflect: [
        'Plenty of people work at that camp. I am just the one you filmed.',
        'It is not all me. Two others do as much and say less.',
        'I would rather be busy than sat thinking about how hungry I am.',
        'It is not a sacrifice. It passes the day.',
        'Everybody contributes something. Mine is just visible.'
      ],
      blame: [
        'I notice. I notice every morning at first light exactly who is still lying down.',
        'There is resentment. I have got a list and it has got names on it.',
        'I have carried people who then had opinions about how I carried them.',
        'Ask the people who have not touched a log this week how they feel about my work.',
        'I am not bitter about working. I am bitter about being thanked by people who then count me as a number.'
      ],
      defiant: [
        'It buys me nothing and I knew that when I started.',
        'I do not need anybody at this fire to validate it.',
        'If they vote out the person who runs their camp, they deserve the camp they get.',
        'I am not asking for credit. I am telling you what happened.',
        'Useful is not the same as safe. I worked that out on day four.'
      ],
      wry: [
        'I have become the mother of six adults and I did not apply for the job.',
        'I have carried enough wood to build a second island.',
        'They have started thanking me, which is how I know I am in trouble.',
        'I do everything and in return I get to know where everything is.',
        'It turns out you can work your way straight to the top of somebody list.'
      ],
      bleak: [
        'It buys nothing. In this game the person who does everything goes home about now.',
        'I am the most tired person here and I am also the easiest to justify losing.',
        'I have spent everything I had on a camp that will vote on it tonight.',
        'Being needed keeps you to the merge. It does not keep you past it.',
        'They will say lovely things about me and write my name anyway.'
      ]
    },
    push: [
      'Does anybody here want to answer that?',
      'So is being useful a reason to keep somebody, or a reason to wait?',
      'You said you have a list. Is anybody on it sat here?',
      'Has anybody at that camp actually thanked you?',
      'Then what protects you tonight, if not the work?'
    ],
    chime: {
      own: [
        'That camp does not run without her and everybody there knows it.',
        'I have taken more from her this week than I have given anybody.',
        'She was up before me every single morning and I am not a late riser.'
      ],
      blame: [
        'She works hard and she also counts. That is the part people forget to mention.',
        'Being useful at camp is not the same as being useful to me.',
        'We have all thanked her. That does not make her my ally.'
      ],
      wry: [
        'I would like to publicly thank her before it becomes suspicious.',
        'I have been trying to look busy near her for about a week.',
        'She does the work. I do the appreciating.'
      ]
    },
    playerOpts: {
      own: 'Say it does not buy safety',
      blame: 'Name the resentment',
      defiant: 'You need no credit',
      wry: 'Joke about being useful'
    }
  },

  /* ---------------------------------------------------------------
     WORN — {who} is visibly falling apart. Peff can see it, so it is fair
     game, and it is the one topic where the honest answer is the most
     dangerous one. In the show this is where somebody says the thing that
     gets them voted out for their own good.
     --------------------------------------------------------------- */
  {
    id: 'worn',
    ask: [
      '{who}, I am looking at you and you are not the person who stepped off that boat. What is happening?',
      '{who}, how are you actually doing? Not the answer for the camp. The real one.',
      '{who}, you look like the island is winning. Is it?',
      '{who}, everybody here can see the state of you. Is that a problem for you tonight?',
      '{who}, are you at the end of what you have got?',
      '{who}, be honest with me. Can your body do another two weeks of this?'
    ],
    answers: {
      own: [
        'I am running on nothing. I have known it for three days and I have said it to nobody.',
        'It is winning. I get up and it takes me a minute to work out where I am.',
        'I have lost a lot of weight and all of my patience. Both are showing.',
        'I am not the person who got off the boat. I do not think anybody here is.',
        'I can do two more weeks. I cannot do them well and that is the difference.'
      ],
      deflect: [
        'I look worse than I feel. I have always looked like this when I am tired.',
        'Everybody at this fire is in the same state. I am just paler about it.',
        'I have had a rough couple of nights, that is all this is.',
        'I will be fine after a hot drink and four hours.',
        'Do not write me off on the strength of a bad photograph.'
      ],
      blame: [
        'I am like this because I have been doing two people work on one person food.',
        'I look like this because of the nights, and the nights are like that because of that roof.',
        'Somebody here has been fine all week. Ask them how they have managed it.',
        'I am worn out. I got worn out doing things other people would not do.',
        'This is what carrying a camp looks like. Have a good look.'
      ],
      defiant: [
        'I am fine. Ask me again when I am not.',
        'Do not use my face as a reason to vote me out.',
        'I have been underestimated my whole life. Carry on.',
        'I will still be sat here when the strong ones are on that jury.',
        'I am not going to give anybody here permission to feel sorry for me.'
      ],
      wry: [
        'I have aged about nine years and I would like to speak to somebody about it.',
        'I caught my reflection in the water yesterday and I did not recognise the fellow.',
        'I am told I look terrible. It is the only honest feedback I have had all week.',
        'Structurally I am sound. Cosmetically I have given up.',
        'I have decided the beard is a personality now.'
      ],
      bleak: [
        'I am not sleeping and I am not eating and I have stopped being able to hold a thought.',
        'My hands shake in the morning. They did not do that a week ago.',
        'There is a point where you stop playing and start surviving. I went past it on Sunday.',
        'I could not have done another minute of that challenge. Not one more minute.',
        'I do not know how much longer my body does this, and everybody here can see it as well as I can.'
      ]
    },
    push: [
      'Does anybody here see it differently?',
      'Have you said any of that at camp, or is this the first time?',
      'So is that a reason to keep somebody, or a reason to let them go?',
      'You said you have told nobody. Why not?',
      'Does this tribe look after its own, or does it not?'
    ],
    chime: {
      own: [
        'She has been worse than she is letting on and I should have said something days ago.',
        'I have watched her get up and sit straight back down twice today.',
        'We are all in a state. She is just further along than the rest of us.'
      ],
      deflect: [
        'She has looked like that since day two and she keeps going. I would not read much into it.',
        'Half of us look like that. It is not a plan, it is a beach.',
        'If we voted on who looks worst we would be here all night.'
      ],
      bleak: [
        'None of us are alright. She is just the one who got asked.',
        'We are all about four days from where she is now.',
        'You are looking at what this game does. There is nothing to say about it.'
      ]
    },
    playerOpts: {
      own: 'Tell the truth about it',
      deflect: 'Play it down',
      defiant: 'Do not be pitied',
      bleak: 'Say how bad it really is'
    }
  }
];
