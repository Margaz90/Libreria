# MyLibrary su invito — i passi di Diego (v94)

Da fare da computer o iPad. Se una schermata non corrisponde, fermati e manda una foto a Claude.

## Prima della pubblicazione

### 1. Le regole di Firestore di oggi (da incollare a Claude)
La v94 sostituisce le regole di Firestore con quelle nuove (in `firestore.rules`). Prima Claude deve vedere quelle di oggi, per non perdere niente.
1. Apri https://console.firebase.google.com/ → progetto **mylibrary-2ea05**.
2. Menu a sinistra: **Build** (o «Crea») → **Firestore Database** → scheda **Regole** (Rules).
3. Seleziona tutto il testo delle regole, copialo e incollalo nella chat con Claude. Non sono un segreto.

### 2. Due ruoli in più per la chiave di GitHub
Servono perché GitHub possa pubblicare anche le regole.
1. Apri https://console.cloud.google.com/ → progetto **mylibrary-2ea05**.
2. ☰ → **IAM e amministrazione** → **IAM**.
3. Nella riga di **github-hosting@mylibrary-2ea05.iam.gserviceaccount.com** tocca la **matita** (Modifica entità).
4. **+ Aggiungi un altro ruolo** e aggiungi, uno alla volta:
   - **Amministratore regole Firebase** (Firebase Rules Admin)
   - **Consumer Service Usage** (Service Usage Consumer)
   - **Visualizzatore Service Usage** (Service Usage Viewer): senza, la pubblicazione si ferma con «Permission denied to get service» (17 novembre 2026)
   I ruoli nuovi diventano attivi dopo qualche minuto: se la pubblicazione fallisce con «The caller does not have permission» subito dopo averli aggiunti, si riprova più tardi.
5. **Salva**.

### 3. Dillo a Claude
Claude controlla le regole di oggi e pubblica la v94. Nella scheda **Actions** di GitHub, «Pubblica su Firebase Hosting» deve avere la spunta verde, compreso il passo «Pubblica le regole di Firestore».

## Dopo la pubblicazione

### 4. La tua email tra gli invitati (riserva)
Tu entri comunque come amministratore (il tuo uid è nelle regole). Per sicurezza aggiungi anche la tua email:
1. Apri MyLibrary → aggiorna alla v94 → **Altro** → **Invitati**.
2. Scrivi la tua email (quella con cui accedi) → **Aggiungi**.

### 5. Invitare una persona
1. **Altro** → **Invitati** → scrivi la sua email (quella di Google, o quella con cui chiederà il link) → **Aggiungi**.
2. Mandale il link **https://mylibrary-2ea05.web.app/**: lo apre in Safari, lo aggiunge alla Home, entra con Google o con il link via email.
3. Per togliere qualcuno: **Togli** due volte. Alla sua prossima apertura con la rete vede «Questa libreria è su invito»; il cloud gli nega subito i dati.

### 6. Una prova
Con un'email non invitata (per esempio una seconda casella tua) prova a entrare: deve comparire «Questa libreria è su invito. L'indirizzo … non è tra gli invitati.» Poi «Esci e usa un altro account».
