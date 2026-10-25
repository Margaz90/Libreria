// Hook UserPromptSubmit: a ogni richiesta di Diego controlla la data dell'ultima verifica degli hook
// (.claude/verifica-hook.json). Se sono passati almeno `intervalloGiorni` giorni, aggiunge al contesto
// l'istruzione di fare la verifica (skill verifica-hook) nella stessa risposta, dopo aver soddisfatto la richiesta.
// Altrimenti non stampa nulla. Non blocca mai la richiesta.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
let cfg = {};
try { cfg = JSON.parse(readFileSync(join(dir, '.claude', 'verifica-hook.json'), 'utf8')); } catch {}
const days = Number(cfg.intervalloGiorni) || 30;
const last = Date.parse(cfg.ultima || '');
const passed = Number.isNaN(last) ? Infinity : Math.floor((Date.now() - last) / 864e5);
if (passed < days) process.exit(0);

const since = Number.isNaN(last) ? 'mai fatta' : `ultima il ${cfg.ultima}, ${passed} giorni fa`;
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'UserPromptSubmit',
    additionalContext: `È il momento della verifica mensile degli hook di MyLibrary (${since}). Prima soddisfa la richiesta di Diego; poi, nella stessa risposta, esegui la skill verifica-hook: analizza cosa è cambiato nel progetto, proponi eventuali nuovi hook in una tabella con pro e contro (senza crearli finché Diego non approva) e aggiorna la data in .claude/verifica-hook.json come indicato nella skill.`
  }
}));
