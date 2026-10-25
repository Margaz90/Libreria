// Strumenti comuni ai test: server dell'app, finto Firestore, Playwright e conteggio dei risultati.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const APP = 'http://localhost:8765';
export const API = 'http://localhost:8766';
export const STUB = fs.readFileSync(path.join(ROOT, 'test', 'firebase-stub.js'), 'utf8');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const overrides = new Map(); // percorso → contenuto sostitutivo (es. un sw.js con una versione nuova)
export const setOverride = (p, body) => body == null ? overrides.delete(p) : overrides.set(p, body);

const store = new Map(); // dati del finto Firestore: "users/u1/books/b1" → documento
export const resetCloud = () => store.clear();
export const putDoc = (p, data) => store.set(p, data);

// Avvia il server dei file dell'app (8765) e il finto Firestore (8766); restituisce una funzione per spegnerli.
export async function startServers() {
  const app = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, APP).pathname).replace(/^\/+/, '') || 'index.html';
    if (overrides.has(p)) { res.setHeader('Content-Type', TYPES[path.extname(p)] || 'text/plain'); return res.end(overrides.get(p)); }
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('non trovato'); }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(file).pipe(res);
  });
  const api = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
    if (req.method === 'OPTIONS') return res.end();
    const u = new URL(req.url, API), p = u.searchParams.get('path') || '';
    if (u.pathname === '/doc' && req.method === 'GET') { const d = store.get(p); return res.end(JSON.stringify(d === undefined ? { exists: false } : { exists: true, data: d })); }
    if (u.pathname === '/doc' && req.method === 'PUT') { let body = ''; for await (const c of req) body += c; const v = JSON.parse(body || 'null'); if (v === null) store.delete(p); else store.set(p, v); return res.end('{}'); }
    if (u.pathname === '/col') { const pre = p + '/', out = []; for (const [k, v] of store) if (k.startsWith(pre) && !k.slice(pre.length).includes('/')) out.push({ id: k.slice(pre.length), data: v }); return res.end(JSON.stringify(out)); }
    res.statusCode = 404; res.end('{}');
  });
  await Promise.all([new Promise(r => app.listen(8765, r)), new Promise(r => api.listen(8766, r))]);
  return () => Promise.all([new Promise(r => app.close(r)), new Promise(r => api.close(r))]);
}

// Risultati: ogni controllo stampa OK o FAIL; il totale decide il codice di uscita.
export const results = { pass: 0, fail: 0 };
export function ok(name, cond, extra = '') {
  results[cond ? 'pass' : 'fail']++;
  console.log((cond ? '  OK   ' : '  FAIL ') + name + (extra ? '  · ' + extra : ''));
}

export const wait = (fn, ms = 8000) => new Promise((res, rej) => {
  const t0 = Date.now();
  const tick = async () => { try { if (await fn()) return res(true); } catch {} if (Date.now() - t0 > ms) return rej(new Error('timeout')); setTimeout(tick, 150); };
  tick();
});

// Nuova pagina con il finto Firebase al posto dell'SDK e le ricerche esterne bloccate (a meno che il test non le simuli).
export async function newPage(browser, { width = 390, height = 844, dark = false, standalone = false, init = null, external = 'abort' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: dark ? 'dark' : 'light', isMobile: width < 500, hasTouch: width < 500, serviceWorkers: 'block' });
  if (standalone) await ctx.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
  if (init) await ctx.addInitScript(init.fn, init.arg);
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource|ERR_/.test(m.text())) p.errs.push(m.text()); });
  await p.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ contentType: 'application/javascript', body: /app-compat/.test(r.request().url()) ? STUB : '' }));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort()); // i test non dipendono dalla rete
  if (external === 'abort') await p.route(/www\.googleapis\.com\/books|itunes\.apple\.com|openlibrary\.org|mzstatic\.com/, r => r.abort());
  p.close2 = () => ctx.close();
  return p;
}

export const localBooks = p => p.evaluate(() => JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]'));
export const toastText = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
