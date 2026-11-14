# «Carica i libri» con modello Excel (v92) — piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sostituire «Carica i libri Goodreads» con «Carica i libri», che importa un modello Excel compilato (`.xlsx`), CSV (virgola o punto e virgola, UTF-8 o Windows-1252), backup JSON e acquisti; togliere `seed.json`.

**Architecture:** funzioni pure in un nuovo tratto `// <regole>` (`decodificaTesto`, `parseCSV`, `leggiZip`, `righeXlsx`, `libriDaTabella`), provate da Node; in `app.js` `leggiFileLibri(file)` sceglie il formato e `collegaImport(sheet)` è il flusso unico di import usato da «Carica i libri» e da Backup.

**Tech Stack:** JS senza build, `DecompressionStream("deflate-raw")`, Playwright, `openpyxl` solo per generare il modello.

**Spec:** `docs/superpowers/specs/2026-11-14-carica-libri-design.md`

## Global Constraints
- Nessuna libreria esterna; aggiunta all'app ≤ ~6 KB di codice.
- Colonne del modello, in quest'ordine: Titolo, Autore, Stato, Voto, Data di inizio, Data di fine, Anno di lettura, Pagine, Anno di pubblicazione, Genere, ISBN, Serie, Numero nella serie, Note, Citazione.
- Stati: «Da leggere» → `da-leggere`, «In lettura» → `in-lettura`, «Letto» → `letto`, «Desiderato» → `desiderato` (anche minuscole/accenti/plurali «letti»; e quelli di Goodreads `read`, `currently-reading`, `to-read`).
- Date: seriale Excel (1900, o 1904 se `date1904`), `AAAA-MM-GG`, `AAAA/MM/GG`, `GG/MM/AAAA`, `GG-MM-AAAA`, `GG.MM.AAAA`.
- Stato vuoto o sconosciuto: Data di fine o Anno di lettura → `letto`; solo Data di inizio → `in-lettura`; altrimenti assente. Sconosciuto produce anche un avviso.
- Avvisi: `{ riga, colonna, valore }` (riga = numero della riga nel foglio, 1 = intestazioni); la scheda mostra «N valori non validi lasciati vuoti» e i primi 5 come «riga 4, Voto: «6»».
- Messaggi: «Non trovo le colonne Titolo e Autore: usa il modello.» · «File Excel non leggibile.» · «Questo browser non legge i file Excel: salva il foglio come CSV e caricalo.»
- `VERSION = "v92"`. Testi e commit in italiano.

## Review Focus
1. Foglio con righe o colonne vuote in mezzo (Excel salta le celle vuote nell'XML): le colonne non devono scorrere → test in Task 2 (`r="C5"` dopo `A5`).
2. ISBN arrivato come numero (`9788804668237` o `9.7888046682370005E+12`) → stringa giusta di 13 cifre → Task 2.
3. CSV di Excel italiano con accenti in Windows-1252 → titoli giusti → Task 1.
4. Intestazioni con maiuscole, spazi in più o in un altro ordine, colonne extra non riconosciute → Task 1.
5. Un `.xlsx` vero ma senza le colonne Titolo/Autore (foglio qualsiasi) → messaggio chiaro, nessun libro importato → Task 4.

---

### Task 1: testo, CSV e tabella → libri (pure)

**Files:** Modify `app.js` (nuovo tratto `// <regole>` prima di `addMany`, ~riga 246; sposta lì `parseCSV` e assorbe `fromGoodreads`); Test `test/regole.mjs`.

**Interfaces — Produces:**
- `decodificaTesto(bytes: Uint8Array) -> string` (UTF-8 con BOM tolto; se non valido, Windows-1252).
- `parseCSV(text: string) -> string[][]` (separatore `;` se nella prima riga ce ne sono più delle `,`).
- `libriDaTabella(righe: string[][], { data1904 = false } = {}) -> { libri: object[], avvisi: {riga:number, colonna:string, valore:string}[], colonne: boolean }` (`colonne` false se mancano Titolo o Autore).
- `ESEMPI_MODELLO: string[]` (titoli delle due righe d'esempio, saltate).
- `fromGoodreads(text)` resta come `text => libriDaTabella(parseCSV(text)).libri` per i chiamanti di oggi.

- [ ] **Step 1: test che falliscono** in `regole.mjs` (aggiungi i nomi a `EXPORTS`, conteggio tratti 12 → 13):
  - `decodificaTesto: UTF-8 con BOM e Windows-1252` → `decodificaTesto(Uint8Array.of(0xEF,0xBB,0xBF,0x63,0x69,0x61,0x6F)) === 'ciao'` e `decodificaTesto(Uint8Array.of(0x50,0x65,0x72,0xF2)) === 'Però'`.
  - `parseCSV: punto e virgola e virgolette` → `parseCSV('Titolo;Autore\n"Uno; due";Eco\n')` uguale a `[['Titolo','Autore'],['Uno; due','Eco']]`; con virgole come oggi.
  - `libriDaTabella: modello` → intestazioni `[' titolo','AUTORE','Stato','Voto','Data di fine','ISBN','Colonna mia']`, riga `['Il nome della rosa','Umberto Eco','Letto','5','03/02/2025','978-88-452-1234-5','x']` → `{ title:'Il nome della rosa', author:'Umberto Eco', status:'letto', rating:5, finished:'2025-02-03', isbn:'9788845212345' }`, nessun avviso.
  - `libriDaTabella: stato dedotto` → stato vuoto + Anno di lettura `2019` → `letto`, `finishedYear: 2019`; stato vuoto + solo Data di inizio `2026-01-10` → `in-lettura`; stato «boh» → assente + avviso `{ colonna: 'Stato', valore: 'boh' }`.
  - `libriDaTabella: valori non validi` → Voto `6`, Data di fine `31/02/2025`, Pagine `tante` → campi assenti, 3 avvisi con la riga giusta (riga 2).
  - `libriDaTabella: seriale Excel` → Data di fine `45658` → `2025-01-01`; con `{ data1904: true }` → `2029-01-02`.
  - `libriDaTabella: Goodreads come prima` → stesso risultato di oggi su un CSV Goodreads (Title con «(Serie, #2)» tolto, `Date Read 2024/05/06` → `2024-05-06`, `My Rating 0` → assente, `Exclusive Shelf read` → `letto`).
  - `libriDaTabella: senza colonne` → `colonne === false` con intestazioni `['Nome','Cosa']`.
  - `libriDaTabella: righe d'esempio e senza titolo saltate`.
- [ ] **Step 2:** `node test/run.mjs regole` → FAIL.
- [ ] **Step 3:** implementa nel tratto; intestazioni confrontate con `norm` (già nel progetto) dopo aver tolto spazi; date validate con `isoOk`; ISBN con la stessa pulizia di `parseIsbn`.
- [ ] **Step 4:** `node test/run.mjs regole lettura sicurezza` → PASS (gli import Goodreads di oggi non cambiano).
- [ ] **Step 5:** commit «Import: CSV con punto e virgola e Windows-1252, tabella del modello (v92)».

### Task 2: lettura dei file `.xlsx` (pure)

**Files:** Modify `app.js` (stesso tratto del Task 1); Create `test/xlsx.mjs` (costruisce ZIP di prova con `node:zlib` `deflateRawSync`, esporta `creaXlsx({ fogli, condivise, data1904, stored })`); Test `test/regole.mjs`.

**Interfaces — Produces:** `leggiZip(bytes: Uint8Array) -> Promise<Map<string, Uint8Array>>` (errore `{ code: 'zip' }` se non è ZIP); `righeXlsx(files) -> { righe: string[][], data1904: boolean }` (foglio «Libri» o il primo; errore `{ code: 'xlsx' }` se manca).

- [ ] **Step 1: test che falliscono** (`regole.mjs`, async):
  - `xlsx: testi condivisi e in linea, celle saltate` → riga XML con `A2` e `C2` soli → `['Titolo', '', 'Letto']` con la colonna B vuota.
  - `xlsx: ISBN numerico e in notazione scientifica` → `<v>9788804668237</v>` e `<v>9.7888046682370005E+12</v>` → `'9788804668237'` per entrambi.
  - `xlsx: t="d", t="str", t="b", entità` → `2025-02-03T00:00:00` → `'2025-02-03'`; `&amp;` → `&`.
  - `xlsx: date1904` → flag letto da `workbook.xml`.
  - `xlsx: voci stored e deflate` → stessi risultati.
  - `xlsx: foglio «Libri» anche se non è il primo`.
  - `leggiZip: file non ZIP` → errore `zip`.
- [ ] **Step 2:** `node test/run.mjs regole` → FAIL.
- [ ] **Step 3:** implementa: directory centrale (firma `0x02014b50`, offset dalla fine `0x06054b50`), header locale `0x04034b50`; `DecompressionStream("deflate-raw")` su metodo 8; XML con espressioni regolari.
- [ ] **Step 4:** `node test/run.mjs regole` → PASS.
- [ ] **Step 5:** commit «Import: lettore dei file Excel senza librerie (v92)».

### Task 3: il modello Excel

**Files:** Create `design/modello-libri.py` (openpyxl), `modello-libri.xlsx` (generato); Test `test/regole.mjs`.

- [ ] **Step 1: test che fallisce:** `modello-libri.xlsx: colonne nell'ordine del modello, esempi saltati` → `righeXlsx(await leggiZip(file))` riga 1 = le 15 colonne dei Global Constraints; `libriDaTabella(...)` → 0 libri, `colonne === true`, 0 avvisi; il file pesa meno di 20 KB.
- [ ] **Step 2:** FAIL (file assente).
- [ ] **Step 3:** script: foglio «Libri» (intestazioni in grassetto, riga 1 bloccata, Titolo e Autore evidenziati, larghezze comode), due righe d'esempio con i titoli di `ESEMPI_MODELLO`, convalida Stato (elenco) e Voto (intero 1–5) fino alla riga 1000, colonne date in formato `gg/mm/aaaa`, ISBN in formato testo; foglio «Istruzioni» in italiano semplice. Esegui `python3 design/modello-libri.py`.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** commit «Modello Excel per caricare i libri (v92)».

### Task 4: «Carica i libri» nell'app, via `seed.json`

**Files:** Modify `app.js` (`renderNotice`, `openImport`, nuove `openCarica`, `collegaImport`, `leggiFileLibri`; via `loadSeed`), `sw.js` (riga di `seed.json`), `style.css` (lista avvisi, se serve); Delete `seed.json`; Modify `.claude/hooks/proteggi-file.mjs` (resta `zxing.min.js`); Modify `test/lib.mjs` (nuovo `libri108()`: 108 libri inventati, stessa forma), `test/interfaccia.mjs`, `test/sincronizzazione.mjs`, `test/regole.mjs` (tempi di `novitaDa` con `libri108()`); Test `test/interfaccia.mjs`.

**Interfaces:** Consumes Task 1–3. Produces `openCarica()`, `collegaImport(sheet, { dopo })`, `leggiFileLibri(file) -> Promise<{ libri, acquisti, tipo: 'xlsx'|'csv'|'json', avvisi, colonne }>`.

- [ ] **Step 1: test che falliscono** (`interfaccia.mjs`, a 390 px chiaro):
  - `libreria vuota: «Carica i libri», niente Goodreads` → `#carica-go` presente, nessun testo «Goodreads» né «108» in `#notice`.
  - `«Carica i libri» apre la scheda con il modello` → `.sheet h2` «Carica i libri», link `a[href="modello-libri.xlsx"][download]` che risponde 200.
  - `import di un .xlsx di prova` → `setInputFiles` con un file di `creaXlsx` (3 libri: un Letto con voto e data, un In lettura, uno con Voto «6») → la riga di stato dice «1 valore non valido lasciato vuoto» e «riga 4, Voto: «6»»; dopo «Importa» 3 libri in `localStorage` con `status`, `rating`, `finished`, `isbn` giusti.
  - `import di un CSV con ; e accenti in Windows-1252` → titolo «Però» giusto.
  - `foglio senza Titolo e Autore` → messaggio «Non trovo le colonne Titolo e Autore: usa il modello.», «Importa» disabilitato.
  - Nei controlli esistenti dell'interfaccia: i libri si caricano con `libri108()` in `localStorage` + `reload` (al posto di `#seed-go`); il resto dei controlli resta.
- [ ] **Step 2:** `node test/run.mjs interfaccia` → FAIL.
- [ ] **Step 3:** implementa:
  - `collegaImport(sheet, { dopo })`: estrae da `openImport` campo file, «Aggiorna», «Importa», conteggi, copia di sicurezza (etichetta «Prima dell'import del foglio Excel» per `xlsx`), avvisi; `dopo()` per `fillCopies` in Backup. `accept=".xlsx,.csv,.json,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"`. Il file si legge con `arrayBuffer()`.
  - `openImport`: sezione Importa con il nuovo testo e senza `#i-seed`; usa `collegaImport`.
  - `openCarica`: titolo «Carica i libri», testo breve, link al modello, poi `collegaImport`.
  - `renderNotice`: testi della spec; `#carica-go` (secondario se c'è `#vuota-sync`, primario da collegato).
  - Senza `DecompressionStream`: messaggio dei Global Constraints.
  - Via `loadSeed`, `seed.json` (`git rm`), riga in `sw.js`, `seed.json` dal hook.
- [ ] **Step 4:** `node test/run.mjs interfaccia sincronizzazione regole lettura sicurezza` → PASS.
- [ ] **Step 5:** commit «Carica i libri: modello Excel, CSV e backup; via i 108 libri Goodreads (v92)».

### Task 5: versione, documenti, verifica finale

**Files:** `sw.js` (`VERSION = "v92"`), `CLAUDE.md` (Dati: niente `seed.json`, import; hook; Ultime), `docs/funzioni.md`, `docs/storia.md`, `docs/strumenti.md` (hook, gruppi di test), `LEGGIMI.md` (tabella file).

- [ ] **Step 1:** aggiorna; screenshot dell'avviso e della scheda (chiaro e scuro, 390 px) nello scratchpad.
- [ ] **Step 2:** `node test/run.mjs` in sottofondo → «0 falliti».
- [ ] **Step 3:** revisione indipendente del branch; correzioni RED→GREEN.
- [ ] **Step 4:** push del branch `carica-v92`; a Diego screenshot, riepilogo e richiesta di ok.
