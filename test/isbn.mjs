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
  await p.route(/itunes\.apple\.com/, r => r.abort());
  return p;
}
const cerca = async (p, q) => {
  await p.locator('.dock .add').first().click(); await p.waitForSelector('#s-q');
  await p.fill('#s-q', q); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
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
  const riga = { itemLabel: { value: 'Underworld' }, authorLabel: { value: 'Don DeLillo' }, date: { value: '1997-11-01T00:00:00Z' }, pages: { value: '832' } };
  p = await apri(browser, () => ({ body: VUOTO }), { wikidata: [riga] });
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  r = await cerca(p, ISBN);
  ok('Wikidata: un ISBN noto solo lì compare nei risultati', r.titoli.includes('Underworld') && p.wikidataUrls.length === 1 && /9788806219215/.test(decodeURIComponent(p.wikidataUrls[0])), `${p.wikidataUrls.length} richieste · ${r.stato}`);
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

}
