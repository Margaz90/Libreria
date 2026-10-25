# MyLibrary — PWA

App web installabile sulla schermata Home dell'iPhone, per i libri letti, in lettura, da leggere e desiderati. Funziona anche offline e, se accedi, sincronizza la libreria tra iPhone, iPad e computer.

Indirizzo: https://margaz90.github.io/Libreria/

## Cosa contiene

| File | A cosa serve |
|---|---|
| `index.html`, `style.css`, `app.js` | L'app vera e propria |
| `cloud.js` | Sincronizzazione con Firebase, caricata solo se accedi |
| `sw.js` | Service worker: funzionamento offline, aggiornamenti, copertine salvate sul telefono |
| `manifest.webmanifest` | Nome, icona e aspetto quando è installata sulla Home |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` | Icone (la sorgente modificabile è `design/icona.html`) |
| `seed.json` | I 108 libri importati da Goodreads, con i titoli italiani |
| `zxing.min.js` | Lettore dei codici a barre ISBN |
| `test/` | Test automatici (non fanno parte dell'app) |

## Installarla sull'iPhone

1. Apri l'indirizzo in **Safari**.
2. Tocca **Condividi → Aggiungi alla schermata Home**.
3. Apri l'app dall'icona. Se hai già usato la sincronizzazione vai su **Altro → Accedi e sincronizza** e accedi con il link via email: i libri arrivano dal cloud. Altrimenti tocca **Carica i libri Goodreads**.

## Da sapere

- **I dati stanno nel telefono** e, se accedi, anche nel cloud. L'app installata ha una memoria separata da Safari: se la togli dalla Home i libri del telefono si cancellano e tornano solo dal cloud o da un backup.
- **Backup**: ogni tanto **Altro → Backup → Esporta backup**, e salva il file in File o iCloud.
- **Accesso**: nell'app installata su iPhone si accede con il link via email (va copiato dall'email e incollato nell'app, senza aprirlo). Su computer e in Safari c'è anche Google.
- **Aggiornamenti**: quando esce una versione nuova compare in alto "Nuova versione disponibile": tocca **Aggiorna**.
- **Copertine e dati**: arrivano da Apple Books Italia, Google Books e Open Library. Se qualcosa manca o è sbagliato, apri il libro e tocca **Aggiorna informazioni**, oppure **Scegli un'altra copertina**.
- **Acquisti**: un file JSON di acquisti (preparato con Claude dalle email Feltrinelli) si importa da **Altro → Backup**: i libri nuovi vanno in Da leggere, quelli della lista dei desideri si spostano lì.

## Componenti esterni

- `zxing.min.js`: lettore di codici a barre [ZXing for JS](https://github.com/zxing-js/library) 0.21.3, licenza MIT. Viene caricato solo quando tocchi "ISBN" nella scheda Nuovo libro.
- Firebase 10.14.1 (Google), caricato da cdn.jsdelivr.net solo se accedi.
- Font dei titoli: Fraunces (Google Fonts, licenza OFL).
