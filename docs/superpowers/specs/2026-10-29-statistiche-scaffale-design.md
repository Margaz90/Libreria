# Statistiche come «Scaffale degli anni»: design

Data: 2026-10-29 · Stato: approvata da Diego il 2026-10-29 (con dorsi toccabili e pulsanti di paginazione a 44 px ovunque) · Percorso Superpowers: architetturale (proposte → spec → piano)

Riferimenti: proposta `design/proposte/statistiche.md`, prototipo `design/proposte/statistiche.html` (variante A, più l'incipit della variante C), screenshot `design/proposte/img/statistiche-A.png`, `statistiche-A-1366.png`, `statistiche-racconto-A.png`. Spec di partenza: `2026-10-25-statistiche-design.md` (v47): i calcoli e le regole sui dati restano quelli.

## Obiettivo

Dare alla sezione Statistiche l'aspetto di «un'altra stanza della stessa libreria»: ogni anno è una mensola con l'asse in legno e i dorsi dei libri finiti quell'anno; sopra, una frase che riassume la storia da lettore; sotto, il quadro di «Sempre» (voti, tempo di lettura, mesi, autori, generi) in forma semplice, senza schede. Il racconto a schermo intero resta, con i dorsi che cadono sull'asse.

Criteri di riuscita:
- Aprendo Statistiche si capisce subito quanto si è letto per anno (mensole più o meno piene) e si apre il racconto dal pulsante con il segnalibro sulla mensola dell'anno.
- Una frase in cima riassume tutta la storia, corretta anche con 0 voti, 1 libro o dati incompleti (niente frasi vuote o sbagliate al singolare/plurale).
- Un anno con più di 15 libri si comporta come uno scaffale: 15 dorsi, poi «Mostra altri 15» e «Nascondi».
- Nessun calcolo nuovo: `computeStats` resta pura e compatibile (si aggiunge un solo campo).
- App leggera: circa +3–4 KB tra codice e stile (dettaglio in «Prestazioni e peso»), nessuna libreria, nessun font in più.
- 390×844 e 1366×860, chiaro e scuro, nessun errore in console, niente scorrimento orizzontale; contrasto testi ≥ 4,5:1; bersagli ≥ 44 px; movimento solo nel racconto, spento con `prefers-reduced-motion`.

## Decisioni prese con Diego

| Domanda | Scelta |
|---|---|
| Quale variante | A, «Scaffale degli anni» |
| Gli anni | Una mensola per anno (rolling come oggi), asse `--board-img`, dorsi dei libri finiti quell'anno, larghi in proporzione alle pagine |
| Il racconto | Pulsante «Il racconto» con il segnalibro sulla mensola, al posto delle schede scure «Il tuo AAAA» |
| Sotto ogni mensola | Riga con autore, genere e preferito dell'anno |
| «Sempre» | Voti, Tempo di lettura, Mesi, Autori con mini-dorsi, Generi, come nel prototipo A; sul computer come `statistiche-A-1366.png` |
| Riassunto | Incipit della variante C come paragrafo sotto il titolo «Statistiche» |
| Anni con molti libri | 15 dorsi, poi «Mostra altri 15» / «Nascondi» (stessi pulsanti `.pager` degli scaffali) |
| Racconto | Resta (fino a 9 schermate, regole attuali), nello stile A: dorsi che cadono sull'asse, il preferito che esce dallo scaffale; movimento ridotto rispettato |

## Scelte fatte in questa spec (confermate da Diego)

| Scelta | Decisione | Perché |
|---|---|---|
| Incipit | La frase più ricca di C, costruita a pezzi che compaiono solo se veri e significativi (regole sotto); senza capolettera | Più «da lettore» della riga con tre numeri; la capolettera di C (`::first-letter` + `float`) cambia misura finché Fraunces non è caricato e va provata su Safari: non vale il rischio |
| «In sintesi» | Il pannello sparisce: libri e pagine stanno nell'incipit, il voto medio nell'intestazione di «Voti», i giorni per libro in «Tempo di lettura» | Il prototipo A non lo ha; evita di ripetere gli stessi numeri |
| «Anno per anno» (`<details>`) | Sparisce: la mensola è l'anno. Le barre dei mesi dell'anno restano solo nel racconto | Le mensole sostituiscono i pannelli; la pagina resta corta |
| Ordine dei dorsi | Come `anni[].books`: il più recente a sinistra (fine, poi `updated`); i libri con solo l'anno in fondo | Stesso ordine «Recenti» degli scaffali; con la paginazione i primi 15 sono gli ultimi letti |
| Dorsi toccabili | **Sì (scelta di Diego)**: ogni dorso è un `<button data-id>` come negli scaffali; tocco = scheda del libro, pressione prolungata = menu rapido, con gli stessi gestori di `wireMain` | Diego vuole aprire il libro dalla mensola. I dorsi sottili restano sotto i 44 px di larghezza (alti almeno 84 px), come negli scaffali: larghezza minima portata a 20 px |
| Navigazione del racconto | Frecce ‹ › rotonde con «N di M» in basso, visibili anche sul telefono (oggi sono nascoste) | Come nel prototipo; bersagli da 48 px, utili con VoiceOver |
| Chiusura del racconto | Senza la griglia delle copertine: la mensola in basso mostra già i libri | Meno nodi e meno spazio sui telefoni bassi |
| `.pager-btn` | Alto 44 px ovunque, anche negli scaffali (scelta di Diego) | Più facile da toccare e coerente in tutta l'app |

## Interfaccia

### Ordine della pagina (telefono, sotto 1024 px)

1. Titolo `<h2 class="stats-title">Statistiche</h2>` (Fraunces, `--title`, 30 px).
2. Incipit `<p class="stats-lede">`.
3. Titolo nascosto per VoiceOver `<h2 class="sr">Anno per anno</h2>`, poi le mensole, dal più recente.
4. Nota sulle date di fine nel futuro (se ce ne sono) e riquadro tratteggiato dei libri senza anno (se ce ne sono).
5. Titolo nascosto `<h2 class="sr">Sempre</h2>`, poi i blocchi Voti, Tempo di lettura, Mesi, Autori, Generi.

Margini: quelli di `#main` (16 px ai lati). Spazio tra le mensole 30 px; tra mensole e «Sempre» 40 px; tra i blocchi di «Sempre» 34 px.

### Da 1024 px in su

Titolo e incipit a tutta larghezza; sotto, `.stats-cols` su due colonne (`minmax(0, 1.15fr) minmax(0, 1fr)`, spazio 48 px): a sinistra mensole e note, a destra «Sempre» su due colonne (spazio 34 × 32 px): Voti | Tempo di lettura, Mesi | (vuoto), poi Autori e Generi a tutta larghezza della colonna (`.span2`). Le mensole sono più alte (dorsi ×1,3 in altezza, file da 167 px).

### Incipit

Funzione `ledeHTML(S)` (riceve `st.sempre`). Tre frasi; ogni pezzo compare solo se la sua condizione è vera. I numeri sono in `<b>` (Fraunces 19 px, `--ink`), il resto in `--muted` 16 px. Numeri con `num()` (punto delle migliaia).

| Pezzo | Condizione | Testo |
|---|---|---|
| Libri e pagine | sempre (con almeno 1 libro letto) | 1 libro: «Hai letto **un** libro» + (pagine > 0 ? «, **320** pagine» : «») + «.» · più libri: «Hai letto **83** libri» + (pagine > 0 ? «, **34.285** pagine in tutto» : «») + «.» |
| Voto più frequente | almeno 3 libri votati e un solo voto con il conteggio massimo | «il voto che dai più spesso è **cinque stelle**, a **28** libri» (1 → «una stella», 2–5 → «due/tre/quattro/cinque stelle»; «a 1 libro» al singolare) |
| Autore più letto | `authors[0].count ≥ 2` e maggiore di `authors[1].count` (o unico autore) | «l'autore che torna di più è **Michael Connelly**, con **18** titoli» |
| Mese | `monthsCount ≥ 3` e un solo mese con il valore massimo | «Il mese in cui finisci più libri è **dicembre**.» |

Seconda frase: voto e autore uniti da «; », con la prima lettera maiuscola e il punto finale; se c'è solo uno dei due, solo quello; se nessuno, niente. Esempi:
- Dati di `seed.json`: «Hai letto 83 libri, 34.285 pagine in tutto. Il voto che dai più spesso è cinque stelle, a 28 libri; l'autore che torna di più è Michael Connelly, con 18 titoli. Il mese in cui finisci più libri è dicembre.»
- Un solo libro senza pagine né voto: «Hai letto un libro.»
- Libri senza voti e con autori tutti diversi: solo la prima frase (più quella del mese se vale).
- Nessun libro letto: niente incipit, resta il messaggio attuale «Quando segnerai un libro come Letto, qui compariranno le tue statistiche» (e nient'altro).

Autore e testi passano da `esc()`; il paragrafo va a capo con `overflow-wrap: anywhere`.

### Mensola di un anno

Una per ogni voce di `st.anni` (dal più recente). Markup (funzione `yearHTML(a, racconto)`):

```html
<section class="ys" data-year="2025" aria-labelledby="ys-2025">
  <div class="ys-head">
    <h3 class="ys-n" id="ys-2025">2025</h3>
    <p class="ys-m">2 libri, 551 pagine, <span aria-hidden="true">★</span><span class="sr">voto medio</span> 5,0</p>
    <button class="story-btn" type="button" data-story="2025" aria-label="Il racconto del 2025">Il racconto</button>
  </div>
  <div class="ys-shelf ribbon" role="group" aria-label="2025: 2 libri, 551 pagine">
    <div class="ys-row">…dorsi: <button class="spine" data-id="…" aria-label="Le tigri sono in giro, Mick Herron">…</div>
  </div>
  …pager (solo oltre 15 libri)…
  <p class="ys-d">Autore dell'anno <b>…</b>. Genere <b>…</b>. Il preferito: <b>…</b>, cinque stelle.</p>
</section>
```

- **Anno** `.ys-n`: Fraunces 34 px, `--title`, cifre allineate (`lining-nums`).
- **Riga dei numeri** `.ys-m` (13,5 px, `--muted`): «1 libro» / «N libri», poi «, N pagine» solo se le pagine sono > 0, poi «, ★ 4,2» solo se c'è un voto medio (`dec()`).
- **Pulsante «Il racconto»** `.story-btn` (etichetta «Il racconto del 2025»): solo per gli anni in `st.racconti` (oggi −1 e oggi −2, rolling come ora). Corallo profondo `--accent`, testo `--accent-ink`, 600 14 px, alto 44 px, raggio 22 px, segnalibro disegnato con `::before` (9×15 px, `currentColor`, `clip-path` con la tacca a V). In alto a destra della testata, centrato sulle due righe. Con il pulsante la mensola ha la classe `ribbon`: un segnalibro `--coral` (12×26 px) pende dall'asse a 26 px dal bordo destro (decorativo, `::after`).
- **Mensola** `.ys-shelf`: una o più file `.ys-row`. Ogni fila: `display: flex; align-items: flex-end; gap: 2px; padding: 0 10px 16px; min-height: 132px` (167 px da 1024), sfondo `var(--board-img) left bottom -10px / 600px 230px repeat-x` (lo stesso legno degli scaffali, chiaro e scuro). Tra due file 10 px. Ogni fila ha la sua asse, così non serve il trucco del passo da 230 px di `.row`.
- **Dorsi**: `spineHTML(b, "button", dim)`, toccabili come negli scaffali (tocco = scheda, pressione prolungata = menu rapido; vedi «Dorsi toccabili») (vedi «Dorsi delle Statistiche»): foto vera, striscia della copertina o dorso disegnato, come negli scaffali; nascosti autore (`.au`) e pallino «da aggiornare» (nascosto con il CSS di `.ys-row`); il bollino della serie resta.
- **Divisione in file** (`ysRows(books)`, pura): i dorsi si mettono in fila nell'ordine dato finché la somma delle loro unità non supera 300; poi si apre una nuova fila. Le unità sono percentuali della fila (vedi sotto), quindi la divisione non dipende dalla larghezza dello schermo e non serve ricalcolare al cambio di orientamento.
- **Paginazione**: `state.limit["y" + anno]` (predefinito `PAGE` = 15). Oltre 15 libri, sotto la mensola, `pagerHTML("y2025", mostrati, totale)`: «15 di 32», «Mostra altri 15», «Nascondi» (testi e comportamento degli scaffali). «Mostra altri» ridisegna solo quella mensola (`replaceYear`) e porta il focus sul suo «Mostra altri» (o su «Nascondi» se è finito l'elenco); «Nascondi» torna a 15 e, se la mensola è sopra lo schermo, la riporta in vista (scorrimento morbido salvo movimento ridotto, come per gli scaffali). I limiti si azzerano cambiando sezione (`setView` chiama già `resetLimits`).
- **Riga dell'anno** `.ys-d` (14 px, `--muted`, nomi in `--ink` 600): pezzi separati da «. », ognuno solo se vale:
  - «Autore dell'anno **X**» se `topAuthor.count ≥ 2`;
  - «Genere **Y**» se `topGenre.count ≥ 2`;
  - «Il preferito: **T**, cinque stelle» se l'anno ha almeno 2 libri e un `best` (voto in parole: «una stella», «due stelle»…).
  Se nessun pezzo vale, la riga non c'è. Con un solo libro nell'anno la riga non c'è mai (sarebbe «autore dell'anno» di sé stesso).

### Dorsi delle Statistiche

`spineHTML(b, tag = "button", dim)`: nuovo terzo parametro facoltativo `dim = { w, h }`. Se presente, l'altezza è `dim.h` px e la larghezza è la stringa `dim.w` (una percentuale), anche per le foto (non si usa `spineRatio`: la foto riempie il dorso come oggi con `background-size: 100% 100%`). Senza `dim` nulla cambia per gli scaffali.

`statDim(b)` (pura):
- unità `u = p > 0 ? clamp(round(p / 14), 20, 44) : 20` (p = pagine; **senza pagine larghezza minima**);
- `w = (u / 3.4).toFixed(2) + "%"` (300 unità occupano l'88% della fila: restano i 2 px tra i dorsi, anche a 320 px di schermo);
- `h = p > 0 ? round(84 + min(p, 900) / 900 * 32) : 92` px (84–116 px).

CSS: `.ys-row .spine { flex: none; min-width: 12px; padding: 8px 0 6px; }`, `.ys-row .spine .au { display: none; }`, titolo del dorso 11 px; da 1024 px `.ys-row .spine { height: calc(var(--h) * 1.3) !important; }` (`--h` è già scritto da `spineHTML`). Anteprima al passaggio del mouse come negli scaffali (solo dispositivi con mouse); focus visibile come negli scaffali.

### Dorsi toccabili

- Ogni dorso della mensola è un `<button class="spine" data-id>` di `spineHTML`; i gestori di tocco, pressione prolungata e anteprima sono quelli di `wireMain` per `#main [data-id]` (nessun gestore nuovo; se le Statistiche non stanno in `#main`, si estende il selettore, non si duplica il codice).
- Dopo una modifica fatta dalla scheda aperta dalle Statistiche (Salva, menu rapido, Elimina) la vista Statistiche si ricalcola (`computeStats` + `renderStats`), perché il libro può cambiare anno o voto; il focus torna al dorso se esiste ancora, altrimenti al titolo dell'anno.
- Il bollino della serie resta; il pallino «da aggiornare» non c'è (i libri sulle mensole hanno un anno).

### Note sotto le mensole

- Date nel futuro (`st.future > 0`), testo attuale in `.stats-future`: «1 libro letto ha una data di fine nel futuro: correggila dalla scheda del libro per vederlo negli anni.» / «N libri letti hanno…».
- Libri senza anno (`st.noYear > 0`), riquadro tratteggiato `.stats-noyear` (bordo 1,5 px `--rule`, raggio 12 px, 14 px `--muted`): «**76 libri letti senza anno.** Aggiungi «Finito il» o solo l'anno dalla scheda del libro: comparirà sulla sua mensola.» Al singolare: «**1 libro letto senza anno.** Aggiungi…».
- Nessun anno (tutti i letti senza data né anno, es. i 108 di Goodreads prima di completarli): nessuna mensola, solo il riquadro; l'incipit e «Sempre» restano.

### Sempre

Blocchi `<section class="sblk" data-panel="…">` senza riquadro: titolo `<h3>` Fraunces 21 px `--title` con la linea `--coral` di 3 px sotto (come i nomi degli scaffali), a destra un `<small>` 13 px `--muted`; testi 14 px `--muted`, nomi in `--ink`.

- **Voti** (`voti`): `<small>` «65 libri votati · media 4,2» (1 → «1 libro votato · media 4,0»). Cinque righe `hbar` dalla 5 alla 1: stelle `--accent` in `<span role="img" aria-label="5 stelle">` («1 stella» al singolare), barra `--title` su binario chiaro (la più lunga in `--accent`), numero a destra. Sotto: «Cinque stelle a A, B, C e altri 25.» (fino a 3 titoli, solo se ci sono 5 stelle) + « 18 libri senza voto.» (solo se > 0; «1 libro senza voto.»). Nessun libro votato: niente barre, `<small>` «nessun voto», testo «Dai un voto dalla scheda del libro per vedere come giudichi le tue letture.»
- **Tempo di lettura** (`tempo`): `<small>` «9 libri con le date» (1 → «1 libro con le date»). Numero grande (Fraunces 44 px `--title`) con la media, accanto «giorni in media per libro» («giorno» se 1) e «Il più veloce **T**, 6 giorni. Il più lento **S**, 64.»; con un solo libro misurato: «Su un solo libro: **T**.» Senza dati: il testo attuale «Aggiungi «Iniziato il» e «Finito il» nella scheda dei libri per sapere quanto tempo ti serve per finirne uno.» (classe `hint`, niente numero).
- **Mesi** (`mesi`): `<small>` «7 libri con la data di fine». `monthsHTML` (12 colonne, iniziali sotto, elenco per VoiceOver in `.sr`) con barre `--title`, la più alta `--accent`, linea di base 2 px `--shelf`. Sotto: un solo massimo → «Leggi di più a dicembre: 2 libri.»; da 2 a 3 mesi alla pari → «Leggi di più a marzo e dicembre: 2 libri ciascuno.» (con tre: «gennaio, marzo e dicembre»); più di 3 alla pari → nessuna frase. Senza date di fine: il testo attuale «Aggiungi «Finito il» nella scheda dei libri per vedere in quali mesi leggi di più.» senza grafico.
- **Autori** (`autori`, `span2`): elenco dei primi 6; ogni riga: nome (600, `--ink`, tagliato con «…»), sotto «18 libri, 7.901 pagine, ★ 4,2» (pagine e voto solo se ci sono), a destra i **mini-dorsi**: un `<i>` per libro (al massimo 20), largo 5 px, alto 18–28 px secondo le pagine (`18 + round(min(p, 900) / 900 * 10)`, 20 senza pagine), colore `colorOf(b)`, su una linea di base `--shelf`; tutto `aria-hidden`. Senza autori: «Aggiungi l'autore nella scheda dei libri.»
- **Generi** (`generi`, `span2`): `hbar` con nome, barra `--title` (massima `--accent`), numero; colonna del nome 104 px. Senza generi: «Aggiungi il genere nella scheda dei libri.»

Testi lunghi tagliati con «…» (nomi) o a capo (`overflow-wrap: anywhere` nei paragrafi), come oggi.

## Racconto

Stesse regole di oggi (`openStory(year)`): fino a 9 schermate con gli stessi `data-s` (copertina, numeri, mese, tempo, autore, genere, preferito, voti, chiusura), schermate saltate senza dati, solo copertina/numeri/chiusura sotto i 3 libri; tocco (terzo sinistro indietro, resto avanti), scorrimento, ←/→, ✕ ed Esc, trattini in alto, annuncio `aria-live`, focus intrappolato e restituito al pulsante che l'ha aperto. Cambia l'aspetto:

- **Struttura**: trattini · riga superiore «Il tuo anno da lettore» (14 px, #C9D6D2) con ✕ (44 px) · testo della schermata · **palco** in basso · navigazione. Il segnalibro decorativo in alto (`#story::after`) si toglie: il segnalibro ora è sul pulsante.
- **Palco** `.story-stage` (`aria-hidden`), unico per tutto il racconto e fuori dalle schermate: alto `clamp(120px, 28vh, 250px)`, asse con `--board-img` della versione chiara (il fondo del racconto è sempre scuro), dorsi centrati con 6 px tra l'uno e l'altro. Libri: quelli di `a.books` nell'ordine, finché la somma delle unità di `statDim` non supera **170**, al massimo 12; se il preferito (`a.best`) non è tra questi prende il posto dell'ultimo. Dorsi con `spineHTML(b, "span", dim)`: larghezza `(u * 0.53).toFixed(2) + "%"` del palco (170 unità = 90%, il resto per gli spazi), altezza `min(calc(var(--h) * 1.9), 85%)`.
- **Animazioni** (solo con `prefers-reduced-motion: no-preference`): all'apertura i dorsi cadono sull'asse (`@keyframes drop` da `translateY(-110%)` e opacità 0, 0,7 s, `cubic-bezier(.3, 1.4, .5, 1)`, 60 ms di ritardo tra un dorso e l'altro); nella schermata «preferito» il dorso del preferito esce dallo scaffale (classe `out`: `translate(18px, -34px) rotate(9deg)`, origine in basso a sinistra, transizione 0,5 s) e rientra lasciando la schermata. Con movimento ridotto: nessuna animazione né transizione; il preferito resta inclinato, fermo, nella sua schermata.
- **Testi** (Fraunces per anno e frasi, crema #F4EAD8, evidenziati #FFB3A9):
  - copertina: anno grande (96 px) e «Hai messo sullo scaffale **2 libri**.» («**un libro**» se 1), sotto «Tocca a destra per continuare»;
  - numeri, mese, tempo, autore, genere, voti: testi attuali (il grafico dei mesi e le barre dei voti restano sopra il palco);
  - preferito: «Il preferito del 2025», titolo (34 px), autore, stelle (#FFB3A9, `aria-label` «N stelle»); niente copertina: è il dorso che esce dallo scaffale;
  - chiusura: «Il tuo 2025», «2 libri, un anno da ricordare.» e il pulsante «Chiudi» (600 15 px, come oggi); niente griglia delle copertine.
- **Navigazione**: in basso, sempre visibile, ‹ (48 px, tondo, bordo crema 35%) · «3 di 9» (13 px) · ›; disattivate agli estremi come oggi.

## Dati

`computeStats` resta pura e compatibile; `window.libreriaStats.compute` non cambia firma. Campi usati:

| Parte | Campi |
|---|---|
| Incipit | `sempre.read`, `sempre.pages`, `sempre.ratings`, `sempre.authors[0..1]`, `sempre.months`, `sempre.monthsCount` |
| Mensole | `anni[].year`, `count`, `pages`, `avgRating`, `topAuthor`, `topGenre`, `best`, `books` (già ordinati dal più recente), `racconti` |
| Note | `noYear`, `future` |
| Voti | `sempre.ratings`, `unrated`, `avgRating`, `fiveStars` |
| Tempo | `sempre.days` |
| Mesi | `sempre.months`, `monthsCount` |
| Autori | `sempre.authors[]` (`name`, `count`, `pages`, `avgRating`) **+ `books`** |
| Generi | `sempre.genres[]` |
| Racconto | come oggi (`anni[]` e `computeStats(a.books).sempre`) |

Unica aggiunta: `sempre.authors[i].books`, i libri di quell'autore dal più recente (stesso ordine `recent` già usato), per colori e altezze dei mini-dorsi. È un campo in più: i test esistenti e chi legge `compute` non cambiano.

## Struttura del codice

- `ledeHTML(S)`, `statDim(b)`, `ysRows(list)` (pura: divide in file), `yearHTML(a, racconto)`, `miniSpines(books)`: funzioni nuove vicino a `renderStats`.
- `renderStats(st)`: riscritta (stesso nome e stessa firma); usa `pagerHTML` così com'è.
- `spineHTML(b, tag, dim)`: terzo parametro facoltativo (2 righe).
- `let statsLast = null;` impostato in `render()` quando la vista è Statistiche (`statsLast = computeStats(…)`); `replaceYear(year)` ridisegna solo `section.ys[data-year]` da `statsLast` e chiama `wireMain` su quella sezione.
- `wireMain`: nei gestori `[data-more]`/`[data-less]`, le chiavi che iniziano con `y` vanno a `replaceYear` (prima del ramo `covers`/`replaceShelf`). `[data-story]` resta com'è.
- `openStory(year)`: aggiunta di palco, navigazione in basso e classe `out`; nel ripiego del focus alla chiusura il selettore diventa `[data-story="${year}"]`.
- `refreshChanged` non cambia: in vista Statistiche fa già `render()` (i limiti `y…` restano).

## Prestazioni e peso

- Nessun lavoro in più fuori dalla sezione: tutto si calcola solo all'apertura di Statistiche o dopo una modifica arrivata mentre è aperta (come oggi).
- «Mostra altri 15» ridisegna una sola mensola, senza ricalcolare (`statsLast`).
- Nodi: al massimo 15 dorsi per anno visibili (≈ 4 nodi l'uno), mini-dorsi ≤ 120 `<i>`, palco ≤ 12 dorsi; meno della pagina attuale con sei pannelli e i `<details>`.
- Immagini: i dorsi «dalla copertina» usano `thumb(…, 120)` con `loading="lazy"`, come gli scaffali (già in cache se lo scaffale è stato visto). Nessun ricalcolo al ridimensionamento: le larghezze sono percentuali.
- Peso stimato (non compresso): JS +2,5 KB (incipit 0,8, mensole e file 1, mini-dorsi 0,3, palco del racconto 0,4) e −1,5 KB tolti (schede racconto, sintesi, anni in `<details>`) → **circa +1 KB**; CSS +3,5 KB e −2 KB tolti (`.stories`, `.story-card`, `.panel`, `.figures`, `.trio`, `.pair`, `.year`, `.best`, `.story-covers`) → **circa +1,5 KB**. In tutto **circa +2,5 KB**, entro i 3–4 KB del criterio.

## Accessibilità

- **Titoli**: h2 «Statistiche», h2 nascosti «Anno per anno» e «Sempre», h3 per ogni anno e ogni blocco: si naviga con il rotore di VoiceOver.
- **Mensole**: `role="group"` con `aria-label` «2025: 3 libri, 800 pagine» (senza pagine: «2019: 1 libro»); dentro, un pulsante per dorso con etichetta «*Titolo*, *Autore*» (passati da `esc()`), così VoiceOver li legge uno a uno e li apre con il doppio tocco. Con la paginazione si leggono solo i dorsi mostrati; il pager dice «15 di 32». La riga dei numeri legge «voto medio 4,2» invece della stella.
- **Pulsante**: etichetta «Il racconto del 2025», che contiene il testo visibile «Il racconto» (Controllo vocale lo trova dicendo quello che si vede).
- **Contrasto**: testi solo con i token controllati dall'hook `contrasto.mjs` (`--ink`, `--muted`, `--title`, `--accent`, `--accent-ink` su `--accent`) in chiaro e scuro; `--coral` solo per linee e segnalibri decorativi. Barre in `--title`/`--accent` (contrasto con il fondo ben oltre 3:1). Nel racconto crema su petrolio scuro > 10:1, #FFB3A9 > 7:1.
- **Bersagli**: «Il racconto» 44 px, `.pager-btn` 44 px (anche negli scaffali), dorsi alti ≥ 84 px e larghi ≥ 20 px (come negli scaffali, sotto i 44 px di larghezza), frecce del racconto 48 px, ✕ 44 px.
- **Movimento**: animazioni solo nel racconto e solo con `prefers-reduced-motion: no-preference`; lo scorrimento di «Nascondi» rispetta la stessa preferenza.
- **Racconto**: focus, Esc, annunci e trappola del Tab come oggi; il palco è `aria-hidden`.

## Casi limite

| Caso | Comportamento |
|---|---|
| Nessun libro letto | Solo «Quando segnerai un libro come Letto, qui compariranno le tue statistiche»; niente titolo, incipit, mensole, blocchi |
| Un solo libro letto | Incipit «Hai letto un libro, N pagine.»; una mensola con un dorso, senza riga dell'anno; blocchi con i testi al singolare |
| Anno con 1 libro | Mensola con un dorso; «1 libro, 320 pagine»; nessuna riga `.ys-d`; racconto ridotto a 3 schermate |
| Libro senza pagine | Dorso di larghezza minima (16 unità) e altezza 92 px; non conta nelle pagine; mini-dorso alto 20 px |
| Nessun voto | Incipit senza voto; «Voti» con il testo d'invito; riga dei numeri dell'anno senza ★ |
| Libri con solo l'anno (`finishedYear`) | Sulla mensola del loro anno, in fondo; non contano nei mesi |
| Date di fine future | Come nessuna data (regola attuale): nessuna mensola per loro, nota `.stats-future` |
| 76 libri senza anno (Goodreads) | Riquadro «76 libri letti senza anno…» sotto le mensole; contano nell'incipit e in «Sempre» |
| Anno con più di 15 libri | 15 dorsi + pager; ogni «Mostra altri» aggiunge fino a 15 |
| Titoli e nomi lunghissimi | Tagliati sul dorso (`text-overflow`), «…» nei nomi, a capo nei paragrafi; niente scorrimento orizzontale |
| Modifica dal cloud con Statistiche aperte | `render()` come oggi; i limiti `y…` restano |

## Test (`test/statistiche.mjs`)

Restano validi così come sono: tutto `scheda`; tutto `calcoli`; in `pagina` «stelle dei voti leggibili da VoiceOver», «Thriller 3», «libreria senza letti» (con in più l'assenza di `section.ys`), «titoli lunghi», il ciclo 390/1366 chiaro/scuro; in `racconto` le 9 schermate, una visibile alla volta, annuncio «2 di 9», frecce e tasti, trattini, estremi, tocco sinistra/destra, niente scorrimento, «Chiudi» 600 15 px, versione ridotta del 2024, focus intrappolato.

Cambiano:
- «due schede racconto 2025 e 2024» → `button.story-btn` con `data-story` «2025,2024», dentro `section.ys` dei rispettivi anni; nessun pulsante nel 2019.
- «pannelli di Sempre presenti» → `voti,tempo,mesi,autori,generi`.
- «sintesi mostra 8 libri e 40 giorni» → incipit esatto «Hai letto 8 libri, 2.850 pagine in tutto. Il mese in cui finisci più libri è agosto.» (voti 4 e 5 alla pari, King e Winslow alla pari: quei pezzi non compaiono) e «40» in `[data-panel="tempo"]`.
- «anni 2025, 2024, 2019, il primo aperto» → `section.ys` con `data-year` «2025,2024,2019».
- «nota: 1 senza anno…» → `.stats-noyear` contiene «1 libro letto senza anno.»; `.stats-future` invariato.
- «senza date» → `.hint` in mesi e tempo, nessun `.months` in mesi, nessuna `section.ys`.
- Apertura del racconto: `button.story-btn[data-story="…"]` al posto di `button.story-card`; il focus alla chiusura torna su quel pulsante (il controllo su `dataset.story` resta).
- «racconti rolling al 2027-01-05» → `button.story-btn`.

Nuovi:
- `calcoli`: `authors[0].books` di Stephen King = `Cinque,Sei` (ordine `recent`: Cinque ha l'anno 2019, Sei nessuno), la funzione resta pura (nessun accesso al DOM).
- **Incipit**: libri di prova A1 (X, 5 stelle, 100 pp, fine 2025-03-01), A2 (X, 5, 200 pp, 2025-03-20), A3 (Y, 4, 300 pp, 2025-07-01) → «Hai letto 3 libri, 600 pagine in tutto. Il voto che dai più spesso è cinque stelle, a 2 libri; l'autore che torna di più è X, con 2 titoli. Il mese in cui finisci più libri è marzo.»; un libro senza pagine né voto → «Hai letto un libro.»
- **Mensole** (con `FIXTURE`): etichetta del 2025 «2025: 3 libri, 800 pagine»; tre `button.spine[data-id]` nella mensola 2025 con etichetta «Titolo, Autore»; un tocco su «Due» apre la `.sheet` di quel libro; cambiare l'anno di fine di «Due» al 2024 e salvare lo sposta sulla mensola del 2024 senza ricaricare; in una pagina a parte con tre libri del 2025 (senza pagine, 100 e 900 pagine) i primi due hanno la stessa larghezza (minima) e quello da 900 è il più largo; riga `.ys-d` del 2025 con «Don Winslow», «Thriller» e «Uno»; nessuna `.ys-d` nel 2019 (1 libro).
- **Mostra altri 15**: 32 libri finiti nel 2025 → 15 dorsi e «15 di 32»; «Mostra altri 15» → 30 e il pulsante dice «Mostra altri 2»; poi 32 e solo «Nascondi»; «Nascondi» → 15; la mensola del 2024 è lo stesso nodo prima e dopo (ridisegnata solo quella dell'anno); niente scorrimento orizzontale.
- **Bersagli**: altezza di `.story-btn` e di `.pager-btn` (Statistiche **e** scaffali) ≥ 44 px a 390 px; aggiornare in `test/interfaccia.mjs` eventuali misure dei pulsanti di paginazione.
- **Autori**: la riga di Stephen King ha 2 mini-dorsi, `aria-hidden`.
- **Racconto**: `.story-stage` con 3 dorsi per il 2025 e `aria-hidden="true"`; nella schermata «preferito» il dorso del preferito ha la classe `out`, nelle altre no; con `page.emulateMedia({ reducedMotion: 'reduce' })` nessun dorso ha `animation-name` diverso da `none` e la transizione è nulla; navigazione in basso visibile a 390 px con «1 di 9».

## File toccati (per l'unione con le spec parallele)

Due altre spec lavorano sugli stessi file (scheda del libro; «Cosa leggo adesso?»). Questa spec tocca solo:

| File | Dove |
|---|---|
| `app.js` | `computeStats` (solo `authors[].books`); `spineHTML` (terzo parametro `dim`, due righe all'inizio); blocco tra `window.libreriaStats` e `openStory` (nuove `ledeHTML`, `statDim`, `ysRows`, `yearHTML`, `miniSpines`; `renderStats` riscritta; `monthsHTML` invariata); `openStory`; in `render()` la riga della vista Statistiche (`statsLast`); in `wireMain` solo i due gestori `[data-more]`/`[data-less]` (ramo `y…`); nuova `replaceYear` accanto a `replaceShelf` |
| `style.css` | Blocco Statistiche (oggi da `.stats` a `.panel .hint…`, righe ~122–173): sostituito da un blocco «Statistiche: scaffale degli anni» con `.stats-title`, `.stats-lede`, `.stats-cols`, `.ys*`, `.story-btn`, `.sblk`, mini-dorsi, `.pager-btn` (44 px ovunque); blocco del racconto (`#story`, `.slide`, `.story-*`, righe ~534–572): aggiunti `.story-stage`, `.story-nav`, `.out`, `@keyframes drop`; tolto `#story::after`. `.hbar`, `.months`, `.mlab`, `.sr` restano (usati anche dal racconto) |
| `sw.js` | `VERSION` +1 (chi unisce per ultimo la incrementa di nuovo, così ogni pubblicazione ha un numero nuovo) |
| `test/statistiche.mjs` | Controlli sopra |

`CLAUDE.md` (sezione Statistiche e storia) si aggiorna con `/pubblica`. Le spec parallele dovrebbero toccare `openBook`/la scheda e `renderHero`/`nextHTML`/`wireNext`/`nextBooks` e i loro blocchi CSS: le uniche funzioni in comune potenziali sono `spineHTML` e `wireMain`, dove le modifiche di questa spec sono piccole e localizzate.

## Fuori ambito

- Indice dei nomi con i puntini (variante C) per gli autori.
- Condividere il racconto come immagine.
- «Serie da continuare» nelle Statistiche, ordine «Serie».
- Nuovi calcoli (pagine al mese, confronto tra anni).
