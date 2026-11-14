// Hook PreToolUse (Edit|Write): blocca le modifiche a file che non vanno toccati a mano.
// - zxing.min.js: libreria esterna (ZXing 0.21.3, MIT), si sostituisce solo con una versione ufficiale.
// (seed.json, i 108 libri Goodreads di Diego, era protetto fino alla v91: tolto dall'app su sua richiesta il 14 novembre 2026.)
// Per cambiarlo davvero, Diego lo chiede esplicitamente e la modifica si fa fuori da Edit/Write.
let input = '';
for await (const chunk of process.stdin) input += chunk;
let file = '';
try { const j = JSON.parse(input); file = (j.tool_input && j.tool_input.file_path) || ''; } catch {}

const PROTECTED = { 'zxing.min.js': 'è la libreria esterna del lettore ISBN (ZXing 0.21.3): si aggiorna solo sostituendola con una versione ufficiale' };
const name = Object.keys(PROTECTED).find(n => file === n || file.endsWith('/' + n));
if (name) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `${name} è protetto: ${PROTECTED[name]}. Se va davvero cambiato, chiedi conferma a Diego.`
    }
  }));
}
