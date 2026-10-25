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
    { ...base, id: 's5', title: 'Ripreso', author: 'E', status: 'da-leggere', finishedYear: 2019, pages: 100 },
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

  let warned = true;
  for (const v of ['12', '2099']) {
    await openBook(p, 's6');
    if (await shown()) await p.fill('#f-year', v);
    await p.locator('#s-save').click(); await p.waitForTimeout(300);
    const msg = await p.locator('#f-year-err').innerText({ timeout: 1000 }).catch(() => '');
    warned = warned && await p.locator('#s-save').isVisible() && /1900/.test(msg) && (await p.getAttribute('#f-year', 'aria-invalid')) === 'true';
    if (await p.locator('#s-save').isVisible()) { await p.fill('#f-year', ''); await save(p); }
  }
  b = await book(p, 's6');
  ok('anno non valido: avviso, la scheda resta aperta e non si salva', warned && b.finishedYear === undefined && !b.finished, JSON.stringify(b));

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

  // Riletto: rimesso In lettura dal menu rapido perde l'anno vecchio, e «Finito» mette la data di oggi
  await p.locator('#main [data-id="s5"]').first().dispatchEvent('pointerdown', { clientX: 5, clientY: 5 });
  await p.waitForTimeout(700);
  await p.locator('.quick [data-st="in-lettura"]').click(); await p.waitForTimeout(800);
  const reread = await book(p, 's5');
  await p.locator('[data-finish="s5"]').first().click(); await p.waitForTimeout(800);
  b = await book(p, 's5');
  ok('riletto: In lettura toglie l\'anno vecchio e Finito mette la data di oggi', reread.finishedYear === undefined && b.finished === isoToday(), JSON.stringify([reread, b]));

  ok('scheda: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

// Libri di prova con risultati noti (vedi il piano): tutti letti salvo Otto e Nove.
export const FIXTURE = [
  { id: 'Uno', title: 'Uno', author: 'Don Winslow', genre: 'Thriller', pages: 400, rating: 5, started: '2025-07-01', finished: '2025-08-10' },
  { id: 'Due', title: 'Due', author: 'Don Winslow', genre: 'Thriller', pages: 300, rating: 4, started: '2025-08-20', finished: '2025-08-22' },
  { id: 'Tre', title: 'Tre', author: 'Mick Herron', genre: 'Thriller', pages: 350, rating: 5, started: '2024-01-01', finished: '2024-03-15' },
  { id: 'Quattro', title: 'Quattro', author: 'Mick Herron', genre: 'Narrativa', pages: 200, rating: 3, finished: '2024-08-05' },
  { id: 'Cinque', title: 'Cinque', author: 'Stephen King', genre: 'Narrativa', pages: 900, rating: 0, finishedYear: 2019 },
  { id: 'Sei', title: 'Sei', author: 'Stephen King', genre: 'Horror', pages: 500, rating: 4 },
  { id: 'Sette', title: 'Sette', author: 'Bad Dates', genre: 'Saggi', pages: 100, rating: 2, started: '2025-05-10', finished: '2025-05-01' },
  { id: 'Dieci', title: 'Dieci', author: 'Futuro', genre: 'Saggi', pages: 100, rating: 1, started: '2027-01-01', finished: '2027-01-10' },
].map(b => ({ ...b, status: 'letto', added: 1 })).concat([
  { id: 'Otto', title: 'Otto', status: 'in-lettura', added: 1, rating: 0 },
  { id: 'Nove', title: 'Nove', status: 'da-leggere', added: 1, rating: 0 },
]);

async function calcoli(browser) {
  const p = await newPage(browser);
  await p.goto(APP + '/'); await p.waitForTimeout(200);
  const compute = (books, day) => p.evaluate(([b, d]) => window.libreriaStats.compute(b, new Date(d)), [books, day]);
  const s = await compute(FIXTURE, '2026-10-25T12:00:00');
  const S = s.sempre, J = JSON.stringify;
  ok('sempre: 8 letti, 2850 pagine', S.read === 8 && S.pages === 2850, `${S.read} ${S.pages}`);
  ok('sempre: voto medio 3,43 e 1 senza voto', Math.abs(S.avgRating - 24 / 7) < 1e-3 && S.unrated === 1, `${S.avgRating} ${S.unrated}`);
  ok('voti per stelle', J(S.ratings) === J({ 1: 1, 2: 1, 3: 1, 4: 2, 5: 2 }), J(S.ratings));
  ok('5 stelle dal più recente: Uno, Tre', S.fiveStars.map(b => b.id).join() === 'Uno,Tre');
  ok('giorni: 3 libri, media 40, più veloce Due (3), più lento Tre (75)',
    S.days && S.days.count === 3 && S.days.avg === 40 && S.days.fastest.book.id === 'Due' && S.days.fastest.days === 3 && S.days.slowest.book.id === 'Tre' && S.days.slowest.days === 75, J(S.days && { ...S.days, fastest: S.days.fastest.days, slowest: S.days.slowest.days }));
  ok('mesi: marzo 1, maggio 1, agosto 3', J(S.months) === J([0, 0, 1, 0, 1, 0, 0, 3, 0, 0, 0, 0]) && S.monthsCount === 5, J(S.months));
  ok('autori in ordine: King, Winslow, Herron, Bad Dates, Futuro', S.authors.map(a => a.name).join() === 'Stephen King,Don Winslow,Mick Herron,Bad Dates,Futuro', S.authors.map(a => a.name).join());
  ok('autori: libri, pagine e voto medio', J(S.authors.slice(0, 3).map(a => [a.count, a.pages, a.avgRating])) === J([[2, 1400, 4], [2, 700, 4.5], [2, 550, 4]]), J(S.authors.slice(0, 3)));
  ok('generi: Thriller 3, Narrativa 2, Saggi 2, Horror 1', S.genres.map(g => g.name + g.count).join() === 'Thriller3,Narrativa2,Saggi2,Horror1', S.genres.map(g => g.name + g.count).join());
  const [a25, a24, a19] = s.anni;
  ok('anni: 2025, 2024, 2019', s.anni.map(a => a.year).join() === '2025,2024,2019', s.anni.map(a => a.year).join());
  ok('2025: 3 libri, 800 pp, voto 3,67, maggio 1 e agosto 2', a25.count === 3 && a25.pages === 800 && Math.abs(a25.avgRating - 11 / 3) < 1e-3 && a25.months[4] === 1 && a25.months[7] === 2, J(a25));
  ok('2025: autore Don Winslow (2), genere Thriller (2), preferito Uno', a25.topAuthor.name === 'Don Winslow' && a25.topAuthor.count === 2 && a25.topGenre.name === 'Thriller' && a25.topGenre.count === 2 && a25.best.id === 'Uno');
  ok('2024: 2 libri, 550 pp, voto 4, genere Narrativa (più recente a parità), preferito Tre', a24.count === 2 && a24.pages === 550 && a24.avgRating === 4 && a24.topGenre.name === 'Narrativa' && a24.best.id === 'Tre', J(a24));
  ok('2019 (solo anno): 1 libro, 900 pp, senza voto né preferito', a19.count === 1 && a19.pages === 900 && a19.avgRating === null && a19.best === null && J(a19.months) === J(Array(12).fill(0)), J(a19));
  ok('1 libro letto senza anno e 1 con la data nel futuro', s.noYear === 1 && s.future === 1, `${s.noYear} ${s.future}`);
  ok('racconti: 2025 e 2024', J(s.racconti) === J([2025, 2024]), J(s.racconti));
  ok('racconti con oggi 1/6/2025: solo 2024', J((await compute(FIXTURE, '2025-06-01T12:00:00')).racconti) === J([2024]));
  const m = await compute([{ status: 'letto', title: 'X' }], '2026-10-25T12:00:00');
  ok('libro senza dati: nessun NaN né voce vuota', m.sempre.read === 1 && m.sempre.pages === 0 && m.sempre.avgRating === null && m.sempre.days === null && !m.sempre.authors.length && !m.sempre.genres.length && m.noYear === 1, J(m.sempre));
  ok('calcoli: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

// Apre la sezione Statistiche con i libri dati e l'orologio fermo al giorno indicato.
async function statsPage(browser, books, day = '2026-10-25T12:00:00', opts = {}) {
  const p = await newPage(browser, opts);
  await p.clock.setFixedTime(new Date(day));
  await load(p, books);
  await p.locator('[data-view="stats"]:visible').first().click();
  await p.waitForSelector('#main .stats');
  return p;
}
// Confronto con la larghezza impostata: sul telefono simulato Chromium allarga innerWidth quando la pagina deborda.
const noHScroll = p => p.evaluate(w => document.documentElement.scrollWidth <= w && innerWidth <= w, p.viewportSize().width);

async function pagina(browser) {
  let p = await statsPage(browser, FIXTURE);
  const txt = sel => p.locator(sel).first().innerText({ timeout: 2000 }).catch(() => '');
  ok('due schede racconto 2025 e 2024', (await p.$$eval('button.story-card', els => els.map(e => e.dataset.story).join())) === '2025,2024');
  const panels = await p.$$eval('[data-panel]', els => els.map(e => e.dataset.panel).join());
  ok('pannelli di Sempre presenti', panels === 'sintesi,voti,tempo,mesi,autori,generi', panels);
  const sint = await txt('[data-panel="sintesi"]');
  ok('sintesi mostra 8 libri e 40 giorni', /\b8\b[\s\S]*libri letti/.test(sint) && /\b40\b[\s\S]*giorni/.test(sint), sint.replace(/\n/g, ' '));
  ok('anni 2025, 2024, 2019, il primo aperto', (await p.$$eval('details.year', els => els.map(e => e.dataset.year + (e.open ? '*' : '')).join())) === '2025*,2024,2019');
  ok('nota: 1 senza anno, 1 con la data di fine nel futuro', /1 libro letto non ha un anno/.test(await txt('.stats-noyear')) && /data di fine nel futuro/.test(await txt('.stats-future')));
  ok('stelle dei voti leggibili da VoiceOver', (await p.locator('[data-panel="voti"] [role="img"][aria-label="5 stelle"]').count()) === 1);
  ok('barre con il numero accanto (Generi: Thriller 3)', /Thriller\s*3/.test(await txt('[data-panel="generi"]')));
  await p.close2();

  p = await statsPage(browser, FIXTURE.filter(b => b.status !== 'letto'));
  ok('libreria senza letti: messaggio', (await p.locator('.stats-empty').innerText().catch(() => '')).trim() === 'Quando segnerai un libro come Letto, qui compariranno le tue statistiche' && !(await p.locator('[data-panel]').count()));
  await p.close2();

  p = await statsPage(browser, FIXTURE.filter(b => b.status === 'letto').map(({ started, finished, finishedYear, ...b }) => b));
  ok('senza date: Mesi e Tempo spiegano cosa serve', !!(await p.locator('[data-panel="mesi"] .hint').count()) && !!(await p.locator('[data-panel="tempo"] .hint').count()) && !(await p.locator('[data-panel="mesi"] .months').count()) && !(await p.locator('details.year').count()));
  await p.close2();

  p = await statsPage(browser, [...FIXTURE, { id: 'Lungo', title: 'T'.repeat(150), author: 'Autore '.repeat(18), genre: 'Genere'.repeat(20), pages: 100, rating: 5, status: 'letto', finished: '2025-09-01', added: 1 }]);
  ok('titoli lunghi: niente scorrimento orizzontale', await noHScroll(p));
  await p.close2();

  for (const [width, height] of [[390, 844], [1366, 860]]) for (const dark of [false, true]) {
    const tag = `pagina ${width}px ${dark ? 'scuro' : 'chiaro'}`;
    p = await statsPage(browser, FIXTURE, undefined, { width, height, dark });
    await p.waitForTimeout(600);
    await p.screenshot({ path: `/tmp/statistiche-${width}-${dark ? 'scuro' : 'chiaro'}.png`, fullPage: true });
    ok(`${tag}: niente scorrimento orizzontale`, await noHScroll(p));
    ok(`${tag}: nessun errore in console`, !p.errs.length, p.errs.join(' / '));
    await p.close2();
  }
}

async function racconto(browser) {
  let p = await statsPage(browser, FIXTURE);
  const cur = () => p.$eval('#story .slide:not([hidden])', e => e.dataset.s).catch(() => '');
  const open = async y => { await p.locator(`button.story-card[data-story="${y}"]`).click(); await p.waitForSelector('#story[role="dialog"][aria-modal="true"]', { timeout: 3000 }); };
  await open(2025);
  const ids = await p.$$eval('#story .slide', els => els.map(e => e.dataset.s).join());
  ok('2025: 9 schermate', ids === 'copertina,numeri,mese,tempo,autore,genere,preferito,voti,chiusura', ids);
  ok('una schermata visibile alla volta', (await p.locator('#story .slide:not([hidden])').count()) === 1);
  const c0 = await cur();
  await p.keyboard.press('ArrowRight'); const c1 = await cur();
  const live = await p.locator('#story .story-live').innerText().catch(() => '');
  ok('cambio di schermata annunciato a VoiceOver', (await p.getAttribute('#story .story-live', 'aria-live').catch(() => null)) === 'polite' && /2 di 9/.test(live), live);
  await p.locator('#story .story-next').dispatchEvent('click'); const c2 = await cur(); // sul telefono le frecce sono nascoste
  await p.keyboard.press('ArrowLeft'); const c3 = await cur();
  ok('avanti con → e con la freccia, indietro con ←', c0 === 'copertina' && c1 === 'numeri' && c2 === 'mese' && c3 === 'numeri', [c0, c1, c2, c3].join());
  ok('trattini accesi fino alla schermata corrente', (await p.locator('#story .story-bars i.on').count()) === 2);
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); const first = await cur();
  for (let i = 0; i < 12; i++) await p.keyboard.press('ArrowRight');
  const last = await cur();
  ok('oltre l\'ultima resta su chiusura, prima della prima resta su copertina', first === 'copertina' && last === 'chiusura', first + ' ' + last);
  const box = await p.locator('#story').boundingBox();
  await p.mouse.click(box.x + 20, box.y + box.height / 2); const tl = await cur();
  await p.mouse.click(box.x + box.width - 20, box.y + box.height / 2); const tr = await cur();
  ok('tocco a sinistra indietro, a destra avanti', tl === 'voti' && tr === 'chiusura', tl + ' ' + tr);
  ok('racconto: niente scorrimento a 390 px', await noHScroll(p));
  await p.waitForTimeout(300); await p.screenshot({ path: '/tmp/racconto-chiusura.png' });
  const font = await p.$eval('#story .story-done', e => { const c = getComputedStyle(e); return c.fontWeight + ' ' + c.fontSize; });
  ok('pulsante Chiudi in grassetto da 15 px', font === '600 15px', font);
  await p.keyboard.press('Escape');
  const esc1 = !(await p.locator('#story').count()) && (await p.evaluate(() => document.activeElement?.dataset?.story)) === '2025';
  await open(2024);
  const ids24 = await p.$$eval('#story .slide', els => els.map(e => e.dataset.s).join());
  ok('2024: versione ridotta, 3 schermate', ids24 === 'copertina,numeri,chiusura', ids24);
  await p.waitForTimeout(300); await p.screenshot({ path: '/tmp/racconto-copertina.png' });
  await p.locator('#story .story-close').click();
  const esc2 = !(await p.locator('#story').count()) && (await p.evaluate(() => document.activeElement?.dataset?.story)) === '2024';
  ok('Esc e ✕ chiudono e il focus torna alla scheda', esc1 && esc2, `${esc1} ${esc2}`);
  ok('racconto: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();

  // Il focus resta nel racconto anche quando il pulsante che lo aveva si disattiva o sparisce (computer, frecce visibili)
  p = await statsPage(browser, FIXTURE, undefined, { width: 1366, height: 860 });
  await p.locator('button.story-card[data-story="2025"]').click(); await p.waitForSelector('#story');
  await p.locator('#story .story-next').focus();
  for (let i = 0; i < 10; i++) await p.keyboard.press('Enter');
  const atLast = await p.$eval('#story .slide:not([hidden])', e => e.dataset.s);
  await p.keyboard.press('Tab');
  const in1 = await p.evaluate(() => !!document.activeElement.closest('#story'));
  await p.locator('#story .story-done').focus(); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Tab');
  const in2 = await p.evaluate(() => !!document.activeElement.closest('#story'));
  ok('il focus non esce dal racconto', atLast === 'chiusura' && in1 && in2, `${atLast} ${in1} ${in2}`);
  await p.close2();

  p = await statsPage(browser, [...FIXTURE, { id: 'V', title: 'Ventisei', author: 'X', status: 'letto', finished: '2026-11-02', added: 1, rating: 0 }], '2027-01-05T10:00:00');
  ok('racconti rolling al 2027-01-05: 2026 e 2025', (await p.$$eval('button.story-card', els => els.map(e => e.dataset.story).join())) === '2026,2025');
  await p.close2();
}

export default async function ({ browser }) {
  await scheda(browser);
  await calcoli(browser);
  await pagina(browser);
  await racconto(browser);
}
