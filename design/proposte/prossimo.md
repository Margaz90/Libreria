# «Cosa leggo adesso?»: tre proposte

Prototipo: `design/proposte/prossimo.html`. Si apre in Safari, si può toccare e ha l'interruttore del tema scuro (oppure `#scuro` nell'indirizzo). Gli screenshot sono in `design/proposte/img/prossimo-{A,B,C}{,-scuro}.png` e `prossimo-A-pc{,-scuro}.png` (1366 px).
La logica di `nextBooks` resta com'è. Cambia solo la presentazione, con qualche dato in più che i libri hanno già: pagine, genere, serie e segnatura.

Il problema di oggi: tre righe uguali, ognuna col suo «Inizia» corallo, ed etichette MAIUSCOLE corallo. La sezione occupa circa 435 px del primo schermo del telefono.

## A · Sfilati dallo scaffale
I tre libri stanno in piedi su un'asse di ciliegio, con gli stessi dorsi e lo stesso legno degli scaffali sotto. Il libro scelto è sfilato in avanti, leggermente inclinato, e ha il segnalibro corallo del logo che pende sull'asse. Accanto ai dorsi, sulla stessa asse, ci sono il motivo (in corsivo), il titolo, «Serie · N · Autore» e «pagine · genere». Sotto c'è una sola riga di pulsanti: **Inizia** (l'unico pulsante corallo), «Altre proposte», «Non ora». Altezza circa **270 px**.
Su computer i tre dorsi stanno sulla stessa asse, ognuno con la sua descrizione. «Inizia» compare solo sotto il libro sfilato. «Altre proposte» e «Non ora» sono a destra del titolo.

## B · La scheda del catalogo
Si vede una proposta alla volta, su una scheda da biblioteca: segnatura dattiloscritta (`callNo`), filetto corallo, righe, foro in basso. Il motivo è scritto a «penna rossa» in corsivo. Le tre linguette in alto sono i criteri («Affine», «Il più vecchio», «A caso»), come le schede guida di un cassetto. Le altre due schede si intravedono dietro. Si sfoglia toccando le linguette o scorrendo di lato. Altezza circa **365 px**.

## C · La pila sul comodino
I tre libri sono distesi uno sull'altro sull'asse di legno. Lo spessore segue le pagine: da 44 px fino a 100 pagine a 92 px per 1152 pagine, quindi si vede subito quale è un mattone. Il libro scelto sporge e ha il suo «Inizia» accanto; gli altri mostrano lì il numero di pagine. Sotto la pila ci sono il motivo, poi «Altre proposte» e «Non ora». Altezza circa **325 px**.

## Comportamenti comuni (in tutte e tre)
- **Altre proposte**: arriva un nuovo gruppo di tre libri (con `nextList(true)`, come oggi), con una sola animazione d'ingresso. Il primo libro è già selezionato.
- **Non ora**: la sezione sparisce come oggi. Aggiunta piccola (facoltativa): un avviso «Proposte nascoste fino alla prossima apertura · Annulla» per qualche secondo, perché oggi un tocco sbagliato non si può annullare.
- **Dopo «Inizia»**: come oggi, `setStatus` e la scheda In lettura (v62) al posto delle proposte. Nel prototipo c'è anche l'avviso «… è in lettura da oggi · Annulla». Anche questa è un'aggiunta da valutare.
- **Scegli per me**: lo stesso componente nel foglio, con «Chiudi» al posto di «Non ora».
- **Accessibilità**: i libri proposti sono un `radiogroup` (A, C) o un `tablist` (B), si muovono con le frecce e hanno etichette «Titolo di Autore. Motivo». «Inizia» ha l'etichetta «Inizia *titolo*». Il dettaglio è annunciato con `aria-live`. Tutti i bersagli sono di almeno 44 px (i dorsi di A hanno `min-width: 44px`). Il contrasto del testo è almeno 4,5:1 in chiaro e in scuro (misurato nel prototipo). Le animazioni si tolgono con `prefers-reduced-motion`. Niente scorrimento orizzontale a 390 px.

## Confronto

| Variante | Idea | Pro | Contro | Peso stimato | Complessità | Rischi per `test/funzioni.mjs` |
|---|---|---|---|---|---|---|
| **A · Sfilati dallo scaffale** | Mini-scaffale con tre dorsi, quello scelto è sfilato e ha il segnalibro | La più compatta (circa 270 px contro 435). Un solo corallo. Riusa `spineHTML` e `--board-img` già presenti, quindi sembra parte della libreria. Tutte e tre le proposte restano visibili. Il segnalibro richiama il logo | Il titolo verticale sui dorsi si tronca se è lungo (il dettaglio accanto lo ripete per intero). Per vedere motivo e titolo degli altri due libri serve un tocco. Selezione in più rispetto a oggi | CSS circa 1,5 KB; JS circa 0,4 KB (stato `sel`, frecce) | Bassa-media: `nextHTML` cambia struttura, `wireNext` aggiunge la selezione | `.ncard[data-next]` va messo su ogni dorso (o sul gruppo), oppure va cambiato il test. Il test cerca `[data-start]` dentro `.ncard`: con un solo «Inizia» il controllo «titolo modificato» va su `.ncard[data-next="n2"]` (aria-label del dorso, OK se contiene il titolo). `#n-later`, `#n-more` e `[data-choose]` restano uguali |
| **B · La scheda del catalogo** | Una proposta alla volta su una scheda da biblioteca, con le linguette come criteri | Il motivo è in primo piano. Molto riconoscibile (segnatura, penna rossa). Copertina visibile. Le linguette spiegano i tre criteri | Le altre due proposte sono nascoste: le controlla solo chi sfoglia. È la più alta delle tre (circa 365 px). Righe e foro sono decorazione in più. Lo scorrimento laterale può confliggere con i gesti di iOS | CSS circa 2 KB; JS circa 0,6 KB (linguette, scorrimento) | Media: tablist, gesto di scorrimento, stato per linguetta | Nel DOM c'è solo una `.ncard`: i test che contano 3 proposte (`ids(...).length === 3`, «pila esaurita») falliscono a meno di tenere le tre schede nel DOM (`hidden`). Va rivisto il controllo sull'hero col titolo nuovo di `n2` (non visibile se non è la linguetta attiva) |
| **C · La pila sul comodino** | Libri distesi con spessore proporzionale alle pagine; quello scelto sporge e porta «Inizia» | Il numero di pagine si vede a colpo d'occhio, ed è un'informazione utile per scegliere. Un solo corallo. Titoli orizzontali leggibili per intero. Compatta (circa 325 px) | Con tre libri di lunghezza simile l'effetto spessore si nota poco. «Inizia» si sposta di riga quando cambia la scelta. Disegno nuovo da mantenere (non è uno `spineHTML`) | CSS circa 1,8 KB; JS circa 0,4 KB | Media: nuovo «dorso orizzontale» e geometria della pila | Come A: `.ncard[data-next]` su ogni libro della pila; il `[data-start]` è uno solo, sulla riga scelta. I test che cliccano `[data-start]` di un libro preciso vanno adattati (prima si seleziona, poi si inizia) |

Tutte e tre aggiungono meno di 3 KB e nessuna libreria o font nuovo.

## Raccomandazione: **A · Sfilati dallo scaffale**
- È la soluzione più diretta al problema: dimezza quasi l'altezza (da circa 435 a circa 270 px), così gli scaffali tornano nel primo schermo. Lascia un solo pulsante corallo. Al posto delle etichette maiuscole c'è un motivo in corsivo, che si legge come una frase.
- È la più coerente con l'app: usa dorsi e legno che ci sono già (`spineHTML`, `--board-img`), quindi pesa poco e sembra uno scaffale in più, non un riquadro estraneo. Il segnalibro corallo è l'unico dettaglio nuovo e riprende il logo e l'icona.
- Le tre proposte restano visibili insieme (a differenza di B), e su computer i tre libri stanno uno accanto all'altro sulla stessa asse.
- Da C prenderei, se piace, «pagine · genere» nel dettaglio: c'è già nel prototipo di A.

## Problemi aperti
- I test di `funzioni.mjs` che assumono «un `[data-start]` per proposta» vanno adattati per A e C (selezione, poi Inizia), oppure si tiene un `[data-start]` per libro, nascosto se non selezionato.
- Gli avvisi con «Annulla» dopo «Non ora» e «Inizia» sono aggiunte di comportamento: da confermare con Diego.
- In A i dorsi con foto vera (`spine`) o striscia di copertina vanno provati: il prototipo usa solo i dorsi disegnati.
- Il titolo verticale lungo si tronca sul dorso. Il dettaglio accanto lo mostra per intero, ma VoiceOver legge l'etichetta del dorso, che è completa.
- Il prototipo non è stato provato su un iPhone vero, né con Fraunces assente (si ricade su Georgia).
