# MyLibrary su Firebase Hosting (v90) — piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** pubblicare l'app anche su `https://mylibrary-2ea05.web.app/` da GitHub a ogni push su `main`, con «Accedi con Google» a pagina intera nell'app installata su iPhone quando gira su quel dominio.

**Architecture:** stessa cartella statica pubblicata in due posti (GitHub Pages e Firebase Hosting). Una funzione pura `sitoDi(hostname)` dice dove gira l'app; `cloud.js` sceglie `authDomain` e `openSync` sceglie il tipo di accesso in base a quella. `sw.js` lascia passare i percorsi riservati `/__/`.

**Tech Stack:** HTML/CSS/JS senza build, Firebase compat 10.14.1, Playwright per i test, GitHub Actions (`FirebaseExtended/action-hosting-deploy@v0`).

**Spec:** `docs/superpowers/specs/2026-11-14-firebase-hosting-design.md`

## Global Constraints
- Dominio nuovo: `mylibrary-2ea05.web.app` (anche `mylibrary-2ea05.firebaseapp.com`); vecchio: `margaz90.github.io`.
- `authDomain` sul sito Firebase = `location.hostname`; altrove `mylibrary-2ea05.firebaseapp.com` (come oggi).
- Secret GitHub: `FIREBASE_SERVICE_ACCOUNT_MYLIBRARY_2EA05`; progetto `mylibrary-2ea05`; canale `live`.
- `Cache-Control: no-cache` su `**`, icone `**/*.png` `max-age=86400`.
- Prima di `signInWithRedirect`: `sessionStorage["libreria-auth-pending"] = "1"`.
- Errore `auth/account-exists-with-different-credential` → «Questo indirizzo è già collegato con il link via email: accedi con il link qui sotto.»
- Nessuna chiave nel repository. `VERSION` = "v90". Testi e commit in italiano.
- Sul vecchio sito e fuori dall'app installata il comportamento resta identico a oggi (i test `accesso` e `sincronizzazione` esistenti restano verdi senza modifiche).

## Review Focus
1. Ritorno dal redirect su un'installazione vuota (nessun `uid` salvato): `cloud.js` deve caricarsi e l'accesso completarsi → test in Task 3.
2. Rete lenta sul nuovo sito durante l'accesso: `/__/auth/handler` non deve mai arrivare dalla cache del service worker → test in Task 2.
3. Hostname che somigliano al dominio (`evil-mylibrary-2ea05.web.app`, `mylibrary-2ea05.web.app.evil.com`) non devono contare come sito Firebase → test in Task 1.
4. App installata sul vecchio sito: il pulsante Google non deve ricomparire (resterebbe appeso) → test in Task 3.
5. `firebase.json` che pubblica per sbaglio `test/`, `.claude/` o `docs/` → controllo in Task 4.

---

### Task 1: `sitoDi`, funzione pura

**Files:**
- Modify: `app.js` (nuovo tratto `// <regole>` … `// </regole>` vicino a `cloudInfo`, riga ~85)
- Test: `test/regole.mjs`

**Interfaces:**
- Produces: `sitoDi(hostname: string) -> "firebase" | "vecchio" | "altro"`; in `app.js` `const SITO = window.libreriaSito || sitoDi(location.hostname);` (fuori dal tratto).

- [ ] **Step 1: test che fallisce** — in `test/regole.mjs` aggiungi `'sitoDi'` a `EXPORTS`, porta il conteggio dei tratti da 11 a 12 e aggiungi:
```js
const { sitoDi } = R;
const casi = [['mylibrary-2ea05.web.app', 'firebase'], ['MYLIBRARY-2EA05.WEB.APP', 'firebase'], ['mylibrary-2ea05.firebaseapp.com', 'firebase'],
  ['margaz90.github.io', 'vecchio'], ['localhost', 'altro'], ['evil-mylibrary-2ea05.web.app', 'altro'], ['mylibrary-2ea05.web.app.evil.com', 'altro'], ['', 'altro']];
ok('sitoDi: dove gira l\'app', casi.every(([h, s]) => sitoDi(h) === s), j(casi.map(([h]) => sitoDi(h))));
```
- [ ] **Step 2:** `node test/run.mjs regole` → FAIL (12 tratti attesi, `sitoDi` mancante).
- [ ] **Step 3:** implementa `sitoDi` (confronto esatto sull'hostname in minuscolo, nessuna espressione su sottostringhe) e `SITO`.
- [ ] **Step 4:** `node test/run.mjs regole` → PASS.
- [ ] **Step 5:** commit «Sito: sitoDi dice dove gira l'app (v90)».

### Task 2: il service worker lascia stare `/__/`

**Files:**
- Modify: `sw.js` (handler `fetch`, ramo stessa origine)
- Test: `test/aggiornamento.mjs` (nuovo controllo in fondo al gruppo)

- [ ] **Step 1: test che fallisce** — con `setOverride('/__/auth/handler', '<!doctype html><p>handler</p>')` (da `test/lib.mjs`), apri l'app, aspetta il service worker attivo (`navigator.serviceWorker.ready`), fai `fetch('/__/auth/handler')` dalla pagina, poi:
```js
const inCache = await p.evaluate(async () => { for (const k of await caches.keys()) { const c = await caches.open(k); if (await c.match('/__/auth/handler')) return true; } return false; });
ok('service worker: le pagine di accesso di Firebase (/__/) non finiscono in cache', !inCache);
```
Togli l'override alla fine (`setOverride('/__/auth/handler', null)`).
- [ ] **Step 2:** `node test/run.mjs aggiornamento` → FAIL.
- [ ] **Step 3:** in `sw.js`, nel ramo `url.origin === self.location.origin`, prima di tutto: `if (url.pathname.startsWith("/__/")) return;` con un commento sul perché.
- [ ] **Step 4:** `node test/run.mjs aggiornamento` → PASS.
- [ ] **Step 5:** commit «Service worker: niente cache per le pagine di accesso di Firebase (v90)».

### Task 3: accesso con Google a pagina intera sul sito Firebase

**Files:**
- Modify: `app.js` (`libreriaHost`: nuova proprietà `sito: SITO`; `openSync`, righe ~2853–2885)
- Modify: `cloud.js` (`CONFIG.authDomain`; nuovo `signInGoogleRedirect()` nel ponte `window.libreriaCloud`)
- Test: `test/accesso.mjs`

**Interfaces:**
- Consumes: `SITO` (Task 1).
- Produces: `window.libreriaCloud.signInGoogleRedirect(): Promise` — scrive `libreria-auth-pending` e chiama `auth.signInWithRedirect` con `prompt: select_account`.

- [ ] **Step 1: test che falliscono** (in `accesso.mjs`, pagine con `newPage(browser, { standalone: true, init: () => { window.libreriaSito = 'firebase'; } })` — se `init` non c'è in quella forma, usa `ctx.addInitScript` come fa `standalone`):
  - `app su iPhone, sito Firebase: c'è «Accedi con Google»` → `#sy-google` presente e abilitato.
  - `… il clic scrive libreria-auth-pending e va a pagina intera` → dopo il clic `localStorage['fake-redirect-called'] === '1'` e, prima del ricaricamento, `sessionStorage['libreria-auth-pending'] === '1'` (leggilo in un `addInitScript` che lo copia in `localStorage['pending-visto']` al ricaricamento).
  - `… al ritorno, su un'installazione vuota, il servizio si carica` → dopo il ricaricamento `window.libreriaCloud` esiste (entro 5 s).
  - `… errore account-exists: messaggio sul link` → con lo stub che rifiuta `signInWithRedirect` con `{ code: 'auth/account-exists-with-different-credential' }` (aggiungi allo stub un interruttore `localStorage['fake-redirect-error']`), `#sy-status` contiene «già collegato con il link via email».
  - `app su iPhone, vecchio sito: niente Google` → con `window.libreriaSito = 'vecchio'` `#sy-google` assente (come oggi).
- [ ] **Step 2:** `node test/run.mjs accesso` → i nuovi FAIL, i vecchi PASS.
- [ ] **Step 3:** implementa:
  - `cloud.js`: `authDomain: H.sito === "firebase" ? location.hostname : "mylibrary-2ea05.firebaseapp.com"`; `signInGoogleRedirect()`.
  - `openSync`: `const googleQui = !iosApp || SITO === "firebase";` il pulsante si mostra se `googleQui`; nell'app installata sul sito Firebase il clic chiama `signInGoogleRedirect()`, altrove `signInGoogle()` come oggi; testi: nell'app installata sul sito Firebase niente frase «iOS non lascia completare…», etichetta «Oppure con un link via email (senza password)»; nel `catch` del clic, `account-exists-with-different-credential` → il messaggio dei Global Constraints.
  - Stesso messaggio nell'avviso di ritorno da redirect in `cloud.js` (`getRedirectResult().catch`) quando il codice è quello.
- [ ] **Step 4:** `node test/run.mjs accesso sincronizzazione` → tutto PASS.
- [ ] **Step 5:** commit «Accesso con Google anche nell'app installata, sul sito Firebase (v90)».

### Task 4: pubblicazione su Firebase Hosting da GitHub

**Files:**
- Create: `firebase.json`, `.firebaserc`, `.github/workflows/firebase.yml`
- Test: `test/regole.mjs` (controlli da Node sui file, senza browser)

- [ ] **Step 1: test che falliscono** in `regole.mjs`:
  - `firebase.json valido, pubblica la cartella dell'app` → `public === "."`.
  - `firebase.json: niente test, documenti, design, impostazioni di Claude, GitHub` → `ignore` contiene `test/**`, `docs/**`, `design/**`, `.claude/**`, `.superpowers/**`, `.github/**`, `**/*.md`, `**/.*`.
  - `firebase.json: no-cache su tutto, anche su /` → c'è un header con `source: "**"` e `Cache-Control: no-cache`; uno con `source: "**/*.png"` e `max-age=86400`, dopo il primo.
  - `.firebaserc: progetto mylibrary-2ea05` → `projects.default`.
  - `azione GitHub: su push a main, canale live, chiave dai Secrets` → il testo di `firebase.yml` contiene `branches: [main]` (o forma equivalente), `channelId: live`, `projectId: mylibrary-2ea05`, `secrets.FIREBASE_SERVICE_ACCOUNT_MYLIBRARY_2EA05`, e nessuna stringa `"private_key"`.
- [ ] **Step 2:** `node test/run.mjs regole` → FAIL.
- [ ] **Step 3:** crea i tre file come da Global Constraints (azione: `actions/checkout@v4`, poi `FirebaseExtended/action-hosting-deploy@v0` con `repoToken: ${{ secrets.GITHUB_TOKEN }}`, `firebaseServiceAccount`, `channelId: live`, `projectId`).
- [ ] **Step 4:** `node test/run.mjs regole` → PASS.
- [ ] **Step 5:** commit «Pubblicazione su Firebase Hosting a ogni push su main (v90)».

### Task 5: versione, documenti, passi per Diego, verifica finale

**Files:**
- Modify: `sw.js` (`VERSION = "v90"`), `CLAUDE.md` (dove gira, «ora v90», Ultime, idea in sospeso «Aprire l'app ad altre persone»), `.claude/rules/sincronizzazione.md` (accesso sul sito Firebase), `docs/strumenti.md` (azione GitHub), `docs/funzioni.md`, `docs/storia.md`, `LEGGIMI.md`/`README.md` se citano l'indirizzo.
- Create: `docs/firebase-hosting-passi.md` — i passi 0–6 della spec, clic per clic, in italiano semplice.

- [ ] **Step 1:** aggiorna versione e documenti; scrivi i passi per Diego.
- [ ] **Step 2:** `node test/run.mjs` (in sottofondo, ~11 minuti) → «0 falliti».
- [ ] **Step 3:** revisione indipendente del branch (agente nuovo); correzioni con test RED→GREEN.
- [ ] **Step 4:** commit e push del branch `hosting-v90`; a Diego: riepilogo, passi da fare **prima** del merge (secret su GitHub), richiesta di ok per pubblicare.
