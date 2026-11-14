# «Carica i libri» con modello Excel — progetto

Data: 14 novembre 2026. Richiesta di Diego dopo il passaggio al nuovo indirizzo (v90).

## Perché
Con la libreria vuota l'avviso propone «Carica i libri Goodreads», che carica `seed.json`: i 108 libri di Diego. Diego vuole, in futuro, aprire l'app ad altre persone: per loro quel pulsante caricherebbe la libreria di Diego. Al suo posto serve un generico «Carica i libri», con la possibilità di preparare l'elenco fuori dall'app in un foglio Excel (modello da scaricare, compilare, caricare). I libri di Diego sono nel cloud, nel suo backup JSON e nella storia di GitHub: `seed.json` non serve più (scelta di Diego: toglierlo dall'app).

## Obiettivi
- Avviso di libreria vuota: «Carica i libri» al posto di «Carica i libri Goodreads»; testi senza riferimenti ai 108 libri.
- Scheda «Carica i libri»: «Scarica il modello Excel», scelta del file, «Aggiorna i libri già presenti», «Importa», stesse conferme e copia di sicurezza dell'import di oggi.
- Formati accettati, in tutti e due i punti (scheda nuova e Altro → Backup → Importa): modello Excel compilato (`.xlsx`, anche salvato da Numbers o Google Fogli), CSV (con virgola o punto e virgola, come lo salva Excel in italiano; intestazioni del modello oppure di Goodreads), backup JSON dell'app, file degli acquisti (JSON con `"acquisti": true`).
- Modello `modello-libri.xlsx` statico nel repository, scaricato solo a richiesta.
- `seed.json` e i pulsanti «Carica i libri Goodreads» spariscono dall'app.

## Non obiettivi
- Esportare la libreria in Excel (il backup resta JSON).
- Leggere `.xls` vecchio, `.numbers`, `.ods`.
- Fogli con più tabelle o formule complesse: si legge il primo foglio (o quello chiamato «Libri»), riga 1 = intestazioni.

## Anti-obiettivi
- App più pesante di qualche KB: niente librerie esterne per Excel (300–900 KB).
- Libri importati con dati sbagliati senza accorgersene (ISBN diventati «9,78E+12», date scambiate giorno/mese, stati sconosciuti presi per buoni).
- Un altro utente che si ritrova i libri di Diego.
- Perdere la possibilità di ripristinare un backup o di importare da Goodreads.

## Vincoli
- PWA senza build; nuove funzioni pure nei tratti `// <regole>` (provate da Node); niente `document` dentro.
- Lettura `.xlsx` con `DecompressionStream("deflate-raw")` (Safari 16.4+, Chrome, Firefox 113+, Node 20.12+/21.2+; qui Node 22). Dove manca: messaggio «Questo browser non legge i file Excel: salva il foglio come CSV e caricalo».
- Ogni libro passa da `addMany` / `tidy` come oggi (regole della lettura, `clean`).
- Hook `proteggi-file.mjs` protegge `seed.json`: Diego ha chiesto di toglierlo (14 novembre 2026); la modifica del hook (resta solo `zxing.min.js`) va confermata da Diego con l'approvazione di questo documento.

## Approcci considerati
- **A. Modello `.xlsx` vero e import di `.xlsx` e `.csv` con un lettore scritto apposta (circa 4 KB)** — scelto da Diego. Pro: si apre e si salva così com'è in Excel, Numbers, Google Fogli; ISBN e date restano giusti; elenco a tendina e istruzioni. Contro: qualche KB di codice; serve iOS 16.4+.
- B. Modello CSV. Pro: 1 KB. Contro: Excel rovina ISBN e date, niente tendine né istruzioni, avvisi di formato al salvataggio.
- C. Libreria esterna per Excel. Scartata: 300–900 KB.

## Come (deciso)
### Modello `modello-libri.xlsx`
- Foglio «Libri», riga 1 intestazioni (grassetto, bloccate), poi due righe di esempio da sovrascrivere: un Letto e un Da leggere.
- Colonne: **Titolo**, **Autore**, Stato, Voto, Data di inizio, Data di fine, Anno di lettura, Pagine, Anno di pubblicazione, Genere, ISBN, Serie, Numero nella serie, Note, Citazione. Titolo e Autore obbligatori (evidenziati).
- Stato: elenco a tendina «Da leggere, In lettura, Letto, Desiderato». Voto: numero intero 1–5 (convalida). Date: formato data. ISBN: formato testo.
- Foglio «Istruzioni»: cosa va in ogni colonna, che vuoto = non noto, che le righe di esempio vanno cancellate, come caricarlo.
- Generato una volta con uno script Python (`openpyxl`) tenuto in `design/modello-libri.py`; il file `.xlsx` è nel repository e pubblicato (Pages e Firebase).

### Lettura dei file (funzioni pure, tratto `// <regole>`)
- `leggiZip(bytes: Uint8Array) -> Promise<Map<nome, Uint8Array>>`: directory centrale dello ZIP, voci «stored» (0) e «deflate» (8) con `DecompressionStream("deflate-raw")`; errore leggibile se il file non è uno ZIP.
- `righeXlsx(files: Map) -> { righe: string[][], data1904: boolean }`: `xl/workbook.xml` + `xl/_rels/workbook.xml.rels` per trovare il foglio «Libri» o il primo; `xl/sharedStrings.xml`; celle con riferimento (`r="C5"`, colonne vuote rispettate), tipi `s`, `inlineStr`, `str`, `b`, `d` (data ISO), numeri anche in notazione scientifica (`9.7888047314810005E+12` → cifre intere); flag `date1904` di `workbook.xml` (vecchio Excel per Mac: +1462 giorni); date come numeri seriali Excel (convertite dove la colonna è una data, sotto). Parsing XML con espressioni regolari (niente `DOMParser`, che in Node non c'è), entità XML decodificate.
- `parseCSV(text)` esteso e spostato in un tratto `// <regole>` (con `fromGoodreads`): separatore scelto dalla prima riga (`;` se ce ne sono più delle `,`), BOM tolto. Codifica: il file si legge come byte; se non è UTF-8 valido (`TextDecoder("utf-8", { fatal: true })`) si rilegge come Windows-1252, che è come Excel in italiano salva il «CSV (delimitato…)». Il conteggio dei tratti in `regole.mjs` si aggiorna.
- `libriDaTabella(righe: string[][], { data1904 }) -> { libri: libro[], avvisi: { riga, colonna, valore }[] }`: riconosce le intestazioni del modello (senza badare a maiuscole, accenti, spazi) e, in alternativa, quelle di Goodreads (comportamento di oggi di `fromGoodreads`, che diventa un caso di questa). Conversioni:
  - Stato: «Da leggere / In lettura / Letto / Desiderato» (anche minuscole, «letti», «to-read» ecc. come Goodreads). Vuoto: si deduce dai dati (Data di fine o Anno di lettura → Letto; solo Data di inizio → In lettura; niente → assente, cioè Da leggere per un libro nuovo), così le date non vengono tolte dalle regole della lettura. Sconosciuto → come vuoto, con un avviso. (Scelta del costruttore, dopo la revisione.)
  - Voto: intero 1–5, altrimenti assente.
  - Date: numero seriale Excel, `AAAA-MM-GG`, `GG/MM/AAAA`, `GG-MM-AAAA`, `GG.MM.AAAA` (sempre giorno prima: modello italiano); `AAAA/MM/GG` di Goodreads; non valide → assenti. Poi `clean` come oggi.
  - Anno di lettura → `finishedYear`; Pagine, Anno di pubblicazione → numeri; ISBN → solo cifre e X (anche se arriva come numero); Numero nella serie → come `seriesNo`.
  - Ogni valore scartato (voto fuori 1–5, data impossibile, ISBN non valido, stato sconosciuto, numero non numero) produce un avviso con riga e colonna; il libro si importa comunque senza quel dato. La scheda mostra «N valori non validi lasciati vuoti» e i primi 5 («riga 4, Voto: «6»»), prima di «Importa». (Scelta del costruttore.)
  - Righe senza Titolo saltate; righe d'esempio del modello riconosciute e saltate solo se identiche al modello.
- In `app.js` (fuori dal tratto): `leggiFileLibri(file) -> Promise<{ libri, acquisti, tipo }>` sceglie per estensione e contenuto: `.xlsx` (o firma `PK`), `.json`, altrimenti CSV.

### Interfaccia
- `renderNotice`: testi «Altrimenti carica i tuoi libri: da un foglio Excel, dal CSV di Goodreads o da un backup.» (non collegato) e «…: i libri del cloud arrivano da soli. Se l'account è vuoto, carica i tuoi libri.» (collegato); pulsante `#carica-go` «Carica i libri» (secondario quando c'è «Accedi e riprendi i libri», principale da collegato).
- Nuova scheda `openCarica()` «Carica i libri»: testo breve, link «Scarica il modello Excel» (`modello-libri.xlsx`, attributo `download`), campo file (`accept=".xlsx,.csv,.json,…"`), «Aggiorna i libri già presenti», «Importa», riga di stato, «Chiudi».
- Il flusso di lettura, conteggio e importazione di oggi (in `openImport`) diventa una funzione unica `collegaImport(sheet)` usata da tutte e due le schede, così Backup → Importa accetta gli stessi formati; lì il testo diventa «Un foglio Excel (modello in «Carica i libri»), un CSV o un backup JSON.»
- Messaggi d'errore: «Non trovo le colonne Titolo e Autore: usa il modello» ; «File Excel non leggibile» ; «Questo browser non legge i file Excel…».

### Cosa sparisce
- `seed.json`, `loadSeed`, `#seed-go`, `#i-seed`, la riga di `sw.js` su `seed.json`, la protezione nel hook `proteggi-file.mjs` (resta `zxing.min.js`). Il file resta nella storia di Git.
- I test usano invece un elenco di 108 libri **inventati** generato da `test/lib.mjs` (stessa forma: titoli italiani, stati, voti, anni; alcuni con dati mancanti come i libri Goodreads), caricato in `localStorage`: l'elenco di Diego esce dalla cartella pubblicata (GitHub Pages pubblica anche `test/`). Resta nella storia di Git del repository. Test che usano `seed.json` o `#seed-go` oggi: `interfaccia` (righe 9–22), `sincronizzazione` (riga 35), `regole` (riga 216, tempi di `novitaDa`), più i riferimenti in `lettura` e `sicurezza` da controllare. (Scelta del costruttore.)

### Test
- `regole`: `leggiZip` + `righeXlsx` sul vero `modello-libri.xlsx` e su file di prova costruiti a mano (ZIP con XML scritto come lo scrivono Excel, Numbers e Google Fogli: celle vuote saltate, testi condivisi e in linea, `t="d"`, `t="str"`, numeri in notazione scientifica, `date1904`, voci «stored» e «deflate»); un CSV Windows-1252 con accenti; `parseCSV` con `;` e BOM; `libriDaTabella` su intestazioni del modello, di Goodreads, in ordine diverso, mancanti; stati, voti, date nei vari formati, righe d'esempio.
- `interfaccia`: avviso con «Carica i libri», scheda con il link al modello (risponde 200), import di un `.xlsx` di prova → libri sugli scaffali con stato, voto, date e ISBN giusti; import CSV con `;`.
- Gli altri gruppi restano verdi con i 108 libri presi dal file di test.

### Documenti
`CLAUDE.md` (Dati: niente più `seed.json`; riassunto import), `docs/funzioni.md`, `docs/storia.md`, `docs/strumenti.md` (hook e test), `LEGGIMI.md`.

## Da provare dal vivo
- Diego carica il modello compilato con Excel o Numbers dal suo dispositivo: nessuna di queste app è disponibile nella sessione, i file di prova imitano il loro formato.

## Lasciato al costruttore
- Testi esatti di istruzioni e messaggi (in italiano semplice).
- Nome del file di prova `.xlsx` e come produrlo (openpyxl, con una cella di ogni tipo).
- Versione: la prima libera dopo la v91.
