# Statistiche: storia da lettore e abitudini — piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nuova sezione Statistiche (sempre + anno per anno + racconto dei due anni precedenti) con il campo facoltativo `finishedYear`.

**Architecture:** Una funzione pura `computeStats(books, oggi)` calcola tutto; `renderStats(stats)` disegna la pagina; `openStory(year)` gestisce il racconto a schermo intero. Tutto in `app.js` e `style.css`, nessun file nuovo da scaricare. Test end-to-end con Playwright nel nuovo gruppo `test/statistiche.mjs`.

**Tech Stack:** JavaScript puro (PWA senza build), CSS, Playwright 1.63 (Chromium) per i test.

**Spec:** `docs/superpowers/specs/2026-10-25-statistiche-design.md`

## Global Constraints

- Rispondere e scrivere testi dell'interfaccia in italiano; commit in italiano.
- Nessuna libreria esterna; peso aggiunto stimato 8–10 KB tra codice e stile.
- Solo libri con `status === "letto"` entrano nelle statistiche.
- `finishedYear`: intero 1900–anno corrente, solo per libri letti senza `finished`; tolto se c'è `finished`.
- Giorni per finire = `fine − inizio + 1`; esclusi < 1, > 730 e date future.
- Una data di fine nel futuro vale come «nessuna data» (niente anni, mesi, giorni).
- Autori e generi: primi 6. Autori ordinati per numero di libri, poi pagine, poi nome; generi per numero di libri, poi nome.
- Racconti: anni `oggi − 1` e `oggi − 2`, solo se hanno almeno un libro. Meno di 3 libri → solo copertina, numeri, chiusura.
- Messaggio a libreria senza letti, testo esatto: «Quando segnerai un libro come Letto, qui compariranno le tue statistiche».
- Ogni pannello con barre mostra anche il numero; colori: barre `--coral`, massimo `--accent`, titoli `--title`.
- Telefono 390×844 e computer 1366×860, chiaro e scuro: nessun errore in console, niente scorrimento orizzontale.
- A fine lavoro: `VERSION` in `sw.js` da v46 a v47 e `CLAUDE.md` aggiornato.

## Review Focus

1. Anno di lettura non valido nella scheda (es. `12`, `2099`, testo): non va salvato, il libro resta senza anno.
2. Libri letti senza autore, genere o pagine: non devono comparire voci vuote in Autori/Generi né `NaN` nei numeri.
3. Titoli e nomi molto lunghi nei pannelli e nel racconto: tagliati, mai scorrimento orizzontale.
4. Racconto sfogliato oltre l'ultima schermata o prima della prima: resta dov'è, nessun errore.
5. Data di fine nel futuro: il libro conta nei totali ma non in anni, mesi e giorni.

---

### Task 1: Campo `finishedYear` e data di fine automatica

**Files:**
- Modify: `app.js` — `FIELDS` (riga 12), `clean()` (~99), `setStatus()` (~617), `readingFields()` (~850), `readReading()` (~896), cablaggio nella scheda `openBook()` (dopo `wireRating(sheet, b)` ~1070)
- Create: `test/statistiche.mjs` (prima parte: scheda) e voce `'statistiche'` in `ALL` di `test/run.mjs`
- Modify: `test/sincronizzazione.mjs` (un controllo)

**Interfaces:**
- Produces: campo libro `finishedYear: number | undefined`; nella scheda `#f-year-row` (contenitore) e `#f-year` (input numerico, etichetta «oppure solo l'anno»).

- [ ] **Step 1: Scrivi i test della scheda in `test/statistiche.mjs`** (esporta `default async function ({ browser })`, usa `newPage`, `APP`, `ok`, `localBooks` di `test/lib.mjs`; libri caricati in `localStorage` prima del reload)
  - `ok('anno: compare per un libro letto senza data', visible('#f-year-row'))` aprendo un libro `letto` senza `finished`
  - `ok('anno: sparisce se metto la data di fine', !visible)` dopo `fill('#f-finished', '2025-03-02')`
  - `ok('anno: salvato 2019 senza data', b.finishedYear === 2019 && !b.finished)`
  - `ok('anno non valido non salvato', b.finishedYear === undefined)` per i valori `12` e `2099`
  - `ok('voto a un libro storico non mette la data di oggi', !b.finished)` (libro letto senza data, clic su una stella, Salva)
  - `ok('da leggere → letto mette la data di oggi', b.finished === oggiISO)`
  - `ok('menu rapido su un libro già letto non mette la data', !b.finished)` (pressione prolungata, pulsante Letto)
  - `ok('anno tolto se salvo la data completa', b.finished === '2025-03-02' && b.finishedYear === undefined)`
- [ ] **Step 2:** `node test/run.mjs statistiche` → FAIL (manca `#f-year-row`).
- [ ] **Step 3: Implementa** in `app.js`: `"finishedYear"` in `FIELDS`; in `clean()` converte a intero e lo cancella se fuori 1900–anno corrente o se c'è `finished`; `setStatus(b, st)` e `readReading(sheet, b)` impostano `finished = today()` solo se lo stato precedente non era `letto` e non c'è `finishedYear`; `readingFields(b)` aggiunge la riga `#f-year-row` (`hidden` se non letto o con data) con `<input id="f-year" type="number" inputmode="numeric" min="1900" max="{anno corrente}">`; in `openBook` un aggiornamento della visibilità al cambio dello stato (pulsanti `.seg`) e di `#f-finished`; `readReading` legge `#f-year`.
- [ ] **Step 4: Aggiungi a `test/sincronizzazione.mjs`** (dopo il passo «vince la modifica più recente»): `ok('anno di lettura arriva su B', (await localBook(B, id)).finishedYear === 2018)` impostandolo su A dalla scheda.
- [ ] **Step 5:** `node test/run.mjs statistiche sincronizzazione` → tutti OK.
- [ ] **Step 6: Commit** — `git commit -m "Statistiche 1/4: anno di lettura facoltativo e data di fine solo al passaggio a Letto"`

### Task 2: `computeStats(books, oggi)`

**Files:**
- Modify: `app.js` — nuova funzione vicino a `renderStats` (~644); esposta in sola lettura come `window.libreriaStats = { compute: computeStats }` (serve ai test)
- Modify: `test/statistiche.mjs` (seconda parte: calcoli)

**Interfaces:**
- Consumes: `finishedYear` (Task 1), `yearOf()`, `today()`.
- Produces:
  ```
  computeStats(books: Book[], oggi: Date) → {
    sempre: { read, pages, avgRating: number|null, unrated, ratings: {1..5: n},
              fiveStars: Book[], days: { count, avg, fastest:{book, days}, slowest:{book, days} } | null,
              months: number[12], monthsCount, authors: [{name, count, pages, avgRating}], genres: [{name, count}] },
    anni: [{ year, count, pages, avgRating, months: number[12], topAuthor:{name,count}|null,
             topGenre:{name,count}|null, best: Book|null }],   // dal più recente
    noYear: number,          // letti senza anno (né data valida né finishedYear)
    racconti: number[]       // anni oggi−1 e oggi−2 con almeno un libro, dal più recente
  }
  ```

- [ ] **Step 1: Scrivi i test dei calcoli** con `page.evaluate(() => window.libreriaStats.compute(FIXTURE, new Date('2026-10-25T12:00:00')))`. Fixture (tutti `letto` salvo dove indicato):

  | id | autore | genere | pp | voto | inizio | fine / anno |
  |---|---|---|---|---|---|---|
  | Uno | Don Winslow | Thriller | 400 | 5 | 2025-07-01 | 2025-08-10 |
  | Due | Don Winslow | Thriller | 300 | 4 | 2025-08-20 | 2025-08-22 |
  | Tre | Mick Herron | Thriller | 350 | 5 | 2024-01-01 | 2024-03-15 |
  | Quattro | Mick Herron | Narrativa | 200 | 3 | — | 2024-08-05 |
  | Cinque | Stephen King | Narrativa | 900 | 0 | — | anno 2019 |
  | Sei | Stephen King | Horror | 500 | 4 | — | — |
  | Sette | Bad Dates | Saggi | 100 | 2 | 2025-05-10 | 2025-05-01 |
  | Dieci | Futuro | Saggi | 100 | 1 | 2027-01-01 | 2027-01-10 |
  | Otto | — | — | — | — | in-lettura | — |
  | Nove | — | — | — | — | da-leggere | — |

  Asserzioni: `read 8`, `pages 2850`, `avgRating ≈ 3.4286`, `unrated 1`, `ratings {5:2,4:2,3:1,2:1,1:1}`, `fiveStars` = Uno, Tre; `days {count 3, avg 40, fastest Due 3, slowest Tre 75}`; `months` = `[0,0,1,0,1,0,0,3,0,0,0,0]`, `monthsCount 5`; autori in ordine Stephen King (2, 1400, 4), Don Winslow (2, 700, 4.5), Mick Herron (2, 550, 4), Bad Dates, Futuro; generi Thriller 3, Narrativa 2, Saggi 2, Horror 1; `anni` = 2025 (3 libri, 800 pp, voto ≈3.67, mesi maggio 1 e agosto 2, autore Don Winslow 2, genere Thriller 2, best Uno), 2024 (2, 550, 4, genere Narrativa a parità perché più recente, best Tre), 2019 (1, 900, voto null, best null); `noYear 2`; `racconti [2025, 2024]`; con oggi 2025-06-01 → `racconti [2024]`.
  Più un caso minimo (Review Focus 2): `[{status:'letto', title:'X'}]` → `pages 0`, `avgRating null`, `days null`, `authors []`, `genres []`, `noYear 1`.
- [ ] **Step 2:** `node test/run.mjs statistiche` → FAIL (`window.libreriaStats` non definito).
- [ ] **Step 3: Implementa `computeStats`** in un solo passaggio sui libri letti; una data è valida se `finished <= today()`; a parità «più recente» = `finished`, poi `updated`.
- [ ] **Step 4:** `node test/run.mjs statistiche` → tutti OK.
- [ ] **Step 5: Commit** — `git commit -m "Statistiche 2/4: calcoli in computeStats"`

### Task 3: Pagina Statistiche

**Files:**
- Modify: `app.js` — `renderStats(stats)` al posto dell'attuale (~644), chiamata in `render()` (~683) come `renderStats(computeStats(state.books, new Date()))`
- Modify: `style.css` — sezione `.stats` (~120-132): pannelli, barre orizzontali, mesi, schede anno, schede racconto, due colonne da 1024 px
- Modify: `test/statistiche.mjs` (terza parte: pagina)

**Interfaces:**
- Consumes: `computeStats` (Task 2).
- Produces (usati dai test e dal Task 4): `.stats`; schede racconto `button.story-card[data-story="2025"]`; pannelli `[data-panel="sintesi|voti|tempo|mesi|autori|generi"]`; anni `details.year[data-year="AAAA"]` (il primo `open`); nota `.stats-noyear`; vuoto `.stats-empty`.

- [ ] **Step 1: Scrivi i test della pagina** (fixture del Task 2 in `localStorage`, `page.clock.setFixedTime(new Date('2026-10-25T12:00:00'))` prima di `goto`, poi tasto Statistiche):
  - `ok('due schede racconto 2025 e 2024', ids === '2025,2024')`
  - `ok('pannelli di Sempre presenti', 6 pannelli)` e `ok('sintesi mostra 8 libri e 40 giorni', ...)` dal testo di `[data-panel="sintesi"]`
  - `ok('anni 2025, 2024, 2019, il primo aperto', ...)`
  - `ok('nota libri senza anno: 2', /2 libri letti non hanno un anno/.test(...))`
  - `ok('libreria senza letti: messaggio', text === 'Quando segnerai un libro come Letto, qui compariranno le tue statistiche')` e nessun pannello
  - `ok('senza date: Mesi e Tempo spiegano cosa serve', hint presenti, nessuna barra)` con soli libri senza date
  - `ok('titoli lunghi: niente scorrimento orizzontale', ...)` con un autore di 120 caratteri (Review Focus 3)
  - Per 390×844 e 1366×860, chiaro e scuro: niente scorrimento orizzontale e nessun errore in console
- [ ] **Step 2:** `node test/run.mjs statistiche` → FAIL.
- [ ] **Step 3: Implementa `renderStats(stats)` e lo stile** seguendo la sezione «Pagina Statistiche» della spec (anteprima approvata da Diego): ordine Racconti → «Sempre» → «Anno per anno» → nota; numeri accanto alle barre; testi lunghi con `text-overflow: ellipsis`.
- [ ] **Step 4:** `node test/run.mjs statistiche interfaccia` → tutti OK; guarda gli screenshot a 390 e 1366 px, chiaro e scuro.
- [ ] **Step 5: Commit** — `git commit -m "Statistiche 3/4: nuova pagina con sempre e anno per anno"`

### Task 4: Racconto

**Files:**
- Modify: `app.js` — `openStory(year)` e il suo cablaggio sui `button.story-card` in `render()`
- Modify: `style.css` — `#story` a schermo intero, schermate, trattini, frecce, `prefers-reduced-motion`
- Modify: `test/statistiche.mjs` (quarta parte: racconto)

**Interfaces:**
- Consumes: `computeStats` (Task 2), `.story-card[data-story]` (Task 3), `coverHTML(b)`, `thumb(url, w)`.
- Produces: `#story[role="dialog"][aria-modal="true"]` con `.slide[data-s="copertina|numeri|mese|tempo|autore|genere|preferito|voti|chiusura"]` (una visibile alla volta), `.story-bars i` (`.on` fino alla corrente), pulsanti `.story-prev`, `.story-next`, `.story-close`; tasti ←, →, Esc; tocco sulla metà destra/sinistra.

- [ ] **Step 1: Scrivi i test del racconto** (stessa fixture e data):
  - `ok('2025: 9 schermate', slides === 9)`; `ok('2024: versione ridotta, 3 schermate', ...)` (2 libri)
  - `ok('avanti con → e con la freccia, indietro con ←', ...)` leggendo `data-s` della schermata visibile
  - `ok('oltre l\'ultima resta su chiusura, prima della prima resta su copertina', ...)` (Review Focus 4)
  - `ok('Esc e ✕ chiudono e il focus torna alla scheda', ...)`
  - `ok('racconti rolling al 2027-01-05: 2026 e 2025', ...)` con una fixture che ha un libro finito nel 2026 e `page.clock.setFixedTime(new Date('2027-01-05T10:00:00'))`
  - `ok('racconto: nessun errore e niente scorrimento a 390 px', ...)`
- [ ] **Step 2:** `node test/run.mjs statistiche` → FAIL.
- [ ] **Step 3: Implementa `openStory(year)`**: calcola le schermate dall'anno di `computeStats`, salta quelle senza dati, focus intrappolato nel dialogo e restituito alla scheda alla chiusura, nessun avanzamento automatico.
- [ ] **Step 4:** `node test/run.mjs statistiche` → tutti OK; guarda gli screenshot delle schermate.
- [ ] **Step 5: Commit** — `git commit -m "Statistiche 4/4: racconto degli ultimi due anni"`

### Task 5: Pubblicazione

**Files:**
- Modify: `sw.js` (`VERSION` v46 → v47), `CLAUDE.md` (funzioni, campo `finishedYear` nei Dati, gruppo `statistiche` tra i test con il nuovo totale di controlli, voce in Storia del lavoro)

- [ ] **Step 1:** aggiorna `sw.js` e `CLAUDE.md`.
- [ ] **Step 2:** `node test/run.mjs` → tutti OK (i 58 di prima più quelli nuovi).
- [ ] **Step 3:** controlla il peso aggiunto: `git diff --stat origin/main -- app.js style.css` (atteso circa 8–10 KB).
- [ ] **Step 4: Commit e unione** con la skill `/pubblica` (o a mano: commit, `git merge --no-ff statistiche` su `main`, push; l'hook lancia i test prima del push).
