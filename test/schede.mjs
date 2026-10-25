// Schede dei libri: date coerenti (inizio non dopo la fine, mai nel futuro) e pagina attuale = pagine totali per i letti.
import { APP, ok, newPage, localBooks } from './lib.mjs';

const iso = (add = 0) => { const d = new Date(); d.setDate(d.getDate() + add); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const load = async (p, books) => {
  await p.goto(APP + '/');
  await p.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)), books);
  await p.reload(); await p.waitForTimeout(300);
};
const book = async (p, id) => (await localBooks(p)).find(x => x.id === id);
const openBook = async (p, id) => { await p.locator(`#main [data-id="${id}"], #hero [data-id="${id}"]`).first().click(); await p.waitForSelector('.sheet'); };
const save = async p => { await p.locator('#s-save').click(); await p.waitForTimeout(700); };
const val = (p, sel) => p.inputValue(sel);
const errText = p => p.locator('#f-date-err').innerText({ timeout: 800 }).catch(() => '');

export default async function ({ browser }) {
  const p = await newPage(browser);
  const base = { added: 1, rating: 0 };
  await load(p, [
    { ...base, id: 'd1', title: 'Date', author: 'A', status: 'letto', pages: 300, started: '2025-03-01', finished: '2025-03-10' },
    { ...base, id: 'd2', title: 'Storto', author: 'B', status: 'letto', pages: 200, started: '2025-05-10', finished: '2025-05-01' },
    { ...base, id: 'd3', title: 'Da leggere', author: 'C', status: 'da-leggere', pages: 300 },
    { ...base, id: 'd4', title: 'Riletto', author: 'D', status: 'letto', pages: 250, started: '2024-01-01', finished: '2024-01-20', page: 250 },
    { ...base, id: 'd5', title: 'Aperto', author: 'E', status: 'letto', pages: 120 },
    { ...base, id: 'd6', title: 'Rilettura rapida', author: 'F', status: 'letto', pages: 90, started: '2024-02-01', finished: '2024-02-09', page: 90 },
  ]);

  // Date: la fine non può precedere l'inizio (il valore sbagliato torna com'era, con un avviso)
  await openBook(p, 'd1');
  ok('date: i limiti del selettore seguono l\'altra data', (await p.getAttribute('#f-finished', 'min')) === '2025-03-01' && (await p.getAttribute('#f-started', 'max')) === '2025-03-10');
  await p.fill('#f-finished', '2025-02-01');
  ok('fine prima dell\'inizio: rifiutata, torna il valore precedente, con avviso', (await val(p, '#f-finished')) === '2025-03-10' && /non può precedere/.test(await errText(p)) && (await p.getAttribute('#f-finished', 'aria-invalid')) === 'true', await errText(p));
  await p.fill('#f-started', '2025-04-01');
  ok('inizio dopo la fine: rifiutato, torna il valore precedente', (await val(p, '#f-started')) === '2025-03-01' && /non può seguire/.test(await errText(p)), await errText(p));
  await p.fill('#f-finished', iso(1));
  ok('data nel futuro: rifiutata', (await val(p, '#f-finished')) === '2025-03-10' && /futuro/.test(await errText(p)), await errText(p));
  await p.fill('#f-started', '2025-03-05');
  ok('date coerenti: accettate, avviso tolto', (await val(p, '#f-started')) === '2025-03-05' && !(await errText(p)) && (await p.getAttribute('#f-finished', 'min')) === '2025-03-05');
  await save(p);
  const d1 = await book(p, 'd1');
  ok('date coerenti: salvate', d1.started === '2025-03-05' && d1.finished === '2025-03-10', JSON.stringify(d1));

  // Dati già storti (da prima di questo controllo): non si salva finché non si correggono
  await openBook(p, 'd2');
  await p.locator('#s-save').click(); await p.waitForTimeout(300);
  ok('date già storte: il salvataggio si ferma con un avviso', (await p.locator('#s-save').isVisible()) && /non può precedere/.test(await errText(p)), await errText(p));
  await p.fill('#f-started', '2025-04-20'); await save(p);
  ok('date già storte: corrette e salvate', (await book(p, 'd2')).started === '2025-04-20');

  // Pagina attuale = pagine totali quando il libro è letto
  await openBook(p, 'd3');
  await p.locator('.seg [data-v="letto"]').click();
  ok('Letto: pagina attuale = 300 e non modificabile', (await val(p, '#f-page')) === '300' && (await p.getAttribute('#f-page', 'readonly')) !== null);
  await p.locator('.seg [data-v="in-lettura"]').click();
  ok('di nuovo In lettura: pagina attuale libera e vuota', (await val(p, '#f-page')) === '' && (await p.getAttribute('#f-page', 'readonly')) === null);
  await p.locator('.seg [data-v="letto"]').click(); await save(p);
  const d3 = await book(p, 'd3');
  ok('Letto salvato: page = pages', d3.status === 'letto' && d3.page === 300, JSON.stringify(d3));

  await openBook(p, 'd5');
  ok('libro già letto senza pagina: la scheda mostra 120', (await val(p, '#f-page')) === '120');
  await p.locator('details.edit summary').click();
  await p.fill('#d-pages', '150');
  ok('cambio delle pagine totali: la pagina attuale segue', (await val(p, '#f-page')) === '150');
  await save(p);
  ok('libro letto: page salvata = pagine totali', (await book(p, 'd5')).page === 150);

  // In lettura: la fine (e l'anno) non valgono più e l'inizio riparte da oggi
  await openBook(p, 'd4');
  await p.locator('.seg [data-v="in-lettura"]').click();
  ok('In lettura: «Finito il» svuotato e disattivato', (await val(p, '#f-finished')) === '' && (await p.locator('#f-finished').isDisabled()));
  await p.locator('#s-close').click(); await p.waitForTimeout(200);
  const unsaved = p.locator('.unsaved [data-u="drop"]'); if (await unsaved.count()) await unsaved.click();
  await p.waitForTimeout(300);
  await p.locator('#main [data-id="d6"]').first().dispatchEvent('pointerdown', { clientX: 5, clientY: 5 });
  await p.waitForTimeout(700);
  await p.locator('.quick [data-st="in-lettura"]').click(); await p.waitForTimeout(800);
  const d6 = await book(p, 'd6');
  ok('menu rapido In lettura su un letto: niente fine, inizio di oggi', d6.status === 'in-lettura' && !d6.finished && d6.started === iso() && !d6.finishedYear, JSON.stringify(d6));

  // Nuovo libro: pagine scritte, poi Letto
  const p2 = await newPage(browser);
  await p2.goto(APP + '/'); await p2.waitForTimeout(300);
  await p2.locator('.dock .add').first().click(); await p2.waitForSelector('.sheet');
  await p2.waitForFunction(() => document.activeElement && document.activeElement.id === 's-q'); // la scheda ha finito di aprirsi
  await p2.fill('#d-title', 'Nuovo'); await p2.fill('#d-author', 'Z'); await p2.fill('#d-pages', '250');
  await p2.locator('.seg [data-v="letto"]').click();
  ok('Nuovo libro: Letto con 250 pagine → pagina attuale 250', (await val(p2, '#f-page')) === '250');
  await p2.fill('#f-finished', iso(1));
  ok('Nuovo libro: niente date future', !(await val(p2, '#f-finished')));
  await p2.locator('#a-save').click(); await p2.waitForTimeout(700);
  const n = (await localBooks(p2))[0];
  ok('Nuovo libro letto: page = 250', n && n.page === 250 && n.status === 'letto', JSON.stringify(n));

  ok('schede: nessun errore in console', !p.errs.length && !p2.errs.length, [...p.errs, ...p2.errs].join(' / '));
  await p.close2(); await p2.close2();
}
