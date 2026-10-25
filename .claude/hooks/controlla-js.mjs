// Hook PostToolUse (Edit|Write): dopo ogni modifica a un file .js ne controlla la sintassi con `node --check`.
// Un errore di sintassi in app.js o cloud.js rende l'app bianca sull'iPhone: meglio accorgersene subito.
// Se c'è un errore esce con codice 2, così il messaggio torna a Claude, che lo corregge.
import { execFileSync } from 'node:child_process';

let input = '';
for await (const chunk of process.stdin) input += chunk;
let file = '';
try { const j = JSON.parse(input); file = (j.tool_input && j.tool_input.file_path) || (j.tool_response && j.tool_response.filePath) || ''; } catch {}
if (!/\.m?js$/.test(file) || /\.min\.js$/.test(file)) process.exit(0);
try {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
} catch (e) {
  process.stderr.write(`Errore di sintassi in ${file}:\n${String(e.stderr || e.message).trim()}\n`);
  process.exit(2);
}
