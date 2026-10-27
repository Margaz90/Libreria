# Tre funzioni (pagina rapida, annulla operazioni, il prossimo libro) — piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere a MyLibrary la pagina rapida nell'hero, l'annullamento delle operazioni su molti libri e le proposte «Il prossimo libro».

**Architecture:** Tutto in `app.js` e `style.css` (PWA senza build); `cloud.js` chiama solo `libreriaHost.snapshot` prima dell'unione. Le copie vanno in IndexedDB; `nextBooks` è una funzione pura esposta per i test. Test end-to-end con Playwright nel nuovo gruppo `test/funzioni.mjs`.

**Tech Stack:** JavaScript puro, CSS, IndexedDB, Playwright (Chromium) per i test.

**Spec:** `docs/superpowers/specs/2026-10-27-tre-funzioni-design.md`

## Global Constraints

- Testi dell'interfaccia e commit in italiano.
- Nessuna libreria esterna; peso totale circa 5–6 KB tra codice e stile.
- Ogni gesto della pagina rapida salva subito e offre «Annulla» (`toast(msg, { label: "Annulla", run })`).
- Copie: IndexedDB `libreria-copie`, archivio `copie`, ultime 3, senza `spine`/`spineRatio`.
- Copia prima di: import backup/CSV, import acquisti, «Completa autori e copertine», unione con il cloud al primo accesso. Non prima del caricamento dei libri Goodreads a libreria vuota.
- Proposte: tre (affine, più vecchia, a caso), mai ripetute; nessun dato nuovo.
- Bersagli al tocco ≥ 44 px; 390×844 e 1366×860, chiaro e scuro: nessun errore in console, niente scorrimento orizzontale.
- A fine lavoro: `VERSION` in `sw.js` incrementata e `CLAUDE.md` aggiornato.

## Review Focus

1. Libro in lettura senza pagine totali: niente cursore, +10 funziona, nessun limite superiore.
2. Due tocchi rapidi su +10 seguiti da «Annulla»: si torna alla pagina prima dell'ultimo tocco, non a una pagina sbagliata.
3. Libro eliminato dopo la copia e poi ripristinato: deve tornare e restare (va tolto il suo segnaposto in `libreria-tombs`, altrimenti il cloud lo cancella di nuovo).
4. IndexedDB non disponibile: l'import funziona lo stesso e la sezione «Annulla» lo dice.
5. Libri senza autore né genere: la proposta affine non abbina valori vuoti tra loro.

---

### Task 1: Anteprime grafiche (da approvare prima del codice)

Diego vuole vedere le integrazioni grafiche prima dell'implementazione.

**Files:**
- Create: script usa e getta in `scratchpad/` (non nel repository)

- [ ] **Step 1:** Con Playwright, sull'app vera con i 108 libri, inserire markup e stile di prova per: (a) scheda «In lettura adesso» con cursore, +10 e «+32»; (b) toast «Pagina 152 · Annulla»; (c) sezione «Annulla» in Altro → Backup con 3 copie; (d) hero «Cosa leggo adesso?» con 3 proposte e motivo; (e) pulsante «Scegli per me» nello scaffale Da leggere.
- [ ] **Step 2:** Screenshot a 390×844 chiaro e scuro (e 1366 per l'hero), composti in un'immagine di confronto; inviarli a Diego.
- [ ] **Step 3:** Attendere l'approvazione di Diego; le modifiche richieste diventano lo stile di riferimento dei Task 2–4.

### Task 2: Pagina rapida

**Files:**
- Modify: `app.js` — `FIELDS`, `clean()`, `readingCards()`, `wireMain()` (gestori `data-page`/`data-save`)
- Modify: `style.css` — `.pquick`
- Create: `test/funzioni.mjs` (prima parte) e voce `'funzioni'` in `ALL` di `test/run.mjs`

**Interfaces:**
- Produces: campo libro `pageStep: number | undefined`; `pageQuick(id: string, { add?: number, to?: number, manual?: boolean }): void`; selettori `.pquick`, `button[data-add="10"]`, `button[data-repeat]` (testo «+N»), `input[type=range][data-range="<id>"]`.

- [ ] **Step 1: Test** in `test/funzioni.mjs` (libro in lettura `p1`, 300 pagine, pagina 100; `p2` senza pagine totali):
  - `ok('+10 salva subito', page === 110)` e `ok('Annulla torna a 100', page === 100)` dal pulsante del toast
  - `ok('pagina scritta a mano: salto ricordato', pageStep === 30)` scrivendo 130 e «Aggiorna», poi `ok('ripeti mostra +30 e porta a 160', ...)`
  - `ok('+10 non cambia il salto', pageStep === 30)`
  - `ok('cursore: salva al rilascio', page === 250)` (fill + evento change)
  - `ok('limite al totale e compare Finito', page === 300 && finish visibile)`
  - `ok('senza pagine totali: niente cursore, +10 funziona', ...)` (Review Focus 1)
  - `ok('due +10 rapidi e Annulla: si torna a 110', ...)` (Review Focus 2)
- [ ] **Step 2:** `node test/run.mjs funzioni` → FAIL.
- [ ] **Step 3: Implementa** `pageStep` in `FIELDS` e in `clean()` (intero 1…2000, altrimenti tolto); `pageQuick` aggiorna `page` (limite 0…pages se noto), aggiorna `pageStep` solo con `manual: true` e salto positivo, salva come `upsert` ma ridisegnando solo l'hero, e mostra il toast con «Annulla» che ripristina `page` e `pageStep` precedenti. In `readingCards` aggiungi `.pquick` sotto la barra (cursore solo con pagine totali); il campo numerico e il cursore chiamano `pageQuick(..., { to, manual: true })`.
- [ ] **Step 4:** `node test/run.mjs funzioni interfaccia` → tutti OK.
- [ ] **Step 5: Commit** — `Funzioni 1/3: pagina rapida nell'hero (cursore, +10, ripeti, annulla)`

### Task 3: Copie e ripristino

**Files:**
- Modify: `app.js` — nuove `snapshot`, `listSnapshots`, `restoreSnapshot`; chiamate in `go.onclick` della scheda Backup (prima di `addPurchases` e di `addMany(pending, …)`), in `#i-authors` (prima di `enrichBooks`); sezione «Annulla» in `openImport()`; `window.libreriaHost.snapshot`
- Modify: `cloud.js` — prima di `await reconcile(choice, snap)` nel primo accesso: `if (first && H.snapshot) await H.snapshot("Unione con il cloud")`
- Modify: `test/funzioni.mjs` (seconda parte), `test/sincronizzazione.mjs` (un controllo)

**Interfaces:**
- Produces: `snapshot(label: string): Promise<boolean>`; `listSnapshots(): Promise<{ id: number, at: number, label: string, count: number }[]>`; `restoreSnapshot(id: number): Promise<boolean>`; selettori `#u-list`, `button[data-restore="<id>"]` (primo tocco: testo «Conferma ripristino»), `#u-none` (IndexedDB assente).

- [ ] **Step 1: Test** (import JSON con «aggiorna» da `#i-file` come in `test/sicurezza.mjs`):
  - `ok('import con aggiorna: dopo il ripristino il titolo torna', ...)` 
  - `ok('libro aggiunto dall\'import sparisce col ripristino', ...)`
  - `ok('il ripristino è annullabile (copia «Prima del ripristino»)', ...)`
  - `ok('Completa autori e copertine crea una copia', ...)`
  - `ok('al massimo 3 copie', count === 3)` dopo 4 import
  - `ok('libro eliminato dopo la copia: ripristinato e senza segnaposto', ...)` (Review Focus 3: controlla `libreria-tombs`)
  - `ok('senza IndexedDB: import riuscito e #u-none visibile', ...)` con `addInitScript` che rende `indexedDB.open` un errore (Review Focus 4)
  - In `test/sincronizzazione.mjs`: `ok('ripristino su A arriva su B', ...)`
- [ ] **Step 2:** `node test/run.mjs funzioni sincronizzazione` → FAIL.
- [ ] **Step 3: Implementa** le tre funzioni con IndexedDB (versione 1, `keyPath: "id"` = `at`), tenendo le ultime 3; `restoreSnapshot` segue i passi 1–5 della spec più: rimuovere da `libreria-tombs` gli `id` ripristinati. `go.onclick` diventa `async` e attende `snapshot` prima di importare.
- [ ] **Step 4:** `node test/run.mjs funzioni sincronizzazione` → tutti OK.
- [ ] **Step 5: Commit** — `Funzioni 2/3: copie prima delle operazioni su molti libri e ripristino`

### Task 4: Il prossimo libro

**Files:**
- Modify: `app.js` — nuova `nextBooks`, `renderNext`; `renderHero()` (caso senza letture), `shelfHTML()` (pulsante nello scaffale Da leggere), scheda delle proposte
- Modify: `style.css` — `.next`, `.ncard`
- Modify: `test/funzioni.mjs` (terza parte)

**Interfaces:**
- Consumes: `setStatus(b, "in-lettura")` esistente.
- Produces: `nextBooks(books: Book[], exclude: string[] = [], rnd: () => number = Math.random): { book: Book, kind: "affine" | "vecchio" | "caso", reason: string }[]`, esposta come `window.libreriaNext = Object.freeze({ next: nextBooks })`; selettori `#hero .next`, `.ncard[data-next="<id>"]`, `button[data-start="<id>"]`, `#n-more`, `#n-later`, `button[data-choose]`.

- [ ] **Step 1: Test** (funzione pura via `window.libreriaNext.next`, con `rnd` fisso):
  - `ok('affine: stesso autore dell\'ultimo letto', kind === 'affine' && author === 'Mick Herron')`
  - `ok('affine per genere se manca l\'autore', ...)`
  - `ok('la più vecchia è quella con added minore', ...)`
  - `ok('tre proposte diverse', new Set(ids).size === 3)`
  - `ok('libri senza autore né genere: nessun abbinamento vuoto', ...)` (Review Focus 5)
  - `ok('pila vuota: nessuna proposta', list.length === 0)`
  - Interfaccia: `ok('hero senza letture mostra Cosa leggo adesso?', ...)`, `ok('Inizia porta a In lettura con inizio oggi', ...)`, `ok('Altre proposte cambia i libri', ...)`, `ok('Non ora nasconde la proposta', ...)`, `ok('Scegli per me apre le proposte', ...)`
- [ ] **Step 2:** `node test/run.mjs funzioni` → FAIL.
- [ ] **Step 3: Implementa** `nextBooks` secondo la spec (affine: autori degli ultimi 3 letti per `finished` poi `updated`, poi genere; vecchio: `added` minore; caso: `rnd` sulle restanti); `renderHero` mostra `.next` quando non ci sono letture e la vista è Libreria con filtro Tutti o Da leggere, salvo «Non ora» (stato in memoria).
- [ ] **Step 4:** `node test/run.mjs funzioni interfaccia` → tutti OK; screenshot a 390 e 1366, chiaro e scuro, confrontati con le anteprime approvate.
- [ ] **Step 5: Commit** — `Funzioni 3/3: il prossimo libro`

### Task 5: Revisione e pubblicazione

**Files:**
- Modify: `sw.js` (`VERSION` +1), `CLAUDE.md` (funzioni, campo `pageStep`, gruppo `funzioni`, nuovo totale dei controlli, voce in Storia del lavoro, progetto successivo «Serie da Wikidata» in Altre idee)

- [ ] **Step 1:** aggiorna `sw.js` e `CLAUDE.md`.
- [ ] **Step 2:** `node test/run.mjs` → tutti OK.
- [ ] **Step 3:** revisione finale dell'intero branch con un revisore sul modello più capace; correzioni con test che prima falliscono.
- [ ] **Step 4:** peso aggiunto: `git diff --stat main -- app.js style.css cloud.js` (atteso circa 5–6 KB).
- [ ] **Step 5:** unione su `main` e push (l'hook lancia i test).
