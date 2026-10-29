// Hook PreToolUse (Bash, solo per `git push`): prima di pubblicare su main lancia `node test/run.mjs`.
// Se un test fallisce nega il push e passa a Claude l'elenco dei controlli falliti: su main finisce solo un'app che funziona.
// I push di altri branch passano senza test (servono per mostrare il lavoro prima di unirlo).
import { execFileSync, spawnSync } from 'node:child_process';

let input = '';
for await (const chunk of process.stdin) input += chunk;
let cmd = '';
try { cmd = JSON.parse(input).tool_input.command || ''; } catch {}
// Riconosce anche `git -C cartella push …` e i push dentro comandi composti.
const PUSH = /\bgit\b(?:\s+-C\s+\S+|\s+-c\s+\S+)*\s+push\b/;
if (!PUSH.test(cmd)) process.exit(0);

const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
let branch = '';
try { branch = execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}
// Va su main se il comando nomina main, oppure se non nomina un branch e siamo su main.
const args = cmd.slice(cmd.search(PUSH)).replace(PUSH, '').split(/[;&|]/)[0].trim().split(/\s+/).filter(a => a && !a.startsWith('-'));
const toMain = args.some(a => /(^|:)main$/.test(a)) || (args.length < 2 && branch === 'main');
if (!toMain) process.exit(0);

const run = spawnSync(process.execPath, ['test/run.mjs'], { cwd: dir, encoding: 'utf8', timeout: 840000 });
if (run.status === 0) process.exit(0);
const out = (run.stdout || '') + (run.stderr || '');
const failed = out.split('\n').filter(l => /FAIL|EADDRINUSE|Error/.test(l)).slice(0, 15).join('\n');
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: `Pubblicazione su main bloccata: i test non sono passati.\n${failed || out.slice(-1500)}\nCorreggi la causa (non i test) e rilancia \`node test/run.mjs\` prima di riprovare. Se le porte 8765/8766 sono occupate, ferma i vecchi server di prova.`
  }
}));
