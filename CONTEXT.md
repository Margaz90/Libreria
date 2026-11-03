# MyLibrary — glossario

I nomi che usiamo per parlare dell'app e del suo codice. Quando un concetto nuovo prende un nome (in una revisione, in una spec), si aggiunge qui.

## Libri e lettura
- **Libro**: un elemento di `libreria-diego-v1`. Campi in `CLAUDE.md` → Dati.
- **Stato**: `desiderato` (Lista dei desideri), `da-leggere`, `in-lettura`, `letto`.
- **Passaggio** (di stato): il cambio da uno stato all'altro, con le sue conseguenze sulle date. Lo calcola `lettura.passa`.
- **Rilettura**: un libro Letto rimesso In lettura. Fine e anno spariscono, l'inizio riparte da oggi.
- **Fine automatica** (`finishedAuto`): una data di fine messa dall'app (oggi al passaggio a Letto, o la stima +20 giorni), che la stima dall'inizio può sostituire.
- **Solo l'anno** (`finishedYear`): l'anno di lettura di un Letto senza data di fine. Mai insieme alla fine.
- **Anno di lettura**: l'anno in cui un libro conta come letto (Statistiche, obiettivo). Lo calcola `lettura.annoLetto`: la fine se passata, altrimenti «solo l'anno».
- **Regole della lettura**: il modulo `lettura` (v76) con `passa`, `sistema` (coerenza dei campi) e `annoLetto`. È l'unico posto dove stanno le regole su stato, date e pagina.
- **Salvare un libro**: sempre con `salvaLibro` (v77), che sostituisce il libro, applica tidy, aggiorna `updated`, salva, ridisegna e avvisa il cloud.
- **Spostarsi** (di un libro): cambiare posto negli scaffali, nell'ordine o nei filtri; lo decide `sposta(prima, dopo)`.
- **Tratto segnato** (`// <regole>` … `// </regole>`): un pezzo di `app.js` con sole funzioni pure, provato da Node dal gruppo `regole` (v79).
- **Tidy**: `sistema(clean(b))`, cioè il libro com'è salvato: formato valido e regole della lettura.

## Ricerche
- **Fonte**: un servizio esterno che conosce i libri: Google Books, Open Library, Apple Books Italia, Wikidata.
- **Pausa** (di una fonte): un periodo in cui l'app non la interroga dopo errori ripetuti (Google: `state.googleDown`; Wikidata: `salute.wikidata`, 5 minuti dopo due errori di fila). «Verifica ricerche» la toglie.

## Dati e sicurezza
- **Copia**: un'istantanea dei libri in IndexedDB (`snapshot`), prima delle operazioni su molti libri; si ripristina da Backup → Annulla.
- **Segnaposto** (tomb): un libro eliminato, ricordato per non farlo tornare dal cloud.

## Revisioni dell'architettura
- I termini di architettura (modulo, interfaccia, profondo, seam, adapter, località, leva) sono quelli della skill `codebase-design`.
