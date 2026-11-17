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
  // v90: sul sito Firebase le pagine di accesso (/__/auth/…) stanno sullo stesso dominio: il service worker non deve metterle in cache
  setOverride('__/auth/handler', '<!doctype html><p>handler</p>');
  await p.evaluate(() => fetch('/__/auth/handler').then(r => r.text()));
  await p.waitForTimeout(300);
  const inCache = await p.evaluate(async () => { for (const k of await caches.keys()) { const c = await caches.open(k); if (await c.match('/__/auth/handler')) return true; } return false; });
  ok('service worker: le pagine di accesso di Firebase (/__/) non finiscono in cache', !inCache);
  setOverride('__/auth/handler', null);
  // v92: il modello Excel sempre dalla rete (mai in cache, mai sostituito da index.html se la rete è lenta)
  await p.evaluate(() => fetch('modello-libri.xlsx').then(r => r.arrayBuffer())); await p.waitForTimeout(300);
  ok('service worker: il modello Excel non finisce in cache', !(await p.evaluate(async () => { for (const k of await caches.keys()) if (await (await caches.open(k)).match('modello-libri.xlsx')) return true; return false; })));
  // v93: l'app si apre dalla copia sul telefono (niente attesa della rete); le versioni nuove arrivano con «Aggiorna»
  const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  // v93: cloud.js (la sincronizzazione) è tra i file di ogni versione, scaricato fresco: mai una sincronizzazione vecchia con un'app nuova
  ok('cloud.js è nella copia della versione', await p.evaluate(async () => { for (const k of await caches.keys()) if (k.startsWith('libreria-shell-') && await (await caches.open(k)).match('cloud.js')) return true; return false; }));
  try {
  setOverride('app.js', appJs + '\nwindow.__nuovo = 1;');
  await p.reload(); await p.waitForSelector('#main');
  ok('apertura dalla copia sul telefono: il codice non aspetta la rete', !(await p.evaluate(() => window.__nuovo)));
  // v93: tornando nell'app (dal sottofondo) controlla se c'è una versione nuova, al massimo ogni 5 minuti
  const controlli = await p.evaluate(async () => {
    let n = 0; const orig = ServiceWorkerRegistration.prototype.update; ServiceWorkerRegistration.prototype.update = function () { n++; return Promise.resolve(); };
    const vai = () => document.dispatchEvent(new Event('visibilitychange'));
    vai(); await new Promise(r => setTimeout(r, 300)); const subito = n;
    const ora = Date.now; Date.now = () => ora() + 6 * 60e3; vai(); await new Promise(r => setTimeout(r, 300)); Date.now = ora;
    ServiceWorkerRegistration.prototype.update = orig; return [subito, n];
  });
  ok('tornando nell\'app controlla gli aggiornamenti (non più di una volta ogni 5 minuti)', controlli[0] === 0 && controlli[1] === 1, JSON.stringify(controlli));
  // Il server pubblica un sw.js con una versione diversa: il browser la installa e la mette in attesa
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  setOverride('sw.js', sw.replace(/const VERSION = "([^"]+)"/, 'const VERSION = "$1-test"'));
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
    ok('con la versione nuova arriva anche il codice nuovo', await p.evaluate(() => window.__nuovo === 1));
    const ver = sw.match(/const VERSION = "([^"]+)"/)[1] + '-test';
    await p.locator('.dock .more').click();
    const scritta = await p.waitForFunction(() => document.querySelector('#i-ver') && document.querySelector('#i-ver').textContent, null, { timeout: 5000 }).then(h => h.jsonValue(), () => '');
    ok('dopo l\'aggiornamento Altro mostra la nuova versione', scritta === "Versione " + ver, scritta);
    ok('aggiornamento: nessun errore in console', !errs.length, errs.join(' / '));
  } finally {
    setOverride('sw.js', null); setOverride('app.js', null);
    await ctx.close();
  }
}
