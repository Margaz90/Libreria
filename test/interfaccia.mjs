// Interfaccia: telefono e computer, chiaro e scuro, con 108 libri di prova; «Carica i libri» con il modello Excel (v92).
import { APP, ok, newPage, localBooks, libri108 } from './lib.mjs';
import { creaXlsx } from './xlsx.mjs';

// v92: «Carica i libri» da libreria vuota: modello, foglio Excel con un valore non valido, CSV Windows-1252, foglio senza colonne
async function carica(browser) {
  let p = await newPage(browser);
  await p.goto(APP + '/');
  const vuota = await p.locator('#notice').innerText();
  ok('libreria vuota: «Carica i libri», niente più i 108 libri Goodreads', (await p.locator('#notice #carica-go').count()) === 1 && !/108|Carica i libri Goodreads/.test(vuota), vuota);
  const apri = async () => { await p.click('#carica-go'); await p.waitForSelector('.sheet #i-file'); };
  await apri();
  const h2 = await p.locator('.sheet h2').first().innerText(), link = p.locator('.sheet a[href="modello-libri.xlsx"][download][target="_blank"][rel="noopener"]'); // nell'app installata su iPhone si apre in una vista con «Fine»
  const stato = await p.evaluate(() => fetch('modello-libri.xlsx').then(r => r.status));
  ok('«Carica i libri» apre la scheda con il modello Excel da scaricare', h2 === 'Carica i libri' && (await link.count()) === 1 && stato === 200, `${h2} ${await link.count()} ${stato}`);
  const C = (r, v) => `<c r="${r}" t="inlineStr"><is><t>${v}</t></is></c>`, N = (r, v) => `<c r="${r}"><v>${v}</v></c>`;
  const testa = ['Titolo', 'Autore', 'Stato', 'Voto', 'Data di fine', 'ISBN'].map((t, i) => C('ABCDEF'[i] + '1', t)).join('');
  const x = creaXlsx({ fogli: [{ nome: 'Libri', celle: `<row r="1">${testa}</row>`
    + `<row r="2">${C('A2', 'Primo letto')}${C('B2', 'Anna Prova')}${C('C2', 'Letto')}${N('D2', 4)}${N('E2', 45691)}${N('F2', '9.7888046682370005E+12')}</row>`
    + `<row r="3">${C('A3', 'In corso')}${C('B3', 'Bruno Prova')}${C('C3', 'In lettura')}</row>`
    + `<row r="4">${C('A4', 'Voto strano')}${C('B4', 'Carla Prova')}${C('C4', 'Da leggere')}${N('D4', 6)}</row>` }] });
  await p.setInputFiles('#i-file', { name: 'libri.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(x) });
  await p.waitForFunction(() => /Pronti/.test(document.querySelector('#i-status').textContent), null, { timeout: 5000 }).catch(() => {});
  const msg = await p.locator('.sheet').innerText();
  ok('foglio Excel: avviso sul valore non valido, con riga e colonna', /1 valore non valido lasciato vuoto/.test(msg) && /riga 4, Voto: «6»/.test(msg) && /Pronti: 3 libri nuovi/.test(msg), msg);
  await p.click('#i-go');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').length === 3, null, { timeout: 5000 }).catch(() => {});
  const lb = await localBooks(p), f = t => lb.find(b => b.title === t) || {};
  ok('foglio Excel: libri con stato, voto, data e ISBN giusti', lb.length === 3 && f('Primo letto').status === 'letto' && f('Primo letto').rating === 4 && f('Primo letto').finished === '2025-02-03'
    && f('Primo letto').isbn === '9788804668237' && f('In corso').status === 'in-lettura' && f('Voto strano').status === 'da-leggere' && !f('Voto strano').rating, JSON.stringify(lb));
  const errs = [...p.errs]; await p.close2();
  p = await newPage(browser); await p.goto(APP + '/'); await p.waitForSelector('#carica-go');
  await apri();
  const csv = Buffer.concat([Buffer.from('Titolo;Autore\n', 'latin1'), Buffer.from([0x50, 0x65, 0x72, 0xF2, 0x3B, 0x45, 0x63, 0x6F, 0x0A])]); // «Però;Eco» in Windows-1252
  await p.setInputFiles('#i-file', { name: 'libri.csv', mimeType: 'text/csv', buffer: csv });
  await p.waitForFunction(() => /Pronti/.test(document.querySelector('#i-status').textContent), null, { timeout: 5000 }).catch(() => {});
  await p.click('#i-go'); await p.waitForFunction(() => JSON.parse(localStorage.getItem('libreria-diego-v1') || '[]').length === 1, null, { timeout: 5000 }).catch(() => {});
  ok('CSV di Excel con punto e virgola e accenti in Windows-1252', (await localBooks(p)).some(b => b.title === 'Però' && b.author === 'Eco'), JSON.stringify(await localBooks(p)));
  errs.push(...p.errs); await p.close2();
  p = await newPage(browser); await p.goto(APP + '/'); await p.waitForSelector('#carica-go');
  await apri();
  const y = creaXlsx({ fogli: [{ nome: 'Foglio1', celle: `<row r="1">${C('A1', 'Nome')}${C('B1', 'Cosa')}</row><row r="2">${C('A2', 'x')}${C('B2', 'y')}</row>` }] });
  await p.setInputFiles('#i-file', { name: 'altro.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(y) });
  await p.waitForTimeout(600);
  ok('foglio senza le colonne Titolo e Autore: messaggio chiaro, niente import', /Non trovo le colonne Titolo e Autore: usa il modello\./.test(await p.locator('#i-status').innerText()) && await p.locator('#i-go').isDisabled(), await p.locator('#i-status').innerText());
  errs.push(...p.errs);
  // v95: la privacy è raggiungibile dalla porta d'ingresso e da Altro, e la pagina risponde
  const Pp = await newPage(browser, { init: { fn: () => { window.libreriaPorta = true; } } });
  await Pp.goto(APP + '/'); await Pp.waitForSelector('#porta', { timeout: 8000 }).catch(() => {});
  const daPorta = await Pp.locator('#porta a[href="privacy.html"]').count();
  const risposta = await Pp.evaluate(() => fetch('privacy.html').then(r => r.status));
  await Pp.close2();
  const Pa = await newPage(browser); await Pa.goto(APP + '/'); await Pa.locator('.dock .more').click(); await Pa.waitForTimeout(300);
  const daAltro = await Pa.locator('.sheet a[href="privacy.html"]').count();
  await Pa.close2();
  ok('privacy: collegata dalla porta d\'ingresso e da Altro, la pagina risponde', daPorta === 1 && daAltro === 1 && risposta === 200, JSON.stringify([daPorta, daAltro, risposta]));
  ok('«Carica i libri»: nessun errore in console', !errs.length, errs.join(' / '));
  await p.close2();
}

export default async function ({ browser }) {
  await carica(browser);
  for (const [width, height] of [[390, 844], [1366, 860]]) for (const dark of [false, true]) {
    const tag = `${width}px ${dark ? 'scuro' : 'chiaro'}`;
    const p = await newPage(browser, { width, height, dark });
    await p.goto(APP + '/');
    // v89: a libreria vuota l'accesso viene prima del caricamento (dopo aver tolto l'app dalla Home i libri tornano dal cloud)
    const vuota = await p.locator('#notice').innerText();
    ok(`${tag}: libreria vuota, prima l'accesso`, /Hai già usato MyLibrary\?/.test(vuota) && await p.locator('#notice #vuota-sync.primary').count() === 1 && !(await p.locator('#carica-go').getAttribute('class')).includes('primary'), vuota);
    if (width < 1024 && !dark) {
      await p.click('#vuota-sync'); await p.waitForTimeout(300);
      ok(`${tag}: «Accedi» apre la scheda dell'accesso`, /Accedi e sincronizza/.test(await p.locator('.sheet h2').first().innerText()));
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      await p.evaluate(() => localStorage.setItem('libreria-cloud', JSON.stringify({ email: 'diego@example.com' })));
      await p.reload(); await p.waitForSelector('#notice');
      const coll = await p.locator('#notice').innerText();
      ok(`${tag}: già collegato, niente invito all'accesso`, !(await p.locator('#vuota-sync').count()) && /diego@example\.com/.test(coll) && (await p.locator('#notice #carica-go.primary').count()) === 1, coll);
      await p.evaluate(() => localStorage.removeItem('libreria-cloud'));
    }
    await p.evaluate(b => localStorage.setItem('libreria-diego-v1', JSON.stringify(b)), libri108());
    await p.reload(); await p.waitForSelector('#main [data-id]');
    await p.waitForTimeout(400);
    ok(`${tag}: 108 libri di prova sugli scaffali`, (await localBooks(p)).length === 108);
    ok(`${tag}: scaffale in legno (asse con immagine SVG)`, /svg\+xml/.test(await p.evaluate(() => getComputedStyle(document.querySelector('#main .row')).backgroundImage)));
    ok(`${tag}: i libri compaiono sugli scaffali`, (await p.locator('#main [data-id]').count()) >= 15);
    ok(`${tag}: niente scorrimento orizzontale`, await p.evaluate(w => document.documentElement.scrollWidth <= w && innerWidth <= w, width));
    ok(`${tag}: titoli in Fraunces`, /Fraunces/.test(await p.evaluate(() => getComputedStyle(document.querySelector('h1')).fontFamily)));
    if (width < 1024) {
      await p.locator('.dock .more').click();
      ok(`${tag}: «Accedi e sincronizza» è la prima voce di Altro`, (await p.locator('.sheet [data-m]').first().getAttribute('data-m')) === 'sync');
      await p.keyboard.press('Escape');
    }
    ok(`${tag}: nessun errore in console`, !p.errs.length, p.errs.join(' / '));
    await p.close2();
  }
}
