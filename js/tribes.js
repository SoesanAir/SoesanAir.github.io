/* ============================================================
   TRIBES — colour as identity.

   On the show a tribe IS its colour. You know who is who from a wide shot because
   everybody is wearing the same buff, and that reading survives a bad camera
   angle, a night shoot and a viewer who is not paying attention.

   The game had two tribe names and one tinted HUD chip. So this exists to make
   tribe a first-class piece of the art direction rather than a string.

   ---- the two rules that shaped it ----

   1. COLOUR IS NEVER THE ONLY CHANNEL. Every tribe carries a colour AND a mark,
      and the two always travel together. That is the colour-blind answer, and it
      is also more Survivor — tribes have emblems, not just dye. About one man in
      twelve cannot separate the orange from the plum reliably; all of them can
      separate a flame from a sun.

   2. THE TRIBE COLOUR IS THE ONLY SATURATED THING ON A CASTAWAY. The rest of the
      game is ink on cream paper, deliberately muted. A buff reads as a band of
      real dye against that, which is exactly how it reads on the show. Wash a
      whole figure in tribe colour and the paper-and-ink identity goes with it.

   Tidal blue against Ember orange is also the strongest pair available for
   colour vision deficiency — they differ in hue AND in luminance, so they stay
   apart under every common form of it. Solara is only ever on screen after the
   other two are gone, so it never has to be told apart from either.
   ============================================================ */

'use strict';

const TRIBES = {
  Tidal: {
    name: 'Tidal',
    /* Deep enough to carry white text, blue enough to read as water. */
    color: '#2F7C97',
    light: '#8FCBDD',
    ink: '#10333F',
    on: '#F4EFE0',          // text colour that sits on `color`
    mark: '≈',         // ≈  a wave
    emblem: 'wave'
  },
  Ember: {
    name: 'Ember',
    color: '#D9762C',
    light: '#F2B47A',
    ink: '#5E2E0C',
    on: '#241638',          // dark text on orange, which needs it
    mark: '▲',         // ▲  a flame
    emblem: 'flame'
  },
  Solara: {
    name: 'Solara',
    /* The merge buff. A third hue that is nobody's starting colour, so the merge
       reads as a genuine change of state rather than one tribe absorbing another. */
    color: '#8A4A82',
    light: '#C99BC2',
    ink: '#3A1B36',
    on: '#F4EFE0',
    mark: '✦',         // ✦  a sun
    emblem: 'sun'
  }
};

const DEFAULT_TRIBE = TRIBES.Tidal;
const tribeInfo = name => TRIBES[name] || DEFAULT_TRIBE;
const tribeOf = c => tribeInfo(c && c.tribeName);
/* The two-channel label: never the colour on its own. */
const tribeLabel = name => {
  const t = tribeInfo(name);
  return t.mark + ' ' + t.name;
};

const Tribes = {
  /* Paint a node as belonging to a tribe. Sets both the data attribute (which the
     CSS hangs off) and the custom properties, so any element can use
     var(--t-color) without knowing which tribe it is. */
  mark(el, name) {
    if (!el) return el;
    const t = tribeInfo(name);
    el.dataset.tribe = t.name;
    el.style.setProperty('--t-color', t.color);
    el.style.setProperty('--t-light', t.light);
    el.style.setProperty('--t-ink', t.ink);
    el.style.setProperty('--t-on', t.on);
    return el;
  },
  /* A chip that says which tribe, in colour and in mark. */
  chip(name, extra) {
    const t = tribeInfo(name);
    const el = h('span', 'chip tribe-chip ' + (extra || ''), tribeLabel(name));
    return this.mark(el, t.name);
  },
  /* A flag planted beside the tribe.

     The first attempt at this put a coloured band across each castaway's middle.
     On a figure that is fifty pixels tall that does not read as a buff, it reads
     as a bum bag — so the colour comes off the body entirely and goes onto
     something standing in the ground next to them, which is also how a camp
     actually gets marked. */
  flag(name, extra) {
    const t = tribeInfo(name);
    const f = h('div', 'tribe-flag ' + (extra || ''));
    const pole = h('div', 'tf-pole');
    const cloth = h('div', 'tf-cloth');
    cloth.appendChild(h('span', 'tf-mark', t.mark));
    f.appendChild(cloth);
    f.appendChild(pole);
    return this.mark(f, t.name);
  },
  info: tribeInfo,
  of: tribeOf,
  label: tribeLabel,
  /* Which tribes are actually on the island right now. */
  live() {
    if (typeof GAME === 'undefined' || !GAME.cast) return ['Tidal', 'Ember'];
    const set = new Set(alive().map(c => c.tribeName));
    return [...set].filter(n => TRIBES[n]);
  }
};
