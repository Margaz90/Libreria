// Statistiche: anno di lettura facoltativo nella scheda, calcoli, pagina e racconto.
import { APP, ok, newPage, localBooks } from './lib.mjs';

const isoToday = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const load = async (p, books) => {
  await p.goto(APP + '/');
  await p.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)), books);
  await p.reload(); await p.waitForTimeout(300);
};
const book = async (p, id) => (await localBooks(p)).find(x => x.id === id);
const openBook = async (p, id) => { await p.locator(`#main [data-id="${id}"]`).first().click(); await p.waitForSelector('.sheet'); };
const save = async p => { await p.locator('#s-save').click(); await p.waitForTimeout(800); };

async function scheda(browser) {
  const p = await newPage(browser);
  const base = { added: 1, rating: 0 };
  await load(p, [
    { ...base, id: 's1', title: 'Storico', author: 'A', status: 'letto' },
    { ...base, id: 's2', title: 'Anno', author: 'B', status: 'letto' },
    { ...base, id: 's3', title: 'Voti', author: 'C', status: 'letto' },
    { ...base, id: 's4', title: 'Nuovo', author: 'D', status: 'da-leggere' },
    { ...base, id: 's5', title: 'Ripreso', author: 'E', status: 'da-leggere', finishedYear: 2019 },
    { ...base, id: 's6', title: 'Errato', author: 'F', status: 'letto' },
  ]);
  const shown = () => p.locator('#f-year-row').isVisible().catch(() => false);

  await openBook(p, 's1');
  ok('anno: compare per un libro letto senza data', await shown());
  await p.fill('#f-finished', '2025-03-02');
  ok('anno: sparisce se metto la data di fine', !(await shown()));
  await p.fill('#f-finished', '');
  if (await shown()) await p.fill('#f-year', '2017');
  await p.fill('#f-finished', '2025-03-02');
  await save(p);
  let b = await book(p, 's1');
  ok('anno tolto se salvo la data completa', b.finished === '2025-03-02' && b.finishedYear === undefined, JSON.stringify(b));

  await openBook(p, 's2');
  if (await shown()) await p.fill('#f-year', '2019');
  await save(p);
  b = await book(p, 's2');
  ok('anno: salvato 2019 senza data', b.finishedYear === 2019 && !b.finished, JSON.stringify(b));

  let bad = true;
  for (const v of ['12', '2099']) {
    await openBook(p, 's6');
    if (await shown()) await p.fill('#f-year', v);
    await save(p);
    b = await book(p, 's6');
    if (b.finishedYear !== undefined) bad = false;
  }
  ok('anno non valido non salvato', bad && !b.finished, JSON.stringify(b));

  await openBook(p, 's3');
  await p.locator('.rate button[data-n="4"]').click();
  await save(p);
  b = await book(p, 's3');
  ok('voto a un libro storico non mette la data di oggi', b.rating === 4 && !b.finished, JSON.stringify(b));

  await openBook(p, 's4');
  await p.locator('.seg [data-v="letto"]').click();
  await save(p);
  ok('da leggere → letto mette la data di oggi', (await book(p, 's4')).finished === isoToday());

  const el = p.locator('#main [data-id="s5"]').first();
  await el.dispatchEvent('pointerdown', { clientX: 5, clientY: 5 });
  await p.waitForTimeout(700);
  await p.locator('.quick [data-st="letto"]').click();
  await p.waitForTimeout(800);
  b = await book(p, 's5');
  ok('menu rapido: libro con solo l\'anno passa a Letto senza la data di oggi', b.status === 'letto' && !b.finished && b.finishedYear === 2019, JSON.stringify(b));

  ok('scheda: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

export default async function ({ browser }) {
  await scheda(browser);
}
