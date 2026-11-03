// Fonti di ricerca (v78): pausa comune per Wikidata (D9), «Verifica ricerche» su quattro fonti (D10),
// cognome del primo autore nelle ricerche di copertine (D11).
import { APP, ok, newPage, localBooks } from './lib.mjs';

const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const load = async (p, books) => {
  await p.goto(APP + '/');
  await p.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)), books);
  await p.reload(); await p.waitForSelector('#main'); await p.waitForTimeout(300);
};
const toasts = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
const waitToast = (p, re, ms = 10000) => p.waitForFunction(r => new RegExp(r).test([...document.querySelectorAll('.toast')].map(t => t.textContent).join(' ')), re.source, { timeout: ms }).catch(() => {});
const backup = async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.locator('.dock .more').click(); await p.locator('[data-m=backup]').click(); await p.waitForSelector('#i-series'); };

async function apri(browser) {
  const p = await newPage(browser, { external: 'allow' });
  p.wd = { calls: 0, fail: null, failFirst: 0, seq: [] };
  const wd = r => {
    p.wd.calls++;
    if (p.wd.seq.length) { const st = p.wd.seq.shift(); if (st !== 200) return json(r, {}, st); }
    if (p.wd.failFirst > 0) { p.wd.failFirst--; return json(r, {}, 503); }
    if (p.wd.fail) return json(r, {}, p.wd.fail);
    if (/wbsearchentities/.test(r.request().url())) return json(r, { search: [] });
    return json(r, { results: { bindings: [] } });
  };
  await p.route(/query\.wikidata\.org/, wd);
  await p.route(/www\.wikidata\.org\/w\/api\.php/, wd);
  p.gUrls = [];
  await p.route(/www\.googleapis\.com\/books/, r => { p.gUrls.push(decodeURIComponent(r.request().url())); json(r, { totalItems: 0 }); });
  await p.route(/openlibrary\.org/, r => json(r, { docs: [] }));
  await p.route(/itunes\.apple\.com/, r => { const cb = new URL(r.request().url()).searchParams.get('callback'); r.fulfill({ status: 200, contentType: 'application/javascript', body: `${cb}({"results":[]})` }); });
  await p.route(/mzstatic\.com|covers\.openlibrary/, r => r.abort());
  return p;
}

// D9: una sola regola per Wikidata in tutta l'app
async function pausa(browser) {
  const p = await apri(browser);
  const base = { added: 1, rating: 0, status: 'da-leggere' };
  await load(p, [1, 2, 3, 4].map(i => ({ ...base, id: 'w' + i, title: 'Libro ' + i, author: 'Autore ' + i })));
  const has = await p.evaluate(() => !!(window.libreriaFonti && window.libreriaFonti.stato && window.libreriaFonti.riprova));
  ok('libreriaFonti esposta (stato, riprova)', has);
  if (!has) { await p.close2(); return; }

  // «Cerca le serie» con Wikidata giù: due errori di fila, poi pausa e stop
  p.wd.fail = 503;
  await backup(p); await p.locator('#i-series').click();
  await waitToast(p, /Serie trovate|interrotta/);
  const m1 = await toasts(p);
  ok('Cerca le serie: due errori di fila e si ferma', /Wikidata non risponde: ricerca interrotta/.test(m1) && p.wd.calls === 2, `${m1} · chiamate ${p.wd.calls}`);
  const st = await p.evaluate(() => window.libreriaFonti.stato('wikidata'));
  ok('dopo due errori Wikidata è in pausa per circa 5 minuti', st && st.pausaFino - Date.now() > 4 * 60e3 && st.pausaFino - Date.now() <= 5 * 60e3 + 1000, JSON.stringify(st));

  // La pausa vale anche per «Aggiorna informazioni»: niente richieste, il messaggio lo dice
  p.wd.fail = null; const before = p.wd.calls;
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  await p.locator('#main [data-id="w1"]').first().click(); await p.waitForSelector('.sheet');
  await p.click('#s-refresh'); await p.waitForFunction(() => !/Cerco/.test(document.querySelector('#s-ref-status').textContent), null, { timeout: 30000 });
  const ref = await p.locator('#s-ref-status').innerText();
  ok('pausa anche in «Aggiorna informazioni»: nessuna richiesta a Wikidata', p.wd.calls === before, `${p.wd.calls} vs ${before}`);
  ok('pausa anche in «Aggiorna informazioni»: il messaggio lo dice', /Wikidata non risponde/.test(ref), ref);
  await p.keyboard.press('Escape'); await p.locator('[data-u="drop"]').click({ timeout: 700 }).catch(() => {});
  await p.waitForTimeout(300);

  // «Verifica ricerche» toglie la pausa e prova Wikidata
  await backup(p); await p.locator('#i-verify').click();
  await p.waitForFunction(() => { const t = document.querySelector('#v-status').textContent; return /Wikidata:/.test(t) && !t.includes('…'); }, null, { timeout: 20000 }).catch(() => {});
  const vs = await p.locator('#v-status').innerText();
  ok('Verifica ricerche: Wikidata provata anche dopo la pausa', /Wikidata: OK/.test(vs) && p.wd.calls > before, vs);
  ok('dopo la verifica la pausa è finita', (await p.evaluate(() => window.libreriaFonti.stato('wikidata').pausaFino)) <= Date.now());
  await p.locator('#i-close').click().catch(() => {});

  // Un solo errore non ferma «Completa autori e copertine»: si prosegue con gli altri libri
  await load(p, [1, 2, 3].map(i => ({ ...base, id: 'c' + i, title: 'Senza copertina ' + i, author: 'Autore ' + i })));
  await p.evaluate(() => window.libreriaFonti.riprova('wikidata'));
  p.wd.failFirst = 1; const c0 = p.wd.calls;
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  await backup(p); await p.locator('#i-authors').click();
  await waitToast(p, /Informazioni aggiornate/, 20000);
  ok('Completa autori: un errore di Wikidata non ferma le serie degli altri libri', p.wd.calls - c0 >= 3, `chiamate ${p.wd.calls - c0} · ${await toasts(p)}`);
  // Messaggio di «Completa autori» con Wikidata giù: quanti libri sono rimasti senza ricerca della serie
  await load(p, [1, 2, 3].map(i => ({ ...base, id: 'd' + i, title: 'Giù ' + i, author: 'Autore ' + i })));
  await p.evaluate(() => window.libreriaFonti.riprova('wikidata'));
  p.wd.fail = 503;
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  await backup(p); await p.locator('#i-authors').click();
  await waitToast(p, /Informazioni aggiornate/, 20000);
  const m3 = await toasts(p);
  ok('Completa autori: il messaggio dice per quanti libri le serie non sono state cercate', /Serie non cercate per 3 libri: Wikidata non risponde\./.test(m3), m3);
  p.wd.fail = null;

  // «Cerca le serie» con Wikidata già in pausa: nessuna copia inutile, messaggio subito
  const copie = () => p.evaluate(() => new Promise(res => { const r = indexedDB.open('libreria-copie'); r.onsuccess = () => { try { const q = r.result.transaction('copie').objectStore('copie').getAll(); q.onsuccess = () => res(Math.max(0, ...q.result.map(c => c.at))); } catch { res(0); } }; r.onerror = () => res(-1); })); // la copia più recente
  const k0 = await copie(); const c3 = p.wd.calls;
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  await backup(p); await p.locator('#i-series').click();
  await waitToast(p, /Wikidata non risponde/, 5000);
  const m4 = await toasts(p);
  ok('Cerca le serie in pausa: messaggio subito, nessuna richiesta', /Wikidata non risponde/.test(m4) && p.wd.calls === c3, `${m4} · ${p.wd.calls - c3}`);
  ok('Cerca le serie in pausa: nessuna copia nuova', (await copie()) === k0, `${await copie()} vs ${k0}`);

  // Errori non di fila: un 500 tra due 503 interrompe la serie, niente pausa
  await p.evaluate(() => window.libreriaFonti.riprova('wikidata'));
  await load(p, [1, 2, 3].map(i => ({ ...base, id: 'f' + i, title: 'Fila ' + i, author: 'Autore ' + i })));
  p.wd.seq = [503, 500, 503]; const c4 = p.wd.calls;
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  await backup(p); await p.locator('#i-series').click();
  await waitToast(p, /Serie trovate/, 15000);
  const m5 = await toasts(p);
  ok('503, 500, 503: non sono due errori di fila, nessuna pausa', !/interrotta/.test(m5) && p.wd.calls - c4 >= 3 && (await p.evaluate(() => window.libreriaFonti.stato('wikidata').pausaFino)) <= Date.now(), `${m5} · ${p.wd.calls - c4}`);
  p.wd.seq = [];
  ok('pausa: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

// D10: «Verifica ricerche» con una riga per ciascuna delle quattro fonti
async function verifica(browser) {
  const p = await apri(browser);
  await load(p, []);
  await backup(p); await p.locator('#i-verify').click();
  await p.waitForFunction(() => { const t = document.querySelector('#v-status').textContent; return ['Google Books:', 'Open Library:', 'Apple Books:', 'Wikidata:'].every(s => t.includes(s)) && !t.includes('…'); }, null, { timeout: 20000 }).catch(() => {});
  const vs = await p.locator('#v-status').innerText();
  ok('Verifica ricerche: quattro fonti nell\'ordine Google, Open Library, Apple, Wikidata', /Google Books: .*Open Library: .*Apple Books: .*Wikidata: /s.test(vs), vs);
  ok('Verifica ricerche: Apple e Wikidata rispondono OK', /Apple Books: OK/.test(vs) && /Wikidata: OK/.test(vs), vs);
  await p.close2();
}

// D11: con più autori le ricerche di copertine usano il cognome del primo
async function autori(browser) {
  const p = await apri(browser);
  await load(p, [{ added: 1, rating: 0, status: 'da-leggere', id: 'a1', title: 'Libro a due mani', author: 'Mario Rossi, Luca Bianchi' }]);
  await p.locator('#main [data-id="a1"]').first().click(); await p.waitForSelector('.sheet');
  await p.locator('details.edit summary').click().catch(() => {});
  p.gUrls = [];
  await p.locator('#cv-more').click();
  await p.waitForFunction(() => !/Cerco/.test(document.querySelector('#cv-status').textContent), null, { timeout: 20000 }).catch(() => {});
  const q = p.gUrls.find(u => /intitle/.test(u)) || '';
  ok('copertine: cognome del primo autore (Rossi), non dell\'ultimo', /inauthor:Rossi/.test(q) && !/inauthor:Bianchi/.test(q), q);
  await p.close2();
}

export default async function run({ browser }) {
  await verifica(browser);
  await autori(browser);
  await pausa(browser);
}
