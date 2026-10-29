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

// Segnale (pallino rosso con «!») sui libri letti con il periodo di lettura da aggiornare.
async function segnale(browser) {
  const p = await newPage(browser);
  const base = { added: 1, rating: 0 };
  await load(p, [
    { ...base, id: 'g1', title: 'Senza date', author: 'A', status: 'letto', pages: 200 },
    { ...base, id: 'g2', title: 'Con fine', author: 'B', status: 'letto', pages: 200, finished: '2025-03-10' },
    { ...base, id: 'g3', title: 'Solo anno', author: 'C', status: 'letto', pages: 200, finishedYear: 2019 },
    { ...base, id: 'g4', title: 'In lettura', author: 'D', status: 'in-lettura', pages: 200, started: iso() },
    { ...base, id: 'g5', title: 'Da leggere', author: 'E', status: 'da-leggere', pages: 200 },
    { ...base, id: 'g6', title: 'Date storte', author: 'F', status: 'letto', pages: 200, started: '2025-05-10', finished: '2025-05-01' },
    { ...base, id: 'g7', title: 'Senza pagine', author: 'G', status: 'letto' },
  ]);
  const has = id => p.locator(`#main [data-id="${id}"] .badge`).count().then(n => n > 0);
  const flags = async () => (await Promise.all(['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'].map(has))).map(Number).join('');
  ok('segnale sui dorsi: letti senza data di fine/anno o con date storte', (await flags()) === '1000011', await flags());
  const bb = await p.locator('#main [data-id="g1"] .badge').boundingBox(), sb = await p.locator('#main [data-id="g1"]').boundingBox();
  ok('segnale sul dorso: sporge di circa 2 mm sopra il bordo del libro', sb.y - bb.y >= 6 && sb.y - bb.y <= 10 && bb.height >= 16, `${sb.y - bb.y} px`);
  ok('segnale letto da VoiceOver nel nome del libro', /periodo di lettura da aggiornare/.test(await p.getAttribute('#main [data-id="g1"]', 'aria-label')) && !/aggiornare/.test(await p.getAttribute('#main [data-id="g2"]', 'aria-label')));
  await p.locator('.viewsw [data-mode="copertine"]:visible').first().click(); await p.waitForTimeout(300);
  ok('segnale anche sulle copertine', (await flags()) === '1000011', await flags());
  await p.locator('.viewsw [data-mode="dorsi"]:visible').first().click(); await p.waitForTimeout(300);
  await openBook(p, 'g1');
  ok('scheda: avviso con il motivo', /da aggiornare/.test(await p.locator('#s-stale').innerText().catch(() => '')));
  await p.fill('#f-finished', '2025-06-01'); await save(p);
  ok('aggiornata la data di fine: il segnale scompare', !(await has('g1')));
  await openBook(p, 'g6'); await p.fill('#f-started', '2025-04-20'); await save(p);
  ok('date storte corrette: il segnale scompare', !(await has('g6')));
  await openBook(p, 'g7'); await p.fill('#f-year', '2018'); await save(p);
  ok('solo l\'anno: il segnale scompare', !(await has('g7')));
  ok('segnale: niente scorrimento laterale e nessun errore', (await p.evaluate(w => document.documentElement.scrollWidth <= w && innerWidth <= w, 390)) && !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

// Fine stimata: per un libro letto senza fine, scegliere l'inizio propone la fine 20 giorni dopo (mai nel futuro, mai sopra una fine o un anno già scritti).
async function stima(browser) {
  const p = await newPage(browser);
  const base = { added: 1, rating: 0, pages: 200 };
  await load(p, [
    { ...base, id: 'e1', title: 'Letto senza date', author: 'A', status: 'letto' },
    { ...base, id: 'e2', title: 'Letto con fine', author: 'B', status: 'letto', finished: '2025-05-01' },
    { ...base, id: 'e3', title: 'Letto di recente', author: 'C', status: 'letto' },
    { ...base, id: 'e4', title: 'In lettura', author: 'D', status: 'in-lettura', page: 10 },
    { ...base, id: 'e5', title: 'Solo anno', author: 'E', status: 'letto', finishedYear: 2019 },
  ]);
  const close = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(200); const d = p.locator('.sheet [data-u="drop"], .sheet button:has-text("Scarta")'); if (await d.count()) await d.first().click(); await p.waitForSelector('.sheet', { state: 'detached' }).catch(() => {}); };
  await openBook(p, 'e1'); await p.fill('#f-started', '2025-03-01');
  const hint = await p.locator('#f-date-est').isVisible().catch(() => false);
  ok('letto senza fine: scegliendo l\'inizio la fine diventa +20 giorni, con la nota', (await val(p, '#f-finished')) === '2025-03-21' && hint && await p.locator('#f-year-row').isHidden(), await val(p, '#f-finished'));
  await save(p);
  ok('fine stimata salvata con Salva', (await book(p, 'e1')).finished === '2025-03-21', JSON.stringify(await book(p, 'e1')));
  await openBook(p, 'e2'); await p.fill('#f-started', '2025-04-01');
  ok('fine già presente: non cambia', (await val(p, '#f-finished')) === '2025-05-01' && await p.locator('#f-date-est').isHidden());
  await close();
  await openBook(p, 'e3'); await p.fill('#f-started', iso(-5));
  ok('inizio recente: la fine stimata non va nel futuro (oggi)', (await val(p, '#f-finished')) === iso(), await val(p, '#f-finished'));
  await close();
  await openBook(p, 'e4'); await p.fill('#f-started', iso(-30));
  ok('in lettura: nessuna fine stimata', (await val(p, '#f-finished')) === '');
  await close();
  await openBook(p, 'e5'); await p.fill('#f-started', '2019-02-01');
  ok('solo l\'anno già scritto: nessuna fine stimata', (await val(p, '#f-finished')) === '' && (await val(p, '#f-year')) === '2019');
  await close();
  ok('fine stimata: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

export default async function ({ browser }) {
  await segnale(browser);
  await stima(browser);
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
