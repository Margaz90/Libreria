# «Novità per te» — progetto

Data: 7 novembre 2026 · Stato: da rileggere con Diego · Versione prevista: v84

## Obiettivo

Diego vuole scoprire, dentro l'app, libri nuovi adatti ai suoi gusti senza cercarli a mano:

1. **Proposte**: libri da aggiungere, di autori o generi già presenti nella sua libreria, con il voto medio dei lettori (quando c'è) e una motivazione.
2. **Uscite**: libri appena usciti o in uscita degli autori che ha, con un avviso all'apertura quando ce n'è uno di un autore già letto.

Tutto si aggiorna da solo una volta a settimana.

Successo: aprendo l'app una volta a settimana Diego trova proposte nuove e motivate, viene avvisato una sola volta di ogni nuova uscita dei suoi autori, e mette un libro nella Lista dei desideri con un tocco. L'app resta leggera e usabile mentre cerca.

## Decisioni prese con Diego

| Domanda | Scelta |
|---|---|
| Dove gira la ricerca | Nell'app, all'apertura, se sono passati 7 giorni (niente server né attività pianificate) |
| Voto dei lettori | Solo quando c'è e con almeno 20 voti, con il nome della fonte |
| Fonti dei voti | Google Books, Apple Books Italia, Open Library: si mostra quella con più voti |
| Azioni su un libro | Solo «Lista dei desideri» |
| Posizione | Al posto di «Cerca» nella barra in basso; voce nella colonna laterale sul computer |
| Pop-up all'apertura | Solo per un'uscita di un autore già letto, una volta per libro |
| Strada | A: un solo giro a settimana per proposte e uscite |

## Cosa non fa (YAGNI)

- Niente «Non mi interessa», «Ce l'ho già» o scheda di dettaglio delle proposte.
- Niente notifiche push né attività in sottofondo ad app chiusa (una PWA su iPhone non può).
- Niente sincronizzazione delle novità tra dispositivi né nei backup.
- Niente Hardcover, Goodreads, Anobii, StoryGraph, Amazon (nessuna API utilizzabile dal telefono).

## 1. Motore (dati)

### Quando gira

- All'avvio, dopo il primo `render()`, se `navigator.onLine` e `Date.now() − ultimoGiro ≥ 7 giorni`.
- Non parte se è in corso un lavoro su molti libri (`enrich.busy`, `state.coverJob`) o un import: si riprova all'apertura successiva.
- Gira in sottofondo, un'operazione alla volta, con la riga `#enrich` «Cerco novità per te…»; l'app resta usabile.
- Si ferma se una copia viene ripristinata (`dataGen`), come gli altri lavori in sottofondo.
- Se tutte le fonti falliscono, si tengono le novità precedenti e `ultimoGiro` non cambia: si riprova alla prossima apertura.

### Da dove parte (funzioni pure, tra `// <regole>`)

`gustiDi(books)` restituisce `{ autori, generi }`:

- **Autori**: punteggio per autore (primo autore, `cognome` per il confronto): ogni Letto con 5 stelle vale 3, con 4 stelle 2, con 3 stelle 1; ogni In lettura o Da leggere vale 1. Esclusi gli autori con media dei voti sotto 3. Si tengono i primi 15 per punteggio (a parità, il più letto di recente).
- **Generi**: i 5 generi più presenti tra i Letti con 3 o più stelle (genere non vuoto).

### Ricerca

Per ogni autore (pausa di 600 ms tra le richieste, per non ricevere 429 da Google):

- **Apple Books Italia** (`appleSearch(autore)`): libri dell'autore con `releaseDate`, copertina, voti (`averageUserRating`, `userRatingCount` se presenti).
- **Google Books** (`inauthor:` con `orderBy=newest`, lingua del telefono): libri recenti con `averageRating`, `ratingsCount`.

Per ogni genere:

- **Google Books** (`subject:` più lingua del telefono, `orderBy=newest`) e **Open Library** (`subject` con `ratings_average`, `ratings_count` richiesti tra i campi): libri di autori che Diego non ha.

Le fonti in pausa (`state.googleDown`, `fonti.inPausa`) si saltano; ogni richiesta usa `fetchT` (20 s).

### Uscite e proposte (funzioni pure)

`novitaDa(risultati, books, oggi, lingua)` restituisce `{ uscite, proposte }`:

- **Scarti**: libri già in libreria o nella Lista dei desideri (ISBN, poi `sameTitle` + `sameAuthor`); titoli con «cofanetto», «box», «collection», «antologia», «omnibus»; edizioni in un'altra lingua quando c'è la stessa opera nella lingua del telefono (`linguaEdizione`); risultati senza titolo o senza autore. Doppioni fra fonti uniti (stesso libro: ISBN o titolo + autore), tenendo copertina e voti migliori.
- **Uscite**: libri di un autore della libreria con data di uscita tra oggi − 90 giorni e oggi + 365 giorni; ordine: prima le future (dalla più vicina), poi le recenti (dalla più recente).
- **Proposte**: tutti gli altri candidati; al massimo 12, punteggio = forza dell'autore o del genere + 1 se nella lingua del telefono + voto (se affidabile) − anni dall'uscita / 5; al massimo 3 per autore e 4 per genere.
- **Motivazione** (`perche`): «Dello stesso autore di «X», a cui hai dato 5 stelle» · «Di Herron, come gli 8 libri che hai» · «Hai letto 9 thriller» · per le uscite «Nuovo di Herron: esce il 12 dicembre» / «uscito il 28 ottobre».
- **Voto** (`votoMostrato(fonti)`): fra le fonti con almeno 20 voti, quella con più voti → `{ media, voti, fonte }`; altrimenti nessun voto.

### Memoria

Chiave `libreria-novita` in `localStorage`: `{ ultimoGiro, proposte[], uscite[], viste: { idUscita: data } }`. Ogni libro ha un id stabile (ISBN, altrimenti titolo + autore normalizzati). Le proposte si sostituiscono a ogni giro; le uscite restano finché la data di uscita non è più vecchia di 90 giorni; `viste` ricorda le uscite già mostrate (pop-up e pallino) e si pulisce delle voci scadute. Non va nel cloud né nei backup. Un libro arrivato in libreria da qualunque parte (anche dal cloud) sparisce dalla sezione al ridisegno, perché lo scarto si riapplica alla lettura.

## 2. Interfaccia

- **Barra in basso**: «Cerca» diventa «Novità» (icona: segnalibro con stellina; `data-view="novita"`); pallino corallo `.dot` quando ci sono uscite non viste o proposte non ancora aperte. La ricerca resta nella barra in alto e con «/». Sul computer «Novità» è una voce della colonna laterale sotto gli scaffali.
- **Sezione** `state.view === "novita"`:
  1. «Uscite dei tuoi autori»: righe con copertina (`thumb`), titolo, autore, data («esce il…» / «uscito il…»), pulsante «Lista dei desideri».
  2. «Proposte per te»: schede (due colonne sul telefono, più colonne sul computer) con copertina, titolo, autore, voto («★ 4,2 · 1.350 voti (Google Books)») e motivazione in corsivo, pulsante «Lista dei desideri».
  3. In fondo, piccolo: «Aggiornate il 7 novembre · le prossime tra 7 giorni».
- **Lista dei desideri**: crea il libro con `salvaLibro` (stato `desiderato`, titolo, autore, ISBN, copertina, anno, pagine, trama), avviso «Nella lista dei desideri · Annulla» (Annulla lo toglie e lo rimette tra le novità); il libro sparisce dalla sezione; serie in sottofondo con `seriesLater`.
- **Pop-up all'apertura**: dopo un giro, se c'è un'uscita non vista di un autore con almeno un Letto, alla successiva apertura (mai mentre si usa l'app) una scheda piccola: «Nuovo di Mick Herron: «Titolo», esce il 12 dicembre» (+ «e altre N uscite»), pulsanti «Lista dei desideri», «Vedi le novità», «Chiudi». Mostrata una volta: le uscite incluse finiscono in `viste`.
- **Vuoto**: prima del primo giro o senza rete «Le novità arrivano quando sei online: le cerco una volta a settimana.»; con meno di 3 Letti con voto «Dai qualche voto ai libri che hai letto: le proposte partono da lì.»; giro in corso «Sto cercando le novità per te…».
- Accessibilità: pulsanti alti 44 px, etichette con il titolo del libro («Metti «Titolo» nella lista dei desideri»), pop-up con focus intrappolato come le altre schede, colori dai token esistenti.

## 3. Errori, peso, verifiche

- **Errori**: fonte che non risponde → saltata per quel giro; tutte giù → novità precedenti, nuovo tentativo alla prossima apertura; Google 429/503 e Wikidata seguono le pause esistenti (v78); dati strani (date non valide, voti fuori 0–5) scartati.
- **Peso**: circa 12–15 KB tra codice e stile, nessuna libreria nuova. Richieste: circa 40 a settimana.
- **«Verifica ricerche»**: una riga in più che dice se i voti arrivano da Apple e Open Library (campi presenti o no), per la prova dal vivo sull'iPhone.
- **Test da Node** (gruppo `regole`): `gustiDi` (punteggi, esclusione sotto 3 stelle, limiti 15 e 5), `novitaDa` (scarti, finestra delle date, ordini, limiti per autore e genere), `perche`, `votoMostrato`, pulizia di `viste`.
- **Test nel browser** (nuovo gruppo `novita`, fonti simulate): giro dopo 7 giorni e non prima; nessun giro senza rete o durante «Completa autori»; sezione con uscite e proposte; pallino; pop-up una sola volta e solo per autori letti; «Lista dei desideri» con Annulla; sezione vuota; «Novità» al posto di «Cerca» e ricerca ancora raggiungibile; 390×844 e 1366×860, chiaro e scuro, niente scorrimento laterale.
- Prima di pubblicare: suite completa e revisione indipendente, come per le versioni dalla v76.

## Rischi noti

- Campi dei voti di Apple (non documentati per gli ebook) e di Open Library da confermare dal vivo: se mancano, si usa solo Google Books.
- Per molti libri italiani recenti i voti non arrivano a 20: la proposta compare senza voto.
- La sessione cloud non raggiunge Open Library né Wikidata: le prove sono simulate; la prova vera è sull'iPhone.
