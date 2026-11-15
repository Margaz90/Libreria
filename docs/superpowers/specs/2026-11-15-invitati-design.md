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
- Amministratore: elenco `ADMIN_UIDS` nelle regole e in `app.js` con gli uid di Diego (15 novembre: `46AtxF1piJQGsWcqm665Wjf6nFA3`, dato da Diego), letti da lui nella console (Authentication → Utenti → «UID utente»: se la sua email compare in più righe, tutti). In più la sua email è anche tra gli invitati, come riserva. Le regole si pubblicano solo con gli uid veri: un segnaposto lo chiuderebbe fuori (l'azione GitHub le pubblica a ogni push). (Dopo la revisione.)

### Regole (`firestore.rules`, bozza)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function admin() { return request.auth != null && request.auth.uid in ["46AtxF1piJQGsWcqm665Wjf6nFA3"]; }
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
- All'avvio, prima di disegnare la libreria: se `libreria-cloud` non ha un utente (`uid`) → schermata d'accesso a schermo pieno (stesso contenuto di «Accedi e sincronizza», senza «Chiudi»; l'SDK di Firebase si carica mentre la schermata compare, il pulsante Google si abilita a caricamento finito, come oggi). Se ha un utente e `ammesso` non è `false` (cioè `true`, o assente: i dispositivi già collegati prima di questa versione, compreso quello di Diego) → app normale subito, controllo in sottofondo. Solo `ammesso === false` mostra la schermata «non invitato». (Dopo la revisione.)
- Controllo dell'invito in `cloud.js`, in `onAuthStateChanged` **prima** di `start()` e di `H.connected()` (così un non invitato non arriva a sincronizzazione, unione o copie); `ammesso` si scrive attraverso la copia `ck` di `cloud.js` (oggi `saveCk` riscriverebbe la chiave). Regole: amministratore → ammesso; altrimenti lettura di `invitati/{email}`: esiste → ammesso; non esiste → `ammesso = false` e schermata «non invitato»; errore di rete → si tiene l'ultimo stato (offline si apre come prima).
- Schermata «non invitato»: titolo, testo «Questa libreria è su invito. L'indirizzo … non è tra gli invitati. Chiedi a Diego di aggiungerti.», pulsante «Esci e usa un altro account» (esce da Firebase e torna alla schermata d'accesso). I libri locali di quel dispositivo non si cancellano (restano nascosti).
- **Uscita dall'account** (scelta A di Diego, 15 novembre: un telefono può passare da una persona all'altra senza mescolare le librerie): «Esci» chiede conferma («I tuoi libri restano nel cloud; da questo telefono vengono tolti»), poi toglie dal dispositivo libri, foto dei dorsi, segnaposto, impostazioni dell'account e memoria delle Novità, e torna alla schermata d'accesso. Con modifiche non ancora inviate al cloud (`pending`/`gone` in `cloud.js` o scritture in attesa di Firestore) l'uscita è bloccata con il messaggio «Ci sono modifiche non ancora salvate nel cloud: collegati alla rete e riprova». Anche «Esci» dalla schermata «non invitato» toglie i dati locali (di solito vuoti). Al primo accesso di un account diverso dall'ultimo su quel dispositivo (`ck.uid` diverso) non si propone l'unione: i libri locali, se ci fossero, non vanno nel cloud del nuovo account.
- Scartata (B): libri separati per account sullo stesso telefono, più complicata e con lo spazio delle foto moltiplicato.

### Sezione «Invitati» (solo amministratore)
- Voce «Invitati» in Altro, solo se l'utente è l'amministratore. Scheda: elenco delle email (dalla raccolta `invitati`, ordinate), campo email + «Aggiungi» (convalida formato, minuscolo, niente doppioni), «Togli» con conferma in due tocchi, testo breve «Manda a questa persona il link dell'app: entra con Google o con il link via email usando questo indirizzo.»

### Pubblicazione delle regole
- `firebase.json` con `"firestore": { "rules": "firestore.rules" }` e `firestore.rules`, `test/firestore/**` tra gli `ignore` dell'hosting; nell'azione GitHub un secondo passo `npx firebase-tools@<versione fissa> deploy --only firestore:rules --project mylibrary-2ea05 --non-interactive` con la stessa chiave (`GOOGLE_APPLICATION_CREDENTIALS` da un file temporaneo). Ruoli in più per l'account `github-hosting`: «Amministratore regole Firebase» (Firebase Rules Admin) e «Consumer Service Usage» (Service Usage Consumer), senza il quale la CLI non riesce a controllare l'API delle regole.

### Test
- Nuovo gruppo `firestore` (da Node, con l'emulatore ufficiale di Firestore via `firebase-tools` e `@firebase/rules-unit-testing`, in una cartella `test/firestore/` con il suo `package.json`; serve Java 21, presente; se Java o il download dell'emulatore mancano, il gruppo lo dice e si salta senza far fallire la suite): amministratore legge e scrive i suoi libri e l'elenco; invitato (Google e link email, email in maiuscolo) legge e scrive solo i suoi; non invitato non legge né scrive niente; invitato non legge i libri altrui né l'elenco altrui né scrive in `invitati`; email non verificata respinta; invitato tolto perde subito l'accesso; un invio di 400 libri in un colpo di un invitato passa (limite di 20 letture `exists()` per scrittura multipla).
- `accesso` (con lo stub di Firebase esteso a `invitati`): senza utente compare la schermata d'accesso; invitato entra; non invitato vede la schermata e «Esci» funziona; ammesso offline apre subito; amministratore vede «Invitati», aggiunge e toglie; un invitato non vede «Invitati».
- `accesso`: «Esci» toglie i libri dal dispositivo e torna alla schermata d'accesso; con modifiche in sospeso è bloccato; un secondo account sullo stesso dispositivo non vede né riceve i libri del primo.
- Gli altri gruppi restano verdi: i test che usano l'app senza accesso entrano con un utente finto ammesso.

## Lasciato al costruttore
- Testi esatti delle schermate (italiano semplice, tono dell'app).
- Come i test esistenti entrano già «ammessi» (aiuto in `test/lib.mjs`).
- Versione: v94 (la v93 è l'apertura veloce).
