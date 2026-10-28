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
// Aspetta il salvataggio del libro (updated cambia) dopo Salva.
const saved = (p, id, prev) => p.waitForFunction(([id, prev]) => {
  const b = JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').find(x => x.id === id);
  return b && b.updated !== prev;
}, [id, prev], { timeout: 4000 }).catch(() => {});
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
  const u2 = (await book(p, 's2')).updated;
  await open('s2'); await save(); await saved(p, 's2', u2);
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
    { ...base, id: 'f2', title: 'Foto sottile', seriesNo: '12', spine: PNG, spineRatio: 0.01 },
  ]);
  const sno = id => p.locator(`#main [data-id="${id}"] .sno`);
  ok('bollino su dorso disegnato', (await sno('d1').innerText().catch(() => '')).trim() === '3');
  ok('bollino su dorso con foto', (await sno('f1').innerText().catch(() => '')).trim() === '3');
  ok('niente bollino senza numero', await sno('n1').count() === 0);
  ok('etichetta del dorso con serie e numero', /, Slough House numero 3$/.test(await p.locator('#main [data-id="d1"]').getAttribute('aria-label')));
  const [s, w] = [await p.locator('#main [data-id="w1"]').boundingBox(), await sno('w1').boundingBox()];
  ok('bollino 12.5 dentro un dorso sottile', s && w && w.x >= s.x - 0.5 && w.x + w.width <= s.x + s.width + 0.5 && w.y >= s.y && w.y + w.height <= s.y + s.height, JSON.stringify([s, w]));
  const [fs, fw] = [await p.locator('#main [data-id="f2"]').boundingBox(), await sno('f2').boundingBox()];
  const fit = await sno('f2').evaluate(e => e.scrollWidth <= e.clientWidth).catch(() => false);
  ok('bollino 12 dentro un dorso con foto di 16 px, cifre intere', fs && fw && Math.round(fs.width) === 16 && fw.x >= fs.x - 0.5 && fw.x + fw.width <= fs.x + fs.width + 0.5 && fit, JSON.stringify([fs, fw, fit]));
  ok('classe long per 12.5 e 100, non per 3', await p.locator('#main [data-id="w1"] .sno.long').count() === 1 && await p.locator('#main [data-id="c1"] .sno.long').count() === 1 && await p.locator('#main [data-id="d1"] .sno.long').count() === 0);
  const rc = p.locator('#hero .rcard');
  ok('scheda In lettura: «Slough House · 4», senza bollino', /Slough House · 4/.test(await rc.innerText()) && await rc.locator('.sno').count() === 0);
  await p.locator('.viewsw [data-mode="copertine"]').first().click();
  await p.waitForSelector('#main .card[data-id="d1"] .sno');
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
const E = id => ({ value: 'http://www.wikidata.org/entity/' + id });
// Opera simulata: W(opera, titoli separati da |, serie, numero, seguito italiano, edizione dell'ISBN).
// Il finto Wikidata la trasforma nelle righe di C1 (opere e dichiarazioni) e C2 (etichette).
const W = (id, names, s, n, it, ed) => ({ id, names, s, n, it, ed });
const QN = new Map(), qn = t => { if (!QN.has(t)) QN.set(t, 'Q' + (9000 + QN.size)); return QN.get(t); }; // elementi finti per serie e seguiti
const c1Rows = ws => ws.map(w => ({ work: E(w.id), ...(w.ed ? { ed: E(w.ed) } : {}),
  ...(w.s ? { st: { value: 'http://www.wikidata.org/entity/statement/' + w.id + '-' + qn('s:' + w.s) }, ser: E(qn('s:' + w.s)) } : {}),
  ...(w.n ? { no: { value: w.n } } : {}), ...(w.it ? { nx: E(qn('n:' + w.it)) } : {}) }));
const c2Rows = (q, ws) => {
  const ids = ((q.match(/VALUES \?x \{([^}]*)\}/) || [])[1] || '').match(/Q\d+/g) || [], out = [];
  const L = (x, nm, lg) => out.push({ x: E(x), nm: { type: 'literal', value: nm, 'xml:lang': lg }, lg: { value: lg } });
  for (const x of ids) {
    for (const w of ws) if (w.id === x) for (const nm of String(w.names || '').split('|').filter(Boolean)) L(x, nm, 'en');
    for (const [t, q2] of QN) if (q2 === x) L(x, t.slice(2), 'it');
  }
  return out;
};
async function fonti(browser) {
  const p = await newPage(browser, { external: 'allow' });
  // failIf(q): stato HTTP per una sola interrogazione; idsBy(nome): candidati per autore; delay: risposta lenta (ms)
  p.cfg = { isbn: [], works: [], ids: ['Q1'], ol: null, olWork: null, apple: [], appleAuthor: 'Mick Herron', google: [], fail: null, failIf: null, idsBy: null, delay: 0 };
  p.n = { isbn: 0, autore: 0, cerca: 0 }; p.q = [];
  const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await p.route(/query\.wikidata\.org/, async r => {
    if (p.cfg.delay) await new Promise(x => setTimeout(x, p.cfg.delay));
    if (p.cfg.fail === 'rete') return r.abort();
    if (p.cfg.fail) return json(r, {}, p.cfg.fail);
    const q = decodeURIComponent(new URL(r.request().url()).searchParams.get('query') || ''); p.q.push(q);
    if (p.cfg.hangIf && p.cfg.hangIf(q)) return; // risposta che non arriva mai
    const st = p.cfg.failIf && p.cfg.failIf(q); if (st) return json(r, {}, st);
    if (/\?nm/.test(q) && /VALUES \?x/.test(q)) return json(r, { results: { bindings: c2Rows(q, [...p.cfg.isbn, ...p.cfg.works]) } });
    const serie = /P179/.test(q), isbn = /P212/.test(q), autore = /P50/.test(q);
    if (isbn) p.n.isbn++; if (autore) p.n.autore++;
    json(r, { results: { bindings: !serie ? [] : c1Rows(isbn ? p.cfg.isbn : autore ? p.cfg.works : []) } });
  });
  await p.route(/www\.wikidata\.org\/w\/api\.php/, r => { p.n.cerca++; if (p.cfg.fail === 'rete') return r.abort(); const a = new URL(r.request().url()).searchParams.get('search'); json(r, { search: (p.cfg.idsBy ? p.cfg.idsBy(a) : p.cfg.ids).map(id => ({ id })) }); });
  await p.route(/openlibrary\.org\/isbn\//, r => p.cfg.ol ? json(r, p.cfg.ol) : json(r, {}, 404));
  await p.route(/openlibrary\.org\/works\//, r => p.cfg.olWork ? json(r, p.cfg.olWork) : json(r, {}, 404));
  await p.route(/openlibrary\.org\/search/, r => { p.olq = decodeURIComponent(r.request().url()); json(r, { docs: p.cfg.olSearch || [] }); });
  await p.route(/itunes\.apple\.com/, r => { const cb = new URL(r.request().url()).searchParams.get('callback'); r.fulfill({ status: 200, contentType: 'application/javascript', body: `${cb}(${JSON.stringify({ results: p.cfg.apple.map(t => ({ trackName: t, artistName: p.cfg.appleAuthor })) })})` }); });
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
  ok('edizioni escluse dalle opere (collana editoriale), rango migliore, etichetta mul', /FILTER NOT EXISTS \{ \?work wdt:P629 \?e0 \}/.test(q1) && /wikibase:BestRank/.test(q1) && p.q.some(q => /VALUES \?x/.test(q) && /"mul"/.test(q)) && !p.q.some(q => /GROUP BY/.test(q)));
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
  const qa = p.q.filter(q => /P50/.test(q)).pop() || '';
  ok('passo 2: interrogazione per autore veloce (ordine fissato, senza GROUP_CONCAT né rdfs:label|skos:altLabel)', qa.includes('hint:Query hint:optimizer "None"') && !qa.includes('GROUP_CONCAT') && !qa.includes('rdfs:label|skos:altLabel'), qa.slice(0, 300));
  // Passo 3: titolo originale da Open Library
  p.cfg.works = [W('Q12', 'Spook Street', 'Slough House', '4')]; p.cfg.ol = { translation_of: 'Spook Street' };
  r = await find(p, { ...MH, title: 'Il gatto di Pitt', isbn: '9788845299997' });
  ok('passo 3: titolo originale da Open Library', r && r.series === 'Slough House' && r.no === '4', JSON.stringify(r));
  // Passo 3 senza ISBN: titolo originale dalla ricerca di Open Library (titolo e autore)
  p.cfg.ol = null; p.cfg.works = [W('Q10', 'Slow Horses', 'Slough House', '1')]; p.cfg.olSearch = [{ title: 'Slow Horses', author_name: ['Mick Herron'] }];
  r = await find(p, { ...MH, title: 'Un covo di bastardi' });
  ok('passo 3 senza ISBN: titolo originale dalla ricerca di Open Library', r && r.series === 'Slough House' && r.no === '1' && /Un covo di bastardi/.test(p.olq || ''), JSON.stringify(r) + ' ' + p.olq);
  p.cfg.olSearch = [{ title: 'Slow Horses', author_name: ['Altra Persona'] }];
  r = await find(p, { ...MH, title: 'Un covo di bastardi' });
  ok('passo 3 senza ISBN: un risultato di un altro autore non vale', r === null, JSON.stringify(r));
  p.cfg.olSearch = null;
  // Ricerca dell'autore rifiutata da Wikidata (risposta senza candidati): riprova una volta
  p.cfg.idsBy = a => (p.rifiuti = (p.rifiuti || 0) + 1) === 1 ? [] : ['Q1'];
  p.cfg.works = [W('Q43', 'Harry Potter e la pietra filosofale', 'Harry Potter', '1')];
  r = await find(p, { author: 'J.K. Rowling', title: 'Harry Potter e la pietra filosofale' });
  ok('ricerca autore senza candidati: riprova una volta', r && r.series === 'Harry Potter' && r.no === '1' && p.rifiuti === 2, JSON.stringify(r) + ' tentativi ' + p.rifiuti);
  p.cfg.idsBy = null; p.cfg.works = [W('Q12', 'Spook Street', 'Slough House', '4')];
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
  // Stesso titolo ma di un altro autore: non è il seguito
  p.cfg.apple = ['La strada degli spettri']; p.cfg.appleAuthor = 'Altro Scrittore';
  r = await find(p, { ...MH, title: 'Tigri vere' });
  ok('seguito: titolo uguale di un altro autore non conta', r && r.series === 'Slough House' && r.next === undefined, JSON.stringify(r));
  p.cfg.apple = []; p.cfg.appleAuthor = 'Mick Herron';
  // Libro con la sua serie: in un'opera di due serie vale la riga della sua serie
  p.cfg.works = [W('Q20', 'Guards! Guards!|A me le guardie!', 'City Watch', '1'), W('Q20', 'Guards! Guards!|A me le guardie!', 'Discworld', '8')];
  r = await find(p, { author: 'Terry Pratchett', title: 'A me le guardie!', series: 'discworld' });
  ok('opera in due serie: preferita la serie che il libro ha già', r && r.series === 'Discworld' && r.no === '8', JSON.stringify(r));
  // Senza titolo: nessuna opera
  p.cfg.works = [W('Q10', 'Real Tigers|Tigri vere', 'Slough House', '3')];
  r = await find(p, { ...MH, title: '' });
  ok('senza titolo: nessuna serie', r === null, JSON.stringify(r));
  // Omonimi: due autori candidati con opere dal titolo simile → mai indovinare
  p.cfg.ids = ['Q1', 'Q2']; p.cfg.works = [W('Q80', 'La torre', 'Serie del primo', '1'), W('Q81', 'La torre: romanzo', 'Serie del secondo', '2')];
  r = await find(p, { author: 'Mario Rossi', title: 'La torre' });
  ok('omonimi con opere dal titolo simile: nessuna serie', r === null, JSON.stringify(r));
  p.cfg.ids = ['Q1'];
  // ISBN trovato ma l'opera non ha serie: niente ricerca per autore
  p.cfg.isbn = [W('Q60', 'Tigri vere', null, null, null, 'Q61')]; p.cfg.works = [W('Q10', 'Real Tigers|Tigri vere', 'Slough House', '3')];
  p.n.autore = 0; p.n.cerca = 0;
  r = await find(p, { ...MH, title: 'Tigri vere', isbn: '9788845299997' });
  ok('ISBN di un libro senza serie: si ferma, niente passo per autore', r === null && p.n.autore === 0 && p.n.cerca === 0, JSON.stringify(r) + ' ' + JSON.stringify(p.n));
  p.cfg.isbn = [W('Q61', 'Tigri vere', null, null, null, 'Q61')]; // edizione senza opera collegata: si prova per autore
  p.n.autore = 0;
  r = await find(p, { ...MH, title: 'Tigri vere', isbn: '9788845299997' });
  ok('ISBN di un\'edizione senza opera: prosegue per autore', r && r.series === 'Slough House' && p.n.autore === 1, JSON.stringify(r) + ' ' + JSON.stringify(p.n));
  p.cfg.isbn = [];
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
    { ...base, id: 'a6', title: 'Tigri vere', author: '' },
    { ...base, id: 'a7', title: 'Leoni morti', series: 'Mia', seriesNo: '1', seriesNext: 'Dopo', seriesManual: true },
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

  const ua2 = (await book(p, 'a2')).updated;
  await open('a2'); await refresh();
  const manual = await p.inputValue('#d-series') === 'Mia serie' && await p.inputValue('#d-series-no') === '9';
  await save(); await saved(p, 'a2', ua2); b = await book(p, 'a2');
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
  const ua3 = (await book(p, 'a3')).updated;
  await open('a3'); await refresh();
  const kept = await p.inputValue('#d-series') === 'Vecchia' && await p.inputValue('#d-series-no') === '7';
  await save(); await saved(p, 'a3', ua3); b = await book(p, 'a3');
  ok('errore di rete: i campi restano', kept && b.series === 'Vecchia' && b.seriesNo === '7' && b.seriesNext === 'Seguito', JSON.stringify(b));
  // Wikidata 503: la riga di stato lo dice
  p.cfg.fail = 503; p.cfg.apple = ['Tigri vere', 'La strada degli spettri'];
  await open('a6'); await refresh();
  const st503 = await p.locator('#s-ref-status').innerText();
  ok('Aggiorna informazioni con Wikidata giù: «Wikidata non risponde»', /Wikidata non risponde/.test(st503), st503);
  await p.locator('#s-close').click(); await p.locator('[data-u="drop"]').click({ timeout: 1000 }).catch(() => {}); await p.waitForSelector('.sheet', { state: 'detached' });
  p.cfg.fail = null;
  // Autore vuoto: la serie si cerca con l'autore appena trovato
  await open('a6'); await refresh();
  ok('Aggiorna informazioni senza autore: serie con l\'autore trovato', await p.inputValue('#d-author') === 'Mick Herron' && await p.inputValue('#d-series') === 'Slough House', await p.locator('#s-ref-status').innerText());
  await p.locator('#s-close').click(); await p.locator('[data-u="drop"]').click({ timeout: 1000 }).catch(() => {}); await p.waitForSelector('.sheet', { state: 'detached' });
  p.cfg.apple = ['La strada degli spettri'];
  // Serie scritta a mano e seguito già noto: niente Wikidata
  const n0 = p.n.cerca + p.n.autore + p.q.length;
  await open('a7'); await refresh();
  ok('serie a mano con seguito: Aggiorna informazioni non interroga Wikidata', p.n.cerca + p.n.autore + p.q.length === n0, JSON.stringify(p.n));
  await p.locator('#s-close').click(); await p.locator('[data-u="drop"]').click({ timeout: 1000 }).catch(() => {}); await p.waitForSelector('.sheet', { state: 'detached' });

  // Nuovo libro: ricerca in sottofondo dopo il salvataggio
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
  await p.locator('.dock .add').first().click(); await p.waitForSelector('#d-title');
  await p.waitForFunction(() => document.activeElement && document.activeElement.id === 's-q'); // la scheda ha finito di aprirsi
  await p.fill('#d-title', 'La strada degli spettri'); await p.fill('#d-author', 'Mick Herron');
  await p.locator('#a-save').click(); await p.waitForSelector('.sheet', { state: 'detached' });
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').some(x => x.title === 'La strada degli spettri' && x.series), null, { timeout: 12000 }).catch(() => {});
  b = (await localBooks(p)).find(x => x.title === 'La strada degli spettri') || {};
  ok('nuovo libro: serie trovata in sottofondo', b.series === 'Slough House' && b.seriesNo === '4' && b.seriesManual === undefined, 'autore: ' + b.author + ' · ' + JSON.stringify(b));
  // Nuovo libro aperto prima che arrivi la serie: Salva non la cancella
  p.cfg.delay = 1500;
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
  await p.locator('.dock .add').first().click(); await p.waitForSelector('#d-title');
  await p.waitForFunction(() => document.activeElement && document.activeElement.id === 's-q');
  await p.fill('#d-title', 'Dead Lions'); await p.fill('#d-author', 'Mick Herron');
  await p.locator('#a-save').click(); await p.waitForSelector('.sheet', { state: 'detached' });
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').some(x => x.title === 'Dead Lions'), null, { timeout: 4000 }).catch(() => {});
  const dl = (await localBooks(p)).find(x => x.title === 'Dead Lions') || {};
  await p.locator(`#main [data-id="${dl.id}"]`).first().click(); await p.waitForSelector('.sheet');
  await until(p, dl.id, { series: 'Slough House' });
  const udl = (await book(p, dl.id) || {}).updated;
  await p.locator('#f-notes').fill('nota'); await save(); await saved(p, dl.id, udl);
  b = await book(p, dl.id) || {};
  ok('scheda aperta durante la ricerca in sottofondo: Salva tiene la serie', b.series === 'Slough House' && b.seriesNo === '2' && b.notes === 'nota', JSON.stringify(b));
  p.cfg.delay = 0;
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

  const clear = () => p.evaluate(() => { document.querySelectorAll('.toast').forEach(t => t.remove()); });
  // Wikidata 503 solo sul libro di mezzo: prosegue, il terzo si cerca, il messaggio lo dice
  await clear();
  await load(p, [{ ...base, id: 'e1', title: 'Tigri vere' }, { ...base, id: 'e2', title: 'Libro due', author: 'Autore Due' }, { ...base, id: 'e3', title: 'Leoni morti', author: 'Terza Autrice' }]);
  p.cfg.works = [W('Q10', 'Real Tigers|Tigri vere', 'Slough House', '3'), W('Q11', 'Dead Lions|Leoni morti', 'Slough House', '2'), W('Q15', 'Libro due', 'Altra', '1')];
  p.cfg.idsBy = a => [{ 'Autore Due': 'Q2', 'Terza Autrice': 'Q3' }[a] || 'Q1'];
  p.cfg.failIf = q => /wd:Q2 /.test(q) && 503;
  await run(); await waitToast(/Serie trovate/);
  const em = await toasts();
  await until(p, 'e3', { series: 'Slough House' });
  const e3 = await book(p, 'e3');
  ok('Wikidata 503 a metà: prosegue e il messaggio lo dice', /Serie trovate per 2 libri su 3/.test(em) && /Wikidata non risponde ×1/.test(em), em);
  ok('Wikidata 503 a metà: il terzo libro si cerca lo stesso', e3.series === 'Slough House' && e3.seriesNo === '2', JSON.stringify(e3));
  p.cfg.idsBy = null; p.cfg.failIf = null;

  // Wikidata che non risponde mai sul libro di mezzo: dopo il tempo massimo si passa al libro dopo
  await clear();
  await load(p, [{ ...base, id: 'k1', title: 'Tigri vere' }, { ...base, id: 'k2', title: 'Libro due', author: 'Autore Due' }, { ...base, id: 'k3', title: 'Leoni morti', author: 'Terza Autrice' }]);
  p.cfg.works = [W('Q10', 'Real Tigers|Tigri vere', 'Slough House', '3'), W('Q11', 'Dead Lions|Leoni morti', 'Slough House', '2'), W('Q15', 'Libro due', 'Altra', '1')];
  p.cfg.idsBy = a => [{ 'Autore Due': 'Q2', 'Terza Autrice': 'Q3' }[a] || 'Q1'];
  p.cfg.hangIf = q => /wd:Q2 /.test(q);
  await p.evaluate(() => { window.libreriaNetMs = 1500; });
  await run(); await waitToast(/Serie trovate/, 15000);
  const km = await toasts();
  await until(p, 'k3', { series: 'Slough House' });
  const k3 = await book(p, 'k3');
  ok('Wikidata che non risponde: dopo il tempo massimo si passa al libro dopo', /Serie trovate per 2 libri su 3/.test(km) && /Wikidata non risponde ×1/.test(km) && k3.series === 'Slough House', km + ' · ' + JSON.stringify(k3));
  await p.evaluate(() => { delete window.libreriaNetMs; });
  p.cfg.idsBy = null; p.cfg.hangIf = null;

  // Wikidata sempre giù: dopo due errori di fila la ricerca si ferma
  await clear();
  await load(p, [{ ...base, id: 'g1', title: 'Uno' }, { ...base, id: 'g2', title: 'Due' }, { ...base, id: 'g3', title: 'Tre' }]);
  p.cfg.fail = 503; p.n.cerca = 0;
  await run(); await waitToast(/Serie trovate|interrotta/);
  await p.waitForTimeout(800);
  const gm = await toasts();
  ok('Wikidata giù: ricerca interrotta dopo due errori', /Wikidata non risponde: ricerca interrotta, riprova più tardi\./.test(gm) && /Serie trovate per 0 libri su 3/.test(gm) && p.n.cerca === 2 && await p.locator('#enrich').isHidden(), gm + ' · cerca ' + p.n.cerca);
  p.cfg.fail = null;

  // Completa autori e copertine con Wikidata giù: il messaggio dice che le serie non sono state cercate
  await clear();
  await load(p, [1, 2, 3].map(i => ({ ...base, id: 'h' + i, title: 'Libro ' + i, author: '', isbn: '978884529999' + [7, 7, 7][i - 1] })));
  p.cfg.fail = 503;
  await backup(); await p.locator('#i-authors').click();
  await waitToast(/Informazioni aggiornate/, 15000);
  const hm = await toasts();
  ok('Completa autori con Wikidata giù: «Serie non cercate: Wikidata non risponde.»', /Serie non cercate: Wikidata non risponde\./.test(hm), hm);
  p.cfg.fail = null;

  // Letti con la serie: solo il seguito, mai serie o numero
  await clear();
  const L = { status: 'letto', finishedYear: 2020 };
  await load(p, [
    { ...base, ...L, id: 'dw', title: 'A me le guardie!', author: 'Terry Pratchett', series: 'Discworld', seriesNo: '8' },
    { ...base, ...L, id: 'dx', title: 'Altro letto', isbn: '9788845299997', series: 'Mia saga', seriesNo: '2' },
  ]);
  p.cfg.works = [W('Q20', 'Guards! Guards!|A me le guardie!', 'City Watch', '1', "Uomini d'arme"), W('Q20', 'Guards! Guards!|A me le guardie!', 'Discworld', '8', 'Eric')];
  p.cfg.isbn = [W('Q50', 'Altro letto', 'Altra serie', '3', 'Seguito X')];
  p.cfg.apple = ['Eric', "Uomini d'arme", 'Seguito X']; p.cfg.appleAuthor = 'Terry Pratchett';
  await run(); await waitToast(/Serie trovate/);
  await until(p, 'dw', { seriesNext: 'Eric' });
  const [dw, dx] = [await book(p, 'dw'), await book(p, 'dx')];
  ok('letto con serie in un\'opera di due serie: serie e numero invariati, solo il seguito', dw.series === 'Discworld' && dw.seriesNo === '8' && dw.seriesNext === 'Eric', JSON.stringify(dw));
  ok('letto con serie e risultato di un\'altra serie: nulla cambia', dx.series === 'Mia saga' && dx.seriesNo === '2' && dx.seriesNext === undefined && /Serie trovate per 1 libri su 2/.test(await toasts()), JSON.stringify(dx) + ' / ' + await toasts());
  p.cfg.isbn = []; p.cfg.appleAuthor = 'Mick Herron';

  // Numero non valido da Wikidata (P1545 «1a»): nessuna scrittura
  await clear();
  await load(p, [{ ...base, ...L, id: 'iv', title: 'Tigri vere', series: 'Slough House', updated: 5 }, { ...base, id: 'iw', title: 'Leoni morti', updated: 5 }]);
  p.cfg.works = [W('Q10', 'Tigri vere', 'Slough House', '1a'), W('Q11', 'Leoni morti', 'Slough House', '2x')];
  p.cfg.apple = [];
  await run(); await waitToast(/Serie trovate/);
  await p.waitForTimeout(500);
  const iv = await book(p, 'iv'), iw = await book(p, 'iw');
  ok('numero non valido: il letto non si riscrive', iv.updated === 5 && iv.seriesNo === undefined && /Serie trovate per 1 libri su 2/.test(await toasts()), JSON.stringify(iv) + ' / ' + await toasts());
  ok('numero non valido: serie sì, numero no', iw.series === 'Slough House' && iw.seriesNo === undefined, JSON.stringify(iw));
  p.cfg.apple = ['La strada degli spettri'];

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

// --- Prossimo volume: funzione pura, riga nella scheda, «Cosa leggo adesso?» ---
async function prossimo(browser) {
  const p = await newPage(browser);
  await p.goto(APP + '/'); await p.waitForSelector('#main');
  const S = 'Slough House', L = { status: 'letto', finishedYear: 2020 }, D = { status: 'da-leggere' };
  const r = await p.evaluate(([S, L, D]) => { const N = window.libreriaSeries.next, X = window.libreriaNext.next;
    const v = (id, no, o, t) => ({ id, title: t || 'Vol ' + id, author: 'Mick Herron', series: S, seriesNo: no, ...o });
    const a = [v('v3', '3', L), v('v4', '4', { ...L, seriesNext: 'Quinto' }), v('v5', '5', D)];
    const b = [v('v1', '1', L), v('v2', '2', { ...L, seriesNext: 'Tigri vere' })];
    const c = [v('c2', '2', L), v('c3', '3', D), v('c25', '2.5', D), v('c10', '10', D)];
    const d = [...b, { id: 'x', title: 'Tigri vere: un romanzo', author: 'Mick Herron', status: 'da-leggere' }];
    const s1 = N(a[0], a), s2 = N(b[0], b), s3 = N(c[0], c);
    const n1 = X([v('r3', '3', { ...L, finished: '2026-01-01' }, 'Spook Street'), v('p4', '4', { ...D, added: 5 }), { id: 'h', title: 'Altro', author: 'Mick Herron', ...D, added: 1 }], [], () => 0);
    const n2 = X([{ id: 'r', title: 'Leoni morti', author: 'A', series: S, seriesNext: 'Tigri vere', ...L }, { id: 't', title: 'Tigri vere', author: 'B', ...D }], [], () => 0);
    const g = [v('g1', '1', L), v('g2', '2', { ...L, seriesNext: 'Tigri vere' }), v('g4', '4', D)];
    const h = [v('k1', '1', L), v('k2', '2', { ...L, seriesNext: 'Tigri vere' }), v('k3', '3', D, 'Real Tigers')];
    const sg = N(g[0], g), sh = N(h[0], h);
    const n3 = X([v('m2', '2', { ...L, finished: '2026-01-01', seriesNext: 'Tigri vere' }), v('m4', '4', { ...D, added: 5 }), { id: 'o', title: 'Altro', author: 'Altro', ...D, added: 1 }], [], () => 0);
    const n4 = X([v('q3', '3', { ...L, finished: '2026-02-01' }), v('q4', '4', { ...L, finished: '2025-01-01' }), v('q5', '5', D)], [], () => 0);
    const n5 = X([v('u1', '1', { ...L, finished: '2026-01-01' }), v('u2', '2', { status: 'desiderato' }), v('u3', '3', { ...D, added: 5 }), { id: 'uo', title: 'Altro', author: 'Altro', ...D, added: 1 }], [], () => 0);
    return { g: sg, h: sh && sh.book && sh.book.id, n3: n3.map(x => x.book.id + ':' + x.kind), n4: n4[0] && n4[0].reason, n5: n5.map(x => x.book.id + ':' + x.kind), a: s1 && s1.book && s1.book.id, b: s2, c: s3 && s3.book && s3.book.id, d: N(d[0], d), e: N({ id: 'z', title: 'Z', ...L }, a), f: N({ ...a[0], seriesNo: undefined }, a),
      n1: n1[0] && [n1[0].book.id, n1[0].kind, n1[0].reason], n2: n2[0] && [n2[0].book.id, n2[0].reason] };
  }, [S, L, D]);
  ok('salta i volumi letti', r.a === 'v5', r.a);
  ok('usa il seguito del volume posseduto più alto', r.b && r.b.title === 'Tigri vere' && r.b.no === '3' && !r.b.book, JSON.stringify(r.b));
  ok('numeri 2.5 in ordine', r.c === 'c25', r.c);
  ok('seguito già posseduto con sottotitolo: non riproposto', r.d === null, JSON.stringify(r.d));
  ok('volume mancante: #3 non ce l\'hai prima di #4 in pila', r.g && r.g.title === 'Tigri vere' && r.g.no === '3' && !r.g.book, JSON.stringify(r.g));
  ok('nessun buco: #3 con titolo diverso resta in pila', r.h === 'k3', r.h);
  ok('Cosa leggo adesso?: con #3 mancante non propone #4 come affine', !r.n3.includes('m4:affine') && r.n3.length === 2, JSON.stringify(r.n3));
  ok('Cosa leggo adesso?: con #2 nella lista dei desideri non propone #3 come affine', !r.n5.includes('u3:affine'), JSON.stringify(r.n5));
  ok('«dopo il #N» usa il volume appena prima', r.n4 === 'Il #5 di Slough House, dopo il #4', r.n4);
  ok('senza serie o numero: nessun seguito', r.e === null && r.f === null);
  ok('Cosa leggo adesso?: Il #4 di Slough House, dopo il #3', r.n1 && r.n1[0] === 'p4' && r.n1[1] === 'affine' && r.n1[2] === 'Il #4 di Slough House, dopo il #3', JSON.stringify(r.n1));
  ok('senza numeri: Il seguito di «Titolo»', r.n2 && r.n2[0] === 't' && r.n2[1] === 'Il seguito di «Leoni morti»', JSON.stringify(r.n2));

  const base = { added: 1, rating: 0, author: 'Mick Herron' };
  await load(p, [
    { ...base, ...L, id: 'h1', title: 'Un covo di bastardi', series: S, seriesNo: '1' },
    { ...base, ...D, id: 'h2', title: 'Leoni morti', series: S, seriesNo: '2' },
    { ...base, ...L, id: 'w1', title: 'Libro A', series: 'Serie W', seriesNo: '1' },
    { ...base, status: 'desiderato', id: 'w2', title: 'Libro B', series: 'Serie W', seriesNo: '2' },
    { ...base, ...L, id: 'n1', title: 'Primo <b>', series: 'Serie N', seriesNo: '3', seriesNext: 'Quarto volume' },
    { ...base, ...L, id: 'z1', title: 'Solitario', series: 'Serie Z', seriesNo: '1' },
  ]);
  const open = async id => { await p.locator(`#main [data-id="${id}"]`).first().click(); await p.waitForSelector('.sheet'); };
  const row = () => p.locator('.sheet .snext').innerText().catch(() => '');
  await open('h1');
  const t1 = await row(), lk = p.locator('.sheet .snext [data-next-open]'), bb = await lk.boundingBox().catch(() => null);
  const before = await p.evaluate(() => { const s = document.querySelector('.sheet .snext'), r = document.querySelector('.sheet .refresh'); return !!(s && r && s.nextElementSibling === r); });
  ok('in pila: riga «Prossimo della serie» prima di Aggiorna informazioni', /Prossimo della serie/i.test(t1) && /#2 Leoni morti/.test(t1) && /· in pila/.test(t1) && before, t1);
  await lk.click(); await p.waitForFunction(() => /Leoni morti/.test((document.querySelector('.sheet h2') || {}).textContent || ''), null, { timeout: 3000 }).catch(() => {});
  ok('in pila: tocco apre la scheda (≥ 44 px)', await p.locator('.sheet h2').innerText() === 'Leoni morti' && bb && bb.height >= 44, bb && bb.height);
  ok('nessuna riga nella scheda di un libro non letto', await p.locator('.sheet .snext').count() === 0);
  await p.locator('#s-close').click(); await p.waitForSelector('.sheet', { state: 'detached' });
  await open('w1');
  ok('nella lista dei desideri', /#2 Libro B/.test(await row()) && /· nella lista dei desideri/.test(await row()), await row());
  await p.locator('#s-close').click(); await p.waitForSelector('.sheet', { state: 'detached' });
  await open('n1');
  const t3 = await row(), wb = p.locator('.sheet button[data-wish-next]'), wbb = await wb.boundingBox().catch(() => null);
  ok("non ce l'hai: riga e pulsante «Lista dei desideri»", /#4 Quarto volume/.test(t3) && /· non ce l'hai/.test(t3) && (await wb.innerText()).trim() === 'Lista dei desideri' && await wb.getAttribute('aria-label') === 'Aggiungi «Quarto volume» alla lista dei desideri' && wbb && wbb.height >= 44, t3);
  await wb.click(); await p.waitForSelector('.sheet', { state: 'detached' });
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').some(x => x.title === 'Quarto volume'), null, { timeout: 4000 }).catch(() => {});
  const nb = (await localBooks(p)).find(x => x.title === 'Quarto volume') || {};
  const tt = await p.locator('.toast').innerText().catch(() => '');
  ok("non ce l'hai: pulsante crea desiderato con serie e numero 4", nb.status === 'desiderato' && nb.series === 'Serie N' && nb.seriesNo === '4' && nb.author === 'Mick Herron' && /Aggiunto alla lista dei desideri/.test(tt), JSON.stringify(nb) + ' / ' + tt);
  await p.locator('.toast button').click();
  await p.waitForFunction(() => !JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').some(x => x.title === 'Quarto volume'), null, { timeout: 4000 }).catch(() => {});
  ok('Annulla rimuove il libro aggiunto', !(await localBooks(p)).some(x => x.title === 'Quarto volume') && await p.locator(`#main [data-id="${nb.id}"]`).count() === 0);
  await open('z1');
  ok('nessun seguito: nessuna riga', await p.locator('.sheet .snext').count() === 0);
  await p.locator('#s-close').click(); await p.waitForSelector('.sheet', { state: 'detached' });
  // Hero: la proposta del seguito
  await load(p, [{ ...base, ...L, finished: '2026-01-01', id: 'r3', title: 'Spook Street', series: S, seriesNo: '3' }, { ...base, ...D, id: 'p4', title: 'La strada degli spettri', series: S, seriesNo: '4' }]);
  const why = await p.locator('#hero .ncard[data-next="p4"] .why').textContent().catch(() => '');
  ok('hero: proposta «Il #4 di Slough House, dopo il #3»', why === 'Il #4 di Slough House, dopo il #3', why);
  ok('prossimo volume: nessun errore in console', !p.errs.length, p.errs.join(' / '));
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
  await prossimo(browser);
}
