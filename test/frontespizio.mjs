// Scheda «Frontespizio»: frasi delle date, ritmo di lettura, struttura, aspetto, pagina, colophon, computer.
import { APP, ok, newPage, localBooks } from './lib.mjs';

const FIXED = new Date('2026-10-29T12:00:00');

async function puri(browser) {
  const p = await newPage(browser);
  await p.clock.setFixedTime(FIXED);
  await p.goto(APP + '/'); await p.waitForTimeout(300);
  const P = a => p.evaluate(a => window.libreriaScheda.period(a), a);
  const line = r => (r.lead + ' ' + (r.showStart ? r.startWord + r.startText : '') + (r.showEnd ? r.endWord + r.endText : '')).replace(/\s+/g, ' ').trim();
  let r = await P({ status: 'letto', started: '2025-03-10', finished: '2025-04-02', pages: 300 });
  ok('L1 stesso anno', line(r) === 'Letto dal 10 marzo al 2 aprile 2025' && r.sub === '24 giorni · 300 pagine' && r.sr === 'Letto dal 10 marzo 2025 al 2 aprile 2025, 24 giorni.', JSON.stringify(r));
  r = await P({ status: 'letto', started: '2024-12-10', finished: '2025-01-02' });
  ok('L1 anni diversi', line(r) === 'Letto dal 10 dicembre 2024 al 2 gennaio 2025' && r.sub === '24 giorni' && r.sr === 'Letto dal 10 dicembre 2024 al 2 gennaio 2025, 24 giorni.', JSON.stringify(r));
  r = await P({ status: 'letto', started: '2025-03-10', finished: '2025-03-10', pages: 300 });
  ok('L1 in un giorno', r.sub === 'In un giorno · 300 pagine', r.sub);
  r = await P({ status: 'letto', started: '2025-05-10', finished: '2025-05-01', pages: 200 });
  ok('L1 date storte: solo le pagine', line(r) === 'Letto dal 10 maggio al 1 maggio 2025' && r.sub === '200 pagine', line(r) + '|' + r.sub);
  r = await P({ status: 'letto', started: '', finished: '2025-01-02' });
  ok('L2', line(r) === 'Iniziato il scegli la data e finito il 2 gennaio 2025' && r.sr === 'Iniziato il: data da scegliere; finito il 2 gennaio 2025.', line(r) + '|' + r.sr);
  r = await P({ status: 'letto', started: '2025-03-10', finished: '', pages: 300 });
  ok('L3', line(r) === 'Iniziato il 10 marzo 2025 e finito il scegli la data' && r.sub === '300 pagine', line(r));
  r = await P({ status: 'letto', started: '', finished: '' });
  ok('L4', line(r) === 'Iniziato il scegli la data e finito il scegli la data' && r.sub === '', line(r));
  r = await P({ status: 'letto', started: '', finished: '', year: 2019 });
  ok('L5', r.lead === 'Letto nel 2019.' && line(r) === 'Letto nel 2019. Iniziato il scegli la data e finito il scegli la data' && r.sr.startsWith('Letto nel 2019. Iniziato il: data da scegliere'), line(r) + '|' + r.sr);
  r = await P({ status: 'in-lettura', started: '2026-10-12' });
  ok('R1', line(r) === 'In lettura dal 12 ottobre 2026' && !r.showEnd && r.sr === 'In lettura dal 12 ottobre 2026.', line(r) + '|' + r.sr);
  r = await P({ status: 'in-lettura', started: '' });
  ok('R2', line(r) === 'In lettura dal scegli la data', line(r));
  r = await P({ status: 'da-leggere', started: '2025-01-01' });
  ok('Da leggere', line(r) === 'Ancora da iniziare.' && !r.showStart && !r.showEnd && r.sub === '', line(r));
  r = await P({ status: 'letto', started: '2025-03-08', finished: '2025-03-11' });
  ok('elisione', line(r) === "Letto dall'8 marzo all'11 marzo 2025", line(r));
  r = await P({ status: 'letto', started: 'domenica', finished: '2025-01-02' });
  ok('data non valida = nessuna data', line(r) === 'Iniziato il scegli la data e finito il 2 gennaio 2025' && !p.errs.length, line(r) + p.errs.join());

  const T = a => p.evaluate(([a, o]) => { const S = window.libreriaScheda, r = S.pace(a, o); return { r, t: S.paceText(r, o) }; }, [a, '2026-10-29']);
  let x = await T({ started: '2026-10-12', page: 142, pages: 337 });
  ok('ritmo ok (ora legale)', x.r.why === 'ok' && x.r.day === 18 && x.r.eta === '2026-11-23' && x.t === '18º giorno di lettura, circa 8 pagine al giorno: a questo ritmo lo finisci verso il 23 novembre.', JSON.stringify(x));
  x = await T({ started: '2026-10-29', page: 5, pages: 300 });
  ok('ritmo today', x.r.why === 'today' && x.t === 'Primo giorno di lettura: la stima compare da domani.', JSON.stringify(x));
  let good = true;
  for (const s of ['', 'domenica', '2026-11-02']) { x = await T({ started: s, page: 5, pages: 300 }); good = good && x.r.why === 'no-start' && x.t === 'Scegli la data di inizio: qui comparirà quando potresti finirlo.'; }
  ok('ritmo no-start', good);
  x = await T({ started: '2026-10-12', page: 142 });
  ok('ritmo no-pages', x.r.why === 'no-pages' && x.t === '18º giorno di lettura. Aggiungi le pagine totali in «Modifica i dati del libro» per sapere quando lo finisci.', x.t);
  x = await T({ started: '2026-10-12', pages: 337 });
  ok('ritmo no-page', x.r.why === 'no-page' && x.t === '18º giorno di lettura. Scrivi a che pagina sei per sapere quando lo finisci.', x.t);
  x = await T({ started: '2026-10-12', page: 337, pages: 337 });
  ok('ritmo done', x.r.why === 'done' && x.t === "18º giorno di lettura: sei all'ultima pagina, segnalo come Letto.", x.t);
  good = true;
  for (const a of [{ started: '2026-10-28', page: 700, pages: 1000 }, { started: '2026-09-01', page: 10, pages: 300 }, { started: '2024-01-01', page: 500, pages: 1000 }, { started: '2026-10-20', page: 10, pages: 5000 }]) {
    x = await T(a); good = good && x.r.why === 'odd' && x.t === `${x.r.day}º giorno di lettura.`;
  }
  ok('ritmo odd (4 casi)', good);
  x = await T({ started: '2026-10-28', page: 700, pages: 1000 });
  ok('odd: 2º giorno', x.t === '2º giorno di lettura.', x.t);
  x = await T({ started: '2026-10-01', page: 58, pages: 200 });
  ok('ritmo con anno', x.r.eta === '2027-01-08' && x.t === "29º giorno di lettura, circa 2 pagine al giorno: a questo ritmo lo finisci verso l'8 gennaio 2027.", x.t);
  x = await T({ started: '2026-10-20', page: 90, pages: 95 });
  ok('ritmo domani', x.t === '10º giorno di lettura, circa 9 pagine al giorno: a questo ritmo lo finisci domani.', x.t);
  x = await T({ started: '2026-10-20', page: 10, pages: 40 });
  ok('ritmo 1 pagina', x.t === '10º giorno di lettura, circa 1 pagina al giorno: a questo ritmo lo finisci verso il 28 novembre.', x.t);
  await p.close2();
}

export default async function ({ browser }) {
  await puri(browser);
}
