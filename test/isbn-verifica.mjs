// Verifica delle ricerche per ISBN: errori delle fonti non mascherati, «Verifica ricerche» senza filtro sulla lingua,
// ISBN-10 convertito per Wikidata, Wikidata anche in «Aggiorna informazioni».
import { APP, ok, newPage } from './lib.mjs';

const VUOTO = { totalItems: 0 };
const EINAUDI_ISBN = '9788806219215';
const ISBN10 = '8806219219';
const WD_AUTORE = { edLabel: { value: 'Underworld' }, authorLabel: { value: 'Don DeLillo' }, date: { value: '1997-11-01T00:00:00Z' }, pages: { value: '832' } };

async function apri(browser, { google, wikidata = [], ol = { docs: [] } } = {}) {
  const p = await newPage(browser, { external: 'allow' });
  p.gUrls = []; p.wUrls = [];
  await p.route(/www\.googleapis\.com\/books/, r => { p.gUrls.push(decodeURIComponent(r.request().url())); const x = google ? google(r.request().url()) : { status: 200, body: VUOTO }; setTimeout(() => r.fulfill({ status: x.status || 200, contentType: 'application/json', body: JSON.stringify(x.body) }), x.delay || 0); });
  await p.route(/openlibrary\.org\/search/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ol) }));
  // Apple risponde (JSONP, senza risultati): così il messaggio dice solo ciò che davvero manca
  await p.route(/itunes\.apple\.com/, r => { const cb = new URL(r.request().url()).searchParams.get('callback'); r.fulfill({ status: 200, contentType: 'application/javascript', body: `${cb}({"results":[]})` }); });
  await p.route(/query\.wikidata\.org/, r => { p.wUrls.push(decodeURIComponent(r.request().url())); r.fulfill({ status: 200, contentType: 'application/sparql-results+json', body: JSON.stringify({ results: { bindings: wikidata } }) }); });
  return p;
}
const cerca = async (p, q) => {
  await p.locator('.dock .add').first().click(); await p.waitForSelector('#s-q');
  await p.fill('#s-q', q); await p.keyboard.press('Enter');
  await p.waitForFunction(() => !/^Cerco/.test(document.querySelector('#s-status').textContent), null, { timeout: 25000 }).catch(() => {}); // i tentativi su Google richiedono qualche secondo
  await p.waitForTimeout(200);
  const stato = await p.locator('#s-status').innerText();
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  return stato;
};

export default async function ({ browser }) {
  // A. Google spento (quota) e nessuna altra fonte ha il libro: il messaggio deve dire che una fonte non ha risposto
  let p = await apri(browser, { google: () => ({ status: 429, body: { error: { message: 'Quota exceeded' } } }) });
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  let stato = await cerca(p, EINAUDI_ISBN);
  ok('errore di una fonte: non si dice «nessuna fonte conosce» quando Google non ha risposto', !/nessuna fonte conosce/i.test(stato) && /google/i.test(stato), stato);
  await p.close2();

  // B. «Verifica ricerche» interroga Google senza filtro sulla lingua (altrimenti dice «OK, 0 risultati» per Ubik)
  p = await apri(browser, { google: u => ({ body: /langRestrict/.test(u) ? VUOTO : { items: [{ volumeInfo: { title: 'Ubik', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788804731481' }] } }] } }) });
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  await p.locator('.dock .more').click(); await p.locator('[data-m=backup]').click(); await p.waitForSelector('#i-verify');
  await p.locator('#i-verify').click(); await p.waitForTimeout(1500);
  const verifica = await p.locator('#v-status').innerText();
  ok('verifica ricerche: Google interrogato senza filtro sulla lingua', p.gUrls.some(u => /isbn:9788804731481/.test(u) && !/langRestrict/.test(u)), p.gUrls.join(' ; ').slice(0, 200));
  ok('verifica ricerche: esito positivo con il risultato trovato', /Google Books: OK \(1 risultati\)/.test(verifica), verifica);
  await p.close2();

  // C. ISBN-10: Wikidata interrogata anche con la forma a 13 cifre (P212), non solo con l'ISBN-10 (P957)
  p = await apri(browser, { wikidata: [WD_AUTORE] });
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  stato = await cerca(p, ISBN10);
  ok('ISBN-10: Wikidata cercata anche con l\'ISBN a 13 cifre, con i trattini', p.wUrls.some(u => u.includes('"978-88-06-21921-5"') && u.includes('"88-06-21921-9"')), p.wUrls.map(u => u.slice(-160)).join(' ; '));
  await p.close2();

  // E. Etichette Wikidata senza nome (codice Q) non finiscono nei risultati come autore
  p = await apri(browser, { wikidata: [{ ...WD_AUTORE, authorLabel: { value: 'Q123456' } }] });
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  await p.locator('.dock .add').first().click(); await p.waitForSelector('#s-q');
  await p.fill('#s-q', EINAUDI_ISBN); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
  const testo = await p.locator('#s-results .result').first().innerText().catch(() => '');
  ok('Wikidata: un autore senza nome non mostra il codice Q', !/Q\d+/.test(testo) && /Underworld/.test(testo), testo.replace(/\n/g, ' | '));
  await p.close2();

  // F. Una risposta lenta per una ricerca vecchia non sovrascrive la ricerca più recente
  p = await apri(browser, { google: u => (/Ubik/.test(u) ? { body: { items: [{ volumeInfo: { title: 'Ubik', authors: ['Philip K. Dick'] } }] }, delay: 1200 } : { body: { items: [{ volumeInfo: { title: 'Dune', authors: ['Frank Herbert'] } }] } }) });
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  await p.locator('.dock .add').first().click(); await p.waitForSelector('#s-q');
  await p.fill('#s-q', 'Ubik'); await p.keyboard.press('Enter');
  await p.fill('#s-q', 'Dune'); await p.keyboard.press('Enter');
  await p.waitForTimeout(2500);
  const titoli = await p.locator('#s-results .result b').allInnerTexts();
  ok('ricerche rapide: resta il risultato dell\'ultima ricerca', titoli.join() === 'Dune', titoli.join());
  await p.close2();

  // D. «Aggiorna informazioni» usa anche Wikidata: un libro con ISBN ma senza autore riceve l'autore
  p = await apri(browser, { wikidata: [WD_AUTORE] });
  await p.goto(APP + '/');
  await p.evaluate(() => localStorage.setItem('libreria-diego-v1', JSON.stringify([{ id: 'u1', title: 'Underworld', status: 'da-leggere', isbn: '9788806219215', added: 1, rating: 0 }])));
  await p.reload(); await p.waitForTimeout(300);
  await p.locator('#main [data-id="u1"]').first().click(); await p.waitForSelector('.sheet');
  await p.locator('#s-refresh').click(); await p.waitForTimeout(300);
  await p.waitForFunction(() => !document.querySelector('#s-refresh').disabled, null, { timeout: 25000 }).catch(() => {});
  const autore = await p.inputValue('#d-author');
  ok('aggiorna informazioni: Wikidata consultata e autore riempito', p.wUrls.length >= 1 && autore === 'Don DeLillo', `richieste Wikidata: ${p.wUrls.length} · autore: "${autore}"`);
  await p.close2();
}
