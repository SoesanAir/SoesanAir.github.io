/* Voice for idols. Kept apart from the mechanic so the pools can grow without
   anybody having to read the logic.

   Placeholders: {name} the holder, {n} a voter's name, {ct} a count. */
'use strict';

const IDOL_LINES = {
  /* The player turns one up. This should land like a small electric shock, and it
     should never say what to do with it — working that out is the game. */
  playerFind: [
    'Under a flat rock at the base of the tree, wrapped in cloth, is something that is not a rock. You are holding a hidden immunity idol. Nobody saw you pick it up.',
    'Your hand closes on something carved. You stand there for a second longer than you should, then put it in your waistband. A hidden immunity idol. Yours, and nobody knows.',
    'It is tied into the root with fishing line, which means somebody put it there on purpose. A hidden immunity idol. You keep walking as if nothing happened.',
    'There is a shape in the hollow that the light does not sit right on. You have found a hidden immunity idol. Your hands are not quite steady.',
    'It has been sitting in the silt the whole time. A hidden immunity idol, dark with water, heavier than it looks. You are careful about how you walk back.'
  ],

  /* Peff opens the floor. On the show this is a fixed piece of liturgy, so these
     stay close to the real wording — it is the most quoted line in the format. */
  peffAsk: [
    'If anybody has a hidden immunity idol and you want to play it, now would be the time.',
    'Before I read the votes — if anyone has a hidden immunity idol and wishes to play it, now is the time to do so.',
    'Once I read the votes the decision is final. If anybody wants to play an idol, this is your moment.',
    'If there is a hidden immunity idol out here and you intend to use it, I need to see it now.'
  ],
  /* The pause after the question, which now happens at EVERY council whether or
     not anybody is holding one. The answer on screen is "…"; this is the line
     underneath it, describing what the silence looks like tonight.

     Deep on purpose. This is the single most-repeated beat in the game — nine or
     ten times a season, every season — so the ritual has to be identical while the
     room is never quite the same. Nothing here may ever hint at whether an idol is
     actually in play; every line has to read the same on the night somebody stands
     up as on the eight nights nobody does. */
  silence: [
    'Nobody moves.',
    'Twelve people look at eleven other people and nobody moves.',
    'Somewhere behind the bench a torch spits. That is the only sound.',
    'Two of them glance at each other and immediately stop.',
    'Everybody is very carefully looking at the fire.',
    'One of them shifts their weight. It means nothing. Everybody looks anyway.',
    'The wind comes up through the shelter and dies again.',
    'Nobody so much as reaches for a pocket.',
    'A long stretch of nothing. Somebody swallows.',
    'Every set of eyes on that bench does one slow circuit of the others.',
    'Someone at the end of the row scratches their arm and half the council flinches.',
    'Peff waits. He is in no hurry whatsoever.',
    'Stillness, the kind that only happens when everybody is doing it on purpose.',
    'Not one person moves, and every one of them is aware of exactly that.',
    'Somebody starts to say something and thinks better of it.',
    'The fire pops. Nobody moves.',
    'Eleven people hold very still and pretend that is normal.',
    'A hand goes to a knee. Just a knee.',
    'The silence goes on long enough to become its own thing.',
    'Peff looks down the row, slowly, one face at a time.'
  ],

  peffNoIdol: [
    'Nobody. All right.',
    'No idol. Then I will read the votes.',
    'Nothing. Once the votes are read, the decision is final.',
    'All right. I will read the votes.'
  ],
  peffIdolValid: [
    'This is a hidden immunity idol. Any votes cast for {name} will not count.',
    'This is, in fact, a hidden immunity idol. Votes against {name} do not count.',
    'That is a hidden immunity idol. {name} is safe. Votes for {name} will not be counted.'
  ],
  peffIdolWasted: [
    'That is a hidden immunity idol. It was not necessary.',
    'It is real. There were no votes against {name}. Somebody has a much longer night ahead of them than they thought.',
    'A genuine idol, played on a night nobody was coming. That happens more than you would think.'
  ],

  /* The room, in the second after somebody stands up. */
  reactionShock: [
    'Nobody moves. Two people look at each other and immediately look away.',
    'Somebody says a word under their breath that the cameras will keep.',
    'The whole bench recalculates at once. You can watch it happen.',
    'One of them closes their eyes. They already know where this is going.',
    'A long, complete silence. Somewhere behind you a torch spits.'
  ],
  reactionWasted: [
    'Two people relax so visibly it is almost rude.',
    'Somebody exhales and does not manage to hide it.',
    'A couple of them exchange a look. It was not needed and everybody in the row knows it.',
    'Relief goes down the bench like a draught.'
  ],
  /* Voted out with one in their pocket. */
  reactionUnplayed: [
    '{name} stands, and something falls out of their waistband as they reach for their torch. It was in there the whole time.',
    'On the way to the torch, {name} takes a carved thing out of their pocket and looks at it, and then puts it back.',
    '{name} had one. They never played it. It goes into the fire pit with the rest of the night.'
  ],

  /* What the player is asked, when they are the one holding it. */
  playerPrompt: [
    'You have it in your hand. Nobody has read a single vote yet.',
    'It is in your waistband and Peff has just asked the question.',
    'This is the moment or it is nothing. Once the votes are read it is a souvenir.'
  ],
  playerPlay: [
    'Stand up and play it.',
    'Play it. Now, before anything is read.',
    'Hand it over.'
  ],
  playerHold: [
    'Keep it. Sit still.',
    'Hold it. Not tonight.',
    'Say nothing.'
  ],

  /* NPC lines afterwards, when the player asks about it or it comes up at camp. */
  aftermathTalkSaved: [
    'Whoever put that thing in the ground has cost us a week.',
    'We had it. We actually had it, and it did not matter.',
    'Right. So somebody out here goes looking, and we do not.'
  ],
  aftermathTalkWasted: [
    'They panicked. That is all that was.',
    'Played it on nothing. I would be sick.',
    'That is one fewer thing to worry about, at least.'
  ]
};
