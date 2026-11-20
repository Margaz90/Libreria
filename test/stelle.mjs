// Stelle per i libri Letti (v83, facoltative dalla v107): menu rapido e «Finito!» le chiedono con «Senza voto», Salva non si blocca,
// pallino «da aggiornare» sui Letti senza voto.
import { APP, ok, newPage, localBooks } from './lib.mjs';

const iso = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const load = async (p, books) => {
  await p.goto(APP + '/');
  await p.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)), books);
  await p.reload(); await p.waitForSelector('#main'); await p.waitForTimeout(300);
};
const book = async (p, id) => (await localBooks(p)).find(x => x.id === id);
const quick = async (p, id, st) => {
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.locator(`#main [data-id="${id}"]`).first().dispatchEvent('pointerdown', { clientX: 5, clientY: 5 });
  await p.waitForSelector('.quick'); await p.waitForTimeout(150);
  await p.locator(`.quick [data-st="${st}"]`).click(); await p.waitForTimeout(400);
};
const openBook = async (p, id) => { await p.locator(`#main [data-id="${id}"], #hero [data-id="${id}"]`).first().click(); await p.waitForSelector('.sheet'); await p.waitForTimeout(250); };

async function gesti(browser) {
  const p = await newPage(browser);
  const base = { added: 1, author: 'A', pages: 200 };
  await load(p, [
    { ...base, id: 'q1', title: 'Senza voto', status: 'da-leggere', rating: 0 },
    { ...base, id: 'q2', title: 'Con voto', status: 'da-leggere', rating: 3 },
    { ...base, id: 'h1', title: 'In lettura', status: 'in-lettura', rating: 0, page: 200, started: '2026-10-01' },
  ]);
  // Menu rapido su un libro senza voto: prima «Quante stelle?», e chiudendo il libro resta com'era
  await quick(p, 'q1', 'letto');
  ok('menu rapido → Letto senza voto: si apre «Quante stelle?»', await p.locator('#q-rate button').count() === 5 && /Quante stelle/.test(await p.locator('.ask-rate h2').innerText()));
  const b0 = await book(p, 'q1');
  ok('finché non scegli le stelle il libro non cambia', b0.status === 'da-leggere' && !b0.finished, JSON.stringify(b0));
  ok('stelle grandi da toccare (almeno 44 px)', (await p.locator('#q-rate button').first().boundingBox()).height >= 44);
  await p.locator('#q-rate-no').click(); await p.waitForTimeout(400);
  ok('Annulla: il libro resta Da leggere', (await book(p, 'q1')).status === 'da-leggere');
  await quick(p, 'q1', 'letto');
  await p.locator('#q-rate button[data-n="4"]').click(); await p.waitForTimeout(900);
  const b1 = await book(p, 'q1');
  ok('scelte 4 stelle: Letto con voto e data di oggi', b1.status === 'letto' && b1.rating === 4 && b1.finished === iso(), JSON.stringify(b1));
  // Con il voto già dato non chiede nulla
  await quick(p, 'q2', 'letto'); await p.waitForTimeout(500);
  ok('libro con il voto: passa subito a Letto, senza chiedere', (await p.locator('.ask-rate').count()) === 0 && (await book(p, 'q2')).status === 'letto');
  // «Finito!» nell'hero
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.locator('#hero [data-finish="h1"]').click(); await p.waitForTimeout(300);
  ok('«Finito!» senza voto: si apre «Quante stelle?»', await p.locator('#q-rate').count() === 1 && (await book(p, 'h1')).status === 'in-lettura');
  await p.locator('#q-rate button[data-n="5"]').click(); await p.waitForTimeout(900);
  const h1 = await book(p, 'h1');
  ok('«Finito!» con 5 stelle: Letto', h1.status === 'letto' && h1.rating === 5, JSON.stringify(h1));
  ok('gesti: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function salva(browser) {
  const p = await newPage(browser);
  const base = { added: 1, author: 'A', pages: 200 };
  await load(p, [{ ...base, id: 's1', title: 'Da segnare', status: 'da-leggere', rating: 0 }]);
  await openBook(p, 's1');
  await p.locator('.seg [data-v="letto"]').click();
  await p.locator('#f-rate button[data-n="3"]').click();
  await p.locator('#s-save').click(); await p.waitForTimeout(900);
  const s1 = await book(p, 's1');
  ok('scheda: con le stelle si salva', s1.status === 'letto' && s1.rating === 3, JSON.stringify(s1));
  // Nuovo libro
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.locator('.dock .add').first().click(); await p.waitForSelector('#s-q');
  await p.waitForFunction(() => document.activeElement && document.activeElement.id === 's-q');
  await p.click('#a-mano'); // v100: Nuovo libro parte dalla sola ricerca
  await p.fill('#d-title', 'Nuovo letto'); await p.fill('#d-author', 'Z');
  await p.locator('.seg [data-v="letto"]').click();
  await p.locator('#f-rate button[data-n="2"]').click(); await p.locator('#a-save').click(); await p.waitForTimeout(900);
  ok('Nuovo libro: con le stelle si salva', (await localBooks(p)).some(b => b.title === 'Nuovo letto' && b.rating === 2));
  // Da leggere e In lettura si salvano senza voto
  await openBook(p, 's1'); await p.locator('.seg [data-v="da-leggere"]').click(); await p.locator('#s-save').click(); await p.waitForTimeout(900);
  ok('Da leggere: si salva anche senza stelle', (await book(p, 's1')).status === 'da-leggere');
  ok('salva: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function segnale(browser) {
  const p = await newPage(browser);
  const base = { added: 1, author: 'A', pages: 200, status: 'letto', finished: '2025-03-10' };
  await load(p, [{ ...base, id: 'v1', title: 'Senza voto', rating: 0 }, { ...base, id: 'v2', title: 'Con voto', rating: 4 }, { ...base, id: 'v3', title: 'Niente', rating: 0, finished: undefined }]);
  const has = id => p.locator(`#main [data-id="${id}"] .badge`).count().then(n => n > 0);
  ok('pallino sui Letti senza voto, non su quelli con voto', await has('v1') && !(await has('v2')));
  ok('VoiceOver: «voto da aggiungere»', /voto da aggiungere/.test(await p.getAttribute('#main [data-id="v1"]', 'aria-label')));
  ok('VoiceOver: date e voto insieme', /periodo di lettura e voto da aggiornare/.test(await p.getAttribute('#main [data-id="v3"]', 'aria-label')));
  await openBook(p, 'v1');
  ok('scheda: nota «Manca il voto»', /Manca il voto/.test(await p.locator('#s-stale-voto').innerText().catch(() => '')));
  await p.locator('#f-rate button[data-n="4"]').click(); await p.locator('#s-save').click(); await p.waitForTimeout(900);
  ok('dato il voto: il pallino sparisce', !(await has('v1')));
  ok('segnale: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}


// v107 (focus group): le stelle si chiedono ma si può dire «Senza voto»; un Letto già senza voto si salva.
async function senzaVotoOk(browser) {
  const p = await newPage(browser);
  const base = { added: 1, author: 'A', pages: 200 };
  await load(p, [
    { ...base, id: 'k1', title: 'Da chiudere', status: 'da-leggere', rating: 0 },
    { ...base, id: 'k2', title: 'Importato', status: 'letto', rating: 0, finished: '2024-05-01' },
    { ...base, id: 'k3', title: 'Dalla scheda', status: 'da-leggere', rating: 0 },
  ]);
  await quick(p, 'k1', 'letto');
  ok('«Quante stelle?»: c\'è «Senza voto»', await p.locator('#q-rate-skip').count() === 1);
  await p.locator('#q-rate-skip').click(); await p.waitForTimeout(1000);
  const k1 = await book(p, 'k1');
  ok('«Senza voto»: il libro va tra i Letti con voto 0, senza richiedere di nuovo', k1.status === 'letto' && !(k1.rating > 0) && await p.locator('.ask-rate').count() === 0, JSON.stringify(k1));
  await openBook(p, 'k2'); await p.fill('#f-notes', 'una nota'); await p.locator('#s-save').click(); await p.waitForTimeout(900);
  ok('scheda: un Letto già senza voto si salva (es. importato)', (await book(p, 'k2')).notes === 'una nota');
  await openBook(p, 'k3'); await p.locator('.seg [data-v="letto"]').click(); await p.locator('#s-save').click(); await p.waitForTimeout(900);
  const k3 = await book(p, 'k3');
  ok('scheda: Letto senza stelle si salva subito, senza avvisi nella scheda', k3.status === 'letto' && !(k3.rating > 0) && await p.locator('.sheet').count() === 0, JSON.stringify(k3));
  const t = await p.locator('.toast').innerText().catch(() => '');
  ok('dopo il salvataggio: avviso «senza voto» con «Dai le stelle»', /senza voto/.test(t) && /Dai le stelle/.test(t), t);
  await p.locator('.toast button', { hasText: 'Dai le stelle' }).click(); await p.waitForSelector('#q-rate');
  await p.locator('#q-rate button[data-n="4"]').click(); await p.waitForTimeout(1000);
  ok('«Dai le stelle» → 4 stelle salvate', (await book(p, 'k3')).rating === 4);
  // Nuovo libro: Letto senza stelle si aggiunge
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.locator('.dock .add').first().click(); await p.waitForSelector('#s-q'); await p.click('#a-mano');
  await p.fill('#d-title', 'Nuovo senza voto'); await p.fill('#d-author', 'Z'); await p.locator('.seg [data-v="letto"]').click();
  await p.locator('#a-save').click(); await p.waitForTimeout(900);
  ok('Nuovo libro: Letto senza stelle si aggiunge', (await localBooks(p)).some(b => b.title === 'Nuovo senza voto' && b.status === 'letto'));
  ok('senza voto: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function eliminaStaccato(browser) {
  const p = await newPage(browser);
  await load(p, [{ added: 1, author: 'A', id: 'e1', title: 'Uno', status: 'da-leggere', rating: 0 }]);
  await p.locator('#main [data-id="e1"]').first().dispatchEvent('pointerdown', { clientX: 5, clientY: 5 }); await p.waitForSelector('.quick'); await p.waitForTimeout(200);
  const g = await p.evaluate(() => { const d = document.querySelector('#q-del'), o = document.querySelector('#q-open'), l = document.querySelector('.quick [data-st="letto"]'); const rd = d.getBoundingClientRect(), ro = o.getBoundingClientRect(), rl = l.getBoundingClientRect(); return { stessaRiga: Math.abs(rd.top - ro.top) < 4, gap: rd.top - Math.max(ro.bottom, rl.bottom) }; });
  ok('menu rapido: «Elimina» su una riga sua, staccato dagli altri pulsanti', !g.stessaRiga && g.gap >= 16, JSON.stringify(g));
  await p.close2();
}

export default async function run({ browser }) {
  await gesti(browser);
  await salva(browser);
  await segnale(browser);
  await senzaVotoOk(browser);
  await eliminaStaccato(browser);
}
