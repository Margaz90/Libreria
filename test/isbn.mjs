// Ricerca per ISBN e per titolo: ISBN scritti in più modi, edizioni italiane senza la lingua indicata in Google,
// un 503 passeggero non spegne Google per 24 ore, messaggio chiaro quando nessuna fonte conosce l'ISBN.
import { APP, ok, newPage } from './lib.mjs';

const EINAUDI = { items: [{ volumeInfo: { title: 'Underworld', authors: ['Don DeLillo'], publishedDate: '1998', pageCount: 882, industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788806219215' }] } }] };
const VUOTO = { totalItems: 0 };
const ISBN = '9788806219215';

// Pagina con le fonti simulate: `google(url)` decide la risposta di Google Books, Open Library e Apple restano vuote.
async function apri(browser, google, { wikidata = [], ...opts } = {}) {
  const p = await newPage(browser, { external: 'allow', ...opts });
  p.googleUrls = []; p.wikidataUrls = [];
  await p.route(/query\.wikidata\.org/, r => { p.wikidataUrls.push(r.request().url()); r.fulfill({ status: 200, contentType: 'application/sparql-results+json', body: JSON.stringify({ results: { bindings: wikidata } }) }); });
  await p.route(/www\.googleapis\.com\/books/, r => {
    const u = r.request().url(); p.googleUrls.push(u);
    const { status = 200, body } = google(u);
    r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await p.route(/openlibrary\.org\/search/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ docs: [] }) }));
  // Apple risponde (JSONP, senza risultati): così il messaggio dice solo ciò che davvero manca
  await p.route(/itunes\.apple\.com/, r => { const cb = new URL(r.request().url()).searchParams.get('callback'); r.fulfill({ status: 200, contentType: 'application/javascript', body: `${cb}({"results":[]})` }); });
  return p;
}
const cerca = async (p, q) => {
  await p.locator('.dock .add').first().click(); await p.waitForSelector('#s-q');
  await p.fill('#s-q', q); await p.keyboard.press('Enter');
  await p.waitForFunction(() => !/^Cerco/.test(document.querySelector('#s-status').textContent), null, { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(200);
  const stato = await p.locator('#s-status').innerText().catch(() => '');
  const titoli = await p.locator('#s-results .result b').allInnerTexts().catch(() => []);
  const primo = (await p.locator('#s-results .result').count()) ? await p.locator('#s-results .result').first().innerText() : '';
  const pulsante = await p.locator('#s-title').count();
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  return { stato, titoli, primo, pulsante };
};
const isbnChiamate = p => p.googleUrls.filter(u => /isbn/i.test(decodeURIComponent(u)));

export default async function ({ browser }) {
  // 1. Titolo: se Google non trova nulla con il filtro sull'italiano, si riprova senza filtro
  let p = await apri(browser, u => (/langRestrict=it/.test(u) ? { body: VUOTO } : { body: EINAUDI }));
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  let r = await cerca(p, 'Underworld DeLillo');
  ok('titolo: l\'edizione Einaudi compare anche senza filtro sulla lingua', r.titoli.includes('Underworld'), JSON.stringify(r));
  await p.close2();

  // 2. ISBN scritto in più modi: sempre cercato come ISBN, senza filtro sulla lingua
  for (const q of ['9788806219215', '978 88 06 219215', 'ISBN 978-88-06-219215', '978-88-06-21921-5']) {
    p = await apri(browser, u => (/isbn/.test(decodeURIComponent(u)) && !/langRestrict/.test(u) ? { body: EINAUDI } : { body: VUOTO }));
    await p.goto(APP + '/'); await p.waitForTimeout(300);
    r = await cerca(p, q);
    ok(`ISBN «${q}»: cercato come ISBN e trovato`, isbnChiamate(p).length > 0 && isbnChiamate(p).every(u => /isbn:9788806219215/.test(decodeURIComponent(u)) && !/langRestrict/.test(u)) && r.titoli.includes('Underworld'), isbnChiamate(p).join(' ; ') + ' | ' + r.stato);
    await p.close2();
  }
  p = await apri(browser, u => (/isbn/.test(decodeURIComponent(u)) ? { body: { items: [] } } : { body: VUOTO }));
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  r = await cerca(p, '88-06-21921-X');
  ok('ISBN-10 con X finale: cercato come ISBN-10', isbnChiamate(p).some(u => /isbn:880621921X/.test(decodeURIComponent(u))), isbnChiamate(p).join(' ; '));
  await p.close2();

  // 2b. Il risultato mostra l'ISBN dell'edizione, così si riconosce quella giusta
  p = await apri(browser, u => (/Underworld/.test(decodeURIComponent(u)) ? { body: EINAUDI } : { body: VUOTO }));
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  r = await cerca(p, 'Underworld DeLillo');
  ok('risultato: mostra l\'ISBN dell\'edizione', r.primo.includes('9788806219215'), r.primo.replace(/\n/g, ' | '));
  await p.close2();

  // 3. ISBN che nessuna fonte conosce: messaggio che lo dice e propone di compilare a mano
  p = await apri(browser, () => ({ body: VUOTO }));
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  r = await cerca(p, '9780000000002');
  ok('ISBN sconosciuto: messaggio chiaro', /nessuna fonte conosce questo ISBN/i.test(r.stato), r.stato);
  ok('ISBN sconosciuto: c\'è il pulsante per cercare per titolo e autore', r.pulsante === 1, '');
  await p.locator('.dock .add').first().click(); await p.waitForSelector('#s-q');
  await p.fill('#s-q', '9780000000002'); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
  await p.locator('#s-title').click();
  const pronto = await p.evaluate(() => ({ focus: document.activeElement && document.activeElement.id, vuoto: document.querySelector('#s-q').value === '' }));
  ok('ISBN sconosciuto: il pulsante porta alla ricerca per titolo e autore', pronto.focus === 's-q' && pronto.vuoto, JSON.stringify(pronto));
  await p.close2();

  // 3b. Un ISBN che solo Wikidata conosce: il risultato compare, e Wikidata non viene interrogato per i titoli
  const riga = { edLabel: { value: 'Underworld' }, authorLabel: { value: 'Don DeLillo' }, date: { value: '1997-11-01T00:00:00Z' }, pages: { value: '832' } };
  p = await apri(browser, () => ({ body: VUOTO }), { wikidata: [riga] });
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  r = await cerca(p, ISBN);
  ok('Wikidata: un ISBN noto solo lì compare nei risultati', r.titoli.includes('Underworld') && p.wikidataUrls.length === 1 && decodeURIComponent(p.wikidataUrls[0]).includes('"978-88-06-21921-5"'), `${p.wikidataUrls.length} richieste · ${r.stato}`);
  await cerca(p, 'Underworld DeLillo');
  ok('Wikidata: non interrogato per una ricerca per titolo', p.wikidataUrls.length === 1, `richieste: ${p.wikidataUrls.length}`);
  await p.close2();


  // 4. Un 503 passeggero: il blocco di Google dura 5 minuti, non 24 ore
  p = await apri(browser, (() => { let primo = true; return () => {
    if (primo) { primo = false; return { status: 503, body: { error: { message: 'Service unavailable' } } }; }
    return { status: 429, body: { error: { message: 'Quota exceeded' } } };
  }; })());
  await p.clock.install({ time: new Date('2026-10-26T10:00:00') });
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  await cerca(p, 'Ubik');
  const dopo = p.googleUrls.length;
  await p.clock.fastForward('02:00'); await cerca(p, 'Blade Runner');
  const subito = p.googleUrls.length - dopo;
  await p.clock.fastForward('06:00'); await cerca(p, 'Dune');
  const piuTardi = p.googleUrls.length - dopo - subito;
  ok('503 seguito da 429: Google sospeso per pochi minuti, poi di nuovo interrogato', subito === 0 && piuTardi > 0, `dopo 2 minuti: ${subito} richieste; dopo 8: ${piuTardi}`);
  await p.close2();


  // 5. Google con chiave in 503 la prima volta: si riprova con la chiave (le richieste senza chiave finiscono quasi sempre in 429)
  p = await apri(browser, (() => { let n = 0; return u => (/key=/.test(u) && n++ === 0 ? { status: 503, body: { error: { code: 503 } } } : { body: EINAUDI }); })());
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  r = await cerca(p, ISBN);
  ok('Google: dopo un 503 si riprova con la chiave e si trova il libro', /Underworld/.test(r.titoli.join('|')) && p.googleUrls.length >= 2 && p.googleUrls.slice(0, 2).every(u => /key=/.test(u)), p.googleUrls.map(u => /key=/.test(u) ? 'chiave' : 'senza').join(','));
  await p.close2();

  // 5b. Google risponde 0 risultati per un ISBN che conosce (succede: la volta dopo lo trova): si riprova una volta
  p = await apri(browser, (() => { let n = 0; return u => (/isbn/.test(decodeURIComponent(u)) && n++ === 0 ? { body: VUOTO } : { body: EINAUDI }); })());
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  r = await cerca(p, ISBN);
  ok('Google: ISBN con 0 risultati alla prima richiesta → si riprova e si trova', /Underworld/.test(r.titoli.join('|')) && isbnChiamate(p).length === 2, isbnChiamate(p).length + ' chiamate · ' + r.titoli.join('|'));
  await p.close2();

  // 5c. Google ha in archivio solo l'ISBN-10 (come «Across the sand», 883474621X): dopo lo 0 si prova la forma ISBN-10
  p = await apri(browser, u => (/isbn:8806219219/.test(decodeURIComponent(u)) ? { body: EINAUDI } : { body: VUOTO }));
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  r = await cerca(p, ISBN);
  ok('Google: ISBN noto solo nella forma ISBN-10 → trovato al secondo tentativo', /Underworld/.test(r.titoli.join('|')) && isbnChiamate(p).length === 2, isbnChiamate(p).map(u => decodeURIComponent(u).match(/isbn:\w+/)[0]).join(','));
  await p.close2();

  // 5d. ISBN che Google non conosce: isbn:13, isbn:10, solo il numero, di nuovo isbn:13, poi il messaggio
  const forma = u => new URL(u).searchParams.get('q');
  p = await apri(browser, () => ({ body: VUOTO }));
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  r = await cerca(p, ISBN);
  const forme = p.googleUrls.map(forma).join(',');
  ok('Google: ISBN sconosciuto → isbn:13, isbn:10, numero, isbn:13 e poi «nessuna fonte»', forme === 'isbn:9788806219215,isbn:8806219219,9788806219215,isbn:9788806219215' && /nessuna fonte/i.test(r.stato), forme + ' · ' + r.stato);
  await p.close2();

  // 5e. Trovato solo con il numero senza «isbn:»: si tiene il volume con quell'ISBN (anche se lo ha solo a 10 cifre), non gli altri
  const ALTRO = { volumeInfo: { title: 'Libro qualunque', authors: ['X'], industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780000000002' }] } };
  const SOLO10 = { volumeInfo: { title: 'Underworld', authors: ['Don DeLillo'], industryIdentifiers: [{ type: 'ISBN_10', identifier: '8806219219' }] } };
  p = await apri(browser, u => (forma(u) === '9788806219215' ? { body: { items: [ALTRO, SOLO10] } } : { body: VUOTO }));
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  r = await cerca(p, ISBN);
  ok('Google: trovato con il solo numero, tenuto solo il volume con quell\'ISBN', r.titoli.join('|') === 'Underworld', p.googleUrls.map(forma).join(',') + ' · ' + r.titoli.join('|'));
  await p.close2();

  // 6. Apple Books per ISBN (lookup?isbn=): trova l'edizione anche se Google, Open Library e Wikidata non la conoscono
  p = await apri(browser, () => ({ body: VUOTO }));
  p.appleUrls = [];
  await p.unroute(/itunes\.apple\.com/);
  await p.route(/itunes\.apple\.com/, r => { const u = new URL(r.request().url()); p.appleUrls.push(u.pathname + u.search);
    const hit = u.pathname === '/lookup' && u.searchParams.get('isbn') === '9788806242572';
    r.fulfill({ status: 200, contentType: 'application/javascript', body: `${u.searchParams.get('callback')}(${JSON.stringify({ results: hit ? [{ trackName: 'Il libro Einaudi', artistName: 'Autore Prova', releaseDate: '2020-01-01T00:00:00Z' }] : [] })})` }); });
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  r = await cerca(p, '978-88-06-24257-2');
  ok('Apple Books cercato per ISBN (lookup), con l\'ISBN nel risultato', /Il libro Einaudi/.test(r.titoli.join('|')) && /9788806242572/.test(r.primo) && p.appleUrls.some(u => /^\/lookup\?.*isbn=9788806242572/.test(u)), p.appleUrls.join(' ') + ' / ' + r.primo);
  await p.close2();

}
