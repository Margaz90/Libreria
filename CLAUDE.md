# MyLibrary — contesto per Claude Code

App personale di Diego per tracciare i libri letti, in lettura e da leggere. Rispondi sempre in italiano.

## Cos'è e dove gira
- PWA statica, nessun build: `index.html`, `style.css`, `app.js`, `sw.js`, `manifest.webmanifest`.
- Pubblicata con GitHub Pages dal branch `main`, cartella root: https://margaz90.github.io/Libreria/ (la L maiuscola conta: il repository si chiama `Libreria`).
- Usata soprattutto come app installata sulla Home dell'iPhone (Safari), ma anche da computer e iPad: il layout è responsive (sotto 1024 px barra a icone in basso Libreria · Cerca · Aggiungi · Statistiche · Altro, che si nasconde scorrendo; sopra colonna laterale con scaffali e conteggi, scheda libro a lato).
- Caratteri e colori (v44): titoli in Fraunces (unico font scaricato, ~65 KB), testo e numeri con i font di sistema (SF su Apple). Token in `style.css`: `--title` petrolio #2F5457 (crema #F4EAD8 in scuro), `--accent` corallo profondo #B03A30 (#F06A5C in scuro) per testi e pulsanti, `--coral` #F06A5C solo per dettagli (anello dell'obiettivo, barra di lettura, linea di 3 px sotto i nomi degli scaffali): su fondo chiaro ha contrasto troppo basso per i testi. `--shelf` (con `--shelf-hi`/`--shelf-lo` per il rilievo) è l'asse degli scaffali: ciliegio (v50; era corallo scuro). Il disegno dell'asse è `--board-img`, un SVG incorporato (tessera 600x230 px, venature con `feTurbulence`, una versione chiara e una scura). `--dw` è il peso dei titoli.
- Scaffali (`.row`): ogni fila è alta 204 px (i dorsi più bassi hanno `margin-top: calc(204px - var(--h))`, con `--h` scritto da `spineHTML`), così l'asse in legno (16 px) si ripete come immagine di sfondo sotto ogni fila (passo 230 px, `background-position` dell'ultima: `left bottom -10px`) e c'è sempre un'asse anche sotto l'ultima, pure a scaffale vuoto.
- Nome sull'iPhone: "MyLibrary". Icona (v41): fondo petrolio lucido, scaffale con quattro dorsi color crema ("MyLibrary" sul più alto, uno inclinato) e segnalibro corallo con cuciture e ramo di foglie appeso in alto a destra. Sorgente in `design/icona.html` (aprendola con `#render-512` o `#render-512-m` disegna solo l'icona, normale o con margine per Android); PNG generati con Playwright, quelli da 512 ridotti a 256 colori. Intestazione: "Libreria di Margaira Diego" e titolo "My▮Library" (v46): tra «My» e «Library» un segnalibro corallo (`h1 .rib`, misure in em, tacca a V, scende sotto la riga); è decorativo (`aria-hidden`), il titolo resta "MyLibrary".

## Dati
- Attenzione: su iPhone l'app installata ha una memoria sua, separata da Safari. Rimuoverla dalla Home cancella i libri del dispositivo: si recuperano solo dal cloud (accesso) o da un backup.
- Tutto in `localStorage` del dispositivo, chiave `libreria-diego-v1` (array di libri). Le foto dei dorsi stanno in chiavi separate `libreria-spine-<id>`. Impostazioni (obiettivo annuale, data ultimo backup) in `libreria-settings`.
- Campi di un libro: title, author, year, pages, genre, status (`da-leggere` | `in-lettura` | `letto`), rating 0-5, started, finished (YYYY-MM-DD), finishedYear (solo l'anno, 1900–anno corrente, per i letti senza data di fine; tolto se c'è `finished`), page, pageStep (ultimo salto di pagine scritto a mano, intero 1–2000, per «+N»), notes, quote, callNo (segnatura Dewey + 3 lettere cognome), synopsis, isbn, cover (URL), noCover, coverManual, spine, spineRatio, added, series (≤ 80 caratteri), seriesNo (stringa, numero ≥ 0, «0,5» → «0.5»), seriesNext (titolo italiano confermato del volume successivo), seriesManual (serie o numero scritti a mano: le ricerche non li toccano, il seguito sì), finishedAuto (v64: la data di fine l'ha messa l'app — oggi al passaggio a Letto o la stima +20 giorni — e la stima dall'inizio può sostituirla; si toglie quando la fine si sceglie a mano).
- `seed.json`: i 108 libri importati da Goodreads con i titoli italiani (pulsante "Carica i libri Goodreads" a libreria vuota).
- Backup/import: JSON esportato dall'app o CSV Goodreads, dalla scheda "Backup" in basso.
- Sincronizzazione tra dispositivi con Firebase, opzionale: vedi la sezione dedicata più sotto.

## Funzioni presenti (riassunto)
Il dettaglio completo (id, classi, casi limite, versioni, spec) è in [docs/funzioni.md](docs/funzioni.md): leggi la voce prima di toccare una funzione e aggiornala dopo. In breve:
- **Libreria**: vista Dorsi (foto vera > striscia della copertina > dorso disegnato) o Copertine, filtri a pillole (senza numeri sotto 700 px), 15 libri per scaffale con «Mostra altri 15»/«Nascondi» (`.pager`, 44 px), menu «Ordina» (Recenti, Da leggere prima, Autore, Titolo, Voto; In lettura sempre primo). Menu Altro: Accedi e sincronizza, Obiettivo, Backup/import/copertine. Barra in alto sempre fissa, barra in basso che si nasconde.
- **Hero `#hero`**: libri in lettura (copertina 76 px, serie `.rmeta.rser`, cursore-barra di 4 px con `--pct`, «pag. N di T · %», +10 e «+N»); pagina rapida `pageQuick(id, {add|to, manual})` con «Annulla», `pageStep`. Senza letture: «Cosa leggo adesso?» (`nextBooks`, pura, `window.libreriaNext.next`; linguette Affine / Il più vecchio / A caso; «Inizia», «Non ora», `.toast` con «Annulla»). Obiettivo annuale con anello.
- **Statistiche**: `computeStats(books, oggi)` pura (`window.libreriaStats.compute`) → `renderStats`; una mensola per anno (`yearHTML`, `spineHTML(b, "button", statDim(b))`, `ysRows`, `replaceYear`, anni vecchi dietro `#ys-more`), «Sempre» (Autori, Tempo, Mesi, Voti, Generi), racconto `openStory(anno)`. Solo libri `letto`; giorni = fine − inizio + 1 (esclusi <1, >730, futuro).
- **Scheda «Frontespizio»**: copertina 120 px con voto (solo Letto), trama `synClamp`, date a frase `periodText`, ritmo `readingPace`/`paceText` (`window.libreriaScheda`), `data-st` da `syncPeriod` (Da leggere senza citazione/note/voto), colophon con «Aggiorna informazioni» (`fetchInfo`, non salva da solo). Chiusura con modifiche → Salva / Scarta / Continua.
- **Date** (`wireDates`, anche in Nuovo libro): niente futuro né disordine (`#f-date-err`); un inizio dopo la fine sposta la fine a +20 giorni; fine stimata +20 giorni (`#f-date-est`, `finishedAuto`); letti con pagina = totale; «solo l'anno» `#f-year` (`finishedYear`). Pallino «da aggiornare» (`needsDates`, `--badge`, `#s-stale`).
- **Serie**: campi `#d-series`/`#d-series-no`, bollino `.sno`, ordine Autore per serie; `findSeries` (Wikidata per ISBN con `wdIsbn`, poi per autore, poi titolo originale da Open Library `olTitles`), `nextInSeries` pura, «Cerca le serie» (`seriesJob`); test in `window.libreriaSeries`. Le query SPARQL non sono provate dal vivo.
- **Ricerche**: Apple Books Italia (JSONP, `lookup?isbn=`), Google Books (`GBOOKS_KEY`; `googleIsbn` a giri paralleli 13/10/13, `ISBN_WAIT`, pausa di 5 minuti dopo i 503), Open Library, Wikidata (`wikidataSearch`, solo ISBN); `parseIsbn`, `itScore` (edizioni italiane prima), `seq` contro risposte vecchie. 503 = Google giù (passa da sé), 403 = chiave o referer (Google Cloud). «Verifica ricerche» in Backup.
- **Aggiunta e dati**: scanner ISBN con ZXing (`MultiFormatReader`, solo da un tocco, riquadro `flex: none`); lista dei desideri (`desiderato`, «Ho acquistato»); acquisti da Gmail (JSON con `"acquisti": true`, completamento in sottofondo con `fetchInfo`); import JSON/CSV Goodreads con «aggiorna i libri già presenti»; copie `snapshot`/`restoreSnapshot` in IndexedDB `libreria-copie` (sezione «Annulla» in Backup).
- **Sicurezza** (v51): `clean()` accetta `started`/`finished` solo AAAA-MM-GG; ogni testo dei libri nell'HTML passa da `esc()`. Scansione claude-security solo dal computer di Diego (`/claude-security`).
- **Altro**: menu rapido con pressione prolungata (Elimina in due tocchi), anteprima al passaggio del mouse, scorciatoie `/`, `N`, `1`/`2`, `refreshChanged` per le modifiche dal cloud, `prefers-reduced-motion`.

## Regole di lavoro
- Ogni modifica a file dell'app: incrementa `VERSION` in `sw.js` (ora v75), così sull'iPhone compare "Nuova versione disponibile → Aggiorna".
- Prestazioni: niente `render()` completo per cambi che non spostano il libro (usa `patchBook`), salvataggi con `schedulePersist`, miniature con `thumb()`. Verificato su iPhone simulato (CPU 4x più lenta).
- Prima di pubblicare lancia `node test/run.mjs` (vedi "Strumenti per Claude Code"): controlla 390x844 e 1366x860, chiaro e scuro, nessun errore in console, niente scorrimento orizzontale. Per modifiche grafiche guarda anche gli screenshot.
- Diego vuole un'app leggera: valuta il peso di ogni aggiunta. Confronti con pro e contro sempre in tabella.
- Commit in italiano, poi push su `main` (la pubblicazione su Pages è automatica).

- Quando cambia una funzione, aggiorna la sua voce in `docs/funzioni.md` (e il riassunto qui sopra se cambia qualcosa di essenziale).

## Strumenti per Claude Code (riassunto)
Testo completo (cosa controlla ogni gruppo di test e ogni hook): [docs/strumenti.md](docs/strumenti.md).
- **Test**: `node test/run.mjs` (circa 8 minuti, 640 controlli) oppure solo alcuni gruppi, es. `node test/run.mjs ricerche accesso`. Gruppi: `interfaccia`, `ricerche`, `accesso`, `sincronizzazione`, `aggiornamento`, `schede`, `isbn`, `isbn-verifica`, `sicurezza`, `serie`, `funzioni`, `statistiche`. `test/lib.mjs` avvia il server dell'app (8765) e un finto Firestore (8766), oppure `TEST_PORT` e `TEST_PORT`+1 per più copie in parallelo; `test/firebase-stub.js` sostituisce Firebase; le ricerche esterne sono simulate.
- **Hook** (`.claude/settings.json`, script in `.claude/hooks/`): `controlla-js.mjs` (`node --check` dopo ogni `.js`), `contrasto.mjs` (contrasto ≥ 4,5:1 dei token in chiaro e scuro; a mano `node .claude/hooks/contrasto.mjs style.css`), `proteggi-file.mjs` (blocca `zxing.min.js` e `seed.json`: si cambiano solo se Diego lo chiede), `test-prima-del-push.mjs` (suite completa prima del push su `main`; limiti 14 minuti nell'hook e 900 s in `settings.json`, da alzare insieme), `controlla-versione.mjs` (avvisa se manca il nuovo `VERSION`), `promemoria-verifica.mjs` (ogni 30 giorni: skill `verifica-hook` nella stessa risposta, dopo ciò che Diego ha chiesto; propone nuovi hook con pro e contro senza crearli).
- **Skill**: `/pubblica`, `/acquisti`, `/verifica-hook`. **Subagent**: `revisore-accessibilita` (solo resoconto), `esecutore-test` (Haiku).
- **Modelli più leggeri**: lavori lunghi e meccanici su Haiku (`esecutore-test`, `Explore` con `model: haiku`); richieste brevi direttamente; progetti, revisioni finali e design sul modello principale.
- **Pagine fuori dall'app**: `diagnosi-serie.html` e `completa-isbn.html`, da aprire in Safari (la sessione cloud non raggiunge Wikidata/Open Library e Google risponde 429). **MCP**: context7 in `.mcp.json`.

## Sincronizzazione con Firebase (riassunto)
`cloud.js`, caricata solo al bisogno; progetto `mylibrary-2ea05` (Google + link email, Firestore `users/{uid}/books|spines|meta`). Vince la modifica più recente (`updated`); in `app.js` il ponte è `libreriaHost`, ogni modifica chiama `cloudHook("changed"|"removed", id)`, le eliminazioni da disconnesso stanno in `libreria-tombs`. Nell'app installata su iPhone solo link via email. Il dettaglio è in [.claude/rules/sincronizzazione.md](.claude/rules/sincronizzazione.md) (si carica da solo lavorando su `cloud.js`; leggilo se tocchi la sincronizzazione da `app.js`).

## Storia del lavoro
Tutte le versioni, dalla più recente, in [docs/storia.md](docs/storia.md) (`/pubblica` aggiunge lì la riga nuova). Ultime: v75 rifiniture di scheda, home e Statistiche; v74 «Cosa leggo adesso?» come scheda del catalogo e scheda del libro come frontespizio; v73 Statistiche come scaffale degli anni. Consultala per capire perché una scelta è stata fatta (es. i molti tentativi su Google per gli ISBN, v66–v72).

## Altre idee in sospeso
- Prova dal vivo di «Cerca le serie» sull'iPhone (messaggio finale da riportare) per confermare le query Wikidata.
- Fuori ambito per ora: «Serie da continuare» nelle Statistiche, ordine «Serie» dedicato.
- Eventuale attività pianificata settimanale per `/acquisti` (oggi è su richiesta; Amazon poco utile perché le email non hanno ISBN).
- Futura app iOS nativa (SwiftUI) partendo da questo modello dati.
