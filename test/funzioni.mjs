// Tre funzioni: pagina rapida nell'hero (cursore, +10, ripeti, annulla); copie prima delle operazioni su molti libri e ripristino.
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

// Apre Altro → Backup.
const backup = async p => { await p.locator('.dock .more').click(); await p.locator('[data-m=backup]').click(); await p.waitForSelector('#i-file'); await p.waitForTimeout(300); };
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
}

export default async function ({ browser }) {
  await paginaRapida(browser);
  await copie(browser);
}
