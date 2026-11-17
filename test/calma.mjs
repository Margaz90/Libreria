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
  ok('suggerimento: «tieni premuto» compare una volta con dei libri', /tieni premuto/i.test(await p.locator('#notice').innerText().catch(() => '')) && await p.locator('#notice').isVisible());
  await p.click('#sugg-ok'); await p.waitForTimeout(200);
  ok('«Ho capito» lo toglie', !(await p.locator('#notice').isVisible()));
  await p.reload(); await p.waitForSelector('#main [data-id]'); await p.waitForTimeout(300);
  ok('e non torna riaprendo l\'app', !(await p.locator('#notice').isVisible()));
  await p.evaluate(() => localStorage.removeItem('libreria-suggerimenti')); await p.reload(); await p.waitForSelector('#main [data-id]'); await p.waitForTimeout(300);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.locator('#main [data-id]').first().dispatchEvent('pointerdown', { clientX: 5, clientY: 5 });
  await p.waitForSelector('.quick'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok('usare la pressione prolungata vale come «Ho capito»', !(await p.locator('#notice').isVisible()));
  await p.locator('.dock [data-view="stats"]').click(); await p.evaluate(() => localStorage.removeItem('libreria-suggerimenti')); await p.locator('.dock [data-view="libreria"]').click(); await p.locator('.dock [data-view="stats"]').click(); await p.waitForTimeout(300);
  ok('in Statistiche il suggerimento non compare', !(await p.locator('#notice').isVisible()));
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
  ok('Nuovo libro: «Segnatura (facoltativa)»', /facoltativa/i.test(await p.locator('label[for="d-call"]').innerText()));
  ok('nomi: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

export default async function run({ browser }) {
  await compatto(browser);
  await suggerimento(browser);
  await nomi(browser);
}
