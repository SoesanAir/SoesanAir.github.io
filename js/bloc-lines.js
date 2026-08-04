/* ============================================================
   BLOC LINES — reading the room out loud.

   The single most Survivor thing there is: people counting other people's
   numbers, usually with incomplete or wrong information. When the player asks,
   observes, or makes game talk, an NPC may report what they think they have
   spotted — "I think X, Y and Z are getting close."

   The read is GRADED by how observant the speaker is and how much they have
   actually seen, the same way renderHearingLine and renderThinkingLine grade an
   answer by npcInfoTier. The important part is that a read can be WRONG:
   blocWrong is a confident report of a grouping that does not exist. A confident
   wrong read is more interesting than a vague right one, so those lines are
   written in exactly the same register as blocSure3 — no hedge, no tell, no
   difference in phrasing. If the player can tell a wrong read from a right one
   by the wording alone, the mechanic is decoration.

   ------------------------------------------------------------
   PLACEHOLDERS — the whole set. Any line may use any of these:

     {n1}    first named castaway (display name)
     {n2}    second named castaway
     {n3}    third named castaway
     {rest}  an already-joined tail string for blocs of four or more,
             e.g. "and two others" or "Dana and Priya" — pass it pre-joined,
             the pools never join it themselves. It may arrive carrying its own
             leading "and", so no line puts an "and" in front of it; {rest}
             always follows a comma, a dash or a full stop.
     {tn}    a vote target / the name currently under discussion
     {me}    the player's display name

   Slots per pool:
     blocSure2       {n1} {n2}
     blocSure3       {n1} {n2} {n3}
     blocSure4       {n1} {n2} {n3} {rest}
     blocWrong       {n1} {n2} {n3}          (same shape as blocSure3, by design)
     blocWarnPlayer  {n1} {n2} {n3} {tn} {me}
     blocCounting    {tn}
     blocAskPlayer   {tn}
     playerShareBloc {n1} {n2} {n3}
     the rest        no slots

   Unfilled slots are left alone by the picker, so a caller that only knows two
   names must use a two-name pool rather than a three-name one.
   ------------------------------------------------------------

   Voice: real people talking quietly at the water well, not analysts. Nobody
   says "alliance". They say tight, close, they have the numbers, those three
   move together, they are always at the well at the same time.
   ============================================================ */

'use strict';

const BLOC_LINES = {

  /* ---------- confident about a PAIR ----------
     Where every read starts. Two people is the smallest thing you can see. */
  blocSure2: [
    '{n1} and {n2}. Whatever one of them knows, the other knows an hour later.',
    'Those two are a pair. {n1} and {n2}. Everything else out here is noise.',
    '{n1} and {n2} went for water twice today. Neither of them came back with water.',
    'You have got {n1} and {n2}. That is the one thing I am certain of.',
    'It is not a group yet. It is {n1} and {n2}, and it will become a group.',
    '{n1} would not write {n2}. Not for anything. Plan around that.',
    'Two. {n1} and {n2}. Ask them separately and see how alike the answers come back.',
    '{n2} started sitting where {n1} sits. Small thing. It is not a small thing.',
    'I have seen {n1} and {n2} come out of the trees three mornings running.',
    'Everybody thinks {n1} is on their own. {n1} has {n2}, and {n2} is quiet about it.',
    '{n1} and {n2} are tight. That is the whole picture from where I am standing.',
    'If {n1}’s name comes up, watch {n2} move. It happens before anyone speaks.',
    'They are not even hiding it now, {n1} and {n2}.',
    'Two of them, joined at the hip since the first night. {n1} and {n2}.',
    '{n1} and {n2}. Do not say anything near one of them you would not say to both.',
    'I trust {n1}. I do not trust {n1} and {n2} in the same conversation.',
    '{n1} tells {n2} everything. Everything. Including whatever you told {n1}.',
    'One pair matters out here and it is {n1} and {n2}.',
    '{n1} defended {n2} before anybody had said a word against {n2}. That told me plenty.',
    'Do the maths on {n1} and {n2}, then do it again with whoever they pull in.',
    'It is {n1} and {n2}, and it has been since we landed.',
    '{n1}, {n2}. Two votes, one head.'
  ],

  /* ---------- confident about THREE ----------
     The headline pool. Three is where a read stops being gossip and starts
     being a number that beats you. */
  blocSure3: [
    '{n1}, {n2} and {n3}. Those three move together. Watch who fetches water tomorrow.',
    'Count it. {n1}, {n2}, {n3}. That is three, and there are not many of us left.',
    'I have watched {n1}, {n2} and {n3} peel off separately three times today. Three.',
    '{n1} and {n2} are obvious. It is {n3} you are not seeing.',
    'Do not sit near {n1}, {n2} or {n3} when you talk to me. They are one thing now.',
    'You know who never disagree? {n1}, {n2} and {n3}. Not once. Not about anything.',
    'Three of them. {n1}, {n2}, {n3}.',
    'They think they are being clever. {n1}, {n2} and {n3} all left camp on their own and came back at the same time.',
    '{n1} is running it. {n2} does what {n1} says. {n3} has not worked out that is what is happening.',
    'It is {n1}, {n2} and {n3}. I would put my game on that.',
    'Whatever {n1} decides, {n2} and {n3} say it back to you an hour later. Same words.',
    'I am telling you because nobody else will. {n1}, {n2} and {n3} are tight.',
    '{n2} laughed at something {n1} said last night that was not funny. Then {n3} did.',
    'Have a proper look at where {n1}, {n2} and {n3} sleep. That is not an accident.',
    'The three of them have the numbers if they hold. {n1}, {n2}, {n3}.',
    'I would be careful around {n1}. And by {n1} I mean {n2} and {n3} as well.',
    'Yeah. {n1}, {n2}, {n3}. I clocked that on about day four.',
    'Nobody talks that much and says that little. All three of them. {n1}, {n2}, {n3}.',
    'You want the truth? {n1} has {n2} and {n3} in a pocket and does not hide it well.',
    '{n1} and {n3} pretend they barely know each other. Then {n2} wanders over. Every time.',
    'It is three. {n1}, {n2}, {n3}. I stopped guessing about it two days ago.',
    'I like {n2}. I still think {n2} is voting with {n1} and {n3}.',
    'Three names, and I will only say them once. {n1}. {n2}. {n3}.',
    'They are always at the well at the same time, {n1}, {n2} and {n3}. Think about how that happens.'
  ],

  /* ---------- confident about FOUR or more ----------
     {rest} arrives pre-joined. This is the read that turns a game into
     arithmetic, so the lines are allowed to sound a bit defeated. */
  blocSure4: [
    '{n1}, {n2}, {n3}, {rest}. That is not a group any more, that is a majority.',
    'Count them. {n1}, {n2}, {n3}, {rest}. Now count us.',
    'It is bigger than you think. {n1}, {n2}, {n3}, {rest} — the lot of them.',
    'Four of them, minimum. {n1}, {n2}, {n3}, {rest}.',
    '{n1} has {n2} and {n3}. Then there is {rest} on top of that. We are already behind.',
    'You are worried about {n1}. Worry about {n1}, {n2}, {n3}, {rest}.',
    'They have the numbers. {n1}, {n2}, {n3}, {rest}. It is arithmetic now, not strategy.',
    'I stopped counting at {n1}, {n2}, {n3}, {rest}, and I do not think I had finished.',
    'It is a wall. {n1}, {n2}, {n3}, {rest}. Nothing gets through it from where we are.',
    'Say it out loud and it sounds mad. {n1}, {n2}, {n3}, {rest}, all one thing.',
    'Every one of them was at that fire last night. {n1}, {n2}, {n3}, {rest}.',
    'We need to break one off. {n1}, {n2}, {n3}, {rest} — one of them is soft.',
    '{n1}, {n2}, {n3}, {rest}. If they hold, you and I are only deciding the order we go in.',
    'They do not even need to be subtle. {n1}, {n2}, {n3}, {rest}, right out in the open.',
    'That is four, and they know it is four. {n1}, {n2}, {n3}, {rest}.',
    'I asked {n2} about {n1} and got a speech. Then {n3} gave me it word for word. So did {rest}.'
  ],

  /* ---------- they sense a bloc and cannot name it ----------
     The most honest state, and the least useful. */
  blocVague: [
    'Something has formed. I do not know who is in it, and that frightens me more.',
    'There is a group. I can feel the shape of it and I cannot see the faces.',
    'Somebody is counting people out here and it is not me.',
    'Names have already been decided somewhere I was not standing.',
    'Conversations stop when I walk over. That is all I have got for you.',
    'I know there is a bloc. Ask me who and I would be making it up, so I will not.',
    'Have you noticed nobody argues about anything any more? That is not peace.',
    'People have been very kind to me today. That is usually a number being carried.',
    'It is not the whispering. It is that the whispering stopped.',
    'There are two conversations happening on this beach and I am only in one of them.',
    'I would give you names if I had them. I have got a feeling and a bad night.',
    'Somebody in this camp is never surprised by anything. I have not worked out who.',
    'Every answer I get is the same answer. Somebody wrote it for them.',
    'There is a plan. I am not in it. That is the extent of what I know.',
    'You can smell it, can you not. Do not ask me to point at it.',
    'I keep walking into the ends of conversations.',
    'Something moved last night and nobody has said what.',
    'It is tighter out here than it looks. I cannot show you where.'
  ],

  /* ---------- a confident read that is NOT REAL ----------
     Deliberately the same register as blocSure3: the same evidence-citing, the
     same flat certainty, the same smugness, the same one-word sentences. There
     is no linguistic tell, on purpose. The player has to check it themselves. */
  blocWrong: [
    'It is {n1}, {n2} and {n3}. I have known for days.',
    'Watch {n1}, {n2} and {n3} at the fire tonight. You will see what I see.',
    '{n1}, {n2}, {n3}. Three. And they think nobody has noticed.',
    'Everyone is looking at {n1}. Nobody is looking at {n1}, {n2} and {n3} together.',
    'I counted it out on my fingers this morning. {n1}, {n2}, {n3}. It is not close.',
    '{n2} covers for {n1}. {n3} covers for both of them. That is the shape of it.',
    'You can hear it in how {n1} says {n3}’s name. And {n2} is in it too.',
    'Those three. {n1}, {n2} and {n3}. I would bet my place here on it.',
    'I saw {n1} and {n3} come back from the rocks. {n2} was already waiting. Draw the line yourself.',
    'Three of them move as one and it is {n1}, {n2}, {n3}. Do not tell me otherwise.',
    'They have not said a word out of step all week, {n1}, {n2} and {n3}.',
    '{n1} does the talking. {n2} and {n3} do the nodding. Oldest thing in the world.',
    'It took me a while. {n1}, {n2} and {n3}. Once you see it you cannot unsee it.',
    'Nobody sits like that by accident. {n1} one side, {n2} the other, {n3} in the middle.',
    'I will say it plainly. {n1}, {n2} and {n3} have the numbers and we do not.',
    'Do not trust {n2}. Or {n1}. Or {n3}, and that is the one that will surprise you.',
    '{n1}, {n2}, {n3}. That is the vote. That has been the vote since the first fire.',
    'I asked {n3} a straight question about {n1} and got a very careful answer. Then {n2} came over.'
  ],

  /* ---------- working out whether the numbers are against them ----------
     Not a report — a calculation, out loud, at somebody. */
  blocCounting: [
    'If they are four and we are three, I need one more and I need them today.',
    'Right. Say it is three of them. Then it is you, me, and we are two short.',
    'I keep counting and getting an answer I do not like. Count it with me.',
    'Five beats four. So where is our fifth?',
    'Say {tn} goes with them. Then it does not matter what you and I agree, does it.',
    'Talk me through the numbers. Slowly. I have had it wrong all morning.',
    'I am one short. I have been one short for two days.',
    'Even with you, that is two. Two is not a plan, it is a feeling.',
    'Who is the swing? Because if there is no swing we are only choosing which of us goes first.',
    'It works if {tn} comes with us. It does not work otherwise. That is the whole thing.',
    'I have done this four times and it comes out the same way every time.',
    'We are behind. I am not going to stand here and pretend we are not behind.',
    'Numbers first, feelings after. Where are we?',
    'If it goes to a tie I do not fancy my chances. So it cannot go to a tie.',
    'Three, four, and one who will not tell me. Guess which one keeps me awake.',
    'We do not need to win the camp. We need one more vote than they have.',
    'I counted the shelter last night while everybody was asleep. It was not good reading.',
    'You are the number I do not have yet. That is why I am telling you any of this.'
  ],

  /* ---------- hinting that THEY are in one, without admitting it ---------- */
  blocMine: [
    'I am not on my own out here. That is all I am going to say.',
    'Do not worry about me tonight. I am fine tonight.',
    'Let us say I know which way this is going, and it is not going at me.',
    'I have got people. Not saying who, not saying how many.',
    'If I needed three votes I could have them by dark. I am not saying I need them.',
    'There is a conversation I have every night. You are not in it. Yet.',
    'You could be in this. There is room for one more. That is as much as I will give you.',
    'I am covered. Genuinely covered. Do not ask me by whom.',
    'Some of us sorted this out on the first night. That is all I am saying.',
    'I know exactly what my name is doing tonight, which is nothing.',
    'I do not have to ask anybody how they are voting. Think about what that means.',
    'You are asking the wrong person to be worried.',
    'Say I had numbers. Say I did. What would you want from me?',
    'I am not going to tell you I am in something. I am going to tell you to relax around me.',
    'There are people here I do not have to check with. That is the luxury out here.',
    'I have been in this since the start of it. Take that however you want.'
  ],

  /* ---------- asked outright, they deny it ----------
     True or false. The wording does not distinguish. */
  blocDenyMine: [
    'Me? I am on my own out here. Ask anybody.',
    'No. No numbers, no group, nothing. It is why I look like this.',
    'I wish I was in something. I would sleep better.',
    'Who exactly do you think would have me?',
    'That is a nice theory. It is not true, but it is nice.',
    'No group. I talk to everyone and belong to nobody.',
    'If I had numbers do you think I would be standing here with you?',
    'I am on my own and it is horrible. Do not recommend it.',
    'Somebody has been telling you things. They are wrong.',
    'I have made no promises to anybody out here. That is the honest answer.',
    'No. And I am slightly offended you had to ask.',
    'People assume that because I get on with everyone. It does not mean anything.',
    'Not me. I am the one everybody talks around.',
    'Absolutely not. Where would you even have heard that?',
    'You have got me confused with somebody who is playing well.',
    'No. Ask me in three days and it might be a different answer, but no.'
  ],

  /* ---------- they think the bloc is coming for the PLAYER ---------- */
  blocWarnPlayer: [
    'They are coming for you. {n1}, {n2} and {n3}, and it is tonight.',
    'Your name is the one that goes with all three of theirs. You should know that.',
    'I would not walk into that fire tonight without doing something first.',
    'It is you. I am sorry, but it is you, and there are three of them.',
    '{n1} said your name to me this morning and {n2} did not blink.',
    'Whatever you have got, use it. I mean that.',
    'They have decided about you. Maybe not tonight. But they have decided.',
    'You are the safe name. Do you understand what that means out here?',
    'Nobody else is going to warn you, and I am not nobody. It is you.',
    'Three of them, one name, and the name is {me}.',
    'If you go home tonight, I want you to remember I told you.',
    'Do not look at {n1}. Do not change anything. Just find a fourth vote by dark.',
    'They think you are the biggest threat left. That is a compliment and it will send you home.',
    'You have been the plan for two days. I only got let in on it last night.',
    'Every one of them has been lovely to you today. Ask yourself why.',
    'It was you or me and they picked you. I am telling you anyway.',
    'I heard your name, and then I heard laughing. The laughing is the part I did not like.',
    'Get to {tn} today. {tn} is the only one who can stop this.'
  ],

  /* ---------- they think the bloc is coming for THEM ---------- */
  blocWarnThem: [
    'It is me. I have known since yesterday and I have said nothing to anyone.',
    'They are going to write my name and I do not have the numbers to stop it.',
    'If I go tonight, remember who told you the truth.',
    'Three of them. One of me. Do the maths and tell me I am wrong.',
    'I need help, and I have never said that out loud before.',
    'They have stopped asking my opinion. That is how you know.',
    'Nobody has looked me in the eye since we got up.',
    'I am the name. I am not going to beg, but I am the name.',
    'They will come for me and then they will come for you. That order.',
    'I was in it. Then I was not. Nobody told me which day that changed.',
    'You are the only person here who has not been told to write me.',
    'I can count and I do not like the answer.',
    'If you save me I am yours for the rest of this. That is not a figure of speech.',
    'They think I am the easy one. I would like to make that expensive.',
    'Do not be seen with me today. Be with me tonight.',
    'It is coming. I would just rather it was not five to one.'
  ],

  /* ---------- they genuinely have not noticed anything ----------
     Which is itself a read on them, exactly like the idle band in campRead. */
  blocNothing: [
    'Honestly? I have not been watching. I have been trying to stay alive.',
    'No idea. I am terrible at this part of it.',
    'Everyone looks the same to me. Is that bad?',
    'I have been asleep or hungry for four days. I have noticed nothing.',
    'People keep asking me that and I keep having nothing to say.',
    'If something is going on, it is going on without me knowing about it.',
    'I am not the person to ask. I am genuinely not.',
    'I have been watching the fire, not the people.',
    'Nothing. And now you have said it I am going to worry about it all day.',
    'Everybody is friends with everybody. That is all I see out here.',
    'I would tell you if I had anything. I have got nothing.',
    'You are asking me like I have been paying attention.',
    'No. Should I have seen something?',
    'I do not really look at who is with who. Maybe I should start.',
    'Not a thing. It has been quiet, which suits me.',
    'I have got no read on anybody out here yet. Including you.'
  ],

  /* ---------- they turn it round and ask the PLAYER ----------
     Information is a currency, and half the cast would rather buy than sell. */
  blocAskPlayer: [
    'You tell me first. Who is tight out here?',
    'What have you got? I will trade.',
    'Who are you counting? Say the names.',
    'Before I answer — who do you think has the numbers?',
    'I have got a read. I want to hear yours and see if they match.',
    'Go on then. Three names. Who moves together?',
    'You have been watching. I know you have. What did you see?',
    'Am I mad, or is there a group? Tell me I am mad.',
    'Who would you put with {tn}? That is the bit I cannot work out.',
    'You first. I have been burnt handing this out for free.',
    'If I say a name, will you tell me whether it matches yours?',
    'What does it look like from where you are standing?',
    'Do you count {tn} with them or not? It changes everything.',
    'I need somebody honest to check my numbers. Are you honest?',
    'Who is the pair? Everything starts with a pair.',
    'Tell me what you have seen and I will tell you if it is real.'
  ],

  /* ---------- how the PLAYER raises it ---------- */
  playerAskBloc: [
    'Who is tight out here?',
    'Who moves together? Honestly.',
    'Say there is a group. Who is in it?',
    'Who has the numbers right now?',
    'What are you seeing? Names, if you have got them.',
    'Who should I be counting?',
    'Is there a bloc I am not seeing?',
    'Which two never leave each other alone?',
    'Where are the numbers, do you think?',
    'You have been watching longer than me. Who is with who?'
  ],

  /* ---------- the player offering their own read ---------- */
  playerShareBloc: [
    'I think {n1}, {n2} and {n3} are getting close.',
    'Keep this quiet — {n1}, {n2} and {n3}. That is my read.',
    'Tell me if I am mad. {n1}, {n2}, {n3}.',
    'I have got {n1} with {n2}, and {n3} somewhere just behind them.',
    'Watch {n1}, {n2} and {n3} tonight. Then tell me I am wrong.',
    'Three of them. {n1}, {n2} and {n3}. I am fairly sure.',
    'I would put {n1}, {n2} and {n3} in the same boat.',
    'This is what I have got: {n1}, {n2}, {n3}. Yours?',
    'It is {n1} and {n2} for certain. {n3} is the one I keep going back and forth on.',
    'Do not repeat this. {n1}, {n2} and {n3} have the numbers.'
  ]
};

/* ---------- picker ----------
   CampLines keeps a rolling window of recent lines; that is enough for a pool
   that fires a few times a day, but a bloc read fires on every Ask, Observe and
   Game talk, so a window still lets the same sentence come back inside a season.
   This tracks USED lines per key instead: a pool never repeats until it is
   exhausted, then it clears and starts again. "The lines repeat" is the note
   this project gets most often and it is invisible from inside one playthrough.

   Per season, because GAME.seasonSeed changes on a new season — a fresh cast
   should get the whole pool back. */
const BlocTalk = {
  _used: {},                  // key -> array of already-spoken raw lines
  _season: null,              // seasonSeed the _used map belongs to
  _recent: [],                // cross-key window, so two keys cannot echo

  reset() {
    this._used = {};
    this._recent = [];
    this._season = (typeof GAME !== 'undefined' && GAME) ? GAME.seasonSeed : null;
  },

  /* Clear everything if the season changed under us. */
  _checkSeason() {
    const seed = (typeof GAME !== 'undefined' && GAME) ? GAME.seasonSeed : null;
    if (seed !== this._season) this.reset();
  },

  _remember(s) {
    this._recent.push(s);
    while (this._recent.length > 20) this._recent.shift();
  },

  /* Fresh lines in a pool = everything not yet spoken this season. */
  _fresh(key, pool) {
    const used = this._used[key] || [];
    const left = pool.filter(s => used.indexOf(s) < 0);
    if (left.length) return left;
    /* Exhausted. Wipe this key only and hand back the whole pool again. */
    this._used[key] = [];
    return pool.slice();
  },

  /* key: pool name. subs: {n1, n2, n3, rest, tn, me}. Returns '' for an unknown
     key so a caller can fall back rather than print "undefined". */
  say(key, subs) {
    this._checkSeason();
    const pool = BLOC_LINES[key];
    if (!pool || !pool.length) return '';

    let left = this._fresh(key, pool);
    /* Prefer something that has not just been said by a neighbouring pool. The
       shuffle is what stops the pools draining in file order, which reads as a
       script rather than a person. */
    const shuffled = (typeof shuffle === 'function') ? shuffle(left.slice()) : left.slice();
    let s = shuffled.find(x => this._recent.indexOf(x) < 0);
    if (!s) s = (typeof pick === 'function') ? pick(left) : left[0];

    (this._used[key] || (this._used[key] = [])).push(s);
    this._remember(s);
    if (typeof LineCensus !== 'undefined') LineCensus.note(key + ':' + pool.length, s);

    let out = s;
    const v = subs || {};
    for (const k of Object.keys(v)) {
      if (v[k] === undefined || v[k] === null) continue;
      out = out.replace(new RegExp('\\{' + k + '\\}', 'g'), v[k]);
    }
    return out;
  },

  /* How much of a pool is still unspoken, for the season report. */
  remaining(key) {
    const pool = BLOC_LINES[key];
    if (!pool) return 0;
    return Math.max(0, pool.length - ((this._used[key] || []).length));
  }
};
