# Scheda del libro «Frontespizio» — design

Data: 2026-10-29 · Stato: da rivedere con Diego · Percorso Superpowers: architetturale (proposte → spec → piano)

Riferimenti: proposta `design/proposte/scheda.md`, prototipo `design/proposte/scheda.html` (variante A), screenshot `design/proposte/img/scheda-A.png`, `scheda-A-scuro.png`, `scheda-A-1366.png`.

## Obiettivo

Ridisegnare la scheda del libro (`openBook`) come la pagina del titolo di un libro: prima il libro (copertina, titolo, autore, serie), poi la lettura raccontata a parole, poi i ricordi (citazione, note), la trama e il seguito; i dati tecnici in fondo, impaginati come un colophon. Nessun campo tolto: si spostano soltanto. In più, per i libri In lettura, una riga con il ritmo di lettura e la data stimata di fine.

Criteri di riuscita:
- Aprendo un libro letto si vedono senza scorrere (390×844): copertina, titolo, autore, serie, stato, voto e la frase delle date.
- Le date si leggono in italiano dentro una frase («Letto dal 10 dicembre 2024 al 2 gennaio 2025»); toccando una data si apre il selettore nativo; niente più «mm/dd/yyyy».
- Tutte le regole delle date restano identiche (v49, v63, v64, v65), con gli stessi avvisi.
- Un libro In lettura con inizio, pagina e pagine totali mostra «… a questo ritmo lo finisci verso il 23 novembre»; negli altri casi una frase che dice cosa manca.
- Sul computer (≥ 1024 px) il pannello non lascia colonne vuote: frontespizio a sinistra, il resto a destra.
- Restano tutti gli id usati dai test e dal codice; i test esistenti passano con al più una modifica (`test/serie.mjs`, vedi «Test»).
- Peso: circa 4 KB di CSS e 3,5 KB di JS non compressi; nessun font o libreria nuovi.

## Decisioni prese con Diego

| Domanda | Scelta |
|---|---|
| Quale delle tre proposte | A «Frontespizio» (non B «Cartellino», non C «Sovracoperta») |
| Campi | Nessuno tolto, solo spostati; dati tecnici in fondo come colophon |
| Date | Frase leggibile con il selettore nativo sovrapposto e invisibile |
| Regole delle date | Tutte quelle di oggi (v49, v63–v65), anche nella frase |
| Ritmo di lettura | Sì, per i libri In lettura |
| Sul computer | Risolvere lo spazio vuoto ai lati (proposta qui sotto: due colonne) |

Scelte fatte in questa spec, da confermare con Diego, elencate anche in fondo: testo della serie, frasi per le date parziali, Da leggere senza date visibili, verdetti del voto, conteggio dei giorni del ritmo e limiti, pannello a due colonne, testi del colophon, Nuovo libro con il nuovo blocco lettura, ✕ al posto di «Chiudi».

## 1. Struttura della scheda

### Contenitore
- `openSheet(html, cls)` riceve un secondo parametro facoltativo: la classe in più per `.sheet`. `openBook` passa `"book"`, quindi la scheda è `.sheet.book`; tutte le altre schede (Backup, Nuovo libro, Sincronizzazione, «Scegli per me»…) restano come sono.
- Struttura del markup (in quest'ordine nel DOM):
  1. `<button class="x" id="s-close" type="button" aria-label="Chiudi la scheda">✕</button>` — sostituisce il pulsante «Chiudi» in fondo; stesso id, stesso comportamento (`dismissSheet`, quindi Salva / Scarta / Continua invariato). 44×44 px, fisso in alto a destra durante lo scorrimento (`position: sticky; top: 0`).
  2. `<header class="sheet-top fp">` — il frontespizio (§1.1).
  3. `<div class="fp-main">` — tutti gli altri blocchi, nell'ordine di §2.
  4. `<div class="sheet-bar">` — «Elimina» (`#s-del`, a sinistra) e «Salva» (`#s-save`, a destra), fissa in basso (`position: sticky; bottom: 0`, fondo `--surface`, filo `--rule` sopra).
- La barra «Hai modifiche non salvate» (`.unsaved`, aggiunta in coda da `dismissSheet`) in `.sheet.book` è anch'essa `sticky; bottom: 0` e copre la `.sheet-bar` finché è aperta.
- Una sola `h2` nella scheda (il titolo del libro): i titoli di sezione («Trama», «Sullo scaffale») sono `h3`. Serve a `test/serie.mjs`, che legge `.sheet h2`.

### 1.1 Frontespizio (`header.sheet-top.fp`)
Centrato, in colonna:
- copertina (`coverHTML(b)`, classe `.cover` come oggi, larga 120 px sul telefono, 200 px nella colonna sinistra del computer, ombra leggera);
- `<h2>` titolo in Fraunces (`--display`, `--dw`), 26 px, colore `--title`, `text-wrap: balance`;
- `<div class="sub">` autore, 16 px, corsivo di sistema (niente Fraunces corsivo: sarebbe un font in più), «Autore sconosciuto» se manca;
- se c'è la serie: `<button class="sserie" type="button" data-series>` con il testo di oggi, `serLabel(b)` → «Slough House · 3» (scelta: il prototipo diceva «Slough House, volume 3», ma il formato con il punto è quello dell'hero e dei test); stile link corallo (`--accent`), altezza ≥ 44 px; il tocco cerca la serie nella libreria come oggi;
- `<i class="rib" aria-hidden="true">`: il segnalibro corallo del titolo dell'app (`--coral`, 10×18 px con la tacca a V), unico ornamento.

Spariscono dal frontespizio: la riga `.kv` (segnatura, anno, pagine, genere: vanno nel colophon), il «Finito il gg/mm/aaaa» (diventa la frase delle date) e la nota `#s-stale` (scende sotto la frase, §3.5).

## 2. Ordine dei blocchi per stato

L'ordine si decide all'apertura dallo stato salvato. Cambiare stato con il selettore dentro la scheda non riordina i blocchi: mostra o nasconde le parti (frase, pagina, fine, anno) come indicato in §3 e §4.

### Telefono e tablet (< 1024 px), una colonna

| # | Letto | In lettura | Da leggere | Desiderato |
|---|---|---|---|---|
| 1 | Frontespizio | Frontespizio | Frontespizio | Frontespizio |
| 2 | Stato | Stato | Stato | Riquadro «Ho acquistato» (`.wish-box`, `#s-bought`, testi di oggi) |
| 3 | Voto con verdetto | Frase delle date + riga del ritmo | Frase «Ancora da iniziare.» | Trama |
| 4 | Frase delle date + durata, avvisi, «oppure solo l'anno», `#s-stale` | Pagina (numero grande, cursore, +10, +N) | Trama | Colophon |
| 5 | Citazione | Citazione | Citazione | Sullo scaffale |
| 6 | Note | Note | Note | Barra Elimina / Salva |
| 7 | Trama | Voto «Il voto, quando vuoi» | Voto «Il voto, quando vuoi» | |
| 8 | Prossimo della serie (se c'è) | Trama | Colophon | |
| 9 | Colophon | Colophon | Sullo scaffale | |
| 10 | Sullo scaffale | Sullo scaffale | Barra Elimina / Salva | |
| 11 | Barra Elimina / Salva | Barra Elimina / Salva | | |

Note:
- Il blocco Pagina esiste sempre nel DOM per Letto, In lettura e Da leggere (contiene `#f-page`); è visibile solo con lo stato In lettura selezionato.
- Nella frase, le date di inizio e di fine esistono sempre nel DOM (`#f-started`, `#f-finished`); sono visibili o nascoste secondo §3.
- «Prossimo della serie» compare solo per i Letti, come oggi (`snextHTML`).
- Desiderato non ha stato, voto, date, pagina, citazione e note, come oggi (nessun cambiamento di regole).
- La trama (`#s-syn`) è dentro `<section class="syn-b" id="s-syn-b">` con `<h3>Trama</h3>`; se la trama è vuota è nascosta tutta la sezione. «Aggiorna informazioni», quando trova la trama, mostra anche `#s-syn-b`.

### Computer (≥ 1024 px), due colonne
Soluzione al problema aperto del prototipo (colonna centrale stretta con spazio vuoto ai lati):
- `.sheet.book` resta il pannello a destra di oggi, ma più largo: `width: min(760px, calc(100vw - 300px))` (al posto di 460 px); a 1366 px → 760 px, a 1024 px → 724 px. Lo scaffale resta visibile a sinistra.
- Griglia: `grid-template-columns: 232px minmax(0, 1fr); column-gap: 32px`.
  - `.x`: `grid-column: 1 / -1; justify-self: end`.
  - `.sheet-top.fp`: colonna 1, `position: sticky; top: 56px; align-self: start`: copertina da 200 px, titolo, autore, serie e segnalibro restano visibili mentre si scorre la colonna destra.
  - `.fp-main`: colonna 2, stesso ordine della tabella (righe 2 →).
  - `.sheet-bar` e `.unsaved`: `grid-column: 1 / -1`.
- Colophon su due colonne dentro `.fp-main`: a sinistra i dati, a destra «Finito di leggere…»; sotto, a tutta larghezza, «Aggiorna informazioni» e «Modifica i dati del libro».
- Tra 640 e 1023 px resta la scheda centrata di oggi (max 560 px) in una colonna.

## 3. Le date come frase

### 3.1 Markup (in `readingHead`, §5)
```
<div class="period" id="f-period">
  <p class="sr" id="f-period-sr"></p>                       ← frase intera per VoiceOver
  <p class="pline">
    <span class="pw" id="f-pw-lead" aria-hidden="true"></span>
    <span class="pc" id="f-pc-start"><span class="pw" aria-hidden="true"></span>
      <label class="dt"><span class="dv" aria-hidden="true"></span><input id="f-started" type="date" aria-label="Iniziato il" …></label></span>
    <span class="pc" id="f-pc-end"><span class="pw" aria-hidden="true"></span>
      <label class="dt"><span class="dv" aria-hidden="true"></span><input id="f-finished" type="date" aria-label="Finito il" …></label></span>
  </p>
  <p class="psub" id="f-psub"></p>                           ← durata / pagine / ritmo
  <p class="hint" id="f-pend-hint">La data di fine si sceglie quando lo segni come letto.</p>
  #f-date-err, #f-date-est, #f-year-row, #s-stale            ← come oggi, in quest'ordine
</div>
```
- `#f-started` e `#f-finished` restano `input type="date"` veri, con gli stessi attributi di oggi (`value`, `data-auto` se `finishedAuto`, `disabled` se lo stato non è Letto). Sono sovrapposti alla parola sottolineata (`position: absolute; inset: 0; opacity: 0; font-size: 16px` — 16 px evita lo zoom di iOS al tocco) e nessun elemento sta sopra di loro.
- Sul computer un clic su un campo data trasparente non apre il calendario in Chrome: al `click` e a Invio/Spazio si chiama `input.showPicker()` dentro `try/catch` (se manca o fallisce, resta il comportamento nativo).
- Le parole (`.pw`) e i testi delle date (`.dv`) si scrivono sempre con `textContent`, mai con HTML.
- Una data vuota mostra nel suo `.dv` il segnaposto «scegli la data».
- `.dt`: `display: inline-flex; min-height: 44px; position: relative`; testo `--accent`, sottolineatura punteggiata `--coral` di 2 px; con `aria-invalid="true"` sul campo, sottolineatura ondulata `--accent`; `.dt:focus-within` contorno 2 px `--accent`.

### 3.2 Formato delle date
- `Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" })` creato una volta: «2 gennaio 2025», «1 maggio 2025».
- Una data sola: sempre con l'anno.
- Intervallo «dal X al Y»: X senza anno se ha lo stesso anno di Y («dal 10 marzo al 2 aprile 2025»), altrimenti entrambe con l'anno («dal 10 dicembre 2024 al 2 gennaio 2025»).

### 3.3 Frasi (funzione pura `periodText`)
`periodText({ status, started, finished, year, pages }) → { lead, startWord, startText, endWord, endText, showStart, showEnd, sub, sr }`, dove `year` è il valore di `#f-year` solo se è un intero tra 1900 e l'anno corrente (altrimenti vuoto) e `pages` il numero in `#d-pages`. S = inizio, F = fine, Y = solo l'anno, «[…]» = data toccabile.

**Letto**

| Caso | Riga visibile | `#f-psub` |
|---|---|---|
| L1 · S e F | «Letto dal [S] al [F]» | «N giorni · P pagine»; N = F − S + 1; con N = 1 «In un giorno · P pagine»; senza P solo la durata; con N < 1 (date storte) solo «P pagine» |
| L2 · solo F | «Iniziato il [scegli la data] e finito il [F]» | «P pagine» (vuota senza P) |
| L3 · solo S, senza Y | «Iniziato il [S] e finito il [scegli la data]» | «P pagine» |
| L4 · nessuna data, senza Y | «Iniziato il [scegli la data] e finito il [scegli la data]» | «P pagine» |
| L5 · Y senza F (con o senza S) | prima riga «Letto nel Y.» (in `#f-pw-lead`, a capo), poi come L3/L4: «Iniziato il [S \| scegli la data] e finito il [scegli la data]» | «P pagine» |

- Sotto la frase, come oggi: `#f-year-row` «oppure solo l'anno» visibile per Letto senza F (`syncYearRow` invariata), `#f-date-err`, `#f-date-est`, `#s-stale`.
- L3, L4 e i casi con date storte hanno `#s-stale` (testo di oggi). L5 e L2 no (regola `needsDates` invariata: l'inizio non conta).
- Date storte già salvate (es. S 10 maggio, F 1 maggio 2025): frase L1 «Letto dal [10 maggio] al [1 maggio 2025]», la data colpevole con sottolineatura ondulata quando `badDates` la segna, `#s-stale` con il motivo, Salva bloccato con `#f-date-err` (comportamento di oggi).

**In lettura**

| Caso | Riga visibile | `#f-psub` |
|---|---|---|
| R1 · S | «In lettura dal [S]» | testo del ritmo (§4) |
| R2 · senza S | «In lettura dal [scegli la data]» | testo del ritmo, caso «no-start» |

La clausola di fine (`#f-pc-end`) è nascosta (il campo resta nel DOM, svuotato e `disabled` come oggi); compare `#f-pend-hint` «La data di fine si sceglie quando lo segni come letto.».

**Da leggere**: riga «Ancora da iniziare.», clausole di inizio e fine nascoste (i valori nei campi, se ci sono, si conservano e si salvano come oggi), `#f-psub` e `#f-pend-hint` nascosti.

**Desiderato**: nessuna frase (non c'è il blocco lettura).

**Frase per VoiceOver** (`#f-period-sr`, visivamente nascosta, non `aria-live`): la stessa frase con le date intere e «data da scegliere» al posto del segnaposto, es. «Iniziato il: data da scegliere; finito il 2 gennaio 2025.», «Letto dal 10 dicembre 2024 al 2 gennaio 2025, 24 giorni.».

### 3.4 Aggiornamento dal vivo
`syncPeriod(sheet)` legge stato (`#f-status`), `#f-started`, `#f-finished`, `#f-year`, `#d-pages`, `#f-page`, calcola `periodText` (e il ritmo) e riscrive solo testi e `hidden` di parole, clausole, `#f-psub`, `#f-pend-hint`. Non ricrea mai i campi data: `wireDates` vi tiene `dataset.ok` e `dataset.auto`.
Si chiama: all'apertura; dopo ogni `change` dei due campi data (in coda al gestore di `wireDates`, dopo `limits()` e `syncYearRow`); all'`input` di `#f-year`, `#d-pages`, `#f-page`; al cambio di stato (gestore del `.seg` in `wireRating`, dopo `syncYearRow` e `syncPage`); dopo `fillData` e «Aggiorna informazioni».

### 3.5 Regole delle date: invariate
`dateProblem`, `wireDates`, `badDates`, `syncYearRow`, `badYear`, `readReading` non cambiano logica. In particolare restano: niente date future né fuori ordine con ritorno al valore precedente e avviso `#f-date-err` (v49); fine stimata a inizio + 20 giorni con `#f-date-est` «Fine stimata: 20 giorni dopo l'inizio, modificala se serve.» (v63); sostituzione della fine messa dall'app (`data-auto`/`finishedAuto`, v64); nuovo inizio dopo la fine → fine spostata con «Fine spostata a 20 giorni dopo il nuovo inizio, modificala se serve.» (v65); limiti `min`/`max` dei selettori; «Finito il» attivo solo per i Letti; `finishedYear` tolto con una fine o lasciando Letto; fine di oggi automatica al passaggio a Letto in `readReading`. La sola aggiunta è la chiamata a `syncPeriod`.

## 4. Ritmo di lettura

### 4.1 Funzione pura
`readingPace({ started, page, pages }, oggi)` (nell'app `oggi` = `today()`) con date `AAAA-MM-GG` (calcolo a mezzogiorno per evitare l'ora legale). Restituisce `{ why, day, perDay, left, eta }`:
- `day` = giorni da `started` a `oggi` inclusi (inizio oggi → 1);
- `perDay` = `page / day`; `left` = `pages − page`; `eta` = `oggi + ceil(left / perDay)` giorni (`AAAA-MM-GG`).

Casi, nell'ordine in cui si controllano:

| `why` | Condizione |
|---|---|
| `no-start` | `started` vuoto, non valido o dopo `oggi` |
| `today` | `day` = 1 (iniziato oggi) |
| `no-pages` | pagine totali assenti o ≤ 0 |
| `no-page` | pagina attuale assente o 0 |
| `done` | `page ≥ pages` |
| `odd` | `day` > 730, oppure `perDay` < 1, oppure `perDay` > 300, oppure `eta` più di 365 giorni dopo `oggi` |
| `ok` | tutti i dati validi |

`paceText(r, oggi)` (pura) restituisce il testo di `#f-psub`. «Nº» usa l'indicatore ordinale «º»:

| `why` | Testo |
|---|---|
| `ok` | «18º giorno di lettura, circa 8 pagine al giorno: a questo ritmo lo finisci verso il 23 novembre.» — pagine = `Math.round(perDay)`, «1 pagina» al singolare; data senza anno se è nell'anno di `oggi`, altrimenti con l'anno («verso il 3 gennaio 2027»); se `eta` è domani: «… a questo ritmo lo finisci domani.» |
| `no-start` | «Scegli la data di inizio: qui comparirà quando potresti finirlo.» |
| `today` | «Primo giorno di lettura: la stima compare da domani.» |
| `no-pages` | «18º giorno di lettura. Aggiungi le pagine totali in «Modifica i dati del libro» per sapere quando lo finisci.» |
| `no-page` | «18º giorno di lettura. Scrivi a che pagina sei per sapere quando lo finisci.» |
| `done` | «18º giorno di lettura: sei all'ultima pagina, segnalo come Letto.» |
| `odd` | «18º giorno di lettura.» |

Esempio di riferimento (dal prototipo): oggi 2026-10-29, inizio 2026-10-12, pagina 142 di 337 → `day` 18, `perDay` 7,89, `left` 195, 195 / 7,89 = 24,7 → 25 giorni → `eta` 2026-11-23 → «18º giorno di lettura, circa 8 pagine al giorno: a questo ritmo lo finisci verso il 23 novembre.».

Esposizione per i test, subito dopo `openBook`: `window.libreriaScheda = Object.freeze({ period: periodText, pace: readingPace, paceText })`.

### 4.2 Dove e quando
- Solo nella scheda, in `#f-psub`, quando lo stato selezionato è In lettura; calcolato dai campi della scheda (non dal libro salvato), quindi cambia subito con +10, il cursore, il campo pagina, la data di inizio o le pagine totali.
- Non compare nell'hero né nelle Statistiche (fuori ambito).

## 5. Blocchi della lettura (anche per Nuovo libro)

`readingFields(b)` si divide in due, entrambe usate da `openBook` e da `openAdd`:
- `readingHead(b)`: stato (`.seg`, invariato nei dati: `#f-status` nascosto, pulsanti `role="radio"` con `data-v` e `aria-checked`), voto se `b.status === "letto"`, frase delle date (§3), blocco Pagina (§5.2).
- `readingMemo(b)`: citazione, note, voto se lo stato non è Letto.

Il voto (`#f-rate`) compare una sola volta, nella posizione decisa all'apertura. `openAdd` usa `readingHead(b) + readingMemo(b)` al posto di `readingFields(b)`: Nuovo libro prende la frase delle date e il nuovo aspetto di stato e voto, ma non frontespizio, colophon e scaffale (resta la sua struttura: ricerca, copertina, dati, lettura, pulsanti). Lo stile nuovo è limitato a `.rf` (il contenitore di questi blocchi), così vale in entrambe le schede e in nessun'altra.

### 5.1 Stato e voto
- `.rf .seg`: tre voci a tutta larghezza con una linea sotto (`--rule`); la voce scelta ha testo `--title` in grassetto e la linea di 3 px `--coral` sotto (è la `.seg-ink` di oggi ridisegnata: stessa logica di posizione, `height: 3px; bottom: 0`). Ogni voce ≥ 44 px.
- `.rf .rate`: cinque stelle centrate da 44×44 px (`button[data-n]`, `aria-label` «N stelle», classe `on`, ritocco della stessa stella = 0: invariati); stelle accese `--accent`, spente `--muted`.
- Sotto, `<p class="verdict" id="f-verdict" aria-live="polite">` aggiornato da `wireRating` a ogni tocco: 0 «Tocca una stella per dare il voto» (In lettura e Da leggere: «Il voto, quando vuoi»), 1 «Non mi è piaciuto», 2 «Così così», 3 «Mi è piaciuto», 4 «Bellissimo», 5 «Lo rileggerei».

### 5.2 Pagina (In lettura)
```
<div class="pblk" id="f-pblk">
  <div class="pbig"><label for="f-page">pag.</label> <input id="f-page" type="number" inputmode="numeric" min="0" …> <span id="f-pof">di 337 · 42%</span></div>
  <input type="range" id="f-range" min="0" max="337" aria-label="Avanzamento di Titolo" aria-valuetext="pagina 142 di 337">
  <div class="pq"><button type="button" class="btn" id="f-p10" aria-label="Aggiungi 10 pagine a Titolo">+10</button><button type="button" class="btn" id="f-pstep" aria-label="Aggiungi N pagine a Titolo">+N</button></div>
</div>
```
- `#f-page` mantiene id, valori e regole di oggi (`syncPage`: per un Letto con pagine totali vale il totale ed è `readonly`; tornando In lettura riprende il valore di apertura). Numero in Fraunces 40 px, colore `--title`, senza bordo, sottolineato.
- `#f-range`: binario disegnato come nell'hero (`--pct`, corallo fin dove si è letto); visibile solo con pagine totali; durante il trascinamento scrive in `#f-page` e lancia `input`.
- `#f-p10` aggiunge 10, `#f-pstep` aggiunge `b.pageStep` ed è nascosto se `pageStep` manca; entrambi limitati al totale, scrivono in `#f-page` e lanciano `input`.
- `#f-pof`: «di T · P%»; senza totale: «di ?» e niente cursore.
- Differenza voluta rispetto all'hero: nella scheda questi controlli cambiano solo il campo; si salva con Salva (come ogni altro campo della scheda, e la guardia «modifiche non salvate» se ne accorge). `pageStep` non cambia dalla scheda (come oggi: `readReading` non lo tocca).
- Visibile solo con stato In lettura (`syncPage` aggiorna anche `hidden`, cursore, `--pct`, `#f-pof`).

### 5.3 Citazione e note
- `#f-quote`: etichetta «Citazione preferita» visivamente nascosta (`.sr`), virgoletta «“» `--coral` decorativa (`aria-hidden`), testo in Fraunces 19 px `--title`, campo senza bordo che cresce con il testo; segnaposto «Una frase da ricordare».
- `#f-notes`: etichetta visibile «Le tue note» (oggi «Note»), carta a righe (righe `--rule` ogni 28 px, testo `--ink`); segnaposto «Cosa ti è rimasto di questo libro?».

## 6. Prossimo della serie
Markup e comportamento di `snextHTML` invariati (`.snext`, `[data-next-open]`, `[data-wish-next]` con `aria-label`, ≥ 44 px). Cambia solo lo stile: etichetta «Prossimo della serie» in sentence case (non più maiuscolo), titolo in Fraunces come oggi. Il dorso in miniatura del prototipo non si fa (fuori ambito).

## 7. Colophon

`<section class="colo" id="s-colo">` con filo `--rule` sopra, testo centrato 14 px `--muted`, numeri in grassetto `--ink`:

**Dati** (`#s-colo-facts`), una riga per ogni dato presente, in quest'ordine:
- «Pubblicato nel **2016**» (`#d-year`)
- «**369** pagine, spionaggio» (`#d-pages`, `#d-genre` in minuscolo); solo pagine: «**369** pagine»; solo genere: «Spionaggio»
- «Segnatura **823.92 HER**» (`#d-call`, carattere `--mono`)
- «ISBN **9788834746219**» (`b.isbn`)
- nessun dato: «Nessun dato del libro: aggiungili con «Modifica i dati del libro».»

**Chiusa** (`#s-colo-fin`), Fraunces 16 px `--title`, due righe:

| Stato selezionato (`#f-status`; per un Desiderato, che non lo ha, `b.status`) | Prima riga |
|---|---|
| Letto con F | «Finito di leggere nel mese di gennaio 2025» |
| Letto con Y senza F | «Finito di leggere nel 2019» |
| Letto senza F né Y | «Finito di leggere (data da aggiungere)» |
| In lettura con S | «In lettura dal mese di ottobre 2026» |
| In lettura senza S | «In lettura» |
| Da leggere | «In attesa di essere letto» |
| Desiderato | «Nella lista dei desideri» |

Seconda riga sempre «nella libreria di Diego».

`syncColophon(sheet, b)` riscrive dati e chiusa (con `textContent`) dagli stessi eventi di `syncPeriod` (le due funzioni si chiamano insieme).

Sotto la chiusa, nell'ordine:
- `.refresh`: «Aggiorna informazioni» (`#s-refresh`) e `#s-ref-status`, comportamento invariato; i testi che oggi citano «Modifica dati» diventano «Modifica i dati del libro» («… Prova a correggere titolo o autore in Modifica i dati del libro.», «… scrivila in Modifica i dati del libro).», e in `#cv-status` «… correggere titolo o autore in Modifica i dati del libro.»).
- `<details class="edit">` con `<summary>Modifica i dati del libro</summary>` (stile link corallo centrato, ≥ 44 px), chiuso all'apertura (anche In lettura: il prototipo lo apriva, qui si sceglie chiuso per uniformità), contenuto invariato: `searchBlock`, `dataFields` (`#d-title`, `#d-author`, `#d-series`, `#d-series-no`, `#series-list`, `#d-year`, `#d-pages`, `#d-genre`, `#d-call`), `#cv-clear`. «Aggiorna informazioni» lo apre ancora da solo quando cambia un dato.

## 8. Sullo scaffale
`<section class="looks">` con `<h3>Sullo scaffale</h3>` e due colonne:
- sinistra: anteprima della copertina (`coverHTML(b)` con classe `looks-cover`) e `#cv-more` «Altra copertina» (dopo la prima ricerca «Cerca di nuovo», come oggi);
- destra: `#sp-prev` (dorso), `label.btn[for=sp-file]` «Fotografa il dorso» o «Cambia foto del dorso», `#sp-file` nascosto, `#sp-rot` «Ruota» e `#sp-del` «Rimuovi» **nascosti** (non più solo disattivati) quando non c'è la foto;
- sotto, a tutta larghezza: `#cv-status`, `#cv-picks`, il suggerimento di oggi sulla foto del dorso.

Ogni punto del codice che oggi ridisegna `.sheet-top .cover` (scelta della copertina, `#cv-clear`, `fillData`, «Aggiorna informazioni») ridisegna anche `.looks-cover`, con un'unica funzione `coverSync(sheet, b)`.

## 9. Id e comportamenti da conservare

- Campi e avvisi: `#f-status`, `.seg [data-v]` (`role="radio"`, `aria-checked`), `#f-rate` / `.rate button[data-n]`, `#f-started`, `#f-finished` (con `data-auto`, `disabled`, `min`/`max`, `dataset.ok`), `#f-date-err` (`role="alert"`), `#f-date-est`, `#f-year-row`, `#f-year`, `#f-year-err`, `#f-page` (`readonly` per i Letti), `#f-notes`, `#f-quote`, `#s-stale`.
- Dati: `details.edit` e il suo `summary`, `#s-q`, `#s-go`, `#s-status`, `#s-results`, `#s-title`, `#d-*`, `#series-list`, `#cv-clear`.
- Scheda: `.sheet-top` (con `.cover`, `.sub`, `button[data-series]`), una sola `h2`, `#s-syn`, `.snext`, `[data-next-open]`, `[data-wish-next]`, `.refresh`, `#s-refresh`, `#s-ref-status`, `#cv-more`, `#cv-status`, `#cv-picks`, `#sp-prev`, `#sp-file`, `#sp-rot`, `#sp-del`, `.wish-box`, `#s-bought`, `#s-save`, `#s-close`, `#s-del` (conferma in due tocchi).
- Comportamenti: `guardSheet` (le nuove `input` come `#f-range` entrano nell'istantanea, coerenti con `#f-page`), Salva / Scarta / Continua, Esc e tocco sullo sfondo, `readReading`/`readData` invariati, serie arrivata in sottofondo a scheda aperta (`SER`), «Ho acquistato», aggiunta del seguito ai desideri con Annulla, chiusura con ritorno del focus.

### Rischi di regressione

| Rischio | Contromisura |
|---|---|
| Playwright `fill` su un campo nascosto fallisce | Le clausole di inizio sono visibili per Letto e In lettura (tutti i test che scrivono date usano questi stati); l'`opacity: 0` per Playwright è «visibile». `#f-page` e `#f-finished` si leggono anche nascosti (`inputValue`, `isDisabled`, `getAttribute`) |
| Due `h2` → `.sheet h2` ambiguo in `test/serie.mjs` | Titoli di sezione in `h3` |
| Ricreare i campi data perde `dataset.ok`/`auto` e il focus | `syncPeriod` cambia solo testi e `hidden` |
| iOS ingrandisce la pagina toccando un campo < 16 px | Campi data trasparenti a 16 px |
| Chrome non apre il calendario dal clic sul campo trasparente | `showPicker()` al clic e a Invio/Spazio |
| `.unsaved` finisce dietro la barra fissa | `.unsaved` anch'essa `sticky` in `.sheet.book` |
| Stili nuovi che cambiano le altre schede | Tutto sotto `.sheet.book` o `.rf` |
| Scorrimento orizzontale a 390 px | Frase con `flex-wrap`, date `white-space: nowrap`, controllo nei test di interfaccia |
| Date importate «avvelenate» nella frase | Frase scritta con `textContent`; `clean()` invariato |

## 10. Prestazioni e peso
- Nessun `render()` in più: la scheda si costruisce una volta; `syncPeriod`/`syncColophon` aggiornano pochi nodi di testo per evento. Un solo `Intl.DateTimeFormat` riusato.
- Peso stimato (non compresso): CSS ~4 KB nuovi meno ~0,4 KB tolti (`.kv`, parte di `.cover-edit`/`.spine-edit`, `.sheet` a 460 px); JS ~3,5 KB (`periodText`, `readingPace`, `paceText`, `syncPeriod`, `syncColophon`, `coverSync`, controlli della pagina, `showPicker`, verdetti). Compressi circa 2,5 KB in tutto. Nessun font, immagine o libreria nuovi.

## 11. Accessibilità
- **Date a frase**: parole e testi visibili `aria-hidden`; i campi data hanno `aria-label` «Iniziato il» / «Finito il» e VoiceOver legge il loro valore nativo; la frase intera è in `#f-period-sr` (nascosta alla vista, letta nell'ordine); `aria-invalid` come oggi; gli avvisi restano `role="alert"` (`#f-date-err`, `#f-year-err`).
- **Selettore nascosto**: il bersaglio è l'intera parola sottolineata (≥ 44 px di altezza); contorno di focus visibile su `.dt:focus-within`; con la tastiera Tab arriva al campo e Invio/Spazio apre il calendario.
- **Ritmo e verdetto**: `#f-psub` è testo semplice; `#f-verdict` `aria-live="polite"` annuncia il voto scelto.
- **Contrasto ≥ 4,5:1** in chiaro e in scuro: testi con `--ink`, `--muted`, `--title`, `--accent` su `--surface` (già controllati dall'hook `contrasto.mjs`); `--coral` solo decorativo (sottolineature, linea della voce scelta, virgoletta, segnalibro, binario); la data con problema è segnalata anche dalla forma (ondulata) e dal testo dell'avviso, non solo dal colore.
- **Bersagli 44 px**: ✕, voci di stato, stelle, date, +10, +N, cursore (altezza 44), «Modifica i dati del libro», pulsante serie, «Altra copertina», «Fotografa il dorso», Elimina, Salva.
- **Movimento ridotto**: la linea della voce di stato non scorre (`transition: none`), le animazioni di apertura restano azzerate come oggi; nessuna animazione nuova.

## 12. Test (`test/`)

### Restano invariati
`schede.mjs` (date coerenti, fine stimata e spostata, pagina dei Letti, segnale «da aggiornare»), `statistiche.mjs` (anno nella scheda: `#f-year-row` visibile all'apertura di un Letto senza data), `sicurezza.mjs`, `sincronizzazione.mjs`, `funzioni.mjs` (`details.edit summary`, `#d-title`, `#s-del`), `ricerche.mjs`, `isbn*.mjs`, `serie.mjs` tranne il punto sotto.

### Cambia
- `test/serie.mjs` (riga «Prossimo della serie» prima di «Aggiorna informazioni»): oggi controlla `.snext` seguita subito da `.refresh`; diventa «`.snext` viene prima di `#s-colo` e dopo `#s-syn-b`» (`compareDocumentPosition`).

### Da aggiungere (nuovo gruppo `frontespizio`, in `test/frontespizio.mjs`, registrato in `run.mjs`; orologio fissato con `page.clock` al 2026-10-29 12:00)
- **Frasi delle date** (testo visibile di `.pline` e di `#f-period-sr`): L1 stesso anno «Letto dal 10 marzo al 2 aprile 2025» e «24 giorni»; L1 anni diversi «Letto dal 10 dicembre 2024 al 2 gennaio 2025»; L2; L3 con `#s-stale`; L4; L5 «Letto nel 2019.»; R1 «In lettura dal 12 ottobre 2026»; R2 «scegli la data»; Da leggere «Ancora da iniziare.»; date storte con `#s-stale` e Salva bloccato.
- **Frase dal vivo**: `fill('#f-finished', …)` cambia la frase da L3 a L1 e nasconde `#f-year-row`; `fill('#f-started', …)` su un Letto senza fine mostra la fine stimata nella frase e `#f-date-est`; cambio di stato con `.seg` passa da L1 a R1 e mostra `#f-pend-hint`.
- **Selettore nascosto**: `#f-started` ha `opacity` 0, la sua `.dt` è alta ≥ 44 px, un clic chiama `showPicker` (finto `HTMLInputElement.prototype.showPicker` che conta le chiamate).
- **Ritmo, funzione pura** (`window.libreriaScheda.pace`/`paceText`): l'esempio di §4.1 (eta 2026-11-23 e testo esatto); `today`; `no-start`; `no-pages`; `no-page`; `done`; `odd` per `perDay` > 300, `perDay` < 1, `day` > 730 ed eta oltre 365 giorni; data con l'anno quando cade nel 2027; «domani»; «1 pagina» al singolare.
- **Ritmo nell'interfaccia**: libro In lettura 2026-10-12, 142 di 337 → `#f-psub` con «23 novembre»; dopo `#f-p10` la stima cambia; svuotando `#d-pages` compare il testo `no-pages`; nessun salvataggio senza Salva.
- **Pagina**: `#f-range` muove `#f-page`; `#f-pstep` nascosto senza `pageStep`; limiti al totale; chiusura con Esc dopo +10 → «Hai modifiche non salvate».
- **Colophon**: righe esatte per un Letto completo («Pubblicato nel 2016», «369 pagine, spionaggio», «Segnatura 823.92 HER», «ISBN …», «Finito di leggere nel mese di gennaio 2025», «nella libreria di Diego»); per Y, In lettura, Da leggere, Desiderato; libro senza dati; aggiornamento dopo `fill('#d-pages')`.
- **«Modifica i dati del libro»**: testo del `summary`, chiuso all'apertura, i campi `#d-*` dentro; «Aggiorna informazioni» con dati nuovi lo apre.
- **Struttura**: ordine dei blocchi per Letto, In lettura, Da leggere, Desiderato (`compareDocumentPosition`); una sola `h2`; Ruota/Rimuovi nascosti senza foto; `#s-close` è la ✕.
- **Computer 1366×860**: pannello largo ≥ 700 px; `h2` a sinistra di `.seg` (bounding box); frontespizio ancora visibile dopo aver scorso `.sheet` in fondo; niente scorrimento orizzontale.
- **Interfaccia** (gruppo esistente): 390×844 e 1366×860, chiaro e scuro, nessun errore in console, screenshot della scheda di un Letto e di un In lettura.

## 13. File toccati e unione con le altre spec

| File | Cosa |
|---|---|
| `app.js` | `openSheet` (parametro `cls`), `readingFields` → `readingHead` + `readingMemo`, `wireRating` (verdetto, `syncPeriod` al cambio di stato), `wireDates` (solo la chiamata a `syncPeriod` in coda al `change`), `syncPage` (blocco pagina), `snextHTML` (nessuna modifica di markup), `openBook` (markup e collegamenti riscritti), `openAdd` (solo la riga che usava `readingFields`), nuove `periodText`, `readingPace`, `paceText`, `syncPeriod`, `syncColophon`, `coverSync`, `wireDateSlots` (showPicker), `wirePageCtl`; riga `window.libreriaScheda` subito dopo `openBook` (non in fondo al file, dove le altre spec aggiungono le loro). |
| `style.css` | Un solo blocco nuovo in fondo, intitolato `/* Scheda del libro: frontespizio */`, con tutte le regole `.sheet.book …` e `.rf …` e la `@media (min-width: 1024px)` delle due colonne. Ritocchi puntuali alle righe esistenti: via `.kv`/`.kv .callno`, `.sheet-top` (griglia 96 px → colonna centrata, solo dentro `.sheet.book`), `.snext .lab` (niente maiuscolo), la larghezza di `.sheet` nella `@media (min-width: 1024px)` resta 460 px per le altre schede. |
| `sw.js` | `VERSION` alla prima libera al momento dell'unione (oggi v72 → v73, se le altre spec non sono già state unite). |
| `test/` | `frontespizio.mjs` nuovo, `run.mjs` (gruppo), `serie.mjs` (un controllo). |
| `CLAUDE.md` | Riga della storia e aggiornamento della descrizione della scheda (con `/pubblica`). |

Spec parallele sugli stessi file: **Statistiche** (`computeStats`, `renderStats`, `openStory`, blocchi CSS `.stats*`, `.story*`) e **«Cosa leggo adesso?»** (`nextBooks`, `renderNext`, `renderHero`, scheda «Scegli per me», blocchi CSS `.next*`, `.hero*`). Questa spec non tocca quelle funzioni né quei blocchi; l'unico punto condiviso è `openSheet`, dove si aggiunge solo un parametro facoltativo (chiamate esistenti invariate). Se anche un'altra spec cambia `openSheet`, unire a mano tenendo entrambe le aggiunte.

## 14. Fuori ambito
- Ritmo di lettura nell'hero e nelle Statistiche.
- Il timbro della proposta B per la data di fine; il colore della sovracoperta e le schede della proposta C.
- Frontespizio e colophon in Nuovo libro (prende solo i blocchi lettura).
- Dorso in miniatura nella riga «Prossimo della serie».
- Campo ISBN modificabile a mano; riordino dei blocchi dal vivo quando si cambia stato.
- Salvataggio immediato di +10/+N/cursore dentro la scheda (resta con Salva).
- Cambi a `serLabel` e alle regole di date, anno, pagina, serie.

## 15. Scelte da confermare con Diego
1. Pulsante serie con il testo di oggi «Slough House · 3» (non «Slough House, volume 3»).
2. Date parziali dei Letti come «Iniziato il [scegli la data] e finito il [2 gennaio 2025]»; con solo l'anno, prima riga «Letto nel 2019.».
3. Da leggere: «Ancora da iniziare.» senza date visibili (i valori restano salvati).
4. Verdetti del voto (da «Non mi è piaciuto» a «Lo rileggerei»).
5. Ritmo: «18º giorno di lettura» (giorni inclusi) e i limiti 1–300 pagine al giorno, stima entro 365 giorni, inizio entro 730 giorni.
6. Computer: pannello da 760 px a due colonne con il frontespizio fisso a sinistra.
7. Colophon: «Pubblicato nel …» per l'anno e «nella libreria di Diego».
8. Nuovo libro con il nuovo blocco lettura (frase delle date, stato, voto).
9. ✕ in alto al posto del pulsante «Chiudi» in fondo; «Modifica i dati del libro» chiuso anche per i libri In lettura.

Domande aperte: nessuna che blocchi il piano; le nove scelte sopra si possono cambiare senza toccare la struttura.
