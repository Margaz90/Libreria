// Tre funzioni: pagina rapida nell'hero (cursore, +10, ripeti, annulla); copie prima delle operazioni su molti libri e ripristino; il prossimo libro.
import { APP, ok, newPage, localBooks, toastText, wait as poll } from './lib.mjs';

const load = async (p, books) => {
  await p.goto(APP + '/');
  await p.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)), books);
  await p.reload(); await p.waitForTimeout(300);
};
const book = async (p, id) => (await localBooks(p)).find(x => x.id === id);
const wait = p => p.waitForTimeout(900);
// Aspetta che il libro salvato in localStorage abbia i valori attesi (il salvataggio è ritardato di 700 ms); null = campo assente.
const until = (p, id, o) => p.waitForFunction(([id, o]) => {
  const b = JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').find(x => x.id === id);
  return b && Object.entries(o).every(([k, v]) => b[k] === (v === null ? undefined : v));
}, [id, o], { timeout: 4000 }).catch(() => {});

async function paginaRapida(browser) {
  const p = await newPage(browser);
  const base = { added: 1, rating: 0, status: 'in-lettura' };
  await load(p, [
    { ...base, id: 'p1', title: 'Con totale', author: 'A', pages: 300, page: 100 },
    { ...base, id: 'p2', title: 'Senza totale', author: 'B', page: 20 },
  ]);
  const card = id => p.locator(`#hero .rcard:has([data-page="${id}"])`);
  const add10 = id => card(id).locator('button[data-add="10"]');
  const toastBtn = () => p.locator('.toast button');

  ok('pagina rapida: +10, ripeti e cursore con etichette', await card('p1').locator('.pquick').count() === 1
    && await add10('p1').getAttribute('aria-label') === 'Aggiungi 10 pagine a Con totale'
    && await add10('p2').getAttribute('aria-label') === 'Aggiungi 10 pagine a Senza totale'
    && await card('p1').locator('input[type=range]').getAttribute('aria-label') === 'Avanzamento di Con totale'
    && await card('p1').locator('input[type=range]').getAttribute('aria-valuetext') === 'pagina 100 di 300'
    && await card('p1').locator('button[data-repeat]').count() === 0);
  const hs = await add10('p1').boundingBox();
  ok('bersagli al tocco di almeno 44 px', hs.height >= 44 && hs.width >= 44, `${hs.width}x${hs.height}`);

  await add10('p1').click(); await until(p, 'p1', { page: 110 });
  ok('+10 salva subito', (await book(p, 'p1')).page === 110, (await book(p, 'p1')).page);
  ok('toast «Pagina 110»', /Pagina 110/.test(await p.locator('.toast').innerText()));
  const tb = await p.locator('.toast').boundingBox(), ab = await p.locator('.dock .tab.add .ico').boundingBox();
  const meet = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  ok('avviso: «Annulla» alto almeno 44 px', (await toastBtn().boundingBox()).height >= 44);
  ok('avviso a una riga', tb.height <= 46, tb.height);
  ok('avviso lontano dal pulsante Aggiungi', !meet(tb, ab));
  await toastBtn().click(); await until(p, 'p1', { page: 100 });
  ok('Annulla torna a 100', (await book(p, 'p1')).page === 100 && (await book(p, 'p1')).pageStep === undefined);

  await card('p1').locator('[data-page]').fill('130');
  await card('p1').locator('[data-page]').press('Enter'); await until(p, 'p1', { page: 130 });
  ok('pagina scritta a mano: salto ricordato', (await book(p, 'p1')).pageStep === 30, (await book(p, 'p1')).pageStep);
  const rep = card('p1').locator('button[data-repeat]');
  ok('ripeti mostra +30', (await rep.innerText()).trim() === '+30' && await rep.getAttribute('aria-label') === 'Aggiungi 30 pagine a Con totale');
  await rep.click(); await until(p, 'p1', { page: 160 });
  ok('ripeti porta a 160', (await book(p, 'p1')).page === 160, (await book(p, 'p1')).page);
  await add10('p1').click(); await until(p, 'p1', { page: 170 });
  ok('+10 non cambia il salto', (await book(p, 'p1')).pageStep === 30 && (await book(p, 'p1')).page === 170);

  // Annulla dopo un salto a mano ripristina anche il salto precedente.
  await card('p1').locator('[data-page]').fill('175');
  await card('p1').locator('[data-page]').press('Enter'); await until(p, 'p1', { page: 175 });
  ok('salto aggiornato a 5', (await book(p, 'p1')).pageStep === 5);
  await toastBtn().click(); await until(p, 'p1', { page: 170 });
  ok('Annulla ripristina pagina e salto', (await book(p, 'p1')).page === 170 && (await book(p, 'p1')).pageStep === 30);

  const r = card('p1').locator('input[type=range]');
  await r.fill('250');
  ok('cursore: durante il trascinamento non salva', (await book(p, 'p1')).page === 170);
  await r.dispatchEvent('change'); await until(p, 'p1', { page: 250 });
  ok('cursore: salva al rilascio', (await book(p, 'p1')).page === 250, (await book(p, 'p1')).page);
  ok('cursore: salto ricordato (80)', (await book(p, 'p1')).pageStep === 80);

  await card('p1').locator('button[data-repeat]').click(); await until(p, 'p1', { page: 300 });
  const fin = await card('p1').locator('[data-finish]').isVisible().catch(() => false);
  ok('limite al totale e compare Finito', (await book(p, 'p1')).page === 300 && fin, (await book(p, 'p1')).page);

  ok('senza pagine totali: niente cursore, +10 funziona', await card('p2').locator('input[type=range]').count() === 0
    && (await add10('p2').click(), await until(p, 'p2', { page: 30 }), (await book(p, 'p2')).page === 30), (await book(p, 'p2')).page);

  // Due +10 rapidi e Annulla: si torna alla pagina prima dell'ultimo gesto.
  await load(p, [{ ...base, id: 'p1', title: 'Con totale', author: 'A', pages: 300, page: 100 }]);
  await add10('p1').click(); await add10('p1').click();
  await toastBtn().click(); await until(p, 'p1', { page: 110 });
  ok('due +10 rapidi e Annulla: si torna a 110', (await book(p, 'p1')).page === 110, (await book(p, 'p1')).page);
  // Annulla dopo «Finito!»: il libro letto non deve tornare indietro di pagina.
  await load(p, [{ ...base, id: 'p1', title: 'Con totale', author: 'A', pages: 300, page: 295 }]);
  await add10('p1').click(); await until(p, 'p1', { page: 300 });
  await card('p1').locator('[data-finish]').click(); await until(p, 'p1', { status: 'letto' });
  if (await toastBtn().count()) { await toastBtn().first().click(); await wait(p); }
  const fb = await book(p, 'p1');
  ok('Annulla dopo Finito: il libro resta letto con tutte le pagine', fb.status === 'letto' && fb.page === 300, `${fb.status} ${fb.page}`);
  // Salvataggio manuale senza cambiamenti: niente toast.
  await load(p, [{ ...base, id: 'p1', title: 'Con totale', author: 'A', pages: 300, page: 100, pageStep: 30 }]);
  const upd0 = (await book(p, 'p1')).updated;
  await card('p1').locator('[data-page]').dispatchEvent('change'); await wait(p);
  ok('stessa pagina confermata di nuovo: niente salvataggio né toast', await p.locator('.toast').count() === 0 && (await book(p, 'p1')).updated === upd0 && (await book(p, 'p1')).pageStep === 30);
  ok('scheda di lettura: niente Aggiorna, Dettagli né barra doppia', await p.locator('#hero [data-save], #hero .ractions, #hero .pbar').count() === 0 && await card('p1').locator('.rcover').count() === 1);
  const pct = await card('p1').locator('input[type=range]').evaluate(r => r.style.getPropertyValue('--pct'));
  await card('p1').locator('input[type=range]').fill('150');
  const pct2 = await card('p1').locator('input[type=range]').evaluate(r => r.style.getPropertyValue('--pct'));
  ok('cursore colorato fino alla pagina attuale, anche mentre si trascina', /^33(\.\d+)?%$/.test(pct) && pct2 === '50%', pct + ' / ' + pct2);
  const ctl = await card('p1').locator('.rctl').boundingBox(), cov = await card('p1').locator('.rcover').boundingBox();
  ok('cursore e pagina a tutta larghezza, sotto la copertina', ctl && cov && ctl.x <= cov.x + 1 && ctl.y >= cov.y + cov.height - 1, JSON.stringify([ctl, cov]));
  ok('pagina rapida: niente scorrimento laterale e nessun errore', (await p.evaluate(w => document.documentElement.scrollWidth <= w, 390)) && !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

// Apre Altro → Backup (prima torno in cima: scorrendo in giù la barra in basso si nasconde).
const backup = async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(150); await p.locator('.dock .more').click(); await p.locator('[data-m=backup]').click(); await p.waitForSelector('#i-file'); await p.waitForTimeout(300); };
// Import di un file dalla scheda Backup (come in sicurezza.mjs), con «aggiorna i libri già presenti» se richiesto.
const K = 'libreria-diego-v1';
const stored = p => p.evaluate(k => localStorage.getItem(k), K);
// Aspetta che i libri salvati cambino rispetto a «before» (il salvataggio è ritardato di 700 ms).
const changed = (p, before) => p.waitForFunction(([k, b]) => localStorage.getItem(k) !== b, [K, before], { timeout: 5000 }).catch(() => {});
const closed = p => p.waitForSelector('#scrim', { state: 'detached', timeout: 3000 }).catch(() => {});
export async function importa(p, books, upd = false) {
  await backup(p);
  await p.setInputFiles('#i-file', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(books)) });
  if (upd) await p.locator('#i-upd').check();
  await p.waitForFunction(() => !document.querySelector('#i-go').disabled, null, { timeout: 5000 });
  const before = await stored(p);
  await p.locator('#i-go').click();
  await p.waitForFunction(() => /Importati/.test(document.querySelector('#i-status')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
  await changed(p, before);
  const close = p.locator('#i-close'); if (await close.isVisible().catch(() => false)) await close.click();
  await closed(p);
}
// Ripristina la copia più recente (due tocchi); restituisce testo della riga e del primo tocco.
export async function ripristina(p) {
  await backup(p);
  const b = p.locator('#u-list button[data-restore]').first();
  await b.waitFor({ timeout: 3000 });
  const row = await p.locator('#u-list .urow').first().innerText();
  await b.click(); const first = (await b.innerText()).trim(); const box = await b.boundingBox();
  const before = await stored(p);
  await b.click();
  await p.waitForFunction(() => /Libreria riportata/.test([...document.querySelectorAll('.toast')].map(t => t.textContent).join(' ')), null, { timeout: 5000 }).catch(() => {});
  await changed(p, before);
  return { row, first, box };
}

async function copie(browser) {
  const p = await newPage(browser);
  const base = { added: 1, rating: 0, status: 'da-leggere' };
  await load(p, [{ ...base, id: 'c1', title: 'Originale', author: 'A' }, { ...base, id: 'c2', title: 'Secondo', author: 'B' }]);
  await importa(p, [{ title: 'ORIGINALE', author: 'A', pages: 99 }, { title: 'Nuovo dal file', author: 'C' }, { title: 'Altro dal file', author: 'D' }], true);
  let bs = await localBooks(p);
  const nuovo = bs.find(b => b.title === 'Nuovo dal file');
  ok('import con aggiorna eseguito', (await book(p, 'c1')).title === 'ORIGINALE' && !!nuovo && bs.length === 4);
  await backup(p);
  ok('avviso: il ripristino vale anche sugli altri dispositivi (una volta, sotto l\'elenco)', await p.locator('#u-sync').count() === 1
    && /Il ripristino vale anche sugli altri dispositivi collegati\./.test(await p.locator('#u-sync').innerText().catch(() => '')));
  await p.locator('#i-close').click(); await closed(p);
  let r = await ripristina(p);
  ok('riga della copia: etichetta, data e numero di libri', /Prima dell'import del backup/.test(r.row) && /\d\d\/\d\d alle \d\d:\d\d · 2 libri/.test(r.row), r.row);
  ok('primo tocco: «Conferma: toglie 2 libri», bersaglio di almeno 44 px', r.first === 'Conferma: toglie 2 libri' && r.box.height >= 44, `${r.first} ${r.box.height}`);
  bs = await localBooks(p);
  ok('import con aggiorna: dopo il ripristino il titolo torna', (await book(p, 'c1')).title === 'Originale' && (await book(p, 'c1')).pages === undefined);
  ok('libri aggiunti dall\'import spariscono col ripristino', bs.length === 2 && !bs.some(b => b.id === nuovo.id));
  ok('messaggio «Libreria riportata al …»', /Libreria riportata al \d\d\/\d\d alle \d\d:\d\d/.test(await toastText(p)), await toastText(p));
  r = await ripristina(p);
  bs = await localBooks(p);
  ok('il ripristino è annullabile (copia «Prima del ripristino»)', /Prima del ripristino/.test(r.row) && (await book(p, 'c1')).title === 'ORIGINALE' && bs.length === 4, r.row);
  ok('nessun libro da togliere: «Conferma ripristino»', r.first === 'Conferma ripristino', r.first);

  await backup(p); await p.locator('#i-authors').click();
  await p.waitForFunction(() => /Informazioni aggiornate/.test([...document.querySelectorAll('.toast')].map(t => t.textContent).join(' ')), null, { timeout: 8000 }).catch(() => {});
  await backup(p);
  ok('Completa autori e copertine crea una copia', /Completa autori e copertine/.test(await p.locator('#u-list .urow').first().innerText()));
  await p.locator('#i-close').click();
  for (let i = 0; i < 4; i++) await importa(p, [{ title: 'Giro ' + i, author: 'G' }]);
  await backup(p);
  const count = await p.locator('#u-list button[data-restore]').count();
  ok('al massimo 3 copie', count === 3, count);
  await p.locator('#i-close').click();

  // Libro eliminato dopo la copia: torna e non resta il segnaposto (altrimenti il cloud lo cancellerebbe di nuovo).
  await load(p, [{ ...base, id: 'c1', title: 'Originale', author: 'A' }, { ...base, id: 'c2', title: 'Secondo', author: 'B' }]);
  await importa(p, [{ title: 'Terzo', author: 'C' }]);
  await p.locator('#main [data-id="c2"]').first().click(); await p.waitForSelector('#s-del');
  await p.locator('#s-del').click(); await p.locator('#s-del').click();
  await p.waitForFunction(() => !JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').some(b => b.id === 'c2'), null, { timeout: 4000 }).catch(() => {});
  ok('libro eliminato', !(await book(p, 'c2')));
  r = await ripristina(p);
  ok('un libro da togliere: «Conferma: toglie 1 libro»', r.first === 'Conferma: toglie 1 libro', r.first);
  const tombs = await p.evaluate(() => JSON.parse(localStorage.getItem('libreria-tombs') || '{}'));
  const terzo = (await localBooks(p)).find(b => b.title === 'Terzo');
  ok('libro eliminato dopo la copia: ripristinato e senza segnaposto', !!(await book(p, 'c2')) && !tombs.c2 && !terzo, JSON.stringify(tombs));
  ok('copie: niente scorrimento laterale e nessun errore', (await p.evaluate(w => document.documentElement.scrollWidth <= w, 390)) && !p.errs.length, p.errs.join(' / '));
  await p.close2();

  // Senza IndexedDB l'import funziona lo stesso e la sezione lo dice.
  const q = await newPage(browser, { init: { fn: () => { IDBFactory.prototype.open = function () { throw new DOMException('no', 'InvalidStateError'); }; } } });
  await load(q, [{ ...base, id: 'c1', title: 'Originale', author: 'A' }]);
  await importa(q, [{ title: 'Senza copie', author: 'S' }]);
  await backup(q);
  const none = q.locator('#u-none');
  ok('senza IndexedDB: import riuscito e #u-none visibile', (await localBooks(q)).length === 2 && await none.isVisible().catch(() => false)
    && /L'annullamento non è disponibile su questo dispositivo/.test(await none.innerText().catch(() => '')) && !q.errs.length, q.errs.join(' / '));
  await q.close2();

  // IndexedDB che non risponde mai (può capitare su WebKit): la copia rinuncia e l'import parte lo stesso.
  const h = await newPage(browser, { init: { fn: () => { IDBFactory.prototype.open = function () { return {}; }; } } });
  await load(h, [{ ...base, id: 'c1', title: 'Originale', author: 'A' }]);
  await backup(h);
  await h.setInputFiles('#i-file', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ title: 'Bloccato', author: 'S' }])) });
  await h.waitForFunction(() => !document.querySelector('#i-go').disabled, null, { timeout: 5000 });
  await h.locator('#i-go').click();
  const done = await h.waitForFunction(() => JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').length === 2, null, { timeout: 4000 }).then(() => true, () => false);
  ok('IndexedDB che non risponde: l\'import parte entro pochi secondi', done && !h.errs.length, h.errs.join(' / '));
  await h.close2();
}

async function prossimo(browser) {
  const p = await newPage(browser);
  await load(p, []);
  const next = (books, ex = [], r = 0) => p.evaluate(([b, e, r]) => window.libreriaNext.next(b, e, () => r).map(x => ({ id: x.book.id, kind: x.kind, reason: x.reason, author: x.book.author })), [books, ex, r]);
  const D = 'da-leggere', L = 'letto';
  const pila = [
    { id: 'n1', title: 'Il cartello', author: 'Don Winslow', genre: 'Thriller', status: D, added: Date.UTC(2024, 2, 10) },
    { id: 'n2', title: 'Joe Country', author: 'Mick Herron', genre: 'Spionaggio', status: D, added: Date.UTC(2025, 5, 1) },
    { id: 'n3', title: 'Stoner', author: 'John Williams', genre: 'Romanzo', status: D, added: Date.UTC(2025, 6, 1) },
    { id: 'n4', title: 'Real Tigers', author: 'Mick Herron', genre: 'Spionaggio', status: D, added: Date.UTC(2025, 8, 1) },
    { id: 'n5', title: 'Il giardino', author: 'Altro', genre: 'Giallo', status: D, added: Date.UTC(2025, 9, 1) },
  ];
  const letti = [
    { id: 'l1', title: 'Slough House', author: 'Mick Herron', genre: 'Spionaggio', status: L, finished: '2026-09-01' },
    { id: 'l2', title: 'Vecchio', author: 'Don Winslow', genre: 'Thriller', status: L, finished: '2020-01-01' },
  ];
  let l = await next([...pila, ...letti]);
  ok('affine: stesso autore dell\'ultimo letto', l[0].kind === 'affine' && l[0].author === 'Mick Herron' && l[0].id === 'n2' && /Dopo «Slough House», ancora Herron$/.test(l[0].reason), JSON.stringify(l[0]));
  ok('la più vecchia è quella con added minore', l[1].kind === 'vecchio' && l[1].id === 'n1' && l[1].reason === 'In pila da marzo 2024', JSON.stringify(l[1]));
  ok('tre proposte diverse', l.length === 3 && new Set(l.map(x => x.id)).size === 3 && l[2].kind === 'caso');
  l = await next([...pila, { id: 'l3', title: 'Altro giallo', author: 'Nessuno in pila', genre: 'Giallo', status: L, finished: '2026-10-01' }]);
  ok('affine per genere se manca l\'autore', l[0].kind === 'affine' && l[0].id === 'n5' && l[0].reason === 'Stesso genere di «Altro giallo»: Giallo', JSON.stringify(l[0]));
  for (const [a, want] of [['Fruttero e Lucentini', 'Fruttero e Lucentini'], ['Autori vari', 'Autori vari'], ['Rossi, Mario', 'Rossi, Mario'], ['Italo Calvino', 'Calvino'], ['Gianni Variale', 'Variale']]) {
    l = await next([{ id: 'q1', title: 'In pila', author: a, status: D, added: 1 }, { id: 'q2', title: 'Letto prima', author: a, status: L, finished: '2026-01-01' }]);
    ok(`affine per autore «${a}»: «ancora ${want}»`, l[0].reason === `Dopo «Letto prima», ancora ${want}`, l[0].reason);
  }
  l = await next([{ id: 'x1', title: 'Senza', status: D, added: 5, author: '', genre: ' ' }, { id: 'x2', title: 'Nulla', status: D, added: 9 }, { id: 'x3', title: 'Letto vuoto', status: L, author: ' ', genre: '' }]);
  ok('libri senza autore né genere: nessun abbinamento vuoto', !l.some(x => x.kind === 'affine') && l.length === 2, JSON.stringify(l));
  l = await next([...pila, ...letti], ['n2', 'n1', 'n3']);
  ok('exclude: niente proposte già mostrate', l.length === 2 && l.every(x => !['n1', 'n2', 'n3'].includes(x.id)) && l[0].id === 'n4', JSON.stringify(l));
  l = await next([{ id: 'z1', title: 'Data strana', status: D, added: 'ieri' }, { id: 'z2', title: 'Altra', status: D, added: -3 }]);
  ok('added non valido: «Da più tempo in pila»', l[0].reason === 'Da più tempo in pila' && !/NaN|undefined/.test(JSON.stringify(l)), JSON.stringify(l));
  l = await next([...letti, { id: 'w', title: 'Desiderio', status: 'desiderato' }]);
  ok('pila vuota: nessuna proposta', l.length === 0);

  // Interfaccia
  const base = { rating: 0 };
  await load(p, [...pila, ...letti].map(b => ({ ...base, pages: 300, callNo: '823.92 HER', ...b })));
  const hero = p.locator('#hero .next');
  const ids = async root => root.locator('.ncard').evaluateAll(n => n.map(x => x.dataset.next));
  ok('hero senza letture mostra Cosa leggo adesso?', await hero.isVisible() && /Cosa leggo adesso\?/.test(await hero.innerText()) && await hero.locator('.ncard').count() === 3
    && await hero.locator('.ncard').first().evaluate(n => /Mick Herron/.test(n.textContent) && /300 pagine/.test(n.textContent)));
  const tabsT = await hero.locator('[role=tab]').allTextContents(), ctrs = await p.locator('#hero .ncard:visible .n').first();
  ok('linguette: tablist con Affine, Il più vecchio, A caso', await hero.locator('[role=tablist]').getAttribute('aria-label') === 'Criteri della proposta'
    && tabsT.join('|') === 'Affine|Il più vecchio|A caso' && await hero.locator('[role=tab]').first().getAttribute('aria-selected') === 'true'
    && await hero.locator('.ncard:visible').count() === 1 && await hero.locator('[data-start]').count() === 1, tabsT.join('|'));
  const l1 = await ids(hero);
  ok('aria-controls e aria-labelledby collegati', await p.locator('#nh-t1').getAttribute('aria-controls') === 'nh-p1' && await p.locator('#nh-p1').getAttribute('aria-labelledby') === 'nh-t1' && await p.locator('#nh-p1').getAttribute('data-next') === l1[1]);
  ok('contatore 1 di 3 nascosto a VoiceOver', (await ctrs.textContent()) === '1 di 3' && await ctrs.getAttribute('aria-hidden') === 'true');
  ok('segnatura con «Segnatura» solo per VoiceOver', await hero.locator('.ncard:visible .call .sr').textContent() === 'Segnatura ');
  const why0 = await next([...pila, ...letti]);
  ok('motivo senza punto nel testo', await hero.locator('.ncard').first().locator('.why').textContent() === why0[0].reason);
  // Linguette interattive
  const tabEl = i => p.locator('#hero [role=tab]').nth(i), sel = i => tabEl(i).getAttribute('aria-selected');
  const titleOf = id => p.locator(`#hero .ncard[data-next="${id}"] b`).textContent();
  await tabEl(1).click();
  ok('clic sulla seconda linguetta: mostra il secondo libro', await sel(1) === 'true' && await hero.locator('.ncard:visible').getAttribute('data-next') === l1[1]
    && await hero.locator('[data-start]').getAttribute('data-start') === l1[1] && await hero.locator('[data-start]').getAttribute('aria-label') === 'Inizia ' + await titleOf(l1[1]));
  const act = () => p.evaluate(() => document.activeElement.id);
  await p.keyboard.press('ArrowRight');
  ok('ArrowRight: linguetta successiva con focus e selezione', await act() === 'nh-t2' && await sel(2) === 'true' && await sel(1) === 'false');
  await p.keyboard.press('ArrowRight');
  ok('ArrowRight dall\'ultima: la prima', await act() === 'nh-t0' && await sel(0) === 'true');
  await p.keyboard.press('ArrowLeft');
  ok('ArrowLeft dalla prima: l\'ultima', await act() === 'nh-t2');
  await p.keyboard.press('Home'); const h0 = await act(); await p.keyboard.press('End');
  ok('Home e End', h0 === 'nh-t0' && await act() === 'nh-t2');
  ok('tabindex mobile e pannello focalizzabile', await tabEl(2).getAttribute('tabindex') === '0' && await tabEl(0).getAttribute('tabindex') === '-1' && await tabEl(1).getAttribute('tabindex') === '-1'
    && await hero.locator('.ncard:visible').getAttribute('tabindex') === '0');
  await tabEl(1).click();
  await p.evaluate(id => { const H = window.libreriaHost, b = H.books().find(x => x.id === id); H.setLocal(id, { ...b, title: b.title + ' bis' }); H.refreshChanged([{ id, from: 'da-leggere', to: 'da-leggere' }]); }, l1[2]);
  ok('selezione ricordata dopo un cambio di titolo', await sel(1) === 'true' && /bis$/.test(await titleOf(l1[2])));
  await tabEl(0).click();
  // Scorrimento laterale
  const swipe = (x0, y0, x1, y1, o = {}) => p.evaluate(([x0, y0, x1, y1, o]) => {
    const el = document.querySelector('#hero .nstack'), ev = (t, id, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: o.type || 'touch', clientX: x, clientY: y, bubbles: true }));
    ev('pointerdown', 1, x0, y0); if (o.second) ev('pointerdown', 2, x0 + 30, y0);
    if (o.cancel) ev('pointercancel', 1, x1, y1); else ev('pointerup', 1, x1, y1);
  }, [x0, y0, x1, y1, o]);
  const cur = async () => (await p.locator('#hero [role=tab]').evaluateAll(t => t.findIndex(x => x.getAttribute('aria-selected') === 'true')));
  await swipe(250, 400, 150, 405);
  ok('scorrimento a sinistra: linguetta successiva', await cur() === 1);
  await tabEl(0).click(); await swipe(150, 400, 250, 400);
  ok('scorrimento a destra dalla prima: l\'ultima', await cur() === 2);
  await tabEl(0).click();
  await swipe(200, 400, 140, 480); ok('gesto obliquo ignorato', await cur() === 0);
  await swipe(250, 400, 150, 400, { cancel: true }); ok('pointercancel ignorato', await cur() === 0);
  await swipe(30, 400, 5, 400); await swipe(380, 400, 280, 400); ok('gesto dal bordo ignorato', await cur() === 0);
  await swipe(250, 400, 150, 400, { type: 'mouse' }); ok('mouse ignorato', await cur() === 0);
  await swipe(250, 400, 150, 400, { second: true }); ok('due dita: nessun cambio', await cur() === 0);
  await tabEl(0).focus(); await swipe(250, 400, 150, 400);
  ok('scorrimento: il focus non si sposta', await cur() === 1 && await act() === 'nh-t0');
  await tabEl(0).click();
  const bs = await hero.locator('[data-start]').first().boundingBox(), ms = await p.locator('#n-more').boundingBox(), ls = await p.locator('#n-later').boundingBox();
  ok('proposte: bersagli di almeno 44 px', bs.height >= 44 && ms.height >= 44 && ls.height >= 44, `${bs.height} ${ms.height} ${ls.height}`);
  await p.locator('#main [data-id="n2"]').first().click(); await p.waitForSelector('.sheet details.edit');
  await p.locator('.sheet details.edit summary').click(); await p.locator('#d-title').fill('Joe Country (nuovo)'); await p.locator('#s-save').click();
  await p.waitForFunction(() => /Joe Country \(nuovo\)/.test(document.querySelector('#hero .ncard[data-next="n2"]')?.textContent || ''), null, { timeout: 3000 }).catch(() => {});
  ok('titolo di un libro proposto modificato: l\'hero mostra il nuovo', /Joe Country \(nuovo\)/.test(await p.locator('#hero .ncard[data-next="n2"]').textContent().catch(() => '')));
  const before = await ids(hero);
  const moved = prev => p.waitForFunction(prev => [...document.querySelectorAll('#hero .ncard')].map(x => x.dataset.next).join() !== prev, prev, { timeout: 3000 }).catch(() => {});
  await p.locator('#n-more').click(); await moved(before.join());
  const after = await ids(p.locator('#hero .next'));
  ok('Altre proposte cambia i libri', after.length > 0 && after.every(x => !before.includes(x)), `${before} → ${after}`);
  ok('Altre proposte: prima linguetta, annuncio e focus', await sel(0) === 'true' && /^Nuove proposte: /.test(await p.locator('#n-live').textContent()) && await act() === 'n-more');
  await p.locator('#n-more').click(); await moved(after.join());
  ok('pila esaurita: si ricomincia', (await ids(p.locator('#hero .next'))).length === 3);
  await p.locator('[data-filter="letto"]').first().click(); await p.locator('#hero .next').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
  ok('filtro Letti: niente proposte', await p.locator('#hero .next').count() === 0);
  await p.locator('[data-filter="da-leggere"]').first().click(); await p.locator('#hero .next').waitFor({ timeout: 3000 }).catch(() => {});
  ok('filtro Da leggere: proposte visibili', await p.locator('#hero .next').isVisible());
  await p.locator('[data-filter="tutti"]').first().click(); await p.locator('#n-later').waitFor({ timeout: 3000 }).catch(() => {});
  await p.locator('#n-later').click(); await p.locator('#hero .next').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
  ok('Non ora nasconde la proposta', await p.locator('#hero .next').count() === 0);

  const choose = p.locator('[data-shelf="da-leggere"] .shelf-head button[data-choose]');
  const cs = await choose.boundingBox();
  ok('Scegli per me nello scaffale Da leggere (tocco di 44 px)', cs && cs.height >= 44, cs && cs.height);
  await choose.click(); await p.locator('.sheet .next .ncard').first().waitFor({ timeout: 3000 }).catch(() => {});
  const sh = p.locator('.sheet .next');
  ok('Scegli per me apre le proposte', await sh.isVisible() && await sh.locator('.ncard').count() === 3);
  const id = (await ids(sh))[0];
  await sh.locator(`button[data-start="${id}"]`).click(); await until(p, id, { status: 'in-lettura' });
  const today = await p.evaluate(() => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); });
  const st = await book(p, id);
  ok('Inizia porta a In lettura con inizio oggi', st.status === 'in-lettura' && st.started === today && await p.locator('.sheet').count() === 0
    && await p.locator(`#hero .rcard [data-page="${id}"]`).count() === 1, `${st.status} ${st.started}`);
  ok('con letture in corso l\'hero non propone', await p.locator('#hero .next').count() === 0);
  await choose.click(); await p.locator('.sheet .next .ncard').first().waitFor({ timeout: 3000 }).catch(() => {});
  ok('Scegli per me funziona anche con letture in corso', await p.locator('.sheet .next .ncard').count() >= 1);
  await p.keyboard.press('Escape'); await closed(p);

  // Inizia con Annulla
  const S = (id, o) => ({ id, title: 'Pila ' + id, author: 'Autore ' + id, status: D, rating: 0, ...o });
  const stato = id => p.evaluate(id => JSON.parse(JSON.stringify(window.libreriaHost.books().find(x => x.id === id))), id);
  const sans = b => { const { updated, ...r } = b; return JSON.stringify(Object.entries(r).sort()); };
  const tbtn = p.locator('.toast button');
  for (const i of [0, 1, 2]) {
    await load(p, [S('s1', { added: 1, started: '2025-03-01', page: 12, pageStep: 5 }), S('s2', { added: 2 }), S('s3', { added: 3, finishedYear: 2019 }), ...letti.map(b => ({ ...b, rating: 0 }))]);
    if (i === 0) await p.evaluate(() => { window.__ch = []; window.libreriaCloud = { connected: true, changed: id => window.__ch.push(id) }; });
    const idsN = await ids(p.locator('#hero .next')), id = idsN[i], prima = await stato(id);
    await tabEl(i).click(); await p.locator('#hero [data-start]').click();
    ok(`Inizia dalla linguetta ${i + 1}: avviso «In lettura» con Annulla a fuoco`, /^In lettura: «/.test(await toastText(p)) && await p.evaluate(() => document.activeElement.matches('.toast button')));
    ok('Inizia: il libro è In lettura', (await stato(id)).status === 'in-lettura');
    await p.keyboard.press('Enter');
    await p.waitForFunction(id => window.libreriaHost.books().find(x => x.id === id).status === 'da-leggere', id, { timeout: 3000 }).catch(() => {});
    const dopo = await stato(id);
    ok(`Annulla (linguetta ${i + 1}): libro com'era`, sans(dopo) === sans(prima) && dopo.updated > prima.updated, `${sans(prima)} / ${sans(dopo)}`);
    ok('Annulla: proposte con la stessa linguetta e focus', await sel(i) === 'true' && await p.evaluate(i => document.activeElement === document.querySelectorAll('#hero [role=tab]')[i], i));
    if (i === 0) {
      ok('Annulla arriva al cloud', await p.evaluate(id => window.__ch.filter(x => x === id).length >= 2, id));
      await p.evaluate(() => { delete window.libreriaCloud; });
    }
  }
  {
    const id = (await ids(p.locator('#hero .next')))[0];
    await tabEl(0).click(); await p.locator('#hero [data-start]').click();
    await p.evaluate(id => { const H = window.libreriaHost, b = H.books().find(x => x.id === id); H.setLocal(id, { ...b, status: 'letto' }); H.refreshChanged([{ id, from: 'in-lettura', to: 'letto', moved: true }]); }, id);
    await p.locator('.toast button').click();
    ok('Annulla dopo un cambio: libro invariato e avviso', (await stato(id)).status === 'letto' && /^Non annullato: «/.test(await toastText(p)), (await stato(id)).status + ' ' + await toastText(p));
  }
  await load(p, [S('b1', { added: 1, title: 'Bad Actors' }), S('b2', { added: 2, title: 'T'.repeat(60) }), S('b3', { added: 3 })]);
  const bad = (await ids(p.locator('#hero .next'))), badTab = bad.indexOf('b1');
  await tabEl(badTab).click(); await p.locator('#hero [data-start]').click();
  const tbx = await p.locator('.toast').boundingBox(), addB = await p.locator('.dock .tab.add .ico').boundingBox();
  ok('avviso «In lettura: «Bad Actors»» su una riga, lontano da Aggiungi', /In lettura: «Bad Actors»/.test(await toastText(p)) && tbx.height <= 46 && tbx.width > 195
    && !(tbx.x < addB.x + addB.width && addB.x < tbx.x + tbx.width && tbx.y < addB.y + addB.height && addB.y < tbx.y + tbx.height), JSON.stringify(tbx));
  await p.locator('.toast button').click();
  await tabEl(bad.indexOf('b2')).click(); await p.locator('#hero [data-start]').click();
  ok('titolo di 60 caratteri tagliato a 40 con «…»', (await toastText(p)).includes('«' + 'T'.repeat(40) + '…»'), await toastText(p));
  // Scegli per me: Inizia dalla terza linguetta e Annulla
  await load(p, [S('c1', { added: 1 }), S('c2', { added: 2 }), S('c3', { added: 3 })]);
  await p.locator('[data-shelf="da-leggere"] .shelf-head button[data-choose]').click(); await p.locator('.sheet .next .ncard').first().waitFor({ timeout: 3000 }).catch(() => {});
  const cid = (await ids(p.locator('.sheet .next')))[2];
  await p.locator('.sheet #ns-t2').click(); await p.locator('.sheet [data-start]').click(); await closed(p);
  ok('Scegli per me: Inizia dalla terza linguetta', (await stato(cid)).status === 'in-lettura' && await p.locator('.sheet').count() === 0);
  await p.locator('.toast button').click();
  ok('Scegli per me: Annulla rimette il libro in pila', (await stato(cid)).status === 'da-leggere');
  // Scegli per me insieme all'hero, titolo con virgolette, movimento ridotto
  await load(p, [...pila, ...letti].map(b => ({ ...base, ...b })));
  await p.locator('[data-shelf="da-leggere"] .shelf-head button[data-choose]').click(); await p.locator('.sheet .next .ncard').first().waitFor({ timeout: 3000 }).catch(() => {});
  ok('scheda con la sua tablist ns-*', await p.locator('.sheet [role=tablist]').count() === 1 && await p.locator('.sheet #ns-t0').count() === 1);
  ok('nessun id duplicato con hero e scheda aperti', await p.evaluate(() => { const a = [...document.querySelectorAll('[id]')].map(x => x.id); return a.length === new Set(a).size; }));
  const heroSel = () => p.locator('#hero [role=tab][aria-selected=true]').getAttribute('id');
  const h1 = await heroSel(); await p.locator('.sheet #ns-t2').click();
  ok('cambiare linguetta nella scheda non cambia quella dell\'hero', await heroSel() === h1 && await p.locator('.sheet #ns-t2').getAttribute('aria-selected') === 'true');
  await p.keyboard.press('Escape'); await closed(p);
  await load(p, [{ id: 'q1', title: 'Primo', author: 'A', status: D, added: 1 }, { id: 'q2', title: 'Due "virgolette" <i>', author: 'B', status: D, added: 2 }]);
  await tabEl(1).click();
  ok('aria-label di Inizia con virgolette e HTML', await p.locator('#hero [data-start]').getAttribute('aria-label') === 'Inizia Due "virgolette" <i>');
  await p.emulateMedia({ reducedMotion: 'reduce' }); await tabEl(0).click();
  ok('movimento ridotto: nessuna animazione al cambio', await p.locator('#hero .ncard:visible').evaluate(n => getComputedStyle(n).animationName) === 'none');
  await p.emulateMedia({ reducedMotion: null });
  await load(p, [{ id: 'u1', title: 'Unico <b>', author: 'A', status: D, added: 1 }]);
  ok('un solo libro in pila: una proposta, testo con esc', await p.locator('#hero .ncard').count() === 1 && /Unico <b>/.test(await p.locator('#hero .ncard b').innerText()));
  ok('un solo libro: niente linguette né contatore, regione «Proposta»', await p.locator('#hero [role=tablist]').count() === 0 && await p.locator('#hero .n').count() === 0
    && await p.locator('#hero .ncard').getAttribute('role') === 'region' && await p.locator('#hero .ncard').getAttribute('aria-label') === 'Proposta');
  await load(p, [{ id: 'g1', title: 'Uno', author: 'A', status: D, added: 1 }, { id: 'g2', title: 'Due', author: 'B', status: D, added: 2 }]);
  ok('due libri in pila: 2 linguette e «1 di 2»', await p.locator('#hero [role=tab]').count() === 2 && await p.locator('#hero .ncard:visible .n').textContent() === '1 di 2');
  await load(p, pila.map(b => ({ ...base, ...b })));
  ok('senza letti: terza linguetta «Ancora a caso»', (await p.locator('#hero [role=tab]').allTextContents()).join('|') === 'Il più vecchio|A caso|Ancora a caso', (await p.locator('#hero [role=tab]').allTextContents()).join('|'));
  const lungo = 'Supercalifragilistichespiralidosoeancorapiulungoancoraunpo'.padEnd(70, 'x');
  await load(p, [{ id: 'lg', title: lungo, author: 'A', status: D, added: 1 }]);
  ok('titolo di 70 caratteri senza spazi: niente scorrimento laterale, Inizia da 44 px', (await p.evaluate(() => document.documentElement.scrollWidth <= 390)) && (await p.locator('#hero [data-start]').boundingBox()).height >= 44);
  const wide = await newPage(browser, { width: 1366, height: 860 });
  await load(wide, [...pila, ...letti].map(b => ({ ...base, ...b })));
  const wb = await wide.locator('#hero .next').boundingBox();
  ok('computer: scheda larga al massimo 600 px, una sola proposta visibile', wb.width <= 600 && await wide.locator('#hero .ncard:visible').count() === 1, wb.width);
  await wide.close2();
  // contrasto in chiaro e scuro
  const contrasto = () => {
    const rgb = s => { const m = String(s).match(/[\d.]+/g).map(Number); return m.slice(0, 3); };
    const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
    const hex = v => { const h = getComputedStyle(document.documentElement).getPropertyValue(v).trim(); return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const out = [];
    for (const [sel, bg] of [['.ncard:not([hidden]) .why', '--paper'], ['.ncard:not([hidden]) .meta', '--paper'], ['.ntab[aria-selected=false]', '--paper-off']]) {
      const el = document.querySelector('#hero ' + sel); if (!el) { out.push(0); continue; }
      out.push(ratio(rgb(getComputedStyle(el).color), hex(bg)));
    }
    return out;
  };
  for (const dark of [false, true]) {
    const q = await newPage(browser, { dark });
    await load(q, [...pila, ...letti].map(b => ({ ...base, pages: 300, ...b })));
    const r = await q.evaluate(contrasto);
    ok(`contrasto scheda del catalogo (${dark ? 'scuro' : 'chiaro'}) almeno 4,5:1`, r.every(x => x >= 4.5), r.join(' '));
    await q.close2();
  }
  await load(p, letti);
  ok('pila vuota: niente hero né Scegli per me', await p.locator('#hero .next').count() === 0 && await p.locator('[data-choose]').count() === 0);
  ok('prossimo libro: niente scorrimento laterale e nessun errore', (await p.evaluate(w => document.documentElement.scrollWidth <= w, 390)) && !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

// Correzioni della revisione finale: lavori in sottofondo interrotti dal ripristino, messaggi, elenco delle copie, hero.
async function revisione(browser) {
  const base = { added: 1, rating: 0, status: 'da-leggere' };
  const libri = [1, 2, 3, 4, 5, 6].map(i => ({ ...base, id: 'e' + i, title: 'Libro ' + i, author: 'Mario Rossi' }));
  // Apple Books lenta (500 ms) che trova sempre il libro con una copertina; conta le risposte.
  const slow = async p => {
    p.served = 0;
    await p.route(/itunes\.apple\.com/, async r => {
      const u = new URL(r.request().url()), cb = u.searchParams.get('callback'), term = u.searchParams.get('term') || '';
      await new Promise(x => setTimeout(x, 700));
      const res = [{ trackName: term.split(' ').slice(0, -1).join(' '), artistName: 'Mario Rossi', artworkUrl100: 'https://is1.mzstatic.com/x/100x100bb.jpg' }];
      await r.fulfill({ status: 200, contentType: 'application/javascript', body: `${cb}(${JSON.stringify({ results: res })})` }).catch(() => {});
      p.served++;
    });
  };
  const toasts = p => p.evaluate(() => { window.__toasts = []; new MutationObserver(() => document.querySelectorAll('.toast').forEach(t => { if (!window.__toasts.includes(t.textContent)) window.__toasts.push(t.textContent); })).observe(document.body, { childList: true }); });
  const seen = (p, re) => p.evaluate(re => (window.__toasts || []).some(t => new RegExp(re).test(t)), re);

  // I-1: ripristino mentre «Completa autori e copertine» è ancora in corso.
  let p = await newPage(browser); await slow(p);
  await load(p, libri); await toasts(p);
  await backup(p); await p.locator('#i-authors').click();
  await p.waitForFunction(() => /2 di 6/.test(document.querySelector('#enrich')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  await ripristina(p);
  await p.waitForFunction(() => document.querySelector('#enrich').hidden, null, { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(1000); // il salvataggio è ritardato di 700 ms
  let bs = await localBooks(p);
  ok('ripristino durante «Completa autori e copertine»: i libri restano come nella copia', bs.length === 6 && bs.every(b => !b.cover), bs.map(b => b.cover ? 'copertina' : '-').join());
  ok('lavoro interrotto: niente messaggio finale', !(await seen(p, 'Informazioni aggiornate')), (await p.evaluate(() => window.__toasts)).join(' | '));
  ok('dopo l\'interruzione si può rilanciare', await (async () => { await backup(p); await p.locator('#i-authors').click(); return poll(async () => seen(p, 'Informazioni aggiornate per 6'), 15000).then(() => true, () => false); })());
  ok('ripristino e lavori in sottofondo: nessun errore', !p.errs.length, p.errs.join(' / '));
  await p.close2();

  // I-1: ripristino mentre la ricerca delle copertine è in corso.
  p = await newPage(browser); await slow(p);
  await load(p, libri);
  await importa(p, [{ title: 'Libro 7', author: 'Mario Rossi' }]);
  await toasts(p);
  await backup(p); await p.locator('#i-covers').click();
  await poll(async () => p.served >= 2, 8000).catch(() => {});
  await ripristina(p);
  await p.waitForFunction(() => (window.__toasts || []).some(t => /Copertine trovate/.test(t)), null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1000);
  bs = await localBooks(p);
  ok('ripristino durante la ricerca delle copertine: i libri restano come nella copia', bs.length === 6 && bs.every(b => !b.cover), bs.map(b => b.cover ? 'copertina' : '-').join());
  ok('ricerca copertine interrotta: niente messaggio finale', !(await seen(p, 'Copertine trovate')));
  await p.close2();

  // m-2: copia sparita tra i due tocchi → messaggio.
  p = await newPage(browser);
  await load(p, [{ ...base, id: 'r1', title: 'Uno', author: 'A' }]);
  await importa(p, [{ title: 'Due', author: 'B' }]);
  await backup(p);
  const rb = p.locator('#u-list button[data-restore]').first(); await rb.waitFor({ timeout: 3000 });
  await rb.click();
  await p.evaluate(() => new Promise(res => { const r = indexedDB.open('libreria-copie', 1); r.onsuccess = () => { const db = r.result, t = db.transaction('copie', 'readwrite'); t.objectStore('copie').clear(); t.oncomplete = () => { db.close(); res(); }; }; }));
  await rb.click();
  const fail = await p.waitForFunction(() => /Copia non trovata: ripristino non riuscito/.test([...document.querySelectorAll('.toast')].map(t => t.textContent).join(' ')), null, { timeout: 4000 }).then(() => true, () => false);
  ok('copia non trovata: «Copia non trovata: ripristino non riuscito»', fail && (await localBooks(p)).length === 2, await toastText(p));
  await p.close2();

  // m-3 e m-6: dopo un import con la scheda aperta l'elenco mostra la nuova copia, al singolare.
  p = await newPage(browser);
  await load(p, [{ ...base, id: 'r1', title: 'Uno', author: 'A' }]);
  await backup(p);
  await p.waitForFunction(() => /Nessuna copia per ora/.test(document.querySelector('#u-list')?.textContent || ''), null, { timeout: 3000 }).catch(() => {});
  await p.setInputFiles('#i-file', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ title: 'Due', author: 'B' }])) });
  await p.waitForFunction(() => !document.querySelector('#i-go').disabled, null, { timeout: 5000 });
  await p.locator('#i-go').click();
  const row = await p.locator('#u-list .urow').first().innerText({ timeout: 3000 }).catch(() => '');
  ok('import con la scheda aperta: la nuova copia compare in Annulla', /Prima dell'import del backup/.test(row), row);
  ok('copia di un solo libro: «1 libro»', /· 1 libro\s/.test(row), row);
  await p.close2();

  // m-1: IndexedDB che risponde dopo il limite di 1,5 s: il database aperto in ritardo viene chiuso.
  p = await newPage(browser, { init: { fn: () => { IDBFactory.prototype.open = function () { const r = { result: { close() { window.__closed = (window.__closed || 0) + 1; } } }; setTimeout(() => r.onsuccess && r.onsuccess(), 2000); return r; }; } } });
  await load(p, [{ ...base, id: 'r1', title: 'Uno', author: 'A' }]);
  await backup(p);
  await p.setInputFiles('#i-file', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ title: 'Due', author: 'B' }])) });
  await p.waitForFunction(() => !document.querySelector('#i-go').disabled, null, { timeout: 5000 });
  await p.locator('#i-go').click();
  const shut = await p.waitForFunction(() => window.__closed >= 1, null, { timeout: 4000 }).then(() => true, () => false);
  ok('IndexedDB in ritardo: il database aperto dopo il limite viene chiuso', shut);
  await p.close2();

  // m-4: un cambio dal cloud su un libro da leggere non toglie il focus dalla pagina di un libro in lettura.
  p = await newPage(browser);
  await load(p, [{ ...base, id: 'h1', title: 'In corso', author: 'A', status: 'in-lettura', pages: 300, page: 100 }, { ...base, id: 'h2', title: 'In pila', author: 'B' }]);
  await p.locator('#hero [data-page="h1"]').focus();
  await p.evaluate(() => { const H = window.libreriaHost, b = H.books().find(x => x.id === 'h2'); H.setLocal('h2', { ...b, title: 'In pila (cloud)' }); H.refreshChanged([{ id: 'h2', from: 'da-leggere', to: 'da-leggere' }]); });
  ok('cambio dal cloud su un libro da leggere: il campo pagina resta attivo', await p.evaluate(() => document.activeElement && document.activeElement.dataset.page === 'h1'));
  await load(p, [{ ...base, id: 'h2', title: 'In pila', author: 'B' }]);
  await p.evaluate(() => { const H = window.libreriaHost, b = H.books().find(x => x.id === 'h2'); H.setLocal('h2', { ...b, title: 'In pila (cloud)' }); H.refreshChanged([{ id: 'h2', from: 'da-leggere', to: 'da-leggere' }]); });
  ok('senza letture in corso le proposte si aggiornano', /In pila \(cloud\)/.test(await p.locator('#hero .next').innerText().catch(() => '')));
  await p.close2();
}

export default async function ({ browser }) {
  await paginaRapida(browser);
  await copie(browser);
  await prossimo(browser);
  await revisione(browser);
}
