# «Cosa leggo adesso?» come scheda del catalogo — piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire le tre righe di «Cosa leggo adesso?» con una scheda del catalogo (una proposta alla volta, linguette per criterio, scorrimento laterale) e rendere annullabili «Inizia» e «Non ora».

**Architecture:** Tutto in `app.js` (`toast`, blocco `nx`/`nextList`/`nextHTML`/`wireNext`/`fillNext` + nuova `startNext`) e `style.css` (token `--paper*`, `.toast`, blocco «Il prossimo libro»). Le tre proposte restano tre `.ncard[data-next]` nel DOM (le non attive con `hidden`), collegate a una `tablist`; cambiare linguetta cambia solo attributi. `nextBooks` non cambia. Test end-to-end con Playwright in `test/funzioni.mjs`, funzione `prossimo`.

**Tech Stack:** JavaScript puro, CSS, Pointer Events, Playwright (Chromium) per i test.

**Spec:** `docs/superpowers/specs/2026-10-29-prossimo-catalogo-design.md` (con le decisioni di Diego in fondo: 600 px su computer, «Ancora a caso», niente «Il seguito», focus su «Annulla»). Prototipo: `design/proposte/prossimo.html`, variante B (regole `.vb …`, righe 176–198); screenshot di riferimento `design/proposte/img/prossimo-B*.png`.

## Global Constraints

- Lavoro con UN agente dedicato, in un git worktree separato creato dal branch `claude/youthful-ride-ha414a`, branch `impl/prossimo`. Commit solo su `impl/prossimo`, niente push.
- Due altri agenti lavorano in parallelo (Statistiche, scheda del libro) negli stessi `app.js` e `style.css`: si toccano SOLO i punti della tabella «File toccati» della spec — `toast()` (`app.js:39-46`), `nx`/`nextList`/`nextHTML`/`wireNext`/`fillNext` (`app.js:932-953`) più la nuova `startNext` subito dopo `fillNext`; in `style.css` una riga nuova di token alla fine di `:root` e del blocco scuro (commento `/* scheda del catalogo */`), `.toast`/`.toast button` (`style.css:341-342`), il blocco `.next`/`.ncard` (`style.css:589-601`). Niente riformattazioni né spostamenti di altro codice. `setStatus`, `upsert`, `renderHero`, `refreshChanged`, `patchBook`, `nextBooks`, `wireMain` restano invariate.
- NON modificare `VERSION` in `sw.js` né `CLAUDE.md` (li aggiorna Diego all'unione). Nessun altro file dell'app (niente `index.html`).
- Ogni compito: test che fallisce → codice → test che passa → commit in italiano sul branch del worktree. Comando di gruppo: `node test/run.mjs funzioni` (avvia da solo i server 8765/8766: nel worktree NON lanciare due gruppi contemporaneamente, nemmeno in sottofondo).
- Testi esatti (dalla spec): titolo «Cosa leggo adesso?» (`h3` nell'hero, `h2` nella scheda); linguette `affine` → «Affine», `vecchio` → «Il più vecchio», `caso` → «A caso» e la seconda `caso` → «Ancora a caso» (sempre da `kind`, mai da `reason`); contatore «*i* di *n*»; dettagli `serLabel(b)`, «*P* pagine», `genre` uniti da « · »; pulsanti «Inizia» · «Altre proposte» · «Non ora» (scheda: «Chiudi»); avvisi «In lettura: «*Titolo*»» (titolo oltre 40 caratteri tagliato a 40 con «…»), «Proposte nascoste», «Non annullato: «*Titolo*» è cambiato nel frattempo» (senza azione); `#n-live` «Nuove proposte: *T1*, *T2*, *T3*»; tablist `aria-label="Criteri della proposta"`; con una proposta `role="region" aria-label="Proposta"`.
- Token (verbatim). Chiaro: `--paper: #FBFBF6; --paper-off: #DDE1D7; --paper-line: rgba(47, 84, 87, .10);` Scuro: `--paper: #222B2C; --paper-off: #182021; --paper-line: rgba(244, 234, 216, .07);`
- Bersagli ≥ 44 px (linguette, Inizia, Altre proposte, Non ora/Chiudi, Annulla dell'avviso). Contrasto testo ≥ 4,5:1. Con `prefers-reduced-motion: reduce` nessuna animazione nel componente.
- Mai `preventDefault` sugli eventi di tocco/pointer; la pila ha `touch-action: pan-y; user-select: none`; un solo gruppo di gestori `pointerdown/pointerup/pointercancel` passivi, niente `pointermove`.
- Peso: circa +2 KB non compressi in tutto (≈ +1,1 KB `app.js`, ≈ +0,9 KB `style.css`), nessun font, nessuna libreria.
- Ultimo compito obbligatorio: suite completa verde, nessun errore in console, screenshot a 390×844 e 1366×860 in chiaro e scuro confrontati con il prototipo (variante B), `node .claude/hooks/contrasto.mjs style.css` pulito.

## Review Focus

1. Titolo lunghissimo senza spazi (es. 70 caratteri, «Supercalifragilistichespiralidoso…») a 390 px: va a capo dentro la scheda, niente scorrimento orizzontale, i pulsanti restano a 44 px.
2. Libro in pila con dati di una lettura precedente (`finishedYear: 2019`, oppure `finished` + `started`): «Inizia» → «Annulla» deve rimettere esattamente `finished`/`finishedYear`/`started`, che `setStatus` cancella o riscrive.
3. Due dita sulla scheda (pizzico per lo zoom): un secondo `pointerdown` durante il gesto lo annulla, la linguetta non cambia.
4. Titolo con virgolette e HTML (`Due "virgolette" <i>`) su una linguetta non attiva: dopo il cambio `aria-label` di «Inizia» è esattamente `Inizia Due "virgolette" <i>` (si usa `setAttribute`, niente HTML ricostruito).
5. Movimento ridotto: con `reducedMotion: 'reduce'` il cambio di linguetta non avvia l'animazione `nflip` (`animation-name` calcolato `none`).

---

### Task 1: Avviso più largo e «Annulla» da 44 px, opzione `focus`

**Files:**
- Modify: `app.js:39-46` (`toast`)
- Modify: `style.css:341-342` (`.toast`, `.toast button`)
- Test: `test/funzioni.mjs`, funzione `paginaRapida` (dopo il primo clic su +10, riga ~39)

**Interfaces:**
- Nota: sul telefono i filtri sono `.pill[data-filter][aria-checked]` (`app.js:1254`); `aria-pressed` c'è solo sugli `.shelf-link` della colonna laterale (`app.js:1256`), per questo il selettore li prende entrambi.
- Produces: `toast(msg: string, action?: { label: string, run: () => void }, opts?: { focus?: boolean }): void`. Con `opts.focus` il pulsante dell'avviso riceve il focus subito dopo l'inserimento. Alla scadenza (10 s con azione), se `document.activeElement` era il pulsante dell'avviso: focus al primo elemento focalizzabile di `#hero` (se `#hero` non è `hidden`), altrimenti al primo filtro attivo visibile `[data-filter][aria-checked="true"], [data-filter][aria-pressed="true"]`. Tutto il resto di `toast` invariato.

- [ ] **Step 1: Test** in `paginaRapida`, subito dopo `ok('toast «Pagina 110»', …)` (viewport 390×844):
  - `ok('avviso: «Annulla» alto almeno 44 px', (await toastBtn().boundingBox()).height >= 44)`
  - `ok('avviso a una riga', tb.height <= 46)` con `tb = await p.locator('.toast').boundingBox()` (la larghezza oltre metà schermo si prova nel Task 5 con «In lettura: «Bad Actors»»)
  - `ok('avviso lontano dal pulsante Aggiungi', !intersect(tb, await p.locator('.dock .tab.add .ico').boundingBox()))` con `intersect(a, b)` helper locale (riquadri che si sovrappongono)
- [ ] **Step 2:** `node test/run.mjs funzioni` → FAIL almeno «Annulla alto almeno 44 px» (oggi ~20 px).
- [ ] **Step 3: Implementa.** CSS: in `.toast` aggiungi `width: max-content;` e sostituisci `padding: 10px 16px` con `padding: 0 6px 0 16px` (aggiungi `min-height: 44px` perché i messaggi senza pulsante restino alti come prima); `.toast button` diventa `… min-height: 44px; padding: 0 10px; text-underline-offset: 3px;`. JS: terzo parametro `opts = {}` di `toast` come da Interfaces; il ripristino del focus va nel `setTimeout` esistente, prima di `t.remove()`.
- [ ] **Step 4:** `node test/run.mjs funzioni` → tutti OK (anche «Pagina N · Annulla» e il ripristino delle copie, che usano lo stesso avviso).
- [ ] **Step 5: Commit** — `Prossimo 1/6: avviso a larghezza piena e «Annulla» da 44 px, opzione focus`

### Task 2: Scheda del catalogo (markup, token e stile)

**Files:**
- Modify: `app.js:932-953` (`nx`, `nextList`, `nextHTML`, `fillNext`; in `wireNext` solo quanto serve perché l'unico `[data-start]` continui a funzionare)
- Modify: `style.css` — riga di token alla fine di `:root` (dopo `color-scheme: light;`, riga ~26) e alla fine del `:root` scuro (dopo la riga `--shadow…`, ~33); blocco `style.css:589-601` sostituito per intero
- Test: `test/funzioni.mjs`, funzione `prossimo` (righe 245-254 adattate + controlli nuovi)

**Interfaces:**
- Produces: `nx = { ex: string[], list: {book, kind, reason}[], off: boolean, sel: string | null }` (`sel` = id del libro della linguetta attiva nell'hero; `nextList(true)` lo azzera a `null`). `nextHTML(list, h = "h3", sel = null): string` — prefisso id `nh-` se `h === "h3"`, altrimenti `ns-`; linguetta attiva = indice di `sel` in `list`, oppure 0. Markup esatto: blocco «Struttura DOM» della spec (`section.next > h3|h2 + .drawer(.ntabs[role=tablist] + .nstack(.ncard…)) + .nfoot`), un solo `button.btn.primary[data-start][aria-label="Inizia <titolo>"]` nella `.nfoot`, `#n-more`/`#n-later` solo nell'hero, «Altre proposte» solo se la pila ha più libri delle proposte (altrimenti `<span></span>` come oggi). Etichetta linguetta: helper `tabLabel(list, i)` per la regola «Ancora a caso». `renderHero` passa già `nextHTML(list)`: per non toccarla, `nextHTML` legge `nx.sel` quando `h === "h3"` e `sel` non è passato.
- Produces (CSS): classi `.drawer`, `.ntabs`, `.ntab`, `.nstack`, `.ncard`, `.nhead`, `.call`, `.n`, `.nbody`, `.au`, `.why`, `.meta`, `.hole`, `.nfoot`, `.ncard.flip` (animazione), `@keyframes nflip`.

- [ ] **Step 1: Test** (adatta e aggiungi in `prossimo`, dopo `load` con `pila`+`letti`):
  - riga 247: `/Mick Herron/.test(t) && /300 pagine/.test(t)` con `t = await hero.locator('.ncard').first().textContent()` (al posto di «Mick Herron · 300 pp.»)
  - righe 253-254: `innerText()` → `textContent()`
  - `ok('linguette: tablist con Affine, Il più vecchio, A caso', role tablist con aria-label 'Criteri della proposta' && testi dei 3 [role=tab] === ['Affine','Il più vecchio','A caso'] && primo aria-selected 'true' && hero.locator('.ncard:visible').count() === 1 && hero.locator('[data-start]').count() === 1)`
  - `ok('aria-controls e aria-labelledby collegati', tab nh-t1 aria-controls === 'nh-p1' && #nh-p1 aria-labelledby === 'nh-t1' && #nh-p1 data-next === id della seconda proposta)`
  - `ok('contatore 1 di 3 nascosto a VoiceOver', .ncard:visible .n testo '1 di 3' && aria-hidden 'true')`, `ok('segnatura con «Segnatura» solo per VoiceOver', .call contiene .sr 'Segnatura ')`
  - `ok('motivo senza punto nel testo', .why textContent === reason esatto della prima proposta)`
  - combinazioni: `load` con solo `pila` (nessun letto) → terza linguetta «Ancora a caso»; `load` con 2 libri in pila → 2 linguette e «1 di 2»; il test esistente «un solo libro» aggiunge `[role=tablist]` count 0, `.n` count 0, `.ncard` `role="region"` e `aria-label="Proposta"`
  - Review Focus 1: libro in pila con titolo di 70 caratteri senza spazi come unica proposta → `scrollWidth <= 390` e altezza di `[data-start]` ≥ 44
  - `ok('computer: scheda larga al massimo 600 px', …)` in una pagina 1366×860 (`newPage(browser, { width: 1366, height: 860 })`): `#hero .next` width ≤ 600 e una sola `.ncard` visibile
  - contrasto (spec, test 9) in chiaro e scuro (`newPage(browser, { dark: true })`): funzione nella pagina che calcola il rapporto WCAG da `getComputedStyle(el).color` e dal fondo (`--paper` per `.why`/`.meta`, `--paper-off` per `.ntab` non attiva, letti con `getComputedStyle(document.documentElement).getPropertyValue`) → tutti ≥ 4.5
- [ ] **Step 2:** `node test/run.mjs funzioni` → FAIL sui controlli nuovi.
- [ ] **Step 3: Implementa** token (righe nuove con il commento `/* scheda del catalogo */`), `nx.sel`, `nextHTML`, CSS. Il CSS parte dalle regole `.vb` del prototipo (righe 176-198) con i nomi dell'app (`.vb .tab` → `.ntab`, `.vb .card` → `.ncard`, `.vb .head` → `.nhead`, `.vb .body` → `.nbody`, `.vb .act` → `.nfoot`, `flip` → `nflip`) e in più:
  - `.next` senza riquadro (niente `--surface`/bordo/padding), `display: flex; flex-direction: column; gap: 10px`; titolo Fraunces 21 px `--title` (anche `.sheet .next h2`);
  - `.ntabs { grid-template-columns: repeat(var(--nt, 3), minmax(0, 1fr)) }` con `--nt` scritto nello `style` della tablist (2 o 3);
  - `.nstack { display: grid; overflow: hidden; touch-action: pan-y; user-select: none }`, ogni `.ncard { grid-area: 1 / 1 }`, `.ncard[hidden] { display: block !important; visibility: hidden }` (vince su `[hidden] { display: none !important }` di `style.css:20` perché più specifico);
  - le schede dietro (`.drawer::before/::after`) solo con `.drawer.many` (classe messa da `nextHTML` con 2+ proposte);
  - `.ncard .cover` larga 58 px con `.ct`, `.ca`, `::after` nascosti come oggi; `.why::after { content: "." }`; `.nbody b` senza troncamento;
  - `.hole { background: var(--hole, var(--bg)) }` e `.sheet .next { --hole: var(--surface) }`;
  - `.nfoot { display: grid; grid-template-columns: 1fr auto auto; gap: 8px }`, `.nfoot .btn, .ntab { min-height: 44px }`;
  - `.ncard.flip { animation: nflip .35s cubic-bezier(.2,.8,.2,1) both }`, `@media (min-width: 1024px) { .hero .next { max-width: 600px; } }`, `@media (prefers-reduced-motion: reduce) { .ncard { animation: none; } }`.
- [ ] **Step 4:** `node test/run.mjs funzioni` → tutti OK (compresi «Altre proposte», «pila esaurita», «Scegli per me», «Inizia porta a In lettura»: il `button[data-start="${id}"]` della scheda è quello della prima linguetta).
- [ ] **Step 5: Commit** — `Prossimo 2/6: scheda del catalogo con linguette, token --paper e nuovo stile`

### Task 3: Linguette interattive (clic, tastiera, selezione ricordata)

**Files:**
- Modify: `app.js` — `wireNext`, `fillNext`
- Test: `test/funzioni.mjs`, funzione `prossimo`

**Interfaces:**
- Consumes: `nextHTML`, `nx.sel`, classi del Task 2.
- Produces: dentro `wireNext(root, sheet)` la funzione interna `pick(id: string, anim: boolean): void` — mette `hidden` su tutte le `.ncard` tranne `[data-next=id]`, aggiorna `aria-selected` e `tabindex` mobile delle linguette, `data-start` e `aria-label` («Inizia » + titolo, con `setAttribute`) del pulsante, e con `anim` toglie e rimette la classe `flip` sulla scheda (rileggendo `offsetWidth` in mezzo). Nell'hero scrive `nx.sel = id`; nella scheda aggiorna solo una variabile locale di `fillNext`/`wireNext`. Usata anche dal Task 4. `announce(text: string)`: scrive in `#n-live` (`div.sr[aria-live=polite]`, creato da JS in `document.body` al primo uso, perché `renderHero` sostituisce l'`innerHTML` dell'hero).

- [ ] **Step 1: Test** in `prossimo` (hero con 3 proposte):
  - `ok('clic sulla seconda linguetta: mostra il secondo libro', seconda aria-selected 'true' && .ncard:visible data-next === l[1] && [data-start] data-start === l[1] && aria-label === 'Inizia ' + titolo)`
  - tastiera, con focus sulla linguetta attiva: `ArrowRight` → la successiva ha focus e `aria-selected`; dall'ultima `ArrowRight` → la prima; `ArrowLeft` dalla prima → l'ultima; `End` → ultima; `Home` → prima; `ok('tabindex mobile', solo la attiva ha tabindex "0", le altre "-1")`; `ok('il pannello ha tabindex 0', …)`
  - `ok('selezione ricordata dopo un cambio di titolo', …)`: seconda linguetta attiva, poi `H.setLocal` + `H.refreshChanged([{ id, from: 'da-leggere', to: 'da-leggere' }])` sul libro della terza → la seconda resta attiva
  - `ok('Altre proposte: prima linguetta e annuncio', prima aria-selected 'true' && /^Nuove proposte: /.test(#n-live textContent) && focus su #n-more)`
  - Scegli per me (spec test 7): `ok('scheda con la sua tablist ns-*', .sheet [role=tablist] presente && .sheet #ns-t0 presente)`, `ok('nessun id duplicato con hero e scheda aperti', ids di tutti gli [id] unici)`, clic sulla terza linguetta della scheda → la linguetta attiva dell'hero (`#hero [role=tab][aria-selected=true]` id) non cambia
  - Review Focus 4: libro in pila `Due "virgolette" <i>` sulla seconda linguetta → dopo il clic `aria-label === 'Inizia Due "virgolette" <i>'`
  - Review Focus 5: `p.emulateMedia({ reducedMotion: 'reduce' })`, clic su una linguetta → `getComputedStyle(.ncard:visible).animationName === 'none'`; poi `emulateMedia({ reducedMotion: null })`
- [ ] **Step 2:** `node test/run.mjs funzioni` → FAIL.
- [ ] **Step 3: Implementa** in `wireNext`: clic su `.ntab` → `pick(tab.dataset.tab, true)`; `keydown` sulla tablist per ←/→ (con ritorno circolare), Home, Fine → `pick(..., true)` e `focus()` sulla nuova linguetta (attivazione automatica; `preventDefault` solo su questi tasti, che non sono eventi di tocco). «Altre proposte»: `nextList(true)`, ridisegno come oggi (hero o `fillNext`), animazione `flip` solo sulla prima scheda, `announce("Nuove proposte: " + titoli.join(", "))`, focus su `[data-n=more]`. `fillNext(sheet)` passa a `nextHTML(nextList(), "h2", null)`: la scheda parte sempre dalla prima linguetta e non tocca `nx.sel`.
- [ ] **Step 4:** `node test/run.mjs funzioni` → tutti OK.
- [ ] **Step 5: Commit** — `Prossimo 3/6: linguette con clic, frecce, Home/Fine e selezione ricordata`

### Task 4: Scorrimento laterale sulla pila

**Files:**
- Modify: `app.js` — `wireNext`
- Test: `test/funzioni.mjs`, funzione `prossimo`

**Interfaces:**
- Consumes: `pick(id, anim)` del Task 3.
- Produces: gestori `pointerdown`/`pointerup`/`pointercancel` (`{ passive: true }`) su `.nstack`, solo se ci sono 2+ proposte.

- [ ] **Step 1: Test.** Helper nella pagina `swipe(x0, y0, x1, y1, { type = 'touch', cancel = false, second = false })` che crea `new PointerEvent(..., { pointerId: 1, pointerType: type, clientX, clientY, bubbles: true })` su `#hero .nstack`: `pointerdown`, (opzionale `pointerdown` con `pointerId: 2`), poi `pointercancel` o `pointerup`. Partenza al centro della pila (x ≈ 195).
  - `ok('scorrimento a sinistra: linguetta successiva', swipe 100 px a sinistra → seconda attiva)`
  - `ok('scorrimento a destra dalla prima: ultima', …)`
  - `ok('gesto obliquo ignorato', dx 60 / dy 80 → nessun cambio)`
  - `ok('pointercancel ignorato', …)`, `ok('gesto dal bordo ignorato', x0 = 10 → nessun cambio)`, `ok('mouse ignorato', type 'mouse' → nessun cambio)`
  - Review Focus 3: `ok('due dita: nessun cambio', second: true, poi pointerup del primo con dx 100 → nessun cambio)`
  - `ok('scorrimento: il focus non si sposta', document.activeElement invariato)`
- [ ] **Step 2:** `node test/run.mjs funzioni` → FAIL.
- [ ] **Step 3: Implementa:** su `pointerdown` con `pointerType` `touch` o `pen`, senza gesto in corso e con `clientX` tra 24 px e `innerWidth - 24`, ricorda `{ id: pointerId, x, y }`; un secondo `pointerdown` durante il gesto lo annulla; `pointercancel` lo annulla; su `pointerup` dello stesso `pointerId`: se `|dx| ≥ 48 && |dx| ≥ 2·|dy|`, `pick(successiva se dx < 0, altrimenti precedente; circolare, true)`. Nessun cambio di focus.
- [ ] **Step 4:** `node test/run.mjs funzioni` → tutti OK.
- [ ] **Step 5: Commit** — `Prossimo 4/6: scorrimento laterale sulla scheda (solo tocco e penna)`

### Task 5: «Inizia» con Annulla

**Files:**
- Modify: `app.js` — nuova `startNext` subito dopo `fillNext`; in `wireNext` il clic su `[data-start]` chiama `startNext(btn.dataset.start, sheet)`
- Test: `test/funzioni.mjs`, funzione `prossimo`

**Interfaces:**
- Consumes: `toast(msg, action, { focus: true })` del Task 1; `nx.sel`; `setStatus`, `clean`, `schedulePersist`, `cloudHook`, `refreshChanged`, `closeSheet` esistenti.
- Produces: `startNext(id: string, sheet: boolean): void`. Campi ripristinati: `["status", "started", "finished", "finishedYear", "finishedAuto", "page", "pageStep"]` (assente prima → cancellato). Undo applicato solo se il libro esiste e ha `status === "in-lettura"`; altrimenti `toast("Non annullato: «" + titolo + "» è cambiato nel frattempo")`. Dopo l'undo: `state.books[k] = { ...clean(ripristinato), id, updated: Date.now() }`, `schedulePersist()`, `cloudHook("changed", id)`, `nx.sel = id`, `refreshChanged([{ id, from: "in-lettura", to: "da-leggere", moved: true }])`, focus sulla linguetta selezionata dell'hero se presente, altrimenti (una sola proposta) su `#hero [data-start]`. Titolo nell'avviso: `t.length > 40 ? t.slice(0, 40) + "…" : t`.

- [ ] **Step 1: Test** (nuovo `load` in `prossimo`: pila con `s1` `{ started: "2025-03-01", page: 12, pageStep: 5 }`, `s2` senza `started`, `s3` con `finishedYear: 2019`, più i letti; e un libro «Bad Actors»):
  - Inizia dalla seconda linguetta → `ok('avviso «In lettura: «…»» con Annulla a fuoco', /^In lettura: «/.test(toastText) && document.activeElement è .toast button)`
  - Annulla → `ok('Annulla: libro com\'era', status 'da-leggere' && started/page/pageStep identici a prima && finished, finishedYear, finishedAuto assenti se lo erano && updated > updated di prima)` (usa `until`)
  - `ok('Annulla: proposte con la stessa linguetta', #hero .next visibile && seconda linguetta aria-selected 'true' && document.activeElement è quella linguetta)`
  - Review Focus 2: stesso giro su `s3` → dopo Annulla `finishedYear === 2019` e `started` assente
  - cloud: prima del giro `p.evaluate(() => { window.__ch = []; window.libreriaCloud = { connected: true, changed: id => __ch.push(id) }; })` → `ok('Annulla arriva al cloud', __ch.filter(x => x === id).length >= 2)` (uno da Inizia, uno da Annulla); poi `delete window.libreriaCloud`
  - spec test 5: Inizia, poi `H.setLocal(id, { ...b, status: 'letto' })` + `H.refreshChanged([{ id, from: 'in-lettura', to: 'letto', moved: true }])`, Annulla → `ok('Annulla dopo un cambio: libro invariato', status 'letto' && /^Non annullato: «/.test(toastText))`
  - Scegli per me (spec test 7): Inizia dalla terza linguetta della scheda → scheda chiusa, libro In lettura, Annulla lo rimette `da-leggere`
  - spec test 8, a 390×844: avviso «In lettura: «Bad Actors»» alto ≤ 46 px (una riga, quindi largo più di 195 px) e senza intersezione con `.dock .tab.add .ico`; avviso con titolo di 60 caratteri → testo che termina con «…»» e contiene 40 caratteri del titolo
- [ ] **Step 2:** `node test/run.mjs funzioni` → FAIL.
- [ ] **Step 3: Implementa** `startNext` come da Interfaces e dalla spec («Annulla → Dopo Inizia», punti 1-4): copia `before` prima di `closeSheet()`/`setStatus(b, "in-lettura")`; l'avviso va mostrato dopo `setStatus` (che chiama `toast` a sua volta: il nostro lo sostituisce) e dopo `closeSheet` (che rimette il focus a `lastFocus` in modo sincrono, quindi il focus su «Annulla» vince).
- [ ] **Step 4:** `node test/run.mjs funzioni` → tutti OK.
- [ ] **Step 5: Commit** — `Prossimo 5/6: «Inizia» con Annulla che rimette il libro in pila com'era`

### Task 6: «Non ora» con Annulla e focus alla scadenza

**Files:**
- Modify: `app.js` — `wireNext` (gestore `[data-n=later]` nell'hero)
- Test: `test/funzioni.mjs`, funzione `prossimo`

**Interfaces:**
- Consumes: `toast(..., { focus: true })` (Task 1), `nx.sel` (Task 2-3).
- Produces: nessuna interfaccia nuova.

- [ ] **Step 1: Test** (sostituisce/estende il controllo esistente «Non ora nasconde la proposta», riga ~268):
  - seconda linguetta attiva, «Non ora» → `ok('Non ora: avviso «Proposte nascoste» con Annulla a fuoco', #hero .next assente && toastText inizia con 'Proposte nascoste' && focus su .toast button)`
  - Annulla → `ok('Annulla di Non ora: stesse proposte, stessa linguetta, focus sulla linguetta', …)`
  - in «Scegli per me» «Chiudi» → scheda chiusa e `.toast` assente
  - scadenza, in una pagina nuova con `await p.clock.install()` prima di `load`: «Non ora», poi `await p.clock.fastForward(10500)` → `ok('avviso scaduto: focus sul filtro attivo', .toast assente && document.activeElement.matches('[data-filter][aria-checked="true"]'))` e `#hero .next` ancora assente
- [ ] **Step 2:** `node test/run.mjs funzioni` → FAIL.
- [ ] **Step 3: Implementa:** hero: `nx.off = true; renderHero(); toast("Proposte nascoste", { label: "Annulla", run: () => { nx.off = false; renderHero(); focus su "#hero [role=tab][aria-selected=true]" se c'è } }, { focus: true })`. Scheda: `closeSheet()` come oggi.
- [ ] **Step 4:** `node test/run.mjs funzioni` → tutti OK.
- [ ] **Step 5: Commit** — `Prossimo 6/6: «Non ora» con Annulla`

### Task 7: Verifica finale

**Files:**
- Nessuna modifica attesa; eventuali correzioni nei soli punti della spec, con commit a parte. Script di screenshot usa e getta nella cartella scratchpad (non nel repository).

- [ ] **Step 1:** `node test/run.mjs` nel worktree (circa 6 minuti, unico processo) → ultima riga `✓ N riusciti, 0 falliti`. In particolare `serie.mjs:685` (`.why` con `textContent` = «Il #4 di Slough House, dopo il #3») passa senza modifiche.
- [ ] **Step 2:** `node .claude/hooks/contrasto.mjs style.css` → nessun avviso sotto 4,5:1.
- [ ] **Step 3:** Screenshot Playwright (server avviato con `startServers` di `test/lib.mjs`, pagina da `newPage`) a 390×844 e 1366×860, chiaro e scuro: hero con proposte, dopo «Inizia» (avviso visibile), dopo «Non ora» (avviso visibile), scheda «Scegli per me». Confronto a vista con `design/proposte/img/prossimo-B.png`, `prossimo-B-scuro.png`, `prossimo-B-inizia*.png`, `prossimo-B-nonora*.png`: linguette, righe, filetto corallo, foro del colore giusto (fondo pagina nell'hero, `--surface` nella scheda), schede dietro, un solo pulsante corallo; a 390 l'hero alto circa 365 px; nessun errore in console (`p.errs` vuoto) e `scrollWidth <= innerWidth`.
- [ ] **Step 4:** Peso: `git diff --stat claude/youthful-ride-ha414a -- app.js style.css` e confronto dei byte (`wc -c` prima/dopo) → netto circa +2 KB; se oltre +3 KB, ridurre prima di chiudere.
- [ ] **Step 5:** `git diff claude/youthful-ride-ha414a --name-only` contiene solo `app.js`, `style.css`, `test/funzioni.mjs` (né `sw.js` né `CLAUDE.md`). Commit di eventuali correzioni: `Prossimo: rifiniture dopo la verifica finale`.
