# MyLibrary su invito — progetto

Data: 15 novembre 2026. Richiesta di Diego.

## Perché
Diego vuole poter dare il link dell'app ad alcune persone scelte da lui, ognuna con la sua libreria. Chi non è invitato non deve poter usare l'app né il cloud (né consumare la quota della chiave di Google Books e lo spazio gratuito di Firebase). Scelte di Diego:
- solo persone invitate da lui (elenco di email) — 14–15 novembre;
- chi non è invitato vede una schermata che dice che non è invitato;
- l'app si apre solo dopo l'accesso; chi ha già fatto l'accesso la apre normalmente, subito, anche offline;
- l'elenco lo gestisce Diego da una sezione «Invitati» dell'app, visibile solo a lui (strada A).

## Obiettivi
- **Porta d'ingresso**: senza accesso l'app mostra solo la schermata di accesso (Google dove funziona, link via email sempre). Con accesso e invito (o se è Diego) l'app si apre come oggi. Con accesso ma senza invito: schermata «Questa libreria è su invito» con l'indirizzo usato e «Esci e usa un altro account».
- **Il server decide**: regole di Firestore che permettono a ciascuno solo i propri dati (`users/{uid}/…`) e solo se invitato o amministratore; l'elenco degli invitati lo scrive solo l'amministratore.
- **Sezione «Invitati»** in Altro, solo per Diego: elenco delle email, campo «Aggiungi», «Togli» con conferma.
- **Regole nel repository** (`firestore.rules`), provate con l'emulatore ufficiale di Firestore e pubblicate da GitHub insieme all'app.
- Chi ha già fatto l'accesso apre l'app senza attese e offline, come oggi.

## Non obiettivi
- Intestazione con il nome di ciascuno (resta «Libreria di Margaira Diego» per ora; voce a parte in «Altre idee»).
- Pagina sulla privacy e «Elimina il mio account» (passo successivo prima di invitare davvero qualcuno: va in «Altre idee», non in questo progetto).
- Bloccare l'uso della chiave di Google Books da parte di chi ha solo il link (non si può del tutto in un'app pubblica: la porta d'ingresso lo rende solo scomodo).
- Ruoli diversi dall'amministratore e dall'invitato; inviti con scadenza; email di invito automatiche (Diego manda il link a voce o per messaggio).

## Anti-obiettivi
- **Diego chiuso fuori dai suoi libri** (regole sbagliate, uid sbagliato, controllo che fallisce offline).
- Un invitato che vede o modifica i libri di un altro.
- Apertura dell'app rallentata dal controllo dell'invito.
- Regole pubblicate che cancellano permessi oggi in uso senza saperlo (le regole attuali della console vanno lette prima).

## Vincoli
- Piano gratuito di Firebase (niente funzioni di blocco all'accesso, che richiedono il piano a pagamento).
- Firebase compat 10.14.1 già in uso; Firestore `users/{uid}/books|spines|meta`.
- Regole: email dal token in minuscolo (`request.auth.token.email.lower()`), solo `email_verified == true` (vero per Google e per il link via email).
- Nessun dato personale di altri nel repository: l'amministratore è indicato con il suo **uid** (non è un segreto), non con l'email.

## Approcci considerati
- **A. Elenco in Firestore gestito dall'app, sezione visibile solo a Diego** — scelto da Diego. Pro: Diego fa tutto da solo, anche dall'iPhone. Contro: una schermata in più, regole più articolate.
- B. Elenco scritto nelle regole. Pro: meno codice. Contro: ogni invito richiede un passaggio tecnico.
- C. Funzioni di blocco all'accesso di Firebase. Scartata: piano a pagamento.

## Come (deciso)
### Dati
- `invitati/{email}` (id = email in minuscolo): `{ aggiunto: <ms>, da: <uid amministratore> }`.
- Amministratore: costante `ADMIN_UID` nelle regole e in `app.js` (uid di Diego, letto da lui nella console: Authentication → Utenti → «UID utente»).

### Regole (`firestore.rules`, bozza)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function admin() { return request.auth != null && request.auth.uid == "<ADMIN_UID>"; }
    function email() { return request.auth.token.email.lower(); }
    function invitato() { return request.auth != null && request.auth.token.email_verified == true
      && exists(/databases/$(db)/documents/invitati/$(email())); }
    match /users/{uid}/{doc=**} { allow read, write: if request.auth != null && request.auth.uid == uid && (admin() || invitato()); }
    match /invitati/{e} { allow read: if admin() || (request.auth != null && request.auth.token.email_verified == true && email() == e);
                          allow write: if admin(); }
  }
}
```
- Prima di pubblicarle, Diego copia le regole attuali dalla console: se contengono permessi non previsti qui, si decidono prima.

### Porta d'ingresso (app.js)
- All'avvio, prima di disegnare la libreria: se `libreria-cloud` non ha un utente → schermata d'accesso (la stessa scheda «Accedi e sincronizza», a schermo pieno, senza «Chiudi»). Se ha un utente ed è segnato come ammesso (`libreria-cloud.ammesso = true` dall'ultimo controllo riuscito) → app normale subito, controllo in sottofondo.
- Controllo dell'invito (in `cloud.js`, dopo l'accesso e a ogni avvio con rete): amministratore → ammesso; altrimenti lettura di `invitati/{email}`: esiste → ammesso; non esiste → `ammesso = false` e schermata «non invitato»; errore di rete → si tiene l'ultimo stato (offline si apre come prima).
- Schermata «non invitato»: titolo, testo «Questa libreria è su invito. L'indirizzo … non è tra gli invitati. Chiedi a Diego di aggiungerti.», pulsante «Esci e usa un altro account» (esce da Firebase e torna alla schermata d'accesso). I libri locali di quel dispositivo non si cancellano (restano nascosti).
- Uscita dall'account (già esistente in «Accedi e sincronizza»): riporta alla schermata d'accesso.

### Sezione «Invitati» (solo amministratore)
- Voce «Invitati» in Altro, solo se l'utente è l'amministratore. Scheda: elenco delle email (dalla raccolta `invitati`, ordinate), campo email + «Aggiungi» (convalida formato, minuscolo, niente doppioni), «Togli» con conferma in due tocchi, testo breve «Manda a questa persona il link dell'app: entra con Google o con il link via email usando questo indirizzo.»

### Pubblicazione delle regole
- `firebase.json` con `"firestore": { "rules": "firestore.rules" }`; nell'azione GitHub un secondo passo `npx firebase-tools@<versione fissa> deploy --only firestore:rules --project mylibrary-2ea05 --non-interactive` con la stessa chiave (`GOOGLE_APPLICATION_CREDENTIALS` da un file temporaneo). Ruolo in più per l'account `github-hosting`: «Amministratore regole Firebase» (Firebase Rules Admin).

### Test
- Nuovo gruppo `firestore` (da Node, con l'emulatore ufficiale di Firestore via `firebase-tools` e `@firebase/rules-unit-testing`, in una cartella `test/firestore/` con il suo `package.json`; se Java o il download mancano, il gruppo lo dice e si salta senza far fallire la suite): amministratore legge e scrive i suoi libri e l'elenco; invitato (Google e link email, email in maiuscolo) legge e scrive solo i suoi; non invitato non legge né scrive niente; invitato non legge i libri altrui né l'elenco altrui né scrive in `invitati`; email non verificata respinta; invitato tolto perde subito l'accesso.
- `accesso` (con lo stub di Firebase esteso a `invitati`): senza utente compare la schermata d'accesso; invitato entra; non invitato vede la schermata e «Esci» funziona; ammesso offline apre subito; amministratore vede «Invitati», aggiunge e toglie; un invitato non vede «Invitati».
- Gli altri gruppi restano verdi: i test che usano l'app senza accesso entrano con un utente finto ammesso.

## Lasciato al costruttore
- Testi esatti delle schermate (italiano semplice, tono dell'app).
- Come i test esistenti entrano già «ammessi» (aiuto in `test/lib.mjs`).
- Versione: la prima libera.
