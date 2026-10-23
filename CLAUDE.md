# MyLibrary — contesto per Claude Code

App personale di Diego per tracciare i libri letti, in lettura e da leggere. Rispondi sempre in italiano.

## Cos'è e dove gira
- PWA statica, nessun build: `index.html`, `style.css`, `app.js`, `sw.js`, `manifest.webmanifest`.
- Pubblicata con GitHub Pages dal branch `main`, cartella root: https://margaz90.github.io/Libreria/ (la L maiuscola conta: il repository si chiama `Libreria`).
- Usata soprattutto come app installata sulla Home dell'iPhone (Safari), ma anche da computer e iPad: il layout è responsive (sotto 1024 px barra in basso, sopra colonna laterale e scheda libro a lato).
- Nome sull'iPhone: "MyLibrary", icona = libro aperto a forma di M su fondo rosso. Intestazione: "Libreria di Margaira Diego".

## Dati
- Tutto in `localStorage` del dispositivo, chiave `libreria-diego-v1` (array di libri). Le foto dei dorsi stanno in chiavi separate `libreria-spine-<id>`. Impostazioni (obiettivo annuale, data ultimo backup) in `libreria-settings`.
- Campi di un libro: title, author, year, pages, genre, status (`da-leggere` | `in-lettura` | `letto`), rating 0-5, started, finished (YYYY-MM-DD), page, notes, quote, callNo (segnatura Dewey + 3 lettere cognome), synopsis, isbn, cover (URL), noCover, coverManual, spine, spineRatio, added.
- `seed.json`: i 108 libri importati da Goodreads con i titoli italiani (pulsante "Carica i libri Goodreads" a libreria vuota).
- Backup/import: JSON esportato dall'app o CSV Goodreads, dalla scheda "Backup" in basso.
- **Non esiste sincronizzazione tra dispositivi.** È il prossimo passo previsto (vedi sotto).

## Funzioni presenti
- Scaffale con dorsi (foto vera > striscia della copertina > dorso disegnato), vista Copertine (solo immagine scaricata), Statistiche.
- Libri in lettura come schede con pagina attuale e barra di avanzamento; obiettivo annuale con anello.
- Pressione prolungata su dorso/copertina = menu rapido per cambiare stato.
- Ricerca libri e copertine da Apple Books Italia (JSONP itunes.apple.com), Google Books, Open Library; punteggio che preferisce le edizioni italiane (`itScore`). Scelta tra più copertine nella scheda.
- Scansione ISBN con `zxing.min.js` (ZXing 0.21.3, MIT), caricato solo al bisogno.
- Anteprima al passaggio del mouse sui dorsi (solo dispositivi con mouse), menu "Ordina" personalizzato, selettore stato a tre pulsanti, animazioni con rispetto di prefers-reduced-motion.

## Regole di lavoro
- Ogni modifica a file dell'app: incrementa `VERSION` in `sw.js` (ora v11), così sull'iPhone compare "Nuova versione disponibile → Aggiorna".
- Prestazioni: niente `render()` completo per cambi che non spostano il libro (usa `patchBook`), salvataggi con `schedulePersist`, miniature con `thumb()`. Verificato su iPhone simulato (CPU 4x più lenta).
- Prova sempre con Playwright (Chromium già installato) a 390x844 e 1366x860 prima di pubblicare; nessun errore in console, niente scorrimento orizzontale.
- Diego vuole un'app leggera: valuta il peso di ogni aggiunta. Confronti con pro e contro sempre in tabella.
- Commit in italiano, poi push su `main` (la pubblicazione su Pages è automatica).

## Prossimo passo: sincronizzazione con Firebase
Scelta fatta: Firebase (Auth Google + link email come ripiego per l'app installata su iPhone, Firestore con cache offline). Diego deve ancora:
1. Creare il progetto su console.firebase.google.com (nome `mylibrary`, senza Analytics, piano Spark).
2. Authentication: attivare Google e Email (solo link senza password); aggiungere `margaz90.github.io` ai domini autorizzati.
3. Firestore: edizione Standard, località europea (eur3 o europe-west8), modalità produzione, regole:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
4. Registrare un'app Web (senza Firebase Hosting) e passare l'oggetto `firebaseConfig`.

Poi da implementare: pulsante Accedi nella scheda Backup, primo caricamento dei libri dal dispositivo che accede per primo (l'iPhone), sincronizzazione bidirezionale con funzionamento offline, foto dei dorsi come documenti separati (limite 1 MB per documento), backup manuale mantenuto.

## Altre idee in sospeso
- Ricerca acquisti su Gmail "su richiesta" (funziona bene con le email Feltrinelli; Amazon poco utile). Eventuale attività pianificata settimanale in futuro.
- Futura app iOS nativa (SwiftUI) partendo da questo modello dati.
