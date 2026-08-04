/* ============================================================
   TRIBAL Q&A — the social game and the shape of the season.

   Six topics that are not about a challenge result or an empty rice bin. These are
   about what people have done to each other, and about where in the season it
   happened. That makes them the sharpest questions in the set and the ones most
   likely to get a name said out loud, so the tone here runs a notch harder than
   files A and B.

   Why these six sit together. publicFight and toldToFace are the only two pieces of
   the social game Peff is allowed to know about, because both of them happened in
   the open with a camera on them. merged, juryForming and numbersAgainst are the
   season itself telling everybody what kind of game they are now in. quietOne is the
   odd one out and by far the hardest to write, and the note below says what I did
   about that.

   See docs/tribal-qa.md for the contract. No brackets, no asterisks, and every
   answer carries a fact, an image or a position the question did not.

   JUDGEMENT CALLS, written down so nobody has to guess at them later:

   ON quietOne. The premise is that nothing has happened, which is a licence to write
   six flavours of nothing. So every answer here assumes the opposite of nothing: the
   quiet one has been listening the whole time and is keeping a ledger, or the silence
   was decided on the boat and is now being spent, or they never found a way in and
   know exactly why. The reader can fire this topic at the very first council of a
   season, so no line in it quotes a span of days.

   ON numbersAgainst. {big} and {small} are TRIBE names and never people. The reader
   leaves `about` null, which means the engine can hand this question to somebody on
   the comfortable side just as easily as to the underdog. Most answers therefore
   speak about the old {big} and the old {small} in the third person, which works out
   of either mouth. The exceptions are defiant and bleak, where the underdog voice is
   the only one worth reading, and I took that trade on purpose.

   ON toldToFace, {other} is always the player, so it is safe at the start of a
   sentence. In publicFight it is not: the reader falls back to the literal string
   somebody here when it cannot put a second name to the argument, so in that topic
   {other} never opens a sentence or it ships as a lower case word after a full stop.

   ON juryForming, {n} can be as low as 1. Every line that uses it is phrased so that
   a 1 still reads as English, which is why nothing in it says {n} people.

   ON merged, the reader hands over no subs at all, so nothing here quotes a day
   number or a head count. The merge day moves from season to season and a confidently
   wrong number reads worse than a vague one.
   ============================================================ */

'use strict';

const TRIBAL_TOPICS_D = [

  /* ---------------------------------------------------------------
     PUBLIC FIGHT — {who} and {other} went at it in front of everybody.
     Peff can raise this because the whole camp watched it. The content is
     never the argument, it is the four people who stood there and quietly
     decided something while it was happening.
     --------------------------------------------------------------- */
  {
    id: 'publicFight',
    ask: [
      '{who}, you and {other} went at it in the middle of camp. What was that actually about?',
      '{who}, everybody at that camp heard you and {other}. Is it finished, or has it come here with you?',
      'I am told you could hear it from the water line. {who}, tell me about the argument with {other}.',
      '{who}, when you were shouting at {other}, what did you want to happen next?',
      '{who}, has one word been said between you and {other} since, or has it just been left there?',
      '{who}, a camp that size cannot have a private argument. What did the rest of them see?',
      '{who}, you had it out with {other} in daylight with everybody watching. Why there?'
    ],
    answers: {
      own: [
        'I lost my temper over a fishing line. A fishing line. I went back an hour later and said so.',
        'I started it. I had been holding it in for four days and it came out at the worst possible moment.',
        'I brought up something private in front of everybody. That is worse than the shouting and I know it.',
        'I shouted, in the middle of camp, with five people stood there. I have thought about it every hour since.',
        'We both said things. I said the worse one and I am not going to let anybody else carry it for me.',
        'I could have walked it down the beach and said it quietly. I chose the fire pit. That was deliberate.'
      ],
      deflect: [
        'Hungry people in a shelter the size of a car. Something was going to go bang and it went bang.',
        'It was loud and it was over in a minute. There is a lot more heat at that camp than that.',
        'We had it out and then we hauled wood together for an hour. Nobody filmed that bit.',
        'Nothing that happens this late in a season happens for the reason it looks like.',
        'It was about the roof of the shelter. Everything out there is about the roof of the shelter.',
        'If you want to know what is wrong at that camp, it is not that. It is much quieter than that.'
      ],
      blame: [
        'I raised my voice once. Before that I stood there and let {other} go at me for ten minutes.',
        'It happened in the open because {other} wanted an audience. That was the entire point of it.',
        'Ask {other} what got said the night before. That is where it started, not at the fire.',
        'I got told what my job was by somebody who has not lifted a log since we landed.',
        'That was not a fight, that was a performance, and I was the thing being pointed at.',
        'There is one person at that camp who needed everybody to see me angry. It worked beautifully.'
      ],
      defiant: [
        'It was an argument. People have arguments. I am not going to sit here and be ashamed of it.',
        'You want an apology on camera. I gave the real one to the face it belonged to.',
        'I would say all of it again. Louder, if that helps anybody.',
        'Yes, it was in front of everybody. Good. Now nobody has to guess where I stand.',
        'You keep calling it a fight. Nobody swung at anybody. We disagreed at volume.',
        'I am not going to unpick it for you so this bench has something to think about.'
      ],
      wry: [
        'It was the loudest conversation about a coconut in the history of this island.',
        'Two grown adults, forty degrees, one bucket. It writes itself.',
        'I have had worse rows at Christmas and there was food at those.',
        'We were told to make our own entertainment out here.',
        'Everybody else stood very still and watched it like it was weather.',
        'The camp has never been so peaceful as the ten minutes afterwards.'
      ],
      bleak: [
        'That argument decided tonight. Everything since has been people picking a side very politely.',
        'That was the last of the talking. Nobody at that camp has said a full sentence since.',
        'Nothing got fixed. We are both just waiting to find out which name gets written first.',
        'The shouting is not the problem. Four people watched it and made a decision without saying a word.',
        'I knew while I was shouting that it was going to cost me the game. I kept shouting anyway.',
        'Two people cannot be angry in a camp that small. One of us goes, and we both worked that out.'
      ]
    },
    push: [
      'Has either of you said one word to the other since?',
      'Who else at that camp picked a side that afternoon? Somebody must have.',
      'You keep telling me it was about the shelter. Nobody shouts like that about a shelter.',
      'So does tonight settle it, or does one of you carry it out of here?',
      'Everybody here watched it. Is anybody going to tell me what they actually saw?',
      'You say it is finished. Does it look finished from where the rest of you were stood?'
    ],
    chime: {
      own: [
        'I was ten feet away and I said nothing. I should have stepped in and I did not.',
        'Both of them are being generous. It was uglier than either of them has told you.',
        'I have had the same argument with the same person. I just had mine round the back of the shelter.'
      ],
      blame: [
        'One of them had been building to that for a week and it was not the one you are asking.',
        'It was not about a fishing line, and every single person at that camp knows what it was about.',
        'The shouting was not the damage. What got said to other people afterwards was the damage.'
      ],
      wry: [
        'I went and sat in the sea until it was over.',
        'Best afternoon we have had out there. I am grateful to both of them.',
        'I have never been so busy tidying a shelter that was already tidy.'
      ]
    },
    playerOpts: {
      own: 'Admit you started it',
      deflect: 'Blame the heat and the hunger',
      blame: 'Say who wanted an audience',
      defiant: 'Say you would do it again',
      wry: 'Laugh it off'
    }
  },

  /* ---------------------------------------------------------------
     TOLD TO FACE — somebody walked up to {who} and said the name out
     loud. The reader sets {other} to the player, so this is the one topic
     where the council is chewing over something the player did. Being
     warned is either the kindest thing in the game or the cruellest, and
     the stance is what decides which.
     --------------------------------------------------------------- */
  {
    id: 'toldToFace',
    ask: [
      '{who}, {other} walked up to you at camp and told you your name was going down. Why do you think they did that?',
      '{who}, somebody told you to your face that you are the one going home. How did you take it?',
      '{who}, {other} told you straight, in daylight, with no reason to. Did you believe it?',
      '{who}, most people in this game find out when I read the votes. You got told at camp. What did you say back?',
      '{who}, when {other} said your name to you, what did you do with the rest of that day?',
      '{who}, a warning is either a kindness or a threat. Which one was that?',
      '{who}, {other} could have said nothing and let it happen. What do you make of the fact that they did not?'
    ],
    answers: {
      own: [
        'I said thank you and I meant it. Nobody else out here has told me the truth about anything.',
        'I asked one question back. I asked if it was already done. The answer was not no.',
        'I did not argue. I have watched myself become the easy name for three days now.',
        'I shook their hand and then I sat behind the shelter for an hour getting my head straight.',
        'It is the most honest thing that has happened to me out here and it is also the thing that ends me.',
        'I got told to my face and I have not run round camp repeating it. That is my answer.'
      ],
      deflect: [
        'People say a lot at that camp on an empty stomach. Half of it is a mood, not a plan.',
        'One person saying a name is not the same as this bench writing one.',
        'I have heard my own name every three days since we landed. This time it came with eye contact.',
        'I would rather talk about the people who have not said anything to me at all.',
        'It got said, we both moved on, and then we went and fixed the roof together.',
        'Everybody at that camp is being told something. Mine happened to get said out loud.'
      ],
      blame: [
        'They told me because they wanted to watch my face while they did it. There is nothing kind in that.',
        'It was not a warning, it was a test to see who I would run to. I did not run anywhere.',
        'The name came from {other}. The plan did not. That is what I have spent all day working out.',
        'I know exactly who put that in their head, and that person has not looked at me since.',
        'Somebody needed me frightened so tonight would be easy. I have not been frightened once.',
        'I got told by the only person out here who cannot do anything without an audience for it.'
      ],
      defiant: [
        'Told to my face, and I am still sat here holding a vote. Work out what that is worth.',
        'Good. Now I know where every single person in this game stands and I can do something with it.',
        'People have been putting my name down since the first week. It has not taken yet.',
        'I did not thank them and I will not. I do not need a warning to know what game I am in.',
        'You are asking if it shook me. It did not. It gave me a number to work with.',
        'If somebody tells me I am going home, my answer is that I have got a pen as well.'
      ],
      wry: [
        'It is the nicest anybody has been to me out here, and it was to tell me I was finished.',
        'Terrible news. Beautifully delivered. I have no complaints about the service.',
        'I have never been broken up with so professionally.',
        'Days of nobody telling me anything and then that. Bit of a jump.',
        'I said something extremely calm and dignified and then walked straight into the fire pit.',
        'Next time a note would be fine.'
      ],
      bleak: [
        'They told me because it is already done. You do not warn somebody you still need.',
        'I spent the afternoon working out who was left that I could ask. The list was nobody.',
        'Being told early does not save you. It just gives you longer to sit in it.',
        'I have had six hours to think of a case and I have not thought of one. That is the honest state of me.',
        'The worst part is that nobody else came over afterwards to tell me it was not true.',
        'Everybody at that camp already knew. I was the last person out here to hear my own name.'
      ]
    },
    push: [
      'Did anybody else come and tell you the same thing, or was it just the one?',
      'You said the answer was not no. What was it?',
      'Then is there anybody here who can tell {who} tonight that they have got it wrong?',
      'Why would somebody warn a person they intend to vote out?',
      'So what did you do with the rest of that day? Specifically.',
      'Is anybody sat here surprised to hear that got said out loud?'
    ],
    chime: {
      own: [
        'I was there when it got said. Nobody has repeated it since and nobody has taken it back either.',
        'I would want to be told. I am not going to stand here and call that cruel.',
        'It got said in front of me and I did not open my mouth, which I regret more than they do.'
      ],
      defiant: [
        'Telling somebody to their face is not a betrayal. Doing it behind their back is.',
        'If it is true, say it here, in front of the fire, where we can all hear it. I will wait.',
        'I have had my name said to me as well. I did not need a council to help me get over it.'
      ],
      bleak: [
        'That conversation finished one of them and we still do not know which one.',
        'Nobody warns you unless the numbers are already there. That is the part nobody is saying.',
        'I heard it from the shelter and decided right then to keep quiet. So did everybody else who heard it.'
      ]
    },
    playerOpts: {
      own: 'Thank them for the honesty',
      deflect: 'Say talk is not a vote',
      blame: 'Call it a test, not a warning',
      defiant: 'Say you have got a pen too',
      wry: 'Compliment the delivery'
    }
  },

  /* ---------------------------------------------------------------
     MERGED — the first council with everybody in one camp. The feast has
     happened, the flag has changed, and nobody has told the truth since
     lunchtime. Peff cannot ask who is with whom, so he asks about the
     meal, the seating and the handshakes, which gets him the same answer.
     --------------------------------------------------------------- */
  {
    id: 'merged',
    ask: [
      '{who}, one tribe now. One fire, one pot. What was the first night like with all of you sat in it?',
      '{who}, this morning those people were the enemy and tonight you eat off the same plate. Has that landed yet?',
      '{who}, everybody here has spent weeks trying to beat each other. What changed when you walked into that camp?',
      '{who}, a merge feast is where people are at their most charming. Who was the most charming?',
      '{who}, new flag, new name, one camp. Does anybody actually believe in it?',
      '{who}, who did you find yourself sitting next to this afternoon, and did you choose it?',
      '{who}, half of this bench does not know your name yet. Is that a problem or an opportunity?'
    ],
    answers: {
      own: [
        'I ate too fast and I talked too much. Both of those are going to cost me something tonight.',
        'I walked in and hugged people I have wanted to beat for weeks. It felt fake in my own hands.',
        'I made a promise before the rice had gone cold. I still do not know whether I meant it.',
        'I spent the whole feast counting instead of eating. That is apparently who I am now.',
        'I chose my seat on purpose and every single person watched me choose it.',
        'First thing I did was find the person I trust least and be lovely to them for an hour.'
      ],
      deflect: [
        'It is one camp. Everybody keeps talking about it as two and it has not been two since this morning.',
        'It was rice and chicken and a lot of people being extremely careful with each other.',
        'Not one honest sentence got said at that feast, and that is completely normal.',
        'I have not thought about tonight. I have thought about the fact that I got to eat.',
        'The tribes stopped mattering at the top of that hill. Some people have not caught up.',
        'You are asking me to draw you a line down the middle of that camp. I sat down and I ate.'
      ],
      blame: [
        'One person was shaking hands before they had put their bag down. Watch that person tonight.',
        'Four of them arrived together and have not been ten feet apart since. That is not friendship, it is a formation.',
        'Somebody here spent the whole feast up in the trees having conversations. Ask them how many.',
        'I know which of them came over to talk to me and which came over to count me. It is in the eyes.',
        'The people being warmest to me tonight did not know my name at breakfast.',
        'There is a group here that settled all of this before the old flag came down, and I was not asked.'
      ],
      defiant: [
        'I do not need these people to like me. I need them to think I am worth keeping one more week.',
        'New tribe, same game. I am not going to act grateful for a plate of rice.',
        'They can hold onto their old lines. I intend to break one of them tonight.',
        'Everybody is pretending this is a fresh start. I have not forgotten a single thing that happened.',
        'I came over that hill with nothing and I am still the most dangerous person on this bench.',
        'You are waiting for somebody to say we are all one tribe now. It is not going to be me.'
      ],
      wry: [
        'I have not eaten off a plate in weeks and I had forgotten how. That was witnessed by everybody.',
        'One pot, all of us round it, and every conversation somehow about the dog somebody left at home.',
        'I have learned four new names today and three of them are already problems.',
        'It was the friendliest afternoon of my life and I did not trust one second of it.',
        'We passed the food round in a circle like a family. A family doing arithmetic.',
        'I have never seen so much hugging between people counting to six.'
      ],
      bleak: [
        'The people who know me came over that hill with me and there are not enough of them. That is my position.',
        'The smiling stopped the second the plates were empty. Everybody went off to find their own people.',
        'Tonight is somebody clearing out the smaller group before it has a chance to grow.',
        'A merge is where the people who were losing find out the whole thing got decided without them.',
        'I ate more this afternoon than in the last week and I feel worse than I did this morning.',
        'Half of these people already know how tonight goes. You can tell by which ones are relaxed.'
      ]
    },
    push: [
      'So has anything actually changed, or have you all just moved house?',
      'You said you were counting. Did the counting come out in your favour?',
      'Does anybody at this fire believe this is one tribe?',
      'Who here have you still not spoken to? Right now, tonight, name them.',
      'Is anybody sat here still wearing the old tribe in their head?',
      'Then the old lines are still the lines. Is that what everybody else is hearing?'
    ],
    chime: {
      own: [
        'I came in with my lot and I have not left their side once. I am not going to pretend that is a coincidence.',
        'I ate their food this afternoon and I am going to write one of their names down. I would rather say it here.',
        'I have known these people for six hours and I have already made up my mind about them.'
      ],
      blame: [
        'Watch who got up from that fire first and watch who followed them. There is your answer.',
        'One person has spoken to every single one of us on their own since lunchtime. Every one.',
        'They arrived and immediately started asking who was on the bottom. That is not small talk.'
      ],
      bleak: [
        'The feast is the last nice thing that happens. Everybody here knows what tonight is for.',
        'A smaller group walked into a bigger camp. Everybody sat here knows how that story goes.',
        'We sat round in a circle and every one of us was working out where we came in the order.'
      ]
    },
    playerOpts: {
      own: 'Admit you counted instead of eating',
      deflect: 'Say it is one tribe now',
      blame: 'Point at who arrived working',
      defiant: 'Say nothing is forgotten',
      wry: 'Joke about the feast'
    }
  },

  /* ---------------------------------------------------------------
     JURY FORMING — there are people out there in the dark now who cannot
     vote but decide the winner. This is the topic that changes how the
     bench talks, because every answer is being said twice: once to Peff
     and once to the people you sent home.
     --------------------------------------------------------------- */
  {
    id: 'juryForming',
    ask: [
      '{who}, that is {n} on the jury now, sat out there deciding who wins. Does it change how you talk tonight?',
      '{who}, you are being watched by people you voted out. How does that feel from where you are sat?',
      '{who}, every face on that jury remembers exactly what you did to them. Are you playing to them tonight?',
      '{who}, the jury is up to {n}. Is tonight about the vote, or about the people watching the vote?',
      '{who}, when you look over at that jury, who do you least want to look at?',
      '{who}, they are out there listening to every word of this. Say something you want them to hear.',
      '{who}, is there anybody on that jury you still owe an explanation to?'
    ],
    answers: {
      own: [
        'One of them I sent home myself, and I have not managed to look over there once tonight.',
        'I am not going to perform for them. If they want a reason to vote for me it is already on the record.',
        'Every decision out here has been mine and I will say each one to their faces at the end.',
        'I said something at a vote weeks ago that I still hear in my own voice. Whoever it was is out there.',
        'They watched me lie. No speech at the end fixes that, so I am not going to insult them with one.',
        'I want to win this with people who understand why I did it. So from here I do it where they can see.'
      ],
      deflect: [
        'The people out there are not my problem tonight. The people on this bench are.',
        'You cannot play the end of a game in the middle of it. I am still trying to get through a Wednesday.',
        'I will worry about that conversation on the last night. Tonight I have to survive tonight.',
        'Everybody on this bench ends up out there eventually. That keeps a person humble.',
        'I do not think about the jury. I think about the eight hours after this one.',
        'They know what this place does to people. They lived in it too.'
      ],
      blame: [
        'There is somebody on this bench who has done all their damage through other people. The jury cannot see it.',
        'Everybody is very gracious now there is an audience. It was not gracious at camp yesterday.',
        'One person here has completely changed how they talk since the jury started sitting. Completely.',
        'The count out there is {n} and every one of them is angry at somebody who is not me.',
        'The person getting the credit out there is not the person who did the work in here.',
        'They are watching the wrong people. The quiet ones have done more damage than any of us.'
      ],
      defiant: [
        'I am not campaigning at a fire. If they want a winner who begs, they are watching the wrong bench.',
        'Let them watch. I have not done one thing out here that I would take back.',
        'They got out there by losing. I am not going to apologise for being better at this than they were.',
        'I do not need every one of them to like me. I need them to respect the game I played.',
        'If being honest at this fire costs me a vote out there, that vote was never mine.',
        'I would rather lose with all of them furious at me than win by having been nobody.'
      ],
      wry: [
        'I have never been so aware of my own posture.',
        'Nothing sharpens your manners like an audience you personally created.',
        'Welcome to the jury. Sorry about the seating and about most of the last two weeks.',
        'It is a very quiet crowd for people who used to have so much to say.',
        'I keep smiling over there like I am at a wedding I ruined.',
        'Every one of them looks extremely well fed and extremely unforgiving.'
      ],
      bleak: [
        'They are out there in clean clothes and I am in the shirt I landed in. That is the gap in this game.',
        'One of them stopped speaking to me the day I wrote their name. That is what this costs.',
        'Nobody on this bench gets all of them. Whoever wins, most of that jury voted against somebody.',
        'Everything I do from here is being remembered by people who have nothing left to do but remember.',
        'I am going to be sat out there with them soon. That is the honest arithmetic of it.',
        'There are more people watching this now than sat here playing it, and it stays that way.'
      ]
    },
    push: [
      'You said they know the reasons. Do they know all of them?',
      'Is there anybody out there tonight you would not want to face at the end?',
      'So who on this bench does that jury already like?',
      'Then say it to them now. They are right there and they can hear you.',
      'Does anybody here disagree that the wrong people are getting the credit?',
      'What is the one thing you have done out here that you would not want repeated to them?'
    ],
    chime: {
      own: [
        'I sent one of them home and I have not slept properly since. I am not looking for sympathy for that.',
        'I know exactly what I look like from out there. I chose it anyway.',
        'Whoever wins has to explain themselves to people they lied to. That is all of us, not one of us.'
      ],
      defiant: [
        'I am not softening one thing because they are sat out there listening.',
        'If a jury will not vote for somebody who played hard, then the jury is the problem.',
        'Nobody got out there by accident. That was all of us, together, every single time.'
      ],
      wry: [
        'They have had showers. That is the part I resent and I have decided to be honest about it.',
        'I had a very moving speech ready for them and I have forgotten every word of it.',
        'Look at them out there judging us. I would as well. I did.'
      ]
    },
    playerOpts: {
      own: 'Speak straight to the jury',
      deflect: 'Say tonight comes first',
      blame: 'Say who the jury cannot see',
      defiant: 'Refuse to campaign',
      wry: 'Joke about the audience'
    }
  },

  /* ---------------------------------------------------------------
     QUIET ONE — {who} has barely registered. The trap is writing five
     ways of saying not much has happened, so nothing in here does. Either
     the silence was a plan being saved up, or they have been keeping a
     very careful ledger, or they never found a way in and can say exactly
     when they stopped trying. All three are more interesting than shy.
     --------------------------------------------------------------- */
  {
    id: 'quietOne',
    ask: [
      '{who}, I have watched you say almost nothing out here. Is that on purpose?',
      '{who}, nobody on this bench can tell me what you want. Do you know how unusual that is?',
      '{who}, when I ask about you, I get a pause and then somebody changes the subject. What do you make of that?',
      '{who}, you have not raised your voice once. Not once. Is there anything you would raise it about?',
      '{who}, being hard to read is either a strategy or a problem. Which one are you?',
      '{who}, you have been at that camp every single day and I could not tell you one thing you believe. Fix that.',
      '{who}, tell me something you have noticed at that camp that nobody else has said out loud.'
    ],
    answers: {
      own: [
        'I decided on the boat that I would listen until it mattered and then say one thing. This is the one thing.',
        'I have not said much because everything I wanted to say would have finished somebody. I am done saving it.',
        'I know who wrote which name at every vote so far. I worked it out from where people were standing.',
        'I am quiet because I am frightened of being interesting. That is true and it is a terrible plan.',
        'I have been counting. Two people here said my name to somebody else this week and I know which two.',
        'I talk when I have got something. I have got something now and I would rather say it before the vote.'
      ],
      deflect: [
        'It is a loud camp. Somebody has to be carrying the water while the meetings happen.',
        'An enormous amount gets said out there and almost none of it changes anything. I stopped adding to it.',
        'I talk plenty. Just not with six people and a fire and everybody watching my face.',
        'Ask me about the tide or the crab holes and I will not shut up. Nobody has asked.',
        'Everybody at that camp is performing something. I did not think there was a part left for me.',
        'Quiet is not the same as absent. I have been at every single thing that has happened out there.'
      ],
      blame: [
        'I tried twice. Both times somebody talked over the top of me and looked at somebody else while I finished.',
        'There is a group out there that settles things before breakfast and tells the rest of us at lunch.',
        'I have not been quiet. I have been ignored. From where you are sitting those look identical.',
        'One person has answered every question I have been asked since the beginning. Watch it happen tonight.',
        'I said something useful one morning. Somebody repeated it that afternoon and got thanked for it.',
        'They call me hard to read because that is easier than admitting nobody has asked me a question.'
      ],
      defiant: [
        'You have all decided I am not playing. My vote weighs exactly what any of yours does.',
        'I do not owe this bench a personality.',
        'You are asking me to make myself easier to vote out. No.',
        'I have been in front of all of you every day and none of you know one true thing about me. That was the idea.',
        'Loud people go home. I have watched that happen at every one of these.',
        'If being quiet was not working I would not still be sat here, would I.'
      ],
      wry: [
        'I am extremely interesting. I have simply had no opportunities.',
        'I saved every word I have got for this exact moment and now there is a camera on me.',
        'All that nodding. My neck is the fittest part of me.',
        'I did try to join a conversation about a bird once. It went badly for everybody.',
        'I have heard every single thing said at that camp. Some of it twice, on purpose.',
        'You want a headline out of me. I have been the weather report.'
      ],
      bleak: [
        'I never found a way in. Not one conversation that went anywhere, and I am not going to find one now.',
        'Nobody out here has had to lie to me, because nobody out here has told me anything.',
        'I go to sleep listening to people plan around me. They have stopped bothering to lower their voices.',
        'The quiet is not a choice. I do not know how to talk to people who are all frightened of each other.',
        'I am the name people write when they cannot agree on anything else. That is my whole position tonight.',
        'I stopped talking the first time I was talked over and not one person noticed I had stopped.'
      ]
    },
    push: [
      'You just told me you know who wrote what. Say a name then.',
      'Does anybody at this fire disagree that they have been ignored?',
      'Then why has nobody at that camp gone to them? Anybody?',
      'That is the most you have said all season. Why tonight?',
      'You said you tried twice. Who talked over you?',
      'Is that how the rest of you see it, or is this news to everybody here?'
    ],
    chime: {
      own: [
        'I have not asked them a single question since we landed. I am hearing that now and it is on me.',
        'I did talk over them. I remember doing it and I remember exactly why I did it.',
        'Everything they just said about that camp is accurate, and I have never heard them say twenty words.'
      ],
      blame: [
        'It is very easy to be nobody all season and then turn up at the end with clean hands.',
        'Being quiet is a strategy and it is working, and I would like everybody here to watch it work.',
        'They have not carried one hard conversation out there. Other people have had to do all of it.'
      ],
      wry: [
        'I have been talking at them since day one. I had no idea it was a conversation.',
        'Turns out the person listening to everything was the person listening to everything.',
        'Everything I have said at that camp, I would now like back please.'
      ]
    },
    playerOpts: {
      own: 'Say why you kept quiet',
      blame: 'Say you were talked over',
      defiant: 'Refuse to explain yourself',
      wry: 'Joke about the silence',
      bleak: 'Admit you never found a way in'
    }
  },

  /* ---------------------------------------------------------------
     NUMBERS AGAINST — the old {big} outnumber the old {small} by {gap}
     and everybody at this fire can count. Peff is allowed this one
     because nobody has to be told who they marooned with. The tension is
     that arithmetic is only true until one person decides they would
     rather win than be safe.
     --------------------------------------------------------------- */
  {
    id: 'numbersAgainst',
    ask: [
      '{who}, there are {gap} more of the old {big} sat here than the old {small}. Everybody can count. What happens now?',
      '{who}, the old {big} are up by {gap}. Has anybody from the old {small} got a way out of that?',
      '{who}, if the old {big} all write the same name tonight this is arithmetic, not a game. Is that where we are?',
      '{who}, {gap} is the number. Has anybody from the old {big} given you a reason to hope?',
      '{who}, you all know exactly who came from where. Why would the old {big} ever break?',
      '{who}, the old {small} are down {gap}. When did you work that out, and what did you do about it?',
      '{who}, everybody at this fire can count to {gap}. What is the conversation nobody is having?'
    ],
    answers: {
      own: [
        'I can count. The old {big} have {gap} more and I am not going to pretend that is an accident.',
        'I chose my side on the beach the day we merged and I have not moved off it since. That is the answer.',
        'The old {big} are voting together tonight. I know because I would be doing exactly the same thing.',
        'I have had the conversation. I asked somebody from the old {big} straight out and they said no to my face.',
        'If tonight goes on tribe lines it is partly because I helped keep those lines drawn. I own that.',
        'Nobody has crossed. I have asked every person I could ask and the answer has been no every time.'
      ],
      deflect: [
        'Nobody chose {big} or {small}. We got handed a flag on a beach and now it is a life sentence.',
        'A gap of {gap} on paper is not a gap when people actually have to write a name down.',
        'The old lines break. They always break. It is only ever a question of who gets nervous first.',
        'I am not thinking about {big} or {small}. I am thinking about who has been decent to me since the merge.',
        'Everybody keeps talking to me about numbers. Not one person has talked to me about a name.',
        'You are asking me to make it two tribes again. It stopped being two tribes at the top of that hill.'
      ],
      blame: [
        'The old {big} walk down to the water together in a group. That is not thirst, that is a headcount.',
        'There is one person in the old {big} holding all of it together. If they blink the whole thing goes.',
        'Somebody from the old {small} has already gone across. A conversation stopped dead when I walked up.',
        'Ask the old {big} who did the maths for them out loud. Somebody stood up and did it.',
        'The gap is {gap} because the old {small} spent two councils voting out their own strongest people.',
        'I know which of the old {big} is unhappy in there. They have not got the nerve to be the one who moves.'
      ],
      defiant: [
        'A gap of {gap} means nothing if one of them has had enough. I only need the one.',
        'The old {big} think this is finished. That is the most useful thing about them.',
        'You want me to concede at a fire. I have not written my own name down yet.',
        'Count all you like. Numbers hold right up until somebody would rather win than be comfortable.',
        'They can keep their {gap}. I have got something they have not thought about and I am not saying it here.',
        'The old {small} are not going quietly. Whatever happens tonight, somebody over there remembers it.'
      ],
      wry: [
        'It is a beautiful plan. It is also just counting, which my nephew can do.',
        'The old {big} have been extremely loving this week. Right up to the exact edge of being useful.',
        'I have never been so popular with people who do not need me for anything.',
        'Somebody drew the whole thing in the sand for me. Then the tide came in, which felt about right.',
        'Down by {gap}, so I have switched to being charming. It is going about as well as you would expect.',
        'The old {big} sat down over there in the same order they always sit in. Nobody noticed. Everybody noticed.'
      ],
      bleak: [
        'The old {small} go home one at a time in an order that is already decided. I could tell you the order.',
        'There is nothing to play for tonight. There is a gap of {gap} and a list, and I am on the list.',
        'We spend the whole day being pleasant to people who intend to vote us out in sequence.',
        'The old {big} do not even have to lie to us. They only have to wait.',
        'This is not a vote, it is a queue. The only question left is where in it I am standing.',
        'The worst of it is that nobody is cruel about it. Everybody is very kind and it changes nothing.'
      ]
    },
    push: [
      'Then is there anybody sat here from the old {big} willing to break it?',
      'You said you asked. Who did you ask?',
      'Does anybody from the old {small} think there is a way through tonight?',
      'So why would anybody in the old {big} take a risk when they can simply wait?',
      'Everybody has talked to me about numbers. Has anybody here talked about a name?',
      'Is the old {big} as solid as this bench seems to think it is?'
    ],
    chime: {
      deflect: [
        'Nobody here has said the word {small} in three days. It is one camp now, whatever the counting says.',
        'I have not been asked to vote against a tribe. I have been asked about a person, which is different.',
        'Both flags are in the ocean. Some people out here are still holding onto theirs.'
      ],
      defiant: [
        'The old {big} are not a wall. They are people who each want to win on their own, which is not the same.',
        'If it holds tonight it does not hold at the next one. Somebody over there is doing their own maths.',
        'I came from the old {small} and I am still sat here. That has to be bothering somebody.'
      ],
      bleak: [
        'A gap of {gap} does not go away because we all say something brave at a fire.',
        'We had this exact conversation last night and it ended with everybody looking at the sand.',
        'Whoever goes tonight, the next one is already picked. That is what a number like that does.'
      ]
    },
    playerOpts: {
      own: 'Admit you can count too',
      deflect: 'Say the tribes are gone',
      blame: 'Say who is holding it together',
      defiant: 'You only need one of them',
      wry: 'Joke about the arithmetic'
    }
  }
];
