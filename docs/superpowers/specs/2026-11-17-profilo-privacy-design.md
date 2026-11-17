# Nome di ciascuno, privacy, «Elimina il mio account» — progetto

Data: 17 novembre 2026. Richiesta di Diego, dopo la v94 (MyLibrary su invito).

## Perché
Prima di dare il link ad altre persone, Diego vuole che ognuno veda la **sua** libreria («Libreria di Mario Rossi», non «Libreria di Margaira Diego»), che sia chiaro cosa l'app salva e dove, e che ognuno possa cancellare da solo il proprio account e i propri libri.

## Obiettivi
- **Nome**: intestazione «Libreria di {nome}». Con Google il nome del profilo; con il link via email l'app lo chiede una volta al primo ingresso («Come ti chiami?»); si cambia da Altro → «Il tuo nome». Il nome sta nel cloud (`users/{uid}/meta/profilo`), quindi è lo stesso su tutti i dispositivi. Per Diego resta «Margaira Diego» finché non lo cambia lui (scelta A di Diego).
- **Privacy**: pagina `privacy.html` in italiano semplice, raggiungibile dalla porta d'ingresso, da Altro e da «Elimina il mio account». Responsabile: Diego Margaira; al posto dell'email la frase «Per domande sui tuoi dati, o per chiederne la cancellazione, contatta direttamente Diego.» (scelta di Diego).
- **Elimina il mio account**: in «Accedi e sincronizza», solo per chi non è l'amministratore. Conferma in due tocchi (definitivo). Cancella dal cloud libri, foto dei dorsi, obiettivo e profilo, poi **il proprio invito** (scelta A di Diego, 17 novembre: così nessun altro dispositivo ancora collegato può rimandare libri nel cloud), poi l'account Firebase, poi pulisce il dispositivo come «Esci» e torna alla porta. Per tornare, la persona chiede a Diego un nuovo invito.

## Non obiettivi
- Esportare i dati dalla pagina della privacy (c'è già il backup JSON in Backup).
- Email di contatto nella pagina (Diego per ora non la vuole).

## Anti-obiettivi
- Diego che si cancella per sbaglio (il pulsante non c'è per l'amministratore).
- Account cancellato a metà: libri tolti ma account rimasto, o account tolto con i libri rimasti nel cloud senza più nessuno che possa cancellarli.
- Nome di una persona che resta sul dispositivo dopo «Esci» o che passa al prossimo account.
- Intestazione che «salta» (nome sbagliato per un attimo all'apertura).

## Vincoli
- Firebase chiede un accesso recente per eliminare l'account (`auth/requires-recent-login`); con il link via email il rientro richiede un nuovo link.
- Regole di Firestore della v94: ognuno può scrivere e cancellare solo i suoi `users/{uid}/**` se invitato o amministratore; il profilo ci rientra. Cambio unico alle regole: `invitati/{e}` si può **cancellare** anche dal titolare (email verificata uguale a `e`), non crearlo né modificarlo.
- Ogni testo dell'utente (nome) passa da `esc()`; nome ≤ 60 caratteri, spazi ripuliti.

## Approcci considerati
- **A. Nome dal profilo, modificabile, salvato nel cloud** — scelto da Diego.
- B. Solo dal profilo Google (con il link via email, la parte prima della @): scartato, nomi brutti e non correggibili.

## Come (deciso)
### Nome
- `index.html`: il testo fisso «Libreria di Margaira Diego» diventa neutro («La mia libreria») e l'app scrive subito il nome giusto prima del primo disegno (niente nome di Diego per un attimo agli altri).
- Memoria locale `libreria-nome` (per disegnare subito l'intestazione all'apertura, anche offline); tolta da «Esci» (anche dalla schermata «non invitato») ed «Elimina»; aggiunta all'elenco di `pulisciDispositivo`.
- All'avvio: intestazione da `libreria-nome`; se manca e il dispositivo è dell'amministratore (`isAdmin(cloudInfo().uid)`; al primo ingresso di Diego su un dispositivo nuovo l'uid arriva a fine sincronizzazione, e da lì l'intestazione si aggiorna) → «Margaira Diego»; se manca e non c'è nessuno collegato → «La mia libreria» (scelta del costruttore: testo neutro, niente nome di Diego per gli altri).
- In `cloud.js`, dopo l'ingresso ammesso: legge `users/{uid}/meta/profilo`. Se c'è `nome` → `H.nome(nome)`. Se manca: amministratore → nessuna scrittura (resta «Margaira Diego»); `user.displayName` → salva `{ nome: displayName, updated }` e `H.nome`; niente nome → `H.chiediNome()`, che apre «Come ti chiami?» (campo, «Salva»; si può chiudere e lo richiede al prossimo ingresso).
- Altro → «Il tuo nome» (per chi è collegato): campo con il nome attuale, «Salva» → `libreriaCloud.salvaNome(nome)` → profilo nel cloud + `libreria-nome` + intestazione.
- Formato: «Libreria di {nome}» nell'elemento `.exlibris` di `index.html`.

### Privacy
- `privacy.html` statica, stile dell'app (`style.css`), con «Torna all'app» in cima (nell'app installata su iPhone non c'è il tasto indietro). Contenuti: cosa salva (email dell'account, nome, libri con note, citazioni, voti e date, foto dei dorsi), dove (libri e profilo in Firestore di Google, regione `eur3` in Europa; l'account — email e accessi — gestito da Google Firebase Authentication a livello globale; sul dispositivo una copia per l'uso offline), chi vede (solo tu; Diego, come gestore del progetto, tecnicamente può accedervi dalla console di Firebase e non lo fa senza la tua richiesta), cosa va ad altri servizi (titoli, autori e ISBN cercati vanno a Google Books, Apple Books, Open Library, Wikidata; copertine da Google, Apple, Open Library/archive.org; il carattere dei titoli da Google Fonts; questi servizi vedono l'indirizzo IP del dispositivo; nessuna pubblicità, nessun tracciamento), come cancellare (Elimina il mio account; oppure Esci per togliere i dati solo dal dispositivo), contatto (frase di Diego), data di aggiornamento.
- Pubblicata da Pages e Firebase (non in `ignore`); nel service worker passa da `copiaPrima` come le altre pagine (copia della versione alla prima visita; non in `SHELL_FILES`).

### Elimina il mio account
- `libreriaCloud.eliminaAccount()`: amministratore → rifiuta; offline (`navigator.onLine` falso o lettura dal server fallita) → errore `rete`. Se l'ultimo accesso (`Date.parse(user.metadata.lastSignInTime)`) ha più di **3 minuti** (margine rispetto ai 5 di Firebase; ricontrollato subito prima di cancellare) → errore `rientra` e messaggio «Per sicurezza, prima di eliminare l'account rientra: tocca «Esci», accedi di nuovo e torna qui.» (così non si arriva mai a cancellare i libri senza poter cancellare l'account). Altrimenti: ferma i propri invii (`gen++`, timer, `pending`/`gone` vuoti, ascolti chiusi), legge dal server gli id di `books` (senza scaricare le foto) e cancella `books/{id}`, `spines/{id}` per quegli id, `meta/goals`, `meta/profilo` (gruppi di massimo 400), poi `invitati/{propria email}`, poi `user.delete()`; se Firebase risponde comunque `requires-recent-login`, messaggio «I tuoi libri sono stati cancellati; per eliminare anche l'account esci, rientra e riprova.»; poi pulizia come «Esci» e porta.
- Pulsante «Elimina il mio account» in «Accedi e sincronizza» (`#sy-del`), conferma in due tocchi con il testo «Definitivo: cancella i tuoi libri, le foto e il tuo account dal cloud e da questo telefono.», link alla privacy accanto.

### Test
- `firestore` (emulatore): un invitato scrive `meta/profilo` e cancella i suoi documenti; non scrive il profilo di un altro; cancella il proprio invito ma non quello di un altro, e non può crearlo né modificarlo.
- `accesso` (stub esteso con `displayName`, `metadata.lastSignInTime`, `delete()`): nome da Google nell'intestazione; con il link via email «Come ti chiami?» e nome salvato nel cloud; amministratore senza profilo → «Margaira Diego»; Altro → «Il tuo nome» cambia intestazione e cloud; «Esci» toglie `libreria-nome`; «Elimina» (accesso recente) svuota il cloud dell'utente, elimina l'account, pulisce e torna alla porta; «Elimina» con accesso vecchio → messaggio, niente cancellato; l'amministratore non vede «Elimina»; nome con `<b>` mostrato come testo.
- `interfaccia`/`regole`: `privacy.html` risponde, contiene «Diego Margaira» e la frase di contatto, è collegata dalla porta, da Altro e da «Elimina».

## Lasciato al costruttore
- Testi esatti della pagina privacy (italiano semplice, onesto) e dei messaggi.
- Versione: v95.
