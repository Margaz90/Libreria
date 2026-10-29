# Scheda del libro «Frontespizio» — piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ridisegnare la scheda del libro (`openBook`) come un frontespizio: prima il libro, poi la lettura raccontata in una frase con le date toccabili, i ricordi, la trama, il colophon con i dati tecnici e «Sullo scaffale»; in più il ritmo di lettura per i libri In lettura e due colonne sul computer.

**Architecture:** Tutto in `app.js` e `style.css` (PWA senza build). Tre funzioni pure (`periodText`, `readingPace`, `paceText`) calcolano i testi e sono esposte come `window.libreriaScheda`; `syncPeriod(sheet)` riscrive solo testi e `hidden` dei nodi già creati (mai i campi data), e alla fine chiama `syncColophon(sheet)`. Lo stile nuovo sta tutto sotto `.sheet.book` (solo la scheda del libro) e `.rf` (blocchi lettura, anche in Nuovo libro), in un solo blocco CSS in fondo. Test end-to-end con Playwright nel nuovo gruppo `test/frontespizio.mjs`.

**Tech Stack:** JavaScript puro, CSS, `Intl.DateTimeFormat`, Playwright (Chromium) per i test.

**Spec:** `docs/superpowers/specs/2026-10-29-scheda-frontespizio-design.md` (prototipo `design/proposte/scheda.html`, variante A; screenshot `design/proposte/img/scheda-A.png`, `scheda-A-scuro.png`, `scheda-A-1366.png`).

## Global Constraints

- **Porte dei test:** in questo worktree lancia SEMPRE i test con `TEST_PORT=9200` (es. `TEST_PORT=9200 node test/run.mjs …`): usa le porte 9200 e 9201, così non si scontra con gli altri due agenti che fanno i test in parallelo. Ignora eventuali indicazioni su EADDRINUSE o turni.
- Lavoro in un git worktree separato creato dal branch `claude/youthful-ride-ha414a`, branch `impl/scheda` (es. `git worktree add ../Libreria-scheda -b impl/scheda claude/youthful-ride-ha414a`). Un solo agente esegue questo piano.
- Altri due agenti implementano in parallelo Statistiche e «Cosa leggo adesso?» negli stessi file: tocca SOLO le funzioni e i blocchi CSS della sezione 13 della spec (`openSheet`, `readingFields` → `readingHead` + `readingMemo`, `wireRating`, `wireDates`, `syncPage`, `fillData`, `openBook`, la riga di `openAdd` che usava `readingFields`, le funzioni nuove; in CSS le righe `.sheet h2`/`.sheet-top`/`.kv`, `.snext .lab` e il blocco nuovo in fondo). Non riformattare né spostare altro codice; non toccare `computeStats`, `renderStats`, `openStory`, `nextBooks`, `renderNext`, `renderHero`, né i blocchi `.stats*`, `.story*`, `.next*`, `.hero*`, `.rctl*`.
- NON modificare `VERSION` in `sw.js` né `CLAUDE.md` (li aggiorna Diego all'unione; l'avviso dell'hook `controlla-versione.mjs` è atteso).
- Ogni compito: test che fallisce → codice → test che passa → commit in italiano sul branch `impl/scheda`, con le righe di attribuzione richieste dalla sessione.
- Nuovo gruppo di test `frontespizio` in `test/frontespizio.mjs`, aggiunto **in fondo** all'array `ALL` di `test/run.mjs`. Un gruppo: `node test/run.mjs frontespizio`. I test avviano da soli i server 8765/8766: non lanciare mai due esecuzioni insieme; se compare `EADDRINUSE` un altro agente sta usando le porte: aspetta e riprova, non chiudere processi altrui.
- Orologio dei test fissato con `await p.clock.setFixedTime(new Date('2026-10-29T12:00:00'))` prima di `p.goto` (come `statsPage` in `test/statistiche.mjs`); «oggi» = `2026-10-29`.
- Testi dell'interfaccia esattamente come nella spec (§3.3, §4.1, §5.1, §7), date in italiano con un solo `Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" })` riusato.
- Ogni testo che viene dai dati (date, titolo, numeri del colophon) si scrive con `textContent` (o `esc()` nel markup iniziale), mai con HTML.
- Peso: circa 4 KB di CSS e 3,5 KB di JS non compressi; nessun font, immagine o libreria nuovi. Oltre 5 KB per file va segnalato nel resoconto finale.
- Bersagli ≥ 44 px; 390×844 e 1366×860, chiaro e scuro: nessun errore in console, niente scorrimento orizzontale; contrasto ≥ 4,5:1 (`--coral` solo decorativo).
- Id e selettori da conservare (spec §9): `#f-status`, `.seg [data-v]` (`role="radio"`, `aria-checked`), `#f-rate`, `.rate button[data-n]`, `#f-started`, `#f-finished` (`data-auto`, `disabled`, `min`/`max`, `dataset.ok`), `#f-date-err` (`role="alert"`), `#f-date-est`, `#f-year-row`, `#f-year`, `#f-year-err`, `#f-page`, `#f-notes`, `#f-quote`, `#s-stale`, `details.edit` + `summary`, `#s-q`, `#s-go`, `#s-status`, `#s-results`, `#d-title`, `#d-author`, `#d-series`, `#d-series-no`, `#series-list`, `#d-year`, `#d-pages`, `#d-genre`, `#d-call`, `#cv-clear`, `.sheet-top` (con `.cover`, `.sub`, `button[data-series]`), una sola `h2`, `#s-syn`, `.snext`, `[data-next-open]`, `[data-wish-next]`, `.refresh`, `#s-refresh`, `#s-ref-status`, `#cv-more`, `#cv-status`, `#cv-picks`, `#sp-prev`, `#sp-file`, `#sp-rot`, `#sp-del`, `.wish-box`, `#s-bought`, `#s-save`, `#s-close`, `#s-del`.

## Review Focus

1. Date non valide nei campi o nei dati (`started: "domenica"`, stringhe con HTML arrivate da vecchi dati): la frase mostra «scegli la data» e nessuna eccezione esce da `Intl` (`RangeError: Invalid time value`) — test nel Task 1.
2. In lettura: dopo +10 o il cursore, cambiare le pagine totali in «Modifica i dati del libro» non deve riportare la pagina al valore di apertura (oggi `syncPage` rimette sempre `dataset.orig`) — test nel Task 6.
3. Libro In lettura senza pagine totali: niente cursore, «di ?», +10 senza limite superiore, ritmo `no-pages` — test nel Task 6.
4. Nuovo libro (stessi blocchi `.rf`, ma senza colophon né `#s-colo`): passare da Da leggere a Letto mostra la frase con le date da scegliere e nessun errore in console — test nel Task 4.
5. Cambio dell'ora legale (25 ottobre 2026) tra l'inizio e oggi: il conteggio dei giorni non perde né aggiunge un giorno (calcolo a mezzogiorno) — è l'esempio di riferimento del Task 1.

---

### Task 1: Funzioni pure delle frasi e del ritmo

**Files:**
- Modify: `app.js` — funzioni nuove subito prima di `function openBook` (dopo `snextHTML`, ~riga 1748); riga `window.libreriaScheda` subito dopo la fine di `openBook` (~riga 1902)
- Create: `test/frontespizio.mjs` (prima parte: `puri`)
- Modify: `test/run.mjs` — `'frontespizio'` in fondo ad `ALL`

**Interfaces:**
- Produces:
  - `longDate(iso: string, year = true): string` — «2 gennaio 2025» / «2 gennaio»; `""` se `iso` non è una data `AAAA-MM-GG` valida.
  - `prep(base: "il" | "dal" | "al", iso: string): string` — elisione davanti all'8 e all'11: `"l'"`, `"dall'"`, `"all'"`; altrimenti `base + " "`.
  - `periodText({ status, started, finished, year, pages }): { lead, startWord, startText, endWord, endText, showStart, showEnd, sub, sr }` — stringhe e booleani; `startText`/`endText` = «scegli la data» se manca la data; le parole portano i loro spazi (`startWord` «Letto dal », «Iniziato l'», `endWord` « al », « e finito il »). Per `in-lettura` `sub` è `""` (lo riempie `syncPeriod` con il ritmo).
  - `readingPace({ started, page, pages }, oggi: string): { why: "ok" | "no-start" | "today" | "no-pages" | "no-page" | "done" | "odd", day?: number, perDay?: number, left?: number, eta?: string }` — `day` presente in tutti i casi tranne `no-start`.
  - `paceText(r, oggi: string): string`
  - `window.libreriaScheda = Object.freeze({ period: periodText, pace: readingPace, paceText })`

- [ ] **Step 1: Test** — `test/frontespizio.mjs` con `export default async function ({ browser })` che chiama `puri(browser)`; dentro, `const P = (a) => p.evaluate(a => window.libreriaScheda.period(a), a)` e simili; `line = r => (r.lead + ' ' + (r.showStart ? r.startWord + r.startText : '') + (r.showEnd ? r.endWord + r.endText : '')).replace(/\s+/g, ' ').trim()`:
  - `ok('L1 stesso anno', line(r) === 'Letto dal 10 marzo al 2 aprile 2025' && r.sub === '24 giorni · 300 pagine' && r.sr === 'Letto dal 10 marzo 2025 al 2 aprile 2025, 24 giorni.')` con `{ status: 'letto', started: '2025-03-10', finished: '2025-04-02', pages: 300 }`
  - `ok('L1 anni diversi', line === 'Letto dal 10 dicembre 2024 al 2 gennaio 2025' && sub === '24 giorni' && sr === 'Letto dal 10 dicembre 2024 al 2 gennaio 2025, 24 giorni.')` senza pagine
  - `ok('L1 in un giorno', sub === 'In un giorno · 300 pagine')` (inizio = fine); `ok('L1 date storte: solo le pagine', line === 'Letto dal 10 maggio al 1 maggio 2025' && sub === '200 pagine')`
  - `ok('L2', line === 'Iniziato il scegli la data e finito il 2 gennaio 2025' && sr === 'Iniziato il: data da scegliere; finito il 2 gennaio 2025.')`
  - `ok('L3', line === 'Iniziato il 10 marzo 2025 e finito il scegli la data' && sub === '300 pagine')`; `ok('L4', line === 'Iniziato il scegli la data e finito il scegli la data' && sub === '')`
  - `ok('L5', r.lead === 'Letto nel 2019.' && line === 'Letto nel 2019. Iniziato il scegli la data e finito il scegli la data' && sr.startsWith('Letto nel 2019. Iniziato il: data da scegliere'))` con `year: 2019`
  - `ok('R1', line === 'In lettura dal 12 ottobre 2026' && !r.showEnd && r.sr === 'In lettura dal 12 ottobre 2026.')`; `ok('R2', line === 'In lettura dal scegli la data')`
  - `ok('Da leggere', line === 'Ancora da iniziare.' && !r.showStart && !r.showEnd && r.sub === '')`
  - `ok('elisione', line === "Letto dall'8 marzo all'11 marzo 2025")` con `2025-03-08` / `2025-03-11`
  - `ok('data non valida = nessuna data', line === 'Iniziato il scegli la data e finito il 2 gennaio 2025')` con `started: 'domenica'` (Review Focus 1), e nessun errore in `p.errs`
  - Ritmo con `oggi = '2026-10-29'` (`T = (a) => p.evaluate(([a, o]) => { const S = window.libreriaScheda, r = S.pace(a, o); return { r, t: S.paceText(r, o) }; }, [a, '2026-10-29'])`):
    - `{ started: '2026-10-12', page: 142, pages: 337 }` → `r.why === 'ok' && r.day === 18 && r.eta === '2026-11-23' && t === '18º giorno di lettura, circa 8 pagine al giorno: a questo ritmo lo finisci verso il 23 novembre.'` (attraversa l'ora legale: Review Focus 5)
    - `started: '2026-10-29'` → `today`, testo «Primo giorno di lettura: la stima compare da domani.»
    - `started: ''`, `'domenica'`, `'2026-11-02'` → `no-start`, «Scegli la data di inizio: qui comparirà quando potresti finirlo.»
    - `{ started: '2026-10-12', page: 142 }` → `no-pages`, «18º giorno di lettura. Aggiungi le pagine totali in «Modifica i dati del libro» per sapere quando lo finisci.»
    - `{ started: '2026-10-12', pages: 337 }` → `no-page`, «18º giorno di lettura. Scrivi a che pagina sei per sapere quando lo finisci.»
    - `{ started: '2026-10-12', page: 337, pages: 337 }` → `done`, «18º giorno di lettura: sei all'ultima pagina, segnalo come Letto.»
    - `odd` con testo `${day}º giorno di lettura.` (es. «2º giorno di lettura.») per: `{ started: '2026-10-28', page: 700, pages: 1000 }` (> 300 al giorno), `{ started: '2026-09-01', page: 10, pages: 300 }` (< 1), `{ started: '2024-01-01', page: 500, pages: 1000 }` (> 730 giorni), `{ started: '2026-10-20', page: 10, pages: 5000 }` (eta oltre 365 giorni)
    - `{ started: '2026-10-01', page: 58, pages: 200 }` → `eta === '2027-01-08'` e testo «29º giorno di lettura, circa 2 pagine al giorno: a questo ritmo lo finisci verso l'8 gennaio 2027.»
    - `{ started: '2026-10-20', page: 90, pages: 95 }` → «10º giorno di lettura, circa 9 pagine al giorno: a questo ritmo lo finisci domani.»
    - `{ started: '2026-10-20', page: 10, pages: 40 }` → «10º giorno di lettura, circa 1 pagina al giorno: a questo ritmo lo finisci verso il 28 novembre.»
- [ ] **Step 2:** `node test/run.mjs frontespizio` → FAIL (`window.libreriaScheda` assente).
- [ ] **Step 3: Implementa** le funzioni dell'Interfaces. Date valide solo se `/^\d{4}-\d{2}-\d{2}$/` e `new Date(iso + "T12:00")` valida; differenze in giorni con `Math.round((b - a) / 864e5)` tra date a mezzogiorno. Regole dei casi esattamente come spec §3.3 (L1–L5, R1–R2, Da leggere, `sr`) e §4.1 (ordine dei controlli, soglie 730/1/300/365, «domani», singolare «1 pagina», anno solo se `eta` non è nell'anno di `oggi`). Formato «dal X al Y»: X senza anno se stesso anno di Y. `sr` usa sempre le date con l'anno e «: data da scegliere» al posto del segnaposto; L1 aggiunge «, N giorni» (N = 1: «, in un giorno»; N < 1 niente). Pagine nel `sub`: «1 pagina» / «N pagine».
- [ ] **Step 4:** `node test/run.mjs frontespizio` → tutti OK.
- [ ] **Step 5: Commit** — `Scheda 1/8: frasi delle date e ritmo di lettura (funzioni pure)`

### Task 2: Struttura della scheda

**Files:**
- Modify: `app.js` — `openSheet` (1394–1402), `readingFields` (1441–1460) → `readingHead` + `readingMemo`, `fillData` (riga 1621), `openBook` (1749–1902), `openAdd` (riga 1916)
- Modify: `style.css` — blocco nuovo in fondo `/* Scheda del libro: frontespizio */` (per ora solo `.rf` in colonna con `gap: 14px`, `.sheet.book .x` 44×44, `[hidden]` dei pulsanti del dorso); togliere `.kv` e `.kv .callno` (308–309)
- Modify: `test/serie.mjs` riga 660–661 (controllo «prima di Aggiorna informazioni»)
- Modify: `test/frontespizio.mjs` (parte `struttura`)

**Interfaces:**
- Consumes: niente dal Task 1.
- Produces:
  - `openSheet(html: string, cls?: string): HTMLElement` — `cls` aggiunta alla classe di `.sheet`; chiamate esistenti invariate.
  - `readingHead(b): string` → `<div class="rf rf-head">` con: `.field` stato (markup di oggi), voto `#f-rate` solo se `b.status === "letto"`, `<div class="period" id="f-period">` (per ora con i due campi data di oggi, `#f-date-err`, `#f-date-est`, `#f-year-row`, e `#s-stale` se `needsDates(b)`, testo di oggi), `<div class="pblk" id="f-pblk">` con il campo `#f-page` di oggi.
  - `readingMemo(b): string` → `<div class="rf rf-memo">` con `#f-quote`, `#f-notes`, e `#f-rate` se `b.status !== "letto"`.
  - `coverSync(sheet, b): void` — ridisegna `.sheet-top .cover` con `coverHTML(b)` e `.looks-cover` con `coverHTML(b)` a cui si aggiunge la classe `looks-cover`; nessun effetto se un elemento manca.
  - Markup di `openBook` (spec §1, §2, §7, §8): `button.x#s-close` (testo «✕», `aria-label="Chiudi la scheda"`), `header.sheet-top.fp` (copertina, `h2`, `.sub`, `button.sserie[data-series]` se c'è la serie, `i.rib[aria-hidden]`), `div.fp-main`, `div.sheet-bar` (`#s-del` «Elimina», `#s-save` «Salva»). In `.fp-main`, per stato all'apertura: Letto/In lettura = head, memo, `#s-syn-b`, `snextHTML(b)`, colophon, looks; Da leggere = head, `#s-syn-b`, memo, colophon, looks; Desiderato = `.wish-box`, `#s-syn-b`, colophon, looks.
  - `<section class="syn-b" id="s-syn-b"><h3>Trama</h3><p class="synopsis" id="s-syn">…</p></section>`, nascosta se la trama è vuota.
  - `<section class="colo" id="s-colo" data-isbn="…">` con `<div id="s-colo-facts"></div>`, `<p id="s-colo-fin"><span class="l1"></span><span class="l2">nella libreria di Diego</span></p>` (riempiti nel Task 7), `.refresh` di oggi, `details.edit` con `<summary>Modifica i dati del libro</summary>` e contenuto di oggi (ricerca, `dataFields`, `#cv-clear`).
  - `<section class="looks"><h3>Sullo scaffale</h3>` con copertina `.looks-cover`, `#cv-more` «Altra copertina» (poi «Cerca di nuovo»), `#sp-prev`, `label.btn[for=sp-file]`, `#sp-file`, `#sp-rot`, `#sp-del`, `#cv-status`, `#cv-picks`, suggerimento del dorso di oggi. `spSync` mette `hidden` (non `disabled`) a `#sp-rot`/`#sp-del` senza foto.
  - I tre testi «… in Modifica dati» diventano «… in Modifica i dati del libro» (spec §7).

- [ ] **Step 1: Test** `struttura` (390×844; `order = (p, sels) => p.evaluate(ss => { const e = ss.map(s => document.querySelector('.sheet ' + s)); return e.every(Boolean) && e.every((x, i) => !i || (e[i - 1].compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING)); }, sels)`), con libri `t1` Letto con trama, `t2` In lettura con trama, `t3` Da leggere con trama, `t4` Desiderato con trama, `t5` Letto senza trama con `cover` = data URL del PNG di `test/sincronizzazione.mjs`:
  - `ok('ordine Letto', order(['.sheet-top', '.seg', '#f-rate', '#f-period', '#f-quote', '#f-notes', '#s-syn-b', '#s-colo', '.looks', '.sheet-bar']))`
  - `ok('ordine In lettura', order(['.sheet-top', '.seg', '#f-period', '#f-pblk', '#f-quote', '#f-notes', '#f-rate', '#s-syn-b', '#s-colo', '.looks', '.sheet-bar']))`
  - `ok('ordine Da leggere', order(['.sheet-top', '.seg', '#f-period', '#s-syn-b', '#f-quote', '#f-notes', '#f-rate', '#s-colo', '.looks', '.sheet-bar']))`
  - `ok('ordine Desiderato', order(['.sheet-top', '.wish-box', '#s-syn-b', '#s-colo', '.looks', '.sheet-bar']) && !(await p.locator('#f-status').count()))`
  - `ok('scheda .sheet.book, una sola h2, h3 Trama e Sullo scaffale', ...)`; `ok('Nuovo libro: niente .book, due .rf', ...)` (tasto `.dock .add`)
  - `ok('✕ al posto di Chiudi', text === '✕' && aria-label === 'Chiudi la scheda' && box.width >= 44 && box.height >= 44)`
  - `ok('Modifica i dati del libro: chiuso, con i campi', summary === 'Modifica i dati del libro' && !open && #d-title dentro details.edit)` per `t1` e `t2`
  - `ok('trama vuota: sezione nascosta', await p.locator('#s-syn-b').isHidden())` su `t5`
  - `ok('Ruota e Rimuovi nascosti senza foto', ...)`, poi `setInputFiles('#sp-file', PNG)` → visibili
  - `ok('copertina disegnata: frontespizio e Sullo scaffale insieme', ...)` su `t5`: clic `details.edit summary`, clic `#cv-clear` → `.sheet-top .cover img` e `.looks-cover img` assenti
  - In `test/serie.mjs` sostituisci `before` con `s && y && c && (y.compareDocumentPosition(s) & 4) && (s.compareDocumentPosition(c) & 4)` dove `y = #s-syn-b`, `c = #s-colo`, e il nome del controllo con «… dopo la trama e prima del colophon».
- [ ] **Step 2:** `node test/run.mjs frontespizio` → FAIL.
- [ ] **Step 3: Implementa** l'Interfaces. `fillData` chiama `coverSync` al posto della riga 1621 e, se c'è `#s-colo`, aggiorna `data-isbn`; i tre punti di `openBook` che ridisegnano `.sheet-top .cover` (scelta copertina, `#cv-clear`, «Aggiorna informazioni») usano `coverSync`; «Aggiorna informazioni» con la trama mostra anche `#s-syn-b`. `openAdd` usa `readingHead(b) + readingMemo(b)`.
- [ ] **Step 4:** `node test/run.mjs frontespizio serie schede statistiche sicurezza sincronizzazione` → tutti OK.
- [ ] **Step 5: Commit** — `Scheda 2/8: struttura del frontespizio, colophon e Sullo scaffale`

### Task 3: Aspetto sul telefono

**Files:**
- Modify: `style.css` — blocco `/* Scheda del libro: frontespizio */`; `.snext .lab` (riga 612: niente maiuscolo); `.sheet h2` resta per le altre schede
- Modify: `app.js` — `readingMemo` (etichette e virgoletta)
- Modify: `test/frontespizio.mjs` (parte `aspetto`)

**Interfaces:**
- Consumes: markup del Task 2.
- Produces: `#f-quote` con `<label class="sr" for="f-quote">Citazione preferita</label>` e `<span class="qm" aria-hidden="true">“</span>`; `#f-notes` con etichetta visibile «Le tue note»; segnaposti di oggi.

- [ ] **Step 1: Test** `aspetto` (390×844, Letto con serie e seguito in pila per avere `.snext`):
  - `ok('titolo 26 px in Fraunces, autore in corsivo, copertina 120 px', fontSize === '26px' && /Fraunces/.test(fontFamily) && subStyle === 'italic' && Math.round(coverBox.width) === 120)`
  - `ok('barra Elimina/Salva fissa in basso', position === 'sticky')` e, dopo `.sheet.scrollTop = 0`, `#s-save` visibile nella finestra (bounding box dentro 844)
  - `ok('✕ fisso in alto', position === 'sticky')` e dopo `.sheet.scrollTop = 99999` il ✕ ha `y >= 0 && y < 100`
  - `ok('modifiche non salvate sopra la barra', ...)`: `#f-notes` fill, Esc → `.unsaved` visibile e la sua bounding box contiene quella di `#s-save` (lo copre)
  - `ok('etichette: Le tue note, Citazione preferita nascosta', ...)`
  - `ok('Prossimo della serie in tondo', textTransform === 'none')`
  - `ok('scheda: niente scorrimento orizzontale', sheet.scrollWidth <= sheet.clientWidth && document.documentElement.scrollWidth <= 390)`
- [ ] **Step 2:** `node test/run.mjs frontespizio` → FAIL.
- [ ] **Step 3: Implementa** gli stili di spec §1–§1.1, §5.3, §6, §7 (colophon centrato 14 px `--muted`, `<b>` `--ink`, segnatura `--mono`, chiusa in Fraunces 16 px `--title`, `summary` stile link corallo centrato ≥ 44 px), §8 (due colonne in `.looks`): `.sheet.book .sheet-top` in colonna centrata (copertina 120 px, ombra leggera, `h2` 26 px `--title` `text-wrap: balance`, `.sub` 16 px corsivo di sistema, `.sserie` link `--accent` ≥ 44 px, `.rib` 10×18 px `--coral` con tacca a V come `h1 .rib`); `.sheet.book .x` `position: sticky; top: 0` a destra; `.sheet.book { padding-bottom: 0 }`, `.sheet-bar` e `.sheet.book .unsaved` `position: sticky; bottom: 0; margin: 0 -16px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px))`, fondo `--surface`, filo `--rule` sopra; citazione Fraunces 19 px `--title` con virgoletta `--coral`, campo senza bordo che cresce; note su carta a righe (`--rule` ogni 28 px). Confronta con `design/proposte/img/scheda-A.png`.
- [ ] **Step 4:** `node test/run.mjs frontespizio serie` → tutti OK; `node .claude/hooks/contrasto.mjs style.css` senza avvisi.
- [ ] **Step 5: Commit** — `Scheda 3/8: aspetto del frontespizio sul telefono`

### Task 4: Le date come frase

**Files:**
- Modify: `app.js` — `readingHead` (markup di spec §3.1), `wireDates` (solo la chiamata in coda al `change`), `wireRating` (chiamate a `wireDateSlots` e, nel gestore del `.seg`, a `syncPeriod` dopo `syncYearRow`/`syncPage`), `fillData` (in coda `syncPeriod(sheet)`), `openBook` («Aggiorna informazioni»: `syncPeriod` in coda); nuove `syncPeriod`, `wireDateSlots`
- Modify: `style.css` — `.rf .period`, `.pline`, `.pc`, `.pw`, `.dt`, `.dv`, `.psub`
- Modify: `test/frontespizio.mjs` (parte `frase`)

**Interfaces:**
- Consumes: `periodText`, `readingPace`, `paceText`, `longDate` (Task 1); `readingHead` (Task 2).
- Produces:
  - `syncPeriod(sheet): void` — legge `#f-status`, `#f-started`, `#f-finished`, `#f-year` (valido solo se intero 1900–anno corrente), `#d-pages`, `#f-page`; scrive con `textContent` `#f-pw-lead` (nascosto se vuoto), le `.pw`/`.dv` delle due clausole, `hidden` di `#f-pc-start`/`#f-pc-end`, `#f-psub` (per In lettura `paceText(readingPace(...), today())`; nascosto se vuoto o Da leggere), `#f-pend-hint` (visibile solo In lettura), `#f-period-sr`; poi `syncColophon(sheet)` se esiste (Task 7: fino ad allora nessuna chiamata). Non ricrea mai `#f-started`/`#f-finished`.
  - `wireDateSlots(sheet): void` — `click` e `keydown` Invio/Spazio su `#f-started`/`#f-finished` → `try { input.showPicker() } catch {}`; `input` su `#f-year`, `#f-page` e su ogni `#d-*` → `syncPeriod(sheet)`; chiama `syncPeriod(sheet)` una volta (apertura, prima di `guardSheet`).
  - Markup: `.period#f-period` > `p.sr#f-period-sr`, `p.pline` (`#f-pw-lead`, `#f-pc-start`, `#f-pc-end` con `.pw[aria-hidden]` e `label.dt` > `.dv[aria-hidden]` + `input[type=date]` con `aria-label` «Iniziato il» / «Finito il» e gli attributi di oggi), `p.psub#f-psub`, `p.hint#f-pend-hint` «La data di fine si sceglie quando lo segni come letto.», poi `#f-date-err`, `#f-date-est`, `#f-year-row`, `#s-stale` in quest'ordine. Nessuno spazio di markup tra i pezzi della `.pline` (gli spazi stanno nelle parole).
  - CSS: input `position: absolute; inset: 0; opacity: 0; font-size: 16px`; `.dt` `display: inline-flex; min-height: 44px; position: relative; white-space: nowrap`, testo `--accent`, sottolineatura punteggiata `--coral` 2 px; `.dt:has([aria-invalid=true])` ondulata `--accent`; `.dt:focus-within` contorno 2 px `--accent`; `.pline` `flex-wrap`/a capo libero.

- [ ] **Step 1: Test** `frase` (orologio fisso; `txt = sel => p.locator(sel).innerText().then(s => s.replace(/\s+/g, ' ').trim())`): libri `f1` Letto 2025-03-10 → 2025-04-02, 300 pagine; `f4` Letto solo inizio 2025-03-10, 300 pagine; `f5` Letto senza date; `f6` Letto `finishedYear: 2019`; `f7` In lettura 2026-10-12, pagina 142 di 337; `f8` In lettura senza inizio; `f9` Da leggere; `f10` Letto 2025-05-10 → 2025-05-01, 200 pagine.
  - `ok('L1', txt('.pline') === 'Letto dal 10 marzo al 2 aprile 2025' && txt('#f-psub') === '24 giorni · 300 pagine' && txt('#f-period-sr') === 'Letto dal 10 marzo 2025 al 2 aprile 2025, 24 giorni.')`
  - `ok('L3 con segnale', txt('.pline') === 'Iniziato il 10 marzo 2025 e finito il scegli la data' && #s-stale visibile && #f-year-row visibile)` (f4)
  - `ok('L5 senza segnale', txt('.pline') === 'Letto nel 2019. Iniziato il scegli la data e finito il scegli la data' && !(await p.locator('#s-stale').count()))` (f6)
  - `ok('R1', txt('.pline') === 'In lettura dal 12 ottobre 2026' && #f-pc-end nascosto && #f-pend-hint visibile)`; `ok('R2', txt('.pline') === 'In lettura dal scegli la data')`
  - `ok('Da leggere', txt('.pline') === 'Ancora da iniziare.' && #f-psub nascosto && #f-pend-hint nascosto)`
  - `ok('date storte: frase, segnale, Salva bloccato', txt('.pline') === 'Letto dal 10 maggio al 1 maggio 2025' && #s-stale visibile)` (f10), poi clic `#s-save` → la scheda resta, `#f-date-err` visibile, `#f-finished` con `aria-invalid="true"`
  - dal vivo: f4 `fill('#f-finished', '2025-04-02')` → `'Letto dal 10 marzo al 2 aprile 2025'` e `#f-year-row` nascosto; f5 `fill('#f-started', '2025-03-01')` → `'Letto dal 1 marzo al 21 marzo 2025'` e `#f-date-est` visibile; f5 `fill('#f-year', '2019')` → `#f-pw-lead` «Letto nel 2019.»; f1 clic `.seg [data-v="in-lettura"]` → `'In lettura dal 10 marzo 2025'` e `#f-pend-hint` visibile
  - selettore: `getComputedStyle(#f-started).opacity === '0' && fontSize === '16px'`; box della `.dt` di `#f-started` alta ≥ 44; con `addInitScript` che sostituisce `HTMLInputElement.prototype.showPicker` con un contatore `window.__pick`, `click('#f-started')` → `__pick === 1`, `focus` + `press('Enter')` → `__pick === 2`
  - Nuovo libro (Review Focus 4): `.dock .add`, clic `.seg [data-v="letto"]` → `txt('.pline') === 'Iniziato il scegli la data e finito il scegli la data'`, `fill('#f-started', '2025-03-01')` accettato, nessun errore in console
- [ ] **Step 2:** `node test/run.mjs frontespizio` → FAIL.
- [ ] **Step 3: Implementa** l'Interfaces; `wireDates`, `badDates`, `syncYearRow`, `badYear`, `readReading`, `dateProblem` restano identiche salvo la chiamata `syncPeriod(sheet)` dopo `limits(); syncYearRow(sheet);`.
- [ ] **Step 4:** `node test/run.mjs frontespizio schede statistiche sicurezza sincronizzazione` → tutti OK.
- [ ] **Step 5: Commit** — `Scheda 4/8: date di lettura come frase con il selettore nativo`

### Task 5: Stato, voto e verdetto

**Files:**
- Modify: `app.js` — `readingHead`/`readingMemo` (paragrafo `#f-verdict` sotto `#f-rate`), `wireRating` (verdetto al tocco e al cambio di stato); nuova `verdict`
- Modify: `style.css` — `.rf .seg`, `.rf .seg button`, `.rf .seg-ink`, `.rf .rate`, `.rf .verdict`
- Modify: `test/frontespizio.mjs` (parte `voto`)

**Interfaces:**
- Produces: `verdict(n: number, status: string): string` — 0: «Tocca una stella per dare il voto» se `status === "letto"`, altrimenti «Il voto, quando vuoi»; 1–5: «Non mi è piaciuto», «Così così», «Mi è piaciuto», «Bellissimo», «Lo rileggerei». `<p class="verdict" id="f-verdict" aria-live="polite">` aggiornato con `textContent`, usando lo stato attuale di `#f-status` (o `"letto"` se manca).

- [ ] **Step 1: Test** `voto`:
  - `ok('verdetto iniziale per un Letto senza voto', txt('#f-verdict') === 'Tocca una stella per dare il voto')`; clic `.rate button[data-n="4"]` → «Bellissimo»; di nuovo → torna al testo iniziale; Da leggere → «Il voto, quando vuoi»
  - `ok('stelle e voci di stato ≥ 44 px', ...)` (box di ogni `.rate button` ≥ 44×44, ogni `.rf .seg button` alto ≥ 44)
  - `ok('linea della voce scelta: 3 px corallo in basso', getComputedStyle(.seg-ink).height === '3px')`; con `reducedMotion: 'reduce'` (`p.emulateMedia`) `transitionDuration` di `.seg-ink` `0s`
- [ ] **Step 2:** `node test/run.mjs frontespizio` → FAIL.
- [ ] **Step 3: Implementa** spec §5.1: tre voci a tutta larghezza con linea `--rule` sotto, voce scelta `--title` in grassetto, `.seg-ink` ridisegnata `height: 3px; bottom: 0; top: auto` `--coral` (stessa logica di posizione di `sync` in `wireRating`); stelle 44×44 centrate, accese `--accent`, spente `--muted`. Tutto sotto `.rf`.
- [ ] **Step 4:** `node test/run.mjs frontespizio schede statistiche sincronizzazione` → tutti OK.
- [ ] **Step 5: Commit** — `Scheda 5/8: stato, voto e verdetto`

### Task 6: Pagina e ritmo nella scheda

**Files:**
- Modify: `app.js` — `readingHead` (markup `#f-pblk` di spec §5.2), `syncPage` (1550–1556); nuova `wirePageCtl`, chiamata da `openBook` e `openAdd` dopo `wireRating`
- Modify: `style.css` — `.rf .pblk`, `.pbig`, `#f-range` (binario come l'hero ma con regole proprie sotto `.rf`: non toccare `.rctl`), `.pq`
- Modify: `test/frontespizio.mjs` (parte `pagina`)

**Interfaces:**
- Consumes: `syncPeriod` (Task 4), che già mette il ritmo in `#f-psub`.
- Produces:
  - `wirePageCtl(sheet, b): void` — `#f-range` `input` → scrive in `#f-page` e lancia `input`; `#f-p10` +10, `#f-pstep` + `b.pageStep` (nascosto se manca), entrambi limitati al totale se c'è, scrivono in `#f-page` e lanciano `input`; `#f-page` `input` → `syncPage`-vista (cursore, `--pct`, `aria-valuetext` «pagina N di T», `#f-pof`). Nessun salvataggio, `pageStep` non cambia.
  - `syncPage(sheet)`: regole di oggi per i Letti; `#f-pblk.hidden = stato !== "in-lettura"`; `#f-range` nascosto senza totale, `max` = totale; `#f-pof` «di T · P%» o «di ?»; rimette `dataset.orig` solo se il campo era `readOnly` (si torna da Letto), altrimenti tiene il valore attuale (Review Focus 2).
  - Etichette: `#f-range` `aria-label="Avanzamento di {titolo}"`, `#f-p10` «Aggiungi 10 pagine a {titolo}», `#f-pstep` testo «+N» e `aria-label` «Aggiungi N pagine a {titolo}» (titolo con `esc()`).

- [ ] **Step 1: Test** `pagina` (orologio fisso): `f7` In lettura 2026-10-12, 142 di 337; `f12` In lettura 2026-10-20, 330 di 337, `pageStep: 25`; `f13` In lettura 2026-10-20, pagina 50, senza totale; `f1` Letto.
  - `ok('ritmo nella scheda', txt('#f-psub') === '18º giorno di lettura, circa 8 pagine al giorno: a questo ritmo lo finisci verso il 23 novembre.' && txt('#f-pof') === 'di 337 · 42%' && range value '142')`
  - clic `#f-p10` → `#f-page` '152', `#f-range` '152', `#f-psub` contiene «verso il 20 novembre»; `ok('niente salvataggio senza Salva', (await book(p,'f7')).page === 142)`; Esc → `.unsaved` visibile
  - `fill('#f-range', '200')` → `#f-page` '200'
  - dopo +10, clic `details.edit summary`, `fill('#d-pages', '400')` → `#f-page` resta '152' (Review Focus 2); `fill('#d-pages', '')` → `#f-psub` «18º giorno di lettura. Aggiungi le pagine totali in «Modifica i dati del libro» per sapere quando lo finisci.»
  - `ok('+N col salto ricordato e limiti al totale', pstep testo '+25' && aria-label 'Aggiungi 25 pagine a …' ; clic → '337'; clic #f-p10 → '337')` (f12); `#f-pstep` nascosto su f7
  - `ok('senza totale: niente cursore, di ?, +10 libero', range nascosto && txt('#f-pof') === 'di ?' && dopo +10 '60')` (f13, Review Focus 3)
  - `ok('Letto: blocco pagina nascosto, campo readonly', #f-pblk nascosto && #f-page readonly)` (f1)
- [ ] **Step 2:** `node test/run.mjs frontespizio` → FAIL.
- [ ] **Step 3: Implementa** l'Interfaces; numero in Fraunces 40 px `--title` senza bordo e sottolineato; cursore alto 44 px.
- [ ] **Step 4:** `node test/run.mjs frontespizio schede funzioni` → tutti OK.
- [ ] **Step 5: Commit** — `Scheda 6/8: pagina con cursore, +10, +N e ritmo di lettura`

### Task 7: Colophon

**Files:**
- Modify: `app.js` — nuova `syncColophon`; `syncPeriod` la chiama in coda; `openBook` («Aggiorna informazioni» aggiorna `data-isbn` prima di `syncPeriod`)
- Modify: `test/frontespizio.mjs` (parte `colophon`)

**Interfaces:**
- Consumes: `#s-colo` (Task 2), `syncPeriod` (Task 4).
- Produces: `syncColophon(sheet): void` — nessun effetto senza `#s-colo` (Nuovo libro). Ricostruisce `#s-colo-facts` con un `<p>` per dato presente (numeri in `<b>` creati con `textContent`): «Pubblicato nel **Y**», «**P** pagine, genere in minuscolo» / «**P** pagine» / «Genere» con iniziale maiuscola, «Segnatura **X**» (`<b class="mono">`), «ISBN **N**» da `data-isbn`; senza dati «Nessun dato del libro: aggiungili con «Modifica i dati del libro».». Scrive `#s-colo-fin .l1` secondo la tabella di spec §7, con lo stato da `#f-status` (assente = Desiderato); mese con `Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" })`.

- [ ] **Step 1: Test** `colophon` (`c1` Letto: `year: 2016, pages: 369, genre: 'Spionaggio', callNo: '823.92 HER', isbn: '9788834746219', started: '2024-12-10', finished: '2025-01-02'`; `c2` Letto `finishedYear: 2019`; `c3` Letto senza date né dati; `c4` Desiderato; più `f7`, `f8`, `f9`):
  - `ok('colophon completo', facts === ['Pubblicato nel 2016', '369 pagine, spionaggio', 'Segnatura 823.92 HER', 'ISBN 9788834746219'] && l1 === 'Finito di leggere nel mese di gennaio 2025' && l2 === 'nella libreria di Diego')` (`facts` = `innerText` di ogni `#s-colo-facts p`)
  - `ok('chiuse', c2 «Finito di leggere nel 2019», c3 «Finito di leggere (data da aggiungere)», f7 «In lettura dal mese di ottobre 2026», f8 «In lettura», f9 «In attesa di essere letto», c4 «Nella lista dei desideri»)`
  - `ok('senza dati', facts === ['Nessun dato del libro: aggiungili con «Modifica i dati del libro».'])` (c3)
  - dal vivo su c1: `fill('#d-pages', '400')` → «400 pagine, spionaggio»; `fill('#d-genre', '')` → «400 pagine»; clic `.seg [data-v="in-lettura"]` → «In lettura dal mese di dicembre 2024»
  - «Aggiorna informazioni» (pagina con `external: 'mock'`; rotte come `mock()` di `test/ricerche.mjs` con Apple Books «Ubik» e Google `200 {"totalItems":0}`, più `p.route(/wikidata\.org/, r => r.abort())`), libro `u1` `{ title: 'Ubik', author: 'Philip K. Dick', status: 'da-leggere' }`: dopo `#s-refresh` → `details.edit` aperto, `#s-syn-b` visibile con «Joe Chip», colophon con «Pubblicato nel 2021» e «Fantascienza», `.sheet-top .cover img` e `.looks-cover img` presenti; libro sconosciuto → `#s-ref-status` contiene «in Modifica i dati del libro»
- [ ] **Step 2:** `node test/run.mjs frontespizio` → FAIL.
- [ ] **Step 3: Implementa** l'Interfaces.
- [ ] **Step 4:** `node test/run.mjs frontespizio ricerche serie isbn-verifica` → tutti OK.
- [ ] **Step 5: Commit** — `Scheda 7/8: colophon con dati e chiusa`

### Task 8: Computer a due colonne

**Files:**
- Modify: `style.css` — `@media (min-width: 1024px)` dentro il blocco nuovo (non toccare la `.sheet` a 460 px delle altre schede, riga 451)
- Modify: `test/frontespizio.mjs` (parte `computer` e `schermi`)

**Interfaces:**
- Produces: `.sheet.book` `width: min(760px, calc(100vw - 300px)); max-width: none; display: grid; grid-template-columns: 232px minmax(0, 1fr); column-gap: 32px; align-content: start`; `.x` `grid-column: 1 / -1; justify-self: end`; `.sheet-top.fp` colonna 1, `position: sticky; top: 56px; align-self: start`, copertina 200 px; `.fp-main` colonna 2; `.sheet-bar`, `.unsaved` `grid-column: 1 / -1`; colophon a due colonne (dati a sinistra, chiusa a destra, `.refresh` e `details.edit` sotto a tutta larghezza). Tra 640 e 1023 px resta la scheda centrata di oggi (max 560 px).

- [ ] **Step 1: Test** `computer` (1366×860):
  - `ok('pannello largo', box(.sheet.book).width >= 700)`; a 1024×768 `width <= 724`; a 800×900 `width <= 560`
  - `ok('due colonne', box(h2).x + box(h2).width < box('.rf .seg').x)`; `ok('colophon a due colonne', box('#s-colo-facts').x + width <= box('#s-colo-fin').x)`
  - `ok('frontespizio fermo mentre si scorre', ...)`: `.sheet.scrollTop = 99999` → box di `h2` con `y >= 0 && y < 860`
  - `ok('le altre schede restano a 460 px', ...)`: tasto `N` → `.sheet` larga ≤ 460
  - `ok('computer: niente scorrimento orizzontale e nessun errore', ...)`
  - `schermi`: per 390×844 e 1366×860, chiaro e scuro, scheda di `f7` (In lettura) e `c1` (Letto): niente scorrimento orizzontale nella pagina e nella `.sheet`, nessun errore in console, `p.screenshot({ path: '/tmp/scheda-' + stato + '-' + width + '-' + tema + '.png' })` (come `test/statistiche.mjs`; non nel repository)
- [ ] **Step 2:** `node test/run.mjs frontespizio` → FAIL.
- [ ] **Step 3: Implementa** l'Interfaces; confronta con `design/proposte/img/scheda-A-1366.png`.
- [ ] **Step 4:** `node test/run.mjs frontespizio interfaccia sicurezza` → tutti OK.
- [ ] **Step 5: Commit** — `Scheda 8/8: due colonne sul computer`

### Task 9: Verifica finale (nessun codice nuovo, salvo correzioni con il loro test)

**Files:** nessuno (script di screenshot nello scratchpad, non nel repository).

- [ ] **Step 1:** `node test/run.mjs` (circa 6 minuti) → riga finale `✓ N riusciti, 0 falliti`.
- [ ] **Step 2:** id conservati: `for s in f-status f-rate f-started f-finished f-date-err f-date-est f-year-row f-year f-year-err f-page f-notes f-quote s-stale s-q s-go s-status s-results d-title d-author d-series d-series-no series-list d-year d-pages d-genre d-call cv-clear s-syn s-refresh s-ref-status cv-more cv-status cv-picks sp-prev sp-file sp-rot sp-del s-bought s-save s-close s-del; do grep -q "id=\"$s\"" app.js || echo "MANCA $s"; done` → nessuna riga.
- [ ] **Step 3:** screenshot (script Playwright nello scratchpad, orologio 2026-10-29) a 390×844 e 1366×860, chiaro e scuro, di: Letto completo (`c1`), In lettura (`f7`), Da leggere con trama, Nuovo libro dopo il tocco su Letto; guardali uno per uno e confrontali con `design/proposte/img/scheda-A.png`, `scheda-A-scuro.png`, `scheda-A-1366.png` (variante A di `design/proposte/scheda.html`): frontespizio centrato, frase con le date sottolineate, colophon, barra in basso, nessun testo tagliato.
- [ ] **Step 4:** `node .claude/hooks/contrasto.mjs style.css` → nessun valore sotto 4,5:1.
- [ ] **Step 5:** peso: `git diff --stat claude/youthful-ride-ha414a -- app.js style.css` e `for f in app.js style.css; do echo $f $(( $(wc -c < $f) - $(git show claude/youthful-ride-ha414a:$f | wc -c) )); done` → circa +3,5 KB JS e +3,6 KB CSS (oltre 5 KB: segnalarlo).
- [ ] **Step 6:** `git diff claude/youthful-ride-ha414a --stat` non contiene `sw.js` né `CLAUDE.md`; resoconto a chi ha lanciato l'agente con: totale dei test, percorsi degli screenshot, peso, scelte di questo piano da confermare (elisione «dall'8», `syncColophon(sheet)` con `data-isbn`, controlli di schermo nel gruppo `frontespizio` invece di `interfaccia`).
