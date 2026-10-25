// Accesso: link via email nell'app su iPhone, Google su computer, popup bloccato o chiuso, account senza libri.
import { APP, ok, newPage, localBooks, toastText, resetCloud, putDoc } from './lib.mjs';

const fake = (popup = 'ok', uid = 'u1') => ({
  fn: ([popup, uid]) => { if (!localStorage.getItem('fake-init')) { localStorage.setItem('fake-init', '1'); localStorage.setItem('fake-popup', popup); localStorage.setItem('fake-uid', uid); } },
  arg: [popup, uid]
});
async function openSync(p) {
  if (await p.locator('.dock .more').isVisible()) await p.locator('.dock .more').click();
  else await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /Altro/.test(b.textContent)).click());
  await p.locator('[data-m=sync]').click();
  await p.waitForFunction(() => !document.querySelector('#sy-link').disabled, null, { timeout: 15000 });
}

export default async function ({ browser }) {
  resetCloud();
  const now = Date.now();
  ['Ubik', 'Il confine', 'Odissea'].forEach((t, i) => putDoc('users/u1/books/b' + i, { title: t, author: 'Autore ' + i, status: 'da-leggere', updated: now, added: now, hasSpine: false, deleted: false }));
  const count = async p => (await localBooks(p)).length;
  const until3 = p => p.waitForFunction(() => JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').length === 3, null, { timeout: 15000 }).catch(() => {});

  // App installata su iPhone: niente Google, accesso con il link via email
  const A = await newPage(browser, { standalone: true });
  await A.goto(APP + '/'); await openSync(A);
  ok('app su iPhone: il pulsante Google non c\'è', (await A.locator('#sy-google').count()) === 0);
  await A.fill('#sy-email', 'diego@test.it'); await A.click('#sy-link');
  await A.waitForFunction(() => /Link inviato/.test(document.querySelector('#sy-status').textContent));
  await A.fill('#sy-paste', 'https://mylibrary-2ea05.firebaseapp.com/__/auth/action?mode=signIn&oobCode=abc');
  await A.click('#sy-paste-go'); await until3(A);
  ok('app su iPhone: con il link arrivano i libri del cloud', (await count(A)) === 3, 'libri: ' + await count(A));
  ok('il messaggio dice quanti libri sono arrivati', /3 libri/.test(await toastText(A)), await toastText(A));

  // Computer: accesso con Google (popup)
  const C = await newPage(browser, { width: 1366, height: 860, init: fake() });
  await C.goto(APP + '/'); await openSync(C);
  await C.click('#sy-google'); await until3(C);
  ok('computer: accesso con Google, arrivano i libri', (await count(C)) === 3, 'libri: ' + await count(C));

  // Popup bloccato: ripiego sul redirect, che torna senza accesso → avviso
  const B = await newPage(browser, { width: 1366, height: 860, init: fake('blocked') });
  await B.goto(APP + '/'); await openSync(B);
  await B.click('#sy-google');
  await B.waitForFunction(() => localStorage.getItem('fake-redirect-called'), null, { timeout: 10000 }).catch(() => {});
  await B.waitForTimeout(2500);
  ok('popup bloccato: ripiega sul redirect', !!(await B.evaluate(() => localStorage.getItem('fake-redirect-called'))));
  ok('ritorno dal redirect senza accesso: avviso chiaro', /non si è completato/.test(await toastText(B)), await toastText(B));

  // Popup chiuso
  const P = await newPage(browser, { width: 1366, height: 860, init: fake('closed') });
  await P.goto(APP + '/'); await openSync(P);
  await P.click('#sy-google'); await P.waitForTimeout(800);
  ok('popup chiuso: «Accesso annullato.»', (await P.textContent('#sy-status')) === 'Accesso annullato.', await P.textContent('#sy-status'));

  // Account senza libri e dispositivo vuoto
  const D = await newPage(browser, { width: 1366, height: 860, init: fake('ok', 'altro') });
  await D.goto(APP + '/'); await openSync(D);
  await D.click('#sy-google');
  await D.waitForFunction(() => [...document.querySelectorAll('.toast')].some(t => /non ci sono libri/.test(t.textContent)), null, { timeout: 15000 }).catch(() => {});
  ok('account vuoto: avvisa che i libri potrebbero essere su un altro account', /non ci sono libri/.test(await toastText(D)), await toastText(D));

  const errs = [A, C, B, P, D].flatMap(p => p.errs);
  ok('accesso: nessun errore in console', !errs.length, errs.join(' / '));
  for (const p of [A, C, B, P, D]) await p.close2();
}
