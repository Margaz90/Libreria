# Anteprima privata prima di pubblicare

Per vedere una versione nuova sulla propria libreria prima che arrivi a tutti (17 novembre 2026).

## Come funziona
- Claude carica la versione sul branch `anteprima` di GitHub.
- L'azione «Anteprima su Firebase Hosting» (`.github/workflows/anteprima.yml`) la pubblica su un indirizzo temporaneo, del tipo `https://mylibrary-2ea05--anteprima-xxxxxxxx.web.app`. L'indirizzo resta lo stesso per tutte le anteprime e scade 7 giorni dopo l'ultima.
- Il sito vero (https://mylibrary-2ea05.web.app) e le regole di Firestore non cambiano.
- Nell'anteprima si entra con il proprio account e si vede la propria libreria dal cloud. **Attenzione: è la stessa libreria, quindi una modifica fatta nell'anteprima è vera e arriva anche nell'app.**
- Va aperta in Safari, senza aggiungerla alla Home. Sull'indirizzo dell'anteprima non c'è la porta d'ingresso: si entra da Altro → Account.

## Passo di Diego (una volta sola)
L'accesso con Google o con il link via email funziona solo dagli indirizzi autorizzati in Firebase.

1. Apri https://console.firebase.google.com/project/mylibrary-2ea05/authentication/settings, scheda **Impostazioni** → **Domini autorizzati**.
2. Tocca **Aggiungi dominio**.
3. Incolla l'indirizzo dell'anteprima senza `https://` e senza `/` finale, per esempio `mylibrary-2ea05--anteprima-xxxxxxxx.web.app`. Te lo dà Claude.
4. Tocca **Aggiungi**.

Dalla volta dopo l'indirizzo è già autorizzato.
