/* ============================================================
   JUICE — the feel layer for challenge minigames (game-feel skill, DOM/CSS).

   Principles taken straight from the skill and translated to DOM:
     - one event = several tiny responses inside ~100ms
     - exaggerate BRIEFLY and return to rest; juice is transient
     - scale intensity to importance (small / medium / large tiers)
     - ease everything; overshoot for "pop", ease-out for "settle"
     - shake a WRAPPER, never the thing the game logic measures
     - shake from decaying trauma sampled with sin(), never rand-per-frame
     - hit-stop pauses the MINIGAME clock only, on a real-time timer
   ============================================================ */
const Juice = {
  _trauma: 0,
  _raf: null,
  _t: 0,
  el: null,                      // the wrapper we are allowed to move

  attach(el) { this.el = el; this._trauma = 0; this._t = 0; },
  detach() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    if (this.el) this.el.style.transform = '';
    this.el = null;
  },

  /* Hits ADD trauma; they never reset it. shake = trauma^2 so small events
     barely move the frame and big ones punch. */
  shake(amount) {
    this._trauma = Math.min(1, this._trauma + amount);
    if (!this._raf) this._loop(performance.now());
  },
  _loop(now) {
    if (!this.el) { this._raf = null; return; }
    const dt = Math.min(0.05, (now - (this._last || now)) / 1000);
    this._last = now;
    this._trauma = Math.max(0, this._trauma - 1.6 * dt);
    const s = this._trauma * this._trauma;
    if (s <= 0.0005) {
      this.el.style.transform = '';
      this._raf = null;
      return;
    }
    this._t += dt * 34;
    const x = 11 * s * Math.sin(this._t * 1.7);
    const y = 7 * s * Math.sin(this._t * 2.3);
    const r = 0.7 * s * Math.sin(this._t * 1.1);
    this.el.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${r.toFixed(2)}deg)`;
    this._raf = requestAnimationFrame(t => this._loop(t));
  },

  /* Squash then spring back past 1 and settle — the "pop". */
  pop(el, strength) {
    if (!el) return;
    const k = strength === undefined ? 1 : strength;
    el.style.transition = 'none';
    el.style.transform = `scale(${1 + 0.30 * k}, ${1 - 0.22 * k})`;
    void el.offsetWidth;
    el.style.transition = 'transform 190ms cubic-bezier(.2,1.6,.35,1)';
    el.style.transform = 'scale(1,1)';
  },

  /* A brief full-frame flash. Transient by construction. */
  flash(colour, ms) {
    if (!this.el) return;
    const f = h('div', 'cj-flash');
    f.style.background = colour || 'rgba(255,255,255,0.75)';
    f.style.animationDuration = (ms || 90) + 'ms';
    this.el.appendChild(f);
    setTimeout(() => f.remove(), (ms || 90) + 40);
  },

  /* A number/word that pops off the event and floats away. */
  float(el, text, cls) {
    if (!el || !this.el) return;
    const r = el.getBoundingClientRect(), w = this.el.getBoundingClientRect();
    const p = h('div', 'cj-float ' + (cls || ''), text);
    p.style.left = (r.left - w.left + r.width / 2) + 'px';
    p.style.top = (r.top - w.top) + 'px';
    this.el.appendChild(p);
    setTimeout(() => p.remove(), 900);
  },

  /* Cheap DOM particles: a handful of divs thrown outward on eased transforms. */
  burst(el, n, cls) {
    if (!el || !this.el) return;
    const r = el.getBoundingClientRect(), w = this.el.getBoundingClientRect();
    const cx = r.left - w.left + r.width / 2, cy = r.top - w.top + r.height / 2;
    for (let i = 0; i < (n || 6); i++) {
      const p = h('div', 'cj-part ' + (cls || ''));
      const a = (Math.PI * 2 * i) / (n || 6) + Math.random() * 0.5;
      const d = 22 + Math.random() * 26;
      p.style.left = cx + 'px'; p.style.top = cy + 'px';
      p.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'px');
      p.style.setProperty('--dy', (Math.sin(a) * d).toFixed(1) + 'px');
      this.el.appendChild(p);
      setTimeout(() => p.remove(), 620);
    }
  },

  /* Feedback bundles, so intensity stays proportional across all 20 games. */
  fx(el, tier, text) {
    if (tier === 'small') { this.pop(el, 0.5); this.shake(0.10); }
    else if (tier === 'medium') { this.pop(el, 1); this.shake(0.32); this.burst(el, 6); }
    else if (tier === 'large') { this.pop(el, 1.3); this.shake(0.70); this.burst(el, 14); this.flash('rgba(255,255,255,0.55)', 80); }
    else if (tier === 'bad') { this.shake(0.45); this.flash('rgba(201,79,61,0.45)', 130); }
    if (text) this.float(el, text, tier === 'bad' ? 'bad' : '');
  }
};
