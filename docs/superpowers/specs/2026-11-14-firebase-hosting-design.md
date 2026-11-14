# MyLibrary su Firebase Hosting, con accesso Google sull'iPhone — progetto

Data: 14 novembre 2026. Richiesta di Diego dopo la revisione dell'accesso (v89).

## Perché
Nell'app installata sulla Home dell'iPhone l'unico accesso possibile è il link via email: si chiede il link, si copia dalla mail, si incolla nell'app. Google non funziona perché l'app sta su `margaz90.github.io` e la pagina di accesso di Firebase su `mylibrary-2ea05.firebaseapp.com`: Safari tiene separati i dati dei due siti e l'accesso non torna all'app (vedi `.claude/rules/sincronizzazione.md`). Diego vuole «Accedi con Google» anche lì. La soluzione indicata da Firebase stessa è servire l'app dallo stesso dominio della pagina di accesso: Firebase Hosting, `https://mylibrary-2ea05.web.app/`.

L'accesso serve di rado (Firebase resta collegato finché non si esce o si cancella l'app), ma proprio dopo una reinstallazione, quando i libri sono solo nel cloud, deve essere facile.

## Obiettivi
- L'app è pubblicata anche su `https://mylibrary-2ea05.web.app/`, in automatico a ogni push su `main`, da GitHub (azione ufficiale di Firebase). Il codice e il modo di lavorare restano su GitHub: commit, push, hook dei test come oggi.
- Sul nuovo indirizzo, nell'app installata su iPhone, compare «Accedi con Google» e funziona (accesso a pagina intera, `signInWithRedirect`, con `authDomain` uguale al sito). Il link via email resta come seconda strada.
- Il vecchio indirizzo `margaz90.github.io/Libreria/` continua a funzionare come oggi (link via email) durante la transizione.

## Non obiettivi
- Accedi con Apple (costa 99 $ l'anno, rimandato).
- Anteprime delle pull request su Firebase (canali di anteprima).
- Dominio personalizzato.
- Spostare i dati: i libri passano dal cloud con l'accesso, come dopo una reinstallazione.
- Spegnere GitHub Pages: per ora pubblica come oggi.

## Anti-obiettivi (sarebbe un fallimento anche se funzionasse)
- Perdere o duplicare libri nel passaggio.
- Rompere la vecchia app prima che la nuova sia provata da Diego sul suo iPhone.
- Ricerche di Google Books che smettono in silenzio sul nuovo indirizzo (chiave con referer limitato).
- L'avviso «Aggiorna» che arriva in ritardo per colpa della cache HTTP di Firebase.
- Chiavi o segreti scritti nel repository.

## Vincoli
- PWA statica senza build; percorsi tutti relativi (`./`), quindi la stessa cartella funziona alla radice del nuovo dominio.
- `sw.js` network-first: la cache HTTP non deve servire versioni vecchie di `sw.js`, `index.html`, `app.js`, `style.css`, `cloud.js`, `manifest.webmanifest`.
- La memoria del telefono (`localStorage`) è per sito: sul nuovo indirizzo si parte vuoti, i libri tornano con l'accesso (avviso v89 «Accedi e riprendi i libri»); la memoria delle Novità si rifà con il giro.
- Nessuna chiave nel repository: la chiave per pubblicare sta nei Secrets di GitHub.
- Dalla sessione cloud non si raggiungono Google e Firebase dal vivo: l'accesso Google vero si prova solo sull'iPhone di Diego.

## Approcci considerati
- **A. Azione di GitHub, chiave creata da Diego dalla console web di Google Cloud** — scelto da Diego. Pro: tutto da browser, anche da iPad. Contro: una decina di clic in due console.
- B. Azione di GitHub, chiave creata con `firebase init hosting:github` dal computer. Pro: meno clic. Contro: serve Node e la Firebase CLI sul computer; il comando scrive file suoi da ripulire.
- C. Pubblicare dalla sessione di Claude con la CLI. Scartata: niente pubblicazione automatica e chiavi date a Claude.

Per il vecchio indirizzo Diego ha scelto la **transizione**: per un periodo funziona ancora con un avviso «MyLibrary si è spostata», poi, quando lo dirà lui, diventa solo un rimando. Scartati: due indirizzi per sempre (doppia manutenzione, due memorie) e taglio netto (nessun ripiego se Google non andasse).

## Come (deciso)
### Pubblicazione
- `firebase.json`: `hosting.public = "."`; `ignore` per tutto ciò che non è app: `test/**`, `docs/**`, `design/**`, `.claude/**`, `.superpowers/**`, `.github/**`, `**/*.md`, `.mcp.json`, `firebase.json`, `.firebaserc`, `.nojekyll`, `**/.*`. Restano pubblicate anche `diagnosi-serie.html` e `completa-isbn.html`.
- Intestazioni: `Cache-Control: no-cache` per **ogni** percorso (`source: "**"`), compreso `/` (la `start_url` `./` chiede `/`, che un pattern per estensione non prende: altrimenti varrebbe la cache predefinita di Firebase, circa un'ora, e l'avviso «Aggiorna» arriverebbe in ritardo); poi una regola più specifica che lascia le icone `**/*.png` con `max-age=86400`. Si rivalida con ETag, quindi il costo è minimo. (Scelta del costruttore, dopo la revisione.)
- `.firebaserc` con il progetto `mylibrary-2ea05`.
- `.github/workflows/firebase.yml`: su push a `main`, `actions/checkout@v4` e `FirebaseExtended/action-hosting-deploy@v0` con `channelId: live`, `projectId: mylibrary-2ea05`, `firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_MYLIBRARY_2EA05 }}`, `repoToken: ${{ secrets.GITHUB_TOKEN }}`. Senza il secret l'azione fallisce senza toccare nulla (GitHub Pages pubblica comunque).

### Service worker
- `sw.js` non deve toccare i percorsi riservati di Firebase sullo stesso dominio: le richieste con `pathname` che inizia per `/__/` (`/__/auth/handler`, `/__/auth/iframe`, `/__/firebase/init.json`) passano dalla rete senza `respondWith` e senza cache. Senza questo, su rete lenta il fallback di navigazione darebbe `index.html` al posto della pagina di accesso. (Trovato dalla revisione.)

### Accesso
- Funzione pura `sitoDi(hostname)` in un tratto `// <regole>`: `"firebase"` per `mylibrary-2ea05.web.app` e `mylibrary-2ea05.firebaseapp.com`, `"vecchio"` per `margaz90.github.io`, `"altro"` per il resto (localhost, test). Provata dal gruppo `regole`.
- Il sito si legge da `window.libreriaSito || sitoDi(location.hostname)` (il primo solo per i test, come `libreriaNovitaMs`); esposto a `cloud.js` tramite `libreriaHost.sito`.
- `cloud.js`: `authDomain` = `location.hostname` quando il sito è `"firebase"`, altrimenti `mylibrary-2ea05.firebaseapp.com` come oggi.
- `openSync`: nell'app installata (`navigator.standalone`) il pulsante «Accedi con Google» compare solo sul sito `"firebase"`, e lì usa direttamente `signInWithRedirect` (la finestrella nell'app installata resta appesa), **dopo aver scritto** `sessionStorage["libreria-auth-pending"] = "1"`: al ritorno, su un'installazione nuova (senza `uid` salvato) è quel segnale che fa caricare `cloud.js` (`app.js`, riga con `loadCloud` all'avvio) e quindi `getRedirectResult`; senza, l'accesso andrebbe perso in silenzio. (Trovato dalla revisione.) Il testo sul link via email diventa «Oppure con un link via email». Sul vecchio sito e altrove nell'app installata resta tutto com'è. Fuori dall'app installata nulla cambia (popup, con ripiego sul redirect).
- Stesso account: Diego accede col link usando l'email del suo account Google (confermato da Diego il 14 novembre). Con l'impostazione predefinita di Firebase «Un account per indirizzo email», per un indirizzo @gmail.com l'accesso con Google apre lo stesso utente e gli stessi libri. Se l'indirizzo non fosse @gmail.com (account Google con un altro dominio), Firebase risponde `auth/account-exists-with-different-credential`: l'app lo intercetta e dice «Questo indirizzo è già collegato con il link via email: accedi con il link qui sotto.» invece dell'errore tecnico; niente collegamento automatico degli account (rimandato, se mai servirà).
- Al ritorno dal redirect vale il controllo che c'è già (`libreria-auth-pending` + `getRedirectResult`): se l'accesso non si è completato, avviso con il suggerimento del link via email.

### Vecchio indirizzo
- Fase 1 (questa versione, v90): nessun avviso. Diego prova il nuovo indirizzo con calma.
- Fase 2 (v91, dopo la prova di Diego; **progetto a parte**, non in questo piano): sul sito `"vecchio"` un avviso in cima, sopra la libreria: «MyLibrary si è spostata su mylibrary-2ea05.web.app: aprila in Safari, aggiungila alla Home e accedi; i tuoi libri arrivano dal cloud.» con il link; chiudibile per la sessione. Prima di mostrarlo, se ci sono modifiche non ancora inviate al cloud, la sincronizzazione resta quella di sempre: l'avviso non cambia nulla dei dati.
- Fase 3 (quando lo dirà Diego): il vecchio indirizzo diventa solo un rimando. Fuori da questo progetto.

### Passi di Diego (fuori dal codice, con istruzioni clic per clic)
0. Prima di tutto, nella vecchia app: Altro → Accedi e sincronizza, controllare «Collegato come …» e zero modifiche da inviare; poi Altro → Backup → esporta il JSON e salvarlo in File. È la rete di sicurezza del passaggio.
1. Google Cloud console del progetto `mylibrary-2ea05` → IAM → Account di servizio: nuovo account `github-hosting` con i ruoli che usa l'azione ufficiale: «Amministratore Firebase Hosting» (Firebase Hosting Admin), «Visualizzatore chiavi API» (API Keys Viewer), «Amministratore Firebase Authentication» (Firebase Authentication Admin) e «Visualizzatore Cloud Run» (Cloud Run Viewer); chiave JSON scaricata.
2. GitHub → repository → Settings → Secrets and variables → Actions: secret `FIREBASE_SERVICE_ACCOUNT_MYLIBRARY_2EA05` con il contenuto del JSON; poi cancellare il file JSON dal dispositivo.
3. Google Cloud → Credenziali: alla chiave di Google Books (`GBOOKS_KEY`) e, se limitata, alla chiave del browser di Firebase aggiungere i referer `https://mylibrary-2ea05.web.app/*` e `https://mylibrary-2ea05.firebaseapp.com/*`.
4. Google Cloud → Credenziali → client OAuth «Web client (auto created by Google Service)»: aggiungere l'URI di reindirizzamento `https://mylibrary-2ea05.web.app/__/auth/handler`.
5. Firebase console → Authentication → Impostazioni → Domini autorizzati: controllare che ci sia `mylibrary-2ea05.web.app` (di solito c'è già).
   Nella stessa pagina, «Collegamento degli account utente»: deve essere «Collega gli account che usano la stessa email» (predefinito), non «Crea più account per ogni provider»: altrimenti Google aprirebbe un account nuovo e vuoto.
6. Dopo la pubblicazione: aprire `https://mylibrary-2ea05.web.app/` in Safari, Condividi → Aggiungi alla schermata Home, aprire l'icona nuova, «Accedi e riprendi i libri» → «Accedi con Google». Controllare il numero dei libri. La vecchia icona resta finché Diego non decide.

### Test
- `regole`: `sitoDi` con i tre domini, maiuscole, sottodomini estranei (`evil-mylibrary-2ea05.web.app` → `"altro"`).
- `accesso`: con `window.libreriaSito = "firebase"` e app installata, il pulsante Google c'è, scrive `libreria-auth-pending` e chiama `signInWithRedirect` (lo stub lo registra in `fake-redirect-called`), e al ritorno su un'installazione vuota `cloud.js` si carica; con `"vecchio"` e app installata il pulsante non c'è (come oggi); fuori dall'app installata nulla cambia; l'errore `auth/account-exists-with-different-credential` mostra il messaggio sul link via email.
- `sw.js`: una richiesta a `/__/auth/handler` non finisce nella cache del service worker.
- Un controllo di `firebase.json` da Node (JSON valido, `public` ".", ignorati `test/**` e `.claude/**`, `no-cache` per i `.js`) nel gruppo `regole` o in un gruppo piccolo.
- Suite completa prima del push.

### Documenti
`CLAUDE.md` (dove gira, regole di lavoro), `.claude/rules/sincronizzazione.md` (accesso), `docs/strumenti.md` (azione di GitHub), `docs/funzioni.md`, `docs/storia.md`, `LEGGIMI.md`/`README.md` se citano l'indirizzo.

## Lasciato al costruttore
- Il testo esatto dei suggerimenti nella scheda «Accedi e sincronizza».
- Dove mettere il controllo di `firebase.json` tra i gruppi di test.
- La versione: v90 per fase 1 (con `VERSION` in `sw.js`).
