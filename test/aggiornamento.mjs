// Avviso di nuova versione: resta in alto anche con altri messaggi e «Aggiorna» ricarica la pagina.
import fs from 'node:fs';
import path from 'node:path';
import { APP, ROOT, ok, setOverride } from './lib.mjs';

export default async function ({ browser }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'allow' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto(APP + '/');
  await p.waitForFunction(() => navigator.serviceWorker.getRegistration().then(r => !!(r && r.active)), null, { timeout: 15000 });
  await p.reload();
  await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  // Il server pubblica un sw.js con una versione diversa: il browser la installa e la mette in attesa
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  setOverride('sw.js', sw.replace(/const VERSION = "([^"]+)"/, 'const VERSION = "$1-test"'));
  try {
    await p.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
    const shown = await p.waitForSelector('#upd-bar', { timeout: 20000 }).then(() => true, () => false);
    ok('nuova versione: compare l\'avviso in alto', shown);
    await p.evaluate(() => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = 'Libreria sincronizzata.'; document.body.append(t); });
    await p.waitForTimeout(12000);
    ok('l\'avviso resta dopo 12 s e con un altro messaggio', (await p.locator('#upd-bar').count()) === 1);
    await p.evaluate(() => { window.__prima = 1; });
    await p.click('#upd-bar [data-u="go"]');
    await p.waitForFunction(() => !window.__prima, null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(1500);
    ok('«Aggiorna» ricarica la pagina e l\'avviso sparisce', !(await p.evaluate(() => !!window.__prima)) && (await p.locator('#upd-bar').count()) === 0);
    ok('aggiornamento: nessun errore in console', !errs.length, errs.join(' / '));
  } finally {
    setOverride('sw.js', null);
    await ctx.close();
  }
}
