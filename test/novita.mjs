// «Novità per te» (v84): giro settimanale con le fonti simulate, sezione, lista dei desideri, pop-up.
import { APP, ok, newPage, localBooks } from './lib.mjs';

const KN = 'libreria-novita', DAY = 864e5;
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const iso = (add = 0) => { const d = new Date(Date.now() + add * DAY); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const L = (id, t, a, r, g) => ({ id, title: t, author: a, status: 'letto', rating: r, genre: g, finished: '2025-02-01', added: 1 });
export const LIB = [L('l1', 'Un covo di bastardi', 'Mick Herron', 5, 'Thriller'), L('l2', 'Leoni morti', 'Mick Herron', 4, 'Thriller'), L('l3', 'Il nome della rosa', 'Umberto Eco', 4, 'Storico'),
  { id: 'd1', title: 'In pila', author: 'Donato Carrisi', status: 'da-leggere', rating: 0, added: 1 }];

// Fonti simulate. cfg.fail: tutte in errore; cfg.slowGoogle: Google lento (per «Completa autori»).
export async function apri(browser, { libri = LIB, memoria = null, cfg = {} } = {}) {
  const p = await newPage(browser, { external: 'allow', init: { fn: () => { window.libreriaNovitaMs = 0; Object.defineProperty(navigator, 'language', { get: () => 'it-IT' }); } } });
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
export const MEM = () => ({ ultimoGiro: Date.now() - 1 * DAY, aperta: 0, viste: {}, mostrate: {},
  uscite: [
    { id: 'u2', title: 'Uscito da poco', author: 'Mick Herron', uscita: iso(-10), cover: '', perche: 'Nuovo di Herron: uscito il …', autoreLetto: true, voto: null },
    { id: 'u1', title: 'Il nuovo di Herron', author: 'Mick Herron', isbn: '9788804111111', uscita: iso(35), cover: '', perche: 'Nuovo di Herron: esce il …', autoreLetto: true, voto: { media: 4.6, voti: 48, fonte: 'Apple Books' } },
  ],
  proposte: [
    { id: 'p1', title: 'La spia nuova', author: 'Anna Nuova', isbn: '9788804222222', cover: '', synopsis: 'Trama.', year: 2025, perche: 'Hai letto 2 thriller', voto: { media: 4.2, voti: 1350, fonte: 'Google Books' }, genere: 'Thriller' },
    { id: 'p2', title: 'Il pendolo di Foucault', author: 'Umberto Eco', cover: '', perche: 'Dello stesso autore di «Il nome della rosa», a cui hai dato 4 stelle', voto: null },
  ] });
const vai = async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.locator('#dock [data-view="novita"]').click(); await p.waitForSelector('.nov'); };

async function sezione(browser) {
  const p = await apri(browser, { memoria: MEM() });
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
    await p.evaluate(([b, m]) => { localStorage.setItem('libreria-diego-v1', JSON.stringify(b)); localStorage.setItem('libreria-novita', JSON.stringify(m)); }, [LIB, MEM()]);
    await p.reload(); await p.waitForSelector('#main');
    await p.locator('#dock [data-view="novita"]').click(); await p.waitForSelector('.nov');
    ok(`computer${dark ? ' (scuro)' : ''}: proposte in più colonne, niente scorrimento laterale`, (await p.evaluate(() => getComputedStyle(document.querySelector('.nov-grid')).gridTemplateColumns.split(' ').length)) >= 3 && (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)) && !p.errs.length, p.errs.join(' / '));
    await p.close2();
  }
}

export default async function run({ browser }) {
  await giro(browser);
  await verifica(browser);
  await sezione(browser);
  await vuoti(browser);
  await computer(browser);
}
