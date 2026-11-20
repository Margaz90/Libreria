# Product brief — MyLibrary

Mode: existing · Scritto il 19 novembre 2026 per la skill `om-synthetic-users` · Fonti: CLAUDE.md, docs/funzioni.md, docs/storia.md, richieste scritte di Diego nelle sessioni di novembre 2026.

Livelli delle fonti: `[PRODUCT]` = l'app e la sua documentazione; `[INTERVIEW]` = ciò che Diego ha scritto di sé usando l'app (un solo utente, conversazioni informali, non interviste strutturate); `[DOCUMENT]` = scelte e aspettative scritte da Diego; `[BENCHMARK]` = fatti noti su altre app di lettura; `[ASSUMPTION]` = nessuna fonte.

## Target group
- S1. Chi legge molto e tiene traccia di tutto dal telefono (il proprietario): libreria di 108 libri arrivata da Goodreads, app installata sulla Home dell'iPhone, usata anche da computer e iPad. `[INTERVIEW]` `[PRODUCT]`
- S2. Invitati che arrivano con una lista già pronta (Goodreads, Excel). `[DOCUMENT]` («Molto probabile che ci saranno sia persone con liste di libri già pronte, sia chi caricherà 1 per 1», Diego, 17 novembre 2026)
- S3. Invitati che partono da zero e caricano i libri uno a uno. `[DOCUMENT]` (stessa frase)
- S4. Invitati con un telefono Android o schermi piccoli. `[DOCUMENT]` (Diego chiede che la grafica scali «anche andando su un telefono non Apple», 17 novembre 2026)
- S5. Chi legge poco ed entra perché invitato da un amico. `[ASSUMPTION]` (nessuna fonte: posto dell'indifferente)
Proporzioni: nessun dato. Composizione del pannello assunta.

## Problems
- P1. Tenere il conto di letti, in lettura e da leggere senza fatica, soprattutto dal telefono. `[PRODUCT]`
- P2. Non perdere i libri: memoria del dispositivo separata da Safari, recupero solo dal cloud o da un backup. `[PRODUCT]`
- P3. Scegliere cosa leggere dopo tra i «Da leggere». `[PRODUCT]`; Diego: «non lo uso così spesso» `[INTERVIEW]`
- P4. Sapere delle nuove uscite dei propri autori. `[PRODUCT]`

## Goals
- G1. Aprire l'app ad altre persone su invito, che la capiscano senza spiegazioni («l'obiettivo finale sarà mettere a disposizione questa app ad altri utenti oltre a me»). `[DOCUMENT]`
- G2. App leggera, veloce sul telefono. `[DOCUMENT]`
- G3. Interfaccia semplice: Diego ha trovato «Altro» confusionario e l'ha fatto riordinare (v96). `[INTERVIEW]`

## Product (cosa c'è oggi, v105) `[PRODUCT]`
- Porta d'ingresso: si entra solo con un invito (Google o link via email).
- Libreria vuota: «Aggiungi il primo libro», «Carica da un file» (Excel, CSV anche Goodreads, JSON), «Accedi e riprendi i libri».
- Nuovo libro: ricerca per titolo, autore o ISBN, scanner del codice a barre, inserimento a mano.
- Libreria a scaffali (dorsi o copertine), filtri a pillole, lente per cercare e ordinare, menu rapido con pressione prolungata (suggerimento mostrato una volta).
- In alto i libri in lettura con pagina, +10 e +N; senza letture «Cosa leggo adesso?».
- Scheda del libro «Frontespizio»: stato, date, voto, note, citazione, serie.
- Letti: stelle obbligatorie da 1 a 5.
- Statistiche per anno con obiettivo annuale ad anello; Novità per te (uscite dei propri autori, proposte).
- Altro: Account, I miei libri (Carica, Backup, Annulla), Strumenti, Aiuto «Come funziona».
- Sincronizzazione tra dispositivi con l'accesso.

## Key flows
### Prima settimana con MyLibrary
Dall'invito al primo uso quotidiano: entrare, avere i propri libri nell'app (da un file o uno a uno), segnare il libro che si sta leggendo e aggiornare la pagina, finirlo e dargli le stelle, guardare cosa si è letto (Statistiche) e cosa uscirà (Novità), trovare le impostazioni (Altro).

## Business rules
- R01. Si entra solo su invito. `[PRODUCT]`
- R02. Un libro Letto ha sempre un voto da 1 a 5. `[PRODUCT]`
- R03. Niente date nel futuro né fine prima dell'inizio. `[PRODUCT]`
- R04. I dati stanno sul dispositivo; il cloud è facoltativo ma è l'unico recupero oltre al backup. `[PRODUCT]`

## Non-goals
- N01. Social: niente amici, recensioni pubbliche, classifiche. `[PRODUCT]`
- N02. Selezione multipla dei libri (esclusa da Diego, 18 novembre 2026). `[DOCUMENT]`
- N03. Acquisto di libri dentro l'app. `[PRODUCT]`

## Riskiest assumptions
- A01. Un invitato con una lista di Goodreads o Excel riesce a portarla dentro senza aiuto.
- A02. Chi parte da zero aggiunge i primi libri senza scoraggiarsi.
- A03. Aggiornare la pagina e finire un libro è più rapido che non farlo (altrimenti l'app si abbandona).
- A04. Le stelle obbligatorie non danno fastidio.
- A05. Si capisce che i libri vanno salvati nel cloud (accesso) per non perderli.
- A06. Statistiche e Novità bastano a far tornare chi legge poco.

## Domain glossary
Scaffale, dorso, Da leggere / In lettura / Letto, Frontespizio (scheda del libro), lista dei desideri, obiettivo annuale, Novità per te, Altro.
