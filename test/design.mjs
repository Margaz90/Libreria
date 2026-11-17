// Revisione del design (v99, skill audit-ai-design-slop): istruzioni leggibili sulla porta, un solo stile per le etichette,
// selettore della vista solo dove serve, pallino «da aggiornare» discreto, «Mostra altri» senza riquadro, Nuovo libro e citazione coerenti.
import { APP, ok, newPage, libri108 } from './lib.mjs';

const load = async (p, books) => {
  await p.goto(APP + '/');
  await p.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)), books);
  await p.reload(); await p.waitForSelector('#main [data-id]'); await p.waitForTimeout(300);
};
const stile = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); return { tt: c.textTransform, ls: c.letterSpacing, fs: c.fontSize, color: c.color, border: c.borderTopStyle, h: e.getBoundingClientRect().height, txt: e.textContent.trim(), vis: !!e.offsetParent && c.visibility !== 'hidden' && e.getBoundingClientRect().width > 1 }; }, sel);

async function porta(browser) {
  const p = await newPage(browser, { init: { fn: () => { window.libreriaPorta = true; } } });
  await p.goto(APP + '/'); await p.waitForSelector('#porta #sy-paste');
  const istr = await p.evaluate(() => [...document.querySelectorAll('#porta .field label')].filter(l => l.textContent.trim().length > 30).map(l => getComputedStyle(l).textTransform));
  ok('porta: le istruzioni lunghe non sono in maiuscolo', istr.length >= 2 && istr.every(t => t === 'none'), istr.join());
  const link = await p.evaluate(() => { const a = document.querySelector('#porta a[href="privacy.html"]'); const c = document.createElement('i'); c.style.color = 'var(--accent)'; document.body.append(c); const v = getComputedStyle(c).color; c.remove(); return [getComputedStyle(a).color, v]; });
  ok('porta: il link della privacy ha il colore dell\'app', link[0] === link[1], link.join(' / '));
  ok('porta: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function etichette(browser) {
  const p = await newPage(browser);
  const b = libri108(); b[0].status = 'in-lettura'; b[0].page = 10; b[0].pages = 300;
  await load(p, b);
  const tipi = await p.evaluate(() => {
    const out = {}; const add = (k, s) => { const e = document.querySelector(s); if (e) { const c = getComputedStyle(e); out[k] = c.letterSpacing + ' ' + c.fontSize; } };
    add('rlabel', '#hero .rlabel'); return out;
  });
  await p.locator('.dock .more').click(); await p.waitForTimeout(300);
  tipi.glabel = await p.evaluate(() => { const c = getComputedStyle(document.querySelector('.sheet .glabel')); return c.letterSpacing + ' ' + c.fontSize; });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.locator('#main [data-id]').first().click(); await p.waitForSelector('.sheet .field .label'); await p.waitForTimeout(200);
  tipi.label = await p.evaluate(() => { const c = getComputedStyle([...document.querySelectorAll('.sheet .field .label')].find(l => l.offsetParent)); return c.letterSpacing + ' ' + c.fontSize; });
  ok('etichette in maiuscoletto: un solo stile (spaziatura e misura)', new Set(Object.values(tipi)).size === 1, JSON.stringify(tipi));
  const st = await stile(p, '#f-status-l');
  ok('scheda: «Stato» non si vede più sopra le linguette, ma resta per VoiceOver', st && !st.vis && st.txt === 'Stato' && (await p.getAttribute('.seg[aria-labelledby="f-status-l"]', 'aria-labelledby')) === 'f-status-l', JSON.stringify(st));
  const q = await p.evaluate(() => [document.querySelector('#f-quote').placeholder, ...[...document.querySelectorAll('.quote .qm')].map(x => x.textContent)].join(''));
  ok('citazione: virgolette «» come nel resto dell\'app', !/[“”]/.test(q) && /«/.test(q) && /»/.test(q), q);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok('etichette: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function libreria(browser) {
  const p = await newPage(browser);
  const b = libri108(); b.forEach(x => { if (x.status === 'letto') { x.rating = 0; } });
  await load(p, b);
  const bd = await p.evaluate(() => { const e = document.querySelector('#main .spine .badge'); const r = e.getBoundingClientRect(); return { txt: e.textContent, w: r.width, h: r.height }; });
  ok('pallino sui dorsi: piccolo e senza «!»', bd.txt === '' && bd.w <= 13 && bd.h <= 13 && bd.h >= 10, JSON.stringify(bd));
  const pg = await stile(p, '#main .pager');
  ok('«Mostra altri 15»: senza riquadro tratteggiato', pg && pg.border !== 'dashed', JSON.stringify(pg));
  const sw = () => p.evaluate(() => { const e = document.querySelector('.viewsw-m'); return !!e && !!e.offsetParent && getComputedStyle(e).display !== 'none'; });
  ok('selettore Dorsi/Copertine visibile in Libreria', await sw());
  await p.locator('.dock [data-view="stats"]').click(); await p.waitForTimeout(400);
  ok('selettore Dorsi/Copertine nascosto in Statistiche', !(await sw()));
  await p.locator('.dock [data-view="novita"]').click(); await p.waitForTimeout(400);
  ok('selettore Dorsi/Copertine nascosto in Novità', !(await sw()));
  await p.locator('.dock [data-view="libreria"]').click(); await p.waitForTimeout(400);
  ok('selettore Dorsi/Copertine di nuovo visibile tornando in Libreria', await sw());
  ok('libreria: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function nuovoLibro(browser) {
  const p = await newPage(browser);
  await load(p, libri108().slice(0, 3));
  await p.locator('.dock [data-act="add"]').click(); await p.waitForSelector('#s-q'); await p.waitForTimeout(300);
  const cv = await stile(p, '#a-cv-more');
  ok('Nuovo libro: «Scegli un\'altra copertina» nascosto finché non c\'è una copertina', !cv || !cv.vis, JSON.stringify(cv));
  const btn = await p.evaluate(() => [...document.querySelectorAll('.sheet .search .btn')].map(b => b.textContent.trim()));
  ok('Nuovo libro: niente caratteri usati come icone nei pulsanti', btn.every(t => !/[▦■□▣▤▥]/.test(t)), btn.join(' | '));
  ok('Nuovo libro: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

export default async function run({ browser }) {
  await porta(browser);
  await etichette(browser);
  await libreria(browser);
  await nuovoLibro(browser);
}
