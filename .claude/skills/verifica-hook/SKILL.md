---
name: verifica-hook
description: Verifica periodica (circa mensile) degli automatismi di Claude Code per MyLibrary — hook soprattutto, ma anche skill e test — sulla base di quanto è cambiato nel progetto dall'ultima verifica. Parte da sola quando l'hook promemoria-verifica lo segnala; Diego può anche chiederla con /verifica-hook.
---

# Verifica mensile degli hook

Rispondi in italiano. Se la verifica è partita dal promemoria automatico, fai prima ciò che Diego ha chiesto e poi aggiungi la verifica in fondo alla stessa risposta, sotto un titolo "Verifica mensile degli hook".

## 1. Cosa è cambiato
- Data dell'ultima verifica: `.claude/verifica-hook.json` (campo `ultima`).
- `git log --oneline --since=<ultima>` e `git diff --stat <primo commit dopo quella data>^ HEAD`: file nuovi, funzioni nuove, librerie o servizi esterni aggiunti, file che cambiano spesso.
- "Storia del lavoro" in `CLAUDE.md`: problemi ripetuti o errori costati tempo (sono i candidati migliori per un hook).
- Hook già presenti: `.claude/settings.json` e `.claude/hooks/`. Controlla anche che funzionino ancora, passando a ogni script un JSON di prova su stdin.
- Se è installato il plugin `claude-code-setup`, usa la sua skill `claude-automation-recommender` per un secondo parere.

## 2. Proposte
- Proponi **da 0 a 3** nuovi hook, solo se c'è un motivo concreto legato a quanto è cambiato. Se non serve nulla, dillo chiaramente: è un esito normale.
- Valuta anche se un hook esistente va corretto o tolto (es. avvisa troppo spesso, o controlla qualcosa che non esiste più).
- Presenta tutto in una tabella: hook, cosa fa, perché ora (il cambiamento che lo motiva), pro, contro. Indica quale consigli.
- **Non creare né modificare hook** finché Diego non approva. Quando approva, seguili come gli altri: script in `.claude/hooks/`, prova con input simulato, voce in `.claude/settings.json`, descrizione in `CLAUDE.md`.

## 3. Registra la verifica
- Aggiorna `ultima` in `.claude/verifica-hook.json` con la data di oggi (AAAA-MM-GG), anche se non hai proposto nulla.
- Pubblica subito solo questo file, così la data resta valida anche in una sessione nuova: commit su `main` con messaggio "Verifica mensile degli hook (AAAA-MM-GG)" e push. Se c'è un lavoro in corso su un altro branch, fai il commit della data su quel branch e uniscilo con il resto.
- L'hook dei test prima di pubblicare lancerà i test (circa un minuto): è normale.
