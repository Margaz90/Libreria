// Sicurezza: le date di lettura arrivano da file importati e dal cloud, quindi non devono mai finire nella pagina come HTML
// (rapporto Claude Security del 2026-10-26, F1 e F2: XSS memorizzato tramite il campo «finished»).
import { APP, ok, newPage, localBooks } from './lib.mjs';

const EVIL = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
const fired = p => p.evaluate(() => window.__xss || 0);

export default async function ({ browser }) {
  // 1. Dato già salvato sul dispositivo (o arrivato dal cloud): scheda e anteprima non lo eseguono
  const p = await newPage(browser, { width: 1366, height: 860 });
  await p.goto(APP + '/');
  await p.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)),
    [{ id: 'x1', title: 'Avvelenato', author: 'A', status: 'letto', finished: EVIL, started: EVIL, added: 1, rating: 0 }]);
  await p.reload(); await p.waitForTimeout(400);
  await p.locator('#main [data-id="x1"]').first().hover(); await p.waitForTimeout(700);
  ok('anteprima al passaggio del mouse: la data non diventa HTML', (await fired(p)) === 0 && !(await p.locator('.peek img[src="x"]').count()));
  await p.mouse.move(5, 5); await p.waitForTimeout(200);
  await p.locator('#main [data-id="x1"]').first().click(); await p.waitForSelector('.sheet'); await p.waitForTimeout(400);
  ok('scheda del libro: la data non diventa HTML', (await fired(p)) === 0 && !(await p.locator('.sheet img[src="x"]').count()));
  await p.close2();

  // 2. Import di un backup JSON: date che non sono date vengono scartate, quelle valide restano
  const q = await newPage(browser);
  await q.goto(APP + '/'); await q.waitForTimeout(300);
  const importa = async (name, body) => {
    await q.locator('.dock .more').click(); await q.locator('[data-m=backup]').click(); await q.waitForSelector('#i-file');
    await q.setInputFiles('#i-file', { name, mimeType: name.endsWith('.json') ? 'application/json' : 'text/csv', buffer: Buffer.from(body) });
    await q.waitForFunction(() => !document.querySelector('#i-go').disabled, null, { timeout: 5000 });
    await q.locator('#i-go').click(); await q.waitForTimeout(800);
    const close = q.locator('#i-close'); if (await close.isVisible().catch(() => false)) await close.click();
    await q.waitForTimeout(300);
  };
  await importa('backup.json', JSON.stringify([
    { title: 'Json uno', author: 'B', status: 'letto', finished: EVIL, started: '2025-01-01' },
    { title: 'Json due', author: 'C', status: 'letto', finished: '2025-02-03', started: 'domenica' },
  ]));
  let bs = await localBooks(q);
  const j1 = bs.find(b => b.title === 'Json uno'), j2 = bs.find(b => b.title === 'Json due');
  ok('import JSON: data con HTML scartata, data valida tenuta', j1 && j1.finished === undefined && j1.started === '2025-01-01' && j2 && j2.finished === '2025-02-03' && j2.started === undefined, JSON.stringify([j1, j2]));

  // 3. Import del CSV di Goodreads: «Date Read» AAAA/MM/GG diventa AAAA-MM-GG, il resto viene scartato
  await importa('goodreads.csv', 'Title,Author,My Rating,Exclusive Shelf,Date Read\nCsv uno,D,4,read,2024/05/06\n"Csv due",E,3,read,"<b onmouseover=alert(1)>x</b>"\n');
  bs = await localBooks(q);
  const c1 = bs.find(b => b.title === 'Csv uno'), c2 = bs.find(b => b.title === 'Csv due');
  ok('import CSV Goodreads: 2024/05/06 → 2024-05-06, testo non data scartato', c1 && c1.finished === '2024-05-06' && c2 && c2.finished === undefined, JSON.stringify([c1, c2]));
  ok('sicurezza: nessun errore in console', !p.errs.length && !q.errs.length, [...p.errs, ...q.errs].join(' / '));
  await q.close2();
}
