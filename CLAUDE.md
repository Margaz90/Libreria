# MyLibrary — contesto per Claude Code

App personale di Diego per tracciare i libri letti, in lettura e da leggere. Rispondi sempre in italiano.

## Cos'è e dove gira
- PWA statica, nessun build: `index.html`, `style.css`, `app.js`, `sw.js`, `manifest.webmanifest`.
- Pubblicata con GitHub Pages dal branch `main`, cartella root: https://margaz90.github.io/Libreria/ (la L maiuscola conta: il repository si chiama `Libreria`).
- Usata soprattutto come app installata sulla Home dell'iPhone (Safari), ma anche da computer e iPad: il layout è responsive (sotto 1024 px barra a icone in basso Libreria · Cerca · Aggiungi · Statistiche · Altro, che si nasconde scorrendo; sopra colonna laterale con scaffali e conteggi, scheda libro a lato).
- Nome sull'iPhone: "MyLibrary", icona = libro aperto a forma di M su fondo rosso. Intestazione: "Libreria di Margaira Diego".

## Dati
- Tutto in `localStorage` del dispositivo, chiave `libreria-diego-v1` (array di libri). Le foto dei dorsi stanno in chiavi separate `libreria-spine-<id>`. Impostazioni (obiettivo annuale, data ultimo backup) in `libreria-settings`.
- Campi di un libro: title, author, year, pages, genre, status (`da-leggere` | `in-lettura` | `letto`), rating 0-5, started, finished (YYYY-MM-DD), page, notes, quote, callNo (segnatura Dewey + 3 lettere cognome), synopsis, isbn, cover (URL), noCover, coverManual, spine, spineRatio, added.
- `seed.json`: i 108 libri importati da Goodreads con i titoli italiani (pulsante "Carica i libri Goodreads" a libreria vuota).
- Backup/import: JSON esportato dall'app o CSV Goodreads, dalla scheda "Backup" in basso.
- Sincronizzazione tra dispositivi con Firebase, opzionale: vedi la sezione dedicata più sotto.

## Funzioni presenti
- Sezione Libreria con vista Dorsi (foto vera > striscia della copertina > dorso disegnato) o Copertine (solo immagine scaricata), filtri a pillole per stato (senza numeri sotto 700 px), sezione Statistiche (sempre su tutta la libreria). Menu Altro: obiettivo, backup/import/copertine, posto per la sincronizzazione.
- Libri in lettura in primo piano, sopra obiettivo e filtri (sezione `#hero`, in entrambe le viste, con Aggiorna e Dettagli); negli scaffali non compaiono. Sul telefono: obiettivo su una riga (ring + "2 di 5 libri nel 2026") con il selettore scaffale/copertina alla stessa altezza, poi filtri e ricerca. Sul computer il selettore sta nella barra.
- Barra in alto (ricerca, ordina, filtri, vista): piena e sempre fissa in cima; sotto 1024 px i filtri sono un controllo segmentato a larghezza piena, la vista scaffale/copertina sta sotto, a destra; la barra in basso invece si nasconde scorrendo.
- Paginazione: ogni scaffale e le copertine mostrano 15 libri, poi "Mostra altri 15" e "Nascondi" (pulsanti in `.pager`). Le ricerche mettono prima le edizioni italiane (`ita`). Le letture in corso sono sempre tutte visibili.
- Acquisti (su richiesta, da Gmail): si importa un file JSON con `"acquisti": true` da Altro → Backup. Libro nuovo → Da leggere; libro in lista dei desideri → Da leggere (stessa scheda); gli altri invariati. Il confronto è per ISBN, poi titolo e autore, o solo titolo principale se il file non ha l'autore. Dopo l'import i libri nuovi si completano in sottofondo per ISBN (Google Books e Open Library, non Apple): riga "Aggiornamento informazioni…" in alto, l'app resta usabile, messaggio finale con i motivi degli errori. La scheda Backup ha "Completa autori e copertine" per quelli già importati.
- Lista dei desideri: stato `desiderato` (scaffale "Lista dei desideri", filtro "Desideri"). Dalla scheda o dalla scheda rapida, "Ho acquistato" lo porta a `da-leggere`. Si aggiunge da Nuovo libro con il pulsante "Lista dei desideri".
- Nuovo libro: si possono scegliere altre copertine (stesso criterio della scheda di modifica) prima di salvare.
- Scanner ISBN: la fotocamera si apre dal tocco su ▥ ISBN; il riquadro ha `flex: none` (altrimenti lo schiaccia la scheda). Il codice viene cercato su fotogrammi con ZXing (`MultiFormatReader`).
- Scorciatoie su computer: `/` cerca, `N` nuovo libro, `1`/`2` sezioni. Pressione prolungata su Aggiungi = scansione ISBN diretta.
- Chiudendo una scheda con modifiche compare "Salva / Scarta / Continua". Import con opzione "aggiorna i libri già presenti".
- Libri in lettura come schede con pagina attuale e barra di avanzamento; obiettivo annuale con anello.
- Modifiche dal cloud: `refreshChanged` aggiorna solo lo scaffale o il libro cambiato (niente sfarfallio). Lo scanner ISBN parte solo da un tocco (iOS blocca la fotocamera senza gesto); la pressione prolungata su Aggiungi mostra solo un suggerimento.
- Pressione prolungata su dorso/copertina = menu rapido per cambiare stato, con "Elimina" (conferma in due tocchi).
- Backup → "Verifica ricerche": prova Google Books e Open Library dal dispositivo e mostra il motivo dell'errore.
- Google Books usa una chiave API propria (`GBOOKS_KEY` in `app.js`), limitata al sito e alla sola Books API.
- Ricerca libri e copertine da Apple Books Italia (JSONP itunes.apple.com), Google Books, Open Library; punteggio che preferisce le edizioni italiane (`itScore`). Scelta tra più copertine nella scheda.
- Scansione ISBN con `zxing.min.js` (ZXing 0.21.3, MIT), caricato solo al bisogno.
- Anteprima al passaggio del mouse sui dorsi (solo dispositivi con mouse), menu "Ordina" personalizzato (Recenti, Da leggere prima, Autore, Titolo, Voto; ricordato sul dispositivo; lo scaffale In lettura, se ha libri, resta sempre il primo con qualunque filtro e ordine), selettore stato a tre pulsanti, animazioni con rispetto di prefers-reduced-motion.

## Regole di lavoro
- Ogni modifica a file dell'app: incrementa `VERSION` in `sw.js` (ora v38), così sull'iPhone compare "Nuova versione disponibile → Aggiorna".
- Prestazioni: niente `render()` completo per cambi che non spostano il libro (usa `patchBook`), salvataggi con `schedulePersist`, miniature con `thumb()`. Verificato su iPhone simulato (CPU 4x più lenta).
- Prova sempre con Playwright (Chromium già installato) a 390x844 e 1366x860 prima di pubblicare; nessun errore in console, niente scorrimento orizzontale.
- Diego vuole un'app leggera: valuta il peso di ogni aggiunta. Confronti con pro e contro sempre in tabella.
- Commit in italiano, poi push su `main` (la pubblicazione su Pages è automatica).

## Sincronizzazione con Firebase (in `cloud.js`, caricata solo al bisogno)
- Progetto `mylibrary-2ea05`: Authentication (Google + link email), Firestore in eur3, regole per utente (`users/{uid}`).
- Struttura: `users/{uid}/books/{id}` = libro senza foto (`deleted: true` = eliminato, segnaposto); `users/{uid}/spines/{id}` = foto del dorso (`data`, `at`).
- Conflitti: vince la modifica più recente (`updated`, ms). Foto: `spineAt` dice quale versione è nel cloud.
- Primo accesso con libri su entrambi i lati: chiede se unire (consigliato), usare solo il cloud o solo il dispositivo.
- In `app.js`: `libreriaHost` è il ponte con `cloud.js`; `cloudHook("changed"|"removed", id)` dopo ogni modifica; `libreria-tombs` tiene le eliminazioni fatte da disconnesso.
- Obiettivo di lettura sincronizzato (`users/{uid}/meta/goals`, vince la data più recente). La scheda Sincronizzazione mostra le modifiche non ancora inviate e ha il pulsante Riconnetti.
- SDK Firebase 10.14.1 (compat) da cdn.jsdelivr.net, messo in cache dal service worker.
- Accesso: Google (popup, o redirect nell'app installata) oppure link via email. Sull'iPhone il link va copiato e incollato nell'app, senza aprirlo in Safari (il link vale una volta).

## Storia del lavoro (versioni principali)
- **Menu e layout** (c931d51 → eb9688c, v24-v28): barra a icone in basso sotto 1024 px, colonna laterale con conteggi, filtri a pillole, barra in alto fissa, selettore scaffale/copertina, libri in lettura in primo piano, sezione in alto come da mockup.
- **Obiettivo e filtri** (fa53371, 4f56e26, v29-v30): obiettivo su una riga con anello, selettore vista alla stessa altezza, niente numeri sui filtri sotto 700 px, obiettivo senza mancanti.
- **Desideri e copertine** (c813fc4, cacf429, v22-v23): lista dei desideri con "Ho acquistato", scelta della copertina in Nuovo libro.
- **Scanner ISBN e pagine** (10867b3, 3952d5a, 7a435a8, v19-v21): scanner funzionante su iPhone (scheda con `flex: none`, avvio solo da tocco), paginazione a 15 elementi, ricerca con edizioni italiane prima.
- **Sincronizzazione Firebase** (7091ba0, 0a82b9e, bd2fe18, 76f16ba, v16-v18): accesso Google o link via email, tombstone per le eliminazioni, obiettivo sincronizzato, errori di sincronizzazione visibili nella scheda.
- **Acquisti da Gmail** (cfb1184, 3b27253, 017a89a, v31-v34): import JSON con `"acquisti": true`, nuovi libri in Da leggere, desideri spostati, autore e copertina recuperati per ISBN in sottofondo con i motivi degli errori.
- **Eliminazione rapida** (c303ea7, v33): "Elimina" nel menu rapido con conferma in due tocchi.
- **Chiave Google Books** (de640d7, v35): chiave propria in `GBOOKS_KEY`, limitata al sito e alla Books API. Nota: la chiave è pubblica nel codice, quindi la restrizione per sito è quella che la protegge.
- **Diagnostica ricerche** (0b680e2, 678d1e4, v36-v37): "Verifica ricerche" in Altro → Backup; l'esito compare subito sotto il pulsante (prima stava sotto la piega dello schermo).
- **Nuovo tentativo per Google** (468a173, v38): un 503 di Google riprova una volta dopo 1,5 secondi, sia per il pulsante sia per il completamento automatico.
- Il 503 e il 403 di Google sono due casi diversi: 403 = chiave o referer non ammessi (sistemare da Google Cloud); 503 = servizio momentaneamente giù (si risolve da solo).

## Altre idee in sospeso
- Ricerca acquisti su Gmail "su richiesta" (funziona bene con le email Feltrinelli; Amazon poco utile). Eventuale attività pianificata settimanale in futuro.
- Futura app iOS nativa (SwiftUI) partendo da questo modello dati.
