/* Run the whole harness suite and print one summary.

   Each harness launches its own headless Chrome. Run back to back they
   occasionally collide on a port or trip over a Chrome that has not finished
   exiting, and the failure looks identical to a real one — which has cost real
   time more than once. So: a gap between runs, and ONE retry on failure. A suite
   that fails twice in a row is a genuine failure; a suite that fails once and then
   passes was infrastructure, and the summary says which it was.

   Usage:
     node tools/run-all.js            all suites
     node tools/run-all.js camp tribe just the ones whose names match
*/
const { spawn } = require('child_process');
const path = require('path');

const SUITES = [
  'smoke', 'tribe-test', 'endgame-test', 'survival-test', 'camp-test',
  'camp-ui-test', 'evac-test', 'minigame-test', 'dilemma-test', 'voice-test',
  'tap-test', 'log-export-test', 'maroon-flow-test', 'brief-size-test',
  'condition-test', 'circle-meeting-test', 'chal-rails-test', 'chal-result-look',
  'tribal-test', 'reward-test', 'social-test', 'splash-test',
  'howto-test', 'howto-live', 'logaccess-test', 'maze-speed', 'tribalqa-test', 'island3d-test', 'chal-fair'
];

const filters = process.argv.slice(2);
const chosen = filters.length
  ? SUITES.filter(s => filters.some(f => s.includes(f)))
  : SUITES;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function run(name) {
  return new Promise(resolve => {
    const p = spawn(process.execPath, [path.join(__dirname, name + '.js')], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', d => out += d);
    p.stderr.on('data', d => out += d);
    p.on('close', code => resolve({ code, out }));
    /* No suite should take more than eight minutes; kill it if it does. */
    setTimeout(() => { try { p.kill(); } catch { } }, 8 * 60 * 1000);
  });
}

/* The verdict line every harness prints. */
function verdict(out) {
  const m = out.match(/^[A-Z][A-Z ]+(PASS|FAIL)$/m);
  return m ? m[0] : null;
}
function failedChecks(out) {
  const m = out.match(/^failing checks: (.*)$/m);
  return m ? m[1] : null;
}

(async () => {
  console.log(`running ${chosen.length} suite(s)\n`);
  const results = [];
  for (const name of chosen) {
    process.stdout.write(name.padEnd(20));
    let r = await run(name);
    let retried = 0;
    /* Two retries with a widening gap. A run of thirty headless Chromes puts the
       machine under real pressure and the boot itself starts failing — which looks
       exactly like a broken build. Two consecutive infra failures are common
       enough to be worth absorbing; three are not. */
    while (r.code !== 0 && retried < 2) {
      retried++;
      process.stdout.write('retry' + retried + '… ');
      await sleep(9000 * retried);
      r = await run(name);
    }
    const v = verdict(r.out);
    const fc = failedChecks(r.out);
    const ok = r.code === 0;
    console.log((ok ? 'PASS' : 'FAIL')
      + (retried ? (ok ? `  (infra flake, passed on retry ${retried})` : `  (failed ${retried + 1} times)`) : '')
      + (fc && !ok ? '\n    failing checks: ' + fc : '')
      + (!v && !ok ? '\n    no verdict line — the harness crashed:\n'
        + r.out.split('\n').filter(l => l.trim()).slice(-4).map(l => '      ' + l).join('\n') : ''));
    results.push({ name, ok, retried, out: r.out });
    await sleep(11000);
  }

  const bad = results.filter(r => !r.ok);
  const flaky = results.filter(r => r.ok && r.retried);
  console.log('\n' + '-'.repeat(52));
  console.log(`${results.length - bad.length}/${results.length} passed`
    + (flaky.length ? `, ${flaky.length} needed a retry (${flaky.map(f => f.name).join(', ')})` : ''));
  if (bad.length) console.log('FAILED: ' + bad.map(b => b.name).join(', '));
  process.exit(bad.length ? 1 : 0);
})();
