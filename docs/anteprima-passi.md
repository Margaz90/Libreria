# Anteprima privata prima di pubblicare

Per vedere una versione nuova sulla propria libreria prima che arrivi a tutti (17 novembre 2026).

## Come funziona
- Claude carica la versione sul branch `anteprima` di GitHub.
- L'azione «Anteprima su Firebase Hosting» (`.github/workflows/anteprima.yml`) la pubblica su un indirizzo temporaneo, del tipo `https://mylibrary-2ea05--anteprima-xxxxxxxx.web.app`. L'indirizzo resta lo stesso per tutte le anteprime e scade 7 giorni dopo l'ultima.
- Il sito vero (https://mylibrary-2ea05.web.app) e le regole di Firestore non cambiano.
- Nell'anteprima si entra con il proprio account e si vede la propria libreria dal cloud. **Attenzione: è la stessa libreria, quindi una modifica fatta nell'anteprima è vera e arriva anche nell'app.**
- Va aperta in Safari, senza aggiungerla alla Home. L'indirizzo `mylibrary-2ea05--anteprima-roidf2ds.web.app` è in `SITI` come sito «firebase»: porta d'ingresso e accesso con Google a pagina intera come sul sito vero.

## Passo di Diego (una volta sola)
L'accesso con Google o con il link via email funziona solo dagli indirizzi autorizzati in Firebase.

1. Apri https://console.firebase.google.com/project/mylibrary-2ea05/authentication/settings, scheda **Impostazioni** → **Domini autorizzati**.
2. Tocca **Aggiungi dominio**.
3. Incolla l'indirizzo dell'anteprima senza `https://` e senza `/` finale, per esempio `mylibrary-2ea05--anteprima-xxxxxxxx.web.app`. Te lo dà Claude.
4. Tocca **Aggiungi**.

### In Google Cloud (stessi punti fatti per la v90 in firebase-hosting-passi.md, passo 5)
Senza questi passi l'accesso risponde «requests-from-referer-…-are-blocked» e Google non fa nulla.

1. https://console.cloud.google.com/apis/credentials?project=mylibrary-2ea05
2. **Chiavi API** → la chiave che inizia con **AIzaSyA5x9** (Firebase, «Browser key») → in «Restrizioni dei siti web» **Aggiungi** `https://mylibrary-2ea05--anteprima-roidf2ds.web.app/*` → **Salva**.
3. Stessa cosa per la chiave **AIzaSyDsTZ** (Google Books: trame, copertine e Novità nell'anteprima).
4. **ID client OAuth 2.0** → **Web client (auto created by Google Service)**:
   - **Origini JavaScript autorizzate**: aggiungi `https://mylibrary-2ea05--anteprima-roidf2ds.web.app`
   - **URI di reindirizzamento autorizzati**: aggiungi `https://mylibrary-2ea05--anteprima-roidf2ds.web.app/__/auth/handler`
   - **Salva**. Possono servire alcuni minuti.

Dalla volta dopo l'indirizzo è già autorizzato.
