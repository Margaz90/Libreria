// Scheda «Frontespizio»: frasi delle date, ritmo di lettura, struttura, aspetto, pagina, colophon, computer.
import { APP, ok, newPage, localBooks } from './lib.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');
const PNGURL = 'data:image/png;base64,' + PNG.toString('base64');
const load = async (p, books) => {
  await p.clock.setFixedTime(FIXED_);
  await p.goto(APP + '/');
  await p.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)), books);
  await p.reload(); await p.waitForTimeout(300);
};
const FIXED_ = new Date('2026-10-29T12:00:00');
const openBook = async (p, id) => { await p.locator(`#main [data-id="${id}"], #hero [data-id="${id}"]`).first().click(); await p.waitForSelector('.sheet'); };

const FIXED = new Date('2026-10-29T12:00:00');

async function puri(browser) {
  const p = await newPage(browser);
  await p.clock.setFixedTime(FIXED);
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  const P = a => p.evaluate(a => window.libreriaScheda.period(a), a);
  const line = r => (r.lead + ' ' + (r.showStart ? r.startWord + r.startText : '') + (r.showEnd ? r.endWord + r.endText : '')).replace(/\s+/g, ' ').trim();
  let r = await P({ status: 'letto', started: '2025-03-10', finished: '2025-04-02', pages: 300 });
  ok('L1 stesso anno', line(r) === 'Letto dal 10 marzo al 2 aprile 2025' && r.sub === '24 giorni · 300 pagine' && r.sr === 'Letto dal 10 marzo 2025 al 2 aprile 2025, 24 giorni.', JSON.stringify(r));
  r = await P({ status: 'letto', started: '2024-12-10', finished: '2025-01-02' });
  ok('L1 anni diversi', line(r) === 'Letto dal 10 dicembre 2024 al 2 gennaio 2025' && r.sub === '24 giorni' && r.sr === 'Letto dal 10 dicembre 2024 al 2 gennaio 2025, 24 giorni.', JSON.stringify(r));
  r = await P({ status: 'letto', started: '2025-03-10', finished: '2025-03-10', pages: 300 });
  ok('L1 in un giorno', r.sub === 'In un giorno · 300 pagine', r.sub);
  r = await P({ status: 'letto', started: '2025-05-10', finished: '2025-05-01', pages: 200 });
  ok('L1 date storte: solo le pagine', line(r) === 'Letto dal 10 maggio al 1 maggio 2025' && r.sub === '200 pagine', line(r) + '|' + r.sub);
  r = await P({ status: 'letto', started: '', finished: '2025-01-02' });
  ok('L2', line(r) === 'Iniziato il scegli la data e finito il 2 gennaio 2025' && r.sr === 'Iniziato il: data da scegliere; finito il 2 gennaio 2025.', line(r) + '|' + r.sr);
  r = await P({ status: 'letto', started: '2025-03-10', finished: '', pages: 300 });
  ok('L3', line(r) === 'Iniziato il 10 marzo 2025 e finito il scegli la data' && r.sub === '300 pagine', line(r));
  r = await P({ status: 'letto', started: '', finished: '' });
  ok('L4', line(r) === 'Iniziato il scegli la data e finito il scegli la data' && r.sub === '', line(r));
  r = await P({ status: 'letto', started: '', finished: '', year: 2019 });
  ok('L5', r.lead === 'Letto nel 2019.' && line(r) === 'Letto nel 2019. Iniziato il scegli la data e finito il scegli la data' && r.sr.startsWith('Letto nel 2019. Iniziato il: data da scegliere'), line(r) + '|' + r.sr);
  r = await P({ status: 'in-lettura', started: '2026-10-12' });
  ok('R1', line(r) === 'In lettura dal 12 ottobre 2026' && !r.showEnd && r.sr === 'In lettura dal 12 ottobre 2026.', line(r) + '|' + r.sr);
  r = await P({ status: 'in-lettura', started: '' });
  ok('R2', line(r) === 'In lettura dal scegli la data', line(r));
  r = await P({ status: 'da-leggere', started: '2025-01-01' });
  ok('Da leggere', line(r) === 'Ancora da iniziare.' && !r.showStart && !r.showEnd && r.sub === '', line(r));
  r = await P({ status: 'letto', started: '2025-03-08', finished: '2025-03-11' });
  ok('elisione', line(r) === "Letto dall'8 marzo all'11 marzo 2025", line(r));
  r = await P({ status: 'letto', started: 'domenica', finished: '2025-01-02' });
  ok('data non valida = nessuna data', line(r) === 'Iniziato il scegli la data e finito il 2 gennaio 2025' && !p.errs.length, line(r) + p.errs.join());

  const T = a => p.evaluate(([a, o]) => { const S = window.libreriaScheda, r = S.pace(a, o); return { r, t: S.paceText(r, o) }; }, [a, '2026-10-29']);
  let x = await T({ started: '2026-10-12', page: 142, pages: 337 });
  ok('ritmo ok (ora legale)', x.r.why === 'ok' && x.r.day === 18 && x.r.eta === '2026-11-23' && x.t === '18º giorno di lettura, circa 8 pagine al giorno: a questo ritmo lo finisci verso il 23 novembre.', JSON.stringify(x));
  x = await T({ started: '2026-10-29', page: 5, pages: 300 });
  ok('ritmo today', x.r.why === 'today' && x.t === 'Primo giorno di lettura: la stima compare da domani.', JSON.stringify(x));
  let good = true;
  for (const s of ['', 'domenica', '2026-11-02']) { x = await T({ started: s, page: 5, pages: 300 }); good = good && x.r.why === 'no-start' && x.t === 'Scegli la data di inizio: qui comparirà quando potresti finirlo.'; }
  ok('ritmo no-start', good);
  x = await T({ started: '2026-10-12', page: 142 });
  ok('ritmo no-pages', x.r.why === 'no-pages' && x.t === '18º giorno di lettura. Aggiungi le pagine totali in «Modifica i dati del libro» per sapere quando lo finisci.', x.t);
  x = await T({ started: '2026-10-12', pages: 337 });
  ok('ritmo no-page', x.r.why === 'no-page' && x.t === '18º giorno di lettura. Scrivi a che pagina sei per sapere quando lo finisci.', x.t);
  x = await T({ started: '2026-10-12', page: 337, pages: 337 });
  ok('ritmo done', x.r.why === 'done' && x.t === "18º giorno di lettura: sei all'ultima pagina, segnalo come Letto.", x.t);
  good = true;
  for (const a of [{ started: '2026-10-28', page: 700, pages: 1000 }, { started: '2026-09-01', page: 10, pages: 300 }, { started: '2024-01-01', page: 500, pages: 1000 }, { started: '2026-10-20', page: 10, pages: 5000 }]) {
    x = await T(a); good = good && x.r.why === 'odd' && x.t === `${x.r.day}º giorno di lettura.`;
  }
  ok('ritmo odd (4 casi)', good);
  x = await T({ started: '2026-10-28', page: 700, pages: 1000 });
  ok('odd: 2º giorno', x.t === '2º giorno di lettura.', x.t);
  x = await T({ started: '2026-10-01', page: 58, pages: 200 });
  ok('ritmo con anno', x.r.eta === '2027-01-08' && x.t === "29º giorno di lettura, circa 2 pagine al giorno: a questo ritmo lo finisci verso l'8 gennaio 2027.", x.t);
  x = await T({ started: '2026-10-20', page: 90, pages: 95 });
  ok('ritmo domani', x.t === '10º giorno di lettura, circa 9 pagine al giorno: a questo ritmo lo finisci domani.', x.t);
  x = await T({ started: '2026-10-20', page: 10, pages: 40 });
  ok('ritmo 1 pagina', x.t === '10º giorno di lettura, circa 1 pagina al giorno: a questo ritmo lo finisci verso il 28 novembre.', x.t);
  await p.close2();
}

async function struttura(browser) {
  const p = await newPage(browser);
  const base = { added: 1, rating: 0, synopsis: 'Una trama.' };
  await load(p, [
    { ...base, id: 't1', title: 'Letto', author: 'A', status: 'letto', finished: '2025-01-02' },
    { ...base, id: 't2', title: 'In corso', author: 'B', status: 'in-lettura', started: '2026-10-12', pages: 300, page: 100 },
    { ...base, id: 't3', title: 'Pila', author: 'C', status: 'da-leggere' },
    { ...base, id: 't4', title: 'Desiderio', author: 'D', status: 'desiderato' },
    { ...base, id: 't5', title: 'Senza trama', author: 'E', status: 'letto', finished: '2025-01-02', synopsis: '', cover: PNGURL },
  ]);
  const order = (sels) => p.evaluate(ss => { const e = ss.map(s => document.querySelector('.sheet ' + s)); return e.every(Boolean) && e.every((x, i) => !i || (e[i - 1].compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING)); }, sels);
  const closeAll = async () => { await p.keyboard.press('Escape'); await p.locator('[data-u="drop"]').click({ timeout: 700 }).catch(() => {}); await p.waitForSelector('.sheet', { state: 'detached' }); };
  await openBook(p, 't1');
  ok('ordine Letto', await order(['.sheet-top', '.seg', '#f-rate', '#f-period', '#f-quote', '#f-notes', '#s-syn-b', '#s-colo', '.looks', '.sheet-bar']));
  ok('scheda .sheet.book, una sola h2, h3 Trama e Sullo scaffale', await p.evaluate(() => { const s = document.querySelector('.sheet'); return s.classList.contains('book') && s.querySelectorAll('h2').length === 1 && [...s.querySelectorAll('h3')].map(h => h.textContent).join() === 'Trama,Sullo scaffale'; }));
  const x = p.locator('#s-close'), bx = await x.boundingBox();
  ok('✕ al posto di Chiudi', (await x.innerText()) === '✕' && (await x.getAttribute('aria-label')) === 'Chiudi la scheda' && bx.width >= 43.9 && bx.height >= 43.9, JSON.stringify(bx) + await x.innerText());
  ok('Modifica i dati del libro: chiuso, con i campi', await p.evaluate(() => { const d = document.querySelector('details.edit'); return d.querySelector('summary').textContent === 'Modifica i dati del libro' && !d.open && !!d.querySelector('#d-title'); }));
  ok('Ruota e Rimuovi nascosti senza foto', await p.locator('#sp-rot').isHidden() && await p.locator('#sp-del').isHidden());
  await p.setInputFiles('#sp-file', { name: 'dorso.png', mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(500);
  ok('Ruota e Rimuovi visibili con la foto', await p.locator('#sp-rot').isVisible() && await p.locator('#sp-del').isVisible());
  await closeAll();
  await openBook(p, 't2');
  ok('ordine In lettura', await order(['.sheet-top', '.seg', '#f-period', '#f-pblk', '#f-quote', '#f-notes', '#f-rate', '#s-syn-b', '#s-colo', '.looks', '.sheet-bar']));
  await closeAll();
  await openBook(p, 't3');
  ok('ordine Da leggere', await order(['.sheet-top', '.seg', '#f-period', '#s-syn-b', '#f-quote', '#f-notes', '#f-rate', '#s-colo', '.looks', '.sheet-bar']));
  await closeAll();
  await openBook(p, 't4');
  ok('ordine Desiderato', await order(['.sheet-top', '.wish-box', '#s-syn-b', '#s-colo', '.looks', '.sheet-bar']) && !(await p.locator('#f-status').count()));
  await closeAll();
  await openBook(p, 't5');
  ok('trama vuota: sezione nascosta', await p.locator('#s-syn-b').isHidden());
  ok('copertina presente in frontespizio e Sullo scaffale', await p.locator('.sheet-top .cover img').count() === 1 && await p.locator('.looks-cover img').count() === 1);
  await p.locator('details.edit summary').click(); await p.locator('#cv-clear').click();
  ok('copertina disegnata: frontespizio e Sullo scaffale insieme', await p.locator('.sheet-top .cover img').count() === 0 && await p.locator('.looks-cover img').count() === 0);
  await closeAll();
  await p.keyboard.press('n'); await p.waitForSelector('.sheet');
  ok('Nuovo libro: niente .book, due .rf', await p.evaluate(() => { const s = document.querySelector('.sheet'); return !s.classList.contains('book') && s.querySelectorAll('.rf').length === 2; }));
  ok('struttura: nessun errore in console', !p.errs.length, p.errs.join());
  await p.close2();
}

async function aspetto(browser) {
  const p = await newPage(browser);
  await load(p, [
    { id: 'a1', title: 'Il primo volume', author: 'Autore Uno', status: 'letto', finished: '2025-01-02', started: '2024-12-10', added: 1, rating: 3, series: 'Saga', seriesNo: '1', synopsis: 'Trama ' + 'lunga '.repeat(40), pages: 300 },
    { id: 'a2', title: 'Il secondo volume', author: 'Autore Uno', status: 'da-leggere', added: 2, rating: 0, series: 'Saga', seriesNo: '2' },
  ]);
  await openBook(p, 'a1'); await p.waitForTimeout(500);
  const css = (sel, prop) => p.evaluate(([s, pr]) => getComputedStyle(document.querySelector(s))[pr], [sel, prop]);
  const cb = await p.locator('.sheet-top .cover').boundingBox();
  ok('titolo 26 px in Fraunces, autore in corsivo, copertina 120 px', await css('.sheet h2', 'fontSize') === '26px' && /Fraunces/.test(await css('.sheet h2', 'fontFamily')) && await css('.sheet-top .sub', 'fontStyle') === 'italic' && Math.round(cb.width) === 120, JSON.stringify(cb));
  ok('barra Elimina/Salva fissa in basso', await css('.sheet-bar', 'position') === 'sticky');
  await p.evaluate(() => { document.querySelector('.sheet').scrollTop = 0; });
  const sb = await p.locator('#s-save').boundingBox();
  ok('Salva visibile senza scorrere', sb.y >= 0 && sb.y + sb.height <= 844, JSON.stringify(sb));
  ok('✕ fisso in alto', await css('#s-close', 'position') === 'sticky');
  await p.evaluate(() => { document.querySelector('.sheet').scrollTop = 99999; });
  const xb = await p.locator('#s-close').boundingBox();
  ok('✕ resta in alto dopo lo scorrimento', xb.y >= 0 && xb.y < 100, JSON.stringify(xb));
  await p.evaluate(() => { document.querySelector('.sheet').scrollTop = 0; });
  await p.fill('#f-notes', 'una nota'); await p.keyboard.press('Escape');
  const ub = await p.locator('.unsaved').boundingBox(), sv = await p.locator('#s-save').boundingBox();
  ok('modifiche non salvate sopra la barra', await p.locator('.unsaved').isVisible() && ub.y <= sv.y && ub.y + ub.height >= sv.y + sv.height, JSON.stringify([ub, sv]));
  await p.locator('[data-u="back"]').click();
  ok('etichette: Le tue note, Citazione preferita nascosta', await p.locator('label[for="f-notes"]').textContent() === 'Le tue note' && await css('label[for="f-quote"]', 'position') === 'absolute');
  ok('Prossimo della serie in tondo', await p.locator('.snext').count() === 1 && await css('.snext .lab', 'textTransform') === 'none');
  ok('scheda: niente scorrimento orizzontale', await p.evaluate(() => { const s = document.querySelector('.sheet'); return s.scrollWidth <= s.clientWidth && document.documentElement.scrollWidth <= 390; }));
  ok('aspetto: nessun errore in console', !p.errs.length, p.errs.join());
  await p.close2();
}

const txt = (p, sel) => p.locator(sel).innerText().then(t => t.replace(/\s+/g, ' ').trim());
const vis = (p, sel) => p.locator(sel).isVisible().catch(() => false);

async function frase(browser) {
  const p = await newPage(browser, { init: { fn: () => { window.__pick = 0; HTMLInputElement.prototype.showPicker = function () { window.__pick++; }; } } });
  const base = { added: 1, rating: 0 };
  await load(p, [
    { ...base, id: 'f1', title: 'Uno', author: 'A', status: 'letto', started: '2025-03-10', finished: '2025-04-02', pages: 300 },
    { ...base, id: 'f4', title: 'Quattro', author: 'A', status: 'letto', started: '2025-03-10', pages: 300 },
    { ...base, id: 'f5', title: 'Cinque', author: 'A', status: 'letto' },
    { ...base, id: 'f6', title: 'Sei', author: 'A', status: 'letto', finishedYear: 2019 },
    { ...base, id: 'f7', title: 'Sette', author: 'A', status: 'in-lettura', started: '2026-10-12', page: 142, pages: 337 },
    { ...base, id: 'f8', title: 'Otto', author: 'A', status: 'in-lettura' },
    { ...base, id: 'f9', title: 'Nove', author: 'A', status: 'da-leggere' },
    { ...base, id: 'f10', title: 'Dieci', author: 'A', status: 'letto', started: '2025-05-10', finished: '2025-05-01', pages: 200 },
  ]);
  const close = async () => { await p.keyboard.press('Escape'); await p.locator('[data-u="drop"]').click({ timeout: 700 }).catch(() => {}); await p.waitForSelector('.sheet', { state: 'detached' }); };
  await openBook(p, 'f1');
  ok('L1', await txt(p, '.pline') === 'Letto dal 10 marzo al 2 aprile 2025' && await txt(p, '#f-psub') === '24 giorni · 300 pagine' && await p.locator('#f-period-sr').textContent() === 'Letto dal 10 marzo 2025 al 2 aprile 2025, 24 giorni.', await txt(p, '.pline'));
  const dt = await p.locator('#f-started').evaluate(e => ({ o: getComputedStyle(e).opacity, f: getComputedStyle(e).fontSize, h: e.closest('.dt').getBoundingClientRect().height }));
  ok('selettore trasparente a 16 px, bersaglio >= 44', dt.o === '0' && dt.f === '16px' && dt.h >= 44, JSON.stringify(dt));
  await p.click('#f-started'); const n1 = await p.evaluate(() => window.__pick);
  await p.focus('#f-started'); await p.keyboard.press('Enter'); const n2 = await p.evaluate(() => window.__pick);
  ok('clic e Invio chiamano showPicker', n1 === 1 && n2 === 2, n1 + ',' + n2);
  await p.click('.seg [data-v="in-lettura"]');
  ok('cambio di stato: R1 e suggerimento', await txt(p, '.pline') === 'In lettura dal 10 marzo 2025' && await vis(p, '#f-pend-hint') && !(await vis(p, '#f-pc-end')), await txt(p, '.pline'));
  await close();
  await openBook(p, 'f4');
  ok('L3 con segnale e anno', await txt(p, '.pline') === 'Iniziato il 10 marzo 2025 e finito il scegli la data' && await vis(p, '#s-stale') && await vis(p, '#f-year-row'), await txt(p, '.pline'));
  await p.fill('#f-finished', '2025-04-02');
  ok('fine scelta: frase L1 e anno nascosto', await txt(p, '.pline') === 'Letto dal 10 marzo al 2 aprile 2025' && !(await vis(p, '#f-year-row')), await txt(p, '.pline'));
  await close();
  await openBook(p, 'f5');
  await p.fill('#f-started', '2025-03-01');
  ok('inizio: fine stimata nella frase e nota', await txt(p, '.pline') === 'Letto dal 1 marzo al 21 marzo 2025' && await vis(p, '#f-date-est'), await txt(p, '.pline'));
  await p.fill('#f-started', ''); await p.fill('#f-finished', '');
  await p.fill('#f-year', '2019');
  ok('solo anno: Letto nel 2019.', await txt(p, '#f-pw-lead') === 'Letto nel 2019.', await txt(p, '.pline'));
  await close();
  await openBook(p, 'f6');
  ok('L5 senza segnale', await txt(p, '.pline') === 'Letto nel 2019. Iniziato il scegli la data e finito il scegli la data' && !(await p.locator('#s-stale').count()), await txt(p, '.pline'));
  await close();
  await openBook(p, 'f7');
  ok('R1', await txt(p, '.pline') === 'In lettura dal 12 ottobre 2026' && !(await vis(p, '#f-pc-end')) && await vis(p, '#f-pend-hint'), await txt(p, '.pline'));
  await close();
  await openBook(p, 'f8');
  ok('R2', await txt(p, '.pline') === 'In lettura dal scegli la data', await txt(p, '.pline'));
  await close();
  await openBook(p, 'f9');
  ok('Da leggere', await txt(p, '.pline') === 'Ancora da iniziare.' && !(await vis(p, '#f-psub')) && !(await vis(p, '#f-pend-hint')), await txt(p, '.pline'));
  await close();
  await openBook(p, 'f10');
  ok('date storte: frase e segnale', await txt(p, '.pline') === 'Letto dal 10 maggio al 1 maggio 2025' && await vis(p, '#s-stale'), await txt(p, '.pline'));
  await p.locator('#s-save').click(); await p.waitForTimeout(300);
  ok('date storte: Salva bloccato con avviso', await vis(p, '.sheet') && await vis(p, '#f-date-err') && await p.getAttribute('#f-finished', 'aria-invalid') === 'true');
  await close();
  await p.keyboard.press('n'); await p.waitForSelector('.sheet');
  await p.click('.seg [data-v="letto"]');
  ok('Nuovo libro: Letto mostra le date da scegliere', await txt(p, '.pline') === 'Iniziato il scegli la data e finito il scegli la data', await txt(p, '.pline'));
  await p.fill('#f-started', '2025-03-01');
  ok('frase: nessun errore in console', !p.errs.length, p.errs.join());
  await p.close2();
}

async function voto(browser) {
  const p = await newPage(browser);
  await load(p, [
    { id: 'v1', title: 'Voto', author: 'A', status: 'letto', finished: '2025-01-02', added: 1, rating: 0 },
    { id: 'v2', title: 'Pila', author: 'A', status: 'da-leggere', added: 2, rating: 0 },
  ]);
  await openBook(p, 'v1'); await p.waitForTimeout(400);
  ok('verdetto iniziale per un Letto senza voto', await txt(p, '#f-verdict') === 'Tocca una stella per dare il voto');
  await p.click('.rate button[data-n="4"]');
  ok('4 stelle: Bellissimo', await txt(p, '#f-verdict') === 'Bellissimo');
  await p.click('.rate button[data-n="4"]');
  ok('stessa stella: torna al testo iniziale', await txt(p, '#f-verdict') === 'Tocca una stella per dare il voto');
  const sizes = await p.evaluate(() => [...document.querySelectorAll('.rate button, .rf .seg button')].map(b => { const r = b.getBoundingClientRect(); return [r.width, r.height]; }));
  ok('stelle e voci di stato >= 44 px', sizes.length === 8 && sizes.every(([w, h]) => w >= 43.5 && h >= 43.5), JSON.stringify(sizes));
  ok('linea della voce scelta: 3 px', await p.evaluate(() => getComputedStyle(document.querySelector('.seg-ink')).height) === '3px');
  await p.emulateMedia({ reducedMotion: 'reduce' });
  ok('movimento ridotto: linea ferma', await p.evaluate(() => getComputedStyle(document.querySelector('.seg-ink')).transitionDuration) === '0s');
  await p.keyboard.press('Escape'); await p.locator('[data-u="drop"]').click({ timeout: 700 }).catch(() => {}); await p.waitForSelector('.sheet', { state: 'detached' });
  await openBook(p, 'v2');
  ok('Da leggere: Il voto, quando vuoi', await txt(p, '#f-verdict') === 'Il voto, quando vuoi');
  await p.close2();
}

async function pagina(browser) {
  const p = await newPage(browser);
  const base = { added: 1, rating: 0 };
  await load(p, [
    { ...base, id: 'f7', title: 'Sette', author: 'A', status: 'in-lettura', started: '2026-10-12', page: 142, pages: 337 },
    { ...base, id: 'f12', title: 'Dodici', author: 'A', status: 'in-lettura', started: '2026-10-20', page: 330, pages: 337, pageStep: 25 },
    { ...base, id: 'f13', title: 'Tredici', author: 'A', status: 'in-lettura', started: '2026-10-20', page: 50 },
    { ...base, id: 'f1', title: 'Uno', author: 'A', status: 'letto', finished: '2025-04-02', pages: 300 },
  ]);
  const val = sel => p.locator(sel).inputValue();
  const close = async () => { await p.keyboard.press('Escape'); await p.locator('[data-u="drop"]').click({ timeout: 700 }).catch(() => {}); await p.waitForSelector('.sheet', { state: 'detached' }); };
  await openBook(p, 'f7'); await p.waitForTimeout(400);
  ok('ritmo nella scheda', await txt(p, '#f-psub') === '18º giorno di lettura, circa 8 pagine al giorno: a questo ritmo lo finisci verso il 23 novembre.' && await txt(p, '#f-pof') === 'di 337 · 42%' && await val('#f-range') === '142', await txt(p, '#f-psub') + '|' + await txt(p, '#f-pof'));
  ok('+N nascosto senza salto ricordato', !(await vis(p, '#f-pstep')));
  await p.click('#f-p10');
  ok('+10: pagina, cursore e stima', await val('#f-page') === '152' && await val('#f-range') === '152' && /verso il 20 novembre/.test(await txt(p, '#f-psub')), await txt(p, '#f-psub'));
  ok('niente salvataggio senza Salva', (await localBooks(p)).find(b => b.id === 'f7').page === 142);
  await p.keyboard.press('Escape');
  ok('Esc dopo +10: modifiche non salvate', await vis(p, '.unsaved'));
  await p.locator('[data-u="back"]').click();
  await p.fill('#f-range', '200');
  ok('il cursore muove la pagina', await val('#f-page') === '200');
  await p.click('#f-p10');
  await p.locator('details.edit summary').click(); await p.fill('#d-pages', '400');
  ok('cambiare le pagine totali non riporta la pagina indietro', await val('#f-page') === '210', await val('#f-page'));
  await p.fill('#d-pages', '');
  ok('senza pagine totali: testo no-pages', await txt(p, '#f-psub') === '18º giorno di lettura. Aggiungi le pagine totali in «Modifica i dati del libro» per sapere quando lo finisci.', await txt(p, '#f-psub'));
  await close();
  await openBook(p, 'f12'); await p.waitForTimeout(300);
  const ps = p.locator('#f-pstep');
  ok('+N col salto ricordato', await ps.innerText() === '+25' && /^Aggiungi 25 pagine a /.test(await ps.getAttribute('aria-label')));
  await ps.click(); ok('+N limitato al totale', await val('#f-page') === '337');
  await p.click('#f-p10'); ok('+10 limitato al totale', await val('#f-page') === '337');
  await close();
  await openBook(p, 'f13'); await p.waitForTimeout(300);
  ok('senza totale: niente cursore, di ?', !(await vis(p, '#f-range')) && await txt(p, '#f-pof') === 'di ?');
  await p.click('#f-p10');
  ok('senza totale: +10 libero', await val('#f-page') === '60' && /no|giorno/.test(await txt(p, '#f-psub')), await txt(p, '#f-psub'));
  await close();
  await openBook(p, 'f1');
  ok('Letto: blocco pagina nascosto, campo readonly', !(await vis(p, '#f-pblk')) && await p.locator('#f-page').evaluate(e => e.readOnly));
  ok('pagina: nessun errore in console', !p.errs.length, p.errs.join());
  await p.close2();
}

export default async function ({ browser }) {
  await puri(browser);
  await struttura(browser);
  await aspetto(browser);
  await frase(browser);
  await voto(browser);
  await pagina(browser);
}
