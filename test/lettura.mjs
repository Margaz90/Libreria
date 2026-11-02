// Regole della lettura (v76): stesso gesto, stesso risultato da menu rapido e scheda; anello come le Statistiche;
// import con «aggiorna» che non tocca i campi assenti; libri incoerenti sistemati una volta all'avvio con una copia.
import { APP, ok, newPage, localBooks } from './lib.mjs';
import { importa } from './funzioni.mjs';

const iso = (add = 0) => { const d = new Date(); d.setDate(d.getDate() + add); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const Y = new Date().getFullYear();
const load = async (p, books, extra = {}) => {
  await p.goto(APP + '/');
  await p.evaluate(([b, x]) => { localStorage.setItem('libreria-diego-v1', JSON.stringify(b)); for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v); }, [books, extra]);
  await p.reload(); await p.waitForSelector('#main'); await p.waitForTimeout(300);
};
const book = async (p, id) => (await localBooks(p)).find(x => x.id === id);
const until = (p, id, fn, ms = 4000) => p.waitForFunction(([id, src]) => {
  const b = JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').find(x => x.id === id);
  return b && new Function('b', 'return ' + src)(b);
}, [id, fn], { timeout: ms }).catch(() => {});
const openBook = async (p, id) => { await p.locator(`#main [data-id="${id}"], #hero [data-id="${id}"]`).first().click(); await p.waitForSelector('.sheet'); await p.waitForTimeout(250); };
const save = async p => { await p.locator('#s-save').click(); await p.waitForTimeout(800); };
const quick = async (p, id, st) => {
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.locator(`#main [data-id="${id}"]`).first().dispatchEvent('pointerdown', { clientX: 5, clientY: 5 });
  await p.waitForSelector('.quick'); await p.waitForTimeout(150);
  await p.locator(`.quick [data-st="${st}"]`).click(); await p.waitForTimeout(800);
};
const toastText = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));

// Funzioni pure: passa, sistema, annoLetto
async function pure(browser) {
  const p = await newPage(browser);
  await p.goto(APP + '/'); await p.waitForSelector('#main');
  const r = await p.evaluate(() => {
    const L = window.libreriaLettura, O = '2026-10-31';
    if (!L) return null;
    const lt = { status: 'letto', started: '2026-01-01', finished: '2026-02-01', pages: 300, page: 120 };
    return {
      rilettura: L.passa(lt, 'in-lettura', O),
      rilettAnno: L.passa({ status: 'letto', started: '2020-03-01', finishedYear: 2020 }, 'in-lettura', O),
      inizia: L.passa({ status: 'da-leggere' }, 'in-lettura', O),
      iniziaConData: L.passa({ status: 'da-leggere', started: '2026-10-10' }, 'in-lettura', O),
      finito: L.passa({ status: 'in-lettura', started: '2026-10-01', pages: 200, page: 50 }, 'letto', O),
      finitoAnno: L.passa({ status: 'in-lettura', finishedYear: 2019 }, 'letto', O),
      rimesso: L.passa(lt, 'da-leggere', O),
      rimessoAnno: L.passa({ status: 'letto', finishedYear: 2019, finishedAuto: true }, 'da-leggere', O),
      stesso: L.passa(lt, 'letto', O),
      sist1: L.sistema({ status: 'da-leggere', finished: '2025-01-01', finishedYear: 2020, finishedAuto: true, started: '2024-12-01' }),
      sist2: L.sistema({ status: 'letto', pages: 250, page: 30 }),
      sist3: L.sistema({ status: 'letto', finished: '2025-01-01', finishedYear: 2020 }),
      sist4: L.sistema({ status: 'letto', finishedYear: 2020, finishedAuto: true }),
      sist5: L.sistema({ status: 'in-lettura', page: 30, pages: 250 }),
      sist6: L.sistema({ status: 'letto', pages: 250 }),
      anni: [
        L.annoLetto({ status: 'letto', finished: '2026-05-01' }, O),
        L.annoLetto({ status: 'letto', finished: '2026-11-15' }, O),
        L.annoLetto({ status: 'letto', finishedYear: 2019 }, O),
        L.annoLetto({ status: 'letto', finishedYear: 2027 }, O),
        L.annoLetto({ status: 'da-leggere', finished: '2026-05-01' }, O),
        L.annoLetto({ status: 'letto' }, O),
        L.annoLetto({ status: 'letto', finished: 'storta' }, O),
      ],
    };
  });
  ok('libreriaLettura esposta', !!r);
  if (!r) { await p.close2(); return; }
  const j = JSON.stringify;
  ok('Letto → In lettura: via fine e anno, inizio da oggi', r.rilettura.status === 'in-lettura' && r.rilettura.started === '2026-10-31' && !r.rilettura.finished && !r.rilettura.finishedYear && !r.rilettura.finishedAuto, j(r.rilettura));
  ok('Letto (solo anno) → In lettura: inizio da oggi anche con un vecchio inizio', r.rilettAnno.started === '2026-10-31' && !r.rilettAnno.finishedYear, j(r.rilettAnno));
  ok('Da leggere → In lettura senza inizio: inizio da oggi', r.inizia.started === '2026-10-31', j(r.inizia));
  ok('Da leggere → In lettura con un inizio: resta', r.iniziaConData.started === '2026-10-10', j(r.iniziaConData));
  ok('In lettura → Letto: fine di oggi messa dall\'app, pagina = totale', r.finito.finished === '2026-10-31' && r.finito.finishedAuto === true && r.finito.page === 200 && r.finito.started === '2026-10-01', j(r.finito));
  ok('→ Letto con solo l\'anno già noto: niente data di oggi', !r.finitoAnno.finished && r.finitoAnno.finishedYear === 2019, j(r.finitoAnno));
  ok('Letto → Da leggere: via fine e anno, l\'inizio resta', r.rimesso.status === 'da-leggere' && !r.rimesso.finished && r.rimesso.started === '2026-01-01', j(r.rimesso));
  ok('Letto (solo anno) → Da leggere: via l\'anno', !r.rimessoAnno.finishedYear && !r.rimessoAnno.finishedAuto, j(r.rimessoAnno));
  ok('stesso stato: date intatte', r.stesso.finished === '2026-02-01' && r.stesso.started === '2026-01-01' && r.stesso.page === 300, j(r.stesso));
  ok('sistema: un Da leggere non tiene fine, anno, fine automatica; l\'inizio resta', !r.sist1.finished && !r.sist1.finishedYear && !r.sist1.finishedAuto && r.sist1.started === '2024-12-01', j(r.sist1));
  ok('sistema: un Letto ha la pagina uguale al totale', r.sist2.page === 250, j(r.sist2));
  ok('sistema: fine e anno mai insieme (vince la fine)', r.sist3.finished === '2025-01-01' && r.sist3.finishedYear === undefined, j(r.sist3));
  ok('sistema: fine automatica solo con una fine', r.sist4.finishedAuto === undefined && r.sist4.finishedYear === 2020, j(r.sist4));
  ok('sistema: In lettura non tocca la pagina', r.sist5.page === 30, j(r.sist5));
  ok('sistema: un Letto senza pagina scritta resta senza (niente modifiche ai libri Goodreads)', r.sist6.page === undefined, j(r.sist6));
  ok('annoLetto: fine passata, fine futura (nessuna), solo anno, anno futuro, non letto, senza dati, data storta', j(r.anni) === j([2026, null, 2019, null, null, null, null]), j(r.anni));
  ok('pure: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

// Stesso gesto dal menu rapido e dalla scheda
async function gesti(browser) {
  const p = await newPage(browser);
  const base = { added: 1, rating: 0, author: 'A', pages: 300 };
  await load(p, [
    { ...base, id: 'm1', title: 'Menu letto', status: 'letto', started: '2025-01-01', finished: '2025-02-01' },
    { ...base, id: 's1', title: 'Scheda letto', status: 'letto', started: '2025-01-01', finished: '2025-02-01' },
    { ...base, id: 'm2', title: 'Menu da leggere', status: 'da-leggere' },
    { ...base, id: 's2', title: 'Scheda da leggere', status: 'da-leggere' },
    { ...base, id: 's3', title: 'Scheda data a mano', status: 'da-leggere' },
    { ...base, id: 'm4', title: 'Menu anno', status: 'letto', finishedYear: 2019 },
    { ...base, id: 's4', title: 'Scheda anno', status: 'letto', finishedYear: 2019 },
    { ...base, id: 's5', title: 'Scheda avanti e indietro', status: 'letto', started: '2025-03-01', finished: '2025-03-20' },
  ]);

  // Letto → In lettura
  await quick(p, 'm1', 'in-lettura');
  const m1 = await book(p, 'm1');
  ok('menu rapido Letto → In lettura: inizio oggi, niente fine', m1.status === 'in-lettura' && m1.started === iso() && !m1.finished, JSON.stringify(m1));
  ok('menu rapido: «Annulla» quando il cambio toglie delle date', /Annulla/.test(await toastText(p)), await toastText(p));
  await openBook(p, 's1');
  await p.locator('.seg [data-v="in-lettura"]').click();
  ok('scheda Letto → In lettura: «Iniziato il» mostra oggi prima di salvare', (await p.inputValue('#f-started')) === iso());
  await save(p); await until(p, 's1', "b.status === 'in-lettura'");
  const s1 = await book(p, 's1');
  ok('scheda Letto → In lettura: come il menu rapido', s1.status === m1.status && s1.started === m1.started && !s1.finished && !s1.finishedYear, JSON.stringify(s1));

  // Da leggere → In lettura
  await quick(p, 'm2', 'in-lettura');
  ok('menu rapido Da leggere → In lettura: niente «Annulla» (nessuna data tolta)', !/Annulla/.test(await toastText(p)), await toastText(p));
  await openBook(p, 's2');
  await p.locator('.seg [data-v="in-lettura"]').click();
  await save(p); await until(p, 's2', "b.status === 'in-lettura'");
  const [m2, s2] = [await book(p, 'm2'), await book(p, 's2')];
  ok('Da leggere → In lettura: inizio oggi, uguale da menu e scheda', m2.started === iso() && s2.started === iso(), JSON.stringify([m2, s2]));

  // Data scelta a mano prima di toccare In lettura: resta
  await openBook(p, 's3');
  // Per un Da leggere la riga delle date è nascosta: imposto il campo come farebbe il selettore nativo.
  await p.evaluate(v => { const el = document.querySelector('#f-started'); el.value = v; el.dispatchEvent(new Event('change')); }, iso(-5));
  await p.locator('.seg [data-v="in-lettura"]').click();
  ok('scheda: un inizio scelto a mano resta dopo il tocco su In lettura', (await p.inputValue('#f-started')) === iso(-5));
  await save(p); await until(p, 's3', "b.status === 'in-lettura'");
  ok('scheda: salvato l\'inizio scelto a mano', (await book(p, 's3')).started === iso(-5), JSON.stringify(await book(p, 's3')));

  // Letto (solo anno) → Da leggere, con Annulla
  await quick(p, 'm4', 'da-leggere');
  const m4 = await book(p, 'm4');
  ok('menu rapido Letto → Da leggere: via l\'anno', m4.status === 'da-leggere' && !m4.finishedYear && !m4.finished, JSON.stringify(m4));
  const undo = p.locator('.toast button', { hasText: 'Annulla' });
  ok('menu rapido Letto → Da leggere: «Annulla» visibile', await undo.count() === 1);
  if (await undo.count()) { await undo.click(); await until(p, 'm4', "b.status === 'letto'"); }
  const m4b = await book(p, 'm4');
  ok('«Annulla» riporta Letto con l\'anno', m4b.status === 'letto' && m4b.finishedYear === 2019, JSON.stringify(m4b));
  await openBook(p, 's4');
  await p.locator('.seg [data-v="da-leggere"]').click();
  await save(p); await until(p, 's4', "b.status === 'da-leggere'");
  const s4 = await book(p, 's4');
  ok('scheda Letto → Da leggere: come il menu rapido', s4.status === 'da-leggere' && !s4.finishedYear && !s4.finished, JSON.stringify(s4));

  // Avanti e indietro nella scheda: tornando a Letto le date sono quelle di prima
  await openBook(p, 's5');
  await p.locator('.seg [data-v="in-lettura"]').click();
  await p.locator('.seg [data-v="letto"]').click();
  ok('scheda: In lettura e di nuovo Letto rimette inizio e fine di prima', (await p.inputValue('#f-started')) === '2025-03-01' && (await p.inputValue('#f-finished')) === '2025-03-20');
  await p.locator('#s-close').click(); await p.waitForTimeout(250);
  const drop = p.locator('.unsaved [data-u="drop"]'); if (await drop.count()) await drop.click();
  await p.waitForTimeout(200);
  const s5 = await book(p, 's5');
  ok('scheda chiusa senza salvare: libro invariato', s5.status === 'letto' && s5.finished === '2025-03-20', JSON.stringify(s5));
  ok('gesti: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

// Nuovo libro: In lettura senza inizio resta com'era (non è un cambio di stato)
async function nuovo(browser) {
  const p = await newPage(browser);
  await p.goto(APP + '/'); await p.waitForSelector('#main');
  await p.locator('.dock .add').first().click(); await p.waitForSelector('.sheet');
  await p.waitForFunction(() => document.activeElement && document.activeElement.id === 's-q');
  await p.fill('#d-title', 'Nuovo in lettura'); await p.fill('#d-author', 'Z');
  await p.locator('.seg [data-v="in-lettura"]').click();
  ok('Nuovo libro In lettura: l\'inizio non si riempie da solo', (await p.inputValue('#f-started')) === '');
  await p.locator('#a-save').click(); await p.waitForTimeout(800);
  const n = (await localBooks(p)).find(b => b.title === 'Nuovo in lettura');
  ok('Nuovo libro In lettura salvato', n && n.status === 'in-lettura', JSON.stringify(n));
  await p.close2();
}

// Anello dell'obiettivo e menu Obiettivo: contano come le Statistiche
async function anello(browser) {
  const p = await newPage(browser);
  const base = { added: 1, rating: 0, author: 'A' };
  await load(p, [
    { ...base, id: 'a1', title: 'Con fine', status: 'letto', finished: `${Y}-01-10` },
    { ...base, id: 'a2', title: 'Solo anno', status: 'letto', finishedYear: Y },
    { ...base, id: 'a3', title: 'Fine futura', status: 'letto', finished: iso(5) > `${Y}-12-31` ? `${Y + 1}-01-02` : iso(5) },
    { ...base, id: 'a4', title: 'Anno passato', status: 'letto', finished: `${Y - 1}-06-01` },
    { ...base, id: 'a5', title: 'Da leggere', status: 'da-leggere' },
  ], { 'libreria-settings': JSON.stringify({ goals: { [Y]: 10 } }) });
  const tally = (await p.locator('#tally').innerText()).replace(/\s+/g, ' ');
  ok('anello: conta la fine passata e «solo l\'anno», non la fine futura', /\b2 di 10\b/.test(tally), tally);
  const stats = await p.evaluate(y => { const s = window.libreriaStats.compute(JSON.parse(localStorage.getItem('libreria-diego-v1')), new Date()); const yr = (s.anni || []).find(x => x.year === y); return yr ? yr.count : 0; }, Y);
  ok('anello: stesso numero delle Statistiche', stats === 2, String(stats));
  await p.locator('.dock .more').click(); await p.waitForSelector('[data-m=goal]');
  const goal = (await p.locator('[data-m=goal]').innerText()).replace(/\s+/g, ' ');
  ok('menu Obiettivo: stesso conteggio', /\b2\b/.test(goal) && !/\b3\b/.test(goal), goal);
  ok('anello: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

// Import con «aggiorna i libri già presenti»: i campi assenti nel file restano come sono
async function importAggiorna(browser) {
  const p = await newPage(browser);
  const base = { added: 1, author: 'Autore Uno' };
  await load(p, [
    { ...base, id: 'i1', title: 'Libro parziale', status: 'letto', rating: 4, finished: '2025-04-01', pages: 200, page: 200, notes: 'mie note' },
    { ...base, id: 'i2', title: 'Libro con fine', status: 'letto', rating: 3, finished: '2025-05-01' },
    { ...base, id: 'i3', title: 'Libro completo', status: 'da-leggere', rating: 0 },
  ]);
  await importa(p, [
    { title: 'Libro parziale', author: 'Autore Uno', isbn: '9788804668237' },
    { title: 'Libro con fine', author: 'Autore Uno', finishedYear: 2020 },
    { title: 'Libro completo', author: 'Autore Uno', status: 'letto', rating: 5, finished: '2025-06-01', pages: 120 },
  ], true);
  const [i1, i2, i3] = [await book(p, 'i1'), await book(p, 'i2'), await book(p, 'i3')];
  ok('import «aggiorna»: file parziale non cambia stato, voto, date e note', i1.status === 'letto' && i1.rating === 4 && i1.finished === '2025-04-01' && i1.notes === 'mie note' && i1.isbn === '9788804668237', JSON.stringify(i1));
  ok('import «aggiorna»: fine e anno mai insieme', i2.finished === '2025-05-01' && i2.finishedYear === undefined, JSON.stringify(i2));
  ok('import «aggiorna»: i campi presenti nel file vincono', i3.status === 'letto' && i3.rating === 5 && i3.finished === '2025-06-01' && i3.pages === 120, JSON.stringify(i3));
  ok('import «aggiorna»: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

// Libri incoerenti già salvati: sistemati una volta all'avvio, senza cambiare `updated`, con la copia prima
async function avvio(browser) {
  const p = await newPage(browser);
  const base = { added: 1, rating: 0, author: 'A', updated: 1000 };
  await load(p, [
    { ...base, id: 'v1', title: 'Da leggere con fine', status: 'da-leggere', finished: '2024-01-01', finishedYear: 2020, started: '2023-12-01' },
    { ...base, id: 'v2', title: 'Letto a metà', status: 'letto', finished: '2024-02-01', pages: 300, page: 100 },
    { ...base, id: 'v3', title: 'Già a posto', status: 'letto', finished: '2024-03-01', pages: 200, page: 200 },
  ]);
  await until(p, 'v1', '!b.finished');
  const [v1, v2, v3] = [await book(p, 'v1'), await book(p, 'v2'), await book(p, 'v3')];
  ok('avvio: Da leggere senza fine né anno, inizio tenuto', !v1.finished && !v1.finishedYear && v1.started === '2023-12-01', JSON.stringify(v1));
  ok('avvio: Letto con pagina = totale', v2.page === 300, JSON.stringify(v2));
  ok('avvio: `updated` invariato (niente invii al cloud)', v1.updated === 1000 && v2.updated === 1000 && v3.updated === 1000, JSON.stringify([v1.updated, v2.updated, v3.updated]));
  const snaps = await p.evaluate(() => new Promise(res => {
    const r = indexedDB.open('libreria-copie'); r.onerror = () => res(null);
    r.onsuccess = () => { try { const q = r.result.transaction('copie').objectStore('copie').getAll(); q.onsuccess = () => res(q.result.map(c => ({ label: c.label, books: c.books }))); q.onerror = () => res(null); } catch { res(null); } };
  }));
  const copy = (snaps || []).find(c => /regole di lettura/.test(c.label));
  ok('avvio: copia «Prima delle regole di lettura» con i dati originali', copy && copy.books.find(b => b.id === 'v1').finished === '2024-01-01', JSON.stringify(snaps && snaps.map(s => s.label)));
  await p.reload(); await p.waitForSelector('#main'); await p.waitForTimeout(800);
  const again = await p.evaluate(() => new Promise(res => { const r = indexedDB.open('libreria-copie'); r.onsuccess = () => { const q = r.result.transaction('copie').objectStore('copie').getAll(); q.onsuccess = () => res(q.result.length); }; r.onerror = () => res(-1); }));
  ok('avvio: alla riapertura nessuna nuova copia', again === (snaps || []).length, `${again} vs ${(snaps || []).length}`);

  // Libreria già coerente: nessuna copia
  const q = await newPage(browser);
  await load(q, [{ ...base, id: 'w1', title: 'A posto', status: 'letto', finished: '2024-03-01', pages: 200, page: 200 }]);
  await q.waitForTimeout(800);
  const none = await q.evaluate(() => new Promise(res => { const r = indexedDB.open('libreria-copie'); r.onsuccess = () => { try { const t = r.result.transaction('copie').objectStore('copie').getAll(); t.onsuccess = () => res(t.result.length); } catch { res(0); } }; r.onerror = () => res(0); }));
  ok('avvio: libreria già coerente, nessuna copia', none === 0, String(none));
  ok('avvio: nessun errore in console', !p.errs.length && !q.errs.length, [...p.errs, ...q.errs].join(' / '));
  await p.close2(); await q.close2();
}

// Libro in arrivo dal cloud: regole applicate senza cambiare `updated`
async function cloud(browser) {
  const p = await newPage(browser);
  await load(p, []);
  const b = await p.evaluate(() => {
    window.libreriaHost.setLocal('c1', { title: 'Dal cloud', status: 'da-leggere', finished: '2024-01-01', updated: 5000 });
    return window.libreriaHost.books().find(x => x.id === 'c1');
  });
  ok('cloud: libro in arrivo sistemato con le regole, `updated` del cloud', b && !b.finished && b.updated === 5000, JSON.stringify(b));
  await p.close2();
}

export default async function run({ browser }) {
  await pure(browser);
  await gesti(browser);
  await nuovo(browser);
  await anello(browser);
  await importAggiorna(browser);
  await avvio(browser);
  await cloud(browser);
}
