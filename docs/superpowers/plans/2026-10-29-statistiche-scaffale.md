# Statistiche come «Scaffale degli anni» — piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ridisegnare la sezione Statistiche come «un'altra stanza della libreria»: incipit, una mensola in legno per anno con i dorsi toccabili e paginati, «Sempre» senza riquadri e un racconto con i dorsi che cadono sull'asse.

**Architecture:** `computeStats` resta pura (un solo campo in più, `sempre.authors[].books`). Nuove funzioni pure `statDim`/`ysRows` decidono misure e file dei dorsi; `renderStats` (stessa firma) si riscrive con `ledeHTML`, `yearHTML`, `miniSpines`; `statsLast` + `replaceYear` ridisegnano una sola mensola per «Mostra altri 15». `openStory` cambia solo aspetto (palco, navigazione in basso). Tutto in `app.js` e `style.css`, test Playwright in `test/statistiche.mjs`.

**Tech Stack:** JavaScript puro (PWA senza build), CSS, Playwright (Chromium) per i test.

**Spec:** `docs/superpowers/specs/2026-10-29-statistiche-scaffale-design.md` (prototipo `design/proposte/statistiche.html`, variante A; screenshot `design/proposte/img/statistiche-A.png`, `statistiche-A-scuro.png`, `statistiche-A-1366.png`, `statistiche-racconto-A.png`).

## Global Constraints

- Tutto in italiano: testi dell'interfaccia, commenti, commit.
- Lavoro in un git worktree separato creato dal branch `claude/youthful-ride-ha414a`, branch `impl/statistiche` (es. `git worktree add /home/user/Libreria-statistiche -b impl/statistiche claude/youthful-ride-ha414a`); un solo agente esegue tutto il piano.
- Altri due agenti modificano in parallelo `app.js` e `style.css` (scheda del libro; «Cosa leggo adesso?»). Si toccano SOLO i punti della sezione «File toccati» della spec: `computeStats` (solo `authors[].books`), `window.libreriaStats`, `spineHTML` (parametro `dim`), il blocco tra `window.libreriaStats` e `openStory` (incluse le nuove funzioni), `openStory`, la riga Statistiche di `render()`, i due gestori `[data-more]`/`[data-less]` di `wireMain`, la nuova `replaceYear` (con i due aiutanti del focus) accanto a `replaceShelf`; in `style.css` il blocco Statistiche (`/* Statistiche */` … `.panel .hint…`), `.pager-btn`, il blocco del racconto (`#story` … `#story button:focus-visible`) e il solo token `--board-img` di `:root` (Task 6). Non riformattare, rinominare o spostare altro codice.
- NON modificare `VERSION` in `sw.js` né `CLAUDE.md`: li aggiorna Diego all'unione.
- Ogni compito: test che fallisce → codice → test che passa → commit in italiano sul branch `impl/statistiche`.
- Test di un gruppo: `node test/run.mjs statistiche`; i test avviano da soli i server 8765/8766: nel worktree non lanciare mai due gruppi contemporaneamente.
- `computeStats(books, oggi)` resta pura e `window.libreriaStats.compute` non cambia firma; i calcoli e le regole sui dati sono quelli della v47.
- Testi solo con i token controllati da `contrasto.mjs` (`--ink`, `--muted`, `--title`, `--accent`, `--accent-ink` su `--accent`); `--coral` solo per linee e segnalibri decorativi.
- Bersagli: «Il racconto» 44 px, `.pager-btn` 44 px ovunque (anche negli scaffali), dorsi alti ≥ 84 px e larghi ≥ 20 px, frecce del racconto 48 px, ✕ 44 px.
- Movimento solo nel racconto e solo con `prefers-reduced-motion: no-preference`; lo scorrimento di «Nascondi» rispetta la stessa preferenza.
- Ogni testo dei libri (titolo, autore, genere) passa da `esc()`; numeri con `num()` (punto delle migliaia), medie con `dec()`.
- Peso: circa +2,5 KB non compressi in tutto (criterio massimo +3–4 KB tra `app.js` e `style.css`), nessuna libreria, nessun font in più.
- Ultimo compito obbligatorio: `node test/run.mjs` completa tutta verde nel worktree; nessun errore in console; screenshot a 390×844 e 1366×860, chiaro e scuro, confrontati con la variante A del prototipo; `node .claude/hooks/contrasto.mjs style.css` senza problemi.

## Review Focus

1. Un anno con molti libri tutti da 900 pagine o tutti senza pagine, su uno schermo da 320 px: le file si dividono a 300 unità e la pagina non scorre di lato (test nel Task 1 e nel Task 3).
2. Titoli, autori e generi con caratteri HTML (`<b>`, `&`, virgolette) nell'incipit, nella riga dell'anno, nelle etichette dei dorsi e in Autori: compaiono come testo, nessun elemento iniettato (test nel Task 2 e nel Task 3).
3. Il solo libro di un anno rimesso «Da leggere» dal menu rapido dalla mensola: la mensola sparisce, il focus va sul titolo «Statistiche» e non ci sono errori (test nel Task 4).
4. «Mostra altri 15» e poi un salvataggio dalla scheda: dopo il ricalcolo la mensola mostra ancora i libri aperti (limiti `y…` conservati) (test nel Task 5).
5. Il preferito dell'anno oltre le prime 170 unità del palco del racconto: prende il posto dell'ultimo dorso, così nella schermata «preferito» esce davvero dallo scaffale (test nel Task 6).

---

### Task 1: Dati e misure dei dorsi (funzioni pure)

**Files:**
- Modify: `app.js` — `computeStats` (riga ~1095: `authors: groups(read, "author").map(...)`), `window.libreriaStats` (riga ~1109); nuove `statDim`, `ysRows` subito dopo `window.libreriaStats`
- Test: `test/statistiche.mjs` (funzione `calcoli`)

**Interfaces:**
- Produces:
  - `sempre.authors[i].books: Book[]` — libri dell'autore, ordine `recent` (fine, poi `updated`; i soli anno dopo le date dello stesso anno).
  - `statDim(b: Book) → { u: number, w: string, h: number }` — `p = Number(b.pages) || 0`; `u = p > 0 ? clamp(Math.round(p / 14), 20, 44) : 20`; `w = (u / 3.4).toFixed(2) + "%"`; `h = p > 0 ? Math.round(84 + Math.min(p, 900) / 900 * 32) : 92`.
  - `ysRows(list: Book[]) → Book[][]` — in ordine, nuova fila quando la somma delle `u` supererebbe 300; mai file vuote; `[]` per lista vuota.
  - `window.libreriaStats = Object.freeze({ compute: computeStats, dim: statDim, rows: ysRows })`.

- [ ] **Step 1: Scrivi i test in `calcoli`** (dopo «autori: libri, pagine e voto medio»):
  ```js
  ok('autori: libri di Stephen King dal più recente', S.authors[0].books.map(b => b.id).join() === 'Cinque,Sei');
  const dim = (b) => p.evaluate(x => window.libreriaStats.dim(x), b);
  ok('dorso senza pagine: 20 unità, 5.88%, 92 px', J(await dim({})) === J({ u: 20, w: '5.88%', h: 92 }));
  ok('dorso 100 pagine: larghezza minima, 88 px', J(await dim({ pages: 100 })) === J({ u: 20, w: '5.88%', h: 88 }));
  ok('dorso 900 pagine: 44 unità, 12.94%, 116 px', J(await dim({ pages: 900 })) === J({ u: 44, w: '12.94%', h: 116 }));
  const rows = (books) => p.evaluate(x => window.libreriaStats.rows(x).map(r => r.length), books);
  ok('file: 15 libri da 900 pagine → 6, 6, 3', J(await rows(Array(15).fill({ pages: 900 }))) === J([6, 6, 3]));
  ok('file: 15 libri senza pagine → una fila', J(await rows(Array(15).fill({}))) === J([15]));
  ok('file: nessun libro → nessuna fila', J(await rows([])) === J([]));
  ```
- [ ] **Step 2:** `node test/run.mjs statistiche` → FAIL (`books` assente, `window.libreriaStats.dim` non è una funzione).
- [ ] **Step 3: Implementa** in `app.js`: in `computeStats` aggiungi `books: g.xs.slice().sort(recent).map(x => x.b)` all'oggetto di ogni autore; `statDim` e `ysRows` come da Interfaces; estendi `window.libreriaStats`.
- [ ] **Step 4:** `node test/run.mjs statistiche` → tutti OK.
- [ ] **Step 5: Commit** — `git commit -am "Statistiche scaffale 1/7: libri per autore e misure dei dorsi"`

### Task 2: Incipit e «Sempre»

**Files:**
- Modify: `app.js` — nuove `ledeHTML(S)`, `miniSpines(books)` vicino a `renderStats`; `renderStats(st)` riscritta in tutto tranne le mensole (vedi Step 3)
- Modify: `style.css` — blocco Statistiche (righe ~121–173)
- Test: `test/statistiche.mjs` (funzione `pagina` e nuova `incipit`)

**Interfaces:**
- Consumes: `sempre.authors[].books` (Task 1).
- Produces (usati dai Task 3–7):
  - Struttura: `<div class="stats"><h2 class="stats-title" tabindex="-1">Statistiche</h2><p class="stats-lede">…</p><div class="stats-cols"><div class="stats-years"><h2 class="sr">Anno per anno</h2>…mensole…note…</div><div class="sempre"><h2 class="sr">Sempre</h2>…blocchi…</div></div></div>`.
  - Blocchi `<section class="sblk[ span2]" data-panel="voti|tempo|mesi|autori|generi"><h3>Titolo <small>…</small></h3>…</section>`.
  - Note `p.hint.stats-future` (testo attuale) e `div.stats-noyear`.
  - `ledeHTML(S) → string` (`<p class="stats-lede">…</p>`), `miniSpines(books) → string` (`<span class="mini" aria-hidden="true">` con un `<i>` per libro, massimo 20).
  - Costante `STARS_IT = ["", "una stella", "due stelle", "tre stelle", "quattro stelle", "cinque stelle"]` (usata anche nel Task 3).

- [ ] **Step 1: Scrivi i test.** In `pagina` sostituisci i controlli «pannelli di Sempre presenti», «sintesi mostra…» e «nota: 1 senza anno…» con:
  ```js
  ok('blocchi di Sempre presenti', panels === 'voti,tempo,mesi,autori,generi', panels);
  ok('incipit con i dati di prova', (await txt('.stats-lede')).replace(/\s+/g, ' ').trim() === 'Hai letto 8 libri, 2.850 pagine in tutto. Il mese in cui finisci più libri è agosto.');
  ok('tempo: 40 giorni in media', /\b40\b/.test(await txt('[data-panel="tempo"]')));
  ok('voti: 7 libri votati, media 3,4', /7 libri votati · media 3,4/.test(await txt('[data-panel="voti"]')));
  ok('voti: cinque stelle a Uno e Tre, 1 senza voto', /Cinque stelle a Uno e Tre\.\s*1 libro senza voto\./.test(await txt('[data-panel="voti"]')));
  ok('mesi: leggi di più ad agosto', /Leggi di più ad agosto: 3 libri\./.test(await txt('[data-panel="mesi"]')));
  ok('autori: Stephen King con 2 mini-dorsi nascosti a VoiceOver', await p.$eval('[data-panel="autori"] li', li => li.textContent.includes('Stephen King') && li.querySelectorAll('.mini i').length === 2 && li.querySelector('.mini').getAttribute('aria-hidden') === 'true'));
  ok('nota: 1 senza anno, 1 con la data di fine nel futuro', /1 libro letto senza anno\./.test(await txt('.stats-noyear')) && /data di fine nel futuro/.test(await txt('.stats-future')));
  ```
  «libreria senza letti»: aggiungi `&& !(await p.locator('.stats-title, .stats-lede, section.ys').count())`. «senza date»: `.hint` in `[data-panel="mesi"]` e `[data-panel="tempo"]`, nessun `.months` in mesi (il controllo su `details.year` resta fino al Task 3).
  Nuova funzione `incipit(browser)` (chiamata nel `default` dopo `pagina`), con `statsPage`:
  ```js
  const A = (id, author, rating, pages, finished) => ({ id, title: id, author, rating, pages, finished, status: 'letto', added: 1 });
  // A1, A2, A3 della spec
  ok('incipit completo', lede === 'Hai letto 3 libri, 600 pagine in tutto. Il voto che dai più spesso è cinque stelle, a 2 libri; l\'autore che torna di più è X, con 2 titoli. Il mese in cui finisci più libri è marzo.');
  // [A('U', 'Z', 0, 0)] senza fine
  ok('incipit: un libro senza pagine né voto', lede === 'Hai letto un libro.');
  // [A('U', 'Z', 0, 320, '2025-01-01')]
  ok('incipit: un libro con pagine', lede === 'Hai letto un libro, 320 pagine.');
  // Review Focus 2: autore '<b>Tom & "Jerry"</b>' su due libri
  ok('incipit e autori: nomi con HTML restano testo', !(await p.locator('.stats-lede b b, [data-panel="autori"] li b').count()) && lede.includes('<b>Tom & "Jerry"</b>'));
  ```
- [ ] **Step 2:** `node test/run.mjs statistiche` → FAIL (manca `.stats-lede`).
- [ ] **Step 3: Implementa** `ledeHTML`, `miniSpines`, i cinque blocchi e le note seguendo alla lettera i testi delle sezioni «Incipit», «Note sotto le mensole» e «Sempre» della spec. Regole che il codice non ricava da solo:
  - mese preceduto da «ad» se inizia per vocale (aprile, agosto, ottobre), altrimenti «a»; due o tre mesi alla pari: «marzo e dicembre» / «gennaio, marzo e dicembre» + «ciascuno»; più di tre: nessuna frase.
  - «Cinque stelle a …»: 1 titolo «A», 2 «A e B», 3 «A, B e C», oltre «A, B, C e altri N».
  - Autori: righe `<li>` con nome in `<b>` (testo, `esc`), sotto i numeri, a destra `miniSpines(a.books)`; mini-dorso alto `p > 0 ? 18 + Math.round(Math.min(p, 900) / 900 * 10) : 20` px, colore `colorOf(b)`.
  - In questo compito le parti «anni» restano quelle attuali (stringhe `stories` e `years`, `button.story-card` e `details.year`) messe dentro `.stats-years`, così il racconto resta raggiungibile; il Task 3 le sostituisce.
  - CSS: togli `.stats-grid`, `.stats-group`, `.panel*`, `.figures`, `.fig*`, `.trio`, `.list*` (usati solo qui); aggiungi `.stats-title` (Fraunces 30 px `--title`), `.stats-lede` (16 px `--muted`, `b` Fraunces 19 px `--ink`, `overflow-wrap: anywhere`), `.sblk` (h3 Fraunces 21 px `--title`, bordo inferiore 3 px `--coral`, `small` 13 px `--muted`), `.sblk .hbar i { background: var(--title) }` e `.top` `--accent`, mesi con barre `--title` e base 2 px `--shelf`, Generi con colonna nome 104 px, `.mini`, `.stats-noyear` (bordo tratteggiato 1,5 px `--rule`, raggio 12 px, 14 px `--muted`); spazi: 40 px tra mensole e «Sempre», 34 px tra blocchi. Valori visivi dal prototipo, variante A.
- [ ] **Step 4:** `node test/run.mjs statistiche` → tutti OK.
- [ ] **Step 5: Commit** — `git commit -am "Statistiche scaffale 2/7: incipit e Sempre senza riquadri"`

### Task 3: Mensole degli anni

**Files:**
- Modify: `app.js` — `spineHTML(b, tag = "button", dim)` (riga ~893); nuova `yearHTML(a, racconto)`; in `renderStats` le mensole al posto di `stories`/`years`; in `openStory` il ripiego del focus `.story-card[data-story=…]` → `[data-story="${year}"]`
- Modify: `style.css` — `.ys*`, `.story-btn`, `.ribbon`; togli `.stories`, `.story-card*`, `.years`, `.year*`, `.best*`, `.pair`
- Test: `test/statistiche.mjs` (`pagina`, `racconto`, nuova `mensole`)

**Interfaces:**
- Consumes: `statDim`, `ysRows` (Task 1), `STARS_IT` e struttura `.stats-years` (Task 2).
- Produces:
  - `spineHTML(b, tag, dim?: { w: string, h: number })` — con `dim`: `--h` e `height` = `dim.h` px, `width` = `dim.w` anche per le foto (niente `spineRatio`), etichetta `«Titolo, Autore»` + `serAria(b)`, nessun pallino né classe `stale`. Senza `dim` nulla cambia.
  - `yearHTML(a, racconto: boolean) → string` — markup della sezione «Mensola di un anno» della spec: `section.ys[data-year]`, `h3.ys-n#ys-AAAA[tabindex="-1"]`, `p.ys-m`, `button.story-btn[data-story]` (solo se `racconto`), `div.ys-shelf[role=group][aria-label]` (+ classe `ribbon` con il pulsante), una `div.ys-row` per fila di `ysRows(mostrati)`, `pagerHTML("y" + anno, mostrati, totale)`, `p.ys-d`. Mostrati = `a.books.slice(0, state.limit["y" + a.year] || PAGE)`.

- [ ] **Step 1: Scrivi i test.** In `pagina`: «due schede racconto» → `ok('pulsanti racconto 2025 e 2024 nelle loro mensole', (await p.$$eval('section.ys button.story-btn', els => els.map(e => e.closest('section.ys').dataset.year + '=' + e.dataset.story).join())) === '2025=2025,2024=2024')` e nessun `.story-btn` in `section.ys[data-year="2019"]`; «anni…» → `ok('mensole 2025, 2024, 2019', (await p.$$eval('section.ys', els => els.map(e => e.dataset.year).join())) === '2025,2024,2019')`; «senza date» → nessuna `section.ys`. In `racconto` e nel test rolling: `button.story-card` → `button.story-btn`.
  Nuova funzione `mensole(browser)`:
  ```js
  ok('etichetta della mensola 2025', (await p.getAttribute('section.ys[data-year="2025"] .ys-shelf', 'aria-label')) === '2025: 3 libri, 800 pagine');
  ok('tre dorsi toccabili «Titolo, Autore» nel 2025', (await p.$$eval('section.ys[data-year="2025"] button.spine[data-id]', els => els.map(e => e.getAttribute('aria-label')).join('|'))) === 'Due, Don Winslow|Uno, Don Winslow|Sette, Bad Dates');
  ok('riga del 2025', /Autore dell'anno Don Winslow\. Genere Thriller\. Il preferito: Uno, cinque stelle\./.test(await txt('section.ys[data-year="2025"] .ys-d')));
  ok('riga dei numeri del 2025', /3 libri, 800 pagine,\s*★?\s*voto medio 3,7/.test(await txt('section.ys[data-year="2025"] .ys-m')));
  ok('nessuna riga dell\'anno nel 2019 (1 libro)', !(await p.locator('section.ys[data-year="2019"] .ys-d').count()));
  ok('segnalibro sulla mensola con il racconto', await p.locator('section.ys[data-year="2025"] .ys-shelf.ribbon').count() === 1 && !(await p.locator('section.ys[data-year="2019"] .ribbon').count()));
  ok('pulsante «Il racconto» alto almeno 44 px', (await p.locator('.story-btn').first().boundingBox()).height >= 44);
  // pagina a parte: tre libri del 2025 da 0, 100 e 900 pagine
  ok('larghezze: 0 e 100 pagine uguali (minima), 900 la più larga', w0 === w100 && w900 > w0);
  // pagina a parte: libro con foto del dorso (spine: data URL PNG 1×1, spineRatio: 0.5)
  ok('foto del dorso: larghezza percentuale, non spineRatio', /%$/.test(styleWidth));
  // Review Focus 1: 20 libri da 900 pagine finiti nel 2025 (se ne vedono 15 → file 6, 6, 3), viewport 320×700
  ok('mensola piena a 320 px: file da 6 dorsi e niente scorrimento laterale', rowsCount === 3 && await noHScroll(p));
  // Review Focus 2: titolo '<i>T&amp;</i>' e autore '<b>A</b>'
  ok('dorso con HTML nel titolo: solo testo', !(await p.locator('section.ys .spine i i, section.ys .spine b').count()));
  ```
  (Larghezze con `boundingBox().width` dei dorsi; `styleWidth` = `el.style.width`.)
- [ ] **Step 2:** `node test/run.mjs statistiche` → FAIL (manca `section.ys`).
- [ ] **Step 3: Implementa** `spineHTML` con `dim` (due righe all'inizio: misure ed etichetta), `yearHTML` e il CSS della spec («Mensola di un anno», «Dorsi delle Statistiche»): `.ys-row` flex con `gap: 2px; padding: 0 10px 16px; min-height: 132px`, sfondo `var(--board-img) left bottom -10px / 600px 230px repeat-x`, 10 px tra le file, 30 px tra le mensole; `.ys-row .spine { flex: none; min-width: 12px; padding: 8px 0 6px }`, `.au` e `.badge` nascosti, titolo 11 px; `.ys-n` Fraunces 34 px `--title` `lining-nums`; `.ys-m` 13,5 px `--muted`; `.story-btn` 44 px, raggio 22 px, `--accent`/`--accent-ink`, 600 14 px, `::before` segnalibro 9×15 px `currentColor` con tacca a V; `.ribbon::after` segnalibro `--coral` 12×26 px a 26 px dal bordo destro; `.ys-d` 14 px `--muted`, `b` `--ink` 600. In `renderStats` le mensole sono `st.anni.map(a => yearHTML(a, st.racconti.includes(a.year)))`. `#main .spine[data-id]` già riceve tocco, pressione prolungata e anteprima: nessun gestore nuovo.
- [ ] **Step 4:** `node test/run.mjs statistiche` → tutti OK.
- [ ] **Step 5: Commit** — `git commit -am "Statistiche scaffale 3/7: una mensola in legno per anno"`

### Task 4: Dorsi toccabili e ricalcolo dopo una modifica

**Files:**
- Modify: `app.js` — riga Statistiche di `render()` (~1302); due aiutanti nuovi accanto a `replaceShelf` (~1373)
- Test: `test/statistiche.mjs` (`mensole`)

**Interfaces:**
- Consumes: `section.ys`, `h3.ys-n[tabindex=-1]`, `.stats-title[tabindex=-1]` (Task 2–3).
- Produces:
  - `let statsLast = null;` (vicino a `renderStats`), impostato in `render()`: `main.innerHTML = renderStats(statsLast = computeStats(state.books, new Date()))`.
  - `statsFocusKey() → { id: string|null, year: number|null } | null` — dall'elemento attivo se sta in `#main section.ys`; altrimenti, se c'è una scheda aperta (`#scrim:not(.closing)`: una scheda che si sta chiudendo non conta), da `lastFocus` se sta (anche staccato) in una `section.ys`; altrimenti `null`.
  - `statsFocusRestore(k)` — bersaglio: `#main section.ys [data-id="id"]`, poi `#ys-AAAA`, poi `.stats-title`; con una scheda aperta (stesso controllo `#scrim:not(.closing)`: il menu rapido chiama `closeSheet()` prima di `setStatus`, mentre Salva ed Elimina ridisegnano con la scheda ancora aperta) assegna `lastFocus = bersaglio` (ci pensa `closeSheet`), altrimenti `bersaglio.focus({ preventScroll: true })`.
  - In `render()`, ramo Statistiche: `const k = statsFocusKey();` prima di ridisegnare, `if (k) statsFocusRestore(k);` dopo `wireMain(main)`.

- [ ] **Step 1: Scrivi i test in `mensole`** (pagina con `FIXTURE` a 390 px):
  ```js
  await p.locator('section.ys[data-year="2025"] [data-id="Due"]').click();
  ok('tocco su un dorso: si apre la scheda di «Due»', await p.locator('.sheet').isVisible() && /Due/.test(await p.locator('.sheet').innerText()));
  await p.fill('#f-started', '2024-08-20'); await p.fill('#f-finished', '2024-08-22'); await save(p);
  ok('«Due» passa sulla mensola del 2024 senza ricaricare', await p.locator('section.ys[data-year="2024"] [data-id="Due"]').count() === 1 && !(await p.locator('section.ys[data-year="2025"] [data-id="Due"]').count()));
  ok('dopo il salvataggio il focus torna sul dorso', await p.evaluate(() => document.activeElement?.dataset?.id) === 'Due');
  // Review Focus 3: pressione prolungata su «Cinque» (unico del 2019) → «Da leggere»
  ok('unico libro dell\'anno tolto: niente mensola 2019, focus sul titolo', !(await p.locator('section.ys[data-year="2019"]').count()) && await p.evaluate(() => document.activeElement?.classList.contains('stats-title')));
  ok('mensole: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  ```
  (Pressione prolungata come nel test `scheda`: `dispatchEvent('pointerdown', { clientX: 5, clientY: 5 })`, attesa 700 ms, `.quick [data-st="da-leggere"]`.)
- [ ] **Step 2:** `node test/run.mjs statistiche` → FAIL sul focus (`upsert` ridisegna già, ma il focus va perso).
- [ ] **Step 3: Implementa** `statsLast`, `statsFocusKey`, `statsFocusRestore` come da Interfaces.
- [ ] **Step 4:** `node test/run.mjs statistiche` → tutti OK.
- [ ] **Step 5: Commit** — `git commit -am "Statistiche scaffale 4/7: dorsi toccabili e focus dopo le modifiche"`

### Task 5: «Mostra altri 15» per anno e pulsanti da 44 px

**Files:**
- Modify: `app.js` — gestori `[data-more]`/`[data-less]` di `wireMain` (~1277–1291); nuova `replaceYear(year)` accanto a `replaceShelf`
- Modify: `style.css` — `.pager-btn` (riga ~276): `min-height: 44px`
- Test: `test/statistiche.mjs` (nuova `paginazione`)

**Interfaces:**
- Consumes: `statsLast` (Task 4), `yearHTML` (Task 3), `pagerHTML(key, shown, total)` invariata.
- Produces: `replaceYear(year: number)` — sostituisce `#main section.ys[data-year=year]` con `yearHTML(a, statsLast.racconti.includes(year))` da `statsLast` (nessun ricalcolo) e chiama `wireMain` sulla nuova sezione. In `wireMain`, per le chiavi `/^y\d{4}$/`, prima del ramo `covers`: «Mostra altri» → `replaceYear`, poi focus su `[data-more]` della nuova sezione, altrimenti su `[data-less]`; «Nascondi» → limite `PAGE`, `replaceYear`, focus su `[data-more]`, e se la sezione ha `top < 0` `scrollIntoView({ block: "start", behavior: riduzione ? "auto" : "smooth" })`.

- [ ] **Step 1: Scrivi i test in `paginazione`** — 32 libri `letto` finiti nel 2025 (`pages: 200`, date diverse) + 1 nel 2024:
  ```js
  const n = () => p.locator('section.ys[data-year="2025"] .spine').count();
  ok('32 libri: 15 dorsi e «15 di 32»', await n() === 15 && /15 di 32/.test(await txt('section.ys[data-year="2025"] .pager')));
  const y24 = await p.$('section.ys[data-year="2024"]');
  await p.click('section.ys[data-year="2025"] [data-more]');
  ok('Mostra altri: 30 dorsi, il pulsante dice «Mostra altri 2»', await n() === 30 && (await txt('section.ys[data-year="2025"] [data-more]')) === 'Mostra altri 2');
  ok('focus sul nuovo «Mostra altri»', await p.evaluate(() => document.activeElement?.dataset?.more) === 'y2025');
  await p.click('section.ys[data-year="2025"] [data-more]');
  ok('32 dorsi e solo «Nascondi»', await n() === 32 && !(await p.locator('section.ys[data-year="2025"] [data-more]').count()) && await p.locator('section.ys[data-year="2025"] [data-less]').count() === 1);
  ok('la mensola del 2024 non è stata ridisegnata', await y24.evaluate(e => e.isConnected));
  await p.click('section.ys[data-year="2025"] [data-less]');
  ok('Nascondi: di nuovo 15', await n() === 15);
  ok('paginazione: niente scorrimento orizzontale', await noHScroll(p));
  // Review Focus 4: Mostra altri, poi apri un dorso della seconda pagina, cambia il voto e salva
  ok('dopo un salvataggio restano 30 dorsi', await n() === 30);
  ok('pulsanti di paginazione delle Statistiche alti almeno 44 px', (await p.locator('section.ys .pager-btn').first().boundingBox()).height >= 44);
  // pagina a parte, vista Libreria: 16 libri «da-leggere»
  ok('pulsanti di paginazione degli scaffali alti almeno 44 px', (await p.locator('#main .pager-btn').first().boundingBox()).height >= 44);
  ok('paginazione: nessun errore in console', !p.errs.length, p.errs.join(' / '));
  ```
- [ ] **Step 2:** `node test/run.mjs statistiche` → FAIL (`replaceShelf("y2025")` non trova lo scaffale; pulsanti da 38 px).
- [ ] **Step 3: Implementa** `replaceYear`, il ramo `y…` nei due gestori e `min-height: 44px` su `.pager-btn`.
- [ ] **Step 4:** `node test/run.mjs statistiche` → tutti OK.
- [ ] **Step 5: Commit** — `git commit -am "Statistiche scaffale 5/7: Mostra altri 15 per anno, pulsanti da 44 px"`

### Task 6: Racconto con il palco

**Files:**
- Modify: `app.js` — `openStory(year)` (~1180–1247)
- Modify: `style.css` — `:root` riga 18: `--board-light: url(…)` (il valore attuale) e `--board-img: var(--board-light)` (il tema scuro continua a ridefinire solo `--board-img`); blocco del racconto: togli `#story::after` e `.story-covers*`, aggiungi `.story-top`, `.story-stage`, `.story-nav`, `.out`, `@keyframes drop`; frecce sempre visibili nella navigazione in basso
- Test: `test/statistiche.mjs` (`racconto`)

**Interfaces:**
- Consumes: `statDim` (Task 1), `spineHTML(b, "span", dim)` (Task 3), `button.story-btn[data-story]` (Task 3).
- Produces: in `#story`: `.story-top` («Il tuo anno da lettore» + `.story-close`), `.story-stage[aria-hidden="true"]` (fuori dalle `.slide`), `.story-nav` con `.story-prev` · `.story-count` («N di M») · `.story-next`. Il dorso del preferito nel palco ha `data-best`; `show()` gli mette la classe `out` solo nella schermata `preferito`. Libri del palco: `a.books` in ordine finché la somma delle `u` resta ≤ 170, al massimo 12; se `a.best` manca prende il posto dell'ultimo. Dorso: `spineHTML(b, "span", { w: (u * 0.53).toFixed(2) + "%", h })`, poi `style.setProperty("--i", indice)` per il ritardo.

- [ ] **Step 1: Scrivi i test in `racconto`** (dopo l'apertura del 2025 a 390 px; `txt` come in `pagina`):
  ```js
  ok('palco con 3 dorsi, nascosto a VoiceOver', await p.locator('#story .story-stage .spine').count() === 3 && (await p.getAttribute('#story .story-stage', 'aria-hidden')) === 'true');
  ok('navigazione in basso visibile con «1 di 9»', await p.locator('#story .story-nav').isVisible() && (await txt('#story .story-count')) === '1 di 9');
  ok('frecce del racconto da 48 px', (await p.locator('#story .story-next').boundingBox()).height >= 48);
  // vai a «preferito» con →
  ok('nel «preferito» il dorso del preferito esce, nelle altre no', await p.locator('#story .story-stage [data-best].out').count() === 1);
  // una → in più
  ok('lasciando il «preferito» rientra', !(await p.locator('#story .story-stage .out').count()));
  ok('chiusura senza griglia delle copertine', !(await p.locator('#story .story-covers').count()));
  ok('copertina: «Hai messo sullo scaffale 3 libri.»', /Hai messo sullo scaffale 3 libri\./.test(await txt('#story .slide[data-s="copertina"]')));
  ```
  Nuova pagina con `page.emulateMedia({ reducedMotion: 'reduce' })` prima di aprire il racconto:
  ```js
  ok('movimento ridotto: nessuna animazione né transizione sui dorsi', await p.$$eval('#story .story-stage .spine', els => els.every(e => { const c = getComputedStyle(e); return c.animationName === 'none' && parseFloat(c.transitionDuration) === 0; })));
  ```
  Review Focus 5: anno 2025 con 6 libri da 900 pagine (u 44: entrano 3) e il preferito (5 stelle) è il sesto per data:
  ```js
  ok('preferito oltre le 170 unità: è sul palco al posto dell\'ultimo', await p.locator('#story .story-stage .spine').count() === 3 && await p.locator('#story .story-stage [data-best]').count() === 1);
  ```
- [ ] **Step 2:** `node test/run.mjs statistiche` → FAIL (manca `.story-stage`).
- [ ] **Step 3: Implementa** in `openStory` palco, `.story-top`, `.story-nav` con `.story-count` aggiornato in `show()`, la classe `out`, i testi nuovi di copertina, preferito (senza copertina, stelle con `role="img"` e `aria-label` «N stelle») e chiusura (senza griglia) dalla sezione «Racconto» della spec; i clic dentro `.story-nav` che non sono pulsanti non sfogliano. CSS: palco `height: clamp(120px, 28vh, 250px)`, asse `var(--board-light) left bottom -10px / 600px 230px repeat-x`, dorsi centrati con 6 px tra loro e `height: min(calc(var(--h) * 1.9), 85%) !important`; dentro `@media (prefers-reduced-motion: no-preference)` `animation: drop .7s cubic-bezier(.3, 1.4, .5, 1) calc(var(--i) * 60ms) both` (da `translateY(-110%)` e opacità 0) e `.out { transform: translate(18px, -34px) rotate(9deg); transform-origin: left bottom; transition: transform .5s }`; con movimento ridotto `.out` è inclinato senza transizione. Attenzione: la regola generale `.spine { transition: transform .18s … }` (riga ~525) sta dopo quella per il movimento ridotto e la scavalca, quindi nel palco scrivi `.story-stage .spine { transition: none }` e metti la transizione di `.out` solo dentro `no-preference`. Testi crema `#F4EAD8`, evidenziati `#FFB3A9`; riga superiore 14 px `#C9D6D2`; frecce 48 px tonde con bordo crema 35%, «N di M» 13 px.
- [ ] **Step 4:** `node test/run.mjs statistiche` → tutti OK; tutti i controlli del racconto già esistenti restano verdi.
- [ ] **Step 5: Commit** — `git commit -am "Statistiche scaffale 6/7: racconto con i dorsi sull'asse"`

### Task 7: Computer, peso e verifica finale

**Files:**
- Modify: `style.css` — blocco Statistiche, regole da 1024 px
- Test: `test/statistiche.mjs` (ciclo 390/1366 di `pagina`)

**Interfaces:**
- Consumes: `.stats-cols`, `.stats-years`, `.sempre`, `.sblk.span2` (Task 2), `.ys-row` (Task 3).

- [ ] **Step 1: Scrivi i test** nel ciclo delle dimensioni di `pagina`, solo per 1366:
  ```js
  ok(`${tag}: mensole a sinistra e Sempre a destra`, await p.evaluate(() => { const a = document.querySelector('.stats-years').getBoundingClientRect(), b = document.querySelector('.sempre').getBoundingClientRect(); return a.right <= b.left && Math.abs(a.top - b.top) < 4; }));
  ok(`${tag}: Voti e Tempo affiancati, Autori a tutta larghezza`, await p.evaluate(() => { const r = s => document.querySelector(`[data-panel="${s}"]`).getBoundingClientRect(); return Math.abs(r('voti').top - r('tempo').top) < 4 && r('autori').width > r('voti').width * 1.8; }));
  ok(`${tag}: file da 167 px`, await p.$eval('.ys-row', e => e.getBoundingClientRect().height >= 167));
  ```
- [ ] **Step 2:** `node test/run.mjs statistiche` → FAIL.
- [ ] **Step 3: Implementa** in `@media (min-width: 1024px)`: `.stats-cols` `grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 48px`; `.sempre` griglia a due colonne con spazio 34 × 32 px (Voti | Tempo, Mesi | vuoto, `.span2` = `grid-column: 1 / -1`); `.ys-row { min-height: 167px }` e `.ys-row .spine { height: calc(var(--h) * 1.3) !important }`. Sotto 1024 px `.stats-cols` resta una colonna con 40 px tra mensole e «Sempre».
- [ ] **Step 4:** `node test/run.mjs statistiche` → tutti OK.
- [ ] **Step 5: Suite completa** — `node test/run.mjs` (circa 6 minuti) → ultima riga `✓ N riusciti, 0 falliti`.
- [ ] **Step 6: Screenshot** — guarda `/tmp/statistiche-390-chiaro.png`, `-390-scuro`, `-1366-chiaro`, `-1366-scuro`, `/tmp/racconto-copertina.png`, `/tmp/racconto-chiusura.png` e confrontali con `design/proposte/img/statistiche-A.png`, `statistiche-A-scuro.png`, `statistiche-A-1366.png`, `statistiche-racconto-A.png`: legno sotto ogni fila, segnalibro sul pulsante e sull'asse, nessun testo tagliato male, niente scorrimento laterale. Correggi e ripeti lo Step 4 se qualcosa non torna.
- [ ] **Step 7: Contrasto** — `node .claude/hooks/contrasto.mjs style.css` → nessun valore sotto 4,5:1.
- [ ] **Step 8: Peso** — `echo $(( $(wc -c < app.js) + $(wc -c < style.css) - $(git show claude/youthful-ride-ha414a:app.js | wc -c) - $(git show claude/youthful-ride-ha414a:style.css | wc -c) ))` → al massimo 4096 byte (obiettivo circa 2,5 KB); se è di più, togli CSS rimasto inutilizzato del vecchio blocco.
- [ ] **Step 9: Controlla di aver toccato solo il consentito** — `git diff claude/youthful-ride-ha414a --stat` → solo `app.js`, `style.css`, `test/statistiche.mjs`; nessuna modifica a `sw.js` né a `CLAUDE.md`.
- [ ] **Step 10: Commit** — `git commit -am "Statistiche scaffale 7/7: due colonne sul computer e verifica finale"`
