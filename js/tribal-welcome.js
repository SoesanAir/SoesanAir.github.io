/* ============================================================
   TRIBAL WELCOME — the first thing Peff says at every council.

   Council used to open on the grid of faces with one line from a six-line pool
   and a tap. Reported as "too in your face", and the six lines burned out in
   about four councils. On the show the vote is the LAST thing that happens: the
   tribe walks up, torches go in the stand, and Peff says something that places
   the night before he asks anybody anything. This file is that beat, and only
   that beat. What follows it is docs/tribal-qa.md.

   This is the most-read text in the game. It fires at every single council of a
   26 day season, before the topics, before the vote, with no way for the player
   to skip past it. So the volume here is deliberate and the bar is that no line
   should feel like furniture.

   THE SEVEN CONTEXTS. Keyed by where the season is, not by what happened today:

     first   the season's opening council. Nobody has voted, nobody has been
             voted out, and the tribe does not yet know what the walk back with
             an empty seat feels like. Used exactly once per season.
     early   pre-merge, business as usual. The danger here is that it IS usual,
             so these lean on ritual and on how quickly ritual gets careless.
     merged  the first council after the buffs come off. One fire, no tribe to
             hide behind, and the strategy that got everybody here just expired.
     jury    a jury is seated and listening. Changes the audience for every
             answer given afterwards, so these say so.
     late    five or fewer left. Small, mean, and nowhere to stand.
     storm   rain or worse on the council. Pure physical present tense.
     any     fits any night. The fallback, and mixed into every other context so
             that a rare context like merged never plays its own pool twice.

   JUDGEMENT CALLS, since the next person to touch this will wonder:

   NO NAMES, NO PLACEHOLDERS, NO EVENTS. A welcome plays before the reader has
   emitted a single Fact, and it has to be safe for any tribe on any night. If a
   line only lands after a lost challenge or an empty food bin, it is a Q&A ask,
   not a welcome, and it belongs in a lines file. That rule is why nothing in
   here mentions a result, and it is what makes all 130 lines legal in all seven
   slots without the engine checking anything.

   NO HEAD COUNTS, even in `late`. Five or fewer means it might be three, so
   these describe smallness instead of counting it — you can see the whole tribe
   without turning your head, there is more seat than people. A number would go
   wrong roughly a third of the time.

   `jury` SAYS "THE FAR BENCH", NOT "THE BENCH". In this codebase the bench is
   where the castaways being questioned sit, so the jury gets the far side, over
   there, the seats across from you. Worth keeping consistent.

   CONTRACTIONS MOSTLY AVOIDED, matching Peff in tribal-qa-lines-a. "It is" and
   "You have" read a beat slower than the contracted form, and a beat slower is
   the whole register. He is warm, he is not soft, and he does not waste a word.

   Hard rules, same as the Q&A files: no parentheses, no asterisks, no braces, no
   alliance / pact / bloc / whisper / idol, 200 characters, and not one duplicate
   line anywhere across the seven pools.
   ============================================================ */

'use strict';

const TRIBAL_WELCOME = {

  /* ---------------------------------------------------------------
     FIRST — the season's opening council. The only pool that gets to
     use innocence as material, because after tonight nobody at this
     fire is inexperienced ever again.
     --------------------------------------------------------------- */
  first: [
    'Bring your torches in and get them in the stand. Every one of you is about to do something for the first time.',
    'Sit anywhere you like. In twenty minutes one of these seats will be empty, and it stays empty for the rest of the season.',
    'This is the first council of the season. Nobody here has been voted out, and nobody here has voted anybody out.',
    'Welcome to your first tribal council. Whatever got decided at camp, this is where you find out whether it holds.',
    'Take a torch, dip it in the fire, put it in the stand. That fire is the only thing out here that keeps score honestly.',
    'Nobody at this fire has done this before. Look around while that is still true.',
    'Grab a torch. The walk in is the easy part, and it is the only part I can promise any of you.',
    'First night. Somebody is going to write a name down tonight who has never written one down in their life.',
    'You have been dreading this since the morning you came ashore. Here it is, and it is smaller and quieter than you imagined.',
    'Light your torch and sit down. From here on, everything said at this fire goes on the record.',
    'There is a version of tonight where everybody keeps their word and a version where somebody does not. Only you know which one this is.',
    'Nobody has lost anybody yet, so none of you know what the walk back is like with a gap in it. You will within the hour.',
    'This is the beginning of the part of the game people remember. Sit down.',
    'Everybody in and seated. You learned each other on a beach. Tonight you learn each other properly.',
    'The first vote of a season is the one that tells everybody what kind of season it is going to be.',
    'Come in. Nothing has happened yet, and that is a thing you will only be able to say for a few more minutes.',
    'Fire first, then sit. There is no history at this fire yet, so whatever you do tonight becomes it.',
    'Do any of you know what this is going to be like? You think you do. Sit down and find out.'
  ],

  /* ---------------------------------------------------------------
     EARLY — pre-merge, nothing special about tonight. Which is the
     angle: these lean on the ritual being ordinary and on ordinary
     being where people stop paying attention.
     --------------------------------------------------------------- */
  early: [
    'Bring in your torches. You know the shape of this night by now, so let us not pretend it is a surprise.',
    'Everybody in. Same fire, same seats, one fewer of you walking back down.',
    'Sit down. It is early, there is a long way to go, and every name written tonight gets carried the whole way.',
    'You have walked this path before and you will walk it again. That has never once made it cheaper.',
    'Torches in the stand. This is routine now, and routine is exactly when people get careless.',
    'The season is young. Most of you are still working out who you are out here, and tonight will help with that.',
    'Take a seat. Whatever got settled on the beach this afternoon has had a few hours to change its mind.',
    'Come in and get comfortable. There is nothing unusual about tonight, which is its own kind of dangerous.',
    'Two tribes are still out there. One of them is sat in front of me and will be shorter by the end of this.',
    'Dip and sit. There is more game ahead of you than behind you, and you are about to make it shorter for somebody.',
    'You are all still strangers with one problem in common. Tonight the problem gets a name smaller.',
    'Everybody here knows the drill. I would still like you to feel it.',
    'It is early enough in this game that tonight feels survivable, and late enough that it should not.',
    'Sit. The other tribe is asleep right now, and one of you will not be out here by the time they wake up.',
    'Get your torches lit and sit down. Nothing has been decided yet, whatever anybody told you at camp.',
    'Welcome back. Nothing at this fire has changed since the last time except the number of people in front of it.',
    'Torches in. There is a long road between this beach and the end of it, and it narrows here every time.',
    'Is anybody surprised to be sat here tonight? Nobody ever is, and yet here we all are again.'
  ],

  /* ---------------------------------------------------------------
     MERGED — first council with the buffs off. The only night where
     everybody in front of him is new to the room, which is why these
     are about the room rather than about the people in it.
     --------------------------------------------------------------- */
  merged: [
    'One tribe, one fire, one torch stand. Everything you learned about voting as a group is worth a great deal less now.',
    'Bring in your torches. Some of you have never walked this path and some of you have walked it far too often.',
    'This is the first council for a merged tribe. Nobody in front of me knows how this room works yet.',
    'Sit wherever you like. There are no sides in the seating, and there had better be some in the voting.',
    'You came in from two camps and you are one tribe now. For the first time, every name written tonight comes out of the same pile.',
    'The merge is a promotion and a demotion at once. All of you just became individuals with a lot of people in the way.',
    'Everybody in. The tribe that protected you is gone, and what is left is a count of people who might speak for you.',
    'Torches in the stand. From tonight there is no losing tribe out here, only losing people.',
    'Congratulations on getting this far. That is the last thing in this game anybody is going to hand you.',
    'Look at these seats. This is the biggest this fire gets all season, and it will never be this big again.',
    'Sit down. You are safe from nothing now, and playing for one person only.',
    'The buffs came off this morning. Tonight we find out whether anything else came off with them.',
    'For a lot of you, the way of playing that got you here stopped working at about noon today.',
    'One fire, one vote, no tribe to stand behind. Take a seat.',
    'You spent the first half of this game learning who to trust on one beach. As of today the beach is twice the size.',
    'This is the night the game stops being about tribes and starts being about names.',
    'Who feels safe tonight? Think about that one carefully, because the answer to it changed this morning.'
  ],

  /* ---------------------------------------------------------------
     JURY — somebody is watching who cannot vote tonight and can vote
     at the end. Every one of these does the same job: it tells the
     player that answers now cost twice.
     --------------------------------------------------------------- */
  jury: [
    'Bring in the jury. Every person walking in over there is somebody one of you sent, and every one of them votes at the end.',
    'The seats on the far side are not empty any more. Everything said tonight is heard by people who decide this game.',
    'Torches in the stand, and eyes on the far bench if you can manage it. They are here to watch you work.',
    'You are not only talking to me now. You are talking to people who already know exactly how you play.',
    'Sit down. There is an audience tonight, and it is made up entirely of people you beat.',
    'The jury is seated. Nothing said at this fire dies at this fire any more.',
    'Every answer you give tonight is being marked by somebody who cannot vote yet and will.',
    'Look over there before you sit. That is the end of your game, watching the middle of it.',
    'The people across from you stopped playing and started judging. Speak accordingly.',
    'Welcome back, and welcome to the jury, who are here to listen rather than to defend themselves.',
    'You have a jury now. That changes what a good night looks like for every single person on that seat.',
    'Some of you will play tonight for the vote and some of you for the far bench. Both are fair and both are visible.',
    'They are sitting where you might be sitting next week. Keep that in your mouth when you answer me.',
    'The jury does not get to say a word tonight. That does not mean they are not talking.',
    'Take your seats. From here the game has two audiences, and only one of them can vote tonight.',
    'Every torch that got snuffed at this fire came back tonight. Look at them, then look at each other.',
    'There is no such thing as a private answer any more, and the far side of this fire is the reason.',
    'Can you feel the difference from where you are sitting? You should. There are people here now who only listen.'
  ],

  /* ---------------------------------------------------------------
     LATE — five or fewer. No head counts anywhere in here, because
     five or fewer might be three. Smallness described, never counted.
     --------------------------------------------------------------- */
  late: [
    'Look how few of you there are. You can take in this whole tribe without turning your head.',
    'Bring in your torches. There is more room on those seats than there are people to fill it.',
    'We are near the end of this. Every single person in front of me is now somebody else in the way.',
    'Sit down. This far in there is nobody left who is not a threat to somebody sat beside them.',
    'There is no cover at this stage. Whatever you do tonight, everybody will know precisely who did it.',
    'That fire is the same size it was on the first night of the season. The group in front of it is not.',
    'You are close enough to the end to taste it, which is exactly when people get greedy and stop counting.',
    'Take your seats. From here every vote gets decided by people who know each other far too well.',
    'There is nowhere to hide in a group this small. That is not a threat, it is arithmetic.',
    'Everybody in. You have all survived a lot of these nights, and none of that helps you at this one.',
    'This is the part where the game gets small and mean. Sit down.',
    'One of the people in front of me wins this season. The rest of you are standing in the way of that.',
    'The end is close enough now that you can plan for it. So can everybody else on that seat.',
    'Torches in. Every person you needed to get this far is the reason you cannot go any further.',
    'A few days ago you needed each other in order to eat. Tonight you need each other gone.',
    'Sit. There is not a vote left in this game that does not change who wins it.',
    'You are down to where losing one person changes everything for everybody. There are no quiet votes from here.',
    'How does it feel to look around a fire this empty? Sit down, because I am going to ask you properly in a minute.'
  ],

  /* ---------------------------------------------------------------
     STORM — rain or worse. Present tense, physical, short. The weather
     does the ominous work so the words do not have to strain for it.
     --------------------------------------------------------------- */
  storm: [
    'Get in out of it and sit down. The fire is still going, which is more than can be said for most things tonight.',
    'Bring your torches in. Everything on this beach is wet and none of it is drying before morning.',
    'You are dripping on my sand. Let us make this worth the walk.',
    'The rain has not stopped for hours and it is not stopping for a council. Sit down.',
    'Torches in the stand. Half of you are shaking, and I do not believe all of that is the cold.',
    'Listen to that. Whatever gets decided here, the walk back is going to be worse than the walk up.',
    'It is coming down hard enough that you will not hear each other breathe. That should suit one or two of you.',
    'Take a seat in the wet. Nobody here has slept, and nobody here is sleeping after this either.',
    'The fire is fighting for its life tonight. So is somebody sat in front of it.',
    'You walked up here through that. Whatever you came to do, you clearly meant it.',
    'Sit down before the wind takes the rest of the light. This will be quick and it will not be gentle.',
    'Rain on the roof, rain on the sand, rain on all of you. It is a filthy night to end somebody.',
    'Everybody is soaked and everybody is cold, and in ten minutes one of you gets to go somewhere dry.',
    'The storm was at your camp all day and it is at this fire now. Nothing out here is on your side tonight.',
    'Come in. I would tell you to get comfortable, but I have too much respect for your intelligence.',
    'That fire is the only warm thing on this island tonight, and it is the thing we are here to put out.',
    'Watch your footing on the way in. The sand is soft, and so is everything you agreed on this afternoon.',
    'Do you know the worst thing about a night like this? You have to get through it before anybody gets to be dry.'
  ],

  /* ---------------------------------------------------------------
     ANY — the fallback, and mixed into every other context so the small
     pools never repeat inside one season. Nothing in here is tied to a
     stage, a result, a person or the weather, on purpose.
     --------------------------------------------------------------- */
  any: [
    'Come in, dip your torch, take a seat. This is the only part of the night every one of you gets to do.',
    'Torches in the stand. Everybody who came up that path is still in this game, and that stops being true shortly.',
    'Sit down. Somewhere in the last few days, one of you made the decision that ends tonight.',
    'Everybody in. Behind me the fire is doing what it always does, and one of you is about to understand that properly.',
    'Take your seats. I watched all of you today, and I am going to ask about the parts you hoped I missed.',
    'You have all walked up here with a plan. Not every one of those plans survives the same hour.',
    'Sit down and get your breath back. Nothing at this fire happens fast.',
    'That fire behind me stands for everybody still playing this game. It gets smaller tonight.',
    'Everybody seated. Good. Somebody here has been counting all afternoon and somebody here has no idea.',
    'Have a look at the person next to you. One of you is about to do the other a great deal of harm.',
    'It is a quiet night and this is a quiet place. That tends to make people say the thing they meant to keep.',
    'Sit. Shortly I will ask you to vote, and everything between now and then is you deciding how honest to be about it.',
    'Nobody arrives at this fire by accident. Something went wrong today, and somebody is going to pay for it.',
    'Torches in. You have been talking about this for hours, and now you have to do it in front of each other.',
    'The walk up here is long and dark on purpose. It gives people time to change their minds.',
    'Everybody in. Whatever got decided at camp, camp is not where any of you have to say it.',
    'Welcome to tribal council. You know why you are here, and I would still like to hear you say it.',
    'Sit down. I am not going to make this comfortable. I am going to make it fair.',
    'You are on one bench with one problem and completely different answers to it.',
    'Look at the torches. Every one of those is somebody who intends to walk out of here holding it.',
    'Take a seat. There is no clock in this place, which is why it always feels longer than it is.',
    'Come in. Whatever the mood was on that path, this fire has a way of changing it.',
    'Sit down. One name gets written more than the others tonight, and not one of you can tell me yet which.',
    'Everybody has been thinking about this since sunrise. Now you find out whether anybody agreed with you.',
    'Every one of you did something today you would rather I did not ask about. I will get to it.',
    'The sea is behind you and the fire is in front of you, and neither of them cares at all how this goes.',
    'Take your seats. Whatever happens next, all of you agreed to be here for it.',
    'Nobody at this fire is safe and nobody at this fire is finished. That is the whole reason we do this at night.',
    'Sit down. For the next few minutes, nobody can lie to me without doing it out loud.',
    'This is the only fire on this island that somebody else built for you. Make the most of sitting in front of it.',
    'Everybody in and settled. Somebody in this group is about to be very surprised, and it is not me.',
    'You made it to another one of these. That is not nothing, and it is not a lot either.',
    'Torches in the stand and eyes up. I want to see your faces when I start asking.',
    'Take a seat. Every council begins the same way and no two of them end the same way.',
    'Bring them in. The fire is lit, the seats are waiting, and somebody here is leaving.',
    'I have done this many times. It has never once become routine, and I would be careful of anybody who says it does.',
    'Sit down. You are about to spend ten minutes being extremely careful with your words.',
    'Everybody in. The game does not stop while you sit here. It only slows down enough for you to watch it.',
    'Is everybody in? Then we start, because that fire has been waiting longer than any of you have.',
    'Does anybody want to say something before I begin? No. Nobody ever does.'
  ]
};
