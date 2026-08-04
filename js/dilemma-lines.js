/* What people say when they bring you a dilemma. Deep enough that the same
   situation never arrives with the same words. */
const DILEMMA_LINES = {
  rumourTrue: [
    '{sn} says you have been pushing {vn}’s name. Tell me that is not true.',
    'I am going to ask you once. Did you put {vn} up? Because {sn} says you did.',
    '{sn} told me what you have been doing about {vn}. I want to hear it from you.',
    'Somebody has been working {vn}’s name round this camp and {sn} says it was you.',
    'I defended you this morning. Then {sn} told me about {vn} and now I am not sure.',
    '{sn} was very specific. {vn}. Your idea. Was it?',
    'I do not care that you are playing. I care that it was {vn} and you did not tell me.',
    'Look me in the eye and tell me {sn} is lying about {vn}.'
  ],
  rumourFalse: [
    '{sn} says you are coming for me. Are you?',
    '{sn} told me you have my name written down already.',
    'I have been hearing my own name in your mouth. {sn} says so, anyway.',
    '{sn} says you have been building something that does not include me.',
    'Tell me why {sn} would say you are done with me.',
    '{sn} came to me about you. I would rather hear your version first.',
    'Apparently I am your next vote. That is what I am being told.',
    'I want to believe {sn} is making it up. Help me.'
  ],
  betrayalClaim: [
    'I saw {an}’s vote. You are not going to like it.',
    'You trust {an}. I would not.',
    '{an} has been talking about you the way people talk before a blindside.',
    'Ask yourself why {an} is so relaxed lately.',
    'I am not doing this to be kind. {an} wrote your name.',
    '{an} is not your ally. I can prove it if you want.',
    'You are the only person here who thinks {an} is loyal.',
    'I will tell you what {an} said, but you owe me after.'
  ],
  loyaltyTest: [
    'I need to know you are real. Write {mn} tonight. Then we are solid.',
    'Everybody says the words. Give me {mn} and I will believe you.',
    'One name. {mn}. That is the whole price.',
    'I am tired of guessing about you. Prove it with {mn}.',
    'You want me in your corner? {mn} goes home first.',
    'I have carried you long enough. Give me {mn}.',
    'This is the part where you pick. {mn}, or we are just talking.',
    'No more meetings. {mn}, tonight, or I move on.'
  ],
  twoPleas: [
    'Do not let them take me. {on} is going to ask you the same thing — say no to them.',
    'I got here first. That has to count for something.',
    'You and me, tonight. Do not give {on} the same promise.',
    'I am scared. I am not going to pretend otherwise.',
    'Whatever {on} offers you, I will do better.',
    'I have never asked you for anything. I am asking now.',
    'Please. Just tell me my name is not on your list.',
    'If I go tonight it is because you let it happen.'
  ],
  confession: [
    'I lied to you. Earlier. About the vote. I have felt sick about it since.',
    'I need to tell you something before somebody else does.',
    'I was not straight with you and it has been eating me.',
    'You have been decent to me and I repaid it badly.',
    'I told you a name that was not the name. I am sorry.',
    'I want to start again with you, properly this time.',
    'You are going to find this out anyway. Better from me.',
    'I am not a good liar and I have been trying to be one at you.'
  ],
  overheardYou: [
    '— they were saying your name. Both of them. That much you are sure of.',
    '— one of them said "before they see it coming". Then silence.',
    '— you heard a number. Four. And your name in the same breath.',
    '— whatever it was, it stopped the instant you appeared.',
    '— they were counting people on their fingers. You were one of them.',
    '— "tonight" was the only word you caught clearly.',
    '— they looked at each other before they looked at you.',
    '— you have interrupted something and everybody knows it.'
  ],
  overheardOther: [
    '— they were putting {tn}’s name together. Quietly, and in detail.',
    '— {tn} is being set up and neither of them expected an audience.',
    '— you catch "{tn}" and "she will never see it". Then nothing.',
    '— they have a plan for {tn} and it is further along than you thought.',
    '— {tn} has no idea. That much is obvious.',
    '— two of them, one name: {tn}.',
    '— whatever happens to {tn} tonight, it was decided right here.',
    '— they were rehearsing how to tell {tn} it was not them.'
  ]
};
