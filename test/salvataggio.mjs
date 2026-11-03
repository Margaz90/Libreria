// Salvataggio unico (v77): `salvaLibro(libro, { ridisegno })` fa sempre gli stessi passi (formato e regole, `updated`,
// salvataggio, ridisegno, cloud); `sposta(prima, dopo)` decide da solo se il libro cambia posto (app e cloud).
import { APP, ok, newPage, localBooks } from './lib.mjs';
import { importa } from './funzioni.mjs';

const load = async (p, books) => {
  await p.goto(APP + '/');
  await p.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)), books);
  await p.reload(); await p.waitForSelector('#main'); await p.waitForTimeout(300);
};
const book = async (p, id) => (await localBooks(p)).find(x => x.id === id);
const saved = (p, id, fn) => p.waitForFunction(([id, src]) => {
  const b = JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').find(x => x.id === id);
  return b && new Function('b', 'return ' + src)(b);
}, [id, fn], { timeout: 4000 }).catch(() => {});

async function salva(browser) {
  const p = await newPage(browser);
  const base = { added: 1, rating: 0, author: 'A', updated: 1000 };
  await load(p, [
    { ...base, id: 'b1', title: 'Uno', status: 'da-leggere', series: 'Vecchia', seriesNo: '3', seriesNext: 'Il quarto' },
    { ...base, id: 'b2', title: 'Due', status: 'da-leggere' },
    { ...base, id: 'b3', title: 'Tre', status: 'letto', finished: '2025-01-01', pages: 100 },
  ]);
  const has = await p.evaluate(() => !!(window.libreriaSalva && window.libreriaSalva.salva && window.libreriaSalva.sposta));
  ok('libreriaSalva esposta (salva, sposta)', has);
  if (!has) { await p.close2(); return; }

  // Sostituisce il libro: un campo assente nel nuovo libro sparisce (Object.assign non lo faceva)
  const r1 = await p.evaluate(() => {
    const b = window.libreriaHost.books().find(x => x.id === 'b1');
    const nb = { ...b, series: 'Nuova' }; delete nb.seriesNo; delete nb.seriesNext;
    const out = window.libreriaSalva.salva(nb, { ridisegno: 'libro' });
    return { out, inArray: window.libreriaHost.books().find(x => x.id === 'b1') };
  });
  ok('salva: restituisce il libro salvato, che è quello nella libreria', r1.out && r1.out.id === 'b1' && r1.inArray.series === 'Nuova', JSON.stringify(r1));
  ok('salva: i campi tolti spariscono davvero', r1.inArray.seriesNo === undefined && r1.inArray.seriesNext === undefined, JSON.stringify(r1.inArray));
  ok('salva: `updated` nuovo', r1.inArray.updated > 1000, String(r1.inArray.updated));
  await saved(p, 'b1', "b.series === 'Nuova'");
  ok('salva: scritto sul dispositivo', (await book(p, 'b1')).series === 'Nuova');

  // Regole della lettura e formato sempre applicati
  const r2 = await p.evaluate(() => window.libreriaSalva.salva({ ...window.libreriaHost.books().find(x => x.id === 'b2'), finished: '2025-02-02', rating: 9 }, { ridisegno: 'nessuno' }));
  ok('salva: formato e regole (un Da leggere non tiene la fine, voto al massimo 5)', !r2.finished && r2.rating === 5, JSON.stringify(r2));

  // Foto del dorso: spineAt quando cambia
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const r3 = await p.evaluate(png => window.libreriaSalva.salva({ ...window.libreriaHost.books().find(x => x.id === 'b2'), spine: png, spineRatio: 0.2 }, { ridisegno: 'nessuno' }), PNG);
  ok('salva: foto nuova → spineAt', r3.spineAt && r3.spineAt === r3.updated, JSON.stringify({ a: r3.spineAt, u: r3.updated }));

  // Libro nuovo senza id
  const r4 = await p.evaluate(() => window.libreriaSalva.salva({ title: 'Nuovo', author: 'Z', status: 'desiderato' }, { ridisegno: 'nessuno' }));
  ok('salva: libro nuovo con un id', !!(r4 && r4.id), JSON.stringify(r4));

  // Ridisegno: «nessuno» non tocca la pagina, «libro» solo quel libro, «auto» tutto se il libro si sposta
  const mark = () => p.evaluate(() => document.querySelectorAll('#main [data-id]').forEach(e => { e.dataset.mark = '1'; }));
  const marked = id => p.evaluate(id => { const e = document.querySelector(`#main [data-id="${id}"]`); return e ? e.dataset.mark === '1' : null; }, id);
  await mark();
  await p.evaluate(() => window.libreriaSalva.salva({ ...window.libreriaHost.books().find(x => x.id === 'b3'), notes: 'x' }, { ridisegno: 'nessuno' }));
  ok('ridisegno «nessuno»: pagina intatta', await marked('b3') === true && await marked('b1') === true);
  await p.evaluate(() => window.libreriaSalva.salva({ ...window.libreriaHost.books().find(x => x.id === 'b3'), notes: 'y' }, { ridisegno: 'libro' }));
  ok('ridisegno «libro»: ridisegnato solo quel libro', await marked('b3') === false && await marked('b1') === true);
  await mark();
  await p.evaluate(() => window.libreriaSalva.salva({ ...window.libreriaHost.books().find(x => x.id === 'b3'), notes: 'z' }));
  ok('ridisegno «auto» senza spostamento: solo quel libro', await marked('b3') === false && await marked('b1') === true);
  await mark();
  await p.evaluate(() => window.libreriaSalva.salva({ ...window.libreriaHost.books().find(x => x.id === 'b1'), status: 'letto', finished: '2025-03-03' }));
  ok('ridisegno «auto» con cambio di stato: tutta la libreria', await marked('b2') === false);
  ok('salva: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

// Un solo elenco dei campi che spostano un libro, per l'app e per il cloud
async function sposta(browser) {
  const p = await newPage(browser);
  await load(p, []);
  const r = await p.evaluate(() => {
    const S = window.libreriaSalva && window.libreriaSalva.sposta, H = window.libreriaHost;
    if (!S) return null;
    const a = { title: 'T', author: 'A', status: 'letto', rating: 3, series: 'S', seriesNo: '1', page: 10, notes: 'n' };
    return {
      stato: S(a, { ...a, status: 'da-leggere' }), voto: S(a, { ...a, rating: 4 }), note: S(a, { ...a, notes: 'm' }),
      pagina: S(a, { ...a, page: 20 }), vuoto: S({ ...a, genre: '' }, { ...a }), serie: S(a, { ...a, seriesNo: '2' }),
      host: H.moved === S,
    };
  });
  ok('sposta esposta', !!r);
  if (!r) { await p.close2(); return; }
  ok('sposta: stato e voto sì, note e pagina no', r.stato && r.voto && !r.note && !r.pagina, JSON.stringify(r));
  ok('sposta: vuoto e assente sono uguali', r.vuoto === false, JSON.stringify(r));
  ok('sposta: la serie conta solo nell\'ordine Autore (qui Recenti)', r.serie === false, JSON.stringify(r));
  ok('sposta: è la stessa funzione che usa il cloud (libreriaHost.moved)', r.host === true);
  await p.locator('#sort-btn').click(); await p.locator('#sort-menu [data-v="autore"]').click();
  const autore = await p.evaluate(() => {
    const a = { title: 'T', author: 'A', status: 'letto', series: 'S', seriesNo: '1' };
    return window.libreriaSalva.sposta(a, { ...a, seriesNo: '2' });
  });
  ok('sposta: nell\'ordine Autore la serie sposta il libro', autore === true, String(autore));
  await p.close2();
}

// Casi limite dei salvataggi in sottofondo e degli import
async function limiti(browser) {
  const p = await newPage(browser, { external: 'mock' });
  await p.route(/itunes\.apple\.com|openlibrary\.org|wikidata\.org|mzstatic\.com/, r => r.abort());
  await p.route(/www\.googleapis\.com\/books/, async r => { await new Promise(x => setTimeout(x, 1500)); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ volumeInfo: { title: 'Sparito', authors: ['Autore Vero'], language: 'it' } }] }) }); });
  const base = { added: 1, rating: 0, status: 'da-leggere' };
  await load(p, [{ ...base, id: 'e1', title: 'Sparito', author: '', isbn: '9788845299997' }, { ...base, id: 'e2', title: 'Resta', author: 'A' }]);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.locator('.dock .more').click(); await p.locator('[data-m=backup]').click(); await p.waitForSelector('#i-authors');
  await p.locator('#i-authors').click(); await p.waitForTimeout(400);
  await p.evaluate(() => { window.libreriaHost.setLocal('e1', null); }); // eliminato mentre la ricerca è in corso
  await p.waitForFunction(() => document.querySelector('#enrich') && document.querySelector('#enrich').hidden, null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(900);
  ok('Completa autori: un libro eliminato nel frattempo non ricompare', !(await p.evaluate(() => window.libreriaHost.books().some(b => b.id === 'e1'))) && !(await book(p, 'e1')));
  ok('limiti: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();

  const q = await newPage(browser);
  await load(q, [{ ...base, id: 'x1', title: 'Mio libro', author: 'Io', rating: 4 }]);
  await importa(q, [{ id: 'x1', title: 'Altro libro', author: 'Altri' }]);
  const bs = await localBooks(q);
  const mine = bs.find(b => b.id === 'x1'), other = bs.find(b => b.title === 'Altro libro');
  ok('import: l\'id scritto nel file non sovrascrive un libro esistente', mine && mine.title === 'Mio libro' && mine.rating === 4 && other && other.id !== 'x1', JSON.stringify(bs));
  await q.close2();
}

export default async function run({ browser }) {
  await limiti(browser);
  await salva(browser);
  await sposta(browser);
}
