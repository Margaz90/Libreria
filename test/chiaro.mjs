// v102: «Annulla» dopo «Elimina», stato della sincronizzazione visibile, fonti senza codici, «Come funziona» in Altro.
import { APP, ok, newPage, libri108, localBooks, toastText, resetCloud } from './lib.mjs';

const carica = async (p, b) => { await p.goto(APP + '/'); await p.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)), b); await p.reload(); await p.waitForSelector('#main [data-id]'); await p.waitForTimeout(300); };

async function annulla(browser) {
  const p = await newPage(browser);
  const b = libri108().slice(0, 4); await carica(p, b);
  const id = b[1].id, titolo = b[1].title;
  await p.locator(`#main [data-id="${id}"]`).first().click(); await p.waitForSelector('.sheet');
  const del = p.locator('.sheet #s-del, .sheet [data-del], .sheet button:has-text("Elimina")').first();
  await del.click(); await del.click(); await p.waitForTimeout(400);
  ok('Elimina: l\'avviso offre «Annulla»', /Libro eliminato/.test(await toastText(p)) && (await p.locator('.toast button', { hasText: 'Annulla' }).count()) === 1, await toastText(p));
  await p.locator('.toast button', { hasText: 'Annulla' }).click(); await p.waitForTimeout(900);
  const libri = await localBooks(p), tombe = await p.evaluate(() => JSON.parse(localStorage.getItem('libreria-tombs') || '{}'));
  ok('«Annulla» rimette il libro (stesso id e titolo) e toglie il segnaposto dell\'eliminazione', libri.some(x => x.id === id && x.title === titolo) && !tombe[id] && (await p.locator(`#main [data-id="${id}"]`).count()) > 0);
  ok('annulla: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function fonti(browser) {
  const p = await newPage(browser);
  await carica(p, libri108().slice(0, 2));
  await p.locator('.dock [data-act="add"]').click(); await p.waitForSelector('#s-q');
  await p.fill('#s-q', 'Titolo che non esiste da nessuna parte'); await p.click('#s-go');
  const st = await p.waitForFunction(() => { const t = document.querySelector('#s-status')?.textContent || ''; return /Nessun|non rispond|Ricerca non riuscita/.test(t) && t; }, null, { timeout: 20000 }).then(h => h.jsonValue(), () => '');
  ok('ricerca senza risposta dalle fonti: niente codici tecnici', !!st && !/google-|apple-|openlibrary-|wikidata-|\d{3}/.test(st), st);
  ok('ricerca senza risposta: dice quali fonti non rispondono, con il loro nome', /Google Books|Apple Books|Open Library/.test(st), st);
  await p.close2();
}

async function stato(browser) {
  resetCloud();
  const p = await newPage(browser, { init: { fn: () => { if (!localStorage.getItem('fake-init')) { localStorage.setItem('fake-init', '1'); localStorage.setItem('fake-popup', 'ok'); localStorage.setItem('fake-uid', 'u1'); localStorage.setItem('fake-name', 'Anna'); } } } });
  await carica(p, libri108().slice(0, 3));
  ok('senza accesso: nessun segno della sincronizzazione', !(await p.locator('#sync-stato').isVisible()));
  await p.locator('.dock .more').click(); await p.locator('.sheet [data-m=sync]').click();
  await p.waitForFunction(() => document.querySelector('#sy-google') && !document.querySelector('#sy-google').disabled, null, { timeout: 15000 }).catch(() => {});
  await p.click('#sy-google');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('libreria-cloud') || '{}').email, null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(1500); if (await p.locator('.sheet').count()) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  const lab = () => p.getAttribute('#sync-stato', 'aria-label').catch(() => '');
  await p.waitForFunction(() => /salvat/i.test(document.querySelector('#sync-stato')?.getAttribute('aria-label') || ''), null, { timeout: 8000 }).catch(() => {});
  ok('collegato: in alto il segno «tutto salvato»', await p.locator('#sync-stato').isVisible() && /salvat/i.test(await lab()), await lab());
  await p.context().setOffline(true); await p.evaluate(() => window.dispatchEvent(new Event('offline'))); await p.waitForTimeout(300);
  ok('senza rete: il segno lo dice', /senza rete/i.test(await lab()), await lab());
  await p.context().setOffline(false); await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(800);
  const box = await p.locator('#sync-stato').boundingBox();
  ok('il segno si tocca bene (almeno 44 px)', box && box.width >= 44 && box.height >= 44, JSON.stringify(box));
  await p.click('#sync-stato'); await p.waitForTimeout(300);
  ok('toccandolo si apre Account', (await p.locator('#sy-out').count()) === 1);
  ok('stato: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function aiuto(browser) {
  const p = await newPage(browser);
  await carica(p, libri108().slice(0, 3));
  await p.locator('.dock .more').click(); await p.waitForTimeout(300);
  ok('Altro: c\'è «Come funziona»', (await p.locator('.sheet [data-m=aiuto]').count()) === 1);
  await p.locator('.sheet [data-m=aiuto]').click(); await p.waitForTimeout(300);
  const t = await p.locator('.sheet').innerText();
  ok('«Come funziona»: gesti, aggiunta, sincronizzazione, copie e scorciatoie', (await p.locator('.sheet h2').innerText()) === 'Come funziona' && /tieni premuto/i.test(t) && /ISBN/.test(t) && /cloud/i.test(t) && /Annulla una modifica/.test(t) && /Scorciatoie/i.test(t), t.slice(0, 200));
  ok('«Come funziona»: con «‹ Altro» e il link alla privacy', (await p.locator('.sheet .indietro').count()) === 1 && (await p.locator('.sheet a[href="privacy.html"]').count()) === 1);
  ok('aiuto: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

export default async function run({ browser }) {
  await annulla(browser);
  await fonti(browser);
  await stato(browser);
  await aiuto(browser);
}
