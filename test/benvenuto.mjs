// Benvenuto e prima schermata più leggera (v100): libreria vuota con tre strade, lente per ricerca e ordinamento sul telefono,
// Nuovo libro che parte dalla sola ricerca. La traduzione dei codici d'errore (spiega) è provata nel gruppo regole.
import { APP, ok, newPage, libri108 } from './lib.mjs';

const vis = (p, s) => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(e).visibility !== 'hidden'; }, s);

async function vuota(browser) {
  const p = await newPage(browser);
  await p.goto(APP + '/'); await p.waitForSelector('#notice .notice');
  ok('vuota, non collegato: prima «Accedi e riprendi i libri»', (await p.locator('#notice #vuota-sync.primary').count()) === 1);
  ok('vuota, non collegato: c\'è anche «Aggiungi il primo libro» e «Carica da un file»', /Aggiungi il primo libro/.test(await p.locator('#notice #vuota-add').innerText().catch(() => '')) && /Carica da un file/.test(await p.locator('#notice #carica-go').innerText().catch(() => '')));
  await p.evaluate(() => localStorage.setItem('libreria-cloud', JSON.stringify({ email: 'anna@example.com' })));
  await p.reload(); await p.waitForSelector('#notice .notice');
  ok('vuota, collegato: il pulsante principale è «Aggiungi il primo libro»', (await p.locator('#notice #vuota-add.primary').count()) === 1 && (await p.locator('#notice #vuota-sync').count()) === 0 && !(await p.locator('#notice #carica-go').getAttribute('class')).includes('primary'));
  ok('vuota, collegato: dice ancora che i libri del cloud arrivano da soli', /arrivano da soli/.test(await p.locator('#notice').innerText()));
  await p.click('#notice #vuota-add'); await p.waitForTimeout(300);
  ok('«Aggiungi il primo libro» apre Nuovo libro', (await p.locator('.sheet #s-q').count()) === 1);
  ok('vuota: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function lente(browser) {
  const p = await newPage(browser);
  await p.goto(APP + '/');
  await p.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)), libri108());
  await p.reload(); await p.waitForSelector('#main [data-id]'); await p.waitForTimeout(300);
  ok('telefono: ricerca e «Ordina» chiusi all\'apertura', !(await vis(p, '#q')) && !(await vis(p, '#sort-btn')));
  const box = await p.locator('#cerca-apri').boundingBox();
  ok('telefono: c\'è la lente, alta almeno 44 px', !!box && box.height >= 44, JSON.stringify(box));
  await p.click('#cerca-apri'); await p.waitForTimeout(200);
  ok('la lente apre ricerca e «Ordina» e mette il cursore nella ricerca', await vis(p, '#q') && await vis(p, '#sort-btn') && await p.evaluate(() => document.activeElement && document.activeElement.id === 'q'));
  ok('la lente dice se è aperta (VoiceOver)', (await p.getAttribute('#cerca-apri', 'aria-expanded')) === 'true');
  await p.click('#cerca-apri'); await p.waitForTimeout(200);
  ok('la lente la richiude', !(await vis(p, '#q')) && (await p.getAttribute('#cerca-apri', 'aria-expanded')) === 'false');
  await p.click('#cerca-apri'); await p.fill('#q', 'giardino'); await p.waitForTimeout(400);
  await p.click('#cerca-apri'); await p.waitForTimeout(200);
  ok('con un testo cercato resta aperta', await vis(p, '#q') && (await p.inputValue('#q')) === 'giardino');
  await p.fill('#q', ''); await p.waitForTimeout(400);
  await p.locator('#sort-btn').click(); await p.locator('#sort-menu [data-v="autore"]').click(); await p.waitForTimeout(300);
  await p.click('#cerca-apri'); await p.waitForTimeout(200);
  ok('con un ordinamento diverso da «Recenti» resta aperta', await vis(p, '#sort-btn'));
  await p.reload(); await p.waitForSelector('#main [data-id]'); await p.waitForTimeout(300);
  ok('con l\'ordinamento salvato resta aperta anche dopo la riapertura', await vis(p, '#sort-btn'));
  await p.locator('#sort-btn').click(); await p.locator('#sort-menu [data-v="recenti"]').click(); await p.waitForTimeout(300);
  await p.reload(); await p.waitForSelector('#main [data-id]'); await p.waitForTimeout(300);
  await p.keyboard.press('/'); await p.waitForTimeout(200);
  ok('la scorciatoia «/» apre la ricerca', await vis(p, '#q') && await p.evaluate(() => document.activeElement && document.activeElement.id === 'q'));
  await p.locator('.dock [data-view="stats"]').click(); await p.waitForTimeout(300);
  ok('la lente non c\'è in Statistiche', !(await vis(p, '#cerca-apri')));
  ok('lente: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
  const d = await newPage(browser, { width: 1366, height: 860 });
  await d.goto(APP + '/');
  await d.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)), libri108());
  await d.reload(); await d.waitForSelector('#main [data-id]'); await d.waitForTimeout(300);
  ok('computer: ricerca e «Ordina» sempre visibili, nessuna lente', await vis(d, '#q') && await vis(d, '#sort-btn') && !(await vis(d, '#cerca-apri')));
  await d.close2();
}

async function nuovoLibro(browser) {
  const p = await newPage(browser);
  await p.goto(APP + '/');
  await p.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)), libri108().slice(0, 3));
  await p.reload(); await p.waitForSelector('#main [data-id]'); await p.waitForTimeout(300);
  await p.locator('.dock [data-act="add"]').click(); await p.waitForSelector('#s-q'); await p.waitForTimeout(300);
  ok('Nuovo libro: all\'inizio solo la ricerca (niente campi né pulsanti per salvare)', await vis(p, '#s-q') && !(await vis(p, '#d-title')) && !(await vis(p, '#a-save')) && !(await vis(p, '#a-wish')));
  ok('Nuovo libro: «Inserisci a mano» e «Annulla» visibili', await vis(p, '#a-mano') && await vis(p, '#a-cancel'));
  await p.click('#a-mano'); await p.waitForTimeout(200);
  ok('«Inserisci a mano» mostra i campi e mette il cursore sul titolo', await vis(p, '#d-title') && await vis(p, '#a-save') && await p.evaluate(() => document.activeElement && document.activeElement.id === 'd-title'));
  ok('«Inserisci a mano» poi sparisce', !(await vis(p, '#a-mano')));
  await p.fill('#d-title', 'Libro a mano'); await p.fill('#d-author', 'Autrice Prova');
  await p.click('#a-save'); await p.waitForTimeout(800);
  ok('si salva anche inserendo a mano', await p.evaluate(() => JSON.parse(localStorage.getItem('libreria-diego-v1')).some(b => b.title === 'Libro a mano')));
  ok('Nuovo libro: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

export default async function run({ browser }) {
  await vuota(browser);
  await lente(browser);
  await nuovoLibro(browser);
}
