/* ============================================================
   "What do you make of {tn}?" — the cluster-flavoured answers.

   These used to be nine hardcoded one-liners that intercepted the banded pool,
   so a Chaos Agent said the SAME sentence about everyone, every time, forever.
   Now each case is a pool of ten, and the renderer only reaches for the cluster
   flavour part of the time, so the feeling-banded lines get used as well.
   ============================================================ */
const THINKOF_VOICE = {
  'Chaos Agent': {
    any: [
      '{tn} is hilarious and maybe unhinged. Beautiful combo.',
      '{tn}? Love them. Would not turn my back on them.',
      'I cannot work {tn} out and I have decided that is fun.',
      '{tn} is either the smartest person here or the least. No middle.',
      'I want to see what {tn} does under pressure. Purely for entertainment.',
      '{tn} is a lit match. I am just watching where it lands.',
      'Genuinely? No idea. I like that about {tn}.',
      '{tn} lies like it is a hobby. Respect.',
      'I would put {tn} in charge just to watch it collapse.',
      '{tn} is the most interesting problem on this beach.'
    ]
  },
  'Paranoid Schemer': {
    any: [
      '{tn} is working someone. I have not figured out who.',
      '{tn} asks a lot of questions for someone with no plan.',
      'Watch where {tn} goes after dark. That is your answer.',
      '{tn} is too comfortable. Nobody should be that comfortable.',
      'I have seen {tn} in three conversations they walked away from quickly.',
      '{tn} says the right thing slightly too fast.',
      'Somebody is running {tn}. Possibly you.',
      '{tn} has a second conversation going. Everyone does.',
      'I do not trust the timing of {tn}. That is all I will say.',
      'Ask me what {tn} wants, not what {tn} is like.'
    ]
  },
  'Bitter Veteran': {
    any: [
      '{tn} is fine. They are all fine until they are not.',
      'I have met forty {tn}s. They all did the same thing.',
      '{tn} will be lovely right up until the vote.',
      'Give {tn} a week. You will see it.',
      'Nice enough. Nice is a strategy.',
      '{tn} has not been tested yet. Nobody has.',
      'I stopped forming opinions about people like {tn}.',
      '{tn} reminds me of someone who sent me home.',
      'They are all charming on day three.',
      'I will tell you about {tn} when it matters.'
    ]
  },
  'Loyal Soldier': {
    positive: [
      '{tn} is my people. Do not come at them around me.',
      '{tn} has my back. That is not up for discussion.',
      'I would take a vote for {tn}. Straight answer.',
      '{tn} pulls their weight and then some.',
      'You will not hear a word against {tn} from me.',
      '{tn} said they were with me and they meant it.',
      'Solid. That word exists for people like {tn}.',
      'If {tn} goes, this tribe gets worse. Simple.',
      'I trust {tn} more than I trust most of my own family.',
      '{tn} does not need defending, but I would anyway.'
    ]
  },
  'Social Butterfly': {
    positive: [
      '{tn} is literally the sweetest. I could cry.',
      'Oh, I adore {tn}. We talked for two hours yesterday.',
      '{tn} is my absolute favourite and I will not apologise.',
      'I would keep {tn} forever. Genuinely.',
      '{tn} makes this place feel like a holiday. Almost.',
      'Do not tell {tn} I said this, but they are wonderful.',
      '{tn} laughs at everything I say. Perfect person.',
      'I am obsessed with {tn}. Is that too much?',
      '{tn} is the reason I have not lost my mind out here.',
      'We are going to be friends after this. I have decided.'
    ]
  },
  'Emotional Wildcard': {
    positive: [
      'I LOVE {tn}. They have been the only one checking on me.',
      '{tn} sat with me when I was falling apart. That is everything.',
      'Do not say anything bad about {tn}. I mean it.',
      '{tn} is the only reason I am still here. Actually.',
      'I would go home for {tn}. Is that mad?',
      '{tn} hugged me and I have not stopped thinking about it.',
      'I get emotional about {tn}. Sorry. I do.',
      '{tn} is good. In a place with no good in it.',
      'If {tn} betrays me I will not recover from that.',
      'I need {tn} here. I know how that sounds.'
    ]
  },
  'Strategic Veteran': {
    guarded: [
      'Depends on their angle. What is yours?',
      'I have a read. I am not spending it on this conversation.',
      'What do YOU make of {tn}? Start there.',
      '{tn} is exactly as useful as the numbers make them.',
      'I will trade you my read on {tn}. Not give it.',
      'Interesting question. Interesting that you asked it.',
      '{tn} is a piece on a board. So are you. So am I.',
      'Ask me after the next vote and the answer changes.',
      'I do not do opinions. I do positions.',
      'You are fishing. I do not mind, but I noticed.'
    ]
  },
  'Villain Arc': {
    lie: [
      '{tn} is harmless. Probably safe to keep around.',
      '{tn}? Sweet. No threat at all.',
      'I like {tn}. Everyone likes {tn}.',
      'Honestly, {tn} is the last person I would worry about.',
      '{tn} is not playing. Not really.',
      'Keep {tn} close. They are useful and they are kind.',
      'I have nothing bad to say about {tn}. Nothing at all.',
      '{tn} would never come for you. Relax.',
      'You are safe with {tn}. Take that from me.',
      '{tn} is exactly what they look like. Nothing more.'
    ]
  },
  'Physical Threat': {
    positive: [
      '{tn} is alright. Works the line.',
      '{tn} does not complain. That is high praise from me.',
      '{tn} carried more than their share yesterday. Noted.',
      'Strong. Useful. I will take {tn} on my side.',
      '{tn} shows up. That is the whole test.',
      'I would rather have {tn} in a challenge than most.',
      'No complaints. {tn} does the work.',
      '{tn} is steady. Steady wins more than clever does.',
      'Good hands, good back. Fine by me.',
      '{tn} keeps up. Not everyone does.'
    ],
    negative: [
      '{tn} is whatever.',
      '{tn} has not lifted anything all week.',
      'I have not seen {tn} do a single useful thing.',
      '{tn} talks. That is what {tn} does.',
      'Not much use in a challenge, is {tn}.',
      '{tn} disappears when there is work on.',
      'I do not think about {tn} much.',
      '{tn} is dead weight and everyone is being polite about it.',
      'Ask me about someone who does something.',
      '{tn} will be a problem when we need to win.'
    ]
  }
};

/* Pick a cluster-flavoured opinion, or null if this cluster/sentiment has none. */
function thinkOfClusterLine(npc, subject, sentiment, truth) {
  const set = THINKOF_VOICE[npc.cluster];
  if (!set) return null;
  let pool = null;
  if (set.any) pool = set.any;
  else if (sentiment === 'positive' && set.positive) pool = set.positive;
  else if (sentiment === 'negative' && set.negative) pool = set.negative;
  if (npc.cluster === 'Strategic Veteran') pool = truth !== 'Truth' ? set.guarded : null;
  if (npc.cluster === 'Villain Arc') pool = truth === 'Lie' ? set.lie : null;
  if (!pool || !pool.length) return null;
  return pick(pool).replace(/\{tn\}/g, subject.displayName);
}
