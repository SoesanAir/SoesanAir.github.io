/* ============================================================
   CASTAWAY — data.js
   Config + content, ported 1:1 from the Unity GameConfig and
   ChallengeLibrary (values are the authoritative config values).
   ============================================================ */

'use strict';

const CONFIG = {
  // Day cycle
  hoursPerDay: 12,
  totalDays: 26,
  tribalDays: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26],
  /* ---- the endgame ----
     Eighteen castaways minus thirteen scheduled councils leaves FIVE alive when
     day 26 ends, and the finale used to trim that to two with bare back-to-back
     votes: no morning, no immunity challenge, no hours to work anybody. Which is
     the least interesting possible version of the most important part of a season.

     Below this many alive it is a council EVERY day — but a real day, with a
     morning, an individual immunity challenge and a full set of hours first. The
     season now ends when the finalists are decided rather than on a date, so
     totalDays is where the schedule stops and the endgame starts. */
  endgameDailyTribalFrom: 6,
  /* A backstop so a stalled endgame cannot run forever. */
  endgameHardCapDays: 14,
  swapAfterDay: 8,
  mergeAfterDay: 14,

  // Action time costs (hours)
  talkTimeCost: 2,
  observeTimeCost: 1,
  wanderTimeCost: 0.5,
  chatMessageTimeCost: 0.5,
  joinFunTimeCost: 0.25,
  challengeTimeCost: 4,           // hoursPerDay / 3
  day1ArrivalHold: 2,

  // Topic time costs
  tribalTopicCost: 1,
  personalLifeTopicCost: 0.5,
  foodTopicCost: 0.25,
  funTopicCost: 0.25,
  gameTopicCost: 0.75,
  playersTopicCost: 1,

  // Challenge
  immunityRandomWeight: 0.2,       // uniform score variance [0, 0.2)
  challengeWeightPhysical: 3.0,
  challengeWeightPuzzle: 0.3,
  challengeWeightEndurance: 1.5,
  challengeWeightDexterity: 1.5,
  challengeWeightStrategy: 1.0,
  challengeWeightHybrid: 2.0,
  challengePuzzleMaxPerSeason: 1,

  // Relationships
  relationshipInitMin: 0.1,
  relationshipInitMax: 0.25,
  sameTribeBonus: 0.15,
  similarityBonus: 0.05,

  /* ---- The circle, as a thing you can actually operate ----
     A meeting buys a firm agreed name; the price is being seen to meet, and the
     risk is that somebody in the room is not as solid as they sound. */
  circlePlanVoteWeight: 1.6,       // an agreed name, per member, scaled by firmness
  circlePlanStaleDays: 2,          // after which the plan is yesterday's news
  circleMeetingVisibility: 0.34,   // three meetings and the tribe has clocked you
  circleNoticedAbove: 0.30,        // below this nobody has joined the dots
  circleVisibleVoteWeight: 0.55,   // what an obvious bloc costs each member
  circleLeakBelow: 0.46,           // loyalty under this and they might tell
  circleLeakVoteWeight: 1.3,       // what the target does with that information
  circleHeldTrust: 0.05,           // voting the plan together
  circleBrokeTrust: 0.14,          // and going rogue
  /* How much each previous answer in the room sways the next one. This is what
     makes speaking order matter: your most loyal ally answers first, and their
     yes is worth more than their vote alone. */
  circleCascade: 0.16,
  circleMeetingHours: 1.0,
  circleReadsHours: 0.5,
  circleShoreWeak: 0.055,          // reassurance, to the one who needed it
  circleShoreOther: 0.022,         // and to everyone else
  /* How much the fracture bar relaxes per member beyond two. A big alliance on
     the show is held together by shared interest, not affection, and contains
     people who cannot stand each other — so it is allowed to, and pays for it in
     permanent strain instead. */
  circleSizeTolerance: 0.035,
  /* Splitting the vote. A split needs a real majority to be safe, so the pact
     will refuse one it cannot cover — which is the arithmetic lesson the mechanic
     is there to teach. */
  circleSplitMinMembers: 4,

  /* ---- NPC voting blocs ----
     The pact, for everybody else. Without these the player is the only person on
     the island capable of organising more than two people, which is backwards:
     most of a season is spent trying to work out whose alliance is running things.
     Rates are set so a season produces two or three blocs rather than the whole
     tribe pairing off in week one. */
  blocFormMinDay: 4,
  blocFormChance: 0.22,            // one attempt a day, and it usually fails
  blocFormAbove: 0.52,             // mutual warmth needed to start a triangle
  blocJoinAbove: 0.48,             // and to be let in later
  blocGrowChance: 0.30,
  blocBreakBelow: 0.30,            // two days under this and it is over
  blocMax: 5,
  blocShield: 0.45,                // members steer away from each other
  blocConverge: 0.40,              // and drift onto a shared name
  /* How readily a castaway invents a grouping that is not there. Scaled by how
     unobservant they are, so bad reads come from the people whose reads are bad —
     and they are phrased with exactly the same confidence as good ones, because a
     hedged wrong answer costs the player nothing to ignore. */
  blocWrongBase: 0.26,

  /* Circle (multi-way alliance) admission.
     NPC-to-NPC warmth starts around 0.19-0.33, so the old 0.40 mutual-trust
     gate was effectively unreachable — and nothing the player could do moved
     NPC-to-NPC trust at all. Vouching now does (see doDefend), and the bar sits
     just above the starting band so one or two vouches can clear it. */
  circleWarmthNeeded: 0.34,
  /* Below the admission bar, so a circle you just formed cannot instantly
     fracture; and it takes two consecutive strained days to actually break. */
  circleFractureBelow: 0.26,
  circleTrustInPlayerNeeded: 0.45,
  /* "That vote worked" — celebrating a landed blindside with a partner. */
  /* "I heard your name come up" — warning someone they are being targeted. */
  warnNameVoteWeightTrue: 0.9,     // real intel turns them hard on the accused
  warnNameVoteWeightBluff: 0.6,
  warnNameTrustGain: 0.10,         // real information is the best currency there is

  /* Owning up to your own ballot. */
  shareVoteAlignedTrust: 0.11,     // you both wrote the same name and you said so
  shareVoteHonestTrust: 0.06,

  /* Responding when your own name was read out at tribal. */
  absolveTrustGain: 0.13,          // mercy is the strongest single trust play
  absolveRelGain: 0.08,
  absolveVoteWeightRelief: 0.7,
  protectVoteWeightShift: 0.7,     // your ally turns on whoever came for you

  /* Marooning first impressions: small, but they set the opening board. */
  /* Dilemmas — the inbound half of the loop. Frequent enough that the island
     feels alive, capped so it never becomes the whole game. */
  /* How much the minigame result can swing the player's challenge score on top
     of the existing random weight. Big enough to matter, small enough that stats
     still decide the band. */
  /* How far a flawless minigame can move you inside the field's spread. Measured
     with tools/chal-sweep.js: at 0.55 a flawless round won 100% of individual
     immunities and field size made no difference at all.

     Measured at 0.31 with npcFormSwing 0.54 (tools/chal-probe.js, 500 rounds):

       stats   perf.25  perf.50  perf.75  FLAWLESS
       0.3       1%       2%      13%      41%   <- average castaway
       0.7       5%      19%      52%      88%
       field of 4 82% ... field of 8 41% ... field of 10 31%

     So playing well is worth about twenty times playing badly, you still lose
     three in five when you nail it, a weak castaway who plays perfectly rarely
     wins, and the final four is genuinely easier than a full field.

     REVISITED after "there is an immediate winner ruling the challenge completely"
     (tools/chal-fair.js). The complaint turned out not to be about the NPCs — the
     winner's identity already varied correctly, 5.8 different winners across 8
     challenges. It was that the PLAYER had no lever at all: an average castaway
     playing FLAWLESSLY won 11% of an 11-strong field, against 9% for random. Two
     causes, both fixed in Challenges.score:
       - the player got no form roll while every NPC got +/-0.51, so the player was
         a fixed number trying to clear the maximum of ten dice (see playerFormSwing)
       - the dice were bigger than the whole stat spread, so nothing legible decided
         anything (see chalAptitudeSpan, npcFormSwing)
     Value below re-derived with tools/chal-span-sweep.js after those landed. */
  challengeSkillSpan: 0.31,
  /* The player has good days and bad days like everyone else. Without this the
     win curve is a step function — see the long note in Challenges.score. */
  playerFormSwing: 0.30,
  /* How specialised castaways are by challenge FORMAT (Physical, Puzzle,
     Dexterity, Endurance, Strategy, Hybrid). Mean-zero per castaway, so this
     decides who wins today without making anyone better overall. This is the
     legible replacement for raw form dice: the same person is good at puzzles
     every week, and you can learn that. See Aptitude in sim.js. */
  chalAptitudeSpan: 0.22,
  /* ---- minigame difficulty ----
     One lever for all twenty games, routed through ctx.tol/rate/span/more in
     chal-shell.js. The player was winning every individual immunity, and half the
     cause was that perfect minigame scores were routine — so "how well did you
     play" carried no information at all.
     1.0 is the original difficulty. Set by measurement in tools/chal-sweep.js. */
  /* 1.7 rather than higher because I cannot hand-play twenty minigames to check
     they are still winnable, and the telemetry now measures it: the report flags
     MINIGAMES TOO HARD below a mean score of 0.15 and TOO EASY above 0.6 flawless
     rounds. Retune from a real playthrough rather than from this guess.

     THE PLAYTHROUGH CAME BACK: "most challenges are way too hard, even the tap the
     box is way too fast". So the guess was wrong, and it is now reverted to 1.0 —
     the original hand-tuned difficulty, before it was raised.

     The reason it was raised no longer exists. 1.7 was compensating for a scoring
     bug: a flawless minigame used to win 100% of individual immunities because the
     player's bonus averaged nearly four times an NPC's form roll. Squeezing the
     minigames was treating the symptom at the cost of the one part of the game the
     player actually plays. That has since been fixed properly in Challenges.score
     (see challengeSkillSpan and playerFormSwing): a flawless round now wins 44%,
     measured over 200 seasons in tools/chal-fair.js, and it holds regardless of how
     forgiving the minigames are. Difficulty is free to be about feel again. */
  chalDifficulty: 1.0,
  /* How QUICK the games are, independent of how tight. Above 1 is slower: timers
     run longer, things drift and decay more gently. Split out from chalDifficulty
     because that lever divided durations as well as tolerances, so the difficulty
     pass silently made every game 41% shorter — which is the half of the complaint
     that a tolerance change would not have fixed.
     1.0 is the original pace; 1.35 makes everything about a third longer again. */
  chalPace: 1.35,
  /* How much a good stat buys you in kindness. Was effectively 1.0, which let a
     strong castaway roughly double a tolerance window; that made the stat the
     whole game and the playing incidental. */
  chalEaseWeight: 0.62,
  /* Reaction-tap games get their window widened by this on top of everything
     else. The general difficulty pass made every game 1.7x harder, which is right
     for the ones you think your way through and too much for the ones that are
     pure thumb speed — those went from brisk to unplayable. Applies to Island
     Sprint and Night Watch, the two games whose whole verb is "tap it before it
     goes". Raise it if they are still too quick.

     They were still too quick — "even the tap the box is way too fast" names this
     one specifically. Raised to 1.55, on top of reverting chalDifficulty to 1.0 and
     the new chalPace of 1.35, so the box now sits there roughly three times as long
     as it did when that report was written. */
  chalTapEase: 1.55,

  /* ---- tribal council conversation ----
     How often Peff follows up on an answer instead of moving on. Kept well under
     half on purpose: a council where he pushes on everything is exhausting to tap
     through, and the pushes land far harder when they are the exception. A push
     also pulls in a second castaway, so this is really "how often does a topic
     become an argument". */
  tribalPushChance: 0.34,
  /* Multiplier on what the player's chosen answer costs or buys. The individual
     effects in TribalQA.playerAnswered are deliberately small — this is a
     conversation, not a challenge, and it should colour how people see you rather
     than decide the season. Raise it if answering stops feeling like it matters. */
  tribalAnswerWeight: 1.0,

  dilemmaChance: 0.30,
  dilemmasPerDayMax: 2,
  dilemmaFirstDay: 2,             // let the player find their feet first
  shockTrustDelta: 0.12,          // a swing this big gets reported to the player

  maroonStingChance: 0.55,        // he stays quiet the rest of the time
  maroonRelSwing: 0.07,
  maroonTrustSwing: 0.05,

  celebrateTimeCost: 0.5,
  celebrateTrustGain: 0.09,        // biggest single trust gain outside a shared secret
  celebrateRelGain: 0.07,
  celebrateVoteWeightRelief: 0.6,  // they stop looking at you as a target
  celebrateBondSourGate: 0.55,     // above this bond with the target, gloating offends
  celebrateSpottedChance: 0.22,    // a sharp observer pairs you up

  vouchTrustGain: 0.05,          // listener -> the person you vouched for
  vouchRelGain: 0.04,
  badmouthTrustLoss: 0.04,       // listener -> someone you pushed a vote onto
  conversationRelBase: 0.02,
  conversationTrustBase: 0.01,
  trustToRelDriftRate: 0.003,
  trustToRelDriftCap: 0.1,
  trustToRelDriftMinDays: 3,

  // Talk-about actions
  talkAboutPlantSeedVoteWeight: 0.5,
  talkAboutPushVoteWeight: 1.5,
  talkAboutTrashTalkVoteWeight: 2,
  talkAboutDefendVoteWeight: -1,
  talkAboutRumorVoteWeight: 2.5,
  talkAboutRumorCaughtTrustHit: -0.2,
  talkAboutBondRelGain: 0.04,
  talkAboutWarnTrustHit: 0.12,

  // NPC social
  npcInteractionBudget: 12,
  npcApproachChance: 0.03,
  ignoreApproachPenalty: 0.04,
  joinFunRelationshipBoost: 0.04,
  joinFunTrustBoost: 0.02,

  // Spend time together
  sttMaxTicks: 3,
  sttTickHours: 1,
  sttBaseRelPerTick: 0.018,
  sttBaseTrustPerTick: 0.008,
  sttSeenTogetherChance: 0.15,
  sttOverhearChance: 0.10,
  sttQuietMomentChance: 0.08,
  sttCrisisChance: 0.05,
  sttAwkwardSilenceChance: 0.03,

  // Vote weights
  voteWeightBaseFromStats: 1.0,
  voteWeightPlayerNudge: 1.5,
  voteWeightNpcSuggestion: 1.0,
  voteWeightNpcSuggestChance: 0.4,
  voteWeightChallengeFailPreMerge: 0.8,
  voteWeightChallengeStrongPostMerge: 0.6,
  voteWeightDecayRate: 0.05,
  lastMinuteScrambleChance: 0.15,
  lastMinuteScrambleMagnitude: 1.2,
  unanimityThreshold: 0.6,
  preMergeThreatWeight: 1.4,
  postMergeThreatWeight: 3.0,
  voteErraticChance: 0.25,
  irrationalVoteChance: 0.08,

  // Grudges
  grudgeWeight: 0.6,
  grudgeDecayRate: 0.08,
  grudgeRepeatSpike: 0.4,

  // Behavior fuzziness
  behaviorRuleProbability: 0.75,
  behaviorRuleStressedProbability: 0.45,
  desperationOverrideChance: 0.2,
  performativeDetectionChance: 0.3,
  performativeDetectionTrustHit: 0.15,
  secretAllianceTellChance: 0.25,

  // Vote talk
  npcVoteTalkEnabled: true,
  npcVoteTalkChanceBase: 0.18,
  npcVoteTalkLieDetectBase: 0.30,

  // NPC alliances
  alliancePairFormMinDays: 3,
  alliancePairBreakTrustThreshold: 0.4,
  allianceCoordinationBoost: 0.5,
  allianceDefenseMagnitude: 0.4,
  allianceBetrayalTrustHit: 0.10,

  // Survival
  /* ---- Hunger and fatigue, shaped like a real Survivor season ----

     The old model was a straight ramp: +0.09 hunger a day to a hard ceiling, and
     up to 0.56 subtracted from a challenge score for being hungry and tired. Two
     things were wrong with that, and they are the same thing twice.

     On the show, EVERYONE is hungry, for thirty-nine days, and it is not what
     decides challenges. People lose a lot of weight in the first week, the body
     settles into it, and then they spend a month permanently, unremarkably
     starving — and still run the obstacle course. They nap constantly. They have
     bad nights all the time. None of that is a death spiral; it is the weather.
     The person who genuinely cannot continue is rare, and when it happens it is
     obvious and it is a medical evacuation, not a bad challenge score.

     So the model is now a PLATEAU plus a TAIL:

       PLATEAU  hunger and fatigue climb toward a high, uncomfortable resting
                level and then largely stop. That level is the normal condition of
                everybody on the island, all season.
       TAIL     the challenge penalty is zero across that normal band and rises
                quadratically only past it. Being hungry costs you nothing,
                because everyone is. Actually breaking down costs you a lot.

     The result: hunger and fatigue are constant background texture that colour
     dialogue, morale and camp behaviour, instead of a hidden stat tax that
     quietly decided who won immunity. */
  /* These are the CAP on how far each can move in a day, not a flat addition —
     driftToward takes the smaller of this and a proportional step. */
  hungerPerDay: 0.055,
  /* Fatigue's cap has to be bigger than a night's recovery or fatigue simply
     cannot accumulate: measured at 0.045 against a nightly 0.11, the whole cast
     sat at 0.03 fatigue for twenty-four days. A day out there costs more than a
     night gives back, and the gap between them is where "everyone is knackered"
     comes from. */
  fatiguePerDay: 0.16,
  /* Where each settles with no intervention. Past this the climb drops to a
     quarter speed — a genuinely failing camp still starves you, it just takes
     weeks rather than a fortnight. */
  hungerPlateau: 0.72,
  fatiguePlateau: 0.70,
  /* Below this you are the normal kind of hungry and it costs you NOTHING at a
     challenge. Above it the cost climbs as the square of how far past you are. */
  hungerPainFree: 0.58,
  fatiguePainFree: 0.60,
  /* The normal island condition, for morale. Being hungry is always miserable,
     so it never reads as zero — but the misery is mostly flat, with the sharp
     part reserved for people who are actually in trouble. */
  hungerNormal: 0.55,
  fatigueNormal: 0.58,
  napFatigueRecovery: 0.20,
  /* They nap constantly out there and it is not a big strategic sacrifice. */
  napHours: 1.5,                  // daylight you do not get back
  eatHours: 0.5,
  moraleDrift: 0.34,              // morale is a mood, it drifts toward its target
  /* Chore reward is proportional to effort, so no single job is the efficient
     pick, and it decays hard within a day so chores cannot replace talking as a
     way to build relationships. */
  choreEffortRel: 0.013,          // per unit of effort, for everyone
  choreEffortRelAdmire: 0.042,    // per unit of effort, for those who value it
  choreDayDecay: 0.7,             // each further chore today is worth much less
  napFatigueScale: 0.45,          // a nap does more when you are truly wrecked
  npcChoreChance: 0.30,           // superseded by WORK_ETHIC in camp.js
  npcChoreChanceGrafter: 0.70,    // superseded by WORK_ETHIC in camp.js
  fireSkillGain: 0.055,           // per fire made, with diminishing returns
  fireChallengeWeight: 0.55,      // how much fire skill decides a fire challenge
  /* The size of the TAIL, not of a linear tax. These are what you pay at hunger
     or fatigue of 1.0 — flat out, in medical-evacuation territory. At the normal
     plateau (0.72 / 0.70) the actual cost is about 0.014 and 0.005, which is to
     say nothing, which is correct. */
  hungerChallengePenalty: 0.13,
  fatigueChallengePenalty: 0.12,
  /* Your head matters as much as your legs — and this is the counter-force that
     stops "never do a chore, stay fresh, win immunity" being the optimal play.
     Shirking makes the tribe cold on you, that tanks morale, and morale is worth
     as much out there as the rest you saved. */
  moraleChallengeBonus: 0.22,
  playerTribalWeight: 1.7,
  /* Every castaway has a form on the day. Wide enough that a tribe average is
     never a foregone conclusion and the player can be the worst performer, but
     narrower for the genuinely able, so ability still tells over a season. */
  /* Widened so the field has real spread: somebody in a group of eight is having
     a great day, and that person can beat a flawless player.

     Then narrowed again from 0.54, because +/-0.54 was about two and a half times
     the entire spread of the field's stats — challenges were a lottery wearing a
     stats costume, and no result was explicable after the fact. The variety that
     roll was buying is now bought by chalAptitudeSpan instead, which produces the
     same "different winner most weeks" without the anonymity: it is the same person
     who is good at puzzles every week, and the player can learn that.

     Chosen on the joint grid in tools/chal-grid.js (200 seasons x 8 rounds), which
     scores field fairness and the player's skill gradient together because the two
     levers do not separate:

       swing  span   distinct  topShare  gapFrac   flawless  good   bad
       0.54   0.31     5.58      31%       12%        24%     8%    0%   <- was here
       0.42   0.40     5.46      31%       13%        48%    19%    0%
       0.32   0.31     5.50      32%       14%        44%    23%    2%   <- chosen
       0.18   0.31     5.08      36%       15%        55%    31%    3%

     Below about 0.24 the field starts to calcify — distinct winners fall and the
     top castaway's share climbs, which is the very thing being fixed. 0.32 keeps
     5.5 different winners per season while making a good minigame worth playing. */
  npcFormSwing: 0.32,        // you pull more than your share, never all of it

  /* A night on a bamboo floor under a leaking roof is not eight hours in a bed.
     These were 0.35 and 0.50, which is MORE than a whole day of accumulation —
     so fatigue was fully cleared every night and the entire tired-castaway layer
     did nothing. Lower than the daily climb plus a day's work, so the people
     doing the work are the tired ones, which is both true and interesting. */
  normalSleepFatigueRecovery: 0.16,
  earlySleepFatigueRecovery: 0.24,

  /* ---- Camp labour economy ----
     The five standing needs, who works on them, and what the tribe makes of it.

     The two most important numbers here are campSeverityPush and
     campFatigueDrag, and the important thing is their RATIO. Mapping this system
     before building it turned up a death spiral: camp decays -> bad night ->
     everyone tired -> nobody works -> camp decays worse, ending seasons by
     medivac instead of by voting. The push is deliberately larger than the drag,
     so a desperate camp always pulls MORE work out of people than exhaustion
     takes away, and the spiral cannot close. Do not invert these. */
  campSeverityPush: 0.50,          // how much a failing camp drags people to their feet
  /* And how much being wrecked keeps them sitting. Applied to fatigue ABOVE
     fatigueNormal, so the coefficient is larger than it looks: the worst case is
     (1.0 - 0.58) * 0.60 = 0.25, still comfortably under campSeverityPush, which
     is what keeps the death spiral from closing. Do not raise this past 0.50. */
  campFatigueDrag: 0.60,
  campMoraleSwing: 0.30,
  campCallOutDrive: 0.55,          // how far a call-out moves someone who respects you
  campCallOutRel: 0.030,           // speaking up, when you have earned it
  campHypocriteRel: 0.030,         // ...and when you have not
  campRelDriftPerDay: 0.012,       // daily opinion drift from the contribution gap
  campRelDriftCap: 0.22,           // total, per pair — never the whole relationship
  campVoteWeightMax: 0.90,         // slacking as a vote reason (a push is 1.5)
  campResumeThreat: 0.70,          // post-merge, a work resume makes you a threat
  campBlameVoteWeight: 0.45,       // the morning after a night somebody caused
  campGossipChance: 0.30,
  campGossipVoteWeight: 0.22,
  campStateLineChance: 0.62,       // how often hunger/exhaustion colours a line
  /* Telling somebody you are falling apart is information. To an ally it buys
     help; to somebody cold on you it is a reason to write your name. */
  campWeaknessVoteWeight: 0.28,
  /* How far a full basket pulls the resting hunger level DOWN from the island
     baseline. Plateau 0.72 minus this is where a well-stocked tribe settles:
     about 0.44 — hungry, coping, permanently thinking about food. An empty store
     leaves them at the full 0.72. This is what makes foraging matter to people
     other than you, and it is deliberately not enough to reach zero, because
     nobody on that island is ever not hungry. */
  hungerFedRelief: 0.28,
  /* Short of water reads as hunger. A small push, because thirst mostly shows up
     as a morale and a camp problem rather than as an appetite. */
  thirstHungerPush: 0.14,
  /* Eating is closer to a threshold than a dial: anything from a reasonably
     stocked basket upward feeds the tribe properly, and below it people start
     actually going hungry. A linear relief made a half-empty basket quietly
     starve everyone over a fortnight, which read as nothing at all. */
  foodStoreFull: 0.45,
  /* THE camp balance lever. Multiplies every need's daily drain, so the whole
     economy can be tightened or loosened with one number instead of five.
     Set by measurement (tools/camp-test.js): the target is that a tribe left to
     itself holds the camp around 0.40-0.55 — good enough to live in, close
     enough to the line that a storm or a lazy tribe tips it over. Raise this and
     camp becomes a second job; lower it and the whole layer stops mattering. */
  /* 1.7 measured (tools/camp-sweep.js, 20 seasons x re-rolled tribe compositions):
     a tribe left to itself holds the camp around 0.28, roughly 5 rough nights and
     5 good ones a season, and about half a medivac. A player doing two jobs a day
     lifts it to 0.41 and halves the rough nights. Both ends of that are the point:
     the camp is worth attending to, and ignoring it is survivable. */
  campDrainScale: 1.7,
  /* Sitting over the fire happens ON TOP OF the work rota, not instead of it —
     otherwise every hour spent keeping the hidden fire skill contested is an hour
     stolen from the needs board, and the camp starves so the final four can be
     interesting. Kept low: it burns wood and earns only partial credit. */
  campFireTendChance: 0.20,
  /* A season-long ceiling on how much bond camp work alone can buy you from any
     one person. Within-day decay already stops chore-spamming inside a day, but
     over twenty-four days an uncapped trickle still maxed everybody out and
     chores quietly became a better relationship engine than talking. */
  choreRelSeasonCap: 0.30,
  /* A bad camp is a bad night's sleep. Recovery scales with shelter, fire and
     cleanliness, so neglect wears the tribe down instead of killing it. */
  campSleepComfortFloor: 0.55,

  /* ---- Hidden immunity idols ----
     Rare by design. A camp job that takes you out of camp on your own is the only
     way one turns up, and any single search is a long shot.

     Sizing: a tribe does on the order of 30-40 qualifying jobs a day across
     nine people, over roughly 24 days, so a flat 0.0012 gives about one idol per
     season before the dry-day ramp. The ramp then makes one or two per season
     reliable without ever making a given search anything but unlikely — which is
     also how the real show works, since production ensures they get found. */
  idolFindChance: 0.0012,
  idolPlayerEdge: 2.2,             // the player is the one actually looking
  idolMaxPerSeason: 2,
  idolDryRamp: 0.16,               // per day with nobody holding one
  idolDryCap: 14,                  // and it stops climbing eventually
  /* The decision to play. All four are weights on a probability, and their sum at
     maximum deliberately exceeds 1 so a genuinely cornered paranoid castaway is
     near-certain to move — while a calm one on a quiet night mostly will not. */
  idolHeatWeight: 0.62,            // what they think the tribe thinks of them
  idolNervesWeight: 0.30,          // temperament: who panics and who sits on it
  idolSqueezeWeight: 0.26,         // everybody is twitchier at six than at twelve
  idolSqueezeFrom: 10,             // tribe size at which the squeeze starts
  idolWarnedPush: 0.34,            // somebody told them to their face today
  /* Playing one is a statement: everybody now knows this person found a card and
     sat on it, and that reads as a threat for the rest of the season. */
  idolPlayedThreat: 0.55,

  /* ---- Telling somebody it is them ----
     Deliberately expensive. The upside is information, a possible deal, and a jury
     that remembers you told them straight; the cost is that the person now knows,
     which is the single most valuable thing you can hand anybody out there.
     A normal push is 1.5, so this is heavier than anything you could do behind
     their back — as it should be. */
  confrontVoteWeight: 1.9,
  confrontAllyVoteWeight: 0.75,     // their closest friend hears about it
  confrontDefiantExtra: 0.5,        // the ones who take it as a declaration of war
  confrontRespectTrust: 0.10,       // and the ones who would rather be told
  confrontWoundedRel: 0.14,
  confrontDealChance: 0.62,         // how often a cornered castaway tries to buy out
  confrontDealWeight: 1.7,          // and how hard they swing at the name they offered
  confrontDealTrust: 0.08,
  confrontRefusedExtra: 0.6,        // turning down a plea is remembered

  /* ---- Whispering at tribal ----
     Rare and electric. Once or twice a season is the target, and only when
     somebody at the council genuinely does not know how it is going to go — a
     bench that is sure of itself sits quietly, which is most nights. */
  whisperSeasonTarget: 2,          // roughly how many councils per season get one
  whisperMinDay: 5,                // never in the first days, nobody knows anybody
  whisperUnsureBar: 0.34,          // how muddled an NPC's read has to be
  whisperPlayerMax: 2,             // how many whispers the player gets per council
  whisperCascadeBase: 0.62,        // chance the first whisper spreads at all
  whisperCascadeDecay: 0.72,       // and it gets less likely each further round
  whisperCascadeMax: 5,            // hard stop, so it always dies out
  whisperFlipWeight: 0.85,         // what a successful whisper does to a vote
  whisperOverhearChance: 0.55,     // odds the player catches an NPC-to-NPC one

  // Elimination reactions
  reactionMoraleLossBase: 0.1,
  reactionTrustDecayBase: 0.03,
  reactionSuspicionPenalty: 0.04,
  immunityWinMoraleBoost: 0.05,
  immunityWinRelBoost: 0.02,
  immunityWinTrustBoost: 0.01,
  survivalParanoiaTrustHit: 0.08,

  /* ---- Evacuations and quits ----
     Calibrated against US Survivor seasons 1-50: 21 medical evacuations across
     14 of them, so 28% of seasons see at least one, 10% see two, and exactly one
     season on record (Kaoh Rong) saw three. Mean 0.42 a season.

     These are the authoritative numbers — the season count is rolled from
     EVAC_SEASON_ODDS in sim.js and everything else follows from it, rather than
     the old per-castaway daily dice whose season-level rate nobody could predict.
     If you want evacuations more or less common, change the odds table, not
     these. */
  evacSeasonChance: 0.28,           // reference only: documented, tests read it, sim does not          // P(at least one), for reference and tests
  evacMeanPerSeason: 0.42,          // reference only: the real show's mean, for comparison
  evacEarlyShare: 0.29,            // share that happen day 1-3, at the challenge
  evacConditionShare: 0.57,        // share traceable to hunger/exhaustion/infection
  /* How bad someone has to actually be for a condition-linked evacuation to have
     anybody to happen to. Below this the scheduled event waits, and a camp kept
     in decent order runs the season out without it. */
  /* How bad somebody has to be for a condition evacuation to find a victim at all.
     Scored on distance PAST the normal island condition (see Exits.conditionVictim),
     so this is not comparable to the pre-plateau value of 0.42, which was measured
     against absolute hunger and fatigue and stopped discriminating entirely once
     hunger settled at a plateau.

     Swept (500 seasons per cell, camp quality 0.42 / 0.88 / 0.06):

       bar    mean   well-kept  rotten   gap    condition share
       0.18   0.36     0.258     0.386   0.128       29%
       0.22   0.298    0.256     0.384   0.128       14%
       0.26   0.27     0.256     0.370   0.114        5%
       0.30   0.256    0.256     0.346   0.090        0%
       0.38   0.256    0.256     0.294   0.038        0%
                                          (real show: mean 0.42, condition 57%)

     0.18 wins on both axes at once — closest to the real seasonal mean AND the
     widest gap between a camp kept well and one left to rot. Note the well-kept
     column barely moves: a tidy camp essentially never supplies a condition
     victim at any setting, so the scheduled evacuation waits, runs out of season
     and never happens. That is the mechanism by which keeping camp saves people. */
  evacConditionBar: 0.18,
  quitMoraleBar: 0.38,

  // Weather
  weatherSunnyChance: 0.55,
  weatherRainyChance: 0.18,
  weatherStormyChance: 0.12,
  weatherHotChance: 0.15,           // reference only: Hot is the remainder after the other three
  /* Weather at a challenge: extra form swing for the whole field, not a penalty.

     It was a penalty first, and that was a no-op — subtracting the same number from
     everybody cannot change a result that is decided by comparing them. What bad
     weather really does is make the day sloppy and upsets likely, so it widens
     everyone's band instead. A storm is a leveller, which is also the version the
     player can actually see happen: the favourite comes unstuck in the rain.

     Storm is worth about two thirds of the base npcFormSwing on top, so a storm day
     is a genuine lottery without being pure noise. */
  weatherStormChalChaos: 0.22,
  weatherRainChalChaos: 0.08,
  weatherHotChalChaos: 0.10,
  /* A reward is a day out and the show really does move those. Even so, only
     sometimes — a storm used to cancel everything scheduled, every time. */
  weatherRewardSkipChance: 0.45,

  weatherStormyHungerMult: 1.4,
  weatherHotHungerMult: 1.3,
  weatherRainyMoralePenalty: -0.03,

  // Stat generation
  statTotalMax: 4.2,
  statTotalMin: 2.1,
  maxStatsAboveThreshold: 3,
  highStatThreshold: 0.75,

  // Age brackets [weight, min, maxExclusive]
  ageBrackets: [
    [0.20, 18, 25],
    [0.35, 25, 35],
    [0.25, 35, 45],
    [0.15, 45, 55],
    [0.05, 55, 66]
  ]
};

/* Stat order everywhere: [social, emotional, relational, gameAwareness, background, physicality, smarts] */
const STAT_KEYS = ['social', 'emotional', 'relational', 'gameAwareness', 'background', 'physicality', 'smarts'];
const STAT_LABELS = {
  social: 'Social', emotional: 'Emotional', relational: 'Relational',
  gameAwareness: 'Game Sense', background: 'Background', physicality: 'Physicality', smarts: 'Smarts'
};

/* ---------------- Challenge library (all 28, verbatim) ---------------- */
/* weights: [soc, emo, rel, ga, bg, phys, smrt] */
const CHALLENGES = [
  // PHYSICAL
  { name: 'Endurance Hang', desc: 'Hold the rope as long as possible.', cat: 'Physical', w: [0, 0, 0, 0, 0, 0.9, 0.1] },
  { name: 'Balance Beam', desc: 'Last one standing on the beam wins.', cat: 'Physical', w: [0, 0, 0, 0, 0, 0.9, 0.1] },
  { name: 'Breath Hold', desc: 'Hold your breath the longest.', cat: 'Physical', w: [0, 0.1, 0, 0, 0, 0.8, 0.1] },
  { name: 'Log Carry', desc: 'Haul a heavy log across the course.', cat: 'Physical', w: [0, 0, 0, 0, 0, 0.9, 0.1] },
  { name: 'Island Sprint', desc: 'Race around the island course.', cat: 'Physical', w: [0, 0, 0, 0, 0, 0.9, 0.1] },
  { name: 'Shoulder the Load', desc: 'Hold weight overhead the longest.', cat: 'Physical', w: [0, 0.1, 0, 0, 0, 0.8, 0.1] },
  { name: 'Maze Crawl', desc: 'Navigate the physical obstacle course.', cat: 'Physical', w: [0, 0, 0, 0, 0, 0.85, 0.15] },
  { name: 'Sandbag Stack', desc: 'Build the tallest tower before time runs out.', cat: 'Physical', w: [0, 0, 0, 0, 0, 0.8, 0.2] },
  // PUZZLE
  { name: 'Slide Puzzle', desc: 'Complete the grid puzzle fastest.', cat: 'Puzzle', w: [0, 0, 0, 0, 0, 0.1, 0.9] },
  { name: 'Cipher Decode', desc: 'Translate the coded message.', cat: 'Puzzle', w: [0, 0, 0, 0, 0, 0.1, 0.9] },
  { name: 'Memory Grid', desc: 'Recall the pattern after a brief viewing.', cat: 'Puzzle', w: [0, 0, 0, 0.1, 0, 0, 0.9] },
  { name: 'Coordinates', desc: 'Navigate using clues to find the spot.', cat: 'Puzzle', w: [0, 0, 0, 0.1, 0, 0.1, 0.8] },
  { name: 'Matchstick Math', desc: 'Solve the visual logic puzzles.', cat: 'Puzzle', w: [0, 0, 0, 0, 0, 0, 1.0] },
  { name: 'Sequence Lock', desc: 'Figure out the combination from clues.', cat: 'Puzzle', w: [0, 0, 0, 0.1, 0, 0, 0.9] },
  { name: 'Word Unscramble', desc: 'Tribal-themed anagram race.', cat: 'Puzzle', w: [0, 0, 0, 0, 0, 0.1, 0.9] },
  // ENDURANCE
  { name: 'Flame Endurance', desc: 'Mental toughness hold — outlast everyone.', cat: 'Endurance', w: [0, 0.4, 0, 0, 0, 0.6, 0] },
  { name: 'Night Watch', desc: 'Stay alert through the extended challenge.', cat: 'Endurance', w: [0, 0.4, 0, 0, 0.1, 0.5, 0] },
  { name: 'Starvation Auction', desc: 'Resist temptation while competing.', cat: 'Endurance', w: [0, 0.5, 0, 0, 0, 0.5, 0] },
  { name: 'Willpower Wall', desc: 'Stand motionless against the elements.', cat: 'Endurance', w: [0, 0.4, 0, 0, 0, 0.6, 0] },
  // DEXTERITY
  { name: 'Rope Bridge Build', desc: 'Construct and cross a rope bridge.', cat: 'Dexterity', w: [0, 0, 0, 0, 0, 0.5, 0.5] },
  { name: 'Spear Throw', desc: 'Hit targets at distance.', cat: 'Dexterity', w: [0, 0, 0, 0, 0, 0.6, 0.4] },
  { name: 'Fire Making', desc: 'First to make fire wins.', cat: 'Dexterity', w: [0, 0, 0, 0, 0.1, 0.5, 0.4], fire: true, lateGameOnly: true },
  { name: 'Coconut Slingshot', desc: 'Accuracy challenge — hit the target.', cat: 'Dexterity', w: [0, 0, 0, 0, 0, 0.5, 0.5] },
  { name: 'Blind Build', desc: 'Build a structure blindfolded.', cat: 'Dexterity', w: [0.1, 0, 0.1, 0, 0, 0.4, 0.4] },
  // STRATEGY
  /* REWARD ONLY. The auction is not and has never been an immunity challenge —
     on the show it is a reward event where people bid $500 on covered dishes, and
     nobody's game is on the line. Offering it as immunity read as nonsense, which
     is exactly what it was. It stays in the library because it is a fine reward
     round; Challenges.pickChallenge simply will not draw it. */
  { name: 'Auction Strategy', desc: 'Bid limited currency on advantages.', cat: 'Strategy', w: [0.3, 0, 0, 0.2, 0, 0, 0.5], rewardOnly: true },
  { name: 'Negotiation', desc: 'Convince others to sit out. Last one wins.', cat: 'Strategy', w: [0.5, 0, 0.1, 0.2, 0, 0, 0.2] },
  { name: 'Jury Reads', desc: 'Answer questions about what jurors think.', cat: 'Strategy', w: [0.3, 0.1, 0.1, 0.3, 0, 0, 0.2] },
  { name: 'Tribal Trivia', desc: 'How well do you know your tribemates?', cat: 'Strategy', w: [0.4, 0, 0.2, 0.1, 0, 0, 0.3] },
  // HYBRID
  { name: 'Island Survival Build', desc: 'Build shelter rated on speed and quality.', cat: 'Hybrid', w: [0.1, 0.1, 0.1, 0.1, 0.2, 0.2, 0.2] },
  { name: 'Final Four Fire', desc: 'Pure fire-making race. Anyone can win.', cat: 'Hybrid', w: [0.05, 0.1, 0.05, 0.1, 0.2, 0.3, 0.2], fire: true, finalFourOnly: true },

  /* ---- The classics ----
     Twenty new minigames arrived and the library only had thirty challenges, so
     half of them would only ever have been reached through the deterministic
     fallback — a game with no challenge that describes it. These are the real
     Survivor formats each of those games is built on, named as the show names
     them, so the briefing and the minigame say the same thing.

     Weights are [soc, emo, rel, ga, bg, phys, smrt] and each one is set from what
     the challenge actually tests, which is also what the minigame spends ease on:
     an endurance hang is body and head, a table maze is head and hands, and
     Fallen Comrades is purely whether you have been paying attention to anybody
     other than yourself. */

  // ENDURANCE — hang on, hold still, do not take the food
  { name: 'Chimney Sweep', desc: 'Brace between two walls on shrinking foot pegs.', cat: 'Endurance', w: [0, 0.3, 0, 0, 0, 0.7, 0] },
  { name: 'Wrist Assured', desc: 'Hold a bucket of water on a rope that keeps unwinding.', cat: 'Endurance', w: [0, 0.15, 0, 0, 0, 0.85, 0] },
  { name: 'Uncomfortably Numb', desc: 'Stand on a narrow perch. Peff will offer you food.', cat: 'Endurance', w: [0, 0.6, 0, 0, 0, 0.4, 0] },
  { name: 'Last Gasp', desc: 'Keep your face in the air pocket as the tide comes in.', cat: 'Endurance', w: [0, 0.55, 0, 0, 0, 0.45, 0] },
  { name: 'Island Delicacies', desc: 'Eat what the island offers, and keep it down.', cat: 'Endurance', w: [0, 0.85, 0, 0, 0.15, 0, 0] },

  // DEXTERITY — balance, precision, apparatus that gets worse
  { name: 'Simmotion', desc: 'The ball comes out one end, then the other. Catch every one.', cat: 'Dexterity', w: [0, 0, 0, 0, 0, 0.6, 0.4] },
  { name: 'Roller Ball', desc: 'Balance a ball on a disc. Then a second. Then a third.', cat: 'Dexterity', w: [0, 0.35, 0, 0, 0, 0.65, 0] },
  { name: 'The Ball Drop', desc: 'Hold a rod level with a ball on it. The rod keeps growing.', cat: 'Dexterity', w: [0, 0, 0, 0, 0, 0.6, 0.4] },
  { name: 'A Bit Tipsy', desc: 'Spell IMMUNITY on a base that will not sit still.', cat: 'Dexterity', w: [0, 0, 0, 0, 0, 0.5, 0.5] },
  { name: 'Balancing Point', desc: 'Stack coins on the upturned hilt of a sword.', cat: 'Dexterity', w: [0, 0.1, 0, 0, 0, 0.4, 0.5] },
  { name: 'Blue Plate Special', desc: 'Slingshot rocks at their tiles and bury their tiki.', cat: 'Dexterity', w: [0, 0, 0, 0.1, 0, 0.5, 0.4] },

  // PHYSICAL — strength, contact, nerve in the body
  { name: 'Smash and Grab', desc: 'Swing off the tower and smash the tile holding the key.', cat: 'Physical', w: [0, 0.1, 0, 0, 0, 0.9, 0] },
  { name: 'Dragged Through Mud', desc: 'Reach your flag before they haul you back through it.', cat: 'Physical', w: [0, 0.2, 0, 0, 0, 0.8, 0] },
  { name: 'Sumo at Sea', desc: 'Knock them off the platform. Read them before they move.', cat: 'Physical', w: [0, 0.35, 0, 0.35, 0, 0.3, 0] },

  // PUZZLE — the finisher library
  { name: 'Table Maze', desc: 'Steer the ball through the grooves without losing it.', cat: 'Puzzle', w: [0, 0, 0, 0, 0, 0.4, 0.6] },
  { name: 'Know Your Ropes', desc: 'Work out which strand is on top, and untangle yourselves.', cat: 'Puzzle', w: [0, 0, 0, 0, 0, 0.3, 0.7] },
  { name: 'Tower Shuffle', desc: 'Move the stack across. Never a bigger ring on a smaller one.', cat: 'Puzzle', w: [0, 0, 0, 0, 0, 0, 1.0] },
  { name: 'Tribal Tiles', desc: 'No symbol twice in any row or column.', cat: 'Puzzle', w: [0, 0, 0, 0, 0.1, 0, 0.9] },

  // STRATEGY — do you actually know these people
  { name: 'Fallen Comrades', desc: 'How well did you know the ones who left?', cat: 'Strategy', w: [0.15, 0, 0.45, 0.4, 0, 0, 0] }
];
const CHALLENGE_CAT_WEIGHTS = {
  Physical: CONFIG.challengeWeightPhysical,
  Puzzle: CONFIG.challengeWeightPuzzle,
  Endurance: CONFIG.challengeWeightEndurance,
  Dexterity: CONFIG.challengeWeightDexterity,
  Strategy: CONFIG.challengeWeightStrategy,
  Hybrid: CONFIG.challengeWeightHybrid
};

/* NAME_POOLS, OCCUPATIONS, TRAIT_CLUSTERS, DIALOGUE — appended below
   once extracted from the Unity data files. */

/* ---------------- Trait clusters (all 15, verbatim ranges) ---------------- */
/* ranges per stat: [min,max] in order social, emotional, relational, gameAwareness, background, physicality, smarts */
const TRAIT_CLUSTERS = [
  { name: 'Strategic Veteran',  r: [[0.3,0.5],[0.15,0.35],[0.4,0.65],[0.7,0.9],[0.5,0.7],[0.15,0.35],[0.65,0.85]] },
  { name: 'Social Butterfly',   r: [[0.7,0.9],[0.4,0.65],[0.65,0.85],[0.1,0.3],[0.15,0.35],[0.2,0.5],[0.3,0.55]] },
  { name: 'Paranoid Schemer',   r: [[0.3,0.55],[0.45,0.7],[0.05,0.25],[0.7,0.9],[0.3,0.55],[0.15,0.35],[0.6,0.8]] },
  { name: 'Physical Threat',    r: [[0.2,0.45],[0.1,0.35],[0.3,0.5],[0.2,0.5],[0.6,0.8],[0.7,0.9],[0.1,0.35]] },
  { name: 'Emotional Wildcard', r: [[0.4,0.65],[0.7,0.9],[0.3,0.55],[0.1,0.35],[0.2,0.45],[0.3,0.55],[0.15,0.35]] },
  { name: 'Natural Leader',     r: [[0.6,0.8],[0.4,0.6],[0.55,0.75],[0.45,0.7],[0.15,0.35],[0.2,0.35],[0.45,0.65]] },
  { name: 'Under The Radar',    r: [[0.05,0.25],[0.15,0.35],[0.4,0.6],[0.5,0.75],[0.4,0.65],[0.3,0.55],[0.5,0.7]] },
  { name: 'Loyal Soldier',      r: [[0.35,0.55],[0.3,0.55],[0.7,0.9],[0.05,0.3],[0.45,0.65],[0.45,0.7],[0.1,0.35]] },
  { name: 'Villain Arc',        r: [[0.35,0.6],[0.6,0.8],[0.0,0.2],[0.6,0.85],[0.3,0.5],[0.15,0.35],[0.6,0.8]] },
  { name: 'Fan Favorite',       r: [[0.65,0.85],[0.6,0.8],[0.5,0.7],[0.1,0.35],[0.4,0.6],[0.3,0.55],[0.15,0.35]] },
  { name: 'Loyal Follower',     r: [[0.3,0.5],[0.3,0.5],[0.7,0.9],[0.0,0.2],[0.3,0.55],[0.35,0.6],[0.1,0.3]] },
  { name: 'Chaos Agent',        r: [[0.55,0.8],[0.65,0.85],[0.05,0.3],[0.3,0.55],[0.05,0.3],[0.35,0.6],[0.4,0.65]] },
  { name: 'Bitter Veteran',     r: [[0.05,0.25],[0.5,0.7],[0.0,0.25],[0.65,0.85],[0.55,0.75],[0.3,0.5],[0.5,0.7]] },
  { name: 'Camp Provider',      r: [[0.4,0.6],[0.15,0.35],[0.5,0.7],[0.05,0.25],[0.65,0.85],[0.6,0.8],[0.25,0.5]] },
  { name: 'Reluctant Hero',     r: [[0.15,0.35],[0.4,0.6],[0.4,0.6],[0.15,0.35],[0.5,0.75],[0.45,0.7],[0.4,0.6]] }
];

/* ---------------- Name pools (diverse subset of the Unity pools) ----------------
   Split by gender so a castaway's name always matches their body/pronouns.
   Nonbinary castaways draw from the neutral pool. */
const MALE_FIRST_NAMES = [
  'James','John','Robert','Michael','David','William','Daniel','Matthew','Mark','Kevin','Brian','Jason','Ryan','Jacob','Eric','Justin','Scott','Brandon','Samuel','Patrick','Alexander','Jack','Nathan','Peter','Henry','Mason','Logan','Caleb','Ethan','Noah','Lucas','Owen','Liam','Carter','Wyatt','Luke',
  'Carlos','Miguel','Luis','Jorge','Pedro','Rafael','Diego','Alejandro','Fernando','Javier','Mateo','Santiago','Emilio','Marco',
  'Wei','Jun','Hiro','Kenji','Ryo','Daichi','Yuto','Haruki','Jin','Min','Joon','Liang','Chen','Hao',
  'Arjun','Ravi','Amit','Vikram','Rohan','Nikhil','Deepak','Raj','Kiran','Omar','Hassan','Imran','Tariq',
  'Kwame','Kofi','Ade','Chidi','Emeka','Tendai','Jelani','Jabari','Sekou','Mamadou','Moussa','Amadou',
  'Ali','Yusuf','Khalil','Samir','Rashid','Faris','Zain','Idris','Karim',
  'Luca','Matteo','Stefan','Nikolai','Dmitri','Ivan','Viktor','Lars','Erik','Bjorn','Finn','Hugo','Felix','Oscar','Emil','Axel',
  'Anthony','Charles','Christopher','Steven','Timothy','Jeffrey','Gregory','Douglas','Keith','Dennis','Roger','Wayne','Harold','Russell','Bruce','Craig','Alan','Philip','Todd','Curtis','Shane','Trevor','Colin','Grant','Blake','Chase','Cole','Dean','Elliot','Graham','Miles','Nolan','Preston','Spencer','Tucker','Weston',
  'Antonio','Eduardo','Ricardo','Sergio','Andres','Julio','Manuel','Ramon','Esteban','Gustavo','Hector','Ignacio','Joaquin','Salvador',
  'Takeshi','Sora','Kaito','Riku','Shota','Tatsuya','Feng','Bo','Lei','Peng','Seok','Hyun','Tae','Dong',
  'Aditya','Sanjay','Rahul','Varun','Ishaan','Karthik','Manish','Pranav','Suresh','Anil','Bilal','Danish','Farhan',
  'Kwesi','Bakari','Thabo','Sipho','Dumisani','Chinedu','Obinna','Folami','Kito','Zuberi','Oumar','Ousmane',
  'Mustafa','Tarek','Nabil','Jamal','Hakim','Munir','Ziad','Adel','Waleed',
  'Sven','Anders','Magnus','Henrik','Klaus','Dieter','Jurgen','Pieter','Sander','Thijs','Pascal','Thierry','Bastien','Giovanni','Lorenzo','Alessandro'
];
const FEMALE_FIRST_NAMES = [
  'Mary','Jennifer','Linda','Elizabeth','Susan','Jessica','Sarah','Karen','Lisa','Emily','Michelle','Amanda','Melissa','Stephanie','Rebecca','Laura','Amy','Angela','Anna','Emma','Nicole','Samantha','Katherine','Rachel','Maria','Heather','Julie','Olivia','Victoria','Kelly','Lauren','Christina','Megan','Andrea','Hannah',
  'Sofia','Isabella','Valentina','Camila','Lucia','Gabriela','Elena','Rosa','Carmen','Ana','Mariana','Catalina','Daniela','Jimena','Marisol','Celeste',
  'Yuki','Sakura','Mei','Aiko','Hana','Rin','Kaori','Yuna','Jia','Ling','Eun','Minji',
  'Priya','Ananya','Kavita','Meera','Divya','Neha','Shreya','Asha','Fatima','Aisha','Zara','Noor','Amira',
  'Amara','Zuri','Nia','Chioma','Ngozi','Makena','Amani','Imani','Ayana','Sanaa','Kaya','Dalila',
  'Layla','Yasmin','Leila','Samira','Dina','Rania','Maryam','Nadia','Soraya',
  'Ingrid','Astrid','Freya','Elsa','Greta','Katarina','Natasha','Tatiana','Colette','Margot','Genevieve','Simone','Francesca','Chiara','Bianca','Petra',
  'Barbara','Nancy','Betty','Dorothy','Sandra','Ashley','Kimberly','Donna','Carol','Ruth','Sharon','Cynthia','Kathleen','Amber','Danielle','Brittany','Tiffany','Crystal','Erin','Shannon','Courtney','Alexis','Sydney','Madison','Chloe','Grace','Lily','Zoe','Ava','Sophie','Ella','Ruby','Faith','Paige','Brooke',
  'Guadalupe','Esperanza','Alejandra','Beatriz','Consuelo','Dolores','Estela','Fernanda','Graciela','Ximena','Renata','Paloma','Alma','Noemi','Yolanda','Pilar',
  'Emi','Nanami','Riko','Chiyo','Xiulan','Fang','Qing','Ying','Hyejin','Soyeon','Jiwoo','Nari',
  'Lakshmi','Sunita','Pooja','Anjali','Radha','Sarita','Vandana','Ishita','Tanvi','Zainab','Hina','Rukhsana','Farah',
  'Adaeze','Folasade','Chinelo','Thandiwe','Nomsa','Lindiwe','Wanjiru','Nyala','Aminata','Fatoumata','Mariama','Kadiatou',
  'Salma','Hala','Lina','Rasha','Huda','Wafa','Najwa','Basma','Sahar',
  'Sigrid','Solveig','Annika','Britta','Liesel','Heidi','Ilse','Anneke','Sanne','Femke','Amelie','Camille','Delphine','Giulia','Alessia','Martina'
];
const NEUTRAL_FIRST_NAMES = [
  'Alex','Jordan','Taylor','Morgan','Casey','Riley','Quinn','Avery','Sage','River','Skyler','Dakota','Rowan','Reese','Finley','Harper','Kai','Ari','Remy','Cameron','Drew','Jamie','Hayden','Parker','Phoenix','Blair','Shea',
  'Rory','Emerson','Ellis','Marlowe','Sawyer','Tatum','Arden','Bellamy','Sloane','Wren','Lennox','Micah','Rio','Noel','Devon','Ash','Bay','Sol','Indigo','Jules','Kit','Lane','Nico','Oakley','Robin','Shiloh','Tobin'
];
/* Every first name, for anything that just needs a random human name. */
const FIRST_NAMES = [...MALE_FIRST_NAMES, ...FEMALE_FIRST_NAMES, ...NEUTRAL_FIRST_NAMES];
function firstNamesFor(gender) {
  if (gender === 'Male') return MALE_FIRST_NAMES;
  if (gender === 'Female') return FEMALE_FIRST_NAMES;
  return NEUTRAL_FIRST_NAMES;
}
/* Reverse lookup — used to repair legacy saves where the two disagree. */
function genderFromName(fullName) {
  const first = String(fullName || '').split(' ')[0];
  if (MALE_FIRST_NAMES.includes(first)) return 'Male';
  if (FEMALE_FIRST_NAMES.includes(first)) return 'Female';
  return 'Nonbinary';
}
const LAST_NAMES = [
  'Smith','Johnson','Williams','Brown','Jones','Davis','Miller','Wilson','Moore','Taylor','Anderson','Thomas','Jackson','White','Harris','Martin','Thompson','Robinson','Clark','Lewis','Lee','Walker','Hall','Allen','Young','King','Wright','Scott','Green','Baker','Adams','Nelson','Hill','Campbell','Mitchell','Carter','Phillips','Evans','Turner','Parker','Collins','Stewart','Morris','Murphy','Cook','Rogers','Morgan','Cooper','Reed','Bailey','Bell','Howard','Ward','Sullivan','Bennett','Wood','Barnes','Ross',
  'Garcia','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Perez','Sanchez','Ramirez','Torres','Rivera','Flores','Gomez','Diaz','Cruz','Morales','Reyes','Ortiz','Ramos','Castillo','Mendoza','Vargas','Medina','Delgado','Rios','Vega','Rojas','Aguilar','Soto','Navarro','Fuentes','Herrera',
  'Wang','Li','Zhang','Liu','Chen','Yang','Huang','Zhao','Wu','Zhou','Xu','Sun','Ma','Zhu','Guo','Lin','Luo','Deng','Tang','Zheng',
  'Sato','Suzuki','Takahashi','Tanaka','Watanabe','Ito','Yamamoto','Nakamura','Kobayashi','Kato','Yoshida','Yamada','Sasaki','Matsumoto','Kimura','Hayashi','Saito','Mori','Ikeda','Okada',
  'Kim','Park','Choi','Jeong','Kang','Cho','Yoon','Jang','Lim','Han','Shin','Kwon','Hwang','Ahn','Song','Hong','Seo','Bae',
  'Patel','Sharma','Singh','Kumar','Gupta','Reddy','Mehta','Shah','Nair','Rao','Chopra','Kapoor','Das','Banerjee','Ghosh','Sen','Joshi','Desai','Verma','Iyer','Mishra','Pandey','Sinha','Khan','Ahmed','Hussain','Malik','Chowdhury','Siddiqui','Iqbal',
  'Okafor','Okonkwo','Adeyemi','Osei','Mensah','Asante','Ndlovu','Dlamini','Nkosi','Mwangi','Kamau','Otieno','Traore','Diallo','Diop','Keita','Toure','Ndiaye','Cisse','Okoro','Eze','Nwosu','Adebayo','Bello','Ibrahim','Musa','Moyo','Phiri','Banda','Achebe',
  'Al-Farsi','Al-Rashid','Al-Mansour','Khoury','Haddad','Abboud','Hosseini','Shirazi','Demir','Yilmaz','Kaya','Celik','Ozturk','Sahin','Aydin','Saleh','Nasser','Farid',
  'Muller','Schmidt','Schneider','Fischer','Weber','Wagner','Becker','Hoffmann','Richter','Klein','De Vries','Van Dijk','Bakker','Visser',
  'Dubois','Laurent','Moreau','Lefebvre','Leroy','Fournier','Girard','Bonnet','Dupont','Bertrand','Mercier','Fontaine',
  'Rossi','Russo','Ferrari','Esposito','Bianchi','Romano','Colombo','Ricci','Marino','Greco','Conti','Gallo','Mancini','Leone','Lombardi',
  'Novak','Kowalski','Nowak','Petrov','Ivanov','Volkov','Sokolov','Kuznetsov','Popov','Fedorov','Kozlov',
  'Johansson','Eriksson','Lindqvist','Larsson','Rasmussen','Haugen',
  "O'Brien","O'Sullivan","O'Connor","O'Neill",'Gallagher','McCarthy','Doyle','Brennan','Fitzgerald','MacLeod','MacDonald','Ferguson','Wallace','Douglas',
  'Dela Cruz','Santos','Bautista','Aquino','Villanueva','Fernandez','Tran','Nguyen','Pham','Hoang','Bui','Vo','Le','Do'
];

/* ---------------- Occupations (subset of the Unity library, all groups) ---------------- */
const OCCUPATIONS = [
  'Warehouse Worker','Forklift Operator','Janitor','Garbage Collector','Factory Worker','Dock Worker','Truck Driver','Delivery Driver','Bus Driver','Taxi Driver','Mail Carrier','Security Guard','Bouncer','Oil Rig Worker','Coal Miner','Fisherman','Crab Fisher','Lobster Diver','Ranch Hand','Farmhand',
  'Electrician','Plumber','Carpenter','Welder','Mason','Roofer','Ironworker','Machinist','HVAC Technician','Elevator Mechanic','Locksmith','Auto Mechanic','Diesel Mechanic','Aircraft Mechanic','Crane Operator','Lineman','Solar Panel Installer','Wind Turbine Technician',
  'Accountant','Auditor','Financial Analyst','Investment Banker','Stockbroker','Insurance Agent','Real Estate Agent','Bank Teller','Actuary','Management Consultant','Project Manager','HR Manager','Recruiter','Office Manager','Receptionist','Bookkeeper','Compliance Officer','Logistics Coordinator','Brand Manager','Sales Manager','Copywriter','Technical Writer','Translator',
  'Software Engineer','Web Developer','Game Developer','DevOps Engineer','Network Engineer','Security Analyst','Penetration Tester','Data Scientist','Robotics Engineer','QA Tester','UX Designer','Product Manager','IT Support Specialist','Full Stack Developer','Data Engineer','3D Modeler','SEO Specialist',
  'Physician','Surgeon','Radiologist','Dermatologist','Pediatrician','Psychiatrist','Dentist','Optometrist','Pharmacist','Registered Nurse','Nurse Practitioner','Midwife','Paramedic','EMT','Physical Therapist','Speech Therapist','Lab Technician','Phlebotomist','Dental Hygienist','Veterinarian','Chiropractor','Dietitian','Home Health Aide','Medical Examiner',
  'Lawyer','Defense Attorney','Prosecutor','Immigration Lawyer','Patent Attorney','Judge','Paralegal','Court Reporter','Bailiff','Probation Officer','Mediator','Public Defender','Private Investigator','Forensic Accountant','Lobbyist','Policy Analyst',
  'Professor','Lecturer','Research Scientist','Archaeologist','Anthropologist','Sociologist','Psychologist','Historian','Philosopher','Linguist','Economist','Geologist','Marine Biologist','Astrophysicist','Chemist','Microbiologist','Botanist','Zoologist','Meteorologist','Mathematician','Statistician','Librarian','Museum Curator','School Teacher','Kindergarten Teacher','School Counselor','Tutor',
  'Painter','Sculptor','Illustrator','Graphic Designer','Animator','Tattoo Artist','Photographer','Videographer','Film Director','Screenwriter','Novelist','Poet','Journalist','Editor','Comic Book Artist','Fashion Designer','Jewelry Designer','Interior Designer','Furniture Maker','Potter','Glassblower','Blacksmith','Leatherworker','Florist','Cake Decorator',
  'Actor','Voice Actor','Comedian','Stand-Up Comic','Improv Performer','Stunt Performer','Casting Director','Talent Agent','Musician','Singer','Rapper','DJ','Music Producer','Composer','Choreographer','Dancer','Circus Performer','Acrobat','Magician','Puppeteer','Clown','Mime','Street Performer','Radio Host','Podcast Host','TV Presenter','News Anchor','Game Show Host','Reality TV Producer','Cinematographer','Costume Designer','Makeup Artist','Hair Stylist','Pyrotechnician',
  'Professional Athlete','Personal Trainer','Strength Coach','Yoga Instructor','Swim Coach','Boxing Trainer','MMA Fighter','Professional Wrestler','Soccer Player','Basketball Player','Tennis Player','Golfer','Marathon Runner','Triathlete','Rock Climber','Mountaineer','Surfer','Skateboarder','Snowboarder','Ski Instructor','Scuba Diving Instructor','Lifeguard','Sports Referee','Athletic Trainer','Rodeo Rider','Jockey','Fencer','Archer',
  'Army Soldier','Marine','Navy Sailor','Air Force Pilot','Coast Guard','Special Forces Operator','Combat Medic','Drill Sergeant','Bomb Disposal Technician','Helicopter Pilot','Firefighter','Wildland Firefighter','Police Officer','Detective','SWAT Officer','FBI Agent','Border Patrol Agent','Park Ranger','Search and Rescue Worker','911 Dispatcher','Air Traffic Controller',
  'Dog Walker','Professional Cuddler','Fortune Teller','Tarot Reader','Auctioneer','Antique Dealer','Pawnbroker','Beekeeper','Mushroom Forager','Truffle Hunter','Wine Sommelier','Cheese Monger','Food Truck Owner','Barbecue Pitmaster','Brewmaster','Distiller','Ice Cream Taster','Chocolate Maker','Sushi Chef','Taxidermist','Embalmer','Storm Chaser','Crime Scene Cleaner','Professional Organizer','Feng Shui Consultant','Sleep Coach','Doula','Hypnotherapist','Voice Coach','Etiquette Coach','Horse Whisperer','Falconer','Zookeeper','Aquarist','Gondolier','Hot Air Balloon Pilot','Skydiving Instructor','Ghost Tour Guide','Haunted House Actor','Renaissance Faire Performer','Historical Reenactor','Lego Builder','Crossword Constructor','Professional Whistler','Water Slide Tester','Miniature Painter','Escape Room Designer'
];

/* ---------------- Dialogue & host voice ---------------- */
const DIALOGUE = {
  greetings: [
    'Hey. Come sit.', "What's up?", 'Good to see a friendly face.', 'Pull up a log.',
    'You look like you need to talk.', 'Perfect timing.', "I was hoping you'd come by.",
    'Rough day, huh?', 'Hey there.', 'Saved you a spot on the good log.',
    'If you brought food, I love you. If not, sit anyway.', 'Walk with me a second.',
    'You have that look. Talk.', "Careful, people will say we're aligned.",
    'Company. Thank the island.', 'Shh. Sit. The fire just got good.',
    "You're either bored or plotting. Either works.", 'Finally, a face I can read.',
    'Come here often? Kidding. Sit.', 'I was just thinking about you. Not in a vote way. Relax.',
    'Grab a coconut. This might take a while.', 'You hungry? Rhetorical. We all are. Sit.',
    'Good timing — I was about to start talking to the crabs.', 'What do you need, and what does it cost me?',
    "Sit down before someone thinks we're strategizing. Actually, let them.",
    'Oh good. I was one bored minute away from doing something stupid.', 'The tide brought you in, huh?'
  ],
  /* Framing for an out-of-the-blue vote ask vs. one from someone you know. */
  probeFraming: {
    stranger: [
      '{n} has hardly said a word to you all season — and now they are standing here, glancing over their shoulder.',
      'You have never had a real conversation with {n}. They have walked across camp specifically to find you.',
      'This is the first time {n} has sought you out. That alone is information.',
      '{n} waits until nobody is looking your way. You barely know their voice.',
      'Out of nowhere. {n} has been avoiding you for days and now wants your vote.',
      '{n} does not do this. Whatever has changed, it changed today.',
      'You would not have picked {n} as the person to come to you. Here they are.',
      'No small talk, no build-up. {n} skips straight to the ask.'
    ],
    known: [
      '{n} drifts over the way they always do when something is moving.',
      'You two have talked enough for this to feel normal.',
      '{n} catches your eye first, then comes over.',
      'Familiar enough. {n} does not bother with the preamble.',
      'You have built something with {n}. This is them using it.',
      '{n} sits down beside you like it is nothing.'
    ],
    ally: [
      '{n} does not look around before speaking. They do not have to.',
      'Your ally. This is the conversation you have been having all season.',
      '{n} comes straight to you, because of course they do.',
      'No games. {n} needs to know where you are so they can match it.',
      '{n} speaks quietly, but not carefully. You are past careful.'
    ]
  },

  probes: {
    Warm: [
      "Hey — where's your head at for tonight?", 'Between us, who are you leaning?',
      "I trust you. Tell me what you're actually thinking.", "What's the play from your side tonight?",
      'No games, just us. What name are you writing?', "I'll tell you mine if you tell me yours.",
      'We move together, right? So... who?', 'Before the fire tonight — where are we landing?',
      'I want us on the same page when Peff calls us up.', 'Talk to me like we mean it. Tonight — who?',
      "Whatever you say stays with me. Who's it going to be?", "I'd rather hear it from you than guess."
    ],
    Coded: [
      'So. Tonight. Any reads?', "If tribal was right now, where'd your vote go?",
      'Not pushing. Just curious where you sit.', 'You hearing anything I should know about?',
      'Weather report. For tonight. You follow.', 'Hypothetically. A name. Yours to give.',
      "I collect information. You have some. Let's trade.", 'The fire asks questions tonight. Got answers?',
      'Two camps forming. Which one has your pen?', "I know three plans. Curious if you're a fourth.",
      "Just taking the temperature. What's yours?", 'Say a name. Any name. I like patterns.'
    ],
    Urgent: [
      "Please — who are you thinking? I can't handle the not-knowing.",
      "What names are out there? I'm spiraling over here.",
      'I need something. Anything. Who tonight?', "Don't leave me in the dark. Who are you on?",
      "Is it me? Just tell me if it's me. Actually don't. Actually DO.",
      "I haven't eaten and I can't stop counting votes. Help.",
      'Everyone got quiet when I walked up. EVERYONE. Who is it?',
      "My gut says it's me. Tell my gut it's wrong. Please.",
      "I've made peace with the island. Not with the not-knowing. Talk.",
      "One name and I'll sleep tonight. Maybe.",
      "You're calm. Why are you calm?? What do you know?",
      "If you know something and don't tell me, I will haunt this beach."
    ],
    Blunt: [
      'Who you voting.', 'Got a name yet?', 'Tonight. Who.', 'You got a target?',
      'Name.', 'Talk. Fast. Who.', 'Vote. Yours. Say it.', "I don't do small talk. Who's going home?",
      'Skip the dance. Who?', 'One word. A name.', 'Clock is ticking. Name.', "Don't waste my daylight. Who?"
    ],
    Paranoid: [
      'Strange energy today. You picking up on it?', 'People are saying things. You hear any names?',
      "Something's off. What's your read?", "Who's working who right now? Give me something.",
      'Two people stopped talking when I passed. Twice. Names. Now.',
      "I saw footprints by the rocks. Whose? Doesn't matter. Who are you voting?",
      "Everyone's being nice to me today. That's bad. What do you know?",
      'The fire crackled weird last night. And someone smiled at me. Connect the dots.',
      "I made a list of who hasn't talked to me today. You're not on it. Yet. Talk.",
      "They think I don't notice. I notice EVERYTHING. Confirm a name.",
      'My gut has been right twice this season. It says tonight is loud. Who?',
      'If this is a blindside, blink twice. ...You blinked once. What does that mean?'
    ]
  },
  probeReact: {
    Believed: [
      'Noted.', 'Good to know.', 'Thanks for being straight.', 'That tracks.',
      'Okay. That matches what I heard.', 'Appreciated. I remember honesty.',
      'Good. We see it the same way.', "Then we're fine. For tonight.",
      'That settles my stomach a little.', 'Straight answer. Rare out here.',
      "I'll plan around that.", 'Between us, that helps a lot.'
    ],
    Doubted: [
      'Interesting read. Not sure I buy it.', 'Convenient answer.', "Half an answer. I'll work with it.",
      'Hm. The eyes said something different.', "That's a politician's answer.",
      "Maybe true. Maybe rehearsed. I'll find out.", 'You paused first. Interesting.',
      "I'll pencil it in. Pencil, not pen.", 'Sure. And the fish jumped into the pot by itself.'
    ],
    Caught: [
      "That's not what I'm hearing.", "Don't play me.", 'Cute. I know better.',
      'Three people told me otherwise. THREE.', 'You just wrote your own name in my book.',
      'Wow. To my face, even.', 'I gave you the honesty door. You picked the window.',
      "That's the story you're going with? Bold.", 'Noted. Everything about that is noted.'
    ]
  },
  peff: {
    applause: [
      '\u2014 the crew bursts into applause \u2014',
      '\u2014 whooping and applause from behind the cameras \u2014',
      '\u2014 the crew cheers. Somebody whistles \u2014',
      '\u2014 applause, and one very loud air horn \u2014',
      '\u2014 the whole crew is clapping. It echoes off the water \u2014'
    ],
    marooning: [
      'Come in and drop your bags. Twenty castaways, two tribes, thirty-nine days.',
      'Welcome to the island. Take a good look at the people who will end your game.',
      'Two tribes. One winner. Everything you do from here is being counted.',
      'Before you get a drop of water from me, I want to hear from some of you.'
    ],
    marooningEnd: [
      'That is enough honesty for one morning. Tribes — grab your supplies and go.',
      'Remember what you just heard. They will.',
      'Good luck. You are going to need considerably more than that.',
      'Head to your camps. The game starts the moment you turn around.'
    ],
    tribalIntro: [
      'Well, well. Back so soon. Grab a torch — you know how this works by now.',
      "Fire represents your life in this game. When it's gone... so are you.",
      'Eighteen strangers came out here with a dream. Tonight, one dream gets snuffed.',
      "I've seen a lot of tribals. Something tells me this one's going to sting.",
      'Somebody at this fire is lying. Statistically, several of you.',
      "You all look very confident. That's usually when it goes wrong."
    ],
    /* The line over the ballot grid. Used to be tribalIntro — a WELCOME — which
       became wrong the moment the council got a real opening: Peff greeted the
       tribe, questioned them for several beats, and then greeted them again. These
       are about the act of voting instead, which is what that screen is for now. */
    voteTime: [
      "It is time to vote.",
      "Nobody else has anything to add. It is time to vote.",
      "That is enough talking. Time to vote.",
      "You have all heard each other. It is time to vote.",
      "One of you is about to decide this. It is time to vote.",
      "Everything either of you wanted said has been said. Time to vote.",
      "Let us get to it. Time to vote.",
      "You know what you know. It is time to vote.",
      "Whatever was going to change your mind has happened by now. Time to vote.",
      "Enough. It is time to vote."
    ],
    voteRead: ["I'll read the votes.", "Once the votes are read, the decision is final. I'll read the votes.", "Let's see how honest everyone was today."],
    snuff: [
      '{name}, the tribe has spoken.',
      '{name}... the tribe has spoken. Time for you to go.',
      "{name}, can't say it was subtle. The tribe has spoken."
    ],
    medivac: ["This is the part of the job I hate. {name} needs to leave the island — this isn't a vote, it's medical.", 'The island always collects its tax. {name} is being evacuated.'],
    quit: ["{name} has decided the adventure ends here. You can't vote for someone who votes for themselves first.", 'Some torches walk themselves to me. {name} is done.'],
    mergeAnnounce: "Drop your buffs. You've made the merge — one tribe, one fire, and a jury watching every move you make from here on out.",
    swapAnnounce: "Everybody breathe. Now drop your buffs — we're shaking things up. New tribes, new problems.",
    finaleIntro: 'Two of you are left. The jury you built — vote by vote — decides which of you turned a game into a win.',
    playerOut: [
      'And just like that, the star of our story becomes a spectator.',
      'You played hard. The island played harder. The tribe has spoken.',
      'Take a long look at that fire. It was yours until about nine seconds ago.'
    ]
  },
  feedStrings: {
    lockObserved: '{obs} glanced your way.',
    promiseBreak: "{name} won't forget that.",
    overtalk: '{name} seems a little less responsive.',
    gossipBack: '(You sense {name} might tell {target}...)',
    seenTogether: '{obs} clocked you with {npc}.',
    quietMoment: 'A quiet moment passes with {npc}.',
    awkward: 'An awkward lull settles in.',
    crisis: "Someone's calling everyone to the fire.",
    overhear: 'You overhear bits of another conversation.'
  }
};

/* ---------------- NPC response pools (3x variety pass) ----------------
   {tn} = target's display name, {mem} = stored memory fragment. */
const NPC_LINES = {
  approach: [
    'Got a minute?', 'Hey. Walk with me.', 'Quick word?', 'There you are.',
    'Been looking for you.', 'You got a second or ten?'
  ],

  chatHi: [
    'laughing way too loud', 'telling the oyster story again', 'trading impressions of Peff',
    'ranking everyone’s snoring', 'debating best pizza toppings', 'reenacting the challenge',
    'swapping first-date disasters', 'inventing a handshake', 'howling about something',
    'planning an imaginary feast', 'doing bad accents', 'gossiping at full volume'
  ],
  chatMid: [
    'talking quietly', 'catching up', 'comparing notes', 'passing the time',
    'complaining about the rice', 'guessing tomorrow’s challenge', 'talking hometowns',
    'discussing the weather like it matters', 'half-whispering', 'keeping each other company',
    'talking around the real subject', 'circling something unsaid'
  ],
  chatLow: [
    'sitting in silence', 'nodding along', 'staring at the fire',
    'sharing a long quiet', 'watching the horizon together', 'poking the sand with sticks',
    'chewing in silence', 'listening to the waves', 'saying nothing, loudly'
  ],
  solo: [
    'gathering firewood', 'checking the fish trap', 'stretching out a bad shoulder',
    'watching the water', 'talking to a coconut', 'redoing the shelter knots',
    'counting something on their fingers', 'practicing a jury speech under their breath',
    'looking for something in the sand', 'washing the one good pot', 'pacing',
    'staring at the treeline'
  ],

  bondLowMorale: [
    "Thanks for checking in. It's been rough.",
    "I won't lie, this island is winning today.",
    'You caught me on a low one. Sit anyway.'
  ],
  bondHigh: [
    'Honestly? Talking to you is the best part of this island.',
    'You again. Good. I was hoping it’d be you.',
    'If we were home I’d say let’s get coffee. Out here, enjoy this coconut.'
  ],
  bondMid: [
    "You're alright, you know that?",
    'Okay, I’m starting to get you. Slowly.',
    'This is nice. Suspiciously nice, but nice.'
  ],
  bondCold: [
    'Hm. Sure, we can talk.',
    'Talking. Right. People do that here.',
    'Five minutes. The fish trap won’t check itself.'
  ],

  famKnown: [
    'You remembered. Yeah — {mem}. That means a lot.',
    'You actually listened. {mem}. Most people out here don’t.',
    'Still thinking about {mem}. Thanks for asking twice.'
  ],
  famFirstDeep: [
    'Oh man. Okay. {mem}. I think about it every day out here.',
    'You really want to know? {mem}. Don’t make me cry before dinner.',
    'Nobody’s asked me that yet. {mem}. There. Now you know me.'
  ],
  famFirstGuard: [
    'I keep it close, but... {mem}.',
    'Careful, that’s the real stuff. {mem}. Keep it between us.',
    'Huh. Fine. {mem}. Don’t use that against me.'
  ],
  famMems: [
    'my sister back home — we used to fish every summer',
    "my two kids — they're probably glued to the TV right now",
    'my partner — we got engaged right before I flew out',
    'my dog — I miss that little goofball so much',
    'my grandmother — she taught me every card game I know',
    'my brother — we built a raft once and nearly drowned laughing',
    'my mom — she still calls me by my childhood nickname',
    'my best friend since third grade — they bet me I wouldn’t last a week here',
    'my old man — he never says it but he watches every episode of this show',
    'my daughter — she drew me a map of the island before I left. It’s wrong, but I love it',
    'my roommate’s cat — which is somehow also my cat now',
    'Sunday dinners — the loud, burnt, perfect kind'
  ],

  jokeHit: [
    "HA! Stop! I'm dying!",
    "You're FUNNY. Why didn't I know you were funny?",
    'DEAD. I am dead. That killed me.',
    'Okay wait, tell that one again at the fire tonight.',
    'I just laughed for real for the first time in a week.',
    'Do NOT make me laugh this hard on this little food.',
    'I snorted. You heard it. We never speak of it.',
    'That’s going in my top three island moments.',
    'You’ve been holding out on the whole tribe.'
  ],
  jokeMiss: [
    'Heh. Good one.',
    'Mm.',
    'Is that... a joke? Okay.',
    'I get it. I’m just conserving calories.',
    'Funny. In a way.',
    'My face is smiling on the inside.',
    'Noted. Comedy attempt logged.',
    'You should workshop that one.',
    'The tide laughed. That’s something.'
  ],

  /* ---- Action Wheel port: small talk / open up / offer help ---- */
  smallHunger: [
    'Tell me about it. I’d fight a seagull for a sandwich.',
    'Same. I dream in cheeseburgers now.',
    'We’re all running on rice fumes out here.',
    'Don’t start. My stomach just answered you.'
  ],
  smallFood: [
    'A big plate of pasta. The kind my mom makes.',
    'Honestly? A cheeseburger with everything on it.',
    'Fresh sushi. I dream about it.',
    'Cold beer and a pizza. That’s the whole list.',
    'Pancakes. A stack you could hide behind.'
  ],
  smallSing: [
    'You hum a few bars together. The words are wrong. Nobody cares.',
    'They drum on a log while you butcher the chorus.',
    'Two verses in, neither of you remembers the bridge.',
    'It’s off-key and perfect.'
  ],
  openLow: [
    'Sorry. I’m listening. Kind of. Rough day.',
    'That’s nice. My head’s just somewhere else.',
    'Keep going. You deserve a better audience than me today.',
    'Good story. I just can’t hold onto it right now.'
  ],
  openHigh: [
    'Wait, really? Tell me everything.',
    'That’s the kind of thing you can’t make up. More.',
    'See, THIS is why I like you.',
    'I’m stealing that story when I get home.',
    'Best conversation I’ve had in days. What happened next?'
  ],
  openMid: [
    'Ha. Nice. I can see it.',
    'That’s a good one. Better than rice talk.',
    'Huh. You’ve got layers. Noted.',
    'Thanks for sharing that. Really.'
  ],
  openCold: [
    'Mm.', 'Cool.', 'That happened?', 'Different lives, I guess.', 'You done?'
  ],
  helpThanks: [
    'Thanks for the hand. Not everyone bothers.',
    'Appreciated. I’ll remember it.',
    'You didn’t have to do that. Noted.',
    'Camp runs on people like you.'
  ],

  /* ---- Read the room (speculate) — by their game awareness ---- */
  readHighGA: [
    'There’s a clear hierarchy forming. Some people see it, most don’t.',
    'Two or three people are running this game. Everyone else is furniture.',
    'The real alliances aren’t the ones people think.',
    'Watch who eats together. That tells you everything.',
    'The swing vote doesn’t know they’re the swing vote. That’s power.',
    'The person everyone trusts is the most dangerous person here.',
    'This tribe has a blindside in it. I can taste it.'
  ],
  readMidGA: [
    'There are a few groups forming. Pretty obvious ones.',
    'I’ve got my reads. Some are probably wrong.',
    'There’s at least one person nobody’s watching. That’s interesting.',
    'Some of these bonds are real. Some are convenient.',
    'A couple people are too comfortable. That’s usually dangerous.',
    'The honest ones aren’t always the loyal ones.'
  ],
  readLowGA: [
    'Everyone seems pretty chill?',
    'It’s a good group. No complaints.',
    'If there’s drama happening, it’s over my head.',
    'People are people. Some good, some quiet.',
    'Everyone’s nice to me. What else is there to know?',
    'Vibes are fine. I don’t overthink it.'
  ],

  /* ---- Undermine / attack character ---- */
  underDefend: [
    'I like {tn}. This feels like a move.',
    'Don’t talk about {tn} like that. We’re tight.',
    'That doesn’t match my read on {tn}. At all.',
    'Trying to turn me against my people? Bold.'
  ],
  underBuy: [
    'Hmm. That’s concerning about {tn}.',
    'I’ll keep an eye on {tn}. Thanks for the heads up.',
    'I had my doubts about {tn} too.',
    'Finally someone else sees it. Go on.'
  ],
  attackCaught: [
    'That’s a desperate move. It tells me more about you than them.',
    'Character attacks are the weapon of the weak.',
    'Whoa. That was intense. And noted — about both of you.',
    'That felt more about you than about {tn}.'
  ],
  attackTook: [
    'Strong words about {tn}. Maybe you’re right.',
    'Yeah. {tn}’s not pulling weight anyway.',
    'The group’s been saying that about {tn} too.',
    'I hear you. I’ll think about that.'
  ],

  /* ---- Back me up / break alliance ---- */
  /* "Back me up tonight" — assembled from a stance plus the consideration that
     actually drove it, so the answer explains itself instead of being filler. */
  /* "Back me up tonight" — assembled from a stance plus the consideration that
     actually drove it. Ten of each, so the same situation never sounds the same
     way twice. Nothing here names the internal stance: the player reads people,
     not labels. */
  backStance: {
    Committed: [
      '{tn}. Yes. I am with you.',
      'Done. I write {tn}, you write {tn}, we never talk about it again.',
      'You had me at {tn}. Let us end their game.',
      'Consider it written. {tn} goes home.',
      'Finally. Someone said it out loud. {tn}.',
      'Say no more. My pencil is already moving.',
      'Good. I was starting to think I was the only one.',
      '{tn} it is. Do not flinch at the fire and neither will I.',
      'Yes. And if it goes sideways, I will still have written it.',
      'That is the right name, and you know I know it.'
    ],
    Leaning: [
      '{tn}... yeah. Probably. I am close.',
      'I could get there on {tn}. Do not make me regret it.',
      'Alright. Lean on me at the fire and I will follow.',
      '{tn} works for me, I think. Ask me again before we walk up.',
      'Ninety percent yes. Leave me the ten.',
      'I am not far off that. Give me the day.',
      'If the numbers are there, {tn} is fine by me.',
      'Say it to me once more tonight and I will write it.',
      'That is where I am drifting. I will not pretend otherwise.',
      'I like it more than I want to admit.'
    ],
    Noncommittal: [
      'Maybe. I am not promising you a name tonight.',
      'I will think about {tn}. That is all you get.',
      'Do not put my vote in your pocket yet.',
      'Ask me at the fire. I decide there.',
      'I hear you on {tn}. That is not the same as agreeing.',
      'Noted. Filed. Not promised.',
      'You will know what I did when everyone else does.',
      'I keep my own counsel on this one.',
      'Could be {tn}. Could be someone else entirely.',
      'I have not decided, and I am not going to decide for you.'
    ],
    Refused: [
      'No. Not {tn}, not tonight.',
      'I am not writing {tn}. Find someone else.',
      'That is a hard no. Do not ask me twice.',
      'You have the wrong person for that.',
      'Absolutely not. Move on.',
      'No. And I would rather you had not asked.',
      'That is not happening. Not from me.',
      'You can stop there. The answer is no.',
      'I will not do that. Ask me for anything else.',
      'No. Pretend this conversation did not happen.'
    ]
  },
  backReason: {
    bound: [
      '{tn} and I came into this together. That still means something.',
      'I gave {tn} my word before you asked me for it.',
      'You are asking me to burn the one person who has not lied to me.',
      'We made a promise on the first night. I keep those.',
      '{tn} would take a vote for me. I do not throw that away.',
      'If I turn on {tn}, what exactly am I to you afterwards?',
      'There is a line, and {tn} is on the other side of it.',
      'Everyone here has an alliance. {tn} is mine.',
      'I would have to be a different person to write that name.',
      'Ask me for anyone but {tn} and we can talk.'
    ],
    likesTarget: [
      'I actually like {tn}. That makes it harder than you think.',
      '{tn} has been decent to me. That counts.',
      'You are asking me to write down a friend.',
      '{tn} sat with me when nobody else did.',
      'I do not have many people here. {tn} is one of them.',
      'It is not the strategy I am struggling with. It is {tn}.',
      'You have clearly never had a real conversation with {tn}.',
      '{tn} makes this place bearable. Think about what you are asking.',
      'I will be honest — that name hurts to hear.',
      'Say any other name and I would not blink. Not that one.'
    ],
    distrustsYou: [
      'I barely know where you stand. Give me a reason first.',
      'You want my vote before you have earned it.',
      'For all I know you are telling {tn} the same thing right now.',
      'We have not had one honest conversation and you want a name?',
      'Who else have you asked? Be specific.',
      'You are very comfortable spending my vote.',
      'Come back when I have a reason to believe you.',
      'I do not know you well enough to be your number.',
      'People who move this fast usually have somebody behind them.',
      'Convince me you are on my side, then ask again.'
    ],
    alreadyWanted: [
      '{tn} was already the name in my head.',
      'You are pushing on a door that was open.',
      'I have been waiting for someone to say {tn} first.',
      'You are late. I got there days ago.',
      'That name has been sitting on my tongue all week.',
      'We are reading the same beach, you and I.',
      'I almost said {tn} before you did.',
      'Good. I hate being the only one holding a name.',
      'You just described my own plan back to me.',
      'I have been counting, waiting to see if anyone else saw it.'
    ],
    targetHarmless: [
      '{tn}? They are nobody. Why waste a vote there?',
      'There are bigger problems on this beach than {tn}.',
      'Spending a vote on {tn} helps whoever is actually running this.',
      '{tn} could not organise a vote if you handed them the pencil.',
      'You want to burn a vote on someone who cannot hurt either of us?',
      'Keep {tn} around. They are useful precisely because they are harmless.',
      'That is a wasted night. Aim higher.',
      'I am not spending a vote just to feel busy.',
      '{tn} goes home whenever we decide. Why tonight?',
      'If {tn} is your biggest concern, you are not paying attention.'
    ],
    youAreTheThreat: [
      'Honestly? You are the one I have been watching.',
      'You are the biggest threat in front of me. Do not pretend otherwise.',
      'Every name you hand me makes me trust you less.',
      'You have a name for everyone except yourself.',
      'The person I am worried about is standing right here.',
      'You are running this beach and you want my help doing it?',
      'I would rather write yours, if we are being honest.',
      'You keep aiming me at people. I have noticed.',
      'The last three names I heard all came from you.',
      'Ask yourself why you need my vote quite this badly.'
    ],
    neutral: []
  },

  backMeUpOk: [
    'Tonight? {tn}? Okay. I’m in — this once.',
    'You’re asking a lot. Fine. {tn}.',
    'If that’s the play, I’ll hold my end tonight.',
    'One vote. {tn}. Don’t make a habit of asking.'
  ],
  breakLine: [
    'That’s how it’s going to be? Fine.',
    'Wow. Okay. Noted — all of it.',
    'You’ll regret this before I do.',
    'Say less. I know exactly where we stand now.'
  ],

  /* ---- Share a secret / confront ---- */
  revealWarm: [
    'You’re trusting ME with this? I won’t forget it.',
    'That took guts to say out loud. It stays with me.',
    'Okay. That’s real. Thank you.',
    'I’ll guard that. You’ve earned something back.'
  ],
  revealWary: [
    'That’s valuable. I’ll use it wisely. Probably.',
    'Interesting play, telling me that.',
    'Trust is a weapon. You just handed me one.',
    'Noted. Very carefully noted.'
  ],
  confrontFold: [
    'Okay. Okay. Message received. Just... don’t.',
    'You’re scaring me. I’ll think about it.',
    'That’s a lot. I hear you.',
    'Please. I just want to survive this week.'
  ],
  confrontDefy: [
    'Threats are information. Thank you for yours.',
    'You just showed me your whole game.',
    'Try that again. See what happens.',
    'Been threatened by better.',
    'That just moved you to the top of my list.'
  ],

  /* ---- Circles (multi-way alliances) ---- */
  circleYes: [
    'Count me in. Three is stronger than two.',
    'About time we made this real. I’m in.',
    'Okay. But we keep it quiet.',
    'A pact. Smart. I trust this.'
  ],
  circleGrow: [
    'The pact grows. Good call.',
    'That’s numbers. Locked.',
    'Fine. But this is the last one we add.',
    'Four hands are better than three.'
  ],
  /* Refusals are split by WHO is objecting, so the speaker never ends up naming
     themselves as the problem. {tn} is filled with whoever the speaker distrusts;
     {cand} is always the person being proposed. */
  circleNo: [                    // the speaker themselves distrusts the candidate
    'Not with {tn}. I don’t trust them.',
    '{tn}? Hard pass. Ask me again with someone else.',
    'I’d work with you. Not with {tn}.',
    'That mix doesn’t work. {tn} worries me.'
  ],
  circleNoMember: [              // a third member of the circle won’t sit with them
    '{tn} won’t sit in the same pact as {cand}. Sorry.',
    'I floated it. {tn} shut it down — bad history with {cand}.',
    '{tn} and {cand}? That’s a fight waiting to happen.',
    'You’d have to square {tn} with {cand} first. Not my call.'
  ],
  circleNoCand: [                // the candidate is cold on a THIRD member
    'I asked. {cand} isn’t warm on {tn} yet.',
    '{cand} won’t come in while {tn} is in it.',
    'They’re not there yet — {cand} still reads {tn} as a threat.',
    '{cand} said no. Something about {tn}.'
  ],
  circleNoCandOnMe: [            // the candidate is cold on the SPEAKER themselves
    'I asked. {cand} doesn’t trust me enough for that.',
    '{cand} won’t sit in a pact with me. Not yet.',
    'Me and {cand}? There’s history. Smooth that over first.',
    '{cand} looked at me like I was the catch. Work on that.'
  ],
  pastVoteTell: [
    'Last time? I wrote {tn}.',
    '{tn}. No hesitation.',
    'I voted {tn}. Ask anyone.',
    'It was {tn}. That is not a secret.'
  ],
  pastVoteDodge: [
    'That is between me and the fire.',
    'Does it matter now? It is done.',
    'I would rather not relitigate it.',
    'Ask me something else.'
  ],
  myVoteAligned: [
    'You wrote {tn} too? Good. That is us in step.',
    '{tn}. Same as me. I like knowing that.',
    'Then we were on the same page and neither of us said it out loud.'
  ],
  myVoteHonest: [
    '{tn}. Alright. Thank you for saying it straight.',
    'Noted. Most people would have dodged that.',
    'You did not have to tell me that. I will remember you did.'
  ],
  myVoteBusted: [
    'I was sitting right there. You wrote {tn}.',
    'Do not. I watched the reveal with my own eyes.',
    'That is not what the votes said, and you know it.'
  ],

  namedOpen: [
    'You are going to bring up last night, are you not.',
    'Say it. I know what this is about.',
    'I wondered how long that would take.',
    'Go on. Get it off your chest.'
  ],
  whyMeTell: [
    'It was {sn}. They spent all day putting your name in mouths.',
    '{sn} came to me. I will not pretend otherwise.',
    'Ask {sn}. It was their idea, not mine.',
    'Honestly? {sn} made it sound like the safe play.'
  ],
  whyMeDodge: [
    'Does it matter? You are still here.',
    'It was the numbers. Not personal.',
    'I am not getting into who said what.',
    'You would have done the same. Let it go.'
  ],
  confrontVoteFold: [
    'I did. I am not proud of it. It will not happen again.',
    'You are right. I panicked and I picked wrong.',
    'Yeah. I wrote it. I owe you better than that.',
    'I have felt sick about it since. I am with you now.'
  ],
  confrontVoteOwn: [
    'I did. And if it comes back around, I will do it again.',
    'You are the biggest threat here. That was strategy, not spite.',
    'Do not act wounded. You would have written mine.',
    'I wrote it. Now we both know where we stand.'
  ],
  confrontVoteDeny: [
    'That was not me. Someone is feeding you bad information.',
    'You are mistaken. Check with someone who was actually watching.',
    'Me? No. Whoever told you that is playing you.'
  ],
  absolveWarm: [
    'You are... not going to hold it over me? Alright. Thank you.',
    'I did not expect that. I will not forget it either.',
    'That is more grace than I gave you. Consider me yours.',
    'Most people would have come at me. You did not.'
  ],
  absolveCynic: [
    'That is very generous. Almost too generous.',
    'Noted. Either you are decent or you cannot afford a fight.',
    'Sure. Water under the bridge.'
  ],
  markVoter: [
    'Understood. Then we both know how this ends.',
    'Fine. Come and get me.',
    'You just told the whole beach what you are doing. Bold.',
    'Good. I hate pretending.'
  ],
  protectYes: [
    '{n} of them wrote your name. Then {n} of them are my problem now.',
    'You have my word. They come through me first.',
    'I saw the reveal. I am not letting that happen twice.',
    'Stay close to me tonight. I mean it.'
  ],
  protectNo: [
    'That is your fire, not mine.',
    'I am not putting a target on my back for you.',
    'Ask me when we are actually something.'
  ],
  protectBetrayed: [
    'Ah. You saw my name on that, then.',
    'I was going to tell you. It was a numbers thing.',
    'Do not look at me like that. You survived, did you not?'
  ],

  shareOpen: [
    'Go on then. What have you got?',
    'This better be worth my time.',
    'Talk. Quietly.',
    'You have my attention.'
  ],
  warnBelieved: [
    'Wait — {sn} said my name? Out loud?',
    '{sn}. Right. I will remember that.',
    'I knew it. I could feel it coming from {sn}.',
    'Thank you. Genuinely. I will be watching {sn} now.'
  ],
  warnDoubted: [
    '{sn}, huh. Maybe. I will keep an ear out.',
    'I hear you. I am not sure I believe {sn} would.',
    'Could be. {sn} has been quiet with me lately.'
  ],
  warnCaught: [
    'No. {sn} would not say that, and you know it.',
    'Do not do that. Do not use me against {sn}.',
    'That is a lie. Why are you steering me at {sn}?',
    'You are trying to move me. It is not subtle.'
  ],
  lieCaught: [
    'That is not what happened and we both know it.',
    'Nice try. That story does not hold.',
    'You are lying to my face right now.'
  ],
  lieDoubted: [
    'Hm. If you say so.',
    'Maybe. That does not quite add up.',
    'Sure. I will file that under "we will see".'
  ],

  celebrateYes: [
    'We did that. {tn} never saw it coming.',
    'Did you see their face? That was clean.',
    'That was us. Nobody else even knew.',
    'Okay. Okay! {tn} is gone and we are still here.',
    'I wrote {tn}, you wrote {tn}. That is a partnership.',
    'Best night I have had on this island.'
  ],
  celebrateSour: [
    'You are enjoying this? {tn} was my friend.',
    'Don’t. I voted with you, I didn’t want a party about it.',
    'That was a hard vote for me. Read the room.',
    'We got the numbers. I’m not celebrating {tn} going home.'
  ],
  circleNoYou: [                 // the candidate doesn’t trust the PLAYER enough
    '{cand} doesn’t trust you enough for that yet. Spend time with them.',
    'Too soon. {cand} barely knows where you stand.',
    '{cand} isn’t ready to tie their game to yours.',
    'Get {cand} on side first. Then ask me again.'
  ],

  sttGood: [
    'That was... really nice, actually.',
    'Same time tomorrow? I mean it.',
    'This island is 2% less terrible with you around.',
    'Okay. You’re officially my favorite part of today.',
    'We should do this more. The scheming can wait an hour.',
    'I forgot to be paranoid for a whole hour. Impressive.'
  ],
  sttOk: [
    'Time well spent, I think.',
    'Not bad. Not bad at all.',
    'Alright. That was fine. I’m rusty at just... hanging out.',
    'Good talk. Mostly sitting, but good.',
    'You’re less annoying than advertised.',
    'That killed an hour. Kindly, even.'
  ],

  pushYes: [
    "Been thinking the same. {tn}'s a liability.",
    "Good read. Let's lock the numbers.",
    "I'll work the others. You hold your end.",
    'Finally someone says it out loud. {tn}. Tonight.',
    'You bring the plan, I bring two more votes. Deal.',
    '{tn} has been circling my name too. Yes. In.',
    'Say less. I was waiting for someone to move first.',
    'If this goes wrong it’s YOUR name in the story. But yes.',
    'Cold. Clean. {tn}. I like how you think.'
  ],
  pushNo: [
    '{tn}? Interesting. And why exactly do you want that?',
    "I hear you. I'm not committing to anything.",
    'You’re the third person selling me a name today.',
    'Maybe. Ask me again when the torches are lit.',
    'I’ll think about it. Which is not a yes. Or a no.',
    'And if I tell {tn} you said that... what happens?'
  ],

  seedCaught: [
    "Don't. I know exactly what that is.",
    "That's a plant. I'm not soil.",
    "Filed under: people who think I'm stupid.",
    'Subtle. Like a flare gun.',
    'I counted two moves ahead of that sentence.',
    'You do this to everyone, or am I special?',
    'Try that on someone who napped through the last tribal.',
    'Cute seed. Wrong garden.',
    'I’m going to pretend you asked about the weather.'
  ],
  seedTook: [
    'Huh. Now that you mention it, {tn} has been everywhere lately.',
    "I hadn't thought about {tn} like that. Hm.",
    'Weird. {tn} said something odd yesterday too...',
    'No, you’re right. Something’s off there.',
    'I’m not saying you’re right. I’m saying I’ll watch.',
    'Now I’m going to notice it everywhere. Thanks for that.'
  ],

  defendOk: [
    'Fair. {tn} has been pulling weight.',
    "Noted. I'll cool off on that.",
    'You vouching for {tn}? That actually counts for something.',
    'Alright. {tn} lives another day in my book.',
    'Loyalty looks good on you. Fine — {tn} gets a pass.',
    'Hm. If you trust {tn}, I can wait a vote.'
  ],

  rumorCaught: [
    "That's not what I'm hearing. At all.",
    'You just told me more about you than about them.',
    'I checked that story this morning. It has holes.',
    'Bold move, lying to the one person who fact-checks.',
    'And now I’m wondering what you say about ME.',
    'Save it for someone hungrier.'
  ],
  rumorChaos: [
    "Oh I'm DEFINITELY telling people. With embellishments.",
    'This is the best thing I’ve heard all week. Spreading it at dinner.',
    'I’ll add a dramatic pause and a gasp. Trust the process.'
  ],
  rumorSpread: [
    "Everyone's going to hear about {tn} by sundown.",
    'That... changes things.',
    'Wait, really? {tn}? I KNEW something was off.',
    'I’m keeping your name out of it. Probably.',
    'This stays between us and the six people I trust.',
    'Oh, {tn} is DONE when this gets around.'
  ],

  alignLoyal: [
    'You have my word.',
    'Loyalty starts here.',
    "Done. We're aligned.",
    'I don’t shake on things twice. One’s enough.',
    'Good. I’ve been waiting for someone worth backing.',
    'Then it’s us. Simple as that.',
    'I keep my people. Remember that.',
    'You point, I vote. Within reason.',
    'Say the word on tribal nights. I’ll be there.'
  ],
  alignStd: [
    "Okay. Let's see where this goes.",
    "I'm in — quietly.",
    'Us two? I can work with that.',
    'Fine. But we keep this off the beach.',
    'Deal. First sign of games, though, and I’m gone.',
    'Alright. Prove me right.',
    'Handshakes are cheap out here. Votes aren’t. Show me.',
    'Two is a start. Numbers win this game.',
    'I was going to ask you first, actually.'
  ],

  promiseOk: [
    'Next vote, we move together.',
    'A promise out here is currency. Don’t devalue it.',
    'One vote, together. Then we talk about the next one.',
    'I’ll write whatever name you need. Once.',
    'Sealed. Break it and we’re strangers.',
    'Okay. Tribal night, look at me before you walk up.'
  ],

  lockEmo: [
    "I'm crying. I'm actually crying. This is real.",
    'Nobody’s ever picked me first. For anything. Locked.',
    'Okay okay okay. Deep breath. Yes. To the end. I mean it.'
  ],
  lockStd: [
    'To the end, then.',
    "Locked. Don't ever make me regret this.",
    'Final two. Say it back... good. Now it’s real.',
    'This is the only deal I’m keeping sacred. Understood?',
    'Then we don’t blink. Whatever happens at that fire.',
    'You and me at the end. Everyone else is schedule.'
  ],
  lockRefuse: [
    'Not yet. Trust like that is earned, not asked for.',
    'Big words. Small track record. Keep earning.',
    'Ask me after you’ve kept one promise first.'
  ],

  observeStrategic: [
    'Watching everyone.', 'Always calculating.', 'Mapping alliances.',
    'Counting votes on their fingers when they think no one’s looking.',
    'Eyes flicking to whoever’s talking. Every time.',
    'Placing people like chess pieces.',
    'They clock every pair that walks off together.',
    'Too calm. That’s planning calm.',
    'They’ve already decided something. You can see it.'
  ],
  observeSocial: [
    'Works the whole camp like a room.',
    'Making everyone feel like the favorite. Textbook.',
    'They’ve had four one-on-ones today. Four.'
  ],
  observePhys: [
    'Built for challenges. Others notice too.',
    'Training when they think no one watches.',
    'The tribe eyes them at every immunity. Threat clock is ticking.'
  ],
  observeMorale: [
    'Spirit is cracking. Might be persuadable... or unpredictable.',
    'Staring at nothing a lot today. Homesick, or planning an exit.',
    'One bad tribal from giving up. Or from doing something wild.'
  ],
  observeTired: [
    'Running on empty.',
    'Fell asleep sitting up. Twice.',
    'Moving like the island owes them a bed.'
  ],
  observeGuarded: [
    'Keeps their cards close.',
    'Answers every question with a question.',
    'Friendly. Vague. Completely unreadable.'
  ],

  wander: [
    'You walk the shoreline and clear your head.',
    'The jungle hums. Somewhere, someone is scheming.',
    'You gather some firewood. Small deposits into the tribe bank.',
    'The ocean does not care about your alliance.',
    'You find footprints heading toward the rocks. Interesting.',
    'A crab watches you with what feels like judgment.',
    'You rehearse tonight’s conversation against a palm tree.',
    'The well rope is fraying. So is somebody’s patience.',
    'From the treeline you can see who’s talking to whom.',
    'You skip a stone. Four skips. The island allows it.',
    'Smoke from the fire pit bends toward the forest. So do the whispers.',
    'You pass the treemail post. Empty. For now.'
  ]
};
