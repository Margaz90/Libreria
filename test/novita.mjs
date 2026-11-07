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

export default async function run({ browser }) {
  await giro(browser);
  await verifica(browser);
}
