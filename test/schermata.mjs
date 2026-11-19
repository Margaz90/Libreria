// Prima schermata con una riga in meno (v103): sul telefono l'obiettivo sale accanto alla nuvola,
// lente e Dorsi/Copertine stanno a destra dei filtri; il computer non cambia.
import { APP, ok, newPage, libri108 } from './lib.mjs';

const Y = new Date().getFullYear();
const carica = async (p, b, set) => { await p.goto(APP + '/'); await p.evaluate(([b, s]) => { localStorage.setItem('libreria-diego-v1', JSON.stringify(b)); if (s) localStorage.setItem('libreria-settings', JSON.stringify(s)); }, [b, set]); await p.reload(); await p.waitForSelector('#main [data-id]'); await p.waitForTimeout(400); };
const vis = (p, s) => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(e).visibility !== 'hidden'; }, s);
const top = (p, s) => p.evaluate(sel => { const e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().top) : null; }, s);

async function telefono(browser, dark) {
  const tag = dark ? 'scuro' : 'chiaro';
  const p = await newPage(browser, { dark });
  await carica(p, libri108(), { goals: { [Y]: 30 } });
  ok(`${tag}: la riga dell'obiettivo non c'è più`, !(await vis(p, '.sumrow')));
  const g = '[data-shelf="letto"] .obiettivo-sc';
  ok(`${tag}: l'obiettivo sta sullo scaffale «Letti», con anello e «6 di 30»`, await vis(p, g) && /di 30/.test(await p.getAttribute(g, 'aria-label')) && (await p.locator(g + ' svg').count()) === 1 && /\bdi 30\b/.test(await p.locator(g).innerText()), await p.getAttribute(g, 'aria-label'));
  ok(`${tag}: in alto resta solo la nuvola (niente anello accanto al titolo)`, (await p.locator('#goal-mini').count()) === 0);
  const b = await p.locator(g).boundingBox();
  ok(`${tag}: l'obiettivo si tocca bene (44 px)`, b && b.height >= 44 && b.width >= 44, JSON.stringify(b));
  const t = { pill: await top(p, '#pills [data-filter]'), lente: await top(p, '#cerca-apri'), vista: await top(p, '.toolbar .viewsw') };
  ok(`${tag}: lente e Dorsi/Copertine sulla riga dei filtri`, await vis(p, '#cerca-apri') && await vis(p, '.toolbar .viewsw') && Math.abs(t.pill - t.lente) <= 12 && Math.abs(t.pill - t.vista) <= 12, JSON.stringify(t));
  const shelf = await top(p, '#main .shelf-block');
  ok(`${tag}: gli scaffali salgono (prima a 526 px)`, shelf <= 486, String(shelf));
  ok(`${tag}: niente scorrimento orizzontale`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await p.click(g); await p.waitForSelector('#g-n');
  ok(`${tag}: toccando l'obiettivo si apre l'obiettivo`, (await p.inputValue('#g-n')) === '30');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.evaluate(() => window.scrollTo(0, 1500)); await p.waitForTimeout(300); await p.evaluate(() => window.scrollTo(0, 1400)); await p.waitForTimeout(400);
  ok(`${tag}: scorrendo, filtri e lente restano raggiungibili in alto`, await vis(p, '#cerca-apri') && (await top(p, '#cerca-apri')) >= 0 && (await top(p, '#cerca-apri')) < 120);
  ok(`${tag}: nessun errore in console`, !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function senzaObiettivo(browser) {
  const p = await newPage(browser);
  await carica(p, libri108());
  ok('senza obiettivo: sullo scaffale l\'anello tratteggiato invita a fissarlo', await vis(p, '[data-shelf="letto"] .obiettivo-sc') && /obiettivo/i.test(await p.getAttribute('[data-shelf="letto"] .obiettivo-sc', 'aria-label')));
  await p.close2();
}

async function computer(browser) {
  const p = await newPage(browser, { width: 1366, height: 860 });
  await carica(p, libri108(), { goals: { [Y]: 30 } });
  ok('computer: l\'obiettivo resta dov\'era, niente anello sullo scaffale', await vis(p, '#tally .goal') && !(await vis(p, '[data-shelf="letto"] .obiettivo-sc')));
  ok('computer: ricerca e «Ordina» sempre visibili', await vis(p, '#q') && await vis(p, '#sort-btn'));
  await p.close2();
}

export default async function run({ browser }) {
  await telefono(browser, false);
  await telefono(browser, true);
  await senzaObiettivo(browser);
  await computer(browser);
}
