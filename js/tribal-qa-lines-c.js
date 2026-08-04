/* ============================================================
   TRIBAL Q&A — the vote, and the shape of the game.

   Six topics about the only thing at this council that every person sat on the
   bench witnessed together: the last time they did this. Peff read those votes
   out himself, so the count, the tie, the revote and the name are all his to
   raise. That makes this the one area where he can be specific and still be
   fair — he is not guessing at anybody, he is quoting the record.

   These run hotter than the challenge topics in file A, because a vote is not a
   shared misfortune. Somebody wrote something down. Somebody else read it and
   has had two days to think about who. Which brings up the detail that shaped
   most of the lines in here:

   COUNCILS ARE EVERY TWO DAYS. CONFIG.tribalDays is [2, 4, 6, ...], so "the last
   council" is always the day before yesterday, never last week. Any line that
   says three days ago is a line that is wrong. It also means firstTribal happens
   on DAY 2 — these people have known each other for about forty-eight hours and
   one of them is going home over it. Every firstTribal line is written to that
   clock, which is why nobody in that topic claims to have a read on anybody.

   On {who}: as in file A it is always the speaker or the person spoken to. Only
   repeatTarget has a named subject, so only repeatTarget puts pressure on a
   person; the other five are addressed to whoever the engine picked off the
   bench, and their answers are first person for that reason.

   JUDGEMENT CALL ON idolWasPlayed. The reader emits it with about: null, so the
   engine can hand these answers to anybody sitting there — including four people
   who did not play the thing. So none of these answers claims to be the one who
   played it. They are all written from the point of view of somebody who WATCHED
   it happen and had a vote eaten. A line like "I played it" would be a lie in
   four mouths out of five, and a lie the player can check against the tally.
   The player of it gets no lines here. That is deliberate.

   SECOND JUDGEMENT CALL, same topic. Peff may not say the word, so his asks
   circle it: what came out of a bag, what the maths did, what everybody watched.
   This turned out better than saying it plainly would have. He sounds like a man
   being careful, which is what he is. The castaways say idol as often as they
   like, because it is their information to spend.

   FLAG FOR THE READER, NOT A WRITING PROBLEM. fLastSplit accepts margin <= 1,
   which includes margin 0 — and a margin of 0 is a tie, which fLastTie already
   owns. If lastTie has been used earlier in the season, lastSplit can fire on a
   0 ballot and any line saying "{margin} vote" renders as "0 vote". Half the
   phrasings in lastSplit deliberately avoid the number so the pool still has
   somewhere safe to land, but the real fix is a margin >= 1 guard in the reader.

   See docs/tribal-qa.md. No brackets, no asterisks, no contractions, and every
   answer carries a fact, an image or a position the question did not have.
   ============================================================ */

'use strict';

const TRIBAL_TOPICS_C = [

  /* ---------------------------------------------------------------
     LAST UNANIMOUS — every ballot said {gone}. Reads as a tidy tribe and
     is actually the most frightening result on the board, because it is
     proof the group can move as one body without warning the target. The
     answers avoid naming a tribe size, since the count varies by night.
     --------------------------------------------------------------- */
  {
    id: 'lastUnanimous',
    ask: [
      '{who}, every ballot last time had the same name on it. Does that make this tribe united, or does it make it frightening?',
      'Not one vote went anywhere else last council. {who}, did {gone} have any idea?',
      '{who}, {gone} went home without a single name being wasted. How does a group get that tidy?',
      'That was clean, {who}. Is a clean vote a good sign or a warning?',
      '{who}, by the third vote I read there was no suspense left in it. What was that like from where you sat?',
      'Last council everybody agreed. {who}, does everybody still agree?'
    ],
    answers: {
      own: [
        'I wrote {gone} down and I said it to their face at the water barrel first. It was still ugly.',
        'Everybody agreed because I spent that afternoon asking everybody to agree. That was me.',
        'It was tidy because we made it tidy. Nobody dragged me anywhere and nobody had to.',
        'I did the counting and I got every one of them right. I have thought about that both nights since.',
        'We kept it clean so {gone} would not have to sit here working out who was against them.'
      ],
      deflect: [
        'It was unanimous because the reason was obvious. There was nothing left to argue about.',
        'A camp that agrees on one thing is not a camp that agrees on everything.',
        'It looked tidy from where you are stood. It took two long conversations at the shelter to get there.',
        'Everybody landing on the same name once tells you nothing at all about tonight.',
        'That vote is read and finished. I am more interested in who is fetching water tomorrow.'
      ],
      blame: [
        'Somebody sat here said the same sentence to all of us and the opposite one to {gone}.',
        'Unanimous means one person got to everybody. Ask yourself who had the time to do that.',
        'I voted with the group because I can count. The person who built that number is still here.',
        'There is somebody at this fire who wrote {gone} down and then cried on the walk back.',
        'It was easy for one person and hard for the rest of us. That is the part I have not let go of.'
      ],
      defiant: [
        'It was unanimous. That is not a crime, that is a decision.',
        'You would like me to be worried about the one vote I got right.',
        'Everybody agreed and everybody is still sat here. I would call that working.',
        'I do not owe {gone} an apology for being one name out of all of them.',
        'If it frightens people that this tribe can agree on something, good.'
      ],
      wry: [
        'It is the only thing this tribe has ever done properly together.',
        'Every ballot the same. Put that in a challenge and we would finally win one.',
        'Turns out our one shared skill is spelling {gone}.',
        'I have never seen us that organised. It was almost beautiful.',
        'We cannot keep a fire lit but we can all write the same word. Priorities.'
      ],
      bleak: [
        'Unanimous means {gone} sat where I am sitting and watched every friend they had do it.',
        'Nobody warned {gone}. That is what a tidy vote costs, and it will cost somebody else tonight.',
        'This group can move as one thing. Whoever it moves at next will not see it either.',
        'We were lovely to {gone} all day and then we all did the same thing at the same moment.',
        '{gone} split their fish with me that morning. That is the bit I keep coming back to.'
      ]
    },
    push: [
      'So who did the asking? Somebody made that happen.',
      'Did anybody here think about writing a different name? Anybody at all?',
      'Then it can happen again tonight, exactly the same way. Does that worry anyone?',
      'Was {gone} told, or did {gone} find out when I started reading?',
      'Everybody agreeing is either trust or it is fear. Which one was it?'
    ],
    chime: {
      own: [
        'I wrote it as well. I am not going to hide behind the word unanimous.',
        'She asked me and I said yes in about four seconds. That is on me, not on her.',
        'We told {gone} the night before. Not everybody did. We did.'
      ],
      blame: [
        'He is calling it agreement. I was told what to write and I wrote it.',
        'One person here has been very quiet for two days and it is not grief.',
        'Unanimous is a lovely word for what actually happened to {gone}.'
      ],
      bleak: [
        'It was unanimous and it took one conversation. That is what this camp is now.',
        'Nobody slept properly after that and every one of us pretended we had.',
        'The next one will be tidy too. That is the only thing anybody learned.'
      ]
    },
    playerOpts: {
      own: 'Admit you built the vote',
      deflect: 'It was obvious, not a plot',
      blame: 'Say who got to everybody',
      wry: 'Joke about our one skill'
    }
  },

  /* ---------------------------------------------------------------
     LAST SPLIT — decided by {margin}, so there is a losing side sat on
     this bench and it has known the exact count for two days. Peff can
     press here without revealing anything, because the tally was read
     out loud. The heat is that somebody moved and everybody wants a name.
     --------------------------------------------------------------- */
  {
    id: 'lastSplit',
    ask: [
      '{who}, that vote came down to {margin}. Does everybody here still know which side they were on?',
      'Last council was decided by {margin} vote. {who}, has anything changed in two days?',
      '{who}, {gone} went home by {margin}. That means a lot of people at this fire lost that vote.',
      '{who}, when I got to the end of those votes it was still live. What was going through your head?',
      'A vote that close leaves a losing side, {who}. Is that side still sitting here?',
      '{who}, {margin} is not a verdict, it is a coin landing. How does a camp come back from that?'
    ],
    answers: {
      own: [
        'I was on the losing side of it and I have not pretended otherwise for a second.',
        'I changed my mind on the bench. That margin is me. That is the whole story.',
        'I wrote {gone} down and I was the last one to decide it. I know what that makes me.',
        'It was close because I made it close, and I would not go back and tidy it up.',
        'I told {gone} they had my vote and then I did not give it to them. That one is mine.'
      ],
      deflect: [
        'Close votes happen when people are actually thinking. I prefer that to a rubber stamp.',
        'It went the way it went. Flip it over and we would all be sat on this bench anyway.',
        'Nobody has raised it at camp since. We went back, we boiled water, we slept badly.',
        'A tight count is not a broken camp. It is a camp with two opinions in it.',
        'That vote was read out already. I am not going to run it again for the cameras.'
      ],
      blame: [
        'Somebody promised {gone} they were safe. That is why it went the way it did and not the other way.',
        'Two people told me one thing at the well and did something else at that table.',
        'You want to know who moved. So do I, and I have a name in my head already.',
        'There is a person here who has spent two days explaining a vote they were happy with.',
        'It was that close because one person was working both ends and got caught halfway.'
      ],
      defiant: [
        'A win by {margin} is a win. Ask {gone} whether the number mattered.',
        'I am not apologising for being on the side that had one more.',
        'You keep saying close. It closed.',
        'Everybody here can count. Nobody here needs help from me with it.',
        'If you are waiting for the losing side to crack tonight, look at somebody else.'
      ],
      wry: [
        'We managed to make a vote exciting, which is more than we manage at a challenge.',
        'One more name the other way and I would be having a completely different evening.',
        'Two plans, one name, and the better plan was whichever one had {margin} more.',
        'I have never been so pleased to be barely correct about anything.',
        'It was so close I have started congratulating people carefully.'
      ],
      bleak: [
        'A count like that tells everybody exactly how many friends they have. Mine did not add up.',
        '{gone} went by {margin} and now every one of us knows the shape of this camp. That does not go away.',
        'The losing side is sat at this fire and it has had two days to get properly angry.',
        'We are split down the middle and we are starving. Only one of those has a fix.',
        'Whichever way tonight goes, somebody here has already learned they are on the short side.'
      ]
    },
    push: [
      'Somebody moved. Is the person who moved going to say so at this fire?',
      'Then there are two groups at that camp. Does either of them still have the numbers?',
      'Did {gone} know it was going to be that close?',
      'Is anybody sat here carrying a grudge out of that vote? Be honest with me.',
      'You said it is finished. Finished for everybody, or just for the side that won?'
    ],
    chime: {
      own: [
        'I was the one who moved. I would rather say it here than have it guessed at all week.',
        'I lost that vote and I have been sulking about it for two days. That is the truth of it.',
        'She is being straight. I was on the other side and she told me so before we sat down.'
      ],
      blame: [
        'He knows who moved. Everybody who walked back from here knows who moved.',
        'One person voted with us and then spent the next morning apologising to {gone}.',
        'It was that close because somebody wanted it both ways and very nearly got it.'
      ],
      wry: [
        'I would like the record to show I was on the winning side, purely as a fact.',
        'We are so evenly matched that I have started preparing for a draw.',
        'Best vote of the season. Terrible evening for everybody involved.'
      ]
    },
    playerOpts: {
      own: 'Admit you were the swing',
      deflect: 'Close is not the same as broken',
      blame: 'Say who moved',
      bleak: 'Say the camp is cut in two'
    }
  },

  /* ---------------------------------------------------------------
     LAST TIE — nobody blinked, so they all had to sit there and do it
     again, and on the second one somebody broke their word in front of
     everybody. That is the content: not the tie, the revote. A tie also
     publishes the exact size of both halves, which nobody can unsee.
     --------------------------------------------------------------- */
  {
    id: 'lastTie',
    ask: [
      '{who}, that was a tie. Somebody had to change their mind on the second vote. Was it you?',
      'I had to send you all back to that table, {who}. What changed between the first vote and the second?',
      '{who}, a tie means this tribe was exactly even and both halves know the number. Is it still even?',
      '{who}, {gone} survived the first vote and not the second. How does anybody trust anything after that?',
      '{who}, you voted twice and got a different answer. Which one of those was the honest one?',
      'Nobody blinked the first time, {who}. Somebody blinked the second time. Has that been discussed?'
    ],
    answers: {
      own: [
        'I changed on the revote. That was me and I would rather say it with my own mouth.',
        'I held both times and I watched somebody else move. I am not going to hate them for it.',
        'I tied it. I knew it would tie and I did it anyway, because I was not writing my friend down.',
        'The second time I wrote {gone} and my hand was not steady. That is as honest as I get.',
        'We were even because I would not move, and then I moved. Both of those belong to me.'
      ],
      deflect: [
        'A tie is two plans arriving at the same table. Somebody always has to give.',
        'It went to a revote and the revote settled it. That is the game doing what it does.',
        'Nobody has brought it up at camp. We had bigger problems, and one of them was water.',
        'I would rather sit in a tie than in a room where nobody has an opinion worth having.',
        'It resolved. There are much worse ways a tie can end and everybody here knows them.'
      ],
      blame: [
        'Somebody swore the same thing to two people and then had to pick one. That is your tie.',
        'The person who changed on the revote is sat here and has not mentioned it once since.',
        'It tied because one person counted wrong, and it ended because that person got frightened.',
        'I know who moved and I know what they were offered. I will only say the first part.',
        'Ask whoever went for water twice that afternoon. They will know exactly what I mean.'
      ],
      defiant: [
        'I did not move. Not the first time, not the second. Ask anybody at this fire.',
        'A tie is not a scandal. It is arithmetic that failed to come out.',
        'You sent us back and we came back with a name. I do not know what else you want.',
        'I am not being cross examined about a vote I was happy to write twice.',
        'Everybody expected that night to break somebody. It did not break me.'
      ],
      wry: [
        'Best of three next time. I have built up the stamina for it now.',
        'I was rather hoping we would keep going until dawn and really settle it.',
        'I have written more names this season than I have eaten meals.',
        'Two votes, one result, no food. Marvellous evening all round.',
        'I got to vote twice and it still did not go the way I wanted. That is my luck.'
      ],
      bleak: [
        'A tie tells everybody the exact size of both sides. Nobody at that camp has forgotten it.',
        'We sat there in the dark while one person decided whether their word meant anything.',
        'Somebody broke a promise in front of all of us and then we all went back and slept beside them.',
        '{gone} was told they were safe twice and went home anyway. Work out what that is worth.',
        'That was the night this camp stopped pretending. It has been colder ever since.'
      ]
    },
    push: [
      'Somebody changed their vote. Is that person going to own it here?',
      'Then both halves are still sat in front of me. Which half thinks it is bigger tonight?',
      'Did {gone} know they were half of a tie?',
      'Is there anybody here who was given a promise that night and did not get it?',
      'You are all very calm about a night that needed two votes. Is that real?'
    ],
    chime: {
      own: [
        'It was me on the revote. I have been waiting two days for somebody to ask me.',
        'I put {gone} into the tie and then I finished it. Both halves of that were mine.',
        'He held. I want that said out loud, because I did not.'
      ],
      blame: [
        'Somebody found their conscience for exactly one vote and then mislaid it again.',
        'He says arithmetic. It was a promise, and a promise has a person attached to it.',
        'The tie was an accident. What happened after it was not an accident.'
      ],
      defiant: [
        'I am not going to be made to feel bad for using the second vote properly.',
        'You want a confession. It went to a revote. That is what revotes are for.',
        'Every one of us would have moved. One of us actually had to.'
      ]
    },
    playerOpts: {
      own: 'Admit you flipped on the revote',
      deflect: 'A tie is only arithmetic',
      blame: 'Say who broke a promise',
      defiant: 'You held both times'
    }
  },

  /* ---------------------------------------------------------------
     IDOL WAS PLAYED — public the second it hit the mat, and it rewrote
     what everybody thinks counting is worth. Peff cannot say the word,
     so he points at the effect instead. Nobody in these answers claims
     to have played it; see the header for why that is deliberate.
     --------------------------------------------------------------- */
  {
    id: 'idolWasPlayed',
    ask: [
      '{who}, we all watched something come out of a bag at that council. Has that camp stopped talking about it yet?',
      '{who}, the maths on that table changed in about four seconds. Where did it leave you?',
      '{who}, one person here had something the rest of you did not know existed. What does that do to how you count?',
      'After what this tribe watched happen, {who}, does anybody at that camp still make a plan?',
      '{who}, a set of votes got thrown away in front of all of you. Are you counting differently tonight?',
      '{who}, somebody was carrying that around while the rest of you walked past it. How does that sit?'
    ],
    answers: {
      own: [
        'I wrote a name and an idol ate my vote. I got played and I am not going to dress that up.',
        'I was in the group that got it wrong. We were all counting and not one of us was looking.',
        'We had a plan and we deserved to lose it. Nobody asked the one question that mattered.',
        'I spent that whole day certain of a number. The number was never real.',
        'It cost us a night and it cost us a person, and I helped build the thing that failed.'
      ],
      deflect: [
        'Somebody found an idol and used it well. That is the game working the way it is meant to.',
        'It changed one night. It has not changed who is hungry and who has a dry place to sleep.',
        'People keep asking me about last week. I would rather talk about tomorrow morning.',
        'Any one of us could have gone looking. Most of us were carrying water instead.',
        'There is nothing to unpick. A thing existed, it got used, we are all still on this beach.'
      ],
      blame: [
        'One person here knew and let the rest of us walk straight into it. That is not clever, it is cold.',
        'The idol is not what bothers me. Being told there was nothing to worry about bothers me.',
        'Somebody at this fire spent that afternoon making very sure I wrote the wrong name.',
        'Ask who has been out past the tree line alone every morning since. Then ask them why.',
        'I know who has been searching and I know they have not said a word about what they found.'
      ],
      defiant: [
        'Good. It is in the game, somebody used it, and I would have used it as well.',
        'You are all acting robbed. Nobody promised any of us a fair count.',
        'I am not going to be frightened of a carved bit of wood. I am watching the person, not the trinket.',
        'If it had been me I would have played it exactly the same way and enjoyed it more.',
        'Everybody wants me upset about a rule. Take it up with whoever wrote the rules.'
      ],
      wry: [
        'I have dug under every tree at that camp since. I have found four crabs and a bottle.',
        'Somebody carried a lump of wood around for days and not one of us noticed the bulge.',
        'The best part was the quiet afterwards. You could hear the tide come in.',
        'I have started sleeping with one eye on the shelter posts. Purely as a hobby.',
        'I would like a receipt for the vote I wasted.'
      ],
      bleak: [
        'It means nobody here can rely on a count, and a count was all any of us had.',
        'We lost a person that night for nothing. The plan worked perfectly and cost us anyway.',
        'You cannot plan around a thing you cannot see, so this camp has stopped planning at all.',
        'Every conversation since has been people testing each other. It is more tiring than the challenges.',
        'There is at least one more of those somewhere on this island and everybody sat here knows it.'
      ]
    },
    push: [
      'Did anybody here know before it happened? Anybody at all?',
      'So does this tribe still make plans, or has it given that up?',
      'Has anybody at that camp changed how they spend their mornings since?',
      'You said it changed nothing. Then why is nobody at that camp sleeping?',
      'Is there anybody at this council you fully believe tonight?'
    ],
    chime: {
      own: [
        'My vote went in the sand with his. I would like that on the record before somebody else says it.',
        'We built that plan together and I was the one who said it was airtight.',
        'I was told to write that name and I was glad to. That is how badly we read it.'
      ],
      blame: [
        'He is being sporting about it. Somebody watched us walk into that and said nothing.',
        'Two people at this fire were suspiciously relaxed that night. I have thought about it since.',
        'He says the game working. I say somebody let their own side burn a vote for nothing.'
      ],
      bleak: [
        'Nobody at that camp finishes a sentence any more. That is what it did to us.',
        'We spent two days counting and the count meant nothing. Tonight we are counting again.',
        'It taught this tribe that being sure is a mistake. That is a horrible thing to learn.'
      ]
    },
    playerOpts: {
      own: 'Admit you got played',
      deflect: 'It is part of the game',
      blame: 'Say who let you walk into it',
      bleak: 'Nobody can count on anything'
    }
  },

  /* ---------------------------------------------------------------
     REPEAT TARGET — {who} has had their name read out at {n} councils and
     is still on the bench. The only topic in this file with a named
     subject, so it is the only one where Peff is pointing at somebody.
     Answers are theirs, first person, and {n} is always two or more.
     --------------------------------------------------------------- */
  {
    id: 'repeatTarget',
    ask: [
      '{who}, your name has come up at {n} different councils and you are still sat here. Why is that?',
      '{who}, I have read your name out at {n} of these now. Does it get easier to hear?',
      '{n} councils, {n} times somebody wrote you down. {who}, do you know who, or are you guessing?',
      'Somebody keeps reaching for your name, {who}. After {n} times, is it the same hand every time?',
      '{who}, you have survived {n} votes with your name in them. Is that luck, or is that work?',
      '{who}, you are the name this tribe uses when it cannot agree on anything else. What does that make you?'
    ],
    answers: {
      own: [
        'Because I am the easy answer. When this camp cannot agree on anything it can agree on me.',
        'I have heard my name {n} times and I have earned about half of those. Maybe more than half.',
        'I talk too much and I am too useful to trust. That is the whole file on me.',
        'I know why. I said something on the second day that I have not been able to take back.',
        'I am still here because I go and ask people to their face. That is not luck, that is mornings.'
      ],
      deflect: [
        'Spare votes get parked somewhere every council. I am a convenient somewhere.',
        'Nobody has ever had the numbers to finish it, and that says more about them than about me.',
        '{n} councils and this tribe has still not agreed on it. I am not the story here.',
        'I am still hauling water and still boiling it. That has not changed once in {n} votes.',
        'You are counting my name. I have been counting meals, and there have been far fewer.'
      ],
      blame: [
        'The same person has written my name {n} times and shaken my hand after every one of them.',
        'One person decided on the second day that I was the problem and has been very consistent.',
        'I know exactly who it is. I have known since the second time and I have said nothing until now.',
        'Somebody here has spent {n} councils trying to get me out and cannot find anybody to help.',
        'Ask the person who has told me I am safe {n} times. Ask them slowly and watch their face.'
      ],
      defiant: [
        'Because I am still standing after {n} attempts. That is not a weakness, that is a record.',
        'Write it again. It has not worked yet.',
        'I would rather be the name people reach for than the name nobody can remember.',
        '{n} councils and I am sat right here. At some point somebody has to admit I am good at this.',
        'Everybody who wrote it can explain to you why I am still holding a torch.'
      ],
      wry: [
        'I am starting to take it personally. Only starting.',
        'At this point I feel I am owed a small commission on every vote with my name on it.',
        'If I get a night where nobody writes me down I will not know what to do with myself.',
        'I have been voted for {n} times and elected to nothing.',
        'It is nice to be thought of. Consistently. In writing.'
      ],
      bleak: [
        'It means I have never had one safe night out here, and I have stopped expecting one.',
        'I have not slept properly since the first time I heard it read out. That was a while ago.',
        'Sooner or later one of them lands. I have done that piece of arithmetic as well.',
        'Everybody at that camp is friendly to me and everybody at that camp has written me down.',
        'I am the spare name at this camp, and a spare name only has to get picked once.'
      ]
    },
    push: [
      'Do you know who has been writing it, or are you telling me you have not bothered to find out?',
      'Is there anybody at this council who will tell me they have never written that name?',
      'You said you are still here. Is that because somebody is protecting you?',
      'Then what have you changed since the last time you heard it?',
      'Somebody here has written it more than once. Are they going to say so?'
    ],
    chime: {
      own: [
        'I wrote it once. I am saying so now because he is going to work it out anyway.',
        'I have written his name and I have also kept him here, and that was the same week.',
        'He is right that it is easy. That is precisely why we keep doing it.'
      ],
      blame: [
        'He knows who it is. He is enjoying making the rest of us wait for it.',
        '{n} times and he is still on this bench, which means somebody keeps failing at the last step.',
        'We keep writing his name because nobody at that camp will write the name that matters.'
      ],
      wry: [
        'If it helps at all, I have only done it twice.',
        'He is the most thought about man at this camp and none of it is affection.',
        'I would like it noted that I have never once spelled it wrong.'
      ]
    },
    playerOpts: {
      own: 'Admit you are the easy answer',
      blame: 'Name who keeps writing it',
      defiant: 'Dare them to try again',
      wry: 'Take it as a compliment'
    }
  },

  /* ---------------------------------------------------------------
     FIRST TRIBAL — day 2, nobody has ever done this, nobody has a read
     worth having. Peff has no history to quote, so every ask is about
     what they are going to base the first one on. Nothing in here claims
     weeks of insight, because there have been about forty-eight hours.
     --------------------------------------------------------------- */
  {
    id: 'firstTribal',
    ask: [
      '{who}, none of you has done this before. What have you been telling yourself on the walk in?',
      '{who}, first council of the season. Does anybody here have any idea what they are doing?',
      '{who}, in a few minutes one of you is walking out of here. Has that landed yet?',
      '{who}, you have known these people two days. Is that long enough to judge anybody?',
      'Nobody at this fire has ever written a name down, {who}. What is the first one going to be based on?',
      '{who}, whatever this tribe does tonight becomes the way this tribe does things. Thought about that?'
    ],
    answers: {
      own: [
        'I have got a name and I have had it since this morning. I am not going to pretend it was hard.',
        'Two days. That is all it took for me to be certain, and I am not proud of how quick that was.',
        'I decided at the water line this afternoon and then I went and told the person to their face.',
        'It has landed. I have felt sick since the challenge finished and I know exactly why.',
        'I am about to write a name I am not sure about and then live with having been wrong.'
      ],
      deflect: [
        'Two days is not long. Two days without a proper meal is longer than it sounds.',
        'None of us knows anything yet. We are all voting on a feeling and calling it a plan.',
        'It is the first one. Whatever goes wrong tonight at least goes wrong honestly.',
        'I am more worried about the roof of that shelter than about this, and I hear how that sounds.',
        'Everybody keeps asking what my plan is. My plan is to still be here at breakfast.'
      ],
      blame: [
        'One person has been running that camp like a job interview since the boat. That is my read.',
        'I know who has been talking about everybody, because they came and talked to me about everybody.',
        'Somebody asked me for something on the first afternoon. The first afternoon.',
        'There is a person at this fire who has not carried water once and has an opinion on everything.',
        'I did not need a week. I needed one conversation and somebody was generous enough to give me one.'
      ],
      defiant: [
        'I know exactly what I am doing. You are the one who keeps calling it two days.',
        'First one or the last one, the pen works the same.',
        'Ask me if I am nervous. I am not going to answer that honestly, so we can both save the time.',
        'Nobody needs practice at writing one word down.',
        'I came out here for this part. The camping was never the appeal.'
      ],
      wry: [
        'I have been practising my handwriting. It is the only preparation available to me.',
        'Two days of small talk and now we get to the point. Honestly, a relief.',
        'This is the first thing all week that has come with clear instructions.',
        'I have learned enough names to have a favourite and a least favourite. Quick work.',
        'Somebody told me to be careful tonight. I have been careful since the boat and I am starving.'
      ],
      bleak: [
        'In a few minutes somebody walks out into the dark and none of us ever sees them again.',
        'No fire, almost no food, and now we do this to each other. That is the week so far.',
        'Two days ago I did not know these people. Tonight I take one of their names and use it.',
        'Whoever goes tonight gave up months of their life for two days on a wet beach.',
        'None of us has done this before. That does not mean it is going to be gentle.'
      ]
    },
    push: [
      'Has anybody here made a promise they already know they are going to break?',
      'So is anybody voting on what they have seen, or is everybody voting on what they were told?',
      'Does anybody at this fire believe they are safe tonight? Say so now.',
      'You said you decided this afternoon. Did you tell anybody other than the person?',
      'Two days in and one of you is leaving. Is that fair?'
    ],
    chime: {
      own: [
        'I decided this afternoon as well. Different name, probably, but the same afternoon.',
        'He came and told me and I appreciated it. That is worth more than the vote is.',
        'I have got a name and I have told nobody. I am telling you now.'
      ],
      wry: [
        'I have never written a name down in my life and now I am doing it in front of a fire.',
        'We spent all morning learning each other names and we are undoing it immediately.',
        'Two days. Some people take longer than that to pick a restaurant.'
      ],
      bleak: [
        'One of us is about to find out what the boat ride back is like.',
        'We have not eaten and we have not slept, and this is the state we make our first decision in.',
        'Nobody here is ready for this. That is not going to stop it happening.'
      ]
    },
    playerOpts: {
      own: 'You already know the name',
      deflect: 'Nobody knows anything yet',
      blame: 'Say who has worked the camp',
      bleak: 'Say how bad the week has been'
    }
  }
];
