// Interfaccia: telefono e computer, chiaro e scuro, con i 108 libri Goodreads.
import { APP, ok, newPage, localBooks } from './lib.mjs';

export default async function ({ browser }) {
  for (const [width, height] of [[390, 844], [1366, 860]]) for (const dark of [false, true]) {
    const tag = `${width}px ${dark ? 'scuro' : 'chiaro'}`;
    const p = await newPage(browser, { width, height, dark });
    await p.goto(APP + '/');
    await p.click('#seed-go');
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').length === 108);
    await p.waitForTimeout(400);
    ok(`${tag}: carica i 108 libri Goodreads`, (await localBooks(p)).length === 108);
    ok(`${tag}: i libri compaiono sugli scaffali`, (await p.locator('#main [data-id]').count()) >= 15);
    ok(`${tag}: niente scorrimento orizzontale`, await p.evaluate(w => document.documentElement.scrollWidth <= w && innerWidth <= w, width));
    ok(`${tag}: titoli in Fraunces`, /Fraunces/.test(await p.evaluate(() => getComputedStyle(document.querySelector('h1')).fontFamily)));
    if (width < 1024) {
      await p.locator('.dock .more').click();
      ok(`${tag}: «Accedi e sincronizza» è la prima voce di Altro`, (await p.locator('.menu-list button').first().getAttribute('data-m')) === 'sync');
      await p.keyboard.press('Escape');
    }
    ok(`${tag}: nessun errore in console`, !p.errs.length, p.errs.join(' / '));
    await p.close2();
  }
}
