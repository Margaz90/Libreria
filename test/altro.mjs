// «Altro» riordinato (v96): riquadro del profilo con l'obiettivo, gruppi «I miei libri» e «Strumenti», pagine interne
// con «‹ Altro», Account con le azioni di uscita in fondo.
import { APP, ok, newPage, resetCloud } from './lib.mjs';

const Y = new Date().getFullYear();
const load = async (p, books, set = null) => {
  await p.goto(APP + '/');
  await p.evaluate(([b, s]) => { localStorage.setItem('libreria-diego-v1', JSON.stringify(b)); if (s) localStorage.setItem('libreria-settings', JSON.stringify(s)); }, [books, set]);
  await p.reload(); await p.waitForSelector('#main'); await p.waitForTimeout(300);
};
const altro = async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.locator('.dock .more').click(); await p.waitForSelector('.sheet [data-m=sync]'); };
const testo = (p, sel) => p.locator(sel).first().innerText().then(t => t.replace(/\s+/g, ' ').trim(), () => '');
const libri = [
  { id: 'a1', title: 'Uno', author: 'A', status: 'letto', rating: 4, finished: `${Y}-02-10`, added: 1 },
  { id: 'a2', title: 'Due', author: 'B', status: 'da-leggere', added: 2 },
  { id: 'a3', title: 'Tre', author: 'C', status: 'in-lettura', added: 3 },
  { id: 'a4', title: 'Desiderio', author: 'D', status: 'desiderato', added: 4 },
];

async function pagina(browser, { dark = false } = {}) {
  const tag = dark ? 'scuro' : 'chiaro';
  const p = await newPage(browser, { dark });
  await load(p, libri);
  await altro(p);
  ok(`${tag}: «Account» sopra il riquadro del profilo`, await p.evaluate(() => {
    const l = document.querySelector('.sheet .profilo-label'), c = document.querySelector('.sheet [data-m=sync]');
    return !!l && /Account/i.test(l.textContent) && !!(l.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING);
  }));
  const card = await testo(p, '.sheet [data-m=sync]');
  ok(`${tag}: riquadro senza accesso: nome di ripiego e invito ad accedere`, /La mia libreria/.test(card) && /Accedi/.test(card), card);
  ok(`${tag}: riquadro: libri e letti dell'anno (la lista dei desideri non conta)`, new RegExp(`3 libri · 1 letto nel ${Y}`).test(card), card);
  ok(`${tag}: senza obiettivo: anello con «+» e invito a fissarlo`, /\+/.test(await testo(p, '.sheet [data-m=goal]')) && new RegExp(`Fissa un obiettivo per il ${Y}`).test(await testo(p, '.sheet .goal-row')));
  const gruppi = await p.locator('.sheet .glabel').allInnerTexts();
  ok(`${tag}: gruppi «I miei libri» e «Strumenti»`, gruppi.some(g => /I miei libri/i.test(g)) && gruppi.some(g => /Strumenti/i.test(g)), gruppi.join(' | '));
  const voci = await p.locator('.sheet .menu-list [data-m]').evaluateAll(l => l.map(b => b.dataset.m));
  ok(`${tag}: voci nell'ordine Carica, Backup, Annulla, Copertine e serie, Come funziona`, voci.join() === 'carica,backup,annulla,copertine,aiuto', voci.join());
  ok(`${tag}: niente «Invitati» per chi non è l'amministratore`, (await p.locator('.sheet [data-m=inv]').count()) === 0);
  ok(`${tag}: privacy e versione in fondo`, (await p.locator('.sheet a[href="privacy.html"]').count()) === 1 && (await p.locator('.sheet #i-ver').count()) === 1);
  ok(`${tag}: niente scorrimento orizzontale`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.sheet').scrollWidth <= document.querySelector('.sheet').clientWidth + 1));
  ok(`${tag}: nessun errore in console`, !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function pagineInterne(browser) {
  const p = await newPage(browser);
  await load(p, libri, { goals: { [Y]: 5 } });
  await altro(p);
  const anello = await testo(p, '.sheet [data-m=goal]');
  ok('obiettivo fissato: l\'anello dice 1 di 5', /\b1\b/.test(anello) && /di 5/.test(anello), anello);
  ok('obiettivo fissato: riga «Obiettivo · Cambia»', new RegExp(`Obiettivo ${Y}.*Cambia`).test(await testo(p, '.sheet .goal-row')));
  await p.locator('.sheet .goal-row button').click(); await p.waitForSelector('#g-n');
  ok('«Cambia» apre l\'obiettivo, con «‹ Altro»', await p.inputValue('#g-n') === '5' && (await p.locator('.sheet .indietro').count()) === 1);
  await p.click('#g-close'); await p.waitForTimeout(250);

  const apri = async m => { await altro(p); await p.locator(`.sheet [data-m=${m}]`).click(); await p.waitForTimeout(150); };
  await apri('backup');
  ok('Backup: esporta, senza gli strumenti delle copertine', (await p.locator('#i-export').count()) === 1 && (await p.locator('#i-covers, #i-redo, #i-series, #u-list').count()) === 0);
  await p.locator('.sheet .indietro').click(); await p.waitForTimeout(150);
  ok('«‹ Altro» torna alla pagina Altro', (await p.locator('.sheet [data-m=sync]').count()) === 1);
  await p.locator('.sheet [data-m=annulla]').click(); await p.waitForSelector('#u-list, #u-none');
  ok('Annulla una modifica: elenco delle copie, niente altro', (await p.locator('#i-export, #i-redo').count()) === 0);
  await p.click('#i-close'); await p.waitForTimeout(250);
  await apri('copertine');
  ok('Copertine e serie: gli strumenti ci sono tutti', (await p.locator('#i-redo').count()) === 1 && (await p.locator('#i-series').count()) === 1 && (await p.locator('#i-verify').count()) === 1 && (await p.locator('#v-status').count()) === 1);
  ok('Copertine e serie: «Verifica le ricerche» sotto «Se qualcosa non va»', /Se qualcosa non va/i.test(await testo(p, '.sheet')));
  await p.click('#i-close'); await p.waitForTimeout(250);
  await apri('carica');
  ok('Carica libri: la scheda con il file e il modello Excel, con «‹ Altro»', (await p.locator('#i-file').count()) === 1 && (await p.locator('a[href="modello-libri.xlsx"]').count()) === 1 && (await p.locator('.sheet .indietro').count()) === 1);
  await p.click('#i-close'); await p.waitForTimeout(250);
  await apri('sync');
  ok('riquadro senza accesso: apre la scheda di accesso, con «‹ Altro»', (await p.locator('#sy-email, #sy-google').count()) > 0 && (await p.locator('.sheet .indietro').count()) === 1);
  // misura a scheda ferma: durante l'animazione di apertura la scheda è ancora rimpicciolita
  const alto = await p.waitForFunction(() => { const e = document.querySelector('.sheet .indietro'); return e && e.getBoundingClientRect().height >= 44; }, null, { timeout: 2000 }).then(() => true, () => false);
  ok('«‹ Altro» alto almeno 44 px', alto);
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  ok('pagine interne: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function account(browser) {
  resetCloud();
  const p = await newPage(browser, { init: { fn: () => { if (!localStorage.getItem('fake-init')) { localStorage.setItem('fake-init', '1'); localStorage.setItem('fake-popup', 'ok'); localStorage.setItem('fake-uid', 'u1'); localStorage.setItem('fake-name', 'Anna'); } } } });
  await load(p, libri);
  await altro(p); await p.locator('.sheet [data-m=sync]').click();
  await p.waitForFunction(() => document.querySelector('#sy-google') && !document.querySelector('#sy-google').disabled, null, { timeout: 15000 }).catch(() => {});
  await p.click('#sy-google');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('libreria-cloud') || '{}').email, null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(800);
  if (await p.locator('.sheet').count()) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  await altro(p);
  const card = await testo(p, '.sheet [data-m=sync]');
  ok('collegato: il riquadro dice «Collegato» e l\'email', /Collegato/.test(card) && /@/.test(card), card);
  await p.locator('.sheet [data-m=sync]').click(); await p.waitForSelector('#sy-out');
  ok('Account: «‹ Altro», il tuo nome, sincronizza', (await p.locator('.sheet .indietro').count()) === 1 && (await p.locator('.sheet [data-m=nome]').count()) === 1 && (await p.locator('#sy-now').count()) === 1);
  ok('Account: «Esci» ed «Elimina» in fondo, sotto «Uscita», dopo «Sincronizza ora»', await p.evaluate(() => {
    const z = document.querySelector('.sheet .uscita'), now = document.querySelector('#sy-now');
    return !!z && /Uscita/i.test(z.textContent) && z.contains(document.querySelector('#sy-out')) && z.contains(document.querySelector('#sy-del')) && !!(now.compareDocumentPosition(z) & Node.DOCUMENT_POSITION_FOLLOWING);
  }));
  await p.setViewportSize({ width: 390, height: 600 });
  await p.evaluate(() => { document.querySelector('#sy-info').textContent = 'Modifiche non ancora inviate: no · libri nel cloud: 171 · aggiornato alle 17:33 (copia locale: nessuna rete)'; });
  await p.waitForTimeout(100);
  ok('Account su schermo basso: lo stato su più righe non finisce sotto «Privacy»', await p.evaluate(() => {
    const el = [...document.querySelector('.sheet').children].filter(e => e.offsetHeight);
    return el.every(e => e.scrollHeight <= e.clientHeight + 1 || getComputedStyle(e).overflowY !== 'visible')
      && el.every((e, i) => !i || e.getBoundingClientRect().top >= el[i - 1].getBoundingClientRect().top + el[i - 1].scrollHeight - 1);
  }));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.locator('.sheet [data-m=nome]').click(); await p.waitForSelector('#nome-in');
  ok('Account → Il tuo nome apre la scheda del nome', true);
  ok('account: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

async function schermoBasso(browser) {
  const p = await newPage(browser, { width: 390, height: 600 });
  await load(p, libri, { goals: { [Y]: 5 } });
  await altro(p);
  const tagliati = () => p.evaluate(() => [...document.querySelectorAll('.sheet .menu-list, .sheet .profilo')].filter(l => l.scrollHeight > l.clientHeight + 1).length);
  ok('schermo basso: nessun elenco schiacciato, la scheda scorre', await tagliati() === 0 && await p.evaluate(() => { const s = document.querySelector('.sheet'); return s.scrollHeight > s.clientHeight; }));
  await p.locator('.sheet [data-m=copertine]').click(); await p.waitForTimeout(200);
  ok('schermo basso: Copertine e serie senza elementi sovrapposti', await p.evaluate(() => {
    const el = [...document.querySelector('.sheet').children].filter(e => e.offsetHeight);
    return el.every((e, i) => !i || e.getBoundingClientRect().top >= el[i - 1].getBoundingClientRect().bottom - 1);
  }));
  ok('schermo basso: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  await p.close2();
}

export default async function run({ browser }) {
  await pagina(browser);
  await pagina(browser, { dark: true });
  await pagineInterne(browser);
  await schermoBasso(browser);
  await account(browser);
}
