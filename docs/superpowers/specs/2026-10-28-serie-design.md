# Serie e numero del volume — design

Data: 2026-10-28 · Stato: da rivedere con Diego · Versione prevista: v58

## Obiettivo

Sapere di quale serie fa parte un libro e quale volume è, vedere i volumi della stessa serie insieme, e sapere qual è il prossimo volume da leggere (anche se non lo si possiede, ma solo se esiste in italiano).

## Decisioni prese con Diego

| Domanda | Scelta |
|---|---|
| A cosa serve | C: serie e numero nella scheda, volumi insieme e in ordine, prossimo volume da leggere |
| Buchi nei dati | C: ricerca automatica + campi a mano + suggerimento dei nomi già usati |
| Quando cercare | B: libri nuovi, «Aggiorna informazioni», pulsante «Cerca le serie» in Backup (in sottofondo, con copia annullabile) |
| Scaffali | C: ordine «Autore» con la serie in fila + bollino col numero su dorsi e copertine, foto comprese |
| Prossimo volume | B: anche se non lo si possiede, con pulsante «Lista dei desideri» |
| Fonte | A: Wikidata per ISBN e per autore/titolo in tutte le lingue, con titolo originale da Open Library |
| Seguito non tradotto | Non si propone nulla se non c'è un'edizione italiana confermata |

## 1. Dati

Nuovi campi del libro (in `FIELDS` e controllati da `clean()`, quindi validi per import, cloud e backup):

- `series` — nome della serie, stringa senza spazi in eccesso, massimo 80 caratteri. Da Wikidata: etichetta italiana, altrimenti inglese.
- `seriesNo` — numero del volume come stringa di massimo 6 caratteri che rappresenta un numero ≥ 0 (virgola accettata e convertita in punto: «0,5» → «0.5»); altrimenti tolto. L'ordine usa `parseFloat`.
- `seriesNext` — titolo **italiano** del volume successivo, solo se confermato (sezione 4), massimo 200 caratteri.
- `seriesManual` — `true` quando Diego scrive o cambia Serie o N. nella scheda; da allora nessuna ricerca modifica `series`/`seriesNo`. Il controllo del seguito resta permesso.

Senza `series`, `clean()` toglie anche `seriesNo` e `seriesNext`. I campi viaggiano con la sincronizzazione senza modifiche a `cloud.js` (copia l'intero libro).

## 2. Scheda del libro

- Riga sotto Autore con «Serie» (largo, `list` su un `<datalist>` con i nomi già usati, senza doppioni che differiscono solo per maiuscole/spazi) e «N.» (stretto, `inputmode="decimal"`).
- Al salvataggio, se il nome scritto coincide (ignorando maiuscole e spazi) con uno già usato, si usa la forma già usata.
- Cambiare Serie o N. imposta `seriesManual`. Svuotare Serie toglie numero e seguito e lascia `seriesManual` (= «non è in una serie, non cercarla»).
- Nella vista del libro, sotto il titolo: pulsante «Slough House · 3» che scrive il nome della serie nella ricerca. La ricerca della libreria confronta anche `series`.

## 3. Ricerca: `findSeries(b, cache)`

Restituisce `{ series, no, next }` (campi assenti se ignoti) oppure `null`; lancia `{ code }` per errori di rete (`wikidata-rete`, `wikidata-<status>`, `openlibrary-…`) come le altre fonti. Non modifica il libro.

Passi, fermandosi al primo che trova la serie:

1. **ISBN** (se presente, ISBN-13 e ISBN-10 con `isbn13From10`/`isbn10From13`): SPARQL su query.wikidata.org. Edizione per P212/P957 → opera con P629 (o l'elemento stesso se ha P179). Dall'opera: serie P179; numero dal qualificatore P1545 della dichiarazione P179, altrimenti P1545 diretta; seguito dal qualificatore P156 della dichiarazione P179, altrimenti P156 diretta.
2. **Autore**: `wbsearchentities` (italiano, `origin=*`) sul nome dell'autore → fino a 3 candidati umani; una SPARQL scarica le loro opere con P179, con tutte le etichette e gli alias (ogni lingua), serie, numero e seguito. Il risultato si conserva in `cache` per nome normalizzato dell'autore (in memoria, per la durata del lavoro). Si confronta il titolo del libro con etichette e alias.
3. **Titolo originale**: Open Library `/isbn/<isbn>.json` → `translation_of` se presente, altrimenti `works[0]` → `/works/<id>.json` → `title`; con quel titolo si ripete il confronto del passo 2 (stessa cache).

**Confronto dei titoli** (`sameTitle(a, b)`): minuscole, senza accenti né punteggiatura, senza sottotitolo dopo «:» o « - », senza articolo iniziale (il, lo, la, i, gli, le, l', un, uno, una, un', the, a, an). Vale se uguali, o se uno inizia con l'altro e il più corto ha almeno 8 caratteri. Se combaciano due opere diverse → nessun risultato (mai indovinare).

**Seguito italiano** (`next`): solo se l'opera successiva ha un'etichetta italiana **e** una ricerca con quell'etichetta e l'autore trova un risultato con titolo uguale (`sameTitle`) su Apple Books Italia oppure Google Books con lingua italiana. Altrimenti `next` è assente. Il numero del seguito non si memorizza: è `seriesNo + 1` se intero.

**Chi la usa**

- **Nuovo libro**: dopo il salvataggio, in sottofondo; se trova, aggiorna il libro (`patchBook`, `schedulePersist`, `cloudHook`), senza messaggi.
- **Acquisti**: `enrichBooks` cerca anche la serie dei libri nuovi.
- **Aggiorna informazioni**: riempie Serie, N. e seguito nella scheda insieme agli altri campi (non se `seriesManual` per serie e numero); si conferma con Salva.
- **Cerca le serie** (Altro → Backup): `snapshot("Prima di «Cerca le serie»")`, poi in sottofondo un libro alla volta con pausa di 300 ms; riga «Ricerca delle serie: N di M»; si ferma se cambia `dataGen` (ripristino). Elabora i libri senza serie e senza `seriesManual`, più i libri Letti con serie ma senza `seriesNext` (solo il controllo del seguito). Messaggio finale: «Serie trovate per N libri su M» più i motivi degli errori («Wikidata non risponde ×3»). Non parte se è già in corso «Completa autori e copertine» (stesso avviso).

Regole: un errore non svuota mai un campo; i testi passano da `clean()` e, nell'HTML, da `esc()`.

## 4. Prossimo volume: `nextInSeries(b, books)`

Funzione pura, esposta per i test come `window.libreriaSeries = Object.freeze({ next: nextInSeries, sameTitle, findSeries })`.

- Libri della stessa serie: `series` uguale ignorando maiuscole e spazi, con `seriesNo` numerico.
- Risultato: tra quelli con numero maggiore di `b.seriesNo`, il primo (numero più basso) non `letto` → `{ book }`.
- Se non ce n'è: si prende il volume posseduto con il numero più alto (≥ quello di `b`); se ha `seriesNext` e nessun libro posseduto ha un titolo `sameTitle` a quel seguito → `{ title, no }` (no = numero + 1 se intero). Altrimenti `null`.

**Nella scheda di un libro Letto** (riga sotto la serie):

- posseduto Da leggere: «Prossimo: #4 *Titolo* · in pila» (tocco = apre la scheda);
- posseduto Desiderato: «Prossimo: #4 *Titolo* · nella lista dei desideri» (tocco = apre);
- posseduto In lettura: «Prossimo: #4 *Titolo* · in lettura»;
- non posseduto: «Prossimo: *Titolo* · non ce l'hai» + pulsante «Lista dei desideri», che crea un libro `desiderato` con titolo, autore, serie e numero, avvia `fetchInfo` in sottofondo per copertina e dati, e mostra «Aggiunto alla lista dei desideri · Annulla» (Annulla lo rimuove);
- nessun risultato: la riga non c'è.

**In «Cosa leggo adesso?»** (`nextBooks`): prima dell'abbinamento per autore/genere, per ciascuno degli ultimi 3 letti (stesso ordine attuale) si cerca `nextInSeries`; se restituisce un libro Da leggere ancora in pila, è la proposta affine con motivo «Il #4 di Slough House, dopo il #3» (senza numeri: «Il seguito di *Titolo*»). Le altre due proposte non cambiano.

## 5. Scaffali, dorsi e copertine

- Bollino col numero (`.sno`) sui dorsi (disegnati, striscia di copertina, foto) in basso sopra l'asse, e sulle copertine in basso a sinistra; fondo scuro semitrasparente e testo bianco (contrasto ≥ 4,5:1 anche sul fondo più chiaro), cifre tabulari, ~10–11 px; aspetto definitivo scelto da Diego sulle anteprime. Non compare se manca `seriesNo`.
- Etichetta accessibile del dorso/copertina: aggiunge «, *serie* numero *N*».
- Schede In lettura: «Slough House · 3» sotto il titolo, senza bollino.
- Ordine «Autore»: a parità di autore, prima i libri con serie (per nome della serie, poi `parseFloat(seriesNo)`), poi gli altri per titolo. Gli altri ordini non cambiano.

## Test (gruppo nuovo `test/serie.mjs`, fonti simulate)

- Ricerca: passo 1 con numero da qualificatore e da proprietà diretta; passo 2 con titolo inglese/alias contro titolo italiano; passo 3 con titolo da Open Library; due opere che combaciano → `null`; una sola interrogazione per autore su più libri.
- Seguito: senza etichetta italiana → assente; etichetta italiana ma nessuna edizione trovata → assente; trovata → titolo italiano.
- Sicurezza: `seriesManual` mai sovrascritto; errore di rete non svuota; testi con HTML da Wikidata innocui; `clean()` su numeri e lunghezze.
- Scheda: datalist con nomi già usati, forma già usata al salvataggio, svuotare Serie, pulsante serie → ricerca.
- Cerca le serie: copia prima, riga di avanzamento, messaggio finale con errori, fermata dal ripristino, controllo del seguito sui letti.
- `nextInSeries`: salta i letti, usa il seguito del volume posseduto più alto, numeri «2.5», seguito già posseduto non riproposto.
- Interfaccia: righe «in pila», «nella lista dei desideri», «non ce l'hai» con Annulla; proposta «Il #4 di…»; bollino su dorso disegnato, foto e copertina; ordine Autore; 390×844 e 1366×860, chiaro e scuro, nessun errore in console, niente scorrimento laterale, bersagli ≥ 44 px.

## Peso e limiti

- Stima: 3–4 KB di codice e ~0,5 KB di stile (sotto 1,5 KB compressi).
- Wikidata non è raggiungibile dalla sessione cloud: risposte simulate nei test; prova dal vivo di Diego dopo la pubblicazione («Cerca le serie» sull'iPhone e messaggio finale), con correzioni se le risposte reali differiscono.
- Il seguito non tradotto non viene proposto; può capitare raramente che un seguito tradotto non venga riconosciuto (etichetta italiana mancante su Wikidata).

## Fuori ambito

- Elenco «Serie da continuare» nelle Statistiche.
- Ordine «Serie» dedicato nel menu Ordina.
- Altre fonti per la serie (Open Library `series`, Google `seriesInfo`).
