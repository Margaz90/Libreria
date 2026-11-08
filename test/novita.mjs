// «Novità per te» (v84): giro settimanale con le fonti simulate, sezione, lista dei desideri, pop-up.
import { APP, ok, newPage, localBooks } from './lib.mjs';

const KN = 'libreria-novita', DAY = 864e5;
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const iso = (add = 0) => { const d = new Date(Date.now() + add * DAY); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const L = (id, t, a, r, g) => ({ id, title: t, author: a, status: 'letto', rating: r, genre: g, finished: '2025-02-01', added: 1 });
export const LIB = [L('l1', 'Un covo di bastardi', 'Mick Herron', 5, 'Thriller'), L('l2', 'Leoni morti', 'Mick Herron', 4, 'Thriller'), L('l3', 'Il nome della rosa', 'Umberto Eco', 4, 'Storico'),
  { id: 'd1', title: 'In pila', author: 'Donato Carrisi', status: 'da-leggere', rating: 0, added: 1 }];

// Fonti simulate. cfg.fail: tutte in errore; cfg.slowGoogle: Google lento (per «Completa autori»).
export async function apri(browser, { libri = LIB, memoria = null, cfg = {}, lingua = 'it-IT' } = {}) {
  const p = await newPage(browser, { external: 'allow', init: { fn: l => { window.libreriaNovitaMs = 0; Object.defineProperty(navigator, 'language', { get: () => l }); }, arg: lingua } });
  p.n = { apple: 0, google: 0, ol: 0 }; p.cfg = cfg;
  await p.route(/itunes\.apple\.com/, r => {
    p.n.apple++; const u = new URL(r.request().url()), cb = u.searchParams.get('callback'), term = u.searchParams.get('term') || '';
    if (p.cfg.fail) return r.fulfill({ status: 500, body: '' });
    const res = /Herron/i.test(term) ? [
      { trackName: 'Il nuovo di Herron', artistName: 'Mick Herron', releaseDate: iso(35) + 'T08:00:00Z', artworkUrl100: 'https://is1.mzstatic.com/n/100x100bb.jpg', averageUserRating: 4.6, userRatingCount: 48 },
      { trackName: 'Un covo di bastardi', artistName: 'Mick Herron', releaseDate: '2019-03-01T08:00:00Z' },
      { trackName: 'Il re dei fantasmi', artistName: 'Mick Herron', releaseDate: '2021-05-01T08:00:00Z', averageUserRating: 4.3, userRatingCount: 210 },
    ] : /Eco/i.test(term) ? [{ trackName: 'Il pendolo di Foucault', artistName: 'Umberto Eco', releaseDate: '2016-01-01T08:00:00Z' }] : [];
    r.fulfill({ status: 200, contentType: 'application/javascript', body: `${cb}(${JSON.stringify({ results: res })})` });
  });
  await p.route(/www\.googleapis\.com\/books/, async r => {
    p.n.google++; if (p.cfg.fail) return json(r, {}, 503);
    if (p.cfg.slowGoogle) await new Promise(x => setTimeout(x, 2500));
    const q = decodeURIComponent(new URL(r.request().url()).searchParams.get('q') || '');
    const items = /subject:"?Thriller/i.test(q) ? [{ volumeInfo: { title: 'La spia nuova', authors: ['Anna Nuova'], language: 'it', publishedDate: '2025-09-10', averageRating: 4.2, ratingsCount: 1350, categories: ['Thriller'] } }]
      : /Herron/.test(q) ? [{ volumeInfo: { title: 'Il re dei fantasmi', authors: ['Mick Herron'], language: 'it', publishedDate: '2021-05-01', averageRating: 4.0, ratingsCount: 500 } }] : [];
    json(r, { totalItems: items.length, items });
  });
  await p.route(/openlibrary\.org/, r => { p.n.ol++; return p.cfg.fail ? json(r, {}, 500) : json(r, { docs: [] }); });
  await p.route(/wikidata\.org|mzstatic\.com|books\.google\.com/, r => r.abort());
  await p.goto(APP + '/');
  await p.evaluate(([b, m, k]) => { localStorage.setItem('libreria-diego-v1', JSON.stringify(b)); if (m) localStorage.setItem(k, JSON.stringify(m)); else localStorage.removeItem(k); }, [libri, memoria, KN]);
  return p;
}
export const riapri = async p => { await p.reload(); await p.waitForSelector('#main'); };
export const memoria = p => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KN);
const finito = p => p.waitForFunction(k => { const m = JSON.parse(localStorage.getItem(k) || 'null'); return m && m.ultimoGiro > Date.now() - 60e3; }, KN, { timeout: 15000 }).catch(() => {});

async function giro(browser) {
  // Giro fatto 6 giorni fa: niente richieste
  let p = await apri(browser, { memoria: { ultimoGiro: Date.now() - 6 * DAY, proposte: [], uscite: [], viste: {}, mostrate: {} } });
  await riapri(p); await p.waitForTimeout(2500);
  ok('giro: 6 giorni dopo l\'ultimo, nessuna richiesta', p.n.apple + p.n.google + p.n.ol === 0, JSON.stringify(p.n));
  await p.close2();
  // 8 giorni: giro, riga di avanzamento, novità salvate
  p = await apri(browser, { memoria: { ultimoGiro: Date.now() - 8 * DAY, proposte: [{ id: 'vecchia', title: 'Vecchia' }], uscite: [], viste: {}, mostrate: {} } });
  await riapri(p);
  await p.waitForFunction(() => /Cerco novità per te/.test(document.querySelector('#enrich')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
  const riga = await p.locator('#enrich').innerText().catch(() => '');
  await finito(p);
  const m = await memoria(p);
  ok('giro: 8 giorni dopo, la riga «Cerco novità per te…»', /Cerco novità per te/.test(riga), riga);
  ok('giro: ultimoGiro aggiornato, proposte nuove salvate', m && m.ultimoGiro > Date.now() - 60e3 && m.proposte.some(x => x.title === 'Il re dei fantasmi') && !m.proposte.some(x => x.title === 'Vecchia'), JSON.stringify(m && m.proposte.map(x => x.title)));
  ok('giro: uscita del tuo autore trovata con voto di Apple', m && m.uscite.some(x => x.title === 'Il nuovo di Herron' && x.voto && x.voto.fonte === 'Apple Books'), JSON.stringify(m && m.uscite));
  ok('giro: proposta dal genere con voto di Google', m && m.proposte.some(x => x.title === 'La spia nuova' && x.voto && x.voto.voti === 1350 && x.perche === 'Hai letto 2 thriller'), JSON.stringify(m && m.proposte));
  ok('giro: libri che hai già mai proposti', m && !m.proposte.concat(m.uscite).some(x => /covo/i.test(x.title)));
  await p.waitForFunction(() => document.querySelector('#enrich').hidden, null, { timeout: 5000 }).catch(() => {});
  ok('giro: la riga sparisce alla fine', await p.locator('#enrich').isHidden());
  ok('giro: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
  // Senza rete: niente
  p = await apri(browser, { memoria: { ultimoGiro: Date.now(), proposte: [], uscite: [], viste: {}, mostrate: {} } });
  await riapri(p); await p.context().setOffline(true);
  await p.evaluate(() => window.libreriaNovita.giro({ forza: true })); await p.waitForTimeout(500);
  ok('giro: offline nessuna richiesta', p.n.apple + p.n.google + p.n.ol === 0, JSON.stringify(p.n));
  await p.context().setOffline(false); await p.close2();
  // Tutte le fonti giù: novità di prima conservate, ultimoGiro invariato
  const prima = { ultimoGiro: Date.now() - 9 * DAY, proposte: [{ id: 'x', title: 'Proposta di prima', author: 'A' }], uscite: [], viste: {}, mostrate: {} };
  p = await apri(browser, { memoria: prima, cfg: { fail: true } });
  await riapri(p); await p.waitForTimeout(3000);
  const m2 = await memoria(p);
  ok('giro: fonti tutte giù → novità di prima e ultimoGiro invariato', m2 && m2.ultimoGiro === prima.ultimoGiro && m2.proposte[0].title === 'Proposta di prima', JSON.stringify(m2));
  await p.close2();
  // Meno di 3 Letti con voto: nessuna richiesta
  p = await apri(browser, { libri: [L('a', 'Uno', 'Autore Uno', 5, 'Giallo'), { ...L('b', 'Due', 'Autore Due', 0, 'Giallo') }] });
  await riapri(p); await p.waitForTimeout(1500);
  ok('giro: con meno di 3 Letti votati nessuna richiesta', p.n.apple + p.n.google + p.n.ol === 0, JSON.stringify(p.n));
  await p.close2();
  // Durante «Completa autori e copertine» il giro non parte
  p = await apri(browser, { libri: LIB.concat([{ id: 'z', title: 'Senza copertina', author: '', isbn: '9788804000001', status: 'da-leggere', rating: 0, added: 1 }]), memoria: { ultimoGiro: Date.now(), proposte: [], uscite: [], viste: {}, mostrate: {} }, cfg: { slowGoogle: true } });
  await riapri(p);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.locator('.dock .more').click(); await p.locator('[data-m=backup]').click(); await p.waitForSelector('#i-authors');
  await p.locator('#i-authors').click(); await p.waitForTimeout(500);
  const fatto = await p.evaluate(async () => { const a = JSON.parse(localStorage.getItem('libreria-novita')).ultimoGiro; await window.libreriaNovita.giro({ forza: true }); return JSON.parse(localStorage.getItem('libreria-novita')).ultimoGiro === a; });
  ok('giro: non parte durante «Completa autori e copertine»', fatto === true);
  await p.close2();
}

// Memoria del telefono piena: si salva almeno quando è stato fatto il giro (altrimenti si ripeterebbe a ogni apertura)
async function piena(browser) {
  const p = await apri(browser, { memoria: { ultimoGiro: Date.now() - 8 * DAY, proposte: [], uscite: [], viste: {}, mostrate: {} } });
  await p.addInitScript(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'libreria-novita' && String(v).length > 300) throw new DOMException('pieno', 'QuotaExceededError'); return set.call(this, k, v); }; });
  await riapri(p); await finito(p); await p.waitForTimeout(500);
  const m = await memoria(p);
  ok('memoria piena: il giro resta segnato, niente ripetizione a ogni apertura', m && m.ultimoGiro > Date.now() - 60e3, JSON.stringify(m));
  const n = p.n.google; await riapri(p); await p.waitForTimeout(2500);
  ok('memoria piena: alla riapertura nessun nuovo giro', p.n.google === n, `${n} → ${p.n.google}`);
  await p.close2();
}

// Telefono in inglese: Google senza filtro italiano; Open Library in inglese scartata su un telefono italiano
async function lingue(browser) {
  let p = await apri(browser, { memoria: { ultimoGiro: Date.now() - 8 * DAY, proposte: [], uscite: [], viste: {}, mostrate: {} }, lingua: 'en-US' });
  p.gq = []; await p.route(/www\.googleapis\.com\/books/, r => { p.gq.push(r.request().url()); json(r, { totalItems: 0, items: [] }); });
  await riapri(p); await finito(p);
  ok('telefono in inglese: Google senza filtro sulla lingua italiana', p.gq.length > 0 && !p.gq.some(u => /langRestrict=it/.test(u)), p.gq[0]);
  await p.close2();
  p = await apri(browser, { memoria: { ultimoGiro: Date.now() - 8 * DAY, proposte: [], uscite: [], viste: {}, mostrate: {} } });
  await p.route(/openlibrary\.org/, r => json(r, { docs: [{ title: 'English thriller', author_name: ['Some Writer'], language: ['eng'], first_publish_year: 2025 }, { title: 'Giallo italiano', author_name: ['Una Scrittrice'], language: ['ita'], first_publish_year: 2025 }] }));
  await riapri(p); await finito(p);
  const t = ((await memoria(p)) || { proposte: [] }).proposte.map(x => x.title);
  ok('Open Library: libro in inglese scartato, quello italiano tenuto', !t.includes('English thriller') && t.includes('Giallo italiano'), JSON.stringify(t));
  await p.close2();
}

async function verifica(browser) {
  const p = await apri(browser, { memoria: { ultimoGiro: Date.now(), proposte: [], uscite: [], viste: {}, mostrate: {} } });
  await riapri(p);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.locator('.dock .more').click(); await p.locator('[data-m=backup]').click(); await p.waitForSelector('#i-verify');
  await p.locator('#i-verify').click();
  await p.waitForFunction(() => /Voti:/.test(document.querySelector('#v-status').textContent) && !document.querySelector('#v-status').textContent.includes('…'), null, { timeout: 20000 }).catch(() => {});
  const vs = await p.locator('#v-status').innerText();
  ok('Verifica ricerche: riga dei voti per Google, Apple e Open Library', /Voti: Google (sì|no) · Apple (sì|no) · Open Library (sì|no)/.test(vs), vs);
  await p.close2();
}

// Memoria pronta per la sezione: un'uscita futura, una recente, due proposte
// giaMostrate: il pop-up le ha già mostrate (così non copre la sezione nei test che non lo riguardano)
export const MEM = ({ giaMostrate = false } = {}) => ({ motore: 86, ultimoGiro: Date.now() - 1 * DAY, aperta: 0, viste: {}, mostrate: giaMostrate ? { u1: iso(35), u2: iso(-10) } : {},
  uscite: [
    { id: 'u2', title: 'Uscito da poco', author: 'Mick Herron', uscita: iso(-10), cover: '', perche: 'Nuovo di Herron: uscito il …', autoreLetto: true, voto: null },
    { id: 'u1', title: 'Il nuovo di Herron', author: 'Mick Herron', isbn: '9788804111111', uscita: iso(35), cover: '', perche: 'Nuovo di Herron: esce il …', autoreLetto: true, voto: { media: 4.6, voti: 48, fonte: 'Apple Books' } },
  ],
  proposte: [
    { id: 'p1', title: 'La spia nuova', author: 'Anna Nuova', isbn: '9788804222222', cover: '', synopsis: 'Trama.', year: 2025, perche: 'Hai letto 2 thriller', voto: { media: 4.2, voti: 1350, fonte: 'Google Books' }, genere: 'Thriller' },
    { id: 'p2', title: 'Il pendolo di Foucault', author: 'Umberto Eco', cover: '', perche: 'Dello stesso autore di «Il nome della rosa», a cui hai dato 4 stelle', voto: null },
  ] });
const vai = async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.locator('#dock [data-view="novita"]').click(); await p.waitForSelector('.nov'); await p.waitForTimeout(600); }; // fine dell'animazione di apertura

async function sezione(browser) {
  const p = await apri(browser, { memoria: MEM({ giaMostrate: true }) });
  await riapri(p);
  ok('barra in basso: «Novità» al posto di «Cerca»', await p.locator('#dock [data-view="novita"]').count() === 1 && await p.locator('#dock [data-act="search"]').count() === 0 && /Novità/.test(await p.locator('#dock [data-view="novita"]').innerText()));
  ok('pallino con uscite non viste', await p.locator('#nov-dot').isVisible());
  await vai(p);
  const tit = await p.locator('.nov h3').allInnerTexts();
  ok('sezione: «Uscite dei tuoi autori» e «Proposte per te»', JSON.stringify(tit) === JSON.stringify(['Uscite dei tuoi autori', 'Proposte per te']), JSON.stringify(tit));
  const us = await p.locator('.nov-out li').allInnerTexts();
  ok('uscite: prima la futura, con «esce il…»; poi la recente con «uscito il…»', us.length === 2 && /Il nuovo di Herron/.test(us[0]) && /esce il/.test(us[0]) && /uscito il/.test(us[1]), JSON.stringify(us));
  const pr = await p.locator('.nov-card').allInnerTexts();
  ok('proposta con voto, fonte e motivazione', /★ 4,2 · 1\.350 voti \(Google Books\)/.test(pr[0]) && /Hai letto 2 thriller/.test(pr[0]), pr[0]);
  ok('proposta senza voto: niente stelle', !/★/.test(pr[1]) && /Il pendolo di Foucault/.test(pr[1]), pr[1]);
  ok('nota in fondo: aggiornate e prossime tra 6 giorni', /Aggiornate il .+ · le prossime tra 6 giorni/.test(await p.locator('.nov-foot').innerText()), await p.locator('.nov-foot').innerText());
  ok('aperta la sezione il pallino sparisce', await p.locator('#nov-dot').isHidden());
  ok('la barra di ricerca è nascosta nelle novità', await p.locator('#toolbar').isHidden());
  // Lista dei desideri con Annulla
  const btn = p.locator('.nov-card [data-wish="p1"]');
  ok('pulsante con il titolo per VoiceOver e alto 44 px', /Metti «La spia nuova» nella lista dei desideri/.test(await btn.getAttribute('aria-label')) && (await btn.boundingBox()).height >= 44);
  await btn.click(); await p.waitForTimeout(800);
  const w = (await localBooks(p)).find(b => b.title === 'La spia nuova');
  ok('Lista dei desideri: libro desiderato con autore, ISBN e trama', w && w.status === 'desiderato' && w.author === 'Anna Nuova' && w.isbn === '9788804222222' && w.synopsis === 'Trama.', JSON.stringify(w));
  ok('Lista dei desideri: sparisce dalle novità', !(await p.locator('.nov-card').allInnerTexts()).some(t => /La spia nuova/.test(t)));
  await p.locator('.toast button', { hasText: 'Annulla' }).click(); await p.waitForTimeout(800);
  ok('Annulla: tolto dalla lista e di nuovo tra le novità', !(await localBooks(p)).some(b => b.title === 'La spia nuova') && (await p.locator('.nov-card').allInnerTexts()).some(t => /La spia nuova/.test(t)));
  // Libro arrivato dal cloud: sparisce al ridisegno
  await p.evaluate(() => { window.libreriaHost.setLocal('c9', { title: 'Il pendolo di Foucault', author: 'Umberto Eco', status: 'da-leggere', updated: 5 }); window.libreriaHost.refresh(); });
  await p.waitForTimeout(300);
  ok('libro arrivato dal cloud: sparisce dalle novità', !(await p.locator('.nov-card').allInnerTexts()).some(t => /Foucault/.test(t)));
  // La ricerca resta raggiungibile con «/»
  await p.keyboard.press('/'); await p.waitForTimeout(300);
  ok('«/» porta alla ricerca', await p.evaluate(() => document.activeElement && document.activeElement.id === 'q'));
  ok('sezione: niente scorrimento laterale, nessun errore', (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)) && !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

// v85: gruppi, «In lingua originale», libro con titolo in due lingue
async function gruppi(browser) {
  const m = MEM({ giaMostrate: true });
  m.proposte = [
    { id: 'g1', title: 'Il re dei fantasmi', author: 'Mick Herron', gruppo: 'autori', perche: 'x', voto: null },
    { id: 'g2', title: 'La spia nuova', author: 'Anna Nuova', gruppo: 'generi', perche: 'Hai letto 2 thriller', voto: null },
    { id: 'g3', title: 'Un fantasy', author: 'Fa Uno', gruppo: 'scoperta', perche: 'y', voto: null },
    { id: 'g4', title: 'Oltre le dune', author: 'Hugh Howey', gruppo: 'scoperta', perche: 'z', voto: null },
  ];
  m.originali = [{ id: 'o1', title: 'The New Herron', author: 'Mick Herron', uscita: iso(40), autoreLetto: true }];
  const p = await apri(browser, { memoria: m, libri: LIB.concat([{ id: 'h1', title: 'Across the sand. Oltre le dune', author: 'Hugh Howey', status: 'letto', rating: 4, added: 1 }]) });
  await riapri(p); await p.waitForTimeout(400);
  ok('originali: nessun pop-up', await p.locator('.nov-pop').count() === 0);
  await vai(p);
  ok('proposte: sottotitoli «Dai tuoi autori», «Dai tuoi generi», «Da scoprire» nell\'ordine', JSON.stringify(await p.locator('.nov h4').allInnerTexts()) === JSON.stringify(['Dai tuoi autori', 'Dai tuoi generi', 'Da scoprire']));
  ok('libro già tuo con il titolo in due lingue: non proposto', !(await p.locator('.nov-card').allInnerTexts()).some(t => /Oltre le dune/.test(t)));
  const or = await p.locator('.nov-orig').innerText().catch(() => '');
  ok('«In lingua originale» in fondo, con la nota e il libro', /In lingua originale/.test(or) && /Non ancora uscite in italiano/.test(or) && /The New Herron/.test(or), or);
  ok('originali: dopo le proposte', await p.evaluate(() => { const o = document.querySelector('.nov-orig'), g = document.querySelector('.nov-grid'); return !!(o && g && (g.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING)); }));
  await p.close2();
  // Solo originali nuovi: niente pallino
  const m2 = { ultimoGiro: Date.now() - DAY, aperta: Date.now(), viste: {}, mostrate: {}, uscite: [], proposte: [], originali: [{ id: 'o1', title: 'The New Herron', author: 'Mick Herron', uscita: iso(40), autoreLetto: true }] };
  const q = await apri(browser, { memoria: m2 });
  await riapri(q); await q.waitForTimeout(300);
  ok('originali: niente pallino', await q.locator('#nov-dot').isHidden());
  ok('gruppi: nessun errore in console', !p.errs.length && !q.errs.length, [...p.errs, ...q.errs].join(' / '));
  await q.close2();
}

// Dopo l'aggiornamento alla v85: la prima apertura della sezione rifà il giro con le regole nuove, una volta sola
async function primaApertura(browser) {
  const m = MEM({ giaMostrate: true }); delete m.motore; // giro della v84, senza «motore»
  const p = await apri(browser, { memoria: m });
  await riapri(p); await p.waitForTimeout(1500);
  ok('aggiornamento: all\'avvio nessun giro (sono passati meno di 7 giorni)', p.n.apple + p.n.google + p.n.ol === 0, JSON.stringify(p.n));
  await vai(p);
  ok('aggiornamento: aprendo Novità parte il giro, con «Aggiorno le novità…»', /Aggiorno le novità/.test(await p.locator('.nov').innerText()) || p.n.apple > 0, await p.locator('.nov').innerText());
  await finito(p); await p.waitForTimeout(500);
  const mm = await memoria(p);
  ok('aggiornamento: giro fatto con le regole nuove', mm.motore === 86 && mm.ultimoGiro > Date.now() - 60e3 && p.n.apple > 0, JSON.stringify({ motore: mm.motore, n: p.n }));
  const n0 = p.n.apple; await riapri(p); await vai(p); await p.waitForTimeout(1500);
  ok('aggiornamento: la seconda apertura non rifà il giro', p.n.apple === n0, `${n0} → ${p.n.apple}`);
  await p.close2();
}

// v86: con regole nuove il giro non conserva le uscite dei giri vecchi (non ricontrollate)
async function memoriaVecchia(browser) {
  const m = MEM({ giaMostrate: true }); m.motore = 85; m.ultimoGiro = Date.now() - DAY;
  m.uscite.push({ id: 'vecchia', title: 'Slow Horses. Nuova edizione', author: 'Mick Herron', uscita: iso(-5), autoreLetto: true });
  m.mostrate.vecchia = iso(-5); // già vista nel pop-up
  const p = await apri(browser, { memoria: m });
  await riapri(p); await vai(p); await finito(p); await p.waitForTimeout(500);
  const mm = await memoria(p);
  ok('regole nuove: le uscite dei giri vecchi non restano', mm.motore >= 86 && !mm.uscite.some(x => x.id === 'vecchia') && !mm.uscite.some(x => x.id === 'u2'), JSON.stringify(mm.uscite.map(x => x.title)));
  await p.close2();
}

async function vuoti(browser) {
  let p = await apri(browser, { memoria: { ultimoGiro: Date.now(), proposte: [], uscite: [], viste: {}, mostrate: {} }, libri: [L('a', 'Uno', 'Autore Uno', 5, 'Giallo')] });
  await riapri(p); await vai(p);
  ok('vuoto: pochi voti → «Dai qualche voto…»', /Dai qualche voto ai libri che hai letto: le proposte partono da lì\./.test(await p.locator('.nov').innerText()));
  await p.close2();
  p = await apri(browser, { memoria: null });
  await p.route(/itunes|googleapis|openlibrary/, r => r.abort());
  await riapri(p); await p.context().setOffline(true); await vai(p);
  ok('vuoto: mai cercate → «Le novità arrivano quando sei online…»', /Le novità arrivano quando sei online: le cerco una volta a settimana\./.test(await p.locator('.nov').innerText()), await p.locator('.nov').innerText());
  await p.context().setOffline(false); await p.close2();
}

async function computer(browser) {
  for (const dark of [false, true]) {
    const p = await newPage(browser, { width: 1366, height: 860, dark });
    await p.goto(APP + '/');
    await p.evaluate(([b, m]) => { localStorage.setItem('libreria-diego-v1', JSON.stringify(b)); localStorage.setItem('libreria-novita', JSON.stringify(m)); }, [LIB, MEM({ giaMostrate: true })]);
    await p.reload(); await p.waitForSelector('#main');
    await p.locator('#dock [data-view="novita"]').click(); await p.waitForSelector('.nov');
    const [sh, nv, ad] = [await p.locator('#side-shelves').boundingBox(), await p.locator('#dock [data-view="novita"]').boundingBox(), await p.locator('#dock .add').boundingBox()];
    ok(`computer${dark ? ' (scuro)' : ''}: «Novità» sotto gli scaffali nella colonna laterale`, nv.y > sh.y + sh.height - 1 && nv.y > ad.y, JSON.stringify({ sh, nv, ad }));
    ok(`computer${dark ? ' (scuro)' : ''}: proposte in più colonne, niente scorrimento laterale`, (await p.evaluate(() => getComputedStyle(document.querySelector('.nov-grid')).gridTemplateColumns.split(' ').length)) >= 3 && (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)) && !p.errs.length, p.errs.join(' / '));
    await p.close2();
  }
}

async function popup(browser) {
  const mem = MEM();
  mem.uscite.push({ id: 'u3', title: 'Di un autore non letto', author: 'Donato Carrisi', uscita: iso(20), autoreLetto: false });
  const p = await apri(browser, { memoria: mem });
  await riapri(p); await p.waitForTimeout(400);
  const t = await p.locator('.nov-pop').innerText().catch(() => '');
  ok('pop-up all\'apertura: nuova uscita di un autore letto, con «un\'altra uscita»', /Nuovo di Mick Herron/.test(t) && /«Il nuovo di Herron», esce il/.test(t) && /e un'altra uscita/.test(t) && !/Carrisi/.test(t), t);
  ok('pop-up: tre pulsanti', JSON.stringify(await p.locator('.nov-pop .actions button').allInnerTexts()) === JSON.stringify(['Lista dei desideri', 'Vedi le novità', 'Chiudi']));
  await p.locator('.nov-pop [data-pop="vedi"]').click(); await p.waitForTimeout(400);
  ok('pop-up: «Vedi le novità» apre la sezione', await p.locator('.nov').count() === 1);
  await riapri(p); await p.waitForTimeout(400);
  ok('pop-up: alla riapertura non ricompare', await p.locator('.nov-pop').count() === 0);
  await p.close2();
  // Solo un autore Da leggere: niente pop-up, solo pallino
  const m2 = MEM(); m2.uscite = [{ id: 'u3', title: 'Di un autore non letto', author: 'Donato Carrisi', uscita: iso(20), autoreLetto: false }];
  let q = await apri(browser, { memoria: m2 });
  await riapri(q); await q.waitForTimeout(400);
  ok('pop-up: niente per un autore che non hai letto, ma pallino sì', await q.locator('.nov-pop').count() === 0 && await q.locator('#nov-dot').isVisible());
  await q.close2();
  // «Lista dei desideri» dal pop-up
  q = await apri(browser, { memoria: MEM() });
  await riapri(q); await q.waitForTimeout(400);
  await q.locator('.nov-pop [data-pop="wish"]').click(); await q.waitForTimeout(800);
  ok('pop-up: «Lista dei desideri» aggiunge la prima uscita', (await localBooks(q)).some(b => b.title === 'Il nuovo di Herron' && b.status === 'desiderato'));
  await q.close2();
  // Uscita trovata durante l'uso: niente pop-up subito
  q = await apri(browser, { memoria: { ultimoGiro: Date.now() - 8 * DAY, proposte: [], uscite: [], viste: {}, mostrate: {} } });
  await riapri(q); await finito(q); await q.waitForTimeout(500);
  ok('pop-up: il giro che trova un\'uscita non apre il pop-up durante l\'uso', await q.locator('.nov-pop').count() === 0 && (await memoria(q)).uscite.length > 0);
  await riapri(q); await q.waitForTimeout(400);
  ok('pop-up: compare all\'apertura successiva', await q.locator('.nov-pop').count() === 1);
  await q.close2();
  // Con una scheda già aperta il pop-up aspetta (es. ritorno dall'accesso)
  q = await apri(browser, { memoria: { ultimoGiro: Date.now(), proposte: [], uscite: [], viste: {}, mostrate: {} } });
  await riapri(q);
  await q.locator('.dock .more').click(); await q.waitForSelector('[data-m=backup]');
  await q.evaluate(([k, m]) => { localStorage.setItem(k, JSON.stringify(m)); window.libreriaNovita.popup(); }, [KN, MEM()]);
  await q.waitForTimeout(300);
  ok('pop-up: con un\'altra scheda aperta aspetta', await q.locator('.nov-pop').count() === 0 && !((await memoria(q)).mostrate.u1));
  ok('pop-up: nessun errore in console', !p.errs.length && !q.errs.length, [...p.errs, ...q.errs].join(' / '));
  await q.close2();
}

export default async function run({ browser }) {
  await popup(browser);
  await giro(browser);
  await piena(browser);
  await lingue(browser);
  await verifica(browser);
  await sezione(browser);
  await gruppi(browser);
  await primaApertura(browser);
  await memoriaVecchia(browser);
  await vuoti(browser);
  await computer(browser);
}
