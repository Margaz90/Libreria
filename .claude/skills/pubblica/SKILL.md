---
name: pubblica
description: Pubblica le modifiche di MyLibrary seguendo le regole di lavoro di CLAUDE.md (versione, test, storia, commit, unione su main). Da usare solo quando Diego scrive /pubblica.
disable-model-invocation: true
---

# Pubblica MyLibrary

Diego ha chiesto di pubblicare: invocare questa skill vale come approvazione per unire su `main`. Rispondi in italiano.

## 1. Cosa sta per uscire
- `git status` e `git diff --stat origin/main`: elenca i file cambiati.
- Se non c'è niente di nuovo rispetto a `origin/main`, dillo e fermati.

## 2. Versione
- Se è cambiato almeno un file dell'app (`index.html`, `style.css`, `app.js`, `cloud.js`, `manifest.webmanifest`, icone, `zxing.min.js`), incrementa `VERSION` in `sw.js` di uno rispetto a `origin/main` (es. v44 → v45).
- Aggiorna "ora vNN" nelle Regole di lavoro di `CLAUDE.md`.

## 3. Test
- Lancia `node test/run.mjs` (tutti i test, circa un minuto). Se le porte 8765/8766 sono occupate, ferma prima i vecchi server di prova.
- Se un test fallisce: **non pubblicare**. Correggi la causa (non il test), rilancia, e pubblica solo con tutto verde. Se la correzione esce da quanto chiesto, fermati e spiega a Diego cosa non va.
- Se la modifica tocca l'aspetto, guarda anche uno screenshot a 390x844 e 1366x860.

## 4. Storia e funzioni
- Aggiungi in cima a `docs/storia.md` una riga: **titolo breve** (vNN): cosa cambia per Diego, in una frase. In `CLAUDE.md`, sezione "Storia del lavoro", aggiorna l'elenco delle ultime tre versioni.
- Aggiorna in `docs/funzioni.md` le voci delle funzioni toccate dalla modifica, e il riassunto in `CLAUDE.md` solo se cambia qualcosa di essenziale (nomi di funzioni, regole).

## 5. Commit e unione
- Commit in italiano: titolo breve con la versione tra parentesi, poi il perché in poche righe; chiudi con le righe di attribuzione richieste dall'ambiente.
- Se sei su un branch: `git checkout main`, `git merge --no-ff <branch> -m "Unisci <branch>: <titolo> (vNN)"`.
- `git push -u origin main`; solo per errori di rete riprova fino a 4 volte (2, 4, 8, 16 secondi).

## 6. Resoconto a Diego
In poche righe: cosa è uscito, esito dei test (numero di controlli riusciti), commit su `main`, e come vederlo sull'iPhone (aprire l'app e toccare "Aggiorna" sulla barra in alto).
