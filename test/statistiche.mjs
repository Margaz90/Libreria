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
  ok('autori: libri di Stephen King dal più recente', S.authors[0].books.map(b => b.id).join() === 'Cinque,Sei');
  const dim = (b) => p.evaluate(x => window.libreriaStats.dim(x), b);
  ok('dorso senza pagine: 20 unità, 5.88%, 92 px', J(await dim({})) === J({ u: 20, w: '5.88%', h: 92 }));
  ok('dorso 100 pagine: larghezza minima, 88 px', J(await dim({ pages: 100 })) === J({ u: 20, w: '5.88%', h: 88 }));
  ok('dorso 900 pagine: 44 unità, 12.94%, 116 px', J(await dim({ pages: 900 })) === J({ u: 44, w: '12.94%', h: 116 }));
  const rows = (books) => p.evaluate(x => window.libreriaStats.rows(x).map(r => r.length), books);
  ok('file: 15 libri da 900 pagine → 6, 6, 3', J(await rows(Array(15).fill({ pages: 900 }))) === J([6, 6, 3]));
  ok('file: 15 libri senza pagine → una fila', J(await rows(Array(15).fill({}))) === J([15]));
  ok('file: nessun libro → nessuna fila', J(await rows([])) === J([]));
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
  ok('pulsanti racconto 2025 e 2024 nelle loro mensole', (await p.$$eval('section.ys button.story-btn', els => els.map(e => e.closest('section.ys').dataset.year + '=' + e.dataset.story).join())) === '2025=2025,2024=2024' && !(await p.locator('section.ys[data-year="2019"] .story-btn').count()));
  const panels = await p.$$eval('[data-panel]', els => els.map(e => e.dataset.panel).join());
  ok('anni precedenti nascosti dietro il pulsante', await p.locator('#ys-more').isVisible() && !(await p.locator('section.ys[data-year="2019"]').isVisible()) && await p.locator('section.ys[data-year="2025"]').isVisible());
  ok('blocchi di Sempre presenti', panels === 'autori,tempo,mesi,voti,generi', panels);
  ok('incipit con i dati di prova', (await txt('.stats-lede')).replace(/\s+/g, ' ').trim() === 'Hai letto 8 libri, 2850 pagine in tutto. Il mese in cui finisci più libri è agosto.', await txt('.stats-lede'));
  ok('tempo: 40 giorni in media', /\b40\b/.test(await txt('[data-panel="tempo"]')));
  ok('voti: 7 libri votati, media 3,4', /7 libri votati · media 3,4/.test(await txt('[data-panel="voti"]')));
  ok('voti: cinque stelle a Uno e Tre, 1 senza voto', /Cinque stelle a Uno e Tre\.\s*1 libro senza voto\./.test(await txt('[data-panel="voti"]')), await txt('[data-panel="voti"]'));
  ok('mesi: leggi di più ad agosto', /Leggi di più ad agosto: 3 libri\./.test(await txt('[data-panel="mesi"]')));
  ok('autori: Stephen King con 2 mini-dorsi nascosti a VoiceOver', await p.$eval('[data-panel="autori"] li', li => li.textContent.includes('Stephen King') && li.querySelectorAll('.mini i').length === 2 && li.querySelector('.mini').getAttribute('aria-hidden') === 'true'));
  ok('mensole 2025, 2024, 2019', (await p.$$eval('section.ys', els => els.map(e => e.dataset.year).join())) === '2025,2024,2019');
  ok('nota: 1 senza anno, 1 con la data di fine nel futuro', /1 libro letto senza anno\./.test(await txt('.stats-noyear')) && /data di fine nel futuro/.test(await txt('.stats-future')));
  ok('stelle dei voti leggibili da VoiceOver', (await p.locator('[data-panel="voti"] [role="img"][aria-label="5 stelle"]').count()) === 1);
  ok('barre con il numero accanto (Generi: Thriller 3)', /Thriller\s*3/.test(await txt('[data-panel="generi"]')));
  await p.close2();

  p = await statsPage(browser, FIXTURE.filter(b => b.status !== 'letto'));
  ok('libreria senza letti: messaggio', (await p.locator('.stats-empty').innerText().catch(() => '')).trim() === 'Quando segnerai un libro come Letto, qui compariranno le tue statistiche' && !(await p.locator('[data-panel], .stats-title, .stats-lede, section.ys').count()));
  await p.close2();

  p = await statsPage(browser, FIXTURE.filter(b => b.status === 'letto').map(({ started, finished, finishedYear, ...b }) => b));
  ok('senza date: Mesi e Tempo spiegano cosa serve', !!(await p.locator('[data-panel="mesi"] .hint').count()) && !!(await p.locator('[data-panel="tempo"] .hint').count()) && !(await p.locator('[data-panel="mesi"] .months').count()) && !(await p.locator('section.ys').count()));
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
    if (width === 1366) {
      ok(`${tag}: mensole a sinistra e Sempre a destra`, await p.evaluate(() => { const a = document.querySelector('.stats-years').getBoundingClientRect(), b = document.querySelector('.sempre').getBoundingClientRect(); return a.right <= b.left && Math.abs(a.top - b.top) < 4; }));
      ok(`${tag}: Tempo e Mesi affiancati, Autori a tutta larghezza`, await p.evaluate(() => { const r = s => document.querySelector(`[data-panel="${s}"]`).getBoundingClientRect(); return Math.abs(r('mesi').top - r('tempo').top) < 4 && r('autori').width > r('tempo').width * 1.8; }));
      ok(`${tag}: file da 167 px`, await p.$eval('.ys-row', e => e.getBoundingClientRect().height >= 167));
    }
    ok(`${tag}: nessun errore in console`, !p.errs.length, p.errs.join(' / '));
    await p.close2();
  }
}

async function mensole(browser) {
  let p = await statsPage(browser, FIXTURE);
  const txt = sel => p.locator(sel).first().innerText({ timeout: 2000 }).catch(() => '');
  ok('etichetta della mensola 2025', (await p.getAttribute('section.ys[data-year="2025"] .ys-shelf', 'aria-label')) === '2025: 3 libri, 800 pagine');
  ok('tre dorsi toccabili «Titolo, Autore» nel 2025', (await p.$$eval('section.ys[data-year="2025"] button.spine[data-id]', els => els.map(e => e.getAttribute('aria-label')).join('|'))) === 'Due, Don Winslow|Uno, Don Winslow|Sette, Bad Dates', await p.$$eval('section.ys[data-year="2025"] button.spine[data-id]', els => els.map(e => e.getAttribute('aria-label')).join('|')));
  ok('riga del 2025', /Autore dell'anno Don Winslow\. Genere Thriller\. Il preferito: Uno, cinque stelle\./.test(await txt('section.ys[data-year="2025"] .ys-d')));
  ok('riga dei numeri del 2025', /3 libri, 800 pagine,\s*★?\s*voto medio\s*3,7/.test(await txt('section.ys[data-year="2025"] .ys-m')), await txt('section.ys[data-year="2025"] .ys-m'));
  ok('nessuna riga dell\'anno nel 2019 (1 libro)', !(await p.locator('section.ys[data-year="2019"] .ys-d').count()));
  ok('segnalibro sulla mensola con il racconto', await p.locator('section.ys[data-year="2025"] .ys-shelf.ribbon').count() === 1 && !(await p.locator('section.ys[data-year="2019"] .ribbon').count()));
  ok('pulsante «Il racconto» alto almeno 44 px', (await p.locator('.story-btn').first().boundingBox()).height >= 44);
  await p.locator('section.ys[data-year="2025"] [data-id="Due"]').click();
  ok('tocco su un dorso: si apre la scheda di «Due»', await p.locator('.sheet').isVisible() && /Due/.test(await p.locator('.sheet').innerText()));
  await p.fill('#f-started', '2024-08-20'); await p.fill('#f-finished', '2024-08-22'); await save(p);
  ok('«Due» passa sulla mensola del 2024 senza ricaricare', await p.locator('section.ys[data-year="2024"] [data-id="Due"]').count() === 1 && !(await p.locator('section.ys[data-year="2025"] [data-id="Due"]').count()));
  ok('2024 era tra gli anni precedenti: ora aperti', await p.locator('#ys-old').isVisible() && await p.locator('#ys-more').getAttribute('aria-expanded') === 'true');
  ok('dopo il salvataggio il focus torna sul dorso', await p.evaluate(() => document.activeElement?.dataset?.id) === 'Due');
  const lp = p.locator('section.ys[data-year="2019"] [data-id="Cinque"]');
  await lp.dispatchEvent('pointerdown', { clientX: 5, clientY: 5 }); await p.waitForTimeout(700);
  await p.locator('.quick [data-st="da-leggere"]').click(); await p.waitForTimeout(500);
  ok('unico libro dell\'anno tolto: niente mensola 2019, focus sul titolo', !(await p.locator('section.ys[data-year="2019"]').count()) && await p.evaluate(() => document.activeElement?.classList.contains('stats-title')));
  ok('mensole: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();

  const B = (id, extra) => ({ id, title: id, author: 'A', status: 'letto', finished: '2025-05-05', added: 1, rating: 0, ...extra });
  p = await statsPage(browser, [B('P0', { finished: '2025-05-03' }), B('P100', { pages: 100, finished: '2025-05-02' }), B('P900', { pages: 900, finished: '2025-05-01' })]);
  const wd = id => p.locator(`section.ys .spine[data-id="${id}"]`).boundingBox().then(b => b.width);
  const w0 = await wd('P0'), w100 = await wd('P100'), w900 = await wd('P900');
  ok('larghezze: 0 e 100 pagine uguali (minima), 900 la più larga', Math.abs(w0 - w100) < 0.5 && w900 > w0, `${w0} ${w100} ${w900}`);
  await p.close2();

  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  p = await statsPage(browser, [B('Foto', { spine: PNG, spineRatio: 0.5, pages: 300 })]);
  const sw = await p.$eval('section.ys .spine', e => e.style.width);
  ok('foto del dorso: larghezza percentuale, non spineRatio', /%$/.test(sw), sw);
  await p.close2();

  p = await statsPage(browser, Array.from({ length: 20 }, (_, i) => B('G' + i, { pages: 900, finished: `2025-05-${String(i + 1).padStart(2, '0')}` })), undefined, { width: 320, height: 700 });
  const rc = await p.locator('section.ys .ys-row').count();
  ok('mensola piena a 320 px: file da 6 dorsi e niente scorrimento laterale', rc === 3 && await noHScroll(p), String(rc));
  await p.close2();

  p = await statsPage(browser, [B('H', { title: '<i>T&amp;</i>', author: '<b>A</b>' })]);
  ok('dorso con HTML nel titolo: solo testo', !(await p.locator('section.ys .spine i i, section.ys .spine b').count()));
  await p.close2();
}

async function paginazione(browser) {
  const L = (id, y, d) => ({ id, title: id, author: 'A', status: 'letto', finished: `${y}-${d}`, pages: 200, added: 1, rating: 0 });
  const books = [...Array.from({ length: 32 }, (_, i) => L('L' + i, 2025, `05-${String(i % 28 + 1).padStart(2, '0')}`)), L('Vecchio', 2024, '03-03')];
  let p = await statsPage(browser, books);
  const txt = sel => p.locator(sel).first().innerText({ timeout: 2000 }).catch(() => '');
  const n = () => p.locator('section.ys[data-year="2025"] .spine').count();
  ok('32 libri: 15 dorsi e «15 di 32»', await n() === 15 && /15 di 32/.test(await txt('section.ys[data-year="2025"] .pager')));
  const y24a = await p.$('section.ys[data-year="2024"]');
  await p.click('section.ys[data-year="2025"] [data-more]');
  ok('la mensola del 2024 non è stata ridisegnata', await y24a.evaluate(e => e.isConnected));
  ok('Mostra altri: 30 dorsi, il pulsante dice «Mostra altri 2»', await n() === 30 && (await txt('section.ys[data-year="2025"] [data-more]')) === 'Mostra altri 2');
  ok('focus sul nuovo «Mostra altri»', await p.evaluate(() => document.activeElement?.dataset?.more) === 'y2025');
  // un dorso della seconda pagina: cambio il voto e salvo
  await p.locator('section.ys[data-year="2025"] .spine').nth(20).click(); await p.waitForSelector('.sheet');
  await p.locator('.rate button[data-n="4"]').click(); await save(p);
  ok('dopo un salvataggio restano 30 dorsi', await n() === 30);
  const y24 = await p.$('section.ys[data-year="2024"]');
  await p.click('section.ys[data-year="2025"] [data-more]');
  ok('32 dorsi e solo «Nascondi»', await n() === 32 && !(await p.locator('section.ys[data-year="2025"] [data-more]').count()) && await p.locator('section.ys[data-year="2025"] [data-less]').count() === 1);
  ok('la mensola del 2024 non è stata ridisegnata', await y24.evaluate(e => e.isConnected));
  await p.click('section.ys[data-year="2025"] [data-less]');
  ok('Nascondi: di nuovo 15', await n() === 15);
  ok('paginazione: niente scorrimento orizzontale', await noHScroll(p));
  ok('pulsanti di paginazione delle Statistiche alti almeno 44 px', (await p.locator('section.ys .pager-btn').first().boundingBox()).height >= 44);
  ok('paginazione: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();

  p = await newPage(browser);
  await load(p, Array.from({ length: 16 }, (_, i) => ({ id: 'D' + i, title: 'D' + i, author: 'A', status: 'da-leggere', added: i + 1, rating: 0 })));
  ok('pulsanti di paginazione degli scaffali alti almeno 44 px', (await p.locator('#main .pager-btn').first().boundingBox()).height >= 44);
  await p.close2();
}

async function incipit(browser) {
  const A = (id, author, rating, pages, finished) => ({ id, title: id, author, rating, pages, finished, status: 'letto', added: 1 });
  const lede = async (books) => { const p = await statsPage(browser, books); const x = (await p.locator('.stats-lede').innerText()).replace(/\s+/g, ' ').trim(); return [p, x]; };
  let [p, l] = await lede([A('A1', 'X', 5, 100, '2025-03-01'), A('A2', 'X', 5, 200, '2025-03-20'), A('A3', 'Y', 4, 300, '2025-07-01')]);
  ok('incipit completo', l === "Hai letto 3 libri, 600 pagine in tutto. Il voto che dai più spesso è cinque stelle, a 2 libri; l'autore che torna di più è X, con 2 titoli. Il mese in cui finisci più libri è marzo.", l);
  await p.close2();
  [p, l] = await lede([A('U', 'Z', 0, 0)]);
  ok('incipit: un libro senza pagine né voto', l === 'Hai letto un libro.', l);
  await p.close2();
  [p, l] = await lede([A('U', 'Z', 0, 320, '2025-01-01')]);
  ok('incipit: un libro con pagine', l === 'Hai letto un libro, 320 pagine.', l);
  await p.close2();
  [p, l] = await lede([{ ...A('T1', '<b>Tom & "Jerry"</b>', 0, 0), title: 'x' }, { ...A('T2', '<b>Tom & "Jerry"</b>', 0, 0), title: 'y' }]);
  ok('incipit e autori: nomi con HTML restano testo', !(await p.locator('.stats-lede b b, [data-panel="autori"] li b b').count()) && l.includes('<b>Tom & "Jerry"</b>'), l);
  await p.close2();
}

async function racconto(browser) {
  let p = await statsPage(browser, FIXTURE);
  const cur = () => p.$eval('#story .slide:not([hidden])', e => e.dataset.s).catch(() => '');
  const open = async y => { const sb = p.locator(`button.story-btn[data-story="${y}"]`); if (!(await sb.isVisible())) await p.locator('#ys-more').click(); await sb.click(); await p.waitForSelector('#story[role="dialog"][aria-modal="true"]', { timeout: 3000 }); };
  await open(2025);
  const ids = await p.$$eval('#story .slide', els => els.map(e => e.dataset.s).join());
  ok('2025: 9 schermate', ids === 'copertina,numeri,mese,tempo,autore,genere,preferito,voti,chiusura', ids);
  ok('una schermata visibile alla volta', (await p.locator('#story .slide:not([hidden])').count()) === 1);
  ok('palco con 3 dorsi, nascosto a VoiceOver', await p.locator('#story .story-stage .spine').count() === 3 && (await p.getAttribute('#story .story-stage', 'aria-hidden')) === 'true');
  ok('navigazione in basso visibile con «1 di 9»', await p.locator('#story .story-nav').isVisible() && (await p.locator('#story .story-count').innerText()) === '1 di 9');
  ok('frecce del racconto da 48 px', (await p.locator('#story .story-next').boundingBox()).height >= 48);
  ok('copertina: «Hai messo sullo scaffale 3 libri.»', /Hai messo sullo scaffale 3 libri\./.test(await p.locator('#story .slide[data-s="copertina"]').innerText()));
  const c0 = await cur();
  await p.keyboard.press('ArrowRight'); const c1 = await cur();
  const live = await p.locator('#story .story-live').innerText().catch(() => '');
  ok('cambio di schermata annunciato a VoiceOver', (await p.getAttribute('#story .story-live', 'aria-live').catch(() => null)) === 'polite' && /2 di 9/.test(live), live);
  await p.locator('#story .story-next').dispatchEvent('click'); const c2 = await cur(); // sul telefono le frecce sono nascoste
  await p.keyboard.press('ArrowLeft'); const c3 = await cur();
  for (let k = 0; k < 5; k++) await p.keyboard.press('ArrowRight'); // da «numeri» a «preferito»
  ok('nel «preferito» il dorso del preferito esce', (await cur()) === 'preferito' && await p.locator('#story .story-stage [data-best].out').count() === 1);
  await p.keyboard.press('ArrowRight');
  ok('lasciando il «preferito» rientra', !(await p.locator('#story .story-stage .out').count()));
  for (let k = 0; k < 6; k++) await p.keyboard.press('ArrowLeft');
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
  ok('chiusura senza griglia delle copertine', !(await p.locator('#story .story-covers').count()));
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

  p = await statsPage(browser, FIXTURE);
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.locator('button.story-btn[data-story="2025"]').click(); await p.waitForSelector('#story');
  ok('movimento ridotto: nessuna animazione né transizione sui dorsi', await p.$$eval('#story .story-stage .spine', els => els.length > 0 && els.every(e => { const c = getComputedStyle(e); return c.animationName === 'none' && parseFloat(c.transitionDuration) === 0; })));
  await p.close2();

  const S6 = (id, extra) => ({ id, title: id, author: 'A', status: 'letto', pages: 900, rating: 0, added: 1, ...extra });
  p = await statsPage(browser, [1, 2, 3, 4, 5].map(i => S6('S' + i, { finished: `2025-0${7 - i}-10` })).concat([S6('Best', { rating: 5, finished: '2025-01-10' })]));
  await p.locator('button.story-btn[data-story="2025"]').click(); await p.waitForSelector('#story');
  ok('preferito oltre le 170 unità: è sul palco al posto dell\'ultimo', await p.locator('#story .story-stage .spine').count() === 3 && await p.locator('#story .story-stage [data-best]').count() === 1);
  await p.close2();

  // Il focus resta nel racconto anche quando il pulsante che lo aveva si disattiva o sparisce (computer, frecce visibili)
  p = await statsPage(browser, FIXTURE, undefined, { width: 1366, height: 860 });
  await p.locator('button.story-btn[data-story="2025"]').click(); await p.waitForSelector('#story');
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
  ok('racconti rolling al 2027-01-05: 2026 e 2025', (await p.$$eval('button.story-btn', els => els.map(e => e.dataset.story).join())) === '2026,2025');
  await p.close2();
}

export default async function ({ browser }) {
  await scheda(browser);
  await calcoli(browser);
  await pagina(browser);
  await incipit(browser);
  await mensole(browser);
  await paginazione(browser);
  await racconto(browser);
}
