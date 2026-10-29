# «Cosa leggo adesso?» come scheda del catalogo — design

Data: 2026-10-29 · Stato: **approvata da Diego il 2026-10-29** · Percorso Superpowers: spec → piano → esecuzione
Riferimenti: proposta `design/proposte/prossimo.md` (variante **B**), prototipo `design/proposte/prossimo.html`, screenshot `design/proposte/img/prossimo-B*.png` (compresi `prossimo-B-inizia*.png` e `prossimo-B-nonora*.png`, approvati da Diego). Spec originale della funzione: `2026-10-27-tre-funzioni-design.md`, sezione 3.

## Obiettivo

Oggi «Cosa leggo adesso?» mostra tre righe uguali, ognuna con il suo «Inizia» corallo, e le etichette sono in MAIUSCOLO corallo (circa 435 px sul telefono). La nuova versione mostra **una proposta alla volta**, scritta su una scheda da biblioteca. I criteri diventano tre linguette in alto, come le schede guida di un cassetto. C'è un solo «Inizia», e «Inizia» e «Non ora» si possono annullare.

Criteri di riuscita:
- Sul telefono (390 px) la sezione è alta circa 365 px, contro i 435 di oggi, ed è l'unico punto dell'hero con un pulsante corallo.
- Si passa da una proposta all'altra toccando le linguette, con le frecce della tastiera e scorrendo di lato sulla scheda. Lo scorrimento verticale della pagina non viene mai bloccato.
- Dopo «Inizia» compare l'avviso «In lettura: «*Titolo*» · Annulla». Annulla riporta il libro esattamente com'era prima.
- Dopo «Non ora» compare l'avviso «Proposte nascoste · Annulla». Annulla fa ricomparire le proposte, con la stessa linguetta di prima.
- Lo stesso componente si usa nell'hero e nella scheda «Scegli per me».
- `nextBooks` non cambia. Si aggiungono meno di 3 KB di codice e stile (vedi «Peso»), nessun font e nessuna libreria.
- I test esistenti passano con gli adattamenti elencati qui sotto, a 390×844 e 1366×860, in chiaro e in scuro, senza errori in console e senza scorrimento orizzontale.

## Decisioni prese con Diego

| Domanda | Scelta |
|---|---|
| Quale variante | **B · La scheda del catalogo** (non A «Sfilati dallo scaffale» né C «La pila sul comodino») |
| Quante proposte si vedono insieme | Una alla volta. Le altre si raggiungono dalle linguette |
| Come si sfoglia | Linguette, frecce, scorrimento laterale sulla scheda |
| Pulsanti | Un solo «Inizia», per la proposta visibile; «Altre proposte»; «Non ora» («Chiudi» nella scheda «Scegli per me») |
| Annulla dopo «Inizia» | Sì: avviso «In lettura: *Titolo* · Annulla», che ripristina esattamente i campi di prima |
| Annulla dopo «Non ora» | Sì: avviso «Proposte nascoste · Annulla» |
| Durata degli avvisi | Come gli altri avvisi con azione (`toast` con `action`: 10 s) |
| Dove vale | Nell'hero e in «Scegli per me» |
| Logica di scelta | `nextBooks` invariata |

## Interfaccia

### Telefono (sotto 1024 px)
Dall'alto verso il basso, come in `prossimo-B.png`:

1. **Titolo** «Cosa leggo adesso?». È `h3` nell'hero e `h2` nella scheda, Fraunces 21 px, colore `--title`. Il riquadro `--surface` con il bordo che c'è oggi non c'è più: titolo e cassetto stanno direttamente sullo sfondo della pagina.
2. **Linguette** (`.ntabs`): una per proposta, in una griglia di colonne uguali, larga quanto la scheda (con 6 px di rientro ai lati). La linguetta attiva ha il colore della carta (`--paper`) e il testo `--title`, ed è 6 px più alta delle altre. Le altre hanno `--paper-off` e il testo `--ink`. Corpo 13,5 px, almeno 44 px di altezza, angoli in alto di 12 px.
3. **Scheda** (`.ncard`): è il pannello della linguetta attiva. Ha il fondo `--paper`, righe orizzontali sottili `--paper-line` ogni 26 px (a partire da 44 px dall'alto), un'ombra leggera e un foro in basso al centro (12 px, del colore dello sfondo che c'è dietro). Contiene:
   - la **testata**: a sinistra la segnatura `callNo` in `--mono` 13 px colore `--ink`; a destra «1 di 3» in 12,5 px `--muted`. Sotto la testata c'è un filetto corallo di 1,5 px (`--coral`, solo decorativo);
   - il **corpo**, su due colonne (testo | copertina di 58 px):
     - il **titolo** in Fraunces 22 px `--title`. Può andare su più righe e non viene troncato;
     - l'**autore** in 14 px `--ink`;
     - la **copertina** a destra, larga 58 px, fatta con `coverHTML(b, 120)` senza testi sovrapposti;
     - il **motivo** («penna rossa»), a tutta larghezza: Fraunces corsivo 16 px, colore `--accent`, con il punto finale aggiunto da `::after`;
     - la riga **dettagli** a tutta larghezza in 13 px `--muted`: «*Serie · N* · *P* pagine · *Genere*». Ogni parte compare solo se c'è. Se non c'è nessuna delle tre, la riga non c'è.
4. **Le altre schede dietro**: sotto la scheda si vedono due bordi di carta (`::before`/`::after` del cassetto, `--paper-off`). Solo con 2 o più proposte.
5. **Pulsanti** (`.nfoot`), su una riga a griglia `1fr auto auto`: **Inizia** (`btn primary`, l'unico corallo), **Altre proposte** (`btn`), **Non ora** (`btn ghost`). Tutti alti almeno 44 px.

### Computer (da 1024 px)
- Il componente è lo stesso. Cassetto e pulsanti stanno in una colonna larga al massimo **600 px**, allineata a sinistra nell'hero. Al posto della griglia a tre colonne di oggi (`.hero .next .nlist`) c'è una sola scheda: su un monitor largo, una scheda di 1100 px con un titolo di due parole sembrerebbe vuota.
- Nella scheda «Scegli per me» (larga al massimo 560 px) il componente occupa tutta la larghezza.

### Testi esatti
| Elemento | Testo |
|---|---|
| Titolo | «Cosa leggo adesso?» |
| Linguetta `kind: "affine"` | «Affine» |
| Linguetta `kind: "vecchio"` | «Il più vecchio» |
| Linguetta `kind: "caso"` (prima) | «A caso» |
| Linguetta `kind: "caso"` (seconda, se `nextBooks` ne restituisce due) | «Ancora a caso» |
| Contatore | «*i* di *n*» (es. «2 di 3») |
| Motivo | il `reason` di `nextBooks`, invariato, più «.» aggiunto via CSS |
| Dettagli | `serLabel(b)`, «*P* pagine», `genre`, uniti da « · » |
| Pulsanti hero | «Inizia» · «Altre proposte» · «Non ora» |
| Pulsanti scheda | «Inizia» · «Altre proposte» · «Chiudi» |
| Avviso dopo Inizia | «In lettura: «*Titolo*»» + pulsante «Annulla» (titolo tagliato a 40 caratteri con «…») |
| Avviso dopo Non ora | «Proposte nascoste» + pulsante «Annulla» |
| Annulla non applicabile | «Non annullato: «*Titolo*» è cambiato nel frattempo» (senza azione) |

`nextBooks` può restituire queste combinazioni di `kind`: `affine, vecchio, caso`; `vecchio, caso, caso` (senza affine); `affine, vecchio`; `vecchio, caso`; `affine`; `vecchio`. Per questo serve «Ancora a caso». Le etichette vengono da `kind`, mai dal testo di `reason`.

### Comportamento delle linguette
- **Ruoli ARIA: `tablist` / `tab` / `tabpanel`**, non `radiogroup`. Il gesto *mostra* un contenuto diverso e non sceglie un valore da confermare: è proprio il caso d'uso delle schede. La metafora visiva è quella delle schede guida, VoiceOver annuncia «Affine, scheda, selezionata, 1 di 3», e il contatore visivo ripete la stessa informazione. Con un `radiogroup` VoiceOver direbbe «pulsante di scelta», che fa pensare a una scelta da salvare, e il pannello del dettaglio non avrebbe un ruolo che lo leghi al criterio.
- **Attivazione automatica**: la scheda cambia appena la linguetta riceve il focus con le frecce. Il pannello cambia senza caricare nulla, quindi non serve aspettare Invio.
- **Tastiera**: ←/→ passano alla linguetta precedente o successiva, e dall'ultima si torna alla prima (come nel prototipo); Home e Fine vanno alla prima e all'ultima. Le linguette hanno un `tabindex` mobile: solo quella attiva ha `tabindex="0"`. Il pannello ha `tabindex="0"` perché non contiene elementi focalizzabili (indicazione APG).
- Cambiare linguetta aggiorna `data-start` e `aria-label` di «Inizia» («Inizia *titolo*») e ricorda la scelta (vedi «Stato»). Non ridisegna l'hero: si cambiano solo gli attributi `hidden`, `aria-selected`, `tabindex` e la classe dell'animazione.
- **Animazione** al cambio: la scheda che compare entra con `flip` (.35 s, da `translateY(-10px) rotate(-.6deg)` e opacità .2). Con `prefers-reduced-motion: reduce` non c'è animazione.

### Scorrimento laterale
- Si ascolta sulla pila delle schede (`.nstack`), con Pointer Events e solo per `pointerType` `touch` o `pen`. Sul computer si usano linguette e frecce: trascinare con il mouse non fa nulla, così si evitano cambi per sbaglio.
- La pila ha `touch-action: pan-y` (in più `user-select: none`). Il browser continua a gestire lo scorrimento verticale e lo zoom. Se il gesto diventa verticale, il browser manda `pointercancel` e il gesto viene ignorato. Non si chiama mai `preventDefault` sugli eventi di tocco, quindi lo scorrimento della pagina e della scheda (`.sheet`, che ha già `touch-action: pan-y pinch-zoom`) non viene mai bloccato.
- Si conta come scorrimento se, tra `pointerdown` e `pointerup` dello stesso `pointerId`, **|dx| ≥ 48 px e |dx| ≥ 2·|dy|**. Verso sinistra si passa alla linguetta successiva, verso destra alla precedente (anche qui dall'ultima si torna alla prima). Il focus non si sposta; l'animazione è la stessa del tocco sulla linguetta.
- Un gesto che inizia a meno di 24 px dal bordo sinistro o destro dello schermo si ignora, perché in Safari il bordo serve per tornare indietro.
- Con una sola proposta lo scorrimento non fa nulla.

### Casi particolari
- **3 proposte**: tre linguette, «*i* di 3».
- **2 proposte**: due linguette, a metà larghezza ciascuna; «*i* di 2».
- **1 proposta**: niente linguette, niente contatore, niente schede dietro e niente scorrimento. La scheda resta con il ruolo `region` e l'etichetta «Proposta» (il `section` ha già il titolo). Gli altri pulsanti restano come sono: «Altre proposte» compare solo se la pila ha più libri di quelli proposti, come oggi.
- **Pila vuota**: come oggi, l'hero non mostra niente e «Scegli per me» non c'è.
- **Dopo «Altre proposte»**: arriva il nuovo gruppo (`nextList(true)`, come oggi). È selezionata la prima linguetta, con una sola animazione d'ingresso. Il focus resta su «Altre proposte», come oggi. La regione nascosta `#n-live` (`.sr`, `aria-live="polite"`) annuncia «Nuove proposte: *Titolo 1*, *Titolo 2*, *Titolo 3*».
- **Libro senza copertina** (nessun `cover`, oppure immagine che non si carica): si usa la copertina disegnata da `coverHTML` nel colore del libro, senza titolo e autore sopra (come oggi `.ncard .cover .ct/.ca` nascosti), sempre 58 px. Le foto dei dorsi non si usano.
- **Senza `callNo`**: `clean()` lo ricava già dall'autore (`surname3`). Se non c'è nemmeno l'autore, nella testata a sinistra non c'è niente; restano il contatore e il filetto.
- **Senza autore**: la riga dell'autore non c'è.
- **Titolo modificato** (scheda del libro o cloud): come oggi `patchBook` → `renderHero`, perché ogni `[data-next]` resta nel DOM. La linguetta selezionata resta la stessa (vedi «Stato»).

## Struttura DOM

Si tengono **tre `.ncard[data-next]` nel DOM**, una per proposta, e le due non attive hanno `hidden`. Motivi:
- è la struttura naturale di `tablist`: un `tabpanel` per linguetta, collegati con `aria-controls`/`aria-labelledby`;
- i test e il codice che cercano `.ncard[data-next="…"]` continuano a funzionare: il conteggio a 3, `ids()`, «Altre proposte», «pila esaurita», `patchBook` (`#hero [data-next=id]`) e `refreshChanged`;
- le tre schede stanno nella stessa cella di una griglia (`.nstack`). Quelle nascoste sono `[hidden]` ma con `display: block; visibility: hidden`, così l'altezza del cassetto è quella della scheda più alta e i pulsanti non saltano quando si cambia linguetta. `visibility: hidden` le toglie dall'albero dell'accessibilità e dal focus, e Playwright le vede come non visibili.

```html
<section class="next">
  <h3>Cosa leggo adesso?</h3>                                   <!-- h2 nella scheda -->
  <div class="drawer">
    <div class="ntabs" role="tablist" aria-label="Criteri della proposta">
      <button class="ntab" type="button" role="tab" id="nh-t0" aria-controls="nh-p0"
              aria-selected="true" tabindex="0" data-tab="ID">Affine</button>
      … (una per proposta)
    </div>
    <div class="nstack">
      <div class="ncard" data-next="ID" role="tabpanel" id="nh-p0" aria-labelledby="nh-t0" tabindex="0">
        <div class="nhead"><span class="call"><span class="sr">Segnatura </span>823.92 HER</span><span class="n" aria-hidden="true">1 di 3</span></div>
        <div class="nbody">
          <div><b>Titolo</b><span class="au">Autore</span></div>
          <!-- coverHTML(b, 120) -->
          <span class="why">Motivo</span>
          <span class="meta">Serie · N · 344 pagine · Genere</span>
        </div>
        <span class="hole" aria-hidden="true"></span>
      </div>
      <div class="ncard" data-next="ID2" role="tabpanel" id="nh-p1" aria-labelledby="nh-t1" tabindex="0" hidden>…</div>
      …
    </div>
  </div>
  <div class="nfoot">
    <button class="btn primary" type="button" data-start="ID" aria-label="Inizia Titolo">Inizia</button>
    <button class="btn" type="button" data-n="more" id="n-more">Altre proposte</button>   <!-- id solo nell'hero -->
    <button class="btn ghost" type="button" data-n="later" id="n-later">Non ora</button>  <!-- «Chiudi» nella scheda -->
  </div>
</section>
```

- Prefisso degli id: `nh-` nell'hero e `ns-` nella scheda. Hero e «Scegli per me» possono essere aperti insieme, e gli id devono restare unici.
- Il contatore è `aria-hidden` perché VoiceOver dice già «1 di 3» sulla linguetta. La parola «Segnatura» è nascosta alla vista (`.sr`), perché `aria-label` su uno `span` non viene letto in modo affidabile.
- Con una sola proposta: niente `.ntabs`; la `.ncard` ha `role="region"` e `aria-label="Proposta"`, senza `tabindex` e senza contatore.

**Selettori che restano** (usati dai test o dal codice): `#hero .next`, `.sheet .next`, `.ncard[data-next]` (sempre una per proposta), `.ncard .why` (testo = `reason` esatto, senza punto), `.ncard b` (titolo), `[data-start]` (ora uno solo, nella `.nfoot`), `[data-n=more]`, `[data-n=later]`, `#n-more`, `#n-later`, `[data-choose]`.
**Selettori nuovi**: `.drawer`, `.ntabs`, `.ntab[role=tab]`, `.nstack`, `.nhead`, `.call`, `.nbody`, `.au`, `.hole`, `#n-live`.
**Selettori tolti**: `.nlist`. La `.ncard` cambia struttura interna: non è più la griglia `52px 1fr auto` e non contiene più `[data-start]`.

## Stato e codice (`app.js`)

- `nx` (oggi `{ ex, list, off }`) diventa `{ ex, list, off, sel }`, dove `sel` è l'**id** del libro della linguetta attiva nell'hero, non la sua posizione. Così la scelta resta dopo un `renderHero` per un titolo cambiato, dopo l'Annulla di «Inizia» e dopo l'Annulla di «Non ora». Se `sel` non è tra le proposte di `nx.list`, si mostra la prima. `nextList(true)` («Altre proposte») azzera `sel`.
- La scheda «Scegli per me» ha la sua selezione locale (una variabile chiusa in `fillNext`) e parte sempre dalla prima linguetta: non sposta la scelta dell'hero.
- `nextHTML(list, h, sel)`: riscritta con la struttura qui sopra. Prefisso degli id: `h === "h3"` → `nh-`, altrimenti `ns-`.
- `wireNext(root, sheet)`: riscritta. Collega linguette (clic, frecce, Home/Fine), scorrimento, «Inizia», «Altre proposte», «Non ora»/«Chiudi». Una funzione interna `pick(id, anim)` cambia gli attributi senza ridisegnare.
- `startNext(id, sheet)` (nuova, accanto a `fillNext`): vedi «Annulla dopo Inizia».
- `toast(msg, action, opts)`: nuova opzione `opts.focus`. Se è vera, il focus va sul pulsante dell'avviso. Quando l'avviso sparisce (per tempo scaduto) e il focus era lì, il focus passa al primo elemento focalizzabile di `#hero`; se l'hero è nascosto, al filtro attivo (`[data-filter][aria-pressed="true"]` visibile). Nient'altro cambia in `toast`.
- `nextBooks`, `nextList` (salvo `sel`), `renderHero`, `setStatus`, `upsert`, `refreshChanged` restano come sono.

## Annulla

### Dopo «Inizia»
`startNext(id, sheet)`:
1. Prende il libro attuale `b`. Se non è più `da-leggere`, chiama `renderHero()` e si ferma (come oggi).
2. Salva **prima del gesto** `before`, una copia dei campi che `setStatus`/«In lettura» possono toccare: `status`, `started`, `finished`, `finishedYear`, `finishedAuto`, `page`, `pageStep`. Per ogni campo si ricorda se c'era (un campo assente resta assente). Si ricorda anche `nx.sel`.
3. Se `sheet`: `closeSheet()`. Poi `setStatus(b, "in-lettura")`, invariata, che fa la sua `upsert` e il ridisegno di oggi (il libro cambia scaffale, quindi il ridisegno completo è ammesso).
4. Mostra `toast("In lettura: «Titolo»", { label: "Annulla", run: undo }, { focus: true })`. Questo avviso sostituisce «Spostato in In lettura» di `setStatus`, perché `toast` toglie sempre quello precedente.

`undo()`:
- Cerca il libro per `id`. **Si applica solo se il libro esiste ancora e ha `status === "in-lettura"`.** Se nel frattempo è stato eliminato, segnato come letto o rimesso in pila (dal telefono, dal cloud o da un altro dispositivo), non tocca nulla e mostra «Non annullato: «*Titolo*» è cambiato nel frattempo».
- Altrimenti rimette **esattamente** i campi di `before` (assegna quelli presenti e cancella quelli assenti) sul libro *attuale*. Gli altri campi cambiati nel frattempo (titolo, note, voto, anche arrivati dal cloud) restano. Il risultato passa da `clean()` e riceve `updated: Date.now()`, così vince sulla versione «in lettura» negli altri dispositivi.
- Poi `schedulePersist()` e `cloudHook("changed", id)`. Il ridisegno passa da `refreshChanged([{ id, from: "in-lettura", to: "da-leggere", moved: true }])`, che ridisegna solo l'hero, lo scaffale Da leggere, i conteggi e la colonna laterale (e fa `render()` solo nella vista Copertine o Statistiche, come già fa). Niente `render()` completo nella vista Dorsi.
- `nx.sel` torna all'id del libro, quindi l'hero mostra di nuovo le stesse proposte con la stessa linguetta: `nextList` tiene `nx.list` perché tutti i libri sono di nuovo in pila. Il focus va sulla linguetta selezionata dell'hero, se l'hero mostra le proposte.
- **Avviso scaduto** (10 s) o sostituito da un altro avviso (es. «Pagina N» della pagina rapida): l'Annulla non è più raggiungibile e il libro resta In lettura. Si comporta come la pagina rapida.
- Se la pagina rapida ha cambiato `page`/`pageStep` entro i 10 s e poi si tocca Annulla, anche quei due campi tornano come prima di «Inizia»: il libro torna in pila esattamente com'era.

### Dopo «Non ora» (solo hero)
- `nx.off = true; renderHero();` come oggi. Poi `toast("Proposte nascoste", { label: "Annulla", run }, { focus: true })`.
- `run`: `nx.off = false; renderHero();`. Il focus va sulla linguetta selezionata. `nx.sel` non è cambiato, quindi la linguetta è quella di prima. Se nel frattempo è iniziata una lettura, l'hero mostra la lettura e l'Annulla non ha effetti visibili: è corretto, perché le proposte compaiono solo senza letture in corso.
- Avviso scaduto: le proposte restano nascoste fino alla riapertura dell'app, come oggi.
- In «Scegli per me», «Chiudi» chiude la scheda senza avviso, come oggi.

### L'avviso e il pulsante «Aggiungi» (verifica nel CSS reale)
Misura fatta con Playwright sull'app attuale (v72), a 390×844: la barra in basso va da 777 a 844 (`--dock-h` = 67 px). Il cerchio di «Aggiungi» sporge fino a y = 772. Un `.toast` con «In lettura: Bad Actors · Annulla» va da 705 a 765. **Non tocca il cerchio** (restano 7 px), perché nell'app `bottom` è `--dock-h + 12px`, mentre nel prototipo era un valore fisso di 104 px. A 1366 px l'avviso è in basso a destra della colonna laterale (`bottom: 28px`), lontano dal pulsante.

La stessa misura ha mostrato due difetti reali dell'avviso, che questa spec corregge perché «Annulla» diventa importante:
1. **L'avviso va a capo troppo presto.** Con `left: 50%` e `transform`, la larghezza disponibile è solo metà dello schermo (195 px a 390): «In lettura: Bad Actors · Annulla» va su due righe ed è alto 60 px. Correzione: `.toast { width: max-content; }` (resta `max-width: calc(100% - 32px)`), così va a capo solo oltre 358 px.
2. **«Annulla» è un bersaglio di 20 px.** Correzione: `.toast { padding: 0 6px 0 16px; }` e `.toast button { min-height: 44px; padding: 0 10px; text-underline-offset: 3px; }`, come nel prototipo. Con l'avviso a una riga alto 44 px e `bottom` invariato, il bordo inferiore resta a `--dock-h + 12px`: lo spazio dal cerchio di «Aggiungi» (7 px) non cambia, e un avviso più alto cresce verso l'alto.

Anche gli avvisi della pagina rapida e del ripristino hanno lo stesso aspetto. È un miglioramento voluto: anche lì «Annulla» diventa da 44 px.

## Stile (`style.css`)

- **Token nuovi**: `--paper`, `--paper-off`, `--paper-line` in `:root` e nel blocco `@media (prefers-color-scheme: dark) { :root {…} }`, su una riga a parte alla fine di ciascun blocco, con il commento `/* scheda del catalogo */`, per facilitare l'unione con le altre spec.
  - Chiaro: `--paper: #FBFBF6; --paper-off: #DDE1D7; --paper-line: rgba(47, 84, 87, .10);`
  - Scuro: `--paper: #222B2C; --paper-off: #182021; --paper-line: rgba(244, 234, 216, .07);`
- **Blocco «Il prossimo libro»** (oggi le righe 589–601: `.next`, `.next h3`, `.nlist`, `.ncard…`, `.nfoot`, `.sheet .next`): si sostituisce per intero con le regole `.next`, `.drawer`, `.ntabs`, `.ntab`, `.nstack`, `.ncard`, `.nhead`, `.call`, `.n`, `.nbody`, `.au`, `.why`, `.meta`, `.hole`, `.nfoot`, `@keyframes nflip`, e con `@media (min-width: 1024px) { .hero .next { max-width: 600px; } }` e `@media (prefers-reduced-motion: reduce) { .ncard { animation: none; } }`.
- Il foro usa `background: var(--hole, var(--bg))`. In `.sheet .next` si imposta `--hole: var(--surface)`, così il foro ha il colore della scheda che gli sta dietro.
- **Corsivo del motivo**: Fraunces è scaricato solo in tondo (`opsz,wght@9..144,400..600`), quindi il corsivo è sintetizzato dal browser (obliquo). Scaricare il vero corsivo costerebbe circa 60 KB in più. Il prototipo approvato usa lo stesso obliquo sintetizzato, quindi non si aggiunge nulla.
- **Avviso**: le due righe `.toast`/`.toast button` (oggi 341–342) cambiano come descritto sopra.

## Prestazioni

- Cambiare linguetta o scorrere cambia solo attributi: nessun `innerHTML` e nessun `renderHero`.
- «Inizia»: ridisegno di oggi (`setStatus` → `upsert` → `render()`), ammesso perché il libro cambia scaffale. «Annulla» di Inizia: `refreshChanged` (ridisegno parziale). «Non ora» e il suo Annulla: solo `renderHero()`.
- Le tre `coverHTML` c'erano già: le immagini hanno già `loading="lazy"` e `thumb()`, quindi non si scaricano copertine in più rispetto a oggi.
- Un solo gestore `pointerdown/pointerup/pointercancel` per la pila delle schede, passivo, senza `pointermove`.

### Peso stimato
| Parte | Aggiunto | Tolto | Netto |
|---|---|---|---|
| `app.js` (`nextHTML`, `wireNext` con linguette e scorrimento, `startNext` con Annulla, opzione `focus` di `toast`, `#n-live`) | ~2,0 KB | ~0,9 KB (vecchi `nextHTML`/`wireNext`) | **~+1,1 KB** |
| `style.css` (cassetto, linguette, scheda, foro, animazione, token, avviso) | ~2,2 KB | ~1,3 KB (vecchio blocco `.next`/`.ncard`) | **~+0,9 KB** |
| Totale | | | **~+2 KB** non compressi, meno di 1 KB con gzip |

## Accessibilità

- **VoiceOver**: «Criteri della proposta», linguette «Affine, scheda, selezionata, 1 di 3». Il pannello legge «Segnatura 823.92 HER, *Titolo*, *Autore*, *Motivo*., *dettagli*» (la copertina ha `alt=""` e non viene letta). «Inizia» ha l'etichetta «Inizia *titolo*», aggiornata al cambio di linguetta. Gli avvisi sono `role="status"`, e con `focus: true` il pulsante Annulla riceve il focus, quindi si annulla con un doppio tocco. «Nuove proposte: …» viene annunciato in `#n-live`.
- **Contrasto** (calcolato con i colori dei token, minimo 4,5:1):

| Testo / fondo | Chiaro | Scuro |
|---|---|---|
| Motivo `--accent` su `--paper` | 5,79:1 | 4,77:1 |
| Dettagli e contatore `--muted` su `--paper` | 5,59:1 | 5,51:1 |
| Titolo `--title` su `--paper` | 8,01:1 | 12,14:1 |
| Autore e segnatura `--ink` su `--paper` | 14,29:1 | 11,70:1 |
| Linguetta non attiva `--ink` su `--paper-off` | 11,18:1 | 13,38:1 |
| Avviso `--bg` su `--ink` | 12,68:1 | 14,36:1 |

  Il filetto `--coral`, le righe, il foro e le schede dietro sono decorativi. L'hook `contrasto.mjs` non controlla i token `--paper*` (controlla solo `--bg`/`--surface`): sono coperti dal test nuovo (sotto).
- **Bersagli di 44 px**: linguette, «Inizia», «Altre proposte», «Non ora»/«Chiudi», «Annulla» dell'avviso (corretto, vedi sopra).
- **Movimento ridotto**: niente `flip` e nessun'altra transizione nel componente. Lo scorrimento laterale funziona lo stesso: cambia solo la scheda, senza animazione.
- Niente scorrimento orizzontale a 390 px: la pila ha `overflow: hidden` per l'animazione e le linguette sono in una griglia `minmax(0, 1fr)`.

## Test (`test/funzioni.mjs`, funzione del prossimo libro; `test/serie.mjs` senza modifiche)

### Restano uguali
`#hero .next` visibile con «Cosa leggo adesso?»; `.ncard` contate a 3 (anche quelle nascoste); i 44 px di `[data-start]` (ora uno solo), `#n-more` e `#n-later`; «Altre proposte cambia i libri»; «pila esaurita: si ricomincia»; filtri Letti / Da leggere; «Non ora nasconde la proposta»; «Scegli per me» a 44 px, con 3 `.ncard`; `button[data-start="${primo id}"]` nella scheda (la prima linguetta è quella attiva); Inizia → In lettura da oggi, scheda chiusa e `.rcard` nell'hero; un solo libro con `esc()`; pila vuota; il cambio dal cloud aggiorna le proposte (`innerText` di `#hero .next` contiene solo la scheda visibile: il libro `h2` è l'unico, quindi è visibile). `serie.mjs:685` legge `.why` con `textContent`, e il punto finale è solo in CSS, quindi il testo resta «Il #4 di Slough House, dopo il #3».

### Cambiano
- Riga 247: la prima `.ncard` contiene «Mick Herron» e «300 pagine» (non più «Mick Herron · 300 pp.»).
- Righe 253–254: il libro `n2` può stare su una linguetta non attiva, quindi il controllo usa `textContent` invece di `innerText` (una scheda con `visibility: hidden` ha `innerText` vuoto).

### Da aggiungere
1. **Linguette**: `role=tablist` con 3 `role=tab`, testi «Affine», «Il più vecchio», «A caso»; la prima ha `aria-selected="true"` e c'è una sola `.ncard` visibile. Un clic sulla seconda la mostra, e `[data-start]` e il suo `aria-label` diventano quelli del secondo libro. →, ←, Home e Fine spostano focus e selezione, dall'ultima si torna alla prima; il `tabindex` è mobile; `aria-controls` punta al pannello giusto.
2. **Combinazioni di `kind`**: senza libri letti (`vecchio, caso, caso`) la terza linguetta è «Ancora a caso»; con 2 libri in pila ci sono 2 linguette e «1 di 2»; con 1 libro non ci sono `[role=tablist]` né contatore.
3. **Scorrimento** (eventi `PointerEvent` con `pointerType: "touch"` creati nella pagina): 100 px a sinistra → linguetta successiva; 100 px a destra → precedente (dalla prima si va all'ultima); dx 60 e dy 80 → nessun cambio; `pointercancel` → nessun cambio; gesto che inizia a 10 px dal bordo → nessun cambio; `pointerType: "mouse"` → nessun cambio.
4. **Annulla di Inizia**: un libro in pila con `started: "2025-03-01"` e `page: 12` (e uno senza `started`). Inizia dalla seconda linguetta → avviso «In lettura: «…»» con «Annulla» a fuoco. Annulla → `status` torna `da-leggere`, `started`/`page`/`pageStep`/`finished*` sono quelli di prima (assenti se lo erano), `updated` è più alto, l'hero mostra di nuovo le proposte con la seconda linguetta attiva. Con la sincronizzazione attiva, la modifica arriva al cloud (`cloudHook`).
5. **Annulla dopo un cambio**: dopo Inizia, il libro passa a `letto` con `H.setLocal` + `refreshChanged`. Annulla → libro invariato e avviso «Non annullato: …».
6. **Annulla di Non ora**: «Non ora» → avviso «Proposte nascoste» con «Annulla» a fuoco; Annulla → `#hero .next` visibile, con la stessa linguetta di prima.
7. **Scegli per me**: la scheda ha la sua `tablist` con id `ns-*`, e nel documento non ci sono id duplicati mentre hero e scheda sono aperti insieme. Inizia dalla terza linguetta chiude la scheda, e il suo Annulla funziona. Cambiare linguetta nella scheda non cambia la linguetta attiva dell'hero.
8. **Avviso**: «Annulla» ≥ 44 px; a 390×844 l'avviso «In lettura: «Bad Actors»» sta su una riga e non tocca `.dock .tab.add .ico` (riquadri senza intersezione).
9. **Contrasto**: in chiaro e in scuro, `.why`, `.meta` e `.ntab` (non attiva) su `--paper`/`--paper-off` misurati con `getComputedStyle` ≥ 4,5:1.
10. Il gruppo `interfaccia` resta il controllo generale: 390×844 e 1366×860, chiaro e scuro, nessun errore e niente scorrimento orizzontale. Bisogna guardare gli screenshot del prossimo libro.

## File toccati e punti di unione

Altre due spec in parallelo (Statistiche, scheda del libro) toccano gli stessi file. Questa spec lavora **solo** in questi punti:

| File | Dove | Cosa |
|---|---|---|
| `app.js` | `toast()` (~riga 39) | solo il terzo parametro `opts.focus` e il ripristino del focus alla scadenza |
| `app.js` | `nx`, `nextList`, `nextHTML`, `wireNext`, `fillNext` (~righe 933–953) + nuova `startNext` subito dopo `fillNext` | componente, linguette, scorrimento, Annulla |
| `app.js` | nessun'altra funzione | `setStatus`, `upsert`, `renderHero`, `refreshChanged`, `patchBook`, `nextBooks`, `wireMain` (`[data-choose]`) restano invariate |
| `style.css` | token in `:root` e nel blocco scuro (righe nuove a parte, commento `/* scheda del catalogo */`) | `--paper`, `--paper-off`, `--paper-line` |
| `style.css` | `.toast`, `.toast button` (~341–342) | larghezza e bersaglio di 44 px |
| `style.css` | blocco `.next`/`.ncard` (~589–601) | sostituito per intero |
| `sw.js` | `VERSION` | +1 (chi unisce per ultimo la rialza oltre le altre) |
| `test/funzioni.mjs` | funzione del prossimo libro | adattamenti e test nuovi |
| `CLAUDE.md` | «Il prossimo libro (v56)» e «Storia del lavoro» | aggiornati da `/pubblica` |

Se un'altra spec cambia anche `toast()` o i token, conviene unire prima quella e poi aggiungere qui solo l'opzione `focus` e le tre righe dei token.

## Fuori ambito

- Qualsiasi cambio a `nextBooks` (criteri, ordine, testi dei motivi) e alle etichette dedotte dal `reason` (es. «Il seguito» per le serie: escluso da Diego).
- Aprire la scheda del libro toccando la scheda del catalogo o la copertina (oggi la `.ncard` non è toccabile).
- Pulsanti freccia visibili per sfogliare (si usano linguette, tastiera e scorrimento).
- «Non ora» che resta dopo la riapertura dell'app (resta solo in memoria, come oggi).
- Le varianti A e C, la scheda «In lettura» (v62) e gli altri avvisi oltre alla correzione di larghezza e bersaglio.
- Il controllo dei token `--paper*` nell'hook `contrasto.mjs` (eventuale proposta alla prossima verifica degli hook).

## Decisioni di Diego sulle domande aperte (2026-10-29)

1. Sul computer una sola scheda larga al massimo 600 px: sì.
2. Seconda proposta a caso chiamata «Ancora a caso»: sì.
3. Linguetta «Il seguito» per le serie: no, resta «Affine»; il motivo in rosso dice già «Il #4 di Slough House…» e `nextBooks` non si tocca.
4. Dopo «Inizia» e «Non ora» il focus passa ad «Annulla» nell'avviso: sì.
