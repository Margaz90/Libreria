# Statistiche: storia da lettore e abitudini — design

Data: 2026-10-25 · Stato: da rivedere con Diego · Percorso Superpowers: architetturale (brainstorming → spec → piano)

## Obiettivo

Trasformare la sezione Statistiche in un **bilancio da lettore** e in uno strumento per **capire le abitudini**, non per seguire l'obiettivo dell'anno (quello resta nell'anello in cima alla Libreria). Due livelli: il quadro di **sempre** e il dettaglio **anno per anno**, più un **racconto** a schermo intero per i due anni appena conclusi.

Criteri di riuscita:
- Diego vede in un colpo d'occhio voti, tempi di lettura, mesi preferiti, autori e generi di tutta la sua storia, e lo stesso per ogni anno.
- I libri storici senza data possono entrare negli anni indicando solo l'anno di lettura.
- I racconti dei due anni precedenti si aggiornano da soli al cambio d'anno.
- L'app resta leggera: nessuna libreria esterna, circa 8–10 KB in più tra codice e stile.

## Decisioni prese con Diego

| Domanda | Scelta |
|---|---|
| A cosa servono le statistiche | Bilancio da lettore + abitudini |
| Come guardarle nel tempo | Sempre in alto, anno per anno sotto |
| Contenuti | Tempo per finire un libro, mesi in cui legge di più, voti, autori e generi più approfonditi |
| Libri senza data | Campo facoltativo «solo l'anno» nella scheda |
| Organizzazione | Pannelli arricchiti + racconto per i due anni appena conclusi (rolling) |

## Dati

### Nuovo campo `finishedYear`
- Numero intero facoltativo (es. `2019`), aggiunto a `FIELDS` in `app.js`; `clean()` lo converte in numero e lo scarta se fuori da 1900–anno corrente.
- Ha senso solo per libri `letto` senza `finished`. Al salvataggio della scheda: se c'è `finished`, `finishedYear` viene tolto (vale la data completa).
- Viaggia come gli altri campi: backup/import JSON, sincronizzazione Firebase (`toDoc` copia tutti i campi; nessuna modifica alle regole Firestore). Il CSV Goodreads non lo usa.

### Anno di un libro letto
`annoDi(b) = anno di b.finished` se presente, altrimenti `b.finishedYear`, altrimenti nessuno (il libro conta in «Sempre» ma non negli anni).

### Correzione mirata: data di fine automatica
Oggi `readReading()` e `setStatus()` impostano `finished = oggi` per ogni libro `letto` senza data, anche se era già letto. Nuova regola: la data di oggi si imposta **solo quando lo stato passa a `letto`** da un altro stato, e mai se il libro ha `finishedYear`. Così modificare un libro storico (es. aggiungere un voto) non lo sposta nell'anno corrente.

## Calcoli

Tutti su libri con `status === "letto"`, in un'unica funzione pura `computeStats(books, oggi)` che restituisce un oggetto con `sempre`, `anni` (dal più recente) e `racconti`. Calcolata solo all'apertura della sezione; nessun dato salvato in più.

| Voce | Regola |
|---|---|
| Sintesi | Libri letti, pagine totali, voto medio (solo libri votati), giorni medi per libro (vedi sotto) |
| Giorni per finire | `fine − inizio + 1` (stesso giorno = 1). Solo libri con entrambe le date; esclusi valori < 1, > 730 giorni e date future. Media arrotondata, più veloce e più lento con titolo |
| Mesi | Mese di `finished` (12 contatori, somma di tutti gli anni). `finishedYear` da solo non basta |
| Voti | Conteggio per voto 1–5; libri senza voto contati a parte; elenco dei 5 stelle dal più recente |
| Autori | Raggruppati per stringa `author` come scritta; ordinati per numero di libri, poi pagine; voto medio sui votati; primi 6 |
| Generi | Per numero di libri; primi 6 |
| Anno per anno | Per ogni anno con almeno un libro: libri, pagine, voto medio, mesi (solo date complete), autore e genere più letti, libro col voto più alto. A parità vince il più recente (`finished`, poi `updated`) |
| Racconti | Anni `oggi.anno − 1` e `oggi.anno − 2`, se hanno almeno un libro |

## Pagina Statistiche

Dall'alto (vedi anteprima approvata):
1. **Racconti**: due schede «Il tuo AAAA» (fondo petrolio, segnalibro corallo, libri e pagine). Toccandole si apre il racconto.
2. **Sempre**: pannelli In sintesi · Voti · Tempo di lettura · Mesi · Autori · Generi.
3. **Anno per anno**: un `<details>` per anno; aperto il più recente. Dentro: libri, pagine, voto medio, barre dei mesi, autore e genere dell'anno, libro preferito con copertina.
4. Nota sui libri letti senza anno, con invito ad aggiungerlo dalla scheda.

Layout: una colonna sotto 1024 px; sopra, i pannelli di «Sempre» su due colonne e «Anno per anno» a larghezza piena. Stile coerente con l'app: pannelli `--surface`, titoli Fraunces `--title`, barre `--coral` (il valore massimo in `--accent`), numeri sempre scritti accanto alle barre. Nessuna libreria di grafici.

## Scheda del libro
Sotto «Iniziato il / Finito il», per i libri `letto` senza data di fine, compare «oppure solo l'anno» (input numerico, 4 cifre). Si mostra o nasconde subito al cambio di stato o di data nella scheda; rientra nel controllo «modifiche non salvate» già esistente.

## Racconto
- Livello a schermo intero sopra l'app (`role="dialog"`, `aria-modal`), sempre su fondo petrolio con testo crema, numeri in Fraunces, dettagli corallo.
- Navigazione: tocco a destra/sinistra o scorrimento orizzontale; frecce visibili e tastiera (←/→) su computer; ✕ ed Esc per chiudere. Nessun avanzamento automatico. Trattini di avanzamento in alto.
- Schermate, saltate se mancano i dati: copertina dell'anno · numeri (libri, pagine, pagine al giorno sull'anno) · mese più letto con barre · tempo di lettura · autore dell'anno · genere dell'anno · libro preferito con copertina · voti · chiusura con griglia delle copertine e «Chiudi».
- Con meno di 3 libri nell'anno: solo copertina, numeri e chiusura.
- Copertine vere (`thumb()`) o, in mancanza, la copertina disegnata (`coverHTML`).
- Con `prefers-reduced-motion` nessuna transizione. Il focus resta nel racconto finché è aperto e torna alla scheda che l'ha aperto alla chiusura.
- Fuori ambito (per ora): condividere il racconto come immagine.

## Casi limite
- Nessun libro letto: messaggio «Quando segnerai un libro come Letto, qui compariranno le tue statistiche», nessun pannello.
- Nessuna data: «Mesi» e «Tempo di lettura» mostrano una frase che spiega cosa serve, non grafici vuoti; «Anno per anno» mostra solo la nota.
- Testi lunghi tagliati con «…».
- Modifiche dal cloud con la sezione aperta: ricalcolo come oggi (`refreshChanged` → `render()` in vista statistiche).

## Struttura del codice
- `computeStats(books, oggi)`: funzione pura, nessun accesso al DOM, testabile da sola.
- `renderStats(stats)`: solo HTML della pagina, al posto dell'attuale `renderStats(list)`.
- `openStory(anno, stats)`: apertura, navigazione e chiusura del racconto.
- Tutto resta in `app.js` e `style.css` (nessun file nuovo da scaricare). Incremento di `VERSION` in `sw.js`.

## Test (`test/`)
- Nuovo gruppo `statistiche` con libri di prova noti: sintesi, voti, giorni (media/più veloce/più lento, esclusioni), mesi, ordine degli autori, anni con libri che hanno solo `finishedYear`, libreria vuota, nessuna data.
- Racconti rolling: orologio del browser fissato al 2027-01-05 → «Il tuo 2026» e «Il tuo 2025».
- Racconto: avanti/indietro con tocco e frecce, chiusura con ✕ ed Esc, schermate saltate senza dati, versione ridotta sotto 3 libri.
- Scheda: «oppure solo l'anno» solo per libri letti senza data; tolto se si mette la data; aggiungere un voto a un libro storico non imposta la data di oggi.
- Sincronizzazione: `finishedYear` passa da un dispositivo all'altro (controllo aggiunto al gruppo esistente).
- Interfaccia: 390×844 e 1366×860, chiaro e scuro, nessun errore in console, niente scorrimento orizzontale.
