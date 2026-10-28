// Serie e numero del volume: campi controllati da clean(), titoli simili, scheda (Serie e N.), pulsante serie, bollino, ordine Autore.
import { APP, ok, newPage, localBooks } from './lib.mjs';

const load = async (p, books, set) => {
  await p.goto(APP + '/');
  await p.evaluate(([b, s]) => { localStorage.setItem('libreria-diego-v1', JSON.stringify(b)); if (s) localStorage.setItem('libreria-settings', JSON.stringify(s)); }, [books, set]);
  await p.reload(); await p.waitForSelector('#main');
};
const book = async (p, id) => (await localBooks(p)).find(x => x.id === id);
// Aspetta che il libro salvato abbia i valori attesi (salvataggio ritardato); null = campo assente.
const until = (p, id, o) => p.waitForFunction(([id, o]) => {
  const b = JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').find(x => x.id === id);
  return b && Object.entries(o).every(([k, v]) => b[k] === (v === null ? undefined : v));
}, [id, o], { timeout: 4000 }).catch(() => {});
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function pulizia(browser) {
  const q = await newPage(browser);
  await q.goto(APP + '/'); await q.waitForSelector('#main');
  await q.locator('.dock .more').click(); await q.locator('[data-m=backup]').click(); await q.waitForSelector('#i-file');
  const body = JSON.stringify([
    { title: 'C1', author: 'A', series: '  Serie   X ', seriesNo: '0,5' },
    { title: 'C2', author: 'A', series: 'Serie X', seriesNo: 'abc' },
    { title: 'C3', author: 'A', series: 'Serie X', seriesNo: '-1' },
    { title: 'C4', author: 'A', seriesNo: '3', seriesNext: 'Seguito', seriesManual: true },
    { title: 'C5', author: 'A', series: 'x'.repeat(100), seriesNo: 2, seriesNext: 'y'.repeat(300), seriesManual: 'sì' },
    { title: 'C6', author: 'A', series: 'Serie X', seriesNo: '1234567' },
  ]);
  await q.setInputFiles('#i-file', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(body) });
  await q.waitForFunction(() => !document.querySelector('#i-go').disabled, null, { timeout: 5000 });
  await q.locator('#i-go').click();
  await q.waitForFunction(() => JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').length === 6, null, { timeout: 5000 }).catch(() => {});
  const bs = await localBooks(q), g = t => bs.find(b => b.title === t) || {};
  ok('clean: numero con virgola', g('C1').seriesNo === '0.5' && g('C1').series === 'Serie X', JSON.stringify(g('C1')));
  ok('clean: numero non valido tolto', g('C2').seriesNo === undefined && g('C3').seriesNo === undefined && g('C6').seriesNo === undefined && g('C2').series === 'Serie X');
  ok('clean: senza serie niente numero né seguito', g('C4').seriesNo === undefined && g('C4').seriesNext === undefined && g('C4').seriesManual === true, JSON.stringify(g('C4')));
  ok('clean: serie lunga tagliata a 80, seguito a 200', (g('C5').series || '').length === 80 && (g('C5').seriesNext || '').length === 200 && g('C5').seriesNo === '2' && g('C5').seriesManual === undefined);
  ok('clean: nessun errore in console', !q.errs.length, q.errs.join(' / '));
  await q.close2();
}

async function titoli(browser) {
  const p = await newPage(browser);
  await p.goto(APP + '/'); await p.waitForSelector('#main');
  const r = await p.evaluate(() => { const S = window.libreriaSeries; return {
    frozen: Object.isFrozen(S),
    a: S.sameTitle('La talpa', 'Talpa: romanzo') && S.sameTitle('Il nome della rosa', 'nome della rosa - edizione speciale'),
    b: S.sameTitle('Il nome della rosa', 'Nome della rosa e altri scritti'),
    c: !S.sameTitle('Tre', 'Tre uomini in barca'),
    d: S.sameTitle("L'amica geniale", 'Amica geniale') && !S.sameTitle('Leoni morti', 'Tigri vere'),
    k: S.seriesKey('  Slough   House ') === 'slough house',
  }; });
  ok('sameTitle: articolo e sottotitolo', r.a);
  ok('sameTitle: per inizio solo da 8 caratteri', r.b);
  ok('sameTitle: titolo corto non combacia per inizio', r.c);
  ok("sameTitle: l' e titoli diversi", r.d);
  ok('seriesKey e oggetto congelato', r.k && r.frozen);
  await p.close2();
}

async function scheda(browser) {
  const p = await newPage(browser);
  const base = { added: 1, rating: 0, status: 'da-leggere', author: 'Mick Herron' };
  await load(p, [
    { ...base, id: 's1', title: 'Un covo di bastardi', series: 'Slough House', seriesNo: '1', seriesNext: 'Leoni morti' },
    { ...base, id: 's2', title: 'Leoni morti', series: 'slough house ', seriesNo: '2' },
    { ...base, id: 's3', title: 'Tigri vere' },
    { ...base, id: 's4', title: 'Altro libro', author: 'Altro Autore' },
  ]);
  const open = async id => { await p.locator(`#main [data-id="${id}"]`).click(); await p.waitForSelector('.sheet'); };
  const save = async () => { await p.locator('#s-save').click(); await p.waitForSelector('.sheet', { state: 'detached' }); };

  // Pulsante serie nella vista del libro → ricerca della libreria
  await open('s1');
  const sb = p.locator('.sheet-top button[data-series]');
  ok('vista del libro: pulsante «Slough House · 1»', (await sb.innerText()).trim() === 'Slough House · 1', await sb.innerText().catch(() => ''));
  const bb = await sb.boundingBox();
  ok('pulsante serie: almeno 44 px', bb && bb.height >= 44, bb && bb.height);
  await sb.click(); await p.waitForSelector('.sheet', { state: 'detached' });
  await p.waitForFunction(() => document.querySelector('#main [data-id="s1"]') && !document.querySelector('#main [data-id="s4"]'), null, { timeout: 3000 }).catch(() => {});
  ok('pulsante serie scrive nella ricerca e la ricerca trova i volumi', await p.locator('#q').inputValue() === 'Slough House'
    && await p.locator('#main [data-id="s1"]').count() === 1 && await p.locator('#main [data-id="s2"]').count() === 1
    && await p.locator('#main [data-id="s3"]').count() === 0 && await p.locator('#main [data-id="s4"]').count() === 0);
  await p.locator('#q').fill(''); await p.waitForSelector('#main [data-id="s4"]');
  // Con modifiche non salvate: prima Salva/Scarta/Continua, poi (Scarta) la ricerca
  await open('s1'); await p.locator('#f-notes').fill('nota');
  await p.locator('.sheet-top button[data-series]').click();
  const bar = await p.locator('.unsaved').isVisible().catch(() => false);
  await p.locator('[data-u="drop"]').click(); await p.waitForSelector('.sheet', { state: 'detached' });
  ok('pulsante serie con modifiche: chiede, poi Scarta e cerca', bar && await p.locator('#q').inputValue() === 'Slough House' && (await book(p, 's1')).notes === undefined);
  await p.locator('#q').fill(''); await p.waitForSelector('#main [data-id="s4"]');

  // Salvare senza toccare Serie e N. non imposta seriesManual
  await open('s2'); await save(); await p.waitForTimeout(900);
  ok('salvare senza cambiare la serie: seriesManual assente', (await book(p, 's2')).seriesManual === undefined);

  // Datalist senza doppioni; forma già usata al salvataggio
  await open('s3');
  await p.locator('details.edit summary').click();
  const opts = await p.locator('#series-list option').evaluateAll(os => os.map(o => o.value));
  ok('datalist con i nomi senza doppioni', opts.length === 1 && opts[0] === 'Slough House' && await p.locator('#d-series').getAttribute('list') === 'series-list', JSON.stringify(opts));
  ok('N.: tastiera decimale', await p.locator('#d-series-no').getAttribute('inputmode') === 'decimal');
  await p.locator('#d-series').fill('slough house'); await p.locator('#d-series-no').fill('3');
  await save(); await until(p, 's3', { series: 'Slough House', seriesNo: '3', seriesManual: true });
  const s3 = await book(p, 's3');
  ok('serie scritta in minuscolo → forma già usata, seriesManual', s3.series === 'Slough House' && s3.seriesNo === '3' && s3.seriesManual === true, JSON.stringify(s3));

  // Svuotare Serie toglie numero e seguito e lascia seriesManual
  await open('s1'); await p.locator('details.edit summary').click();
  await p.locator('#d-series').fill(''); await save();
  await until(p, 's1', { series: null, seriesNo: null, seriesNext: null, seriesManual: true });
  const s1 = await book(p, 's1');
  ok('svuotare Serie: niente numero né seguito, seriesManual', s1.series === undefined && s1.seriesNo === undefined && s1.seriesNext === undefined && s1.seriesManual === true, JSON.stringify(s1));
  ok('scheda: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function bollino(browser) {
  const p = await newPage(browser);
  const base = { added: 1, rating: 0, status: 'da-leggere', author: 'Mick Herron', series: 'Slough House' };
  await load(p, [
    { ...base, id: 'd1', title: 'Disegnato', seriesNo: '3' },
    { ...base, id: 'f1', title: 'Con foto', seriesNo: '3', spine: PNG, spineRatio: 0.2 },
    { ...base, id: 'n1', title: 'Senza numero' },
    { ...base, id: 'w1', title: 'Sottile', seriesNo: '12.5', pages: 60 },
    { ...base, id: 'c1', title: 'Centesimo', seriesNo: '100' },
    { ...base, id: 'r1', title: 'In lettura', seriesNo: '4', status: 'in-lettura' },
  ]);
  const sno = id => p.locator(`#main [data-id="${id}"] .sno`);
  ok('bollino su dorso disegnato', (await sno('d1').innerText().catch(() => '')).trim() === '3');
  ok('bollino su dorso con foto', (await sno('f1').innerText().catch(() => '')).trim() === '3');
  ok('niente bollino senza numero', await sno('n1').count() === 0);
  ok('etichetta del dorso con serie e numero', /, Slough House numero 3$/.test(await p.locator('#main [data-id="d1"]').getAttribute('aria-label')));
  const [s, w] = [await p.locator('#main [data-id="w1"]').boundingBox(), await sno('w1').boundingBox()];
  ok('bollino 12.5 dentro un dorso sottile', s && w && w.x >= s.x - 0.5 && w.x + w.width <= s.x + s.width + 0.5 && w.y >= s.y && w.y + w.height <= s.y + s.height, JSON.stringify([s, w]));
  ok('classe long per 12.5 e 100, non per 3', await p.locator('#main [data-id="w1"] .sno.long').count() === 1 && await p.locator('#main [data-id="c1"] .sno.long').count() === 1 && await p.locator('#main [data-id="d1"] .sno.long').count() === 0);
  const rc = p.locator('#hero .rcard');
  ok('scheda In lettura: «Slough House · 4», senza bollino', /Slough House · 4/.test(await rc.innerText()) && await rc.locator('.sno').count() === 0);
  await p.locator('.viewsw [data-mode="copertine"]').first().click();
  await p.waitForSelector('#main .card');
  ok('bollino su copertina', (await sno('d1').innerText().catch(() => '')).trim() === '3' && await sno('n1').count() === 0);
  ok('etichetta della copertina con serie e numero', /Slough House numero 3/.test(await p.locator('#main [data-id="d1"]').getAttribute('aria-label')));
  ok('bollino: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function ordine(browser) {
  const p = await newPage(browser);
  const base = { added: 1, rating: 0, status: 'da-leggere', author: 'Mick Herron' };
  await load(p, [
    { ...base, id: 'v10', title: 'Decimo', series: 'Slough House', seriesNo: '10', year: 2022 },
    { ...base, id: 'nos', title: 'Abbazia', year: 1990 },
    { ...base, id: 'nos2', title: 'Zattera', year: 1980 },
    { ...base, id: 'v2', title: 'Secondo', series: 'Slough House', seriesNo: '2', year: 2011 },
    { ...base, id: 'v1', title: 'Primo', series: 'Slough House', seriesNo: '1', year: 2010 },
    { ...base, id: 'alt', title: 'Altro', author: 'Zeno Zanetti', series: 'Altra', seriesNo: '1' },
  ], { sort: 'autore' });
  await p.locator('#sort-btn').click(); await p.locator('#sort-menu [data-v="autore"]').click();
  const ids = await p.locator('[data-shelf="da-leggere"] .spine').evaluateAll(s => s.map(x => x.dataset.id));
  ok('ordine Autore: #1, #2, #10 della serie, poi i libri senza serie per titolo', JSON.stringify(ids) === JSON.stringify(['v1', 'v2', 'v10', 'nos', 'nos2', 'alt']), JSON.stringify(ids));
  await p.close2();
}

export default async function ({ browser }) {
  await pulizia(browser);
  await titoli(browser);
  await scheda(browser);
  await bollino(browser);
  await ordine(browser);
}
