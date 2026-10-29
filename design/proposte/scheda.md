# Scheda del libro: tre proposte

Prototipo: `design/proposte/scheda.html` (aprire in Safari o Chrome; `#scuro` forza il tema scuro, `#pc-A`/`#pc-B`/`#pc-C` mostra solo il pannello a 1366 px).
Screenshot: `design/proposte/img/scheda-{A,B,C}{,-scuro}.png` (390 px) e `scheda-A-1366.png`.

Dati di esempio: «Le tigri sono in giro» (Herron, Slough House n. 3, letto, 5 stelle) e «Joe Country» (Slough House n. 6, in lettura a pag. 142 di 337). Date di inizio, citazione, note, trama e ISBN sono segnaposto scritti per il prototipo.

Comune alle tre: le date si leggono in italiano («10 dicembre 2024», «10 dic 2024») e il selettore nativo sta sopra, invisibile (`input type="date"` con `opacity: 0`): niente più «mm/dd/yyyy», e gli id `#f-started`/`#f-finished` restano campi data veri. Etichette sentence case al posto delle MAIUSCOLE grigie. Contrasti misurati: minimo 4,66:1 (corallo su campo in scuro), tutti gli altri sopra 5:1. Bersagli ≥ 44 px, `prefers-reduced-motion` azzera le animazioni.

## A. Frontespizio

**Idea.** La scheda si apre come la pagina del titolo di un libro: copertina, titolo grande in Fraunces e autore al centro, il segnalibro corallo del logo come unico ornamento. La lettura si racconta in una frase («Letto dal 10 dicembre al 2 gennaio 2025, 24 giorni»), le date sono le parole sottolineate da toccare. In fondo i dati tecnici sono impaginati come il colophon di un libro italiano: «Finito di leggere nel mese di gennaio 2025 nella libreria di Diego». È questa la cosa da ricordare.

**Dove vanno i campi.**
- In alto: copertina, titolo, autore, pulsante serie («Slough House, volume 3», apre la ricerca).
- Lettura: stato (tre voci sottolineate), voto (in Letto subito sotto lo stato, in lettura più in basso), frase delle date con «oppure solo l'anno» come link sotto (solo per i letti senza fine), avvisi `#f-date-err`/`#f-date-est`/`#s-stale` sotto la frase; in lettura la pagina in grande con cursore, +10 e +N, più una riga di ritmo («circa 8 pagine al giorno: lo finisci verso il 23 novembre», facoltativa).
- Citazione in Fraunces con la virgoletta corallo, note su carta a righe.
- Trama con titolo originale, poi «Prossimo della serie» con il dorso in miniatura.
- Colophon: anno, pagine, genere, segnatura, ISBN; «Aggiorna informazioni»; «Modifica i dati del libro» (il `details.edit` di oggi con titolo, autore, serie e N., anno, pagine, genere, segnatura, ricerca e ▥ ISBN, «Usa copertina disegnata»).
- «Sullo scaffale»: copertina e dorso affiancati con «Altra copertina» (apre le copertine alternative) e «Fotografa il dorso» (Ruota e Rimuovi compaiono quando c'è la foto).
- Barra in fondo: Elimina (conferma in due tocchi), Salva; ✕ in alto (Salva/Scarta/Continua invariato). Desiderato: il riquadro «Ho acquistato» prende il posto del blocco lettura.
- 1366 px: stesso ordine in un pannello da 520 px, colophon su due colonne.

## B. Cartellino

**Idea.** Il periodo di lettura diventa il cartellino di prestito delle biblioteche, su carta crema: le date sono timbri inclinati in rosso (con un piccolo colpo animato quando cambiano), la fine ancora da mettere è una casella tratteggiata «Si timbra quando lo segni come letto». Il resto sta in cassetti chiusi con un'anteprima a destra, così la scheda resta corta.

**Dove vanno i campi.**
- Intestazione compatta: copertina a sinistra, titolo, autore, serie, «2016, 369 pagine, spionaggio».
- Stato (controllo segmentato di oggi).
- Cartellino: segnatura in alto, Iniziato, Finito (o «solo l'anno»), Durata, Voto; in lettura anche «Segno»: pagina, cursore, +10 e +N. Avvisi di date e `#s-stale` sotto il cartellino.
- Citazione e note come campi normali, poi «Prossimo della serie».
- Cassetti: Trama; Scheda di catalogo (scheda bianca con la riga rossa come le schede dei cataloghi: tutti i dati, ricerca, ISBN, «Usa copertina disegnata», «Aggiorna informazioni»); Copertina e dorso.
- Barra Elimina / Salva. 1366 px: pannello da 480 px, Trama aperta.

## C. Sovracoperta

**Idea.** La parte alta prende il colore della copertina del libro, come una sovracoperta, con titolo crema. Il segnalibro corallo del logo pende dal bordo e scende quanto hai letto (42% → a metà; letto → fino in fondo, oltre il bordo). Sotto, tre schede: La mia lettura, Il libro, Catalogo.

**Dove vanno i campi.**
- Sovracoperta: copertina, titolo, autore, serie.
- La mia lettura (aperta di partenza): stato, voto o pagina con cursore, +10 e +N, date in due riquadri, «solo l'anno», avvisi, citazione, note.
- Il libro: trama, titolo originale, prossimo della serie, «Aggiorna informazioni».
- Catalogo: copertine alternative già in fila, dorso con foto/Ruota/Rimuovi, tutti i dati, ISBN, ricerca.
- 1366 px: pannello da 640 px, la sovracoperta diventa la colonna di sinistra, i campi vanno su due colonne.
- Colore della sovracoperta: dal colore del dorso disegnato; con copertina scaricata servirebbe estrarre il colore medio dell'immagine (canvas, solo se l'immagine permette CORS) oppure usare sempre il colore del dorso.

## Confronto

| Variante | Idea | Pro | Contro | Peso stimato | Complessità | Rischi per `test/schede.mjs` |
|---|---|---|---|---|---|---|
| A. Frontespizio | Pagina del titolo e colophon | Il libro viene prima di tutto; tutto resta visibile in una colonna; la più leggera; date leggibili; la riga del ritmo di lettura è un piccolo extra | Scheda lunga (scorrere molto per arrivare ai dati); la frase delle date va scritta bene per i casi strani (solo anno, nessuna data) | ~3 KB CSS, ~1 KB JS (testo delle date, frase) | Bassa: stesso HTML riordinato, stessi id | Bassi: `#f-started`, `#f-finished`, `#f-page`, `.seg [data-v]`, `#f-year-row`, `#f-date-est`, `details.edit summary`, `#s-save`, `#s-close` restano. Da controllare che `#f-page` abbia ancora `readonly` nei letti (nel prototipo il campo grande compare solo in lettura) |
| B. Cartellino | Cartellino di prestito timbrato | Molto riconoscibile; scheda corta; tecnica nascosta con anteprima | Cassetti chiusi = un tocco in più per trama e dati; il timbro inclinato si legge un po' meno; una carta in più nel sistema dei colori | ~4 KB CSS, ~1 KB JS | Media: nuovi `details`, il cartellino cambia righe per stato | Medi: i test che scrivono in `#d-pages` aprono `details.edit summary`: va dato quel nome al cassetto «Scheda di catalogo». Date e stato invariati |
| C. Sovracoperta | Colore del libro e segnalibro che scende | La più immersiva; usa bene il pannello largo; avanzamento visibile a colpo d'occhio | Le schede nascondono parti (trama, dati) e cambiano le abitudini; colore da estrarre dalle copertine scaricate; più CSS per il layout a due colonne | ~5 KB CSS, ~2 KB JS (schede, colore) | Alta: tablist, colore, layout da computer diverso | Alti: `details.edit` sparisce (diventa la scheda Catalogo), i campi nascosti in un'altra scheda non sono visibili finché non la si apre; vanno riscritti i passaggi dei test |

## Raccomandazione

**A. Frontespizio.** È quella che risponde meglio all'idea guida («prima il libro, poi il modulo») senza nascondere nulla: chi apre un libro letto vede copertina, titolo, voto, la frase delle date e la citazione; i dati tecnici restano raggiungibili ma in fondo e in piccolo. È la più leggera, tiene gli stessi id e il `details.edit` di oggi, quindi i test cambiano poco o nulla. Due prestiti possibili dalle altre: la pagina a tutta larghezza (già in A) e, se piace, il timbro di B solo per la data di fine come piccolo segno quando un libro diventa Letto.

## Problemi aperti

- A sul computer lascia molto spazio vuoto ai lati della colonna centrale: si può allargare il pannello o mettere copertina e titolo a sinistra.
- La scheda «Il libro» di C non ha una cornice nel prototipo (è descritta qui sopra).
- Da decidere come appare in A la frase delle date quando c'è solo l'anno («Letto nel 2019») o nessuna data (con il pallino «!»).
- La riga del ritmo in A è una funzione nuova: da tenere solo se Diego la vuole.
