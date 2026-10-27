# Tre funzioni: pagina rapida, annulla operazioni, il prossimo libro — design

Data: 2026-10-27 · Stato: da rivedere con Diego · Percorso Superpowers: architetturale (brainstorming → spec → piano)

## Obiettivo

Tre miglioramenti scelti da Diego dopo un brainstorming con tre agenti (usabilità, dati, abitudini di lettura):

1. **Pagina rapida**: far avanzare la pagina del libro in lettura senza scrivere il numero ogni volta.
2. **Annulla operazioni**: poter tornare indietro dopo un'operazione che cambia molti libri insieme.
3. **Il prossimo libro**: aiutare a scegliere cosa leggere dalla pila Da leggere.

Nota emersa dall'analisi del codice: aggiornare la pagina dall'hero e salvare il backup con la condivisione di iOS esistono già (`readingCards` con «Aggiorna»; `exportBackup` con `navigator.share`). Questo progetto aggiunge solo ciò che manca.

Criteri di riuscita:
- La pagina avanza con un tocco o un trascinamento, e ogni gesto si può annullare.
- Un import, un acquisto, «Completa autori e copertine» o l'unione con il cloud si possono annullare dalla scheda Backup, anche con la sincronizzazione attiva.
- Quando non c'è niente in lettura, l'app propone tre libri dalla pila, uno legato alle ultime letture.
- App leggera: circa 5–6 KB di codice e stile in tutto, nessuna libreria esterna.

## Decisioni prese con Diego

| Domanda | Scelta |
|---|---|
| Cosa pesa nell'aggiornare la pagina | Scrivere il numero ogni volta |
| Scorciatoie | +10, «ripeti l'ultimo salto» e cursore (cursore solo perché funziona bene su iPhone) |
| Salvataggio | Subito, con «Annulla» |
| Operazioni annullabili | Tutte quelle su molti libri: import backup/CSV, import acquisti, «Completa autori e copertine», unione con il cloud |
| Dove tenere le copie | IndexedDB, ultime 3 |
| Proposte del prossimo libro | Tre: affine alle ultime letture, la più vecchia in pila, a caso |

## 1. Pagina rapida (scheda «In lettura adesso»)

### Interfaccia
Nella scheda di ogni libro in lettura (`readingCards`), sotto la barra di avanzamento:
- **Cursore** `<input type="range">` da 0 alle pagine totali; solo se il totale è noto. Durante il trascinamento aggiorna il numero mostrato; al rilascio (evento `change`) salva.
- **+10**: aggiunge 10 pagine.
- **«+N» (ripeti l'ultimo salto)**: visibile solo se il libro ha `pageStep > 0`; aggiunge `pageStep` pagine.
- Restano il campo numerico e «Aggiorna» per la pagina esatta.

### Regole
- Ogni gesto salva subito e mostra `toast("Pagina 152", { label: "Annulla", run })`; «Annulla» rimette la pagina precedente (e il `pageStep` precedente).
- La pagina è limitata a 0…totale (se il totale è noto).
- `pageStep` = nuova pagina − pagina precedente, aggiornato **solo** quando la pagina cambia dal campo numerico o dal cursore e il salto è positivo; +10 e «ripeti» non lo cambiano.
- Arrivati al totale compare il pulsante esistente «Finito! Segna come letto».
- Si ridisegna solo l'hero (`renderHero`) e il conteggio, non tutta la libreria.

### Dati
- Nuovo campo libro `pageStep` (intero positivo) in `FIELDS`; `clean()` lo converte in numero e lo scarta se non è un intero tra 1 e 2000. Viaggia con backup e sincronizzazione.

### Accessibilità
Etichette: «Aggiungi 10 pagine», «Aggiungi N pagine», cursore «Pagina attuale di *titolo*». Bersagli al tocco ≥ 44 px.

## 2. Annulla operazioni su molti libri

### Copie
- Database IndexedDB `libreria-copie`, archivio `copie`; ogni copia: `{ id, at (ms), label, books }`, dove `books` è l'elenco dei libri passati da `clean()` **senza** `spine` e `spineRatio`.
- Si tengono le ultime **3** copie (la più vecchia si cancella).
- Funzione `snapshot(label)` chiamata subito prima di:
  - import di backup JSON o CSV Goodreads (`addMany` dalla scheda Backup) — «Import del backup» / «Import CSV»;
  - import degli acquisti — «Import degli acquisti»;
  - «Completa autori e copertine» — «Completa autori e copertine»;
  - unione con il cloud al primo accesso (`cloud.js`, tramite `libreriaHost.snapshot`) — «Unione con il cloud».
- Se IndexedDB non è disponibile o fallisce, l'operazione prosegue senza copia (nessun blocco).

### Ripristino
- In Altro → Backup, sezione «Annulla»: elenco delle copie, dalla più recente, ognuna con «Prima di: *label* · gg/mm alle hh:mm» e «Ripristina» (conferma in due tocchi).
- `restoreSnapshot(id)`:
  1. fa prima `snapshot("Prima del ripristino")`, così il ripristino si può annullare;
  2. i libri presenti ora e assenti nella copia vengono eliminati con `removeBook` (segnaposto per il cloud);
  3. i libri della copia sostituiscono quelli attuali, mantenendo `spine`/`spineRatio` attuali dello stesso `id`;
  4. ogni libro ripristinato riceve `updated = Date.now()` e `cloudHook("changed", id)`, così vince sulla versione nel cloud;
  4b. gli `id` ripristinati vengono tolti da `libreria-tombs`, altrimenti un libro eliminato dopo la copia verrebbe cancellato di nuovo dal cloud;
  5. `schedulePersist()`, `render()`, messaggio «Libreria riportata al gg/mm alle hh:mm».
- Se IndexedDB non è disponibile la sezione mostra «L'annullamento non è disponibile su questo dispositivo».

## 3. Il prossimo libro

### Dove
- **Hero**: quando non ci sono libri in lettura, la vista è Libreria e il filtro è Tutti o Da leggere, al posto di «In lettura adesso» compare «Cosa leggo adesso?» con le proposte.
- **Scaffale Da leggere**: pulsante «Scegli per me» accanto al titolo; apre le stesse proposte in una scheda (utile anche con letture in corso).

### Proposte (funzione pura `nextBooks(books, exclude)`)
Tutte prese dai libri `da-leggere`, mai ripetute tra loro e mai tra quelle in `exclude`:
1. **Affine**: autori degli ultimi 3 libri `letto` (ordinati per `finished`, poi `updated`); il primo libro in pila dello stesso autore (dal più vecchio per `added`); se nessuno, dello stesso genere. Motivo: «Dopo *Titolo*, ancora *Autore*» oppure «Un altro *genere*, come *Titolo*». Senza libri letti o senza corrispondenze, questa proposta diventa «a caso».
2. **La più vecchia in pila**: minimo `added`. Motivo: «In pila da *mese anno*».
3. **A caso** tra le restanti.
- Ogni proposta: copertina, titolo, autore, pagine, motivo, pulsante «Inizia» (`setStatus(b, "in-lettura")`, inizio oggi).
- «Altre proposte»: aggiunge le proposte mostrate a `exclude` e ricalcola; esaurita la pila, `exclude` si azzera.
- «Non ora»: nasconde la proposta nell'hero fino alla prossima apertura dell'app (solo in memoria).
- Con 1–2 libri in pila compaiono solo quelli; con la pila vuota non compare nulla.

### Dati
Nessun dato nuovo.

## Fuori ambito (prossimo progetto)
- **Serie e numero del volume da Wikidata** (P179, P1545): Diego l'ha chiesto come progetto successivo; permetterà alla proposta «affine» di indicare il volume successivo di una saga.

## Struttura del codice
- Tutto in `app.js` e `style.css`; `cloud.js` solo per chiamare `libreriaHost.snapshot` prima dell'unione.
- Funzioni: `pageQuick(b, delta | value, { fromInput })`, `snapshot(label)`, `listSnapshots()`, `restoreSnapshot(id)`, `nextBooks(books, exclude)` (pura, esposta per i test come `window.libreriaNext`), `renderNext()`.
- `VERSION` in `sw.js` incrementata.

## Test (`test/`)
Nuovo gruppo `funzioni`:
- Pagina rapida: +10 salva subito e «Annulla» ripristina; «ripeti» usa il salto dell'ultima pagina scritta; il cursore salva al rilascio; limite al totale e comparsa di «Finito»; `pageStep` non cambia con +10.
- Annulla: un import con «aggiorna» modifica un libro e il ripristino lo riporta; un libro aggiunto dall'import sparisce; il ripristino è a sua volta annullabile; «Completa autori e copertine» crea una copia; massimo 3 copie.
- Sincronizzazione (gruppo esistente): ripristino su A arriva su B.
- Prossimo libro (con `window.libreriaNext` e interfaccia): affine per autore e per genere; la più vecchia; tre proposte diverse; «Inizia» porta a In lettura con inizio oggi; «Altre proposte» cambia i libri; pila vuota → niente.
- Interfaccia: 390×844 e 1366×860, chiaro e scuro, nessun errore in console, niente scorrimento orizzontale.
