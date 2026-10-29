# Statistiche: tre proposte

Prototipo: `design/proposte/statistiche.html` (le tre varianti affiancate a 390 px, il racconto «Il tuo 2025» della variante A e le versioni larghe di A e C). Tema scuro con `#scuro` o `?scuro`, oppure con il pulsante in alto; `?solo=A|B|C|R` mostra una sola schermata a tutta pagina.
Screenshot in `design/proposte/img/`: `statistiche-{A,B,C}{,-scuro}.png` (390 px), `statistiche-A-1366.png`, `statistiche-racconto-A.png`.

Dati: quelli veri di `seed.json` (83 letti, 34.285 pagine, voto medio 4,2, anni 2025/2024/2019). I libri Goodreads non hanno la data di inizio, quindi «Tempo di lettura» usa valori di esempio (17 giorni, 9 libri). Nessun calcolo nuovo: tutto viene da `computeStats` (per i timbri di B e i capitoli di C serve solo la data di fine dei libri dell'anno, già in `anni[].books`).

Controlli fatti con Playwright: nessuno scorrimento orizzontale a 390 px, tutti i pulsanti ≥ 44 px, contrasto del testo ≥ 4,5:1 in chiaro e scuro (il controllo automatico non sa leggere i gradienti del racconto: lì il testo è crema su petrolio scuro, oltre 10:1). Movimento solo nel racconto (dorsi che cadono sull'asse), spento con `prefers-reduced-motion`.

## A. Scaffale degli anni
Ogni anno è una mensola con l'asse in ciliegio dell'app (`--board-img`) e i dorsi dei libri finiti in quell'anno, larghi quanto le pagine e col titolo sul dorso. Il racconto è un pulsante corallo con un segnalibro che pende dall'asse; le altre sezioni sono semplici, senza schede, con la linea corallo di 3 px già usata per gli scaffali. Su computer le mensole stanno a sinistra e il resto a destra su due colonne.

## B. Tessera di prestito
Gli anni sono le righe di una vecchia scheda di biblioteca: dodici colonne per i mesi e un timbro rotondo col giorno per ogni libro finito. Toccando un anno si apre il suo riassunto (autore, genere, preferito) con «Guarda il racconto». Sotto, quattro numeri, voti in colonne e generi come etichette.

## C. Indice in fondo al libro
La pagina si legge come le ultime pagine di un libro: un incipit con capolettera che riassume in una frase, i «capitoli» degli anni con le date di fine, poi gli indici dei nomi e dei generi con i puntini di guida e i mesi come unghiatura di un dizionario. Su computer diventa un libro aperto con la piega al centro.

## Confronto

| Variante | Idea | Pro | Contro | Peso stimato | Complessità | Rischi su iPhone |
|---|---|---|---|---|---|---|
| A. Scaffale degli anni | Anni come mensole con i dorsi, racconto come segnalibro | Coerente con gli scaffali (riusa `--board-img`, colori e logica dei dorsi); colpo d'occhio immediato su quanto si è letto per anno; racconto ben visibile | Con molti libri in un anno la mensola va a capo (servono più file, come negli scaffali); i dorsi sono indicativi, non un grafico preciso; pagina lunga | CSS ~3,5 KB, JS ~1 KB (si può riusare `spineHTML`) | Media: dorsi su più file per gli anni pieni, etichetta VoiceOver per mensola | Molti dorsi = più nodi DOM (limitare a 15 per anno con «Mostra tutti»); testo verticale piccolo sui dorsi stretti |
| B. Tessera di prestito | Registro con un timbro per ogni libro finito | Mostra quando si legge (mese e giorno) in modo originale; riassunto dell'anno a richiesta, pagina compatta | Celle strette a 390 px (25 px): più libri nello stesso mese si sovrappongono già a 2; i 76 libri senza data restano fuori dalla tessera; metafora meno legata all'app | CSS ~3 KB, JS ~0,8 KB | Media: impilare i timbri oltre 2 per mese (mostrare «+3») | Bersagli: le righe sono alte 56 px, ok; `color-mix` richiede iOS 16.2+ (solo per l'alone del timbro) |
| C. Indice in fondo al libro | Incipit con capolettera, capitoli degli anni, indici con puntini | La più leggera e leggibile; frase riassuntiva memorabile; versione da computer molto bella (libro aperto) | Meno «visiva»: niente grafici veri a parte i mesi; l'incipit va scritto con regole (singolare/plurale, dati mancanti) | CSS ~2,5 KB, JS ~1 KB (frasi) | Bassa-media: è testo; attenzione alle frasi con pochi dati | Capolettera `::first-letter` con `float` va provata su Safari; con Fraunces non ancora caricato il capolettera cambia misura |

## Raccomandazione
**A. Scaffale degli anni.** È l'unica che rende la sezione riconoscibile come parte di MyLibrary: usa lo stesso legno, gli stessi dorsi e lo stesso segnalibro dell'icona, così le statistiche sembrano un'altra stanza della stessa libreria invece di un pannello di grafici. Pesa poco (si riusano `--board-img` e la logica dei dorsi), non chiede calcoli nuovi e risolve i due problemi di oggi: le schede «Il tuo 2025/2024» diventano le mensole stesse e la gerarchia è chiara (prima gli anni, poi «Sempre»).
Due idee si possono prendere dalle altre: l'incipit di C come riga sotto il titolo (al posto della frase con i tre numeri) e, più avanti, l'indice dei nomi con i puntini per gli autori.

## Problemi aperti
- Anni con molti libri (es. 30): la mensola deve andare su più file o fermarsi a 15 dorsi con «Mostra tutti», da decidere.
- I 76 libri senza anno non compaiono su nessuna mensola: oggi c'è solo l'avviso tratteggiato.
- Il tempo di lettura usa dati di esempio: con i dati veri (nessun inizio) si vede la nota «Aggiungi Iniziato il…».
- Racconto: progettate solo la schermata iniziale e quella del preferito; le altre 7 seguirebbero lo stesso schema (testo in alto, dorsi sull'asse in basso).
