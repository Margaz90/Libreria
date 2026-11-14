# MyLibrary sul nuovo indirizzo — i passi di Diego (v90)

Nuovo indirizzo: **https://mylibrary-2ea05.web.app/**. Il vecchio (`margaz90.github.io/Libreria/`) continua a funzionare come prima.

Meglio farli da computer o iPad: servono un file da scaricare e da copiare. Ci vogliono circa 20 minuti. Se una schermata non corrisponde, fermati e mandami una foto: i nomi dei menu di Google cambiano spesso.

## Prima della pubblicazione

### 0. Rete di sicurezza (sull'iPhone, nella vecchia app)
1. Altro → **Accedi e sincronizza**: deve dire «Collegato come …» con la tua email e nessuna modifica da inviare.
2. Altro → **Backup** → esporta il backup JSON e salvalo in File (o iCloud Drive).

### 1. La chiave per GitHub (Google Cloud)
1. Apri https://console.cloud.google.com/ con il tuo account Google e in alto scegli il progetto **mylibrary-2ea05**.
2. Menu ☰ → **IAM e amministrazione** → **Account di servizio** → **+ Crea account di servizio**.
3. Nome: `github-hosting` → **Crea e continua**.
4. Aggiungi questi quattro ruoli (cerca il nome nel campo «Ruolo», poi **+ Aggiungi un altro ruolo**):
   - **Amministratore Firebase Hosting** (Firebase Hosting Admin)
   - **Visualizzatore chiavi API** (API Keys Viewer)
   - **Amministratore Firebase Authentication** (Firebase Authentication Admin)
   - **Visualizzatore Cloud Run** (Cloud Run Viewer)
5. **Continua** → **Fine**.
6. Tocca l'account `github-hosting` appena creato → scheda **Chiavi** → **Aggiungi chiave** → **Crea nuova chiave** → **JSON** → **Crea**. Si scarica un file `.json`: è una chiave, non condividerla con nessuno (nemmeno con me).

### 2. La chiave dentro GitHub (Secrets)
1. Apri https://github.com/Margaz90/Libreria → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Name: `FIREBASE_SERVICE_ACCOUNT_MYLIBRARY_2EA05` (esattamente così).
3. Secret: apri il file `.json` con un editor di testo (TextEdit, Blocco note), copia **tutto** il contenuto e incollalo qui → **Add secret**.
4. Cancella il file `.json` dal computer (e dal Cestino).

### 3. Hosting attivo (Firebase)
1. Apri https://console.firebase.google.com/ → progetto **mylibrary-2ea05** → menu **Hosting** (sotto «Build» o «Crea»).
2. Se compare **Inizia**, toccalo e vai avanti fino alla fine senza fare nulla dei comandi che mostra (li fa GitHub). Se l'Hosting è già attivo, salta.

### 4. Dimmi «fatto»
Io pubblico la v90 su `main`. Dopo un paio di minuti, nella scheda **Actions** del repository deve comparire «Pubblica su Firebase Hosting» con la spunta verde. Se è rossa, mandami il messaggio d'errore.

## Dopo la pubblicazione

### 5. Il nuovo indirizzo nelle chiavi di Google (Google Cloud)
Senza questo passo, sul nuovo indirizzo trame e copertine da Google Books e l'accesso con Google non funzionano.

1. https://console.cloud.google.com/ → progetto **mylibrary-2ea05** → ☰ → **API e servizi** → **Credenziali**.
2. Sezione **Chiavi API**: apri la chiave che inizia con **AIzaSyDsTZ** (quella di Google Books). Se in «Restrizioni dell'applicazione» c'è **Siti web**, aggiungi questi due elementi e **Salva**:
   - `https://mylibrary-2ea05.web.app/*`
   - `https://mylibrary-2ea05.firebaseapp.com/*`
   Se c'è «Nessuna», non serve fare nulla.
3. Stessa cosa per la chiave che inizia con **AIzaSyA5x9** (quella di Firebase, di solito «Browser key»).
4. Sezione **ID client OAuth 2.0**: apri **Web client (auto created by Google Service)**.
   - In **Origini JavaScript autorizzate** aggiungi `https://mylibrary-2ea05.web.app`
   - In **URI di reindirizzamento autorizzati** aggiungi `https://mylibrary-2ea05.web.app/__/auth/handler`
   - **Salva**. Le modifiche possono metterci qualche minuto.

### 6. Due controlli in Firebase
1. https://console.firebase.google.com/ → **mylibrary-2ea05** → **Authentication** → **Impostazioni**.
2. **Domini autorizzati**: deve esserci `mylibrary-2ea05.web.app` (di solito c'è già; se manca, **Aggiungi dominio**).
3. **Collegamento degli account utente**: deve essere **«Collega gli account che usano la stessa email»**. Se è «Crea più account per ogni provider», Google aprirebbe un account nuovo e vuoto.

### 7. La prova sull'iPhone
1. Apri **https://mylibrary-2ea05.web.app/** in **Safari**.
2. Condividi → **Aggiungi alla schermata Home**. Avrai due icone MyLibrary: la nuova è quella appena aggiunta.
3. Apri la nuova icona: la libreria è vuota → **Accedi e riprendi i libri** → **Accedi con Google** → scegli il tuo account.
4. Devono tornare tutti i libri: confronta il numero con la vecchia app.
5. Dimmi com'è andata. Se Google non torna all'app, usa il link via email (c'è sempre) e mandami cosa hai visto.

La vecchia icona resta finché non decidi tu. Quando sei tranquillo, prepariamo la v91 con l'avviso «MyLibrary si è spostata» sul vecchio indirizzo.
