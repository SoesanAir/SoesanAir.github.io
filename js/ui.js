/* ============================================================
   CASTAWAY — ui.js
   Screen stack, toasts, modal, and the sprite recolor factory
   (6 base bodies -> 18 unique castaways via skin + outfit tint)
   ============================================================ */

'use strict';

/* ---------------- Event bus (HUD is event-driven, never polled) ---------------- */
const Bus = {
  _subs: {},
  on(evt, fn) { (this._subs[evt] = this._subs[evt] || []).push(fn); },
  emit(evt, data) { (this._subs[evt] || []).forEach(fn => fn(data)); }
};

/* ---------------- Screen stack ---------------- */
const Screens = {
  stack: [],
  current() { return this.stack[this.stack.length - 1] || null; },
  _apply() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const top = this.current();
    if (top) document.getElementById(top).classList.add('active');
  },
  replace(id) { this.stack = [id]; this._apply(); },
  push(id) { this.stack.push(id); this._apply(); },
  pop() { if (this.stack.length > 1) this.stack.pop(); this._apply(); }
};

/* ---------------- Toast ---------------- */
function toast(msg) {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 2900);
}

/* ---------------- Modal ---------------- */
const Modal = {
  open(title, bodyHTML) {
    document.getElementById('modal-title').textContent = title;
    const body = document.getElementById('modal-body');
    if (typeof bodyHTML === 'string') body.innerHTML = bodyHTML;
    else { body.innerHTML = ''; body.appendChild(bodyHTML); }
    document.getElementById('modal-veil').classList.add('open');
  },
  close() { document.getElementById('modal-veil').classList.remove('open'); }
};
document.getElementById('modal-close').addEventListener('click', () => Modal.close());
document.getElementById('modal-veil').addEventListener('click', e => {
  if (e.target.id === 'modal-veil') Modal.close();
});

/* ============================================================
   Sprite recolor factory.
   The 6 master bodies share one mid-tone skin + grey outfit.
   We classify pixels by HSL and retarget:
     - skin (orange hues)   -> one of the skin tones
     - outfit (grey, low-sat, mid-light) -> castaway's outfit color
   Outlines/hair (near-black) and highlights are left alone.
   Results cached per (body, skin, outfit) as dataURLs.
   ============================================================ */
const SpriteFactory = (() => {
  const cache = new Map();
  const rawImages = new Map();

  const BODY_FILES = {
    male_skinny: 'assets/bodies/male_skinny.png',
    male_muscular: 'assets/bodies/male_muscular.png',
    male_curvy: 'assets/bodies/male_curvy.png',
    female_skinny: 'assets/bodies/female_skinny.png',
    female_muscular: 'assets/bodies/female_muscular.png',
    female_curvy: 'assets/bodies/female_curvy.png'
  };

  // Skin tones: [hueShift, satMult, lightMult] applied to the base orange skin
  const SKIN_TONES = [
    { name: 'porcelain', h: +2, s: 0.55, l: 1.22 },
    { name: 'fair',      h: +1, s: 0.75, l: 1.12 },
    { name: 'tan',       h: 0,  s: 1.0,  l: 1.0  },   // as drawn
    { name: 'bronze',    h: -2, s: 1.05, l: 0.86 },
    { name: 'brown',     h: -4, s: 0.95, l: 0.68 },
    { name: 'deep',      h: -6, s: 0.85, l: 0.52 }
  ];

  // Outfit palette — harmonious with the day palette, high mutual contrast
  const OUTFITS = [
    '#5BAEE8', '#4A8F5F', '#E8873A', '#C94F3D', '#8E6FC4', '#E0A63C',
    '#7AC4D8', '#D46A9B', '#6B4A2E', '#4E6E8E', '#A6B84A', '#E8CC8E'
  ];

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return [h * 360, s, l];
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    s = Math.min(1, Math.max(0, s));
    l = Math.min(1, Math.max(0, l));
    if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = t => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
  }

  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      /* An image error event is a useless rejection value — it stringifies to
         "[object Event]" and tells you nothing about which file failed. */
      img.onerror = () => rej(new Error('image failed to load: ' + src));
      img.src = src;
    });
  }

  /* One body image failing used to take the whole season with it: buildAllSprites
     awaited this in a loop, the rejection propagated into beginSeason, and the
     player was left sitting on the creation screen with no error and no way
     forward. So: retry once past the cache, and cache the PROMISE rather than the
     resolved image, so concurrent callers share one load and a failure does not
     leave a poisoned entry behind. */
  function getRaw(bodyKey) {
    if (!rawImages.has(bodyKey)) {
      const src = BODY_FILES[bodyKey];
      const attempt = loadImage(src).catch(() => loadImage(src + '?retry=1'));
      rawImages.set(bodyKey, attempt);
      attempt.catch(() => rawImages.delete(bodyKey));   // let a later call try again
    }
    return rawImages.get(bodyKey);
  }

  /** Returns a dataURL of the recolored body sprite. */
  async function get(bodyKey, skinIdx, outfitIdx) {
    const key = `${bodyKey}|${skinIdx}|${outfitIdx}`;
    if (cache.has(key)) return cache.get(key);

    const img = await getRaw(bodyKey);
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const data = cx.getImageData(0, 0, cv.width, cv.height);
    const px = data.data;

    const tone = SKIN_TONES[skinIdx % SKIN_TONES.length];
    const outfitHex = OUTFITS[outfitIdx % OUTFITS.length];
    const or = parseInt(outfitHex.slice(1, 3), 16),
          og = parseInt(outfitHex.slice(3, 5), 16),
          ob = parseInt(outfitHex.slice(5, 7), 16);
    const [oh, os, ol] = rgbToHsl(or, og, ob);

    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 40) continue;                       // transparent
      const [h, s, l] = rgbToHsl(px[i], px[i + 1], px[i + 2]);
      if (l < 0.16) continue;                              // outline / hair / eyes — keep
      const isSkin = h >= 12 && h <= 48 && s > 0.28 && l > 0.3 && l < 0.85;
      const isGrey = s < 0.14 && l >= 0.25 && l <= 0.88;   // outfit + shoes
      if (isSkin) {
        const [r2, g2, b2] = hslToRgb(h + tone.h, s * tone.s, l * tone.l);
        px[i] = r2; px[i + 1] = g2; px[i + 2] = b2;
      } else if (isGrey) {
        // colorize: take outfit hue/sat, keep the sprite's shading (luminance)
        const [r2, g2, b2] = hslToRgb(oh, os * 0.85, l * (0.55 + ol * 0.55));
        px[i] = r2; px[i + 1] = g2; px[i + 2] = b2;
      }
    }
    cx.putImageData(data, 0, 0);
    const url = cv.toDataURL();
    cache.set(key, url);
    return url;
  }

  return { get, SKIN_TONES, OUTFITS, BODY_FILES };
})();

/* ---------------- Feed rendering ---------------- */
const Feed = {
  el: null,
  collapsed: false,
  unread: 0,
  urgent: false,
  KEY: 'castaway_log_min',
  init() {
    this.el = document.getElementById('feed');
    try { this.setCollapsed(localStorage.getItem(this.KEY) === '1', true); } catch { /* private mode */ }
  },

  /* Collapsed, the log is one line; expanding it means the player has seen
     everything, so the unread flicker is cleared. */
  setCollapsed(on, silent) {
    this.collapsed = !!on;
    const main = document.getElementById('camp-main');
    if (main) main.classList.toggle('log-min', this.collapsed);
    const btn = document.getElementById('btn-feed-min');
    if (btn) btn.innerHTML = '&minus;';
    if (!this.collapsed) this.markRead();
    if (!silent) { try { localStorage.setItem(this.KEY, this.collapsed ? '1' : '0'); } catch { } }
  },
  toggle() { this.setCollapsed(!this.collapsed); },

  markRead() {
    this.unread = 0; this.urgent = false;
    const panel = document.getElementById('log-panel');
    if (panel) panel.classList.remove('unread', 'urgent');
    const c = document.getElementById('feed-unread');
    if (c) c.classList.add('hidden');
  },

  /* Newest line always mirrored into the ticker, so collapsing shows current
     state rather than whatever was there when it was last collapsed. */
  _ticker(text, mine, kind) {
    const t = document.getElementById('feed-ticker-text');
    if (t) t.textContent = text;
    if (!this.collapsed) return;
    this.unread++;
    if (mine || kind === 'danger') this.urgent = true;
    const panel = document.getElementById('log-panel');
    if (panel) { panel.classList.add('unread'); panel.classList.toggle('urgent', this.urgent); }
    const c = document.getElementById('feed-unread');
    if (c) { c.textContent = this.unread > 99 ? '99+' : this.unread; c.classList.remove('hidden'); }
  },
  /* Entries that mention the player get a YOU tag + stronger accent,
     and the Camp Log's All/You toggle can filter down to just them. */
  _mine(text) {
    try {
      if (typeof GAME === 'undefined' || !GAME.player) return false;
      if (/\byou\b|\byour\b|\byours\b/i.test(text)) return true;
      const dn = GAME.player.displayName;
      return !!dn && text.includes(dn);
    } catch { return false; }
  },
  post(text, kind, day) {
    if (!this.el) this.init();
    const mine = this._mine(text);
    const item = document.createElement('div');
    item.className = 'feed-item' + (kind ? ' ' + kind : '') + (mine ? ' me' : '');
    const d = document.createElement('span');
    d.className = 'feed-day';
    d.textContent = day ? `D${day}` : '';
    item.appendChild(d);
    if (mine) {
      const tag = document.createElement('span');
      tag.className = 'feed-you';
      tag.textContent = 'You';
      item.appendChild(tag);
    }
    item.appendChild(document.createTextNode(text));
    this.el.prepend(item);
    while (this.el.children.length > 60) this.el.lastChild.remove();
    this._ticker(text, mine, kind);
  },
  clear() { if (!this.el) this.init(); this.el.innerHTML = ''; this.markRead(); }
};

/* ---------------- Typewriter for dialogue ---------------- */
function typeText(el, text, speed = 14) {
  el.textContent = '';
  let i = 0;
  return new Promise(res => {
    const t = setInterval(() => {
      el.textContent = text.slice(0, ++i);
      if (i >= text.length) { clearInterval(t); res(); }
    }, speed);
    el.onclick = () => { clearInterval(t); el.textContent = text; el.onclick = null; res(); };
  });
}

/* ---------------- Small helpers ---------------- */
function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function pct(x) { return Math.round(x * 100) + '%'; }
