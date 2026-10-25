// Hook Stop: prima di chiudere il lavoro controlla che, se sono cambiati file dell'app rispetto a origin/main,
// sia cambiata anche VERSION in sw.js. Senza, sull'iPhone non compare "Nuova versione disponibile → Aggiorna".
// Se manca, chiede a Claude di continuare (decision: block) con il motivo; non insiste una seconda volta.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let input = '';
for await (const chunk of process.stdin) input += chunk;
let j = {};
try { j = JSON.parse(input || '{}'); } catch {}
if (j.stop_hook_active) process.exit(0); // già avvisato in questo giro: evito di bloccare all'infinito

const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const APP = /^(index\.html|style\.css|app\.js|cloud\.js|manifest\.webmanifest|zxing\.min\.js|[\w-]*icon[\w-]*\.png)$/;
const version = text => (/const VERSION = "([^"]+)"/.exec(text) || [])[1];

try {
  git('rev-parse', '--verify', '--quiet', 'origin/main');
  // Committati e non committati, rispetto a quello che è pubblicato
  const changed = [...new Set([...git('diff', '--name-only', 'origin/main').split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')])].filter(f => APP.test(f));
  if (!changed.length) process.exit(0);
  const now = version(readFileSync(join(dir, 'sw.js'), 'utf8')); // la versione sul disco, anche se non ancora committata
  const published = version(git('show', 'origin/main:sw.js'));
  if (now && published && now === published) {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `Sono cambiati file dell'app (${changed.join(', ')}) ma VERSION in sw.js è ancora ${now}, come su main. Incrementala (regola in CLAUDE.md), altrimenti sull'iPhone non compare "Aggiorna".`
    }));
  }
} catch { /* senza git o senza origin/main non controllo nulla */ }
