// Trama nella lingua del telefono (v80) e messaggi della sincronizzazione in alto, lontani dal menu.
import { APP, ok, newPage, localBooks } from './lib.mjs';

const IT = 'Un giovane uomo si trova a vivere in una città che non conosce e cerca di capire il senso della sua vita, tra amici e nemici.';
const EN = 'A young man finds himself living in a city he does not know and tries to understand the meaning of his life, with friends and enemies.';
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const italiano = { fn: () => { Object.defineProperty(navigator, 'language', { get: () => 'it-IT' }); Object.defineProperty(navigator, 'languages', { get: () => ['it-IT'] }); } };
const load = async (p, books) => {
  await p.goto(APP + '/');
  await p.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)), books);
  await p.reload(); await p.waitForSelector('#main'); await p.waitForTimeout(300);
};
async function apri(browser) {
  const p = await newPage(browser, { external: 'allow', init: italiano });
  // Google (per ISBN e per titolo): edizione con la trama in inglese; Apple Books: stessa edizione con la trama in italiano.
  await p.route(/www\.googleapis\.com\/books/, r => json(r, { totalItems: 1, items: [{ volumeInfo: { title: 'La città', authors: ['Mario Rossi'], language: 'it', description: EN, pageCount: 300, industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788804000001' }] } }] }));
  await p.route(/itunes\.apple\.com/, r => { const cb = new URL(r.request().url()).searchParams.get('callback'); r.fulfill({ status: 200, contentType: 'application/javascript', body: `${cb}(${JSON.stringify({ results: [{ trackName: 'La città', artistName: 'Mario Rossi', description: IT, releaseDate: '2020-01-01' }] })})` }); });
  await p.route(/openlibrary\.org|wikidata\.org|mzstatic\.com|books\.google\.com/, r => r.abort());
  return p;
}

async function aggiorna(browser) {
  const p = await apri(browser);
  await load(p, [{ added: 1, rating: 0, status: 'da-leggere', id: 't1', title: 'La città', author: 'Mario Rossi', isbn: '9788804000001', synopsis: EN }]);
  await p.locator('#main [data-id="t1"]').first().click(); await p.waitForSelector('.sheet');
  await p.click('#s-refresh'); await p.waitForFunction(() => !/Cerco/.test(document.querySelector('#s-ref-status').textContent), null, { timeout: 40000 });
  ok('Aggiorna informazioni: la trama in italiano prende il posto di quella in inglese', (await p.locator('#s-syn').innerText()).trim() === IT, await p.locator('#s-syn').innerText());
  ok('trama: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function nuovo(browser) {
  const p = await apri(browser);
  await load(p, []);
  await p.locator('.dock .add').first().click(); await p.waitForSelector('#s-q');
  await p.fill('#s-q', 'La città Rossi'); await p.keyboard.press('Enter');
  await p.waitForSelector('#s-results .result', { timeout: 30000 }).catch(() => {});
  const res = await p.locator('#s-results .result').allInnerTexts();
  const gi = res.findIndex(t => /pp\./.test(t)); // il risultato di Google (ha le pagine), con la trama in inglese
  ok('Nuovo libro: due risultati dello stesso libro (Google e Apple)', res.length >= 2 && gi >= 0, JSON.stringify(res));
  if (gi >= 0) {
    await p.locator('#s-results .result').nth(gi).click(); await p.waitForTimeout(300);
    const prev = await p.locator('#a-prev .synopsis').innerText().catch(() => '');
    const pages = await p.inputValue('#d-pages');
    ok('Nuovo libro: scelta l\'edizione con la trama in inglese, arriva quella italiana dello stesso libro', prev.trim() === IT && pages === '300', JSON.stringify({ prev, pages }));
  }
  await p.close2();
}

// I messaggi della sincronizzazione stanno in alto, sotto la barra di ricerca; gli altri restano in basso
async function avviso(browser) {
  const p = await newPage(browser, { width: 390, height: 844 });
  const molti = Array.from({ length: 40 }, (_, i) => ({ added: i + 1, rating: 0, status: 'letto', id: 'l' + i, title: 'Letto ' + i, author: 'A' }));
  await load(p, [{ added: 1, rating: 0, status: 'in-lettura', id: 'r1', title: 'In lettura', author: 'A', pages: 300, page: 10, started: '2026-10-01' }, ...molti]);
  // All'apertura la barra di ricerca è a metà pagina: il messaggio va in cima allo schermo
  await p.evaluate(() => window.libreriaHost.done('Libreria sincronizzata: 108 libri · diego@example.com.'));
  await p.waitForTimeout(200);
  const [t, dock] = [await p.locator('.toast').boundingBox(), await p.locator('#dock').boundingBox()];
  ok('sincronizzazione all\'apertura: messaggio in cima, lontano dal menu in basso', t && t.y < 80 && t.y + t.height < dock.y - 300, JSON.stringify({ t, dock }));
  // Dopo lo scorrimento la barra di ricerca è attaccata in cima: il messaggio sta subito sotto
  await p.evaluate(() => window.scrollTo(0, 1500)); await p.waitForTimeout(200);
  await p.evaluate(() => window.libreriaHost.notice('In questo account non ci sono libri.'));
  await p.waitForTimeout(200);
  const [t2, tb2] = [await p.locator('.toast').boundingBox(), await p.locator('#toolbar').boundingBox()];
  ok('sincronizzazione dopo lo scorrimento: subito sotto la barra di ricerca', t2 && tb2.y <= 1 && t2.y >= tb2.y + tb2.height && t2.y < tb2.y + tb2.height + 20, JSON.stringify({ t2, tb2 }));
  // Con l'avviso «Nuova versione» in cima, il messaggio va sotto
  await p.evaluate(() => { window.scrollTo(0, 0); const u = document.createElement('div'); u.className = 'update-bar'; u.textContent = 'Nuova versione disponibile'; document.body.append(u); });
  await p.waitForTimeout(150);
  await p.evaluate(() => window.libreriaHost.done('Libreria sincronizzata.')); await p.waitForTimeout(200);
  const [t4, u4] = [await p.locator('.toast').boundingBox(), await p.locator('.update-bar').boundingBox()];
  ok('sincronizzazione con «Nuova versione»: il messaggio sta sotto l\'avviso', t4.y >= u4.y + u4.height, JSON.stringify({ t4, u4 }));
  await p.evaluate(() => document.querySelector('.update-bar').remove());
  // Gli altri avvisi restano in basso
  await p.locator('#hero [data-add]').first().click(); await p.waitForTimeout(250);
  const t3 = await p.locator('.toast').boundingBox(), d3 = await p.locator('#dock').boundingBox();
  ok('gli altri avvisi («Pagina 20 · Annulla») restano in basso, vicino al pollice', t3 && t3.y > d3.y - 120, JSON.stringify({ t3, d3 }));
  const w = await newPage(browser, { width: 1366, height: 860 });
  await load(w, []);
  await w.evaluate(() => window.libreriaHost.done('Libreria sincronizzata.')); await w.waitForTimeout(200);
  const tw = await w.locator('.toast').boundingBox();
  ok('computer: messaggio della sincronizzazione come prima (in basso)', tw && tw.y > 700, JSON.stringify(tw));
  ok('avviso: nessun errore in console', !p.errs.length && !w.errs.length, [...p.errs, ...w.errs].join(' / '));
  await p.close2(); await w.close2();
}

export default async function run({ browser }) {
  await aggiorna(browser);
  await nuovo(browser);
  await avviso(browser);
}
