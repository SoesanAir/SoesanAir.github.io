/* Which CONFIG keys are wired to anything?
   A knob that is defined but never read is worse than a missing knob: it invites
   you to tune it, silently does nothing, and you conclude the system is
   unresponsive. Run this before trusting any lever.

   Run: node tools/config-audit.js */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'js');
const data = fs.readFileSync(path.join(dir, 'data.js'), 'utf8');

/* Take only the CONFIG object literal, not DIALOGUE or the line pools. */
const start = data.indexOf('const CONFIG = {');
let depth = 0, end = start;
for (let i = data.indexOf('{', start); i < data.length; i++) {
  if (data[i] === '{') depth++;
  else if (data[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
}
const configSrc = data.slice(start, end + 1);

/* Top-level keys only: exactly two spaces of indent inside the literal. */
const keys = [];
for (const line of configSrc.split('\n')) {
  const m = /^ {2}([A-Za-z][A-Za-z0-9_]*)\s*:/.exec(line);
  if (m) {
    keys.push({
      name: m[1],
      note: line,
      value: line.split(':').slice(1).join(':').replace(/,\s*(\/\/.*)?$/, '').trim()
    });
  }
}

const all = fs.readdirSync(dir).filter(f => f.endsWith('.js'))
  .map(f => ({ f, src: fs.readFileSync(path.join(dir, f), 'utf8') }));

const rows = keys.map(k => {
  const needle = 'CONFIG.' + k.name;
  const users = all.filter(x => {
    let i = 0;
    while ((i = x.src.indexOf(needle, i)) !== -1) {
      /* Reject CONFIG.campDrainScaleFoo when looking for campDrainScale. */
      const after = x.src[i + needle.length];
      if (!after || !/[A-Za-z0-9_]/.test(after)) return true;
      i += needle.length;
    }
    return false;
  }).map(x => x.f);
  return { ...k, users };
});

/* A key can be legitimately unread: a documented reference value, or something a
   later system superseded. Annotate those in data.js with "reference only" or
   "superseded" and they stop being noise, so everything printed below is real. */
const EXCUSED = /reference only|superseded/i;
const dead = rows.filter(r => !r.users.length && !EXCUSED.test(r.note));
const excused = rows.filter(r => !r.users.length && EXCUSED.test(r.note));
const live = rows.filter(r => r.users.length);

console.log(`CONFIG has ${rows.length} keys · ${live.length} wired · `
  + `${excused.length} annotated as not-a-lever · ${dead.length} DEAD\n`);
if (dead.length) {
  console.log('DEAD — defined in data.js, never read anywhere:');
  const w = Math.max(...dead.map(d => d.name.length));
  for (const d of dead) console.log('  ' + d.name.padEnd(w + 2) + '= ' + d.value);
  console.log('\nEach of these is a knob that looks tunable and does nothing. Either wire');
  console.log('it, delete it, or annotate it "reference only" / "superseded".');
} else {
  console.log('Every CONFIG key is either read by something or annotated as not a lever.');
}
if (excused.length) {
  console.log('\nAnnotated as not-a-lever: ' + excused.map(e => e.name).join(', '));
}
process.exit(dead.length ? 1 : 0);
