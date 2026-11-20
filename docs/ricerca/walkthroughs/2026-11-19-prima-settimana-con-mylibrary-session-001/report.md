# Walkthrough: Prima settimana con MyLibrary, app v105 (--app), 2026-11-19

[ASSUMPTION] Base quasi tutta assunta: l'unica voce vera è Diego (S1), da richieste scritte; gli invitati (S2–S5) sono ipotesi. Ciò che segue è [SYNTHETIC]: ipotesi da provare con i primi invitati veri, non prove.

L'ipotesi più forte e ripetuta: **le stelle obbligatorie per «Letto» fermerebbero chi ha fretta, chi non ha un'opinione e chi importa libri senza voto** (9 persone su 10, entrambi i giri). Verifica: chiedere ai primi 3-5 invitati di segnare come letto un libro finito da tempo e osservare se danno un voto a caso, mollano o lo fanno volentieri.

Stance: validate
Panel: 2 runs × 5 personas; run 1 P01–P05, run 2 P06–P10
Basis: docs/ricerca/product-brief.md (PRODUCT, DOCUMENT, una sola fonte INTERVIEW: Diego), CLAUDE.md, docs/funzioni.md
Panel snapshot: docs/ricerca/walkthroughs/2026-11-19-prima-settimana-con-mylibrary-session-001/personas.md
Session: docs/ricerca/walkthroughs/2026-11-19-prima-settimana-con-mylibrary-session-001/; subject: app v105 dal server dei test; flow «Prima settimana con MyLibrary»
Composition: assunta (un posto per segmento S1–S5, nessun dato sulle proporzioni); posto dell'indifferente S5 assunto
Saturation: non raggiunta: nelle ultime tre interviste (P07, P09, P10) sono comparsi temi nuovi (abbinamento delle colonne, scritte grandi e contrasto, promemoria)
Parity: skipped: nessuna intervista reale
Elapsed: persone e brief ~15 min, schermate ~5 min, interviste e percorsi ~2 min per persona (in parallelo), consolidamento ~15 min
Not askable of this panel: A05 (capire che serve l'accesso per non perdere i libri) è sollevata ma le schermate 02-14 sono senza accesso: non valutabile qui.

## 🎯 Scope and limits

- App v105 in Chromium, 390x844 (più 360x780 e 320x568), libreria di prova `libri108()`, fonti esterne simulate, copertine da internet bloccate. Mai la libreria o l'account di Diego.
- **Percorso non interattivo**: le schermate sono state catturate prima, in un ordine fisso (01–17). Le persone non potevano scegliere cosa toccare; dove avrebbero toccato altro è registrato come attrito.
- **Artefatti della cattura, scartati dai risultati**:
  - Dalla schermata 02 in poi l'utente **non** è collegato. Un invitato vero, passata la porta, è collegato: vede «Aggiungi il primo libro» come pulsante principale (test `benvenuto`) e non vede «Accedi» in Altro. Le segnalazioni «pulsante rosso sbagliato nella libreria vuota» (8 persone) e «Accedi dopo essere entrato» (5) nascono da qui.
  - Il suggerimento della pressione prolungata (avviso una volta sola, v101) era già segnato come visto, quindi nessuno l'ha visto.
  - «Pag» tagliato dopo +10: era l'avviso «Pagina 130 · Annulla» mentre entrava; lo screenshot 08 lo mostra intero.
  - «Affine / Il più vecchio / A caso»: nel testo estratto comparivano le etichette per VoiceOver dei puntini; a schermo c'è solo «Affine ai tuoi gusti».
  - «76 libri senza anno» in Statistiche dipende dai libri di prova.
- Lettura delle immagini disomogenea: P10 ha lavorato solo sul testo, P03 e P05 su 2-3 immagini. I risultati sull'aspetto (dimensioni, contrasto) poggiano su meno persone di quanto dica il peso.
- Non percorsi: esito di un caricamento da file, accesso con Google o link via email, tasto indietro di Android, app installata.

## 🔍 Barriers that repeated (worst first, ties marked)

### 1. Stelle obbligatorie per segnare «Letto»
[SYNTHETIC]
Weight: 9; spread: ±1 (run 1: P02, P03, P04, P05; run 2: P06, P07, P08, P09, P10). P01 non la vede come barriera ma non capisce se «Mi è piaciuto» vada confermato.
Schermata 10. Reazione a caldo ricorrente: «non ho un'opinione / non ricordo / ho fretta → tocco a caso o lascio il libro tra i Da leggere». Tocca R02 e attacca A04.
Verifica: 3-5 invitati, compito «segna come letto un libro finito anni fa»; osservare i voti a caso e gli abbandoni.

### 2. Il menu rapido si scopre solo per caso, con «Elimina» accanto (pari merito con 3 e 4)
[SYNTHETIC]
Weight: 8; spread: ±0 (run 1: P01, P03, P04, P05; run 2: P06, P08, P09, P10). «Elimina» vicino: P01, P04, P05, P09.
Schermata 09. Limite: il suggerimento una tantum (v101) non era visibile nella cattura. Tocca A03.
Verifica: un invitato nuovo, senza aiuto, deve segnare un libro come letto dallo scaffale; vede l'avviso? Usa la scheda o la pressione?

### 3. Scheda del libro piena; non è chiaro se le modifiche si salvano da sole (pari merito)
[SYNTHETIC]
Weight: 7; spread: ±1 (run 1: P01, P03, P04, P05; run 2: P06, P09, P10).
Schermata 11. «Fotografa il dorso», «Altra copertina», ritmo di lettura, data sottolineata: «sembra un esame». Dubbio ricorrente: dopo «+10» o la pagina serve «Salva»?
Verifica: test con 3 invitati, compito «aggiorna la pagina dalla scheda e chiudi»; contare chi tocca Salva e chi teme di aver perso la modifica.

### 4. Accesso con il link via email incomprensibile (pari merito)
[SYNTHETIC]
Weight: 7; spread: ±0 (run 1: P03, P04, P05; run 2: P06, P08, P09, P10).
Schermata 01. «Copialo e incollalo senza aprirlo» non si capisce; chi ha Google tocca quello, chi non lo vuole usare si ferma. Tocca R01.
Verifica: dati veri dalle prime accettazioni degli inviti: quanti entrano con il link e quanti si fermano.

### 5. Parole tecniche: «ISBN» ed «edizione giusta»
[SYNTHETIC]
Weight: 6; spread: ±0 (run 1: P03, P04, P05; run 2: P08, P09, P10).
Schermate 04-05. «ISBN» non si capisce (l'icona del codice a barre sì); «Tocca l'edizione giusta» obbliga a confrontare anni e pagine. Tocca A02.
Verifica: chiedere a 3 invitati di aggiungere un libro di casa e uno letto in ebook; osservare la scelta del risultato.

### 6. Avvisi che sembrano compiti arretrati (Altro, Statistiche)
[SYNTHETIC]
Weight: 6; spread: ±1 (run 1: P01, P02, P03; run 2: P06, P07, P10).
Schermate 12 e 14: «Nessun backup», «108 libri senza copertina», «senza anno», «senza voto». Parte dei numeri dipende dai libri di prova.
Verifica: dopo una settimana chiedere agli invitati cosa ricordano di Altro e se hanno sentito di dover «sistemare» qualcosa.

## 📋 Missing cases that repeated

- **Segnare la pagina con un salto grande (120 → 187) o leggere senza pagine (ebook, audiolibro).**
  [SYNTHETIC]
  Weight 4 (run 1: P03, P04; run 2: P06, P10).
  Il campo «pag.» c'è, ma non è stato percepito come scrivibile.
  Verifica: osservare come aggiorna la pagina chi legge su Kindle.
- **Finire un libro senza la data esatta («ieri», «questo mese»).**
  [SYNTHETIC]
  Weight 2 (P01 run 1, P08 run 2).
  Verifica: chiedere a chi segna libri finiti da tempo.
- **Caricare un file: dove si prende il CSV di Goodreads, cosa succede alle colonne diverse, esito dell'import.**
  [SYNTHETIC]
  Weight 4 (run 1: P01, P02; run 2: P06, P07).
  L'esito dell'import non era nelle schermate. Tocca A01.
  Verifica: un invitato con Goodreads e uno con un Excel suo caricano da soli; contare i libri arrivati e le domande fatte.
- **Poca conferma dopo un gesto** (libro segnato come letto, pagina aggiornata).
  [SYNTHETIC]
  Weight 4 (run 1: P01, P04; run 2: P06, P08).
- **Il cerchio vuoto e tratteggiato dell'obiettivo a 0 sembra un caricamento o un errore.**
  [SYNTHETIC]
  Weight 4 (run 1: P01, P05; run 2: P06, P08).
- **Il riquadro tratteggiato «Cerco novità per te…» sembra un campo di ricerca che non fa niente.**
  [SYNTHETIC]
  Weight 4 (run 1: P04; run 2: P06, P09, P10).
- **Pallini rossi sui dorsi e su Altro senza spiegazione.**
  [SYNTHETIC]
  Weight 4 (run 1: P04, P05; run 2: P06, P09).
- **Filtri tagliati sui telefoni stretti; non si capisce che scorrono.**
  [SYNTHETIC]
  Weight 3 (run 1: P01, P04; run 2: P09).
- **Titoli sui dorsi difficili da leggere.**
  [SYNTHETIC]
  Weight 2 (P05 run 1, P09 run 2).

## ⚠️ Contradictions with the brief

- **G1 (capire senza spiegazioni) contro le funzioni da libreria piena.**
  [SYNTHETIC]
  Chi ha pochi libri vede Statistiche, Novità, obiettivo e «Cosa leggo adesso?» come ingombro (run 1: P03, P05; run 2: P09, P10).
  Verifica: con chi entra da zero, cosa apre nella prima settimana.

## 🔍 Outliers

- **P04 (Android, run 1):** «sembra un'app per iPhone», e non sa come metterla sulla Home di Android. Nessuna schermata lo spiega. Seen once, ma è il caso che decide se chi ha Android resta.
- **P10 (indifferente, run 2):** «se l'app non mi ricorda niente, non ci torno». Chiede un promemoria; nessun altro lo chiede. Tocca A06.

## 🔁 Seen once, not reported as a finding

- Scegliere lo stato (Da leggere / In lettura) mentre si aggiunge: P01, P03 (run 1).
- Aggiungere più libri di fila: P03 (run 1).
- Esportare in Excel o verso un altro servizio: P02 (run 1), P07 (run 2), con motivi diversi; considerati una sola volta.
- Abbinare le colonne di un Excel o assegnare l'anno a molti libri insieme: P07 (run 2).
- Vista a elenco con scritte grandi e contrasto al sole: P09 (run 2).
- Serie e numero del volume poco visibili nella scheda e nelle uscite: P06 (run 2).
- «Anno» nella scheda letto come anno di lettura: P07 (run 2).
- Pulsante «Choose File» in inglese: P07 (run 2).

## Difetto verificato (non è un'ipotesi)

- In fondo alla scheda del libro c'è sempre «nella libreria di Diego» (`app.js:2666`, testo fisso): un invitato vede il nome di Diego. Notato da P01 e P05 (run 1) e confermato nel codice.

## 🧪 To confirm with real users

| # | Hypothesis | Persona ids / runs | Settles | Who to recruit | How |
|---|---|---|---|---|---|
| 1 | Le stelle obbligatorie fanno dare voti a caso o abbandonare | P02–P05 r1, P06–P10 r2 | A04, R02 | 3-5 invitati, misti | Compito: segna come letto un libro finito anni fa |
| 2 | Il menu rapido non si trova e «Elimina» spaventa | P01, P03–P05 r1; P06, P08–P10 r2 | A03 | 3 invitati nuovi | Compito senza aiuto: segna un libro come letto dallo scaffale |
| 3 | La scheda pesa e non si capisce se serve Salva | P01, P03–P05 r1; P06, P09, P10 r2 | A03 | 3 invitati | Compito: aggiorna la pagina dalla scheda e chiudi |
| 4 | Il link via email non si capisce | P03–P05 r1; P06, P08–P10 r2 | R01 | i primi invitati | Dati: chi entra con il link e chi si ferma |
| 5 | «ISBN» ed «edizione giusta» confondono | P03–P05 r1; P08–P10 r2 | A02 | 3 invitati che partono da zero | Compito: aggiungi un libro di casa e un ebook |
| 6 | Gli avvisi in Altro e Statistiche sembrano compiti | P01–P03 r1; P06, P07, P10 r2 | G1 | invitati dopo una settimana | Domanda: cosa senti di dover sistemare? |

## 📝 Interviews

Transcripts: `transcripts/run-1-P01.md` … `transcripts/run-2-P10.md`.
Acquiescence: 6 «sì» su 16 risposte date (sotto la metà, nessun segnale di compiacenza); 24 «nessuna base» su 40, cioè il materiale non dice quasi nulla sulle abitudini passate degli invitati.

## 📸 Evidence

`screenshots/01-porta.png` … `screenshots/17-telefono-320.png`, con testo e passaggi in `screenshots/schermate.md`.

## Quality gate

- Persone senza nomi né età, segmenti tutti dal brief, posto dell'indifferente presente.
- Nessuna domanda di preferenza.
- Nessun risultato da un solo giro tra i risultati.
- Nessun numero presentato come quota di utenti.
- Omogeneità: «stelle obbligatorie» compare in quasi tutti. Potrebbe essere un effetto del modello e non un segnale: è la prima cosa da verificare dal vero.
- Pregiudizi: lieve tendenza a vedere tutto come «troppo». Le persone da libreria piena (P01, P06) sono le più positive.
