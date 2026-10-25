---
name: acquisti
description: Cerca su Gmail le conferme d'ordine dei libri (soprattutto La Feltrinelli) e prepara il file JSON degli acquisti, già arricchito, da importare in MyLibrary. Da usare solo quando Diego scrive /acquisti, eventualmente con un periodo (es. "/acquisti da settembre").
disable-model-invocation: true
---

# Acquisti da Gmail → file per MyLibrary

Rispondi in italiano. Non modificare l'app: il risultato è un file che Diego importa da **Altro → Backup**.

## 1. Cerca le email
- Usa gli strumenti Gmail (`mcp__Gmail__search_threads`, poi `mcp__Gmail__get_thread`; se non sono caricati, cercali con ToolSearch).
- Conferme d'ordine La Feltrinelli: cerca per mittente Feltrinelli e parole come "ordine", "conferma", "spedito". Le email Amazon di solito non riportano ISBN né titoli completi: usale solo se Diego lo chiede.
- Periodo: quello indicato negli argomenti (`$ARGUMENTS`); se manca, chiedi da quando cercare oppure usa gli ultimi 3 mesi e dillo.

## 2. Estrai i libri
- Per ogni libro: titolo come scritto nell'email e ISBN/EAN a 13 cifre (978… o 979…).
- Scarta carte regalo, spedizioni, gadget e articoli che non sono libri; togli i doppioni (stesso ISBN in più email, es. conferma e spedizione).

## 3. Arricchisci (solo dati certi)
- Per ogni ISBN cerca autore, anno dell'edizione e pagine (ricerca web per ISBN; schede di editori, librerie, cataloghi).
- **Non inventare**: se un dato non è confermato per quell'ISBN, lascialo fuori. Meglio un campo vuoto che sbagliato (l'app completa poi da sola autore e copertina).

## 4. Prepara il file
Salvalo nella cartella temporanea della sessione come `acquisti-AAAA-MM-GG.json`:

```json
{
  "app": "libreria-diego",
  "acquisti": true,
  "fonte": "Gmail: conferme d'ordine La Feltrinelli, <periodo>",
  "books": [
    { "title": "Il confine", "isbn": "9788806258047", "status": "da-leggere", "author": "Don Winslow", "year": 2023, "pages": 928 }
  ]
}
```

- `"acquisti": true` è obbligatorio: fa sì che l'app metta i nuovi in Da leggere e sposti quelli della lista dei desideri.
- Controlla che il JSON sia valido prima di mandarlo.

## 5. Consegna
- Manda il file a Diego (SendUserFile, come allegato).
- Riassumi: quanti libri, quanti con autore e pagine, quali dati mancano e perché.
- Ricorda come importarlo: Altro → Backup → scegli il file → Importa. I libri già presenti restano invariati.
