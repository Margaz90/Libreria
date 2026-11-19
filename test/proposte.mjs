// «Cosa leggo adesso?» più essenziale (v105): puntini sotto la scheda al posto delle linguette (restano linguette per VoiceOver),
// criterio scritto nella scheda, «Non ora» come × accanto al titolo; la scheda di «Scegli per me» non cambia.
import { APP, ok, newPage, libri108 } from './lib.mjs';

const box = (p, s) => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; }, s);

async function hero(browser, dark) {
  const tag = dark ? 'scuro' : 'chiaro';
  const p = await newPage(browser, { dark });
  await p.goto(APP + '/'); await p.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)), libri108());
  await p.reload(); await p.waitForSelector('#hero .next'); await p.waitForTimeout(400);
  const card = await box(p, '#hero .ncard:not([hidden])'), dots = await box(p, '#hero [role=tablist]'), tab = await box(p, '#hero [role=tab]');
  ok(`${tag}: puntini sotto la scheda`, dots && card && dots.top >= card.bottom - 2, JSON.stringify({ card, dots }));
  ok(`${tag}: ogni puntino si tocca bene ma è stretto (niente scritta visibile)`, tab.h >= 44 && tab.w <= 32, JSON.stringify(tab));
  ok(`${tag}: le linguette hanno ancora il loro nome per VoiceOver`, (await p.locator('#hero [role=tab]').allTextContents()).join('|') === 'Affine|Il più vecchio|A caso');
  ok(`${tag}: il criterio è scritto nella scheda`, /Affine ai tuoi gusti/.test(await p.locator('#hero .ncard:not([hidden]) .ncrit').innerText().catch(() => '')));
  await p.locator('#hero [role=tab]').nth(1).click(); await p.waitForTimeout(300);
  ok(`${tag}: cambiando proposta cambia il criterio`, /Il più vecchio in pila/.test(await p.locator('#hero .ncard:not([hidden]) .ncrit').innerText().catch(() => '')));
  const x = await box(p, '#n-later'), h3 = await box(p, '#hero h3');
  ok(`${tag}: «Non ora» è una × accanto al titolo, da 44 px`, x && h3 && Math.abs(x.top + x.h / 2 - (h3.top + h3.h / 2)) <= 12 && x.h >= 44 && x.w >= 44 && (await p.getAttribute('#n-later', 'aria-label')) === 'Non ora', JSON.stringify({ x, h3 }));
  ok(`${tag}: in basso restano «Inizia» e «Altre proposte»`, (await p.locator('#hero .nfoot button').count()) === 2);
  const h = (await box(p, '#hero')).h;
  ok(`${tag}: il riquadro è più basso (era 290 px)`, h <= 270, String(h));
  ok(`${tag}: niente scorrimento orizzontale`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await p.locator('[data-choose]').first().click(); await p.waitForSelector('.sheet .next');
  const st = await box(p, '.sheet [role=tab]');
  ok(`${tag}: «Scegli per me» tiene le linguette con il nome`, st.w > 60 && /Affine/.test(await p.locator('.sheet [role=tab]').first().innerText()));
  ok(`${tag}: nessun errore in console`, !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

export default async function run({ browser }) {
  await hero(browser, false);
  await hero(browser, true);
}
