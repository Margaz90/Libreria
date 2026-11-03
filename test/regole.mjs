// Funzioni pure provate da Node, senza browser (v79). Prende da app.js i tratti tra «// <regole>» e «// </regole>»
// (le funzioni restano dove sono: l'app non cambia) e li prova con molti casi, anche generati a caso.
import fs from 'node:fs';
import path from 'node:path';
import { ok, ROOT } from './lib.mjs';

const EXPORTS = ['STATUS_ONE', 'FIELDS', 'volNo', 'seriesKey', 'today', 'clean', 'lettura', 'tidy', 'norm', 'isbn13From10', 'isbn10From13', 'wdIsbn', 'parseIsbn',
  'computeStats', 'statDim', 'ysRows', 'MONTHS', 'num', 'nextInSeries', 'nextBooks', 'titleCore', 'sameTitle', 'isoOk', 'longDate', 'dayDiff', 'addDays', 'periodText', 'readingPace', 'paceText', 'linguaTesto', 'linguaDi', 'tramaMigliore'];

export function caricaRegole() {
  const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const parts = [...src.matchAll(/\/\/ <regole>\n([\s\S]*?)\n\s*\/\/ <\/regole>/g)].map(m => m[1]);
  const code = parts.join('\n');
  const fn = new Function('"use strict"; const window = {};\n' + code + `\nreturn { ${EXPORTS.join(', ')} };`);
  return { R: fn(), parts, code };
}

// Generatore pseudo-casuale con seme fisso: i casi sono sempre gli stessi a ogni giro.
const rng = seed => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (r, a) => a[Math.floor(r() * a.length)];

export default async function run() {
  let L;
  try { L = caricaRegole(); } catch (e) { ok('regole: i tratti segnati si caricano da soli', false, e.message); return; }
  const { R, parts, code } = L;
  ok('regole: tratti segnati trovati (10) e caricati senza browser', parts.length === 10, String(parts.length));
  ok('regole: nei tratti segnati niente pagina, stato dell\'app o memoria del dispositivo', !/\bdocument\b|\bstate\.|localStorage|\$\(|indexedDB|navigator\./.test(code));
  ok('regole: tutte le funzioni attese ci sono', EXPORTS.every(k => R[k] !== undefined), EXPORTS.filter(k => R[k] === undefined).join(', '));
  const { lettura, clean, tidy } = R, O = '2026-10-31';
  const j = JSON.stringify;

  // ---- Regole della lettura: invarianti su 2000 libri e passaggi generati a caso ----
  const r = rng(42), ST = ['da-leggere', 'in-lettura', 'letto', 'desiderato'];
  const DATES = [undefined, '2024-01-10', '2025-06-01', '2026-10-30', '2026-12-01'];
  const rand = () => { const b = { title: 'T', status: pick(r, ST) };
    for (const [k, vs] of [['started', DATES], ['finished', DATES], ['finishedYear', [undefined, 2019, 2026]], ['finishedAuto', [undefined, true]], ['pages', [undefined, 0, 250]], ['page', [undefined, 0, 40, 250]]]) { const v = pick(r, vs); if (v !== undefined) b[k] = v; }
    return b; };
  const inv = b => (b.status === 'letto' || (!b.finished && !b.finishedYear && !b.finishedAuto)) && !(b.finished && b.finishedYear) && (!b.finishedAuto || b.finished)
    && (b.status !== 'letto' || !(Number(b.pages) > 0) || b.page === undefined || b.page === Number(b.pages));
  let bad = [], idem = [], passBad = [];
  for (let i = 0; i < 2000; i++) {
    const b = rand(), s1 = lettura.sistema(b), st = pick(r, ST), p = lettura.passa(b, st, O);
    if (!inv(s1)) bad.push(b);
    if (j(lettura.sistema(s1)) !== j(s1)) idem.push(b);
    if (!inv(p) || p.status !== st) passBad.push([b, st, p]);
    if (st === 'letto' && b.status !== 'letto' && !b.finished && !b.finishedYear && !(p.finished === O && p.finishedAuto === true)) passBad.push([b, st, p, 'oggi']);
    if (st === 'letto' && Number(b.pages) > 0 && p.page !== Number(b.pages)) passBad.push([b, st, p, 'pagina']);
    if (st === 'in-lettura' && b.status === 'letto' && p.started !== O) passBad.push([b, st, p, 'rilettura']);
    if (st === 'in-lettura' && b.status !== 'letto' && b.status !== 'in-lettura' && b.started && p.started !== b.started) passBad.push([b, st, p, 'inizio']);
    if (st === b.status && (p.started !== b.started)) passBad.push([b, st, p, 'stesso stato']);
  }
  ok('lettura.sistema: 2000 libri a caso rispettano le regole', !bad.length, j(bad.slice(0, 2)));
  ok('lettura.sistema: applicarla due volte non cambia nulla', !idem.length, j(idem.slice(0, 2)));
  ok('lettura.passa: 2000 passaggi a caso con le regole decise (D2, D3, D4)', !passBad.length, j(passBad.slice(0, 2)));
  const canon = o => j(Object.keys(o).sort().map(k => [k, o[k]])); // stessi campi e valori, in qualunque ordine
  const tidyBad = []; for (let i = 0; i < 500; i++) { const b = rand(), t = tidy(b); if (!inv(t) || canon(tidy(t)) !== canon(t)) tidyBad.push(b); }
  ok('tidy: 500 libri a caso, sempre coerente e stabile', !tidyBad.length, j(tidyBad.slice(0, 2)));

  // ---- annoLetto = anno delle Statistiche, su 1000 libri a caso ----
  const books = Array.from({ length: 1000 }, (_, i) => ({ ...rand(), id: 'x' + i }));
  const st = R.computeStats(books, new Date('2026-10-31T12:00:00'));
  const inYear = new Map(); st.anni.forEach(a => a.books.forEach(b => inYear.set(b.id, a.year)));
  const diff = books.filter(b => (lettura.annoLetto(b, O) ?? undefined) !== inYear.get(b.id));
  ok('annoLetto: stesso anno delle Statistiche per 1000 libri a caso', !diff.length, j(diff.slice(0, 3)));

  // ---- clean ----
  const c = clean({ title: '', status: 'boh', rating: 9, started: '2025-1-1', finished: '<b>x</b>', finishedYear: 1800, pageStep: 0, series: '  Serie   X ', seriesNo: '0,5', seriesManual: 'sì', spine: 'javascript:1', extra: 1 });
  ok('clean: titolo, stato, voto, date, anno, salto, serie, foto e campi sconosciuti', c.title === 'Senza titolo' && c.status === 'da-leggere' && c.rating === 5 && !c.started && !c.finished && !c.finishedYear && !c.pageStep && c.series === 'Serie X' && c.seriesNo === '0.5' && !c.seriesManual && !c.spine && !('extra' in c) && c.added > 0, j(c));
  ok('clean: senza serie niente numero né seguito', (o => !o.seriesNo && !o.seriesNext)(clean({ title: 'a', seriesNo: '3', seriesNext: 'b' })));
  ok('clean: anno solo senza fine, nell\'intervallo', clean({ title: 'a', finished: '2025-01-01', finishedYear: 2020 }).finishedYear === undefined && clean({ title: 'a', finishedYear: '2020' }).finishedYear === 2020 && clean({ title: 'a', finishedYear: 2999 }).finishedYear === undefined);

  // ---- ISBN ----
  const isbnCases = [['ISBN 978-88-347-4621-9', '9788834746219'], [' 88 347 4621 x ', '883474621X'], ['978883474621', ''], ['abc', ''], ['9791254800000', '9791254800000']];
  ok('parseIsbn: spazi, trattini, prefisso, X finale, lunghezze sbagliate', isbnCases.every(([a, b]) => R.parseIsbn(a) === b), j(isbnCases.map(([a]) => R.parseIsbn(a))));
  ok('ISBN-13 ↔ ISBN-10: 9788834746219 ↔ 883474621X', R.isbn10From13('9788834746219') === '883474621X' && R.isbn13From10('883474621X') === '9788834746219');
  const round = Array.from({ length: 300 }, (_, i) => String(100000000 + i * 3331).slice(0, 9)).map(c9 => { const c10 = R.isbn10From13(R.isbn13From10(c9 + '0')); const i13 = R.isbn13From10(c10); return R.isbn10From13(i13) === c10; });
  ok('ISBN: 300 conversioni andata e ritorno', round.every(Boolean), String(round.filter(x => !x).length));
  ok('wdIsbn: tutte le divisioni con i trattini, per 13 e 10 cifre', (q => q.includes('"978-88-347-4621-9"') && q.includes('"88-347-4621-X"') && /wdt:P212\|wdt:P957/.test(q))(R.wdIsbn('9788834746219')));

  // ---- Titoli e serie ----
  ok('sameTitle: articoli, sottotitoli, inizio da 8 caratteri', R.sameTitle('Il nome della rosa', 'nome della rosa: romanzo') && R.sameTitle('Slow Horses', 'slow horses - edizione') && !R.sameTitle('Ubik', 'Ubik e altro') && !R.sameTitle('', 'x'));
  const ser = [{ id: 'a', title: 'Uno', series: 'S', seriesNo: '1', status: 'letto' }, { id: 'b', title: 'Due', series: 'S', seriesNo: '2', status: 'letto', seriesNext: 'Tre' }, { id: 'd', title: 'Quattro', series: 'S', seriesNo: '4', status: 'da-leggere' }];
  const nx = R.nextInSeries(ser[1], ser);
  ok('nextInSeries: volume mancante con seguito confermato → «non ce l\'hai» col numero', nx && nx.title === 'Tre' && nx.no === '3' && !nx.book, j(nx));
  const nb = R.nextBooks([...ser, { id: 'e', title: 'Altro', author: 'Z', status: 'da-leggere', added: 5 }], [], () => 0);
  ok('nextBooks: il volume dopo un buco non è «affine»; più vecchio e caso presenti', nb.every(x => !(x.kind === 'affine' && x.book.id === 'd')) && nb.some(x => x.kind === 'vecchio'), j(nb.map(x => [x.kind, x.book.id])));

  // ---- Frasi delle date e ritmo ----
  const P = R.periodText;
  const pc = [
    [{ status: 'letto', started: '2024-12-10', finished: '2025-01-02' }, 'Letto dal 10 dicembre 2024 al 2 gennaio 2025, 24 giorni.'],
    [{ status: 'letto', year: 2019 }, 'Letto nel 2019. Iniziato il: data da scegliere; finito il: data da scegliere.'],
    [{ status: 'da-leggere' }, 'Ancora da iniziare.'],
    [{ status: 'in-lettura', started: '2026-10-08' }, 'In lettura dall\'8 ottobre 2026.'],
    [{ status: 'letto', started: '2025-03-08', finished: '2025-04-11' }, 'Letto dall\'8 marzo 2025 all\'11 aprile 2025, 35 giorni.'],
    [{ status: 'letto', finished: '2025-04-11' }, 'Iniziato il: data da scegliere; finito l\'11 aprile 2025.'],
    [{ status: 'in-lettura' }, 'In lettura dal: data da scegliere.'],
  ];
  ok('periodText: frasi per VoiceOver come sullo schermo («dall\'8», «all\'11», «l\'11»)', pc.every(([a, e]) => P(a).sr === e), j(pc.map(([a]) => P(a).sr)));
  const rp = R.readingPace({ started: '2026-10-12', page: 142, pages: 337 }, '2026-10-29');
  ok('readingPace: 18º giorno, circa 8 pagine al giorno, fine stimata', rp.why === 'ok' && rp.day === 18 && Math.round(rp.perDay) === 8 && /^2026-11-/.test(rp.eta), j(rp));
  ok('paceText: frase completa', /^18º giorno di lettura, circa 8 pagine al giorno: a questo ritmo lo finisci verso il \d+ novembre\.$/.test(R.paceText(rp, '2026-10-29')), R.paceText(rp, '2026-10-29'));
  ok('readingPace: casi limite (futuro, oggi, senza pagine, finito, ritmo strano)', [
    R.readingPace({ started: '2026-11-05', page: 1, pages: 10 }, '2026-10-29').why === 'no-start',
    R.readingPace({ started: '2026-10-29', page: 1, pages: 10 }, '2026-10-29').why === 'today',
    R.readingPace({ started: '2026-10-01', page: 5 }, '2026-10-29').why === 'no-pages',
    R.readingPace({ started: '2026-10-01', page: 10, pages: 10 }, '2026-10-29').why === 'done',
    R.readingPace({ started: '2020-01-01', page: 2, pages: 900 }, '2026-10-29').why === 'odd',
  ].every(Boolean));

  // ---- Lingua della trama (v80) ----
  const IT = 'Un giovane uomo si trova a vivere in una città che non conosce e cerca di capire il senso della sua vita, tra amici e nemici.';
  const EN = 'A young man finds himself living in a city he does not know and tries to understand the meaning of his life, with friends and enemies.';
  const FR = 'Un jeune homme se retrouve à vivre dans une ville qu\'il ne connaît pas et cherche le sens de sa vie, entre les amis et les ennemis.';
  ok('linguaTesto: italiano, inglese, francese; troppo corto = sconosciuta', R.linguaTesto(IT) === 'it' && R.linguaTesto(EN) === 'en' && R.linguaTesto(FR) === 'fr' && R.linguaTesto('Ubik') === '', [IT, EN, FR].map(R.linguaTesto).join());
  ok('linguaDi: il testo vince sulla lingua dichiarata, senza testo riconoscibile vale quella dichiarata', R.linguaDi({ synopsis: EN, lang: 'it' }) === 'en' && R.linguaDi({ synopsis: 'Breve.', lang: 'it' }) === 'it');
  ok('tramaMigliore: prima quella nella lingua del telefono, poi la prima che c\'è', R.tramaMigliore([{ synopsis: EN, lang: 'en' }, { synopsis: '' }, { synopsis: IT }], 'it') === IT
    && R.tramaMigliore([{ synopsis: EN }, { synopsis: FR }], 'it') === EN && R.tramaMigliore([{ synopsis: EN }, { synopsis: IT }], 'en') === EN && R.tramaMigliore([{}, null], 'it') === '');

  // ---- Statistiche: misure e file della mensola ----
  const rows = R.ysRows(Array.from({ length: 40 }, (_, i) => ({ pages: (i * 97) % 900 })));
  ok('ysRows: file mai vuote e mai oltre 300 unità (salvo un solo libro)', rows.every(rw => rw.length && (rw.length === 1 || rw.reduce((t, b) => t + R.statDim(b).u, 0) <= 300)) && rows.flat().length === 40);
}
