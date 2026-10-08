# MyLibrary — PWA

App web installabile sulla schermata Home dell'iPhone. Funziona anche offline.

## Cosa contiene

| File | A cosa serve |
|---|---|
| `index.html`, `style.css`, `app.js` | L'app vera e propria |
| `manifest.webmanifest` | Nome, icona e aspetto quando è installata sulla Home |
| `sw.js` | Service worker: funzionamento offline e copertine salvate sul telefono |
| `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Icone |
| `seed.json` | I 108 libri importati da Goodreads, con i titoli italiani |

## Pubblicarla gratis su GitHub Pages (anche da iPhone, con Safari)

1. Crea un account su github.com, se non ce l'hai.
2. Tocca **+ → New repository**, chiamalo `libreria`, lascialo **Public** e tocca **Create repository**.
3. Nella pagina del repository tocca **uploading an existing file** (o **Add file → Upload files**).
4. Nell'app File decomprimi lo zip toccandolo una volta, poi seleziona **tutti i file della cartella** (non la cartella) e caricali.
5. Tocca **Commit changes**.
6. Vai in **Settings → Pages**. In *Source* scegli **Deploy from a branch**, branch **main**, cartella **/ (root)**, poi **Save**.
7. Dopo uno o due minuti l'app è online su `https://TUO-UTENTE.github.io/libreria/`.

## Installarla sull'iPhone

1. Apri l'indirizzo in **Safari**.
2. Tocca **Condividi → Aggiungi alla schermata Home**.
3. Apri l'app dall'icona e tocca **Carica i libri Goodreads**, poi **Cerca copertine**.

## Da sapere

- **I dati stanno solo su questo iPhone**, dentro l'app installata. Fai ogni tanto **Importa / esporta → Esporta backup** e salva il file in File o iCloud.
- Se nel prototipo su Claude hai modificato dei libri dopo l'importazione, esporta il backup da lì e importalo qui invece di usare i libri Goodreads.
- **Aggiornamenti**: per cambiare l'app basta ricaricare i file nuovi su GitHub. Al successivo avvio con connessione compare "Nuova versione disponibile — Aggiorna".
- **Copertine**: vengono da Google Books e Open Library. Se una è sbagliata, apri il libro, scegli **Modifica dati e copertina** e cerca l'edizione giusta, oppure torna alla copertina disegnata.

## Componenti esterni

- `zxing.min.js`: lettore di codici a barre [ZXing for JS](https://github.com/zxing-js/library) 0.21.3, licenza MIT. Viene caricato solo quando tocchi "ISBN" nella scheda Nuovo libro.
