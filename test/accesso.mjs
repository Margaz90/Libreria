// Accesso: link via email nell'app su iPhone, Google su computer, popup bloccato o chiuso, account senza libri.
import { APP, API, ok, newPage, localBooks, toastText, resetCloud, putDoc } from './lib.mjs';

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

  // v90: app installata sul sito Firebase → «Accedi con Google» a pagina intera
  const sito = (nome, extra = {}) => ({ fn: ([nome, extra]) => { window.libreriaSito = nome; window.libreriaPorta = false; /* qui si prova l'accesso, non la porta */ for (const [k, v] of Object.entries(extra)) if (!localStorage.getItem(k)) localStorage.setItem(k, v);
    if (sessionStorage.getItem('libreria-auth-pending')) localStorage.setItem('pending-visto', '1'); }, arg: [nome, extra] });
  const F = await newPage(browser, { standalone: true, init: sito('firebase') });
  await F.goto(APP + '/'); await openSync(F);
  ok('app su iPhone, sito Firebase: c\'è «Accedi con Google»', (await F.locator('#sy-google').count()) === 1 && !(await F.locator('#sy-google').isDisabled()));
  ok('app su iPhone, sito Firebase: la pagina di accesso è dello stesso sito', await F.evaluate(() => window.__fbConfig && window.__fbConfig.authDomain === location.hostname), JSON.stringify(await F.evaluate(() => window.__fbConfig)));
  await F.click('#sy-google');
  await F.waitForFunction(() => localStorage.getItem('fake-redirect-called') && localStorage.getItem('pending-visto'), null, { timeout: 10000 }).catch(() => {});
  ok('app su iPhone, sito Firebase: il clic va a pagina intera e segna l\'accesso in corso', !!(await F.evaluate(() => localStorage.getItem('fake-redirect-called') && localStorage.getItem('pending-visto'))));
  await F.waitForFunction(() => !!window.libreriaCloud, null, { timeout: 5000 }).catch(() => {});
  ok('app su iPhone, sito Firebase: al ritorno, da installazione vuota, il servizio si carica', await F.evaluate(() => !!window.libreriaCloud && !JSON.parse(localStorage.getItem('libreria-cloud') || '{}').uid));
  ok('app su iPhone, sito Firebase: popup mai usato', !(await F.evaluate(() => localStorage.getItem('fake-popup-called'))));
  const E = await newPage(browser, { standalone: true, init: sito('firebase', { 'fake-redirect-error': 'auth/account-exists-with-different-credential' }) });
  await E.goto(APP + '/'); await openSync(E);
  await E.click('#sy-google'); await E.waitForTimeout(600);
  ok('stesso indirizzo già usato col link: messaggio chiaro', /già collegato con il link via email/.test(await E.textContent('#sy-status')), await E.textContent('#sy-status'));
  const V = await newPage(browser, { standalone: true, init: sito('vecchio') });
  await V.goto(APP + '/'); await openSync(V);
  ok('app su iPhone, vecchio sito: niente Google (come prima)', (await V.locator('#sy-google').count()) === 0);
  ok('vecchio sito: pagina di accesso su firebaseapp.com', await V.evaluate(() => window.__fbConfig && window.__fbConfig.authDomain === 'mylibrary-2ea05.firebaseapp.com'));
  for (const x of [F, E, V]) await x.close2();

  // v94: controllo dell'invito prima della sincronizzazione
  const conEmail = (email, uid) => ({ fn: ([e, u]) => { if (!localStorage.getItem('fake-init')) { localStorage.setItem('fake-init', '1'); localStorage.setItem('fake-popup', 'ok'); localStorage.setItem('fake-uid', u); localStorage.setItem('fake-email', e); } }, arg: [email, uid] });
  const ammesso = p => p.evaluate(() => JSON.parse(localStorage.getItem('libreria-cloud') || '{}').ammesso);
  const U = await newPage(browser, { width: 1366, height: 860, init: conEmail('ugo@example.com', 'ugo1') });
  const libriChiesti = []; U.on('request', r => { if (/path=users/.test(r.url())) libriChiesti.push(r.url()); });
  await U.goto(APP + '/'); await openSync(U); await U.click('#sy-google');
  await U.waitForFunction(() => JSON.parse(localStorage.getItem('libreria-cloud') || '{}').ammesso === false, null, { timeout: 8000 }).catch(() => {});
  await U.waitForTimeout(800);
  ok('invito: chi non è invitato non arriva ai libri del cloud', (await ammesso(U)) === false && !libriChiesti.length, JSON.stringify([await ammesso(U), libriChiesti.length]));
  const ADMIN = '46AtxF1piJQGsWcqm665Wjf6nFA3';
  putDoc(`users/${ADMIN}/books/a1`, { title: 'Libro di Diego', author: 'X', status: 'da-leggere', updated: now, added: now, hasSpine: false, deleted: false });
  const AD = await newPage(browser, { width: 1366, height: 860, init: conEmail('diego.vero@example.com', ADMIN) });
  await AD.goto(APP + '/'); await openSync(AD); await AD.click('#sy-google');
  await AD.waitForFunction(() => JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').some(b => b.title === 'Libro di Diego'), null, { timeout: 10000 }).catch(() => {});
  ok('invito: l\'amministratore entra anche senza essere nell\'elenco', (await ammesso(AD)) === true && (await localBooks(AD)).some(b => b.title === 'Libro di Diego'));
  for (const x of [U, AD]) await x.close2();

  // Computer: accesso con Google (popup)
  const C = await newPage(browser, { width: 1366, height: 860, init: fake() });
  await C.goto(APP + '/'); await openSync(C);
  await C.click('#sy-google'); await until3(C);
  ok('computer: accesso con Google, arrivano i libri (invitato)', (await count(C)) === 3 && (await C.evaluate(() => JSON.parse(localStorage.getItem('libreria-cloud') || '{}').ammesso)) === true, 'libri: ' + await count(C));

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
  await porta(browser);
}

// v94: porta d'ingresso (accesa nei test con window.libreriaPorta), «Esci» che pulisce, «Invitati» per l'amministratore
async function porta(browser) {
  const ADMIN = '46AtxF1piJQGsWcqm665Wjf6nFA3', now = Date.now();
  const nuova = async (email = 'diego@test.it', uid = 'porta1') => {
    const p = await newPage(browser, { init: { fn: ([e, u]) => { window.libreriaPorta = true; if (!localStorage.getItem('fake-init')) { localStorage.setItem('fake-init', '1'); localStorage.setItem('fake-popup', 'ok'); localStorage.setItem('fake-uid', u); localStorage.setItem('fake-email', e); } }, arg: [email, uid] } });
    await p.goto(APP + '/'); return p;
  };
  const cloudDoc = p => fetch(`${API}/doc?path=${encodeURIComponent(p)}`).then(r => r.json());
  const cloudCol = p => fetch(`${API}/col?path=${encodeURIComponent(p)}`).then(r => r.json());
  const vedeLibri = p => p.locator('#main [data-id]').first().isVisible().catch(() => false);
  // Senza rete (nei test il service worker è spento: si simula con navigator.onLine falso e i servizi esterni bloccati)
  const offline = async p => { await p.unroute(/cdn\.jsdelivr\.net/); await p.route(/cdn\.jsdelivr\.net|localhost:\d+\/(doc|col)/, r => r.abort()); await p.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false })); await p.reload(); };
  ['Primo', 'Secondo'].forEach((t, i) => putDoc('users/porta1/books/p' + i, { title: t, author: 'Autore', status: 'da-leggere', updated: now, added: now, hasSpine: false, deleted: false }));

  // 1-2. Senza accesso solo la porta; un invitato entra e trova i suoi libri
  const A = await nuova();
  await A.waitForSelector('#porta #sy-email', { timeout: 8000 }).catch(() => {});
  ok('porta: senza accesso solo la schermata d\'accesso', (await A.locator('#porta #sy-email').count()) === 1 && !(await vedeLibri(A)) && !(await A.locator('#porta #sy-close').count()));
  await A.waitForFunction(() => !document.querySelector('#sy-google').disabled, null, { timeout: 10000 }).catch(() => {});
  await A.click('#porta #sy-google');
  await A.waitForFunction(() => !document.querySelector('#porta') && JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').length === 2, null, { timeout: 10000 }).catch(() => {});
  ok('porta: un invitato entra e trova i suoi libri', !(await A.locator('#porta').count()) && (await localBooks(A)).length === 2, String((await localBooks(A)).length));

  // 6-7. «Esci»: bloccato con modifiche non inviate; poi toglie i libri e torna alla porta
  const esci = async p => { await p.locator('.dock .more').click(); await p.locator('[data-m=sync]').click(); await p.waitForSelector('#sy-out'); await p.click('#sy-out'); await p.click('#sy-out'); await p.waitForTimeout(600); };
  await A.evaluate(() => { window.__inSosp = window.libreriaCloud.inSospeso; window.libreriaCloud.inSospeso = () => true; });
  await esci(A);
  ok('Esci: bloccato con modifiche non ancora salvate nel cloud', /Ci sono modifiche non ancora salvate nel cloud: collegati alla rete e riprova\./.test(await A.locator('.sheet').innerText()) && (await localBooks(A)).length === 2);
  await A.evaluate(() => { window.libreriaCloud.inSospeso = window.__inSosp; }); await A.keyboard.press('Escape'); await A.waitForTimeout(300);
  await esci(A);
  await A.waitForSelector('#porta #sy-email', { timeout: 5000 }).catch(() => {});
  ok('Esci: toglie i libri da questo dispositivo e torna alla porta', (await localBooks(A)).length === 0 && (await A.locator('#porta #sy-email').count()) === 1
    && await A.evaluate(() => !localStorage.getItem('libreria-cloud') || !JSON.parse(localStorage.getItem('libreria-cloud')).uid), JSON.stringify(await localBooks(A)));
  // 8. Un secondo invitato sullo stesso dispositivo non riceve i libri del primo
  putDoc('invitati/anna@example.com', { aggiunto: 1, da: ADMIN });
  await A.evaluate(() => { localStorage.setItem('fake-uid', 'anna1'); localStorage.setItem('fake-email', 'anna@example.com'); });
  await A.waitForFunction(() => document.querySelector('#sy-google') && !document.querySelector('#sy-google').disabled, null, { timeout: 10000 }).catch(() => {});
  await A.click('#porta #sy-google'); await A.waitForTimeout(2500);
  ok('due invitati sullo stesso dispositivo: il secondo non riceve i libri del primo', (await localBooks(A)).length === 0 && (await cloudCol('users/anna1/books')).length === 0, JSON.stringify(await localBooks(A)));
  await A.close2();

  // 3. Non invitato: schermata su invito con l'indirizzo; «Esci e usa un altro account» torna alla porta
  const U = await nuova('ugo@example.com', 'ugo1');
  await U.waitForFunction(() => !document.querySelector('#sy-google').disabled, null, { timeout: 10000 }).catch(() => {});
  await U.click('#porta #sy-google');
  await U.waitForFunction(() => /Questa libreria è su invito\./.test(document.querySelector('#porta')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
  const testo = await U.locator('#porta').innerText().catch(() => '');
  ok('porta: chi non è invitato vede la schermata su invito, con il suo indirizzo', /Questa libreria è su invito\./.test(testo) && /ugo@example\.com non è tra gli invitati\. Chiedi a Diego di aggiungerti\./.test(testo), testo);
  await U.click('#porta >> text=Esci e usa un altro account');
  await U.waitForSelector('#porta #sy-email', { timeout: 5000 }).catch(() => {});
  ok('porta: «Esci e usa un altro account» torna alla schermata d\'accesso', (await U.locator('#porta #sy-email').count()) === 1);
  await U.close2();

  // 5. Email con maiuscole nell'elenco (Diego la scrive in minuscolo) riconosciuta
  putDoc('invitati/mario.rossi@gmail.com', { aggiunto: 1, da: ADMIN });
  const M = await nuova('Mario.Rossi@Gmail.com', 'mario1');
  await M.waitForFunction(() => !document.querySelector('#sy-google').disabled, null, { timeout: 10000 }).catch(() => {});
  await M.click('#porta #sy-google');
  await M.waitForFunction(() => !document.querySelector('#porta'), null, { timeout: 8000 }).catch(() => {});
  ok('porta: email con maiuscole riconosciuta tra gli invitati', !(await M.locator('#porta').count()));
  await M.close2();

  // 4. Già collegato prima della v94 (nessun «ammesso» salvato), offline: si apre subito con i suoi libri
  const O = await nuova();
  await O.evaluate(() => { localStorage.setItem('libreria-cloud', JSON.stringify({ uid: 'porta1', email: 'diego@test.it' })); localStorage.setItem('libreria-diego-v1', JSON.stringify([{ id: 'o1', title: 'Offline', author: 'X', status: 'da-leggere', added: 1, updated: 1 }])); });
  await offline(O); await O.waitForTimeout(1200);
  ok('porta: già collegato, offline, si apre subito con i suoi libri', !(await O.locator('#porta').count()) && await vedeLibri(O));
  await O.close2();

  // 10. Offline al primo accesso: messaggio chiaro
  const F = await nuova();
  await offline(F); await F.waitForTimeout(1500);
  ok('porta: offline al primo accesso, messaggio chiaro', /Serve la connessione per entrare la prima volta\./.test(await F.locator('#porta').innerText().catch(() => '')));
  await F.close2();

  // 9. «Invitati»: solo l'amministratore; aggiunge (in minuscolo) e toglie in due tocchi
  const D = await nuova('diego.vero@example.com', ADMIN);
  await D.waitForFunction(() => !document.querySelector('#sy-google').disabled, null, { timeout: 10000 }).catch(() => {});
  await D.click('#porta #sy-google'); await D.waitForFunction(() => !document.querySelector('#porta'), null, { timeout: 8000 }).catch(() => {});
  await D.locator('.dock .more').click(); await D.locator('[data-m=inv]').click(); await D.waitForSelector('#inv-email');
  await D.fill('#inv-email', 'Nuovo.Amico@Example.com'); await D.click('#inv-add'); await D.waitForTimeout(800);
  const aggiunto = (await cloudDoc('invitati/nuovo.amico@example.com')).exists;
  ok('Invitati: l\'amministratore aggiunge un\'email (salvata in minuscolo) e la vede in elenco', aggiunto && /nuovo\.amico@example\.com/.test(await D.locator('.sheet').innerText()));
  const togli = D.locator('[data-togli="nuovo.amico@example.com"]'); await togli.click(); await togli.click(); await D.waitForTimeout(800);
  ok('Invitati: togliere chiede conferma e poi toglie', !(await cloudDoc('invitati/nuovo.amico@example.com')).exists);
  await D.close2();
  const I = await nuova();
  await I.waitForFunction(() => !document.querySelector('#sy-google').disabled, null, { timeout: 10000 }).catch(() => {});
  await I.click('#porta #sy-google'); await I.waitForFunction(() => !document.querySelector('#porta'), null, { timeout: 8000 }).catch(() => {});
  await I.locator('.dock .more').click(); await I.waitForTimeout(300);
  ok('Invitati: un invitato non vede la voce', (await I.locator('[data-m=inv]').count()) === 0);
  await I.close2();
}
