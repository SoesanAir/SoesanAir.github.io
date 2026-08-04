/* ============================================================
   Peff's stings at the marooning.

   He only ever gets ONE line per answer, it never repeats in a playthrough, and
   he stays quiet unless there is something genuinely worth saying — a sting that
   is not funny is worse than silence, so each pool is written to land and the
   caller skips him entirely when nothing fits.
   ============================================================ */

/* Keyed by the dominant trait of the PLAYER's answer. */
const PEFF_STINGS = {
  ruthless: [
    'Well. Everybody heard that.',
    'I want the record to show nobody looked surprised.',
    'Nineteen people just quietly moved you up their list.',
    'Refreshing. Ill-advised, but refreshing.',
    'You are going to be a lot of fun and not for very long.',
    'That is the most honest threat I have had at a marooning.',
    'Bold. I have seen bold go home on day three.',
    'Somebody write that down for the jury.'
  ],
  bold: [
    'Confidence. We will see how that ages.',
    'I have heard that speech before. It rarely survives the first vote.',
    'You have just made yourself very easy to remember.',
    'That is either leadership or a very large target.',
    'Nobody is going to forget you said that.',
    'I admire it. Your tribe may not.',
    'Big words on an empty stomach.',
    'You have set the bar. Try to reach it.'
  ],
  funny: [
    'A comedian. Wonderful. There is no food either.',
    'Laugh now. Day nine is not funny.',
    'Good. Humour lasts about a week out here.',
    'You will be the most popular person at the fire until you are not.',
    'I enjoyed that. The jury may want more substance.',
    'Charming. Charming is a strategy, so carry on.',
    'That is the last joke anyone makes for a fortnight.',
    'Keep it. You will need it around day twenty.'
  ],
  warm: [
    'Sweet. Somebody here is already planning to use that.',
    'Lovely sentiment. This is not a lovely game.',
    'I hope you all heard how kind that was. Remember it.',
    'That is genuinely nice. It will be tested.',
    'Hold on to that. It is the first thing this island takes.',
    'Someone just decided you are the easy one.',
    'That is the answer of someone who has not been hungry yet.',
    'Warmth is worth something. Not as much as you think.'
  ],
  honest: [
    'Honesty. On day one. Extraordinary.',
    'That was the truth. Enjoy that feeling.',
    'Nobody else is going to do that, you realise.',
    'You have just told nineteen people exactly where you stand.',
    'Straight answer. I will hold you to it.',
    'That is either integrity or inexperience.',
    'Well said. Now try saying it on day thirty.',
    'The camera got that. So did they.'
  ],
  guarded: [
    'A non-answer. Beautifully done.',
    'You gave me nothing and made it sound like something.',
    'Careful. People notice who says the least.',
    'That is a politician talking.',
    'I asked you a question and you handed it back.',
    'Cagey. That will read one of two ways.',
    'I will take that as a yes to everything.',
    'They will all remember you dodged.'
  ],
  humble: [
    'Modesty. Sincere or tactical, I could not say.',
    'Nobody wins by being the smallest voice. Worth knowing.',
    'That is disarming. Which may be the point.',
    'Humility on a beach with no food is a choice.',
    'Underestimate them at your peril, everyone.',
    'That was almost too gracious.',
    'Quiet ones. Every season.',
    'You just made yourself invisible. Clever, or fatal.'
  ],
  driven: [
    'Work. Yes. There is a great deal of it.',
    'Good. The shelter is not going to build itself.',
    'That is the answer of someone who has read the brochure.',
    'Effort is noticed. So is who is not making any.',
    'I hope your tribe was listening.',
    'You have just volunteered for everything.',
    'Ambition. Let us see it survive the rain.',
    'Say that again on day fifteen and I will believe you.'
  ],
  loyal: [
    'A promise. In this game. Marvellous.',
    'Everyone here just filed that away.',
    'I will be very interested when that is tested.',
    'Loyalty. The most expensive thing you own out here.',
    'That is a lovely thing to say. It is also a trap.',
    'You have handed someone a great deal of power.',
    'Hold that line and you may have friends. Or a jury.',
    'I give it eleven days.'
  ],
  modest: [
    'Understated. We will see.',
    'That is a small answer to a large question.',
    'You are going to be very hard to read. Good.',
    'Nobody just learned anything about you. Deliberate?',
    'Quietly done.',
    'I suspect there is more there.',
    'That is a strategy dressed as a shrug.',
    'Fine. I will find out the hard way.'
  ]
};

/* Keyed by ARCHETYPE, for the castaways Peff questions. */
const PEFF_STINGS_NPC = {
  strategist: [
    'There it is. The first honest strategist of the season.',
    'You have all just been told exactly who to watch.',
    'A plan already. On the beach. Before water.',
    'I do enjoy the ones who admit it.',
    'Everybody heard that. Everybody.',
    'That is a very tidy answer from someone with a very untidy job ahead.'
  ],
  social: [
    'Somebody is going to be extremely popular and extremely voted out.',
    'Friendship. Adorable. Carry on.',
    'That is the warmest thing that will be said all season.',
    'You will be everyone favourite until the numbers matter.',
    'Nineteen new best friends. Manage that.',
    'Enthusiasm noted. Enthusiasm is exhausting by day ten.'
  ],
  physical: [
    'Muscles. Useful for about three weeks.',
    'Good. Somebody has to carry the water.',
    'Strength wins challenges. It has never once won a vote.',
    'I hope your tribe appreciates you. They rarely do.',
    'That is the answer of someone who will be sore tomorrow.',
    'Work hard. It makes you both valuable and threatening. Pick one.'
  ],
  wild: [
    'Oh, you are going to be a problem. Excellent.',
    'That is the answer I was hoping somebody would give.',
    'The producers just leaned forward.',
    'I have no idea what you are going to do and neither do you.',
    'Chaos. We do need one.',
    'Nineteen people just took a small step away from you.'
  ],
  quiet: [
    'Softly spoken. Those tend to last.',
    'That is the answer everybody underestimates.',
    'Nobody just learned anything. Which is rather the point.',
    'Keep that up and you will be here a while.',
    'The quiet ones frighten me more than the loud ones.',
    'Say very little, go very far. It has been done.'
  ]
};

/* Dominant trait of a player answer = the largest positive weight. */
function dominantTrait(traits) {
  let best = null, bv = 0;
  for (const k of Object.keys(traits || {})) {
    if (traits[k] > bv) { bv = traits[k]; best = k; }
  }
  return best;
}
