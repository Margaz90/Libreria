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

// --- Ricerca della serie (Wikidata, Open Library, conferma del seguito italiano), con fonti simulate ---
const W = (id, names, s, n, it) => ({ work: { value: 'http://www.wikidata.org/entity/' + id }, names: { value: names }, ...(s ? { s: { value: s } } : {}), ...(n ? { n: { value: n } } : {}), ...(it ? { it: { value: it } } : {}) });
async function fonti(browser) {
  const p = await newPage(browser, { external: 'allow' });
  p.cfg = { isbn: [], works: [], ids: ['Q1'], ol: null, olWork: null, apple: [], google: [], fail: null };
  p.n = { isbn: 0, autore: 0, cerca: 0 }; p.q = [];
  const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await p.route(/query\.wikidata\.org/, r => {
    if (p.cfg.fail === 'rete') return r.abort();
    if (p.cfg.fail) return json(r, {}, p.cfg.fail);
    const q = decodeURIComponent(new URL(r.request().url()).searchParams.get('query') || ''); p.q.push(q);
    const serie = /P179/.test(q), isbn = /P212/.test(q), autore = /P50/.test(q);
    if (isbn) p.n.isbn++; if (autore) p.n.autore++;
    json(r, { results: { bindings: !serie ? [] : isbn ? p.cfg.isbn : autore ? p.cfg.works : [] } });
  });
  await p.route(/www\.wikidata\.org\/w\/api\.php/, r => { p.n.cerca++; if (p.cfg.fail === 'rete') return r.abort(); json(r, { search: p.cfg.ids.map(id => ({ id })) }); });
  await p.route(/openlibrary\.org\/isbn\//, r => p.cfg.ol ? json(r, p.cfg.ol) : json(r, {}, 404));
  await p.route(/openlibrary\.org\/works\//, r => p.cfg.olWork ? json(r, p.cfg.olWork) : json(r, {}, 404));
  await p.route(/openlibrary\.org\/search/, r => json(r, { docs: [] }));
  await p.route(/itunes\.apple\.com/, r => { const cb = new URL(r.request().url()).searchParams.get('callback'); r.fulfill({ status: 200, contentType: 'application/javascript', body: `${cb}(${JSON.stringify({ results: p.cfg.apple.map(t => ({ trackName: t, artistName: 'Mick Herron' })) })})` }); });
  await p.route(/www\.googleapis\.com\/books/, r => json(r, { items: p.cfg.google.map(t => ({ volumeInfo: { title: t, authors: ['Mick Herron'], language: 'it' } })) }));
  return p;
}
const find = (p, b, twice) => p.evaluate(async ([b, twice]) => {
  const S = window.libreriaSeries, c = new Map();
  try { const r = await S.findSeries(b, c); if (twice) await S.findSeries({ ...b, title: twice }, c); return r; } catch (e) { return { err: e && e.code }; }
}, [b, twice || null]);

async function ricerca(browser) {
  const p = await fonti(browser);
  await p.goto(APP + '/'); await p.waitForSelector('#main');
  const MH = { author: 'Mick Herron' };
  // Passo 1: ISBN → opera → serie e numero
  p.cfg.isbn = [W('Q10', 'Real Tigers', 'Slough House', '3')];
  let r = await find(p, { ...MH, title: 'Tigri vere', isbn: '978-88-452-9999-7' });
  ok('passo 1: ISBN → serie, numero dal qualificatore', r && r.series === 'Slough House' && r.no === '3' && p.n.autore === 0, JSON.stringify(r));
  const q1 = p.q.find(q => /P212/.test(q)) || '';
  ok('passo 1: numero anche da P1545 diretta, seguito anche da P156 diretta', /pq:P1545/.test(q1) && /wdt:P1545/.test(q1) && /pq:P156/.test(q1) && /wdt:P156/.test(q1) && /P629/.test(q1), q1.slice(0, 300));
  ok('passo 1: ISBN con i trattini come su Wikidata (P212 e P957)', q1.includes('"978-88-452-9999-7"') && q1.includes('"88-452-9999-6"') && /wdt:P212\|wdt:P957/.test(q1), q1.slice(0, 300));
  ok('edizioni escluse dalle opere (collana editoriale), rango migliore, etichetta mul', /FILTER NOT EXISTS \{ \?work wdt:P629 \[\] \}/.test(q1) && /wikibase:BestRank/.test(q1) && /"mul"/.test(q1) && /GROUP BY \?work \?st/.test(q1));
  // Opera in due serie: il numero è quello della sua serie
  p.cfg.isbn = []; p.cfg.works = [W('Q20', 'Guards! Guards!|A me le guardie!', 'City Watch'), W('Q20', 'Guards! Guards!|A me le guardie!', 'Discworld', '8')];
  r = await find(p, { author: 'Terry Pratchett', title: 'A me le guardie!' });
  ok('opera in due serie: numero della serie giusta', r && r.series === 'Discworld' && r.no === '8', JSON.stringify(r));
  // Titolo identico vince sul titolo che inizia allo stesso modo
  p.cfg.works = [W('Q31', 'Foundation and Empire|Fondazione e Impero', 'Ciclo della Fondazione', '2'), W('Q30', 'Foundation|Fondazione', 'Ciclo della Fondazione', '1')];
  r = await find(p, { author: 'Isaac Asimov', title: 'Fondazione' });
  ok('titolo identico preferito: «Fondazione» non è ambiguo', r && r.no === '1', JSON.stringify(r));
  // Passo 2: titolo contro etichette e alias delle opere dell'autore
  p.cfg.isbn = []; p.cfg.works = [W('Q11', 'Dead Lions|Leoni morti', 'Slough House', '2'), W('Q10', 'Real Tigers|Tigri vere', 'Slough House', '3')];
  r = await find(p, { ...MH, title: 'Tigri vere' });
  ok('passo 2: titolo italiano contro alias inglese dell\'opera', r && r.series === 'Slough House' && r.no === '3', JSON.stringify(r));
  // Passo 3: titolo originale da Open Library
  p.cfg.works = [W('Q12', 'Spook Street', 'Slough House', '4')]; p.cfg.ol = { translation_of: 'Spook Street' };
  r = await find(p, { ...MH, title: 'Il gatto di Pitt', isbn: '9788845299997' });
  ok('passo 3: titolo originale da Open Library', r && r.series === 'Slough House' && r.no === '4', JSON.stringify(r));
  p.cfg.ol = { works: [{ key: '/works/OL1W' }] }; p.cfg.olWork = { title: 'Spook Street' };
  r = await find(p, { ...MH, title: 'Il gatto di Pitt', isbn: '9788845299997' });
  ok('passo 3: titolo dall\'opera Open Library', r && r.no === '4', JSON.stringify(r));
  p.cfg.ol = null;
  // Due opere diverse con lo stesso titolo: mai indovinare
  p.cfg.works = [W('Q10', 'Tigri vere', 'Slough House', '3'), W('Q99', 'Tigri vere', 'Altra serie', '1')];
  r = await find(p, { ...MH, title: 'Tigri vere' });
  ok('due opere che combaciano: nessuna serie', r === null, JSON.stringify(r));
  // Stessa cache: una sola interrogazione per autore
  p.cfg.works = [W('Q11', 'Dead Lions|Leoni morti', 'Slough House', '2'), W('Q10', 'Real Tigers|Tigri vere', 'Slough House', '3')];
  p.n.autore = 0; p.n.cerca = 0;
  await find(p, { ...MH, title: 'Tigri vere' }, 'Leoni morti');
  ok('una sola interrogazione per autore su due libri', p.n.autore === 1 && p.n.cerca === 1, JSON.stringify(p.n));
  // Seguito italiano
  p.cfg.works = [W('Q10', 'Real Tigers|Tigri vere', 'Slough House', '3')];
  r = await find(p, { ...MH, title: 'Tigri vere' });
  ok('seguito senza etichetta italiana: assente', r && r.next === undefined, JSON.stringify(r));
  p.cfg.works = [W('Q10', 'Real Tigers|Tigri vere', 'Slough House', '3', 'La strada degli spettri')];
  r = await find(p, { ...MH, title: 'Tigri vere' });
  ok('etichetta italiana ma nessuna edizione: assente', r && r.series === 'Slough House' && r.next === undefined, JSON.stringify(r));
  p.cfg.apple = ['La strada degli spettri'];
  r = await find(p, { ...MH, title: 'Tigri vere' });
  ok('edizione trovata su Apple Books: titolo italiano', r && r.next === 'La strada degli spettri', JSON.stringify(r));
  p.cfg.apple = []; p.cfg.google = ['La strada degli spettri: romanzo'];
  r = await find(p, { ...MH, title: 'Tigri vere' });
  ok('edizione trovata su Google Books: titolo italiano', r && r.next === 'La strada degli spettri', JSON.stringify(r));
  p.cfg.google = [];
  // Errori di Wikidata
  p.cfg.fail = 'rete'; r = await find(p, { ...MH, title: 'Altro', isbn: '9788845299997' });
  ok('errore di rete: codice wikidata-rete', r && r.err === 'wikidata-rete', JSON.stringify(r));
  p.cfg.fail = 503; r = await find(p, { ...MH, title: 'Altro', isbn: '9788845299997' });
  ok('Wikidata giù: codice wikidata-503', r && r.err === 'wikidata-503', JSON.stringify(r));
  p.cfg.fail = null;
  ok('ricerca: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function usoRicerca(browser) {
  const p = await fonti(browser);
  const base = { added: 1, rating: 0, status: 'da-leggere', author: 'Mick Herron' };
  await load(p, [
    { ...base, id: 'a1', title: 'Tigri vere' },
    { ...base, id: 'a2', title: 'Tigri vere bis', series: 'Mia serie', seriesNo: '9', seriesManual: true },
    { ...base, id: 'a3', title: 'Leoni morti', series: 'Vecchia', seriesNo: '7', seriesNext: 'Seguito' },
    { ...base, id: 'a4', title: 'Libro HTML' },
    { ...base, id: 'a5', title: 'Senza numero', series: 'Vecchia', seriesNo: '7', seriesNext: 'Seguito' },
  ]);
  p.cfg.works = [W('Q10', 'Real Tigers|Tigri vere|Tigri vere bis', 'Slough House', '3', 'La strada degli spettri'), W('Q11', 'Dead Lions|Leoni morti', 'Slough House', '2'), W('Q12', 'Spook Street|La strada degli spettri', 'Slough House', '4'),
    W('Q14', 'Senza numero', 'Slough House'), W('Q13', 'Libro HTML', '<img src=x onerror="window.__x=1">', '1')];
  p.cfg.apple = ['La strada degli spettri'];
  const open = async id => { await p.locator(`#main [data-id="${id}"]`).click(); await p.waitForSelector('.sheet'); };
  const refresh = async () => { await p.locator('#s-refresh').click(); await p.waitForFunction(() => !document.querySelector('#s-refresh').disabled && !/Cerco/.test(document.querySelector('#s-ref-status').textContent), null, { timeout: 8000 }).catch(() => {}); };
  const save = async () => { await p.locator('#s-save').click(); await p.waitForSelector('.sheet', { state: 'detached' }); };

  await open('a1'); await refresh();
  ok('Aggiorna informazioni riempie Serie e N.', await p.inputValue('#d-series') === 'Slough House' && await p.inputValue('#d-series-no') === '3', await p.locator('#s-ref-status').innerText());
  await save(); await until(p, 'a1', { series: 'Slough House', seriesNo: '3', seriesNext: 'La strada degli spettri' });
  let b = await book(p, 'a1');
  ok('Aggiorna informazioni: salvati serie, numero e seguito, senza seriesManual', b.series === 'Slough House' && b.seriesNo === '3' && b.seriesNext === 'La strada degli spettri' && b.seriesManual === undefined, JSON.stringify(b));

  await open('a2'); await refresh();
  const manual = await p.inputValue('#d-series') === 'Mia serie' && await p.inputValue('#d-series-no') === '9';
  await save(); await p.waitForTimeout(900); b = await book(p, 'a2');
  ok('Aggiorna informazioni rispetta seriesManual', manual && b.series === 'Mia serie' && b.seriesNo === '9' && b.seriesManual === true, JSON.stringify(b));

  await open('a4'); await refresh(); await save();
  await until(p, 'a4', { seriesNo: '1' });
  b = await book(p, 'a4');
  await open('a4');
  const shown = await p.locator('.sheet-top button[data-series]').innerText().catch(() => '');
  ok('testi con HTML da Wikidata innocui', b.series === '<img src=x onerror="window.__x=1">' && /<img src=x/.test(shown) && await p.locator('img[src="x"]').count() === 0 && await p.evaluate(() => window.__x === undefined), shown);
  await p.keyboard.press('Escape'); await p.waitForSelector('.sheet', { state: 'detached' }).catch(() => {});

  // Serie diversa: numero e seguito vecchi tolti
  await open('a5'); await refresh(); await save();
  await until(p, 'a5', { series: 'Slough House', seriesNo: null, seriesNext: null });
  b = await book(p, 'a5');
  ok('serie cambiata: numero e seguito vecchi tolti', b.series === 'Slough House' && b.seriesNo === undefined && b.seriesNext === undefined && b.seriesManual === undefined, JSON.stringify(b));

  // Errore di rete: i campi restano
  p.cfg.fail = 'rete';
  await open('a3'); await refresh();
  const kept = await p.inputValue('#d-series') === 'Vecchia' && await p.inputValue('#d-series-no') === '7';
  await save(); await p.waitForTimeout(900); b = await book(p, 'a3');
  ok('errore di rete: i campi restano', kept && b.series === 'Vecchia' && b.seriesNo === '7' && b.seriesNext === 'Seguito', JSON.stringify(b));
  p.cfg.fail = null;

  // Nuovo libro: ricerca in sottofondo dopo il salvataggio
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
  await p.locator('.dock .add').first().click(); await p.waitForSelector('#d-title');
  await p.fill('#d-title', 'La strada degli spettri'); await p.fill('#d-author', 'Mick Herron');
  await p.locator('#a-save').click(); await p.waitForSelector('.sheet', { state: 'detached' });
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').some(x => x.title === 'La strada degli spettri' && x.series), null, { timeout: 6000 }).catch(() => {});
  b = (await localBooks(p)).find(x => x.title === 'La strada degli spettri') || {};
  ok('nuovo libro: serie trovata in sottofondo', b.series === 'Slough House' && b.seriesNo === '4' && b.seriesManual === undefined, JSON.stringify(b));
  ok('uso della ricerca: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

// --- «Cerca le serie» in sottofondo (Altro → Backup) ---
async function cercaSerie(browser) {
  const p = await fonti(browser);
  const base = { added: 1, rating: 0, status: 'da-leggere', author: 'Mick Herron' };
  const toasts = () => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  const backup = async () => { await p.evaluate(() => window.scrollTo(0, 0)); await p.locator('.dock .more').click(); await p.locator('[data-m=backup]').click(); await p.waitForSelector('#i-series'); };
  const waitToast = (re, ms = 10000) => p.waitForFunction(r => new RegExp(r).test([...document.querySelectorAll('.toast')].map(t => t.textContent).join(' ')), re.source, { timeout: ms }).catch(() => {});
  const run = async () => { await backup(); await p.locator('#i-series').click(); };
  const lib = [
    { ...base, id: 't1', title: 'Tigri vere' },
    { ...base, id: 't2', title: 'Leoni morti', series: 'Mia serie', seriesNo: '9', seriesManual: true },
    { ...base, id: 't3', title: 'Spook Street', status: 'letto', finishedYear: 2020, series: 'Slough House', seriesNo: '4' },
    { ...base, id: 't4', title: 'Libro ignoto' },
  ];
  await load(p, lib);
  p.cfg.works = [W('Q10', 'Real Tigers|Tigri vere|Leoni morti', 'Slough House', '3'), W('Q12', 'Spook Street', 'Slough House', '4', 'La strada degli spettri')];
  p.cfg.apple = ['La strada degli spettri'];
  await run();
  await p.waitForFunction(() => /Ricerca delle serie: \d di 3/.test(document.querySelector('#enrich').textContent), null, { timeout: 5000 }).catch(() => {});
  const line = await p.locator('#enrich').innerText();
  await waitToast(/Serie trovate/);
  const msg = await toasts();
  ok('riga di avanzamento e messaggio finale «Serie trovate per 2 libri su 3»', /Ricerca delle serie: \d di 3/.test(line) && /Serie trovate per 2 libri su 3/.test(msg), line + ' / ' + msg);
  await until(p, 't1', { series: 'Slough House' }); await until(p, 't3', { seriesNext: 'La strada degli spettri' });
  const [b1, b2, b3] = [await book(p, 't1'), await book(p, 't2'), await book(p, 't3')];
  ok('salta i libri con seriesManual', b2.series === 'Mia serie' && b2.seriesNo === '9' && !b2.seriesNext, JSON.stringify(b2));
  ok('trova la serie del libro senza serie', b1.series === 'Slough House' && b1.seriesNo === '3' && b1.seriesManual === undefined, JSON.stringify(b1));
  ok('controlla il seguito dei letti senza seriesNext', b3.seriesNext === 'La strada degli spettri' && b3.series === 'Slough House', JSON.stringify(b3));
  ok('riga di avanzamento nascosta alla fine', await p.locator('#enrich').isHidden());
  await backup();
  ok('Cerca le serie crea una copia «Prima di «Cerca le serie»»', /Prima di «Cerca le serie»/.test(await p.locator('#u-list .urow').first().innerText().catch(() => '')));
  await p.locator('#i-close').click();
  // niente da fare: nessuna copia nuova
  await p.evaluate(() => { document.querySelectorAll('.toast').forEach(t => t.remove()); });
  await load(p, [{ ...base, id: 'z1', title: 'Manuale', seriesManual: true, series: 'X' }]);
  await run(); await waitToast(/Nessun libro da cercare/, 4000);
  ok('nessun libro da cercare: messaggio', /Nessun libro da cercare\./.test(await toasts()), await toasts());
  await p.locator('#i-close').click().catch(() => {});

  // Wikidata 503: il messaggio lo dice
  await load(p, [{ ...base, id: 'e1', title: 'Tigri vere' }]);
  p.cfg.fail = 503; await run(); await waitToast(/Serie trovate/);
  const em = await toasts();
  ok('Wikidata 503 a metà: prosegue e il messaggio lo dice', /Serie trovate per 0 libri su 1/.test(em) && /Wikidata non risponde ×1/.test(em), em);
  p.cfg.fail = null;

  // Il ripristino ferma la ricerca
  await load(p, Array.from({ length: 8 }, (_, i) => ({ ...base, id: 'r' + i, title: 'Tigri vere ' + i })));
  p.cfg.works = [W('Q10', 'Tigri vere 0|Tigri vere 1|Tigri vere 2|Tigri vere 3|Tigri vere 4|Tigri vere 5|Tigri vere 6|Tigri vere 7', 'Slough House', '3')];
  await p.route(/query\.wikidata\.org/, async r => { await new Promise(x => setTimeout(x, 400)); r.fallback(); });
  await run();
  await p.waitForFunction(() => /Ricerca delle serie: 1 di 8/.test(document.querySelector('#enrich').textContent), null, { timeout: 5000 }).catch(() => {});
  await backup();
  await p.locator('#u-list button[data-restore]').first().click(); await p.locator('#u-list button[data-restore]').first().click();
  await p.waitForFunction(() => document.querySelector('#enrich').hidden, null, { timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(2500);
  const rb = await localBooks(p);
  ok('il ripristino ferma la ricerca', await p.locator('#enrich').isHidden() && rb.every(b => !b.series) && !/Serie trovate/.test(await toasts()), JSON.stringify(rb.map(b => b.series)));

  // Non parte durante «Completa autori e copertine»
  await load(p, Array.from({ length: 8 }, (_, i) => ({ ...base, id: 'k' + i, title: 'Tigri vere ' + i, author: '' })));
  await backup(); await p.locator('#i-authors').click();
  await p.waitForFunction(() => !document.querySelector('#enrich').hidden, null, { timeout: 5000 }).catch(() => {});
  await backup(); await p.locator('#i-series').click();
  const busy = await toasts();
  ok('non parte durante Completa autori e copertine', /Aggiornamento già in corso\./.test(busy) && !/Ricerca delle serie/.test(await p.locator('#enrich').innerText()), busy);
  ok('Cerca le serie: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

export default async function ({ browser }) {
  await ricerca(browser);
  await usoRicerca(browser);
  await pulizia(browser);
  await titoli(browser);
  await scheda(browser);
  await bollino(browser);
  await ordine(browser);
  await cercaSerie(browser);
}
