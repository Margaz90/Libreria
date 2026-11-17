# Nome di ciascuno, privacy, «Elimina il mio account» (v95) — piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** intestazione «Libreria di {nome}» per ciascuno, pagina `privacy.html`, «Elimina il mio account» che cancella dati, invito e account.

**Architecture:** profilo in `users/{uid}/meta/profilo` letto da `cloud.js` dopo l'ingresso, copia locale `libreria-nome` per disegnare subito; `eliminaAccount()` nel ponte di `cloud.js`; regole con la cancellazione del proprio invito; pagina statica.

**Tech Stack:** JS senza build, Firebase compat, emulatore Firestore, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-profilo-privacy-design.md`

## Global Constraints
- Intestazione: «Libreria di {nome}»; senza nome «La mia libreria»; amministratore senza profilo «Libreria di Margaira Diego».
- Nome: spazi ripuliti, massimo 60 caratteri, sempre con `esc()`/`textContent`.
- Privacy: responsabile «Diego Margaira»; frase «Per domande sui tuoi dati, o per chiederne la cancellazione, contatta direttamente Diego.»; «Torna all'app».
- Elimina: margine 3 minuti dall'ultimo accesso; testi «Definitivo: cancella i tuoi libri, le foto e il tuo account dal cloud e da questo telefono.», «Per sicurezza, prima di eliminare l'account rientra: tocca «Esci», accedi di nuovo e torna qui.», «I tuoi libri sono stati cancellati; per eliminare anche l'account esci, rientra e riprova.»
- `VERSION = "v95"`.

## Review Focus
1. Nome con caratteri HTML (`<b>Mario</b>`) → mostrato come testo → Task 2.
2. Due account sullo stesso dispositivo: il nome del primo non resta → Task 2 (Esci toglie `libreria-nome`).
3. «Elimina» offline → messaggio, niente cancellato → Task 3.
4. «Elimina» con modifiche in sospeso → prima si fermano gli invii, nessun documento ricreato dopo → Task 3.
5. Amministratore: nessun «Elimina», intestazione invariata → Task 2 e 3.

---

### Task 1: regole — cancellare il proprio invito
**Files:** `firestore.rules`, `test/firestore.mjs`.
- [ ] Test (emulatore): invitato scrive `users/<suo>/meta/profilo` e lo cancella; non scrive `users/<altro>/meta/profilo`; cancella `invitati/<sua email>`; non cancella `invitati/<altra>`; non crea/modifica il proprio invito. RED (la cancellazione del proprio invito oggi è vietata).
- [ ] `allow delete: if admin() || (verificata() && email() == e);` separato da `create, update: if admin()`. GREEN. Commit.

### Task 2: nome nell'intestazione
**Files:** `index.html` (`.exlibris` → «La mia libreria»), `app.js` (`NOME_KEY = "libreria-nome"`, `mostraNome()`, `chiediNome()`, voce Altro «Il tuo nome», `pulisciDispositivo` toglie `NOME_KEY`, ponte `H.nome(n)`, `H.chiediNome()`), `cloud.js` (`profilo()` dopo `entra`: legge `meta/profilo`, `displayName`, `salvaNome(n)`), `test/firebase-stub.js` (`displayName` da `fake-name`), `test/accesso.mjs`.
**Interfaces:** `libreriaCloud.salvaNome(nome): Promise`; `H.nome(nome: string)`; `H.chiediNome()`.
- [ ] Test: Google con `fake-name` «Mario Rossi» → `.exlibris` «Libreria di Mario Rossi» e `users/<uid>/meta/profilo.nome`; link via email → «Come ti chiami?» → «Anna» → intestazione e cloud; amministratore senza profilo → «Libreria di Margaira Diego»; Altro → «Il tuo nome» cambia; nome `<b>X</b>` come testo; Esci toglie `libreria-nome` e l'intestazione torna «La mia libreria»; senza nessuno collegato «La mia libreria». RED.
- [ ] Implementa. GREEN (`accesso sincronizzazione interfaccia`). Commit.

### Task 3: «Elimina il mio account»
**Files:** `cloud.js` (`eliminaAccount()`), `app.js` (`#sy-del` in `openSyncDone`, solo non amministratore, due tocchi, link alla privacy), `test/firebase-stub.js` (`currentUser`, `metadata.lastSignInTime` da `fake-signin` o adesso, `delete()`), `test/accesso.mjs`.
**Interfaces:** `libreriaCloud.eliminaAccount(): Promise` — errori `{ code: "admin" | "rete" | "rientra" | "parziale" }`.
- [ ] Test: invitato con 2 libri, foto, obiettivo, profilo → due tocchi → cloud `users/<uid>/**` vuoto, `invitati/<email>` tolto, utente eliminato (stub), dispositivo pulito, porta; accesso vecchio (`fake-signin` 10 minuti fa) → messaggio «rientra», niente cancellato; offline → messaggio, niente cancellato; amministratore non vede `#sy-del`. RED.
- [ ] Implementa (fermare gli invii, id dei libri dal server, gruppi ≤ 400, `meta/goals`, `meta/profilo`, invito, `user.delete()`, pulizia). GREEN. Commit.

### Task 4: `privacy.html`
**Files:** create `privacy.html`; `app.js` (link dalla porta, da Altro, da «Elimina»); `test/regole.mjs` (file e testi), `test/interfaccia.mjs` (link e pagina che risponde).
- [ ] Test: il file contiene «Diego Margaira», la frase di contatto, «eur3» o «Europa», Google Books, Apple, Open Library, Wikidata, Google Fonts, «Torna all'app»; link `a[href="privacy.html"]` nella porta, in Altro e nella scheda di «Accedi e sincronizza»; la pagina risponde 200. RED.
- [ ] Scrivi la pagina e i link. GREEN. Commit.

### Task 5: versione, documenti, verifica
- `VERSION = "v95"`; `CLAUDE.md`, `docs/funzioni.md`, `docs/storia.md`, `.claude/rules/sincronizzazione.md`. Screenshot. Suite completa. Revisore indipendente; correzioni RED→GREEN. Push del branch; ok di Diego.
