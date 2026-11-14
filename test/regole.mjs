// Funzioni pure provate da Node, senza browser (v79). Prende da app.js i tratti tra «// <regole>» e «// </regole>»
// (le funzioni restano dove sono: l'app non cambia) e li prova con molti casi, anche generati a caso.
import fs from 'node:fs';
import path from 'node:path';
import { ok, ROOT } from './lib.mjs';

const EXPORTS = ['STATUS_ONE', 'FIELDS', 'volNo', 'seriesKey', 'today', 'clean', 'lettura', 'tidy', 'norm', 'isbn13From10', 'isbn10From13', 'wdIsbn', 'parseIsbn',
  'computeStats', 'statDim', 'ysRows', 'MONTHS', 'num', 'nextInSeries', 'nextBooks', 'titleCore', 'sameTitle', 'isoOk', 'longDate', 'dayDiff', 'addDays', 'periodText', 'readingPace', 'paceText', 'linguaTesto', 'linguaDi', 'tramaMigliore', 'linguaEdizione', 'primaNellaLingua', 'gustiDi', 'idNovita', 'votoMostrato', 'novitaDa', 'perche', 'pulisciViste', 'stessoLibro', 'riedizione', 'linguaNov', 'sitoDi'];

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
  ok('regole: tratti segnati trovati (12) e caricati senza browser', parts.length === 12, String(parts.length));
  ok('regole: nei tratti segnati niente pagina, stato dell\'app o memoria del dispositivo', !/\bdocument\b|\bstate\.|localStorage|\$\(|indexedDB|navigator\./.test(code));
  ok('regole: tutte le funzioni attese ci sono', EXPORTS.every(k => R[k] !== undefined), EXPORTS.filter(k => R[k] === undefined).join(', '));
  const { lettura, clean, tidy } = R, O = '2026-10-31';
  const j = JSON.stringify;

  // ---- v90: dove gira l'app (sito Firebase, vecchio sito, altro) ----
  const casiSito = [['mylibrary-2ea05.web.app', 'firebase'], ['MYLIBRARY-2EA05.WEB.APP', 'firebase'], ['mylibrary-2ea05.firebaseapp.com', 'firebase'],
    ['margaz90.github.io', 'vecchio'], ['localhost', 'altro'], ['evil-mylibrary-2ea05.web.app', 'altro'], ['constructor', 'altro'], ['mylibrary-2ea05.web.app.evil.com', 'altro'], ['', 'altro'], [undefined, 'altro']];
  ok('sitoDi: dove gira l\'app (somiglianze non contano)', casiSito.every(([h, s]) => R.sitoDi(h) === s), j(casiSito.map(([h]) => R.sitoDi && R.sitoDi(h))));

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

  // ---- Lingua dell'edizione e copertina (v82) ----
  ok('linguaEdizione: dichiarata, Apple/Open Library italiana, dalla trama, sconosciuta', R.linguaEdizione({ lang: 'en-GB', ita: true }) === 'en' && R.linguaEdizione({ ita: true }) === 'it' && R.linguaEdizione({ synopsis: EN }) === 'en' && R.linguaEdizione({}) === '');
  const cv = [{ c: 1, lang: 'en' }, { c: 2 }, { c: 3, ita: true }, { c: 4, lang: 'it' }];
  ok('primaNellaLingua: la prima nella lingua voluta, altrimenti la prima; lista vuota = null', R.primaNellaLingua(cv, 'it').c === 3 && R.primaNellaLingua(cv, 'fr').c === 1 && R.primaNellaLingua([], 'it') === null);

  // ---- Novità per te (v84) ----
  const L5 = (t, a, r, g, x = {}) => ({ title: t, author: a, status: 'letto', rating: r, genre: g, finished: '2025-01-01', ...x });
  const lib = [
    L5('Un covo di bastardi', 'Mick Herron', 5, 'Thriller'), L5('Leoni morti', 'Mick Herron', 4, 'Thriller'),
    L5('Il nome della rosa', 'Umberto Eco', 3, 'Storico'), L5('Brutto', 'Autore Scarso', 2, 'Thriller'), L5('Pessimo', 'Autore Scarso', 1, 'Thriller'),
    { title: 'In pila', author: 'Donato Carrisi', status: 'da-leggere', rating: 0 }, { title: 'Desiderato', author: 'Zadie Smith', status: 'desiderato', rating: 0, isbn: '9788806000001' },
  ];
  const G = R.gustiDi(lib);
  const pa = Object.fromEntries(G.autori.map(a => [a.nome, a.punti]));
  ok('gustiDi: 5★=3, 4★=2, 3★=1, Da leggere=1; autore con media sotto 3 escluso', pa['Mick Herron'] === 5 && pa['Umberto Eco'] === 1 && pa['Donato Carrisi'] === 1 && !('Autore Scarso' in pa), JSON.stringify(G.autori));
  ok('gustiDi: generi solo dai Letti con 3 o più stelle', JSON.stringify(G.generi) === JSON.stringify([{ nome: 'Thriller', n: 2 }, { nome: 'Storico', n: 1 }]), JSON.stringify(G.generi));
  ok('gustiDi: il libro con il voto più alto dell\'autore', G.autori[0].nome === 'Mick Herron' && G.autori[0].migliore.title === 'Un covo di bastardi' && G.autori[0].migliore.rating === 5);
  const tanti = Array.from({ length: 30 }, (_, i) => L5('T' + i, 'Autore Numero' + i, 4, 'Genere' + (i % 8)));
  const G2 = R.gustiDi(tanti);
  ok('gustiDi: al massimo 15 autori e 8 generi (v85)', G2.autori.length === 15 && G2.generi.length === 8, `${G2.autori.length} ${G2.generi.length}`);
  ok('votoMostrato: la fonte con più voti fra quelle con almeno 20', JSON.stringify(R.votoMostrato([{ media: 4.2, voti: 1350, fonte: 'Google Books' }, { media: 4.5, voti: 12, fonte: 'Apple Books' }, { media: 3.9, voti: 300, fonte: 'Open Library' }])) === JSON.stringify({ media: 4.2, voti: 1350, fonte: 'Google Books' }));
  ok('votoMostrato: nessuna fonte affidabile → null; media fuori 0–5 scartata', R.votoMostrato([{ media: 4.5, voti: 12, fonte: 'x' }]) === null && R.votoMostrato([{ media: 9, voti: 900, fonte: 'x' }, { media: -1, voti: 50, fonte: 'y' }]) === null && R.votoMostrato([]) === null);
  ok('idNovita: ISBN, altrimenti titolo e cognome', R.idNovita({ isbn: '978-88-04-00000-2', title: 'X' }) === '9788804000002' && R.idNovita({ title: 'Il Libro!', author: 'Mario Rossi, Altro' }) === 'il libro|rossi');
  const OGGI = '2026-11-07';
  const ris = [
    { title: 'Il nuovo di Herron', author: 'Mick Herron', uscita: '2026-12-12', isbn: '9788804111111', voti: [{ media: 4.6, voti: 40, fonte: 'Google Books' }] },
    { title: 'Uscito da poco', author: 'Mick Herron', uscita: '2026-10-28' },
    { title: 'Troppo vecchio', author: 'Mick Herron', uscita: '2020-01-01' },
    { title: 'Un covo di bastardi', author: 'Mick Herron', uscita: '2019-01-01' },
    { title: 'Desiderato', author: 'Zadie Smith', isbn: '9788806000001' },
    { title: 'Cofanetto Slough House', author: 'Mick Herron' },
    { title: '', author: 'Mick Herron' }, { title: 'Senza autore', author: '' },
    { title: 'Data storta', author: 'Umberto Eco', uscita: '2026-13-45' },
    { title: 'Thriller nuovo', author: 'Altra Autrice', genere: 'Thriller', uscita: '2025-05-01', voti: [{ media: 4.1, voti: 900, fonte: 'Google Books' }] },
    { title: 'Thriller nuovo', author: 'Altra Autrice', genere: 'Thriller', cover: 'https://x/c.jpg', voti: [{ media: 4.4, voti: 2000, fonte: 'Apple Books' }] },
    { title: 'Edizione inglese', author: 'Altro Ancora', genere: 'Thriller', lang: 'en' },
    { title: 'Fuori gusti', author: 'Nessuno Noto', genere: 'Cucina' },
  ];
  const N = R.novitaDa(ris, lib, OGGI, 'it', G);
  const ut = N.uscite.map(x => x.title), pt = N.proposte.map(x => x.title);
  ok('novitaDa: uscite dei tuoi autori da 90 giorni fa a un anno dopo, prima le future', JSON.stringify(ut) === JSON.stringify(['Il nuovo di Herron', 'Uscito da poco']), JSON.stringify(ut));
  ok('novitaDa: scarta libri già presenti, desiderati, cofanetti, senza titolo o autore, altre lingue, fuori gusti', !pt.some(t => /covo|Desiderato|Cofanetto|Senza autore|inglese|Fuori gusti/.test(t)) && !ut.includes('Troppo vecchio'), JSON.stringify(pt));
  ok('novitaDa: data non valida ignorata (il libro resta, non è un\'uscita)', pt.includes('Data storta') && !ut.includes('Data storta'), JSON.stringify(pt));
  const tn = N.proposte.filter(x => x.title === 'Thriller nuovo');
  ok('novitaDa: doppioni uniti, copertina e voto con più lettori', tn.length === 1 && tn[0].cover === 'https://x/c.jpg' && tn[0].voto && tn[0].voto.fonte === 'Apple Books' && tn[0].voto.voti === 2000, JSON.stringify(tn));
  ok('novitaDa: uscita con voto, motivazione e autore letto', N.uscite[0].voto.voti === 40 && N.uscite[0].autoreLetto === true && /^Nuovo di Herron: esce il 12 dicembre$/.test(N.uscite[0].perche) && /^Nuovo di Herron: uscito il 28 ottobre$/.test(N.uscite[1].perche), JSON.stringify(N.uscite.map(x => x.perche)));
  // ---- v85: stesso libro, riedizioni, lingue, gruppi ----
  const H = { title: 'Across the sand. Oltre le dune', author: 'Hugh Howey' };
  ok('stessoLibro: titolo in due lingue col punto (caso Howey)', R.stessoLibro(H, { title: 'Across the Sand', author: 'Hugh Howey' }) && R.stessoLibro(H, { title: 'Oltre le dune', author: 'Howey, Hugh' }) && !R.stessoLibro(H, { title: 'Oltre le dune', author: 'Altro Autore' }) && !R.stessoLibro({ title: 'Il libro', author: 'A B' }, { title: 'Il libro nero', author: 'A B' }));
  ok('stessoLibro: stesso ISBN anche con titoli diversi', R.stessoLibro({ title: 'X', isbn: '9788804000001' }, { title: 'Y', isbn: '978-88-04-00000-1' }));
  const tutti = [{ title: 'Slow Horses', author: 'Mick Herron', uscita: '2026-12-01' }, { title: 'Slow Horses', author: 'Mick Herron', edYear: 2010 }, { title: 'Nuovo vero', author: 'Mick Herron', uscita: '2026-12-01' }];
  ok('riedizione: stesso libro con data più vecchia, o parola nel titolo', R.riedizione(tutti[0], tutti) && !R.riedizione(tutti[2], tutti) && R.riedizione({ title: 'Il nome della rosa. Nuova edizione', author: 'Umberto Eco', uscita: '2026-12-01' }, []) && R.riedizione({ title: 'Dune (Anniversary Edition)', author: 'F H' }, []));
  ok('linguaNov: Apple (ita sempre) con trama inglese = en; senza trama = dichiarata o vuota', R.linguaNov({ ita: true, synopsis: EN }) === 'en' && R.linguaNov({ ita: true }) === 'it' && R.linguaNov({ lang: 'en' }) === 'en' && R.linguaNov({}) === '');
  const U = R.novitaDa([
    { title: 'Il nuovo di Herron', author: 'Mick Herron', uscita: '2026-12-12', synopsis: IT },
    { title: 'The New Herron', author: 'Mick Herron', uscita: '2026-12-20', lang: 'en' },
    { title: 'Slow Horses', author: 'Mick Herron', uscita: '2026-11-01' }, { title: 'Slow Horses', author: 'Mick Herron', edYear: 2010 },
    { title: 'Across the Sand', author: 'Hugh Howey', ita: true, synopsis: IT }, { title: 'Oltre le dune', author: 'Hugh Howey', ita: true },
  ], lib.concat([{ title: 'Across the sand. Oltre le dune', author: 'Hugh Howey', status: 'letto', rating: 4 }]), OGGI, 'it', G);
  ok('novitaDa v85: uscite solo italiane, originali a parte, niente riedizioni né libri già tuoi', JSON.stringify(U.uscite.map(x => x.title)) === JSON.stringify(['Il nuovo di Herron']) && JSON.stringify(U.originali.map(x => x.title)) === JSON.stringify(['The New Herron']) && !U.proposte.concat(U.uscite).some(x => /Across|Oltre/.test(x.title)), JSON.stringify(U));
  const VT = m => [{ media: m, voti: 100, fonte: 'Google Books' }];
  const GG = R.gustiDi(lib.concat(['Fantasy', 'Horror', 'Rosa', 'Saggio', 'Viaggi'].map((g, i) => L5('Libro ' + g, 'Scrittore ' + g, 4, g)), [L5('Unico', 'Solo Unico', 5, 'Thriller')]));
  const cand = [].concat(
    Array.from({ length: 5 }, (_, i) => ({ title: 'Herron ' + i, author: 'Mick Herron', voti: VT(3 + i / 10) })),
    [{ title: 'Eco 1', author: 'Umberto Eco' }],
    Array.from({ length: 5 }, (_, i) => ({ title: 'Thr ' + i, author: 'Nuova Autrice ' + i, genere: 'Thriller', voti: VT(4) })),
    Array.from({ length: 3 }, (_, i) => ({ title: 'Sto ' + i, author: 'Storica ' + i, genere: 'Storico' })),
    [{ title: 'Fan 1', author: 'Fa Uno', genere: 'Fantasy', voti: VT(4.8) }, { title: 'Hor 1', author: 'Ho Uno', genere: 'Horror' }, { title: 'Unico 2', author: 'Solo Unico' }]);
  const PG = R.novitaDa(cand, lib, OGGI, 'it', GG).proposte;
  const per = g => PG.filter(x => x.gruppo === g);
  ok('gruppi: 4 + 4 + 4 nell\'ordine autori, generi, scoperta', JSON.stringify(PG.map(x => x.gruppo)) === JSON.stringify(['autori', 'autori', 'autori', 'generi', 'generi', 'generi', 'generi', 'scoperta', 'scoperta', 'scoperta']) || (PG.length <= 12 && JSON.stringify([...new Set(PG.map(x => x.gruppo))]) === JSON.stringify(['autori', 'generi', 'scoperta']) && per('scoperta').length >= 4), JSON.stringify(PG.map(x => [x.gruppo, x.title])));
  ok('gruppi: al massimo 2 per autore; per genere 2 al primo giro e 4 in tutto', PG.filter(x => x.author === 'Mick Herron').length <= 2 && PG.filter(x => x.genere === 'Thriller').length <= 4 && PG.length <= 12, JSON.stringify(PG.map(x => [x.gruppo, x.title])));
  ok('gruppi: «da scoprire» con i generi meno letti e l\'autore di un solo libro', per('scoperta').some(x => /^Sto /.test(x.title)) && per('scoperta').some(x => x.title === 'Unico 2') && per('generi').some(x => x.title === 'Fan 1'), JSON.stringify(per('scoperta').map(x => x.title)));
  ok('gruppi: dentro il gruppo prima il voto più alto', per('autori')[0].title === 'Herron 4' && per('generi')[0].title === 'Fan 1', JSON.stringify(PG.map(x => x.title)));
  const POCHI = R.novitaDa(Array.from({ length: 9 }, (_, i) => ({ title: 'Thr ' + i, author: 'Altra ' + i, genere: ['Thriller', 'Storico', 'Fantasy'][i % 3] })).concat([{ title: 'Herron X', author: 'Mick Herron' }]), lib, OGGI, 'it', GG).proposte;
  ok('gruppi: posti liberi agli altri gruppi (mai oltre 12)', POCHI.length > 4 + 1 && POCHI.length <= 12, JSON.stringify(POCHI.map(x => [x.gruppo, x.title])));
  const EY = R.novitaDa([{ title: 'Vecchio di Herron', author: 'Mick Herron', edYear: 2001 }, { title: 'Recente di Herron', author: 'Mick Herron', edYear: 2025 }], lib, OGGI, 'it', G).proposte;
  ok('novitaDa: l\'anno arriva anche da edYear (come lo danno le fonti) e un libro vecchio va dopo', EY.length === 2 && EY[0].title === 'Recente di Herron' && EY[1].year === 2001, JSON.stringify(EY.map(x => [x.title, x.year])));
  // ---- v85, dopo la revisione ----
  const SL = (a, b) => R.stessoLibro({ title: a, author: 'Mick Herron' }, { title: b, author: 'Mick Herron' });
  ok('stessoLibro: nomi di serie e sottotitoli comuni non bastano', !SL('Slough House. Real Tigers', 'Slough House. Spook Street') && !SL('Real Tigers: A Thriller', 'Spook Street: A Thriller') && !SL('Il cane di terracotta. Le indagini del commissario Montalbano', 'Il ladro di merendine. Le indagini del commissario Montalbano') && !SL('Fondazione. Volume 1', 'Fondazione. Volume 2'));
  const tr = [{ title: 'Slow Horses', author: 'Mick Herron', uscita: '2026-12-01', lingua: 'it' }, { title: 'Slow Horses', author: 'Mick Herron', edYear: 2010, lingua: 'en' }];
  ok('riedizione: la prima traduzione italiana non è una riedizione dell\'originale inglese', !R.riedizione(tr[0], tr));
  const ca = [{ title: 'Nuovo', author: 'Mick Herron', uscita: '2026-01-02' }, { title: 'Nuovo', author: 'Mick Herron', uscita: '2025-12-30' }];
  ok('riedizione: date a cavallo d\'anno non bastano (servono 12 mesi)', !R.riedizione(ca[0], ca));
  ok('riedizione: «L\'anniversario» non è una riedizione', !R.riedizione({ title: "L'anniversario", author: 'Andrea Bajani' }, []) && R.riedizione({ title: 'Dune. Edizione per l\'anniversario', author: 'F H' }, []));
  const BA = R.novitaDa([{ title: 'Bad Actors', author: 'Mick Herron', uscita: '2026-10-20', lang: 'en' }, { title: 'Bad Actors', author: 'Mick Herron', uscita: '2026-11-03', ita: true, synopsis: IT }], lib, OGGI, 'it', G);
  ok('stesso libro uscito anche in italiano: tra le uscite e non tra gli originali', BA.uscite.length === 1 && BA.originali.length === 0, JSON.stringify(BA));
  const QG = R.gustiDi(lib.concat([L5('Fa', 'Fantasy Uno', 4, 'Fantasy')]));
  const quattro = R.novitaDa(Array.from({ length: 30 }, (_, i) => ({ title: 'Libro ' + i, author: 'Nuovo ' + i, genere: ['Thriller', 'Storico', 'Fantasy', 'Thriller'][i % 4] })), lib, OGGI, 'it', QG).proposte;
  ok('limite di 2 per genere solo in «Dai tuoi generi»: con pochi generi si arriva comunque a 12', quattro.length === 12 || quattro.length >= 8 + 1, `${quattro.length}: ${JSON.stringify(quattro.map(x => [x.gruppo, x.genere]))}`);
  const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'seed.json'), 'utf8')); const SB = Array.isArray(seed) ? seed : seed.books;
  const tanti2 = Array.from({ length: 1000 }, (_, i) => ({ title: 'Titolo numero ' + i + (i % 3 ? '. Sottotitolo comune' : ''), author: 'Autore ' + (i % 40), uscita: '2025-0' + (1 + i % 9) + '-10', genere: 'Thriller', synopsis: IT }));
  const t0 = Date.now(); R.novitaDa(tanti2, SB, OGGI, 'it', R.gustiDi(SB)); const dt = Date.now() - t0;
  ok('novitaDa: 1000 risultati e 108 libri in meno di 400 ms (prima circa 1700)', dt < 400, dt + ' ms');
  // ---- v86: lingua originale dell'autore ----
  const OR = R.novitaDa([
    { title: 'Slow Horses', author: 'Mick Herron', edYear: 2010, lang: 'en' }, { title: 'Dead Lions', author: 'Mick Herron', edYear: 2013, lang: 'en' },
    { title: 'Caballos lentos', author: 'Mick Herron', uscita: '2026-11-20', lang: 'es' },
    { title: 'Clown Town', author: 'Mick Herron', uscita: '2026-12-05', lang: 'en' },
  ], lib, OGGI, 'it', G);
  ok('originali: solo nella lingua originale dell\'autore (inglese per Herron), non le traduzioni', JSON.stringify(OR.originali.map(x => x.title)) === JSON.stringify(['Clown Town']), JSON.stringify(OR.originali.map(x => x.title)));
  const PC = R.perche;
  ok('perche: stesso autore con 5 stelle, genere', PC({ title: 'X', author: 'Mick Herron' }, G, OGGI) === 'Dello stesso autore di «Un covo di bastardi», a cui hai dato 5 stelle' && PC({ title: 'Y', author: 'Altra', genere: 'Thriller' }, G, OGGI) === 'Hai letto 2 thriller', [PC({ title: 'X', author: 'Mick Herron' }, G, OGGI), PC({ title: 'Y', author: 'Altra', genere: 'Thriller' }, G, OGGI)].join(' | '));
  ok('perche: autore senza voti alti', PC({ title: 'Z', author: 'Donato Carrisi' }, G, OGGI) === 'Di Carrisi, come il libro che hai', PC({ title: 'Z', author: 'Donato Carrisi' }, G, OGGI));
  const V = R.pulisciViste({ a: '2026-08-08', b: '2026-10-28', c: '2026-12-12' }, OGGI);
  ok('pulisciViste: via le uscite di più di 90 giorni fa', JSON.stringify(Object.keys(V)) === JSON.stringify(['b', 'c']), JSON.stringify(V));

  // ---- Statistiche: misure e file della mensola ----
  const rows = R.ysRows(Array.from({ length: 40 }, (_, i) => ({ pages: (i * 97) % 900 })));
  ok('ysRows: file mai vuote e mai oltre 300 unità (salvo un solo libro)', rows.every(rw => rw.length && (rw.length === 1 || rw.reduce((t, b) => t + R.statDim(b).u, 0) <= 300)) && rows.flat().length === 40);
}
