/* The full minigame library, assembled from the per-file batches.

   This lives in its own file rather than at the bottom of the last game file,
   which is where it used to be. With four more batches added that arrangement
   breaks the moment a new file loads AFTER the concat — the array would silently
   be missing five games and the only symptom would be challenges quietly falling
   back to something else. One file whose entire job is the assembly, loaded after
   all of them and before the shell, cannot go wrong that way.

     A  physical (7)      D  endurance (5)
     B  mental (8)        E  balance and precision (5)
     C  nerve/social (5)  F  strength and physical nerve (5)
                          G  memory, deduction and nerve (5)
*/
const MINIGAMES = [].concat(
  MINIGAMES_A, MINIGAMES_B, MINIGAMES_C,
  MINIGAMES_D, MINIGAMES_E, MINIGAMES_F, MINIGAMES_G
);

/* A duplicate id means Challenge.MAP silently resolves to whichever came first,
   which is exactly the class of bug that produced "the description says one thing
   and the minigame says another". Cheap to check at boot, so check at boot. */
(function auditMinigames() {
  const seen = new Map();
  for (const g of MINIGAMES) {
    if (seen.has(g.id)) {
      DBG.log('system', `DUPLICATE MINIGAME ID "${g.id}" — "${g.name}" collides with "${seen.get(g.id)}"`);
    }
    seen.set(g.id, g.name);
  }
  DBG.log('system', `${MINIGAMES.length} minigames loaded, ${seen.size} distinct ids`);
})();
