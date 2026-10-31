---
paths:
  - "cloud.js"
  - "test/firebase-stub.js"
---

## Sincronizzazione con Firebase (in `cloud.js`, caricata solo al bisogno)
- Progetto `mylibrary-2ea05`: Authentication (Google + link email), Firestore in eur3, regole per utente (`users/{uid}`).
- Struttura: `users/{uid}/books/{id}` = libro senza foto (`deleted: true` = eliminato, segnaposto); `users/{uid}/spines/{id}` = foto del dorso (`data`, `at`).
- Conflitti: vince la modifica più recente (`updated`, ms). Foto: `spineAt` dice quale versione è nel cloud.
- Primo accesso con libri su entrambi i lati: chiede se unire (consigliato), usare solo il cloud o solo il dispositivo.
- In `app.js`: `libreriaHost` è il ponte con `cloud.js`; `cloudHook("changed"|"removed", id)` dopo ogni modifica; `libreria-tombs` tiene le eliminazioni fatte da disconnesso.
- Obiettivo di lettura sincronizzato (`users/{uid}/meta/goals`, vince la data più recente). La scheda Sincronizzazione mostra le modifiche non ancora inviate e ha il pulsante Riconnetti.
- SDK Firebase 10.14.1 (compat) da cdn.jsdelivr.net, messo in cache dal service worker.
- Accesso: Google con popup su computer e in Safari. Nell'app installata su iPhone (`navigator.standalone`) Google non funziona: il redirect torna senza accesso (Safari blocca i dati tra `firebaseapp.com` e `github.io`) e il popup resta in attesa per sempre; lì la scheda mostra solo il link via email, con una spiegazione. Per avere Google anche sull'iPhone servirebbe pubblicare l'app sullo stesso dominio dell'accesso (Firebase Hosting). Se il popup è bloccato si ripiega sul redirect, con avviso al ritorno senza accesso. Il selettore chiede sempre l'account (`prompt: select_account`). Dopo l'accesso il messaggio dice quanti libri sono arrivati; se account e dispositivo sono vuoti avvisa che i libri potrebbero essere su un altro account. Oppure link via email. Sull'iPhone il link va copiato e incollato nell'app, senza aprirlo in Safari (il link vale una volta).

