// Ricerche delle informazioni con risposte simulate: Google in 503, Open Library senza l'edizione italiana, Apple Books per titolo.
import { APP, ok, newPage } from './lib.mjs';

const COVER = 'https://is1-ssl.mzstatic.com/image/thumb/Pub/x/100x100bb.jpg';
const apple = term => {
  const t = term.toLowerCase();
  if (t.includes('sogni')) return [{ trackName: 'Città di sogni', artistName: 'Don Winslow', releaseDate: '2023-05-01', genres: ['Gialli'], description: 'Danny Ryan in fuga.', artworkUrl100: COVER }];
  if (t.includes('black money')) return [
    { trackName: 'Black Money Hustle', artistName: 'Someone Else', artworkUrl100: COVER.replace('Pub/x', 'Pub/z') },
    { trackName: 'Black Money', artistName: 'Paolo Roversi', releaseDate: '2021-10-01', genres: ['Thriller'], description: 'Un collettivo hacker.', artworkUrl100: COVER.replace('Pub/x', 'Pub/y') }];
  if (t.includes('ubik')) return [{ trackName: 'Ubik', artistName: 'Philip K. Dick', releaseDate: '2021-01-01', genres: ['Fantascienza'], description: 'Joe Chip e la realtà che si disfa.', artworkUrl100: COVER.replace('Pub/x', 'Pub/u') }];
  return [];
};
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="90"><rect width="60" height="90" fill="#a33"/></svg>';
const E503 = { status: 503, contentType: 'application/json', body: '{"error":{"message":"Service temporarily unavailable"}}' };

async function mock(p, google) {
  await p.route(/googleapis\.com\/books/, google);
  await p.route(/openlibrary\.org/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"docs":[]}' }));
  await p.route(/itunes\.apple\.com/, r => { const u = new URL(r.request().url()); r.fulfill({ status: 200, contentType: 'text/javascript', body: `${u.searchParams.get('callback')}(${JSON.stringify({ results: apple(u.searchParams.get('term') || '') })})` }); });
  await p.route(/mzstatic\.com|books\.google\.com/, r => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG }));
}
const load = (p, books) => p.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)), books);
const saved = (p, id) => p.evaluate(id => JSON.parse(localStorage.getItem('libreria-diego-v1')).find(b => b.id === id), id);
const refStatus = p => p.waitForFunction(() => !/Cerco/.test(document.querySelector('#s-ref-status').textContent), null, { timeout: 30000 });

export default async function ({ browser }) {
  // 1. Google sempre giù: completamento da Altro → Backup e pulsante della scheda
  const p = await newPage(browser, { external: 'mock' });
  let gcalls = 0;
  await mock(p, r => { gcalls++; r.fulfill(E503); });
  await p.goto(APP + '/');
  await load(p, [
    { id: 'b1', title: 'Città di sogni', author: 'Don Winslow', isbn: '9791259851284', status: 'da-leggere', added: 1 },
    { id: 'b2', title: 'Black Money', isbn: '9788893904995', status: 'da-leggere', added: 2 },
    { id: 'b3', title: 'Ubik', author: 'Philip K. Dick', isbn: '9788804731481', status: 'da-leggere', added: 3, cover: 'https://example.com/old.jpg', coverManual: true },
    { id: 'b4', title: 'Libro inesistente', author: 'Nessuno', status: 'da-leggere', added: 4 }
  ]);
  await p.reload(); await p.waitForTimeout(500);
  await p.locator('.dock .more').click(); await p.locator('[data-m=backup]').click();
  await p.click('#i-authors');
  await p.waitForFunction(() => [...document.querySelectorAll('.toast')].some(t => /Informazioni aggiornate/.test(t.textContent)), null, { timeout: 60000 });
  await p.waitForTimeout(900);
  const b1 = await saved(p, 'b1'), b2 = await saved(p, 'b2');
  ok('Google giù: autore e copertina arrivano da Apple Books', b1.author === 'Don Winslow' && !!b1.cover && b1.year === 2023);
  ok('senza autore accetta solo il titolo identico (Black Money → Roversi)', b2.author === 'Paolo Roversi' && (b2.cover || '').includes('Pub/y'), b2.author);
  ok('Google giù viene saltato invece di riprovarlo per ogni libro (un ISBN: al massimo due giri da tre)', gcalls <= 6, 'chiamate: ' + gcalls);

  await p.locator('#main [data-id="b3"]').first().click();
  await p.click('#s-refresh'); await refStatus(p);
  ok('scheda: «Aggiorna informazioni» riempie i campi', /Aggiornati: .*trama/.test(await p.textContent('#s-ref-status')), await p.textContent('#s-ref-status'));
  await p.click('#s-save'); await p.waitForTimeout(900);
  ok('scheda: la copertina scelta a mano non cambia', (await saved(p, 'b3')).cover === 'https://example.com/old.jpg');
  await p.locator('#main [data-id="b4"]').first().click();
  await p.click('#s-refresh'); await refStatus(p);
  ok('scheda: libro sconosciuto → «Nessuna informazione trovata»', /Nessuna informazione trovata/.test(await p.textContent('#s-ref-status')));
  const errs1 = p.errs; await p.close2();

  // 2. ISBN: Google in 503 al primo giro, poi risponde: arrivano i dati dell'edizione esatta (sempre con la chiave:
  // senza chiave Google risponde 429, quota comune a tutti)
  const q = await newPage(browser, { external: 'mock' });
  const calls = []; let n503 = 0;
  await mock(q, r => {
    const u = r.request().url(); calls.push(/key=/.test(u) ? 'chiave' : 'senza');
    if (/isbn%3A/.test(u) && n503++ < 3) return r.fulfill(E503);
    const hit = /isbn%3A9788806258047/.test(u);
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: hit ? [{ volumeInfo: { title: 'Il confine', authors: ['Don Winslow'], publishedDate: '2019', pageCount: 928, language: 'it', categories: ['Fiction'], description: 'Art Keller contro il cartello.', imageLinks: { thumbnail: 'http://books.google.com/books/content?id=abc&img=1&zoom=1&edge=curl' }, industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788806258047' }] } }] : [] }) });
  });
  await q.goto(APP + '/');
  await load(q, [{ id: 'c1', title: 'Il confine', author: 'Don Winslow', isbn: '9788806258047', status: 'da-leggere', added: 1 }]);
  await q.reload(); await q.waitForTimeout(500);
  await q.locator('#main [data-id="c1"]').first().click();
  await q.click('#s-refresh'); await refStatus(q);
  await q.click('#s-save'); await q.waitForTimeout(900);
  const c1 = await saved(q, 'c1');
  ok('ISBN dopo un giro di 503: pagine, genere e copertina', c1.pages === 928 && c1.genre === 'Narrativa' && /books\.google/.test(c1.cover || ''), JSON.stringify({ p: c1.pages, g: c1.genre }));
  ok('ISBN dopo un 503: si riprova sempre con la chiave', calls.length >= 4 && !calls.includes('senza'), calls.join(','));

  // 3. «Verifica ricerche»: esito visibile sotto il pulsante
  await q.locator('.dock .more').click(); await q.locator('[data-m=backup]').click();
  await q.click('#i-verify');
  await q.waitForFunction(() => /Open Library/.test(document.querySelector('#v-status').textContent), null, { timeout: 15000 });
  const box = await q.locator('#v-status').boundingBox();
  ok('«Verifica ricerche»: esito visibile senza scorrere', box && box.y + box.height < 844, await q.textContent('#v-status'));
  const errs = [...errs1, ...q.errs];
  ok('ricerche: nessun errore in console', !errs.length, errs.join(' / '));
  await q.close2();
}
