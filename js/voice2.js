/* ============================================================
   VOICE — tier 2. Merged into VOICE at load, same bands, same resolver.

   These are the charged moments: being held to account for a vote, being let
   off, being threatened, being asked for protection, and being read.
   ============================================================ */
Object.assign(VOICE, {

  /* ---------- "Why my name?" — they tell you who drove it ---------- */
  whyMeTell: {
    cold: [
      'It was {sn}. Not that you deserve to know.',
      '{sn} said it. Half the beach agreed. Sit with that.',
      '{sn} started it and I did not argue.',
      'Ask {sn}. Then ask yourself why it was so easy.',
      '{sn} put it up. Nobody defended you.',
      'It came from {sn}. It could have come from anyone.',
      '{sn}. And honestly, they made a decent case.',
      'You want a name? {sn}. Enjoy.'
    ],
    wary: [
      'It was {sn}. That is all I am saying.',
      '{sn} came to me. I will not pretend otherwise.',
      'Ask {sn}. It was their idea, not mine.',
      'Honestly? {sn} made it sound like the safe play.',
      '{sn} had it planned before dinner.',
      'I heard it from {sn} first. Do what you like with that.',
      '{sn} was doing the rounds. I was one of the rounds.',
      'You did not hear this from me — {sn}.'
    ],
    warm: [
      'It was {sn}, and I hated how easy they made it sound.',
      '{sn} pushed it hard. I should have pushed back harder.',
      'I am telling you because you should know: {sn}.',
      '{sn}. And I want you to know I hesitated.',
      'It was {sn} working the beach all afternoon.',
      '{sn} got to people before I could warn you.',
      'You need to watch {sn}. That is where it came from.',
      'I felt sick writing it. It was {sn} who convinced me.'
    ],
    close: [
      '{sn}. I tried to stop it and I failed you.',
      'It was {sn}, and I have not forgiven myself for going along.',
      '{sn} boxed me in. I should have come to you first.',
      'I will tell you everything: {sn}, before the challenge, one by one.',
      '{sn}. And I am going to make that right.',
      'It was {sn}. Next time I burn my own game before I do that again.',
      '{sn} used my loyalty against me. I am done with them.',
      'You deserve the whole truth. {sn}, and I let it happen.'
    ]
  },

  /* ---------- Being confronted about writing your name ---------- */
  confrontVote: {
    cold: [
      'I did. Next question.',
      'And I would do it again tonight.',
      'You are not owed an explanation.',
      'Yes. Do something about it.',
      'What did you expect, loyalty?',
      'I wrote it. Loudly. Ask anyone.',
      'You are the reason I wrote it, if we are being honest.',
      'Good. Now you know.'
    ],
    wary: [
      'I did. It was the numbers, not you.',
      'Yes. It was not personal, whatever that is worth.',
      'I am not going to lie about it.',
      'It was a hard night and you were the safe name.',
      'I wrote it. I am not proud, I am not sorry.',
      'You were not my first choice. You were the available one.',
      'Yes. And I would rather not do it again.',
      'It happened. Where do we go from here?'
    ],
    warm: [
      'I did. I am not proud of it. It will not happen again.',
      'You are right. I panicked and I picked wrong.',
      'Yeah. I wrote it. I owe you better than that.',
      'I have felt sick about it since. I am with you now.',
      'I let someone talk me into it. That is on me.',
      'I should have come to you first. I know that.',
      'If you can let me fix it, I will fix it.',
      'That was the worst thing I have done out here.'
    ],
    close: [
      'I know. I have been waiting all day to say sorry.',
      'It was the biggest mistake I have made in this game.',
      'I broke something and I know exactly what.',
      'Write mine tonight if it makes it even. I mean that.',
      'I have no defence. Only that it will never happen twice.',
      'You are the last person I should have written.',
      'Tell me what it takes. Whatever it is.',
      'I have been sick about it since the reveal.'
    ]
  },

  /* ---------- Being let off the hook ---------- */
  absolve: {
    cold: [
      'That is very generous. Almost too generous.',
      'Noted. Either you are decent or you cannot afford a fight.',
      'Sure. Water under the bridge.',
      'You are either kind or frightened. I will work out which.',
      'Interesting choice. I will remember it.',
      'If you say so.',
      'That is not how I would have played it.',
      'Careful. People take that as an invitation.'
    ],
    wary: [
      'Alright. That is... unexpected.',
      'You are not going to make me pay for it?',
      'Hm. Fine. Thank you, I suppose.',
      'That buys you something. I am not sure how much.',
      'Most people would have come at me for that.',
      'Alright. Clean slate. For now.',
      'I will take that and not ask why.',
      'You are stranger than I thought. In a good way.'
    ],
    warm: [
      'You are... not going to hold it over me? Alright. Thank you.',
      'I did not expect that. I will not forget it either.',
      'That is more grace than I gave you. Consider me yours.',
      'Most people would have come at me. You did not.',
      'You have no idea what that means out here.',
      'Right. I owe you one, properly.',
      'I was dreading this conversation. You made it easy.',
      'That is the decent thing and nobody here does the decent thing.'
    ],
    close: [
      'You are letting it go? After that? Alright.',
      'I do not deserve you and I know it.',
      'I was ready for you to end us. You did the opposite.',
      'That is why it is you and me. Nobody else does that.',
      'I will spend the rest of this game earning that back.',
      'Do not be that kind to me, I will start crying.',
      'You just made me sure about you all over again.',
      'Whatever happens now, I am your number to the end.'
    ]
  },

  /* ---------- Being put on notice ---------- */
  markVoter: {
    cold: [
      'Good. I hate pretending.',
      'Understood. Then we both know how this ends.',
      'Fine. Come and get me.',
      'You just told the whole beach what you are doing. Bold.',
      'I have been ready for you since day one.',
      'Save the speech. Bring the votes.',
      'That is the most honest thing you have said.',
      'Then it is war and I sleep fine.'
    ],
    wary: [
      'That escalated fast.',
      'You did not have to make it a declaration.',
      'Alright. I will plan accordingly.',
      'You could have just quietly done it.',
      'Well. That is the pretence gone.',
      'Bold, given the numbers.',
      'I will take that seriously. Unfortunately for you.',
      'Understood. I will stop being polite.'
    ],
    warm: [
      'Wait — after everything? Really?',
      'You are throwing us away over one vote?',
      'That hurts more than the threat does.',
      'I thought we were past this. Clearly not.',
      'Fine. But you are making a mistake.',
      'You just lost someone who would have protected you.',
      'I am not going to beg. I am disappointed though.',
      'Alright. Remember you chose this.'
    ],
    close: [
      'You cannot mean that. Not you.',
      'After everything we said to each other?',
      'Then I have nobody out here. Thanks for that.',
      'I would have gone to the end with you.',
      'Do not do this. Please.',
      'You just broke the only thing keeping me sane.',
      'I will not fight you. I will just be gone.',
      'Say it is the game. Tell me it is only the game.'
    ]
  },

  /* ---------- Being asked to protect you ---------- */
  protect: {
    cold: [
      'That is your fire, not mine.',
      'I am not putting a target on my back for you.',
      'Ask me when we are actually something.',
      'You want a shield. Find a different one.',
      'Why would I spend my game on yours?',
      'No. And stop looking at me like that.',
      'You came for help to the wrong tent.',
      'I have my own name to worry about.'
    ],
    wary: [
      'I will keep an eye out. That is not a promise.',
      'Maybe. Depends who is asking me the other way.',
      'I am not committing to a war for you.',
      'I can be near you at the fire. That is all.',
      'Let me see how the day goes.',
      'I will not write your name. That is what I can give.',
      'Do not lean on me too hard, I am not steady yet.',
      'One night. Then we talk properly.'
    ],
    warm: [
      '{n} of them wrote your name. Then {n} of them are my problem now.',
      'You have my word. They come through me first.',
      'I saw the reveal. I am not letting that happen twice.',
      'Stay close to me tonight. I mean it.',
      'Right. Who do we need to turn?',
      'You should have asked me sooner.',
      'I am on it. Go and look calm for the others.',
      'Nobody touches you while I have a vote.'
    ],
    close: [
      'You never needed to ask. Consider it done.',
      'They will have to go through me and I am not moving.',
      'I have been rounding people up since the reveal.',
      'You are not going home. Not while I am here.',
      'I will burn my own game before they take you.',
      'Tell me the names. All of them.',
      'I already started. I was waiting to tell you.',
      'We go together or not at all. You know that.'
    ]
  },

  /* ---------- Observing someone from a distance ---------- */
  observed: {
    cold: [
      'They clock you watching and turn away.',
      'Every conversation stops when you get close.',
      'They move somewhere you are not. Deliberately.',
      'You catch them mid-sentence. It was your name.',
      'They watch you back, and do not blink.',
      'Whatever they were doing, they stop doing it.',
      'They say something quiet and the group laughs.',
      'They are careful. They know you are looking.'
    ],
    wary: [
      'They are working, and keeping half an eye on the camp.',
      'Two conversations, both short, both away from the fire.',
      'They check who is nearby before they speak.',
      'You cannot tell whether that was strategy or small talk.',
      'They are listening more than talking.',
      'They drift between groups without settling in one.',
      'Nothing obvious. That is almost the point.',
      'They notice you noticing, and carry on regardless.'
    ],
    warm: [
      'They wave you over before you have decided to go.',
      'They are telling a story with their whole body.',
      'They have been carrying water nobody asked them to carry.',
      'They save you a spot without making anything of it.',
      'They laugh at something and look round for you.',
      'They are patching the shelter. Again.',
      'They catch your eye and roll theirs at the group.',
      'They look lighter when you are in the camp.'
    ],
    close: [
      'They are watching your back while you watch theirs.',
      'They break off a conversation the moment you appear.',
      'They have been steering people away from your name all morning.',
      'They mouth something at you across the fire. A name.',
      'They are keeping a place for you and telling nobody why.',
      'You realise they have been doing this all week, quietly.',
      'They look over, check you are alright, and go back to it.',
      'Whatever they are building, it has a space in it for you.'
    ]
  }
});
