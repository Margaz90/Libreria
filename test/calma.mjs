// Prima schermata più calma (v101): «Cosa leggo adesso?» più compatto sul telefono, suggerimento una tantum per la pressione
// prolungata, un solo nome per «Carica da un file», «Segnatura (facoltativa)».
import { APP, ok, newPage, libri108 } from './lib.mjs';

const carica = async (p, b) => { await p.goto(APP + '/'); await p.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)), b); await p.reload(); await p.waitForSelector('#main [data-id]'); await p.waitForTimeout(400); };

async function compatto(browser) {
  const p = await newPage(browser);
  await carica(p, libri108());
  const m = await p.evaluate(() => ({ hero: Math.round(document.querySelector('#hero').getBoundingClientRect().height), shelf: Math.round(document.querySelector('#main .shelf-block').getBoundingClientRect().top) }));
  ok('telefono: «Cosa leggo adesso?» alto al massimo 300 px (era 368)', m.hero <= 300, JSON.stringify(m));
  ok('telefono: il primo scaffale comincia prima (era a 603 px)', m.shelf <= 540, JSON.stringify(m));
  ok('compatto: «Inizia» resta di almeno 44 px e le linguette pure', (await p.locator('#hero [data-start]').boundingBox()).height >= 44 && (await p.locator('#hero [role=tab]').first().boundingBox()).height >= 44);
  ok('compatto: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function suggerimento(browser) {
  const p = await newPage(browser, { suggerimenti: true });
  await carica(p, libri108());
  ok('suggerimento: niente riquadro in cima alla pagina', !(await p.locator('#notice').isVisible()));
  const t = await p.waitForFunction(() => [...document.querySelectorAll('.toast')].map(x => x.textContent).join(' '), null, { timeout: 4000 }).then(h => h.jsonValue(), () => '');
  ok('suggerimento: compare come messaggio temporaneo («tieni premuto…»)', /tieni premuto/i.test(t), t);
  const via = await p.waitForFunction(() => !document.querySelector('.toast'), null, { timeout: 12000 }).then(() => true, () => false);
  ok('il messaggio se ne va da solo', via);
  await p.reload(); await p.waitForSelector('#main [data-id]'); await p.waitForTimeout(2500);
  ok('e non torna riaprendo l\'app', !/tieni premuto/i.test(await p.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent).join(' '))));
  await p.evaluate(() => localStorage.removeItem('libreria-suggerimenti')); await p.reload(); await p.waitForSelector('#main [data-id]');
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.locator('#main [data-id]').first().dispatchEvent('pointerdown', { clientX: 5, clientY: 5 });
  await p.waitForSelector('.quick'); await p.keyboard.press('Escape'); await p.waitForTimeout(2500);
  ok('chi usa già la pressione prolungata non lo vede', !/tieni premuto/i.test(await p.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent).join(' '))) && await p.evaluate(() => /pressione/.test(localStorage.getItem('libreria-suggerimenti') || '')));
  await p.evaluate(() => localStorage.removeItem('libreria-suggerimenti'));
  await p.reload(); await p.waitForSelector('#main [data-id]'); await p.locator('.dock [data-view="stats"]').click(); await p.waitForTimeout(2500);
  ok('in Statistiche il suggerimento non compare', !/tieni premuto/i.test(await p.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent).join(' '))));
  ok('suggerimento: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function nomi(browser) {
  const p = await newPage(browser);
  await carica(p, libri108().slice(0, 3));
  await p.locator('.dock .more').click(); await p.waitForTimeout(300);
  ok('Altro: la voce si chiama «Carica da un file»', /Carica da un file/.test(await p.locator('.sheet [data-m=carica]').innerText()));
  await p.locator('.sheet [data-m=carica]').click(); await p.waitForTimeout(300);
  ok('la scheda si chiama «Carica da un file»', (await p.locator('.sheet h2').innerText()) === 'Carica da un file');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.locator('.dock [data-act="add"]').click(); await p.waitForSelector('#a-mano'); await p.click('#a-mano');
  ok('Nuovo libro: la segnatura dice di essere facoltativa', /facoltativa/i.test(await p.getAttribute('#d-call', 'placeholder')));
  const y = await p.evaluate(() => ['#d-genre', '#d-call'].map(s => Math.round(document.querySelector(s).getBoundingClientRect().top)));
  ok('Nuovo libro: «Segnatura» alla stessa altezza di «Genere»', y[0] === y[1], y.join(' / '));
  ok('nomi: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

export default async function run({ browser }) {
  await compatto(browser);
  await suggerimento(browser);
  await nomi(browser);
}
