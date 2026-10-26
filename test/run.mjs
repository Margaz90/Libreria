// Lancia i test dell'app: `node test/run.mjs` (tutti) oppure `node test/run.mjs interfaccia ricerche` (solo alcuni).
// Servono Node e Playwright con Chromium; i server dell'app e del finto Firestore partono da soli (porte 8765 e 8766).
import { chromium, startServers, results } from './lib.mjs';

const ALL = ['interfaccia', 'ricerche', 'accesso', 'sincronizzazione', 'aggiornamento', 'statistiche', 'schede', 'sicurezza', 'isbn'];
const chosen = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const unknown = chosen.filter(n => !ALL.includes(n));
if (unknown.length) { console.error('Test sconosciuti: ' + unknown.join(', ') + '. Disponibili: ' + ALL.join(', ')); process.exit(2); }

const stop = await startServers();
const browser = await chromium.launch();
const t0 = Date.now();
try {
  for (const name of chosen) {
    console.log('\n▸ ' + name);
    const { default: run } = await import(`./${name}.mjs`);
    try { await run({ browser }); }
    catch (e) { results.fail++; console.log('  FAIL il test si è interrotto: ' + (e && e.message ? e.message.split('\n')[0] : e)); }
  }
} finally {
  await browser.close();
  await stop();
}
console.log(`\n${results.fail ? '✗' : '✓'} ${results.pass} riusciti, ${results.fail} falliti (${Math.round((Date.now() - t0) / 1000)} s)`);
process.exit(results.fail ? 1 : 0);
