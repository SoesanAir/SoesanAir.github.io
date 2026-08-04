/* ============================================================
   SAYING IT TO THEIR FACE

   Somebody corners you and asks who you are voting for, and you tell them it is
   them. The probe used to filter the asker out of the list of names entirely, so
   the one answer that takes real nerve was the one answer you could not give.

   It is not a variant of "name a target" — it is a different act, and it has to be
   written like one. On the show this is rare, it is remembered, and it almost never
   goes the way the person saying it expects. Roughly six things can happen, and
   which one you get is temperament, not luck:

     DEFIANT    they welcome it. You have handed them a fight they wanted.
     SCRAMBLE   it lands badly and they start working the beach immediately.
     RESPECT    they would rather be told than blindsided, and they say so.
     WOUNDED    it is personal before it is strategic.
     BLUFF      they claim numbers, or an idol, or both.
     COLD       almost nothing. Filed away. The worst one to read.

   Then some of them try to buy their way out, which is the part worth playing for.

   Placeholders: {me} the player, {tn} a third party's name.
   ============================================================ */
'use strict';

const CONFRONT_LINES = {
  /* How the player opens. Short — this is a thing you say and then stop talking. */
  playerSays: [
    '"It\'s you. I\'m writing your name."',
    '"You. I\'m not going to lie to you about it."',
    '"It\'s you, and you\'d have found out in an hour anyway."',
    '"You asked. It\'s you."',
    '"Honestly? You. That\'s where I am."',
    '"I\'m voting you. I\'d rather say it here than have you hear it there."',
    '"You. I\'m not enjoying it, but you."',
    '"It\'s your name on my parchment."'
  ],

  defiant: [
    '"Good. I was getting bored." They do not break eye contact once.',
    '"Then come and get me. I have been in worse spots than this."',
    '"You know what? Respect. Now watch what I do with the next hour."',
    '"Fine. But you had better have the numbers, because if you do not, that was the stupidest thing you have said out here."',
    '"Great. Now I know exactly who I am playing against." They almost smile.',
    '"Say it again. I want to make sure I heard it." You do. They nod slowly.',
    '"That is the best news I have had all week. I work better angry."',
    '"You just made this a lot simpler for me."'
  ],

  scramble: [
    'They are already looking past you at the shelter. "Right. Right. Okay." And they are gone.',
    '"Wait — wait, hold on." They are talking to themselves more than to you.',
    'The colour goes. "Who else. Who else is on it. Tell me who else." You do not.',
    '"No. No, that is not — " and then they stop and walk off very fast.',
    '"How long has this been the plan?" You can see them counting.',
    'They nod too many times and then leave without saying anything else.',
    '"Okay. Okay. I need to go and talk to some people." They are not hiding it.',
    'You watch them do the arithmetic in real time, and you watch them not like the answer.'
  ],

  respect: [
    '"Thank you. Genuinely. I would rather this than the other thing."',
    '"That took something. Most people out here would have lied to my face."',
    '"Alright." A long pause. "I would still rather know. Thank you."',
    '"Well. That is more than I got from anybody else." They put a hand on your shoulder and go.',
    '"You did not have to say that. I will remember that you did."',
    '"Straight answer. First one in nine days." They shake your hand, which is worse somehow.',
    '"If I go tonight, I go knowing. That matters more than you think."'
  ],

  wounded: [
    '"...After all that?" They are not angry. That is the problem.',
    'They look at you for a long moment. "I actually thought we were alright."',
    '"Okay." Their voice does something on the way out of that word.',
    '"I have been sat next to you every night for a week." They leave it there.',
    'They laugh, once, with nothing behind it. "Sure. Yeah. Of course."',
    '"I would not have done that to you." Maybe true. Maybe not.',
    '"Right." They sit down where they are, and stay there.'
  ],

  bluffBack: [
    '"You should check your numbers before you say things like that."',
    '"That is interesting. Because I count four the other way." They may be lying.',
    '"I would not write my name tonight if I were you." They let that sit.',
    '"Do what you like. I am not going anywhere." They pat their waistband. It could be nothing.',
    '"Then you are going to have a very surprising evening."',
    '"You are about two people short and you do not know it yet."',
    '"Say that at tribal. Say it out loud there and see what happens."'
  ],

  cold: [
    'They take it in, nod once, and walk away without a word.',
    '"Noted." That is the whole reply.',
    'A pause. "Okay." And they go back to what they were doing.',
    'They look at you the way you look at weather. Then they leave.',
    'Nothing. They just watch you until you stop talking, then turn around.',
    '"Mm." You have no idea whether that landed at all.',
    'They file it somewhere behind their eyes and change the subject entirely.'
  ],

  /* Some of them try to buy their way out. This is the interesting half. */
  dealOffer: [
    '"Before you do — what if I gave you {tn}? Tonight. My vote and one more."',
    '"Let me make this worth your while. {tn}. I can deliver {tn}."',
    '"You do not want me gone, you want somebody gone. Take {tn} instead and I am yours for the rest of this."',
    '"One name. Give me one more council and I will hand you {tn}."',
    '"{tn} is the actual problem and you know it. Point at them and I will do the work."',
    '"I will write {tn} tonight and I will tell you exactly who else will."'
  ],
  dealAccepted: [
    '"Then we are good. I will not forget this."',
    'They exhale like somebody who has just been untied. "Alright. Alright. {tn}."',
    '"Done. And you will find I am a very loyal man from about now."',
    '"You will not regret it. {tn} it is."'
  ],
  dealRefused: [
    '"...Then there is nothing else to say." They leave.',
    '"Worth a try." They do not look at you again.',
    '"Fine. But you had better win." And they are gone to work the beach.',
    'They nod, once, and start walking before you have finished.'
  ],

  /* What the rest of the beach makes of it, when word gets round. */
  wordSpreads: [
    '{me} told them to their face. Some of them think that is admirable and some think it is madness.',
    'It is round the camp inside the hour: {me} said it straight out.',
    'Two people heard it. By dark, everybody has.',
    'Nobody out here has said a thing like that in nine days, and everybody knows it now.'
  ]
};
