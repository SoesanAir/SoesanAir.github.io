/* ============================================================
   TELEMETRY — getting the season log off the phone.

   The log lived in localStorage and the only ways out were "copy to clipboard"
   and "download a .txt". On a phone, mid-season, that is not a route to anybody
   who could read it. So the game now publishes itself.

   Two destinations, because neither is good enough alone:

   GIST (primary, durable, private)
     A secret GitHub gist, updated at the end of every day and again when the
     season ends. Keeps the FULL report forever.
     Needs a token — and the token lives in localStorage on the device and is
     NEVER committed. That distinction matters: this site is served from a public
     repo, so a token in the source would be public, would be found, and would be
     revoked by GitHub's secret scanning within the hour.

   NTFY (fallback, zero setup, ephemeral)
     ntfy.sh takes an anonymous POST from a browser and keeps it for about twelve
     hours, readable at https://ntfy.sh/<topic>/json?poll=1. No account, nothing
     to configure, works the first time you open the game. Publishes the BRIEF
     report only — the public server caps a message at 4KB.
     Worth being plain about: an ntfy topic is public to anyone who knows its
     name. Nothing here but game telemetry and whatever name you typed, but it is
     not private, and it is one tap to turn off.

   Everything is best-effort. A failed upload must never interrupt play, so every
   path swallows its errors into a status line and moves on.
   ============================================================ */

'use strict';

const NTFY_TOPIC = 'castaway-devlog-soesanair';
const NTFY_MAX = 3900;                 // the public server rejects past 4KB

const Telemetry = {
  KEY: 'castaway_telemetry_v1',
  cfg: { token: '', gistId: '', ntfy: true, auto: true },
  status: { gist: 'not set up', ntfy: 'idle', lastAt: 0, lastKind: '' },
  _busy: false,

  load() {
    try {
      const d = JSON.parse(localStorage.getItem(this.KEY));
      if (d) Object.assign(this.cfg, d);
    } catch { /* private mode */ }
    if (this.cfg.token) this.status.gist = this.cfg.gistId ? 'ready' : 'ready (no gist yet)';
  },
  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.cfg)); } catch { /* quota */ }
  },
  configured() { return !!this.cfg.token; },
  gistUrl() { return this.cfg.gistId ? 'https://gist.github.com/' + this.cfg.gistId : ''; },
  rawUrl() { return this.cfg.gistId ? `https://gist.githubusercontent.com/raw/${this.cfg.gistId}` : ''; },
  ntfyUrl() { return 'https://ntfy.sh/' + NTFY_TOPIC; },

  filename() {
    const p = GAME.player;
    return `castaway-s${GAME.seasonSeed || 0}-${p ? p.name.replace(/[^A-Za-z0-9]/g, '') : 'nobody'}.txt`;
  },

  /* ---------- GitHub gist ----------
     One gist per season, PATCHed in place, so the history is one URL rather than
     a new link every day. */
  async toGist(body, note) {
    if (!this.cfg.token) return { ok: false, msg: 'no token' };
    const headers = {
      'Authorization': 'Bearer ' + this.cfg.token,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };
    const files = {}; files[this.filename()] = { content: body };
    try {
      let r;
      if (this.cfg.gistId) {
        r = await fetch('https://api.github.com/gists/' + this.cfg.gistId,
          { method: 'PATCH', headers, body: JSON.stringify({ description: note, files }) });
        /* The gist was deleted, or the token changed. Make a new one. */
        if (r.status === 404) { this.cfg.gistId = ''; this.save(); }
      }
      if (!this.cfg.gistId) {
        r = await fetch('https://api.github.com/gists',
          { method: 'POST', headers, body: JSON.stringify({ description: note, public: false, files }) });
      }
      if (!r.ok) {
        const txt = (await r.text()).slice(0, 120);
        this.status.gist = `HTTP ${r.status} — ${r.status === 401 ? 'token rejected' : txt}`;
        return { ok: false, msg: this.status.gist };
      }
      const j = await r.json();
      if (j.id && j.id !== this.cfg.gistId) { this.cfg.gistId = j.id; this.save(); }
      this.status.gist = 'uploaded ' + new Date().toISOString().slice(11, 16);
      return { ok: true, url: this.gistUrl() };
    } catch (e) {
      this.status.gist = 'network: ' + String(e.message || e).slice(0, 60);
      return { ok: false, msg: this.status.gist };
    }
  },

  /* ---------- ntfy ----------

     THE HEADER MUST BE ASCII. This is not defensive tidiness — it is the bug that
     silently destroyed the entire telemetry pipeline.

     HTTP header values are ISO-8859-1. A JS string containing any code point above
     255 makes fetch throw before a single byte leaves the browser:

       new Headers({ Title: 'Castaway d21 — lost' })
         -> TypeError: String contains non ISO-8859-1 code point

     Every title this file built used an em-dash ("Castaway d21 — lost", "Castaway
     archive — ..."), so EVERY push failed, every day, in every season. The failure
     was invisible from the outside because toNtfy catches its own errors into a
     status line by design: the log just read "ntfy network: Type error" and the
     topic stayed empty, which is indistinguishable from "nothing was ever sent".

     Sanitising here rather than at the call sites means a caller cannot bring it
     back by writing a nicer dash. */
  asciiHeader(s) {
    return String(s == null ? '' : s)
      .replace(/[‒-―−]/g, '-')       // dashes of every width
      .replace(/[‘’‛]/g, "'")        // curly single quotes
      .replace(/[“”]/g, '"')              // curly double quotes
      .replace(/…/g, '...')                    // ellipsis
      /* Anything still outside printable ASCII goes, including the accented names
         the generator produces — a castaway called Zoë must not break the upload. */
      .replace(/[^\x20-\x7E]/g, '')
      .slice(0, 200)
      .trim() || 'Castaway';
  },

  async toNtfy(body, title) {
    if (!this.cfg.ntfy) return { ok: false, msg: 'off' };
    try {
      const r = await fetch(this.ntfyUrl(), {
        method: 'POST',
        headers: { 'Title': this.asciiHeader(title), 'Tags': 'castaway' },
        body: body.length > NTFY_MAX ? body.slice(0, NTFY_MAX) + '\n...(truncated)' : body
      });
      if (!r.ok) { this.status.ntfy = 'HTTP ' + r.status; return { ok: false, msg: this.status.ntfy }; }
      this.status.ntfy = 'sent ' + new Date().toISOString().slice(11, 16);
      return { ok: true };
    } catch (e) {
      this.status.ntfy = 'network: ' + String(e.message || e).slice(0, 60);
      return { ok: false, msg: this.status.ntfy };
    }
  },

  /* ---------- keeping finished seasons ----------
     ntfy holds a message for about twelve hours. A season played last night and
     asked about this morning is simply gone, and "Send now" only ever sent the
     CURRENT state — so once the season ended there was nothing left to send at
     all. That happened: a season was played, discussed the next day, and there was
     nothing to look at.

     Finished seasons are archived on the device now and can be resent whenever,
     which makes the twelve-hour window stop mattering. */
  AKEY: 'castaway_reports_v1',
  KEEP: 3,

  archived() {
    try { return JSON.parse(localStorage.getItem(this.AKEY)) || []; } catch { return []; }
  },
  archive(brief, full) {
    const P = GAME.player;
    if (!P) return;
    const entry = {
      at: new Date().toISOString().slice(0, 16).replace('T', ' '),
      seed: GAME.seasonSeed, day: GAME.day,
      who: P.displayName,
      outcome: Report.outcome(),
      brief, full
    };
    let list = this.archived().filter(e => e.seed !== entry.seed);
    list.push(entry);
    while (list.length > this.KEEP) list.shift();
    try {
      localStorage.setItem(this.AKEY, JSON.stringify(list));
    } catch {
      /* Quota. The brief is the part that matters; drop the full reports and
         retry rather than losing the archive entirely. */
      try {
        localStorage.setItem(this.AKEY, JSON.stringify(list.map(e => ({ ...e, full: '' }))));
      } catch { /* give up quietly, this must never break play */ }
    }
    DBG.log('system', `Archived season ${entry.seed} (${entry.outcome}); ${list.length} kept`);
  },
  /* Republish an archived season on demand. */
  async resend(seed) {
    const e = this.archived().find(x => x.seed === seed);
    if (!e) return { ok: false, msg: 'not archived' };
    const note = `Castaway ARCHIVE · seed ${e.seed} · day ${e.day} · ${e.who} · ${e.outcome}`;
    await this.toNtfy('[archived ' + e.at + ']\n' + e.brief, 'Castaway archive — ' + e.outcome);
    if (this.cfg.token && e.full) await this.toGist(e.full, note);
    return { ok: true };
  },

  /* ---------- the one call the game makes ----------
     kind: 'day' | 'season' | 'manual'. Never throws, never blocks. */
  async push(kind) {
    if (!this.cfg.auto && kind !== 'manual') return;
    if (this._busy) return;
    if (!GAME.player) return;
    this._busy = true;
    try {
      const p = GAME.player;
      const note = `Castaway ${kind} · seed ${GAME.seasonSeed} · day ${GAME.day} · ${p.displayName} · ${Report.outcome()}`;
      const brief = Report.brief();
      const full = Report.full();
      /* Keep the finished article on the device before trying to send it, so a
         failed upload or an expired message is recoverable. */
      if (kind === 'season') this.archive(brief, full);
      /* The brief goes to ntfy every day; the full report goes to the gist. */
      await this.toNtfy(brief, `Castaway d${GAME.day} — ${Report.outcome()}`);
      if (this.cfg.token) await this.toGist(full, note);
      this.status.lastAt = Date.now();
      this.status.lastKind = kind;
      DBG.log('system', `Telemetry ${kind}: gist ${this.status.gist} · ntfy ${this.status.ntfy}`);
    } catch (e) {
      DBG.log('system', 'Telemetry failed: ' + (e.message || e));
    } finally {
      this._busy = false;
    }
  },

  /* Fire and forget from the day loop. */
  ping(kind) { try { this.push(kind); } catch { /* never block play */ } },

  /* ---------- setup ---------- */
  setToken(tok) {
    this.cfg.token = String(tok || '').trim();
    this.cfg.gistId = '';                 // a new token means a new gist
    this.save();
    this.status.gist = this.cfg.token ? 'ready (no gist yet)' : 'not set up';
  },
  forget() {
    this.cfg.token = ''; this.cfg.gistId = '';
    this.save();
    this.status.gist = 'not set up';
  },
  /* A token page with the right scope already ticked, so this is three taps on a
     phone instead of a hunt through settings. */
  tokenPageUrl() {
    return 'https://github.com/settings/tokens/new?scopes=gist&description=Castaway%20dev%20log';
  }
};
