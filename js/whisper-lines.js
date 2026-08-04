/* ============================================================
   WHISPER LINES — tribal council, before the vote, when it breaks open.

   On the show this happens once or twice a season and it is the loudest quiet
   thing in television: somebody leans over, says a name, and instead of one
   conversation there are four. Peff does not stop it. He watches it, because
   stopping it would be the only mistake available to him. It dies on its own
   when nobody has anything left.

   So the pools here are built for that shape:

     the OPENERS      what the player can hiss at somebody (askWho .. standDown)
     the REPLIES      what comes back, keyed by where that person actually is
     the OVERHEARD    NPC-to-NPC, caught in halves, never whole
     the STAGING      narrator beats: it starts, spreads, thins, stops
     PEFF             letting it run, then taking the council back

   A whisper is 3-14 words. Nobody makes a speech at nine inches from an ear
   with eleven people watching, so nothing in here is a sentence anybody would
   be proud of. Some lines are barely coherent on purpose — real whispers are
   half thought and half panic.

   PLACEHOLDERS
     {tn}   the target name (a name being pushed, warned about, countered)
     {n1}   first castaway in a staging beat — the one who starts it
     {n2}   the one it lands on
     {n3}   whoever it reaches next
     {me}   the player
   Openers and replies use {tn} only. Staging lines use {n1}/{n2}/{n3} and may
   use {me}. Any placeholder the caller does not supply is left as-is rather
   than blanked, so a missing sub shows up loudly in testing instead of quietly
   in a playthrough.
   ============================================================ */

'use strict';

const WHISPER_LINES = {

  /* ============================================================
     THE OPENERS — what the player leans over and says.
     The button the player taps carries the plain label ("Who are you
     writing?"); these are the words that actually come out, so the same choice
     never sounds the same twice.
     ============================================================ */

  /* ---------- "who are you writing?" ---------- */
  askWho: [
    'Who. Just tell me who.',
    'Name. Now. Who is it.',
    'Who have you got. Quick.',
    'Who are you writing. I need to know.',
    'Say the name. Do not look up.',
    'Who. I am not asking twice.',
    'Tell me the name and I will sit back.',
    'Who is it tonight. Straight answer.',
    'Give me a name. Any name. Yours.',
    'What have you got written. Honestly.',
    'One name, from you, right now.'
  ],

  /* ---------- "write {tn}" ---------- */
  pushName: [
    '{tn}. Write {tn}.',
    'It is {tn}. Do not think about it.',
    '{tn}. Trust me. {tn}.',
    'Write {tn} and we are all fine.',
    'Change it. {tn}.',
    '{tn}. Say nothing, just do it.',
    'Four of us on {tn}. Be the fifth.',
    'Do not look at {tn}. Just write it.',
    '{tn}, tonight, and I explain after.',
    'Please. {tn}. That is all I need.',
    'It is {tn} or it is one of us.'
  ],

  /* ---------- "they are coming for you" ---------- */
  warn: [
    'It is you. They are writing you.',
    'You. It is you tonight.',
    'Do not react. Your name is up.',
    'They have got you. Four of them.',
    'You need to move. It is you.',
    'They are coming for you and you are sitting there.',
    'Your name. All afternoon. Yours.',
    'Keep your face still. It is you.',
    'If you have got anything, use it. Now.',
    'Nobody told you. It is you.',
    'You are the name. I am sorry.'
  ],

  /* ---------- "are we still good?" ---------- */
  confirm: [
    'We good. Still good.',
    'Tell me nothing has changed.',
    'Same as we said. Yes?',
    'You are still with me. Yes or no.',
    'One word. Are we solid.',
    'Nothing moved. Right?',
    'I need to hear it. We are fine.',
    'Look at me. Are we still on.',
    'Same name as this afternoon. Yes.',
    'Do not make me guess. Are we good.',
    'Say yes and I will leave you alone.'
  ],

  /* ---------- "it has changed. not {tn} any more" ---------- */
  flip: [
    'It has changed. Not {tn}.',
    'Not {tn} any more. It moved.',
    'Forget {tn}. It is not {tn}.',
    'Do not write {tn}. It is off.',
    'Plan is dead. {tn} is safe.',
    '{tn} is not the name. It changed an hour ago.',
    'Scrap {tn}. New name coming.',
    'Whatever they told you about {tn} — no.',
    '{tn} is off. I will explain after.',
    'It flipped. {tn} walks.',
    'Not {tn}. Do not ask me here.'
  ],

  /* ---------- the numbers are not where you say they are ---------- */
  bluff: [
    'There are five on it. Five.',
    'Everybody is on it but you.',
    'You are the last one. Everyone else moved.',
    'It is six to two. You are in the two.',
    'The whole side is with me. Count them.',
    'I have got more than I need. I want you anyway.',
    'Three of them already switched. Ask them.',
    'You are one vote from the wrong end of this.',
    'It is done. I am telling you to be kind.',
    'Your two are not your two. Not tonight.',
    'Nobody is where you think they are.'
  ],

  /* ---------- hinting at an idol, true or otherwise ---------- */
  idolBait: [
    'Do not waste your vote. I am covered.',
    'I am not going home tonight. I cannot.',
    'I found something. Day nine, by the well.',
    'Write me if you like. It will not count.',
    'There is a reason I am calm. Think about it.',
    'You do not want your name on the wrong side of this.',
    'I have got a pocket full of insurance.',
    'Ask yourself why I am not worried.',
    'One of us at this fire cannot be voted. Guess.',
    'Vote me and you waste it. That is all I am saying.',
    'I would not have sat here otherwise.'
  ],

  /* ---------- "do not do anything stupid" ---------- */
  standDown: [
    'Do not do anything stupid. Vote how we said.',
    'Sit still. Same name. Nothing clever.',
    'Whatever you are hearing, ignore it.',
    'Do not move. Not now.',
    'No. Stop. Same as we agreed.',
    'Do not think. Just write it.',
    'Hands still, name the same. Please.',
    'You are about to ruin it. Do not.',
    'Nothing changes. Look at nobody.',
    'Whatever they just said to you — no.',
    'Hold. Hold. Same name.'
  ],

  /* ============================================================
     THE REPLIES — keyed by where the responder actually is, which is not
     always where they say they are. The caller picks the pool from
     disposition, promises and whether they were lying at lunchtime.
     ============================================================ */

  /* ---------- with you, and happy to say it ---------- */
  replyLoyalYes: [
    'Same as we said. Done.',
    'Yes. Written. Go and sit down.',
    'I am with you. Stop asking.',
    'Already there. Already written.',
    'You did not have to come over.',
    'Yes. Yes. Go.',
    'Whatever you need. Say the name.',
    'I am not moving. You know that.',
    'It is your name I will never write. Go.',
    'Consider it done. Sit back.',
    'Locked. Sit down before he looks.',
    'You had me an hour ago.',
    'Right. Same page. Breathe.',
    'Yes. Do not come back over.',
    'I am there. Trust it.',
    'Same. Now go, they are watching you.'
  ],

  /* ---------- with you, but not in front of eleven people ---------- */
  replyLoyalStall: [
    'Not here. Not with him listening.',
    'Trust me and stop talking.',
    'I cannot say it out loud. Read my face.',
    'Later. It is fine. Later.',
    'Do not make me say the name here.',
    'You know where I am. Leave it.',
    'I am nodding. That is all you get.',
    'Wait. Just wait.',
    'I will do the right thing. Sit down.',
    'Please stop asking me in front of them.',
    'Not now. I am not saying no.',
    'You have to give me a minute.',
    'I will handle it. Do not push.',
    'Ask me nothing. Watch what I write.',
    'It is covered. Go back to your seat.',
    'Half of them are reading your mouth. Stop.'
  ],

  /* ---------- not with you, and not hiding it ---------- */
  replyColdRefuse: [
    'No. Sit down.',
    'Not doing it. Do not ask again.',
    'You are wasting a whisper.',
    'I have written what I am writing.',
    'No. And you knew that.',
    'Go and ask somebody softer.',
    'That is not happening. At all.',
    'You have come to the wrong person.',
    'Absolutely not. Move.',
    'I do not take names from you.',
    'You are two days late for this.',
    'No. Now go, people are looking.',
    'I am not on your side. Sorry.',
    'Do not lean on me. It is a no.',
    'You should be talking to someone else.',
    'No. That is the whole answer.'
  ],

  /* ---------- not with you, and lying about it ---------- */
  replyColdFake: [
    'Yes. Same name. Obviously.',
    'Of course. Do not even ask.',
    'We are fine. We have always been fine.',
    'Yes. Go, before he sees us.',
    'Same as we said. Word for word.',
    'You have my vote. Relax.',
    'I would tell you if it moved. I would.',
    'Nothing has changed. Nothing.',
    'Yes. Now sit back and look calm.',
    'Trust me. You can trust me.',
    'Do not worry about me. Worry about them.',
    'I am with you. Say no more.',
    'Written already. It is done.',
    'Yes, yes. Go on.',
    'You do not need to check on me.',
    'Whatever you heard, it is not true. I am with you.'
  ],

  /* ---------- they did not know, and it has just landed ---------- */
  replyPanic: [
    'What. What. Say that again.',
    'Me? Since when. Since when.',
    'No. No, that is — who told you.',
    'How many. How many of them.',
    'I have nothing. I have nothing ready.',
    'You are joking. You are not joking.',
    'Who. Give me a name, quick.',
    'That cannot be right. I spoke to them.',
    'Wait — wait, wait.',
    'Oh. Oh no. Right.',
    'I need to talk to somebody. Now.',
    'Is it — is it him? Is it him.',
    'I am going home. I am going home tonight.',
    'What do I do. Tell me what to do.',
    'They looked me in the face this afternoon.',
    'How long have you known this.'
  ],

  /* ---------- old news ---------- */
  replyAlreadyKnew: [
    'I know. I have known since the challenge.',
    'Yes. Old news. Sit down.',
    'You are the third person to tell me.',
    'Heard it. Handled.',
    'I know. That is why I am sitting like this.',
    'You are late. But thank you.',
    'I had it this afternoon. Keep up.',
    'Yes. Who told you.',
    'I know all of it. Say nothing else.',
    'Do you think I would be this calm otherwise.',
    'Mm. It is why I moved already.',
    'Old. Ask me the new one.',
    'I have been waiting for somebody to say it.',
    'Yes. And I know who started it.',
    'Knew before you did. Not a criticism.',
    'Everybody knows. That is the problem.'
  ],

  /* ---------- they resent being whispered at at all ---------- */
  replyOffended: [
    'Do not do this to me here.',
    'Get away from my ear.',
    'This is exactly what I did not want.',
    'You have just put me on camera. Thanks.',
    'I am not whispering at a vote. No.',
    'Everybody can see you doing this.',
    'We had all afternoon. You pick now.',
    'Sit up. You look ridiculous.',
    'I do not do this. Ask anyone.',
    'You are making me look like yours.',
    'Say it out loud or do not say it.',
    'No. This is not how I play.',
    'You have embarrassed us both.',
    'Whatever it is, it can wait for the urn.',
    'Move. Genuinely, move.',
    'This is why people write your name.'
  ],

  /* ---------- Peff is looking. shut it down ---------- */
  replyNoTime: [
    'He is looking. Stop.',
    'Not now. He is watching you.',
    'Camera. Camera. Sit back.',
    'Later — he is coming over.',
    'Shh. Shh.',
    'He can hear us. He always can.',
    'Face front. Now.',
    'Enough. He has stopped talking.',
    'Somebody is filming your mouth. Stop.',
    'Peff. Peff. Sit up.',
    'No time. Just do what is right.',
    'They are all watching. Leave it.',
    'Later. Not a word more.',
    'You have run out of quiet. Go.',
    'He is about to ask what we are doing.',
    'Stop, stop — he said something.'
  ],

  /* ---------- a different name entirely ---------- */
  replyCounterName: [
    '{tn}. It has to be {tn}.',
    'Not that one. {tn}.',
    'No. {tn}. Think about it.',
    'I am writing {tn} and so should you.',
    'Wrong name. {tn}.',
    '{tn} is the danger. Not who you said.',
    'Forget all that. {tn}.',
    '{tn}. I have three on it already.',
    'I will do it, but the name is {tn}.',
    'You are one name off. {tn}.',
    'If we are moving, we move on {tn}.',
    '{tn}, or I write what I was writing.',
    'Give me {tn} and I am with you.',
    'No. {tn} goes tonight.',
    'It was always going to be {tn}.',
    'One name works and it is {tn}.'
  ],

  /* ---------- they think somebody is holding an idol ---------- */
  replyIdolFear: [
    'Somebody here has one. I can feel it.',
    'Do not put it on him. He is holding.',
    'If it comes out we all look stupid.',
    'Watch his hands. Watch them.',
    'Split it. We have to split it.',
    'One of them is far too relaxed.',
    'I am not wasting my vote on a pocket.',
    'Somebody found it. Nobody has said.',
    'That is a man who is not going home.',
    'Why is she smiling. Why is she smiling.',
    'It is out there. It has been for days.',
    'Put it on the safe one. Please.',
    'I have got a bad feeling about tonight.',
    'If he plays it, where does it land. Us.',
    'Nobody sits like that without one.',
    'We are walking into it. I know we are.'
  ],

  /* ============================================================
     OVERHEARD — NPC to NPC. The player is four feet away and catching
     halves, so these open mid-thought and stop mid-thought.
     ============================================================ */

  /* ---------- a fragment with no name in it ---------- */
  overheardFragment: [
    '…not tonight, not with him sitting there',
    '…if it is four and four then what',
    '…I am not the one who has to write it',
    '…she asked me the same thing an hour ago',
    '…no, no, listen — listen',
    '…because he already lied about the last one',
    '…then we are both going, do you understand that',
    '…who told you that, who actually told you',
    '…I said the same to her and she went quiet',
    '…it does not matter now, it is written',
    '…do it and do not look at me after',
    '…that is not what we agreed at the well',
    '…and if she has got it we are finished',
    '…too late. It is too late',
    '…swear to me. Swear it',
    '…I will take the blame, just write it',
    '…count again. Count it again',
    '…he has been lying to us since the swap'
  ],

  /* ---------- a fragment with a name in it ---------- */
  overheardName: [
    '…{tn}. It has to be {tn}',
    '…not {tn}, are you mad, not tonight',
    '…{tn} does not know. {tn} has no idea',
    '…if we lose {tn} we lose every challenge',
    '…{tn} came to me first. Think about that',
    '…so it is {tn} and then what',
    '…who is on {tn}. Names. Give me names',
    '…{tn} asked me the same and I said nothing',
    '…{tn} is not writing what they told you',
    '…keep {tn} off it, I am begging you',
    '…{tn} is the one who started all of this',
    '…three on {tn}. We need one more',
    '…{tn} will never forgive it. Fine',
    '…do not tell {tn}. Do not',
    '…and {tn} is sitting there smiling',
    '…{tn} has got it. I would put money on {tn}',
    '…is {tn} in or is {tn} out',
    '…swap it to {tn} and it is done'
  ],

  /* ---------- one of them talking the other down ---------- */
  overheardCounter: [
    '…no. No. Sit down and write it',
    '…you are panicking. Stop panicking',
    '…do that and you go next week. Guaranteed',
    '…listen to me. It does not work. It does not work',
    '…who else, then. Who. Name them',
    '…you are counting people who are not there',
    '…that is her talking, not you',
    '…if you move now everybody sees it',
    '…you will hand him the whole game',
    '…two is not a majority. Two is nothing',
    '…do not. Not on a feeling',
    '…I am telling you the numbers are not there',
    '…you have got nine seconds. Do not',
    '…she has said that to four people tonight',
    '…it is one vote and it is a wasted one',
    '…hold. Just hold. Please',
    '…you will regret it before the urn is back',
    '…we do it next time. Next time'
  ],

  /* ============================================================
     STAGING — narrator beats, not speech. The cascade has four movements:
     it starts, it spreads, it thins, it stops. Peff watches all four.
     ============================================================ */

  /* ---------- it breaks out ---------- */
  cascadeStart: [
    '{n1} leans across to {n2}. It does not stay between them.',
    '{n1} says something short to {n2} and the whole bench tilts forward.',
    'A name goes from {n1} to {n2}. Then it keeps going.',
    '{n1} turns their head two inches and starts whispering.',
    'It starts with {n1}. It always starts with somebody.',
    '{n2} looks at {n1} and mouths a name. Three people catch it.',
    '{n1} is out of their seat before Peff has finished the question.',
    'Somebody says wait, out loud. {n1} is already talking to {n2}.',
    '{n1} cups a hand round {n2}’s ear. Nobody pretends not to watch.',
    'The bench goes wrong all at once. {n1} started it.',
    '{n1} whispers. {n2} recoils. That is all it takes.',
    '{n2} shifts down the bench to reach {n1}. Here it comes.',
    '{n1} says four words to {n2} and every head turns.'
  ],

  /* ---------- it spreads ---------- */
  cascadeSpread: [
    'It reaches {n3}. Now there are three conversations.',
    '{n3} is up and moving. Nobody is sitting where they started.',
    'Four separate whispers at once. None of them agree.',
    '{n3} leans into it and the whole row goes with them.',
    'It is everywhere now. Two on the end, three by the fire.',
    'Somebody is being told something they do not like. Then somebody else.',
    'The urn sits there ignored. Everyone has found someone.',
    '{n1} to {n2}, {n2} to {n3}. It moves like weather.',
    'Nobody is whispering quietly any more. It is just talking.',
    '{n3} says a name loudly enough that {me} hears it.',
    'Three huddles, one name in all of them. Possibly the same one.',
    'People are half standing. Half of them do not know why.',
    'It has stopped being whispering and nobody has noticed.'
  ],

  /* ---------- it runs out of steam ---------- */
  cascadeDying: [
    'It is thinning out. People are running out of things to say.',
    '{n1} sits back first. Then {n2}.',
    'The last two whispers overlap, and then stop.',
    'Somebody shrugs. That is usually the end of it.',
    'People start looking at the urn instead of each other.',
    'It goes quiet in patches, then all at once.',
    '{n3} says one more thing to nobody in particular.',
    'Whatever was going to change has changed. The rest is noise.',
    'Two of them are still talking. Neither is listening.',
    'The energy goes out of it. Nobody won.',
    'A last name, half said, and then nothing.',
    '{n2} shakes their head and turns back to the fire.',
    'It dies where it started. {n1} has stopped talking.'
  ],

  /* ---------- silence, and Peff still standing there ---------- */
  cascadeOver: [
    'Everyone is back in their seat. Nobody looks the same as before.',
    'Silence. The fire is suddenly very loud.',
    'The bench is full again. No eye contact anywhere on it.',
    'It is over. Whatever it did, it did.',
    'Peff waits two seconds longer than he needs to.',
    'Quiet. Somebody swallows and it carries.',
    'The council settles. Nothing about it looks settled.',
    'Everybody sits. Half of them are lying about something new.',
    'Nobody says anything else. Peff picks up where he left off.',
    'It stops. The next sound is Peff.',
    'People arrange their faces. Peff lets them finish.',
    'Back to strangers on a bench. Almost.'
  ],

  /* ---------- Peff, observing, not intervening ----------
     He never shuts it down. A host who stops this has nothing to host. */
  peffWatches: [
    'Peff folds his arms and watches it happen.',
    'Peff has seen this before. He is not going to interrupt it.',
    'Peff looks at the urn, then at the bench, and says nothing.',
    'Peff raises an eyebrow at nobody and waits.',
    'Peff lets it run. That is the whole trick of the job.',
    'Peff follows it round the bench like a man watching tennis.',
    'Peff shifts his weight and settles in.',
    'Peff is enjoying this and doing very little to hide it.',
    'Peff catches the camera’s eye. He does not need to say anything.',
    'Peff checks the time, decides against mentioning it.',
    'Peff mouths a name to himself. He is keeping score too.',
    'Peff stands very still and lets eleven people talk over him.',
    'Peff nods slightly, as though something had been confirmed.'
  ],

  /* ============================================================
     PEFF SPEAKS — dry, unhurried, never scolding.
     ============================================================ */

  /* ---------- he acknowledges it and lets it run ---------- */
  peffAllows: [
    'By all means. Take your time.',
    'No, no. Carry on. This is the good part.',
    'I have got all night. Some of you have not.',
    'Do not mind me. I will be here.',
    'This is the most honest anybody has been all day.',
    'Somebody said a name. Now everybody has to say one.',
    'I would ask you to sit down, but nobody is listening to me.',
    'Whisper away. The jury is taking notes.',
    'Well. This is new.',
    'I have seen quieter tribals. Not many.',
    'Go on. Get it out of your systems.',
    'Twenty seasons of this and it never gets old.'
  ],

  /* ---------- he takes the council back ---------- */
  peffResumes: [
    'Right. Anybody else, or shall we vote.',
    'Are we done? Good. It is time to vote.',
    'If nobody has anything left, I will fetch the urn.',
    'Alright. Sit down. Somebody is going home.',
    'Enough. Whatever you decided, you decided.',
    'That is that. It is time to vote.',
    'Lovely. Now go and write a name down.',
    'Sit, all of you. {me}, you are up first.',
    'Good. Now we find out who was lying.',
    'It is time to vote. Try to look like you meant it.',
    'Back to it. Nothing you said changes what happens next.',
    'Done? Then the only thing left is the vote.'
  ]
};

/* ---------- picker ----------
   Same shape as CampLines.pick, but stricter. CampLines only guards against an
   immediate repeat, which is fine for ambient camp chatter you hear forty times
   a season. Whispering happens once or twice in a whole game and the player is
   reading every word of it, so a repeat here is not a texture problem, it is a
   broken illusion. Every key keeps a set of the indices it has already spent
   this season and will not spend one twice until the pool is empty; then it
   starts a fresh lap, and even across that boundary it will not hand back the
   line it just used. */
const Whispers = {
  _used: new Map(),   // pool key -> Set of indices already spoken this season
  _last: '',          // the last line returned for any key, pre-substitution

  /* New season, new memory. */
  reset() { this._used.clear(); this._last = ''; },

  /* How many unspent lines this key has left. Handy in the log. */
  left(key) {
    const pool = WHISPER_LINES[key];
    if (!pool) return 0;
    const used = this._used.get(key);
    return pool.length - (used ? used.size : 0);
  },

  /* key: pool name. subs: { tn, n1, n2, n3, me } — only what the line needs.
     Returns '' for an unknown or empty pool so a caller can fall back rather
     than print "undefined" at the single tensest moment in the show. */
  say(key, subs) {
    const pool = WHISPER_LINES[key];
    if (!pool || !pool.length) return '';

    let used = this._used.get(key);
    if (!used) { used = new Set(); this._used.set(key, used); }
    if (used.size >= pool.length) used.clear();          // pool spent: new lap

    let free = [];
    for (let i = 0; i < pool.length; i++) if (!used.has(i)) free.push(i);
    /* On a fresh lap the only unspent line may be the one just spoken. Drop it
       if there is anywhere else to go. */
    if (free.length > 1) {
      const other = free.filter(i => pool[i] !== this._last);
      if (other.length) free = other;
    }

    const at = free[ri(0, free.length)];
    used.add(at);
    const raw = pool[at];
    this._last = raw;

    /* Census before substitution, so one line said about four people counts as
       one line and not four. */
    if (typeof LineCensus !== 'undefined') LineCensus.note(key + ':' + pool.length, raw);

    let s = raw;
    const v = subs || {};
    for (const k of Object.keys(v)) {
      if (v[k] === undefined || v[k] === null) continue;
      s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), v[k]);
    }
    return s;
  }
};
