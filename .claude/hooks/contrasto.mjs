// Hook PostToolUse (Edit|Write) su style.css: ricalcola il contrasto dei colori principali, in chiaro e in scuro.
// Sotto 4,5:1 (WCAG AA per il testo) esce con codice 2: il resoconto torna a Claude, che sistema il colore.
// Si può lanciare anche a mano: `node .claude/hooks/contrasto.mjs style.css`.
import { readFileSync } from 'node:fs';

let file = process.argv[2] || '';
if (!file) {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  try { const j = JSON.parse(input); file = (j.tool_input && j.tool_input.file_path) || ''; } catch {}
}
if (!/(^|\/)style\.css$/.test(file)) process.exit(0);

const css = readFileSync(file, 'utf8');
// Token di :root (chiaro) e quelli ridefiniti nel blocco prefers-color-scheme: dark (scuro).
const tokens = block => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map(m => [m[1], m[2]]));
const light = tokens((/:root\s*\{([^}]*)\}/.exec(css) || [])[1] || '');
const darkBlock = (/prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(css) || [])[1] || '';
const dark = { ...light, ...tokens(darkBlock) };

const lum = hex => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Coppie testo/sfondo usate nell'app. --coral è solo decorativo (anello, barre, linee) e non viene controllato.
const PAIRS = [['ink', 'bg'], ['ink', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['title', 'bg'], ['title', 'surface'], ['accent', 'bg'], ['accent', 'surface'], ['accent-ink', 'accent']];
const problems = [];
for (const [name, theme] of [['chiaro', light], ['scuro', dark]]) {
  for (const [fg, bg] of PAIRS) {
    if (!theme[fg] || !theme[bg]) continue;
    const r = ratio(theme[fg], theme[bg]);
    if (r < 4.5) problems.push(`${name}: --${fg} ${theme[fg]} su --${bg} ${theme[bg]} = ${r.toFixed(2)}:1 (serve almeno 4,5:1)`);
  }
}
if (problems.length) {
  process.stderr.write('Contrasto insufficiente in style.css:\n- ' + problems.join('\n- ') + '\nScegli un colore della stessa tinta, più scuro su fondo chiaro o più chiaro su fondo scuro.\n');
  process.exit(2);
}
