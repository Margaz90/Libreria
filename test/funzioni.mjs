// Tre funzioni: pagina rapida nell'hero (cursore, +10, ripeti, annulla).
import { APP, ok, newPage, localBooks } from './lib.mjs';

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
  ok('pagina rapida: niente scorrimento laterale e nessun errore', (await p.evaluate(w => document.documentElement.scrollWidth <= w, 390)) && !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

export default async function ({ browser }) {
  await paginaRapida(browser);
}
