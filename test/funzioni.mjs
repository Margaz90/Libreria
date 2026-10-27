// Tre funzioni: pagina rapida nell'hero (cursore, +10, ripeti, annulla); copie prima delle operazioni su molti libri e ripristino; il prossimo libro.
import { APP, ok, newPage, localBooks, toastText } from './lib.mjs';

const load = async (p, books) => {
  await p.goto(APP + '/');
  await p.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)), books);
  await p.reload(); await p.waitForTimeout(300);
};
const book = async (p, id) => (await localBooks(p)).find(x => x.id === id);
const wait = p => p.waitForTimeout(900);

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
    && /Aggiungi 10 pagine/.test(await add10('p1').getAttribute('aria-label'))
    && /Pagina attuale di Con totale/.test(await card('p1').locator('input[type=range]').getAttribute('aria-label'))
    && await card('p1').locator('button[data-repeat]').count() === 0);
  const hs = await add10('p1').boundingBox();
  ok('bersagli al tocco di almeno 44 px', hs.height >= 44 && hs.width >= 44, `${hs.width}x${hs.height}`);

  await add10('p1').click(); await wait(p);
  ok('+10 salva subito', (await book(p, 'p1')).page === 110, (await book(p, 'p1')).page);
  ok('toast «Pagina 110»', /Pagina 110/.test(await p.locator('.toast').innerText()));
  await toastBtn().click(); await wait(p);
  ok('Annulla torna a 100', (await book(p, 'p1')).page === 100 && (await book(p, 'p1')).pageStep === undefined);

  await card('p1').locator('[data-page]').fill('130');
  await card('p1').locator('[data-save]').click(); await wait(p);
  ok('pagina scritta a mano: salto ricordato', (await book(p, 'p1')).pageStep === 30, (await book(p, 'p1')).pageStep);
  const rep = card('p1').locator('button[data-repeat]');
  ok('ripeti mostra +30', (await rep.innerText()).trim() === '+30');
  await rep.click(); await wait(p);
  ok('ripeti porta a 160', (await book(p, 'p1')).page === 160, (await book(p, 'p1')).page);
  await add10('p1').click(); await wait(p);
  ok('+10 non cambia il salto', (await book(p, 'p1')).pageStep === 30 && (await book(p, 'p1')).page === 170);

  // Annulla dopo un salto a mano ripristina anche il salto precedente.
  await card('p1').locator('[data-page]').fill('175');
  await card('p1').locator('[data-save]').click(); await wait(p);
  ok('salto aggiornato a 5', (await book(p, 'p1')).pageStep === 5);
  await toastBtn().click(); await wait(p);
  ok('Annulla ripristina pagina e salto', (await book(p, 'p1')).page === 170 && (await book(p, 'p1')).pageStep === 30);

  const r = card('p1').locator('input[type=range]');
  await r.fill('250');
  ok('cursore: durante il trascinamento non salva', (await book(p, 'p1')).page === 170);
  await r.dispatchEvent('change'); await wait(p);
  ok('cursore: salva al rilascio', (await book(p, 'p1')).page === 250, (await book(p, 'p1')).page);
  ok('cursore: salto ricordato (80)', (await book(p, 'p1')).pageStep === 80);

  await card('p1').locator('button[data-repeat]').click(); await wait(p);
  const fin = await card('p1').locator('[data-finish]').isVisible().catch(() => false);
  ok('limite al totale e compare Finito', (await book(p, 'p1')).page === 300 && fin, (await book(p, 'p1')).page);

  ok('senza pagine totali: niente cursore, +10 funziona', await card('p2').locator('input[type=range]').count() === 0
    && (await add10('p2').click(), await wait(p), (await book(p, 'p2')).page === 30), (await book(p, 'p2')).page);

  // Due +10 rapidi e Annulla: si torna alla pagina prima dell'ultimo gesto.
  await load(p, [{ ...base, id: 'p1', title: 'Con totale', author: 'A', pages: 300, page: 100 }]);
  await add10('p1').click(); await add10('p1').click();
  await toastBtn().click(); await wait(p);
  ok('due +10 rapidi e Annulla: si torna a 110', (await book(p, 'p1')).page === 110, (await book(p, 'p1')).page);
  // Annulla dopo «Finito!»: il libro letto non deve tornare indietro di pagina.
  await load(p, [{ ...base, id: 'p1', title: 'Con totale', author: 'A', pages: 300, page: 295 }]);
  await add10('p1').click(); await wait(p);
  await card('p1').locator('[data-finish]').click(); await wait(p);
  if (await toastBtn().count()) { await toastBtn().first().click(); await wait(p); }
  const fb = await book(p, 'p1');
  ok('Annulla dopo Finito: il libro resta letto con tutte le pagine', fb.status === 'letto' && fb.page === 300, `${fb.status} ${fb.page}`);
  // Salvataggio manuale senza cambiamenti: niente toast.
  await load(p, [{ ...base, id: 'p1', title: 'Con totale', author: 'A', pages: 300, page: 100, pageStep: 30 }]);
  const upd0 = (await book(p, 'p1')).updated;
  await card('p1').locator('[data-save]').click(); await wait(p);
  ok('stessa pagina + Aggiorna: niente salvataggio né toast', await p.locator('.toast').count() === 0 && (await book(p, 'p1')).updated === upd0 && (await book(p, 'p1')).pageStep === 30);
  ok('pagina rapida: niente scorrimento laterale e nessun errore', (await p.evaluate(w => document.documentElement.scrollWidth <= w, 390)) && !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

// Apre Altro → Backup (prima torno in cima: scorrendo in giù la barra in basso si nasconde).
const backup = async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(150); await p.locator('.dock .more').click(); await p.locator('[data-m=backup]').click(); await p.waitForSelector('#i-file'); await p.waitForTimeout(300); };
// Import di un file dalla scheda Backup (come in sicurezza.mjs), con «aggiorna i libri già presenti» se richiesto.
export async function importa(p, books, upd = false) {
  await backup(p);
  await p.setInputFiles('#i-file', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(books)) });
  if (upd) await p.locator('#i-upd').check();
  await p.waitForFunction(() => !document.querySelector('#i-go').disabled, null, { timeout: 5000 });
  await p.locator('#i-go').click(); await p.waitForTimeout(800);
  const close = p.locator('#i-close'); if (await close.isVisible().catch(() => false)) await close.click();
  await p.waitForTimeout(300);
}
// Ripristina la copia più recente (due tocchi); restituisce testo della riga e del primo tocco.
export async function ripristina(p) {
  await backup(p);
  const b = p.locator('#u-list button[data-restore]').first();
  await b.waitFor({ timeout: 3000 });
  const row = await p.locator('#u-list .urow').first().innerText();
  await b.click(); const first = (await b.innerText()).trim(); const box = await b.boundingBox();
  await b.click(); await p.waitForTimeout(1000);
  return { row, first, box };
}

async function copie(browser) {
  const p = await newPage(browser);
  const base = { added: 1, rating: 0, status: 'da-leggere' };
  await load(p, [{ ...base, id: 'c1', title: 'Originale', author: 'A' }, { ...base, id: 'c2', title: 'Secondo', author: 'B' }]);
  await importa(p, [{ title: 'ORIGINALE', author: 'A', pages: 99 }, { title: 'Nuovo dal file', author: 'C' }], true);
  let bs = await localBooks(p);
  const nuovo = bs.find(b => b.title === 'Nuovo dal file');
  ok('import con aggiorna eseguito', (await book(p, 'c1')).title === 'ORIGINALE' && !!nuovo && bs.length === 3);
  let r = await ripristina(p);
  ok('riga della copia: etichetta, data e numero di libri', /Prima dell'import del backup/.test(r.row) && /\d\d\/\d\d alle \d\d:\d\d · 2 libri/.test(r.row), r.row);
  ok('primo tocco: «Conferma ripristino», bersaglio di almeno 44 px', r.first === 'Conferma ripristino' && r.box.height >= 44, `${r.first} ${r.box.height}`);
  bs = await localBooks(p);
  ok('import con aggiorna: dopo il ripristino il titolo torna', (await book(p, 'c1')).title === 'Originale' && (await book(p, 'c1')).pages === undefined);
  ok('libro aggiunto dall\'import sparisce col ripristino', bs.length === 2 && !bs.some(b => b.id === nuovo.id));
  ok('messaggio «Libreria riportata al …»', /Libreria riportata al \d\d\/\d\d alle \d\d:\d\d/.test(await toastText(p)), await toastText(p));
  r = await ripristina(p);
  bs = await localBooks(p);
  ok('il ripristino è annullabile (copia «Prima del ripristino»)', /Prima del ripristino/.test(r.row) && (await book(p, 'c1')).title === 'ORIGINALE' && bs.length === 3, r.row);

  await backup(p); await p.locator('#i-authors').click(); await p.waitForTimeout(1200);
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
  await p.locator('#s-del').click(); await p.locator('#s-del').click(); await p.waitForTimeout(900);
  ok('libro eliminato', !(await book(p, 'c2')));
  await ripristina(p);
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
  ok('affine per genere se manca l\'autore', l[0].kind === 'affine' && l[0].id === 'n5' && /Un altro Giallo, come «Altro giallo»/.test(l[0].reason), JSON.stringify(l[0]));
  l = await next([{ id: 'x1', title: 'Senza', status: D, added: 5, author: '', genre: ' ' }, { id: 'x2', title: 'Nulla', status: D, added: 9 }, { id: 'x3', title: 'Letto vuoto', status: L, author: ' ', genre: '' }]);
  ok('libri senza autore né genere: nessun abbinamento vuoto', !l.some(x => x.kind === 'affine') && l.length === 2, JSON.stringify(l));
  l = await next([...pila, ...letti], ['n2', 'n1', 'n3']);
  ok('exclude: niente proposte già mostrate', l.length === 2 && l.every(x => !['n1', 'n2', 'n3'].includes(x.id)) && l[0].id === 'n4', JSON.stringify(l));
  l = await next([...letti, { id: 'w', title: 'Desiderio', status: 'desiderato' }]);
  ok('pila vuota: nessuna proposta', l.length === 0);

  // Interfaccia
  const base = { rating: 0 };
  await load(p, [...pila, ...letti].map(b => ({ ...base, pages: 300, ...b })));
  const hero = p.locator('#hero .next');
  ok('hero senza letture mostra Cosa leggo adesso?', await hero.isVisible() && /Cosa leggo adesso\?/.test(await hero.innerText()) && await hero.locator('.ncard').count() === 3
    && /Mick Herron · 300 pp\./.test(await hero.locator('.ncard').first().innerText()));
  const bs = await hero.locator('[data-start]').first().boundingBox(), ms = await p.locator('#n-more').boundingBox(), ls = await p.locator('#n-later').boundingBox();
  ok('proposte: bersagli di almeno 44 px', bs.height >= 44 && ms.height >= 44 && ls.height >= 44, `${bs.height} ${ms.height} ${ls.height}`);
  const ids = async root => root.locator('.ncard').evaluateAll(n => n.map(x => x.dataset.next));
  const before = await ids(hero);
  await p.locator('#n-more').click(); await p.waitForTimeout(200);
  const after = await ids(p.locator('#hero .next'));
  ok('Altre proposte cambia i libri', after.length > 0 && after.every(x => !before.includes(x)), `${before} → ${after}`);
  await p.locator('#n-more').click(); await p.waitForTimeout(200);
  ok('pila esaurita: si ricomincia', (await ids(p.locator('#hero .next'))).length === 3);
  await p.locator('[data-filter="letto"]').first().click(); await p.waitForTimeout(200);
  ok('filtro Letti: niente proposte', await p.locator('#hero .next').count() === 0);
  await p.locator('[data-filter="da-leggere"]').first().click(); await p.waitForTimeout(200);
  ok('filtro Da leggere: proposte visibili', await p.locator('#hero .next').isVisible());
  await p.locator('[data-filter="tutti"]').first().click(); await p.waitForTimeout(200);
  await p.locator('#n-later').click(); await p.waitForTimeout(200);
  ok('Non ora nasconde la proposta', await p.locator('#hero .next').count() === 0);

  const choose = p.locator('[data-shelf="da-leggere"] .shelf-head button[data-choose]');
  const cs = await choose.boundingBox();
  ok('Scegli per me nello scaffale Da leggere (tocco di 44 px)', cs && cs.height >= 44, cs && cs.height);
  await choose.click(); await p.waitForTimeout(300);
  const sh = p.locator('.sheet .next');
  ok('Scegli per me apre le proposte', await sh.isVisible() && await sh.locator('.ncard').count() === 3);
  const id = (await ids(sh))[0];
  await sh.locator(`button[data-start="${id}"]`).click(); await wait(p);
  const today = await p.evaluate(() => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); });
  const st = await book(p, id);
  ok('Inizia porta a In lettura con inizio oggi', st.status === 'in-lettura' && st.started === today && await p.locator('.sheet').count() === 0
    && await p.locator(`#hero .rcard [data-page="${id}"]`).count() === 1, `${st.status} ${st.started}`);
  ok('con letture in corso l\'hero non propone', await p.locator('#hero .next').count() === 0);
  await choose.click(); await p.waitForTimeout(300);
  ok('Scegli per me funziona anche con letture in corso', await p.locator('.sheet .next .ncard').count() >= 1);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  await load(p, [{ id: 'u1', title: 'Unico <b>', author: 'A', status: D, added: 1 }]);
  ok('un solo libro in pila: una proposta, testo con esc', await p.locator('#hero .ncard').count() === 1 && /Unico <b>/.test(await p.locator('#hero .ncard b').innerText()));
  await load(p, letti);
  ok('pila vuota: niente hero né Scegli per me', await p.locator('#hero .next').count() === 0 && await p.locator('[data-choose]').count() === 0);
  ok('prossimo libro: niente scorrimento laterale e nessun errore', (await p.evaluate(w => document.documentElement.scrollWidth <= w, 390)) && !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

export default async function ({ browser }) {
  await paginaRapida(browser);
  await copie(browser);
  await prossimo(browser);
}
