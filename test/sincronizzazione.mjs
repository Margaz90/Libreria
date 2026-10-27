// Sincronizzazione tra tre dispositivi con il finto Firebase: accesso, modifiche, eliminazioni, foto, unione, obiettivo.
import { APP, API, ok, wait, newPage, localBooks, resetCloud } from './lib.mjs';
import { importa, ripristina } from './funzioni.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');
const cloudCount = async () => (await (await fetch(API + '/col?path=' + encodeURIComponent('users/u1/books'))).json()).filter(x => !x.data.deleted).length;
const cloudDoc = async id => (await (await fetch(API + '/doc?path=' + encodeURIComponent('users/u1/books/' + id))).json()).data;
const localBook = (p, id) => p.evaluate(id => JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').find(x => x.id === id) || null, id);

export default async function ({ browser }) {
  resetCloud();
  let cdn = 0;
  const device = async () => {
    const p = await newPage(browser);
    p.on('request', r => { if (/cdn\.jsdelivr\.net/.test(r.url())) cdn++; });
    await p.goto(APP + '/'); await p.waitForTimeout(300);
    return p;
  };
  const signIn = async p => {
    await p.locator('.dock .more').click();
    await p.locator('[data-m=sync]').click();
    await p.waitForFunction(() => !document.querySelector('#sy-google').disabled, null, { timeout: 15000 });
    await p.locator('#sy-google').click();
    await p.waitForFunction(() => !document.querySelector('#sy-status'), null, { timeout: 15000 });
  };
  const openBook = async (p, id) => {
    for (let i = 0; i < 10 && !(await p.locator(`#main [data-id="${id}"]`).count()); i++) {
      const m = p.locator('[data-more]').first(); if (!(await m.count())) break; await m.click(); await p.waitForTimeout(100);
    }
    await p.locator(`#main [data-id="${id}"]`).first().click(); await p.waitForSelector('.sheet');
  };

  // 1. Uso normale senza accesso: nessun SDK scaricato
  const A = await device();
  await A.click('#seed-go');
  await A.waitForFunction(() => JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').length === 108);
  await A.waitForTimeout(500);
  ok('senza accesso non si scarica nulla da Firebase', cdn === 0, 'richieste: ' + cdn);

  // 2. A accede con il cloud vuoto: carica i suoi libri
  await signIn(A);
  await wait(async () => (await cloudCount()) === 108).catch(() => {});
  ok('primo accesso: il dispositivo carica i 108 libri nel cloud', (await cloudCount()) === 108);
  const [t0, t1, t2] = await localBooks(A);

  // 3. B accede da zero: scarica tutto
  const B = await device();
  await signIn(B);
  await wait(async () => (await localBooks(B)).length === 108, 15000).catch(() => {});
  ok('secondo dispositivo: scarica i 108 libri dal cloud', (await localBooks(B)).length === 108);

  // 4. Modifica su A → arriva su B
  await openBook(A, t0.id);
  await A.locator('.seg [data-v="letto"]').click(); await A.locator('#s-save').click();
  await wait(async () => (await localBook(B, t0.id))?.status === 'letto', 6000).catch(() => {});
  ok('modifica su A arriva su B senza ricaricare', (await localBook(B, t0.id))?.status === 'letto');

  // 5. Eliminazione su B → sparisce da A, segnaposto nel cloud
  await openBook(B, t1.id);
  await B.locator('#s-del').click(); await B.locator('#s-del').click();
  await wait(async () => !(await localBook(A, t1.id)), 6000).catch(() => {});
  ok('eliminazione su B sparisce su A', !(await localBook(A, t1.id)));
  ok('eliminazione nel cloud come segnaposto', (await cloudDoc(t1.id))?.deleted === true);

  // 6. Foto del dorso su A → arriva su B
  await openBook(A, t2.id);
  await A.setInputFiles('#sp-file', { name: 'dorso.png', mimeType: 'image/png', buffer: PNG });
  await A.waitForTimeout(300); await A.locator('#s-save').click();
  await wait(async () => !!(await localBook(B, t2.id))?.spine, 8000).catch(() => {});
  ok('foto del dorso arriva su B', !!(await localBook(B, t2.id))?.spine);

  // 7. Terzo dispositivo con un libro suo: chiede come unire
  const D = await device();
  await D.locator('.dock .add').first().click();
  await D.locator('#d-title').fill('Solo sul telefono'); await D.locator('#d-author').fill('Test');
  await D.locator('#a-save').click(); await D.waitForTimeout(300);
  await signIn(D).catch(() => {});
  const asked = await D.waitForSelector('[data-c=merge]', { timeout: 8000 }).then(() => true, () => false);
  ok('primo accesso con libri su entrambi i lati: chiede come unirli', asked);
  if (asked) await D.locator('[data-c=merge]').click();
  await wait(async () => (await localBooks(D)).length === 108 && (await cloudCount()) === 108, 15000).catch(() => {});
  ok('unione: 107 libri del cloud + 1 del telefono', (await localBooks(D)).length === 108 && (await cloudCount()) === 108, `locale ${(await localBooks(D)).length}, cloud ${await cloudCount()}`);

  // 8. Riavvio con sessione attiva
  await A.reload(); await A.waitForTimeout(2500);
  ok('riavviando, la sessione resta attiva', await A.evaluate(() => !!window.libreriaCloud && window.libreriaCloud.connected));

  // 9. Modifiche in due posti: vince la più recente
  await openBook(A, t0.id); await A.locator('.rate button[data-n="2"]').click(); await A.locator('#s-save').click();
  await wait(async () => (await localBook(B, t0.id))?.rating === 2, 6000).catch(() => {});
  await openBook(B, t0.id); await B.locator('.rate button[data-n="5"]').click(); await B.locator('#s-save').click();
  await wait(async () => (await localBook(A, t0.id))?.rating === 5, 6000).catch(() => {});
  ok('vince la modifica più recente', (await localBook(A, t0.id))?.rating === 5 && (await localBook(B, t0.id))?.rating === 5);

  // 9b. Anno di lettura (senza data di fine) impostato su A arriva su B
  await openBook(A, t0.id); await A.fill('#f-finished', ''); await A.fill('#f-year', '2018'); await A.locator('#s-save').click();
  await wait(async () => (await localBook(B, t0.id))?.finishedYear === 2018, 6000).catch(() => {});
  ok('anno di lettura arriva su B', (await localBook(B, t0.id))?.finishedYear === 2018);

  // 10. Obiettivo impostato su A arriva su B
  const year = new Date().getFullYear();
  await A.locator('.goal').first().click(); await A.waitForSelector('#g-n'); await A.fill('#g-n', '5'); await A.click('#g-save');
  const goal = await wait(async () => (await B.evaluate(y => (JSON.parse(localStorage.getItem('libreria-settings') || '{}').goals || {})[y], year)) === 5, 8000).then(() => true, () => false);
  ok('obiettivo impostato su A arriva su B', goal);

  // 11. Ripristino di una copia su A: i libri tornano come prima anche su B
  await importa(A, [{ title: t2.title.toUpperCase(), author: t2.author }], true);
  await wait(async () => (await localBook(B, t2.id))?.title === t2.title.toUpperCase(), 6000).catch(() => {});
  const up = (await localBook(B, t2.id))?.title === t2.title.toUpperCase();
  await ripristina(A);
  await wait(async () => (await localBook(B, t2.id))?.title === t2.title, 6000).catch(() => {});
  ok('ripristino su A arriva su B', up && (await localBook(B, t2.id))?.title === t2.title && !!(await localBook(A, t2.id))?.spine);

  const errs = [...A.errs, ...B.errs, ...D.errs];
  ok('sincronizzazione: nessun errore in console', !errs.length, errs.join(' / '));
  for (const p of [A, B, D]) await p.close2();
}
