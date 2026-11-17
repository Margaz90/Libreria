# «Altro» riordinato (v96)

## Perché
Diego trova la sezione «Altro» confusa: «Backup, importa e copertine» mescola cose di tutti i giorni (backup, importa) con strumenti tecnici, e «Sincronizzazione» mette «Esci» ed «Elimina il mio account» accanto a «Sincronizza ora». L'app sta per essere usata anche da altre persone su invito, che non la conoscono.

## Obiettivi
- «Altro» ordinato come le Impostazioni dell'iPhone, con in alto un riquadro del profilo (scelta di Diego: soluzione A con il riquadro della B, e la scritta «Account» sopra il riquadro).
- Nessuna funzione tolta; nessun cambio al comportamento delle funzioni.
- Le azioni pericolose separate e in fondo.

Non obiettivi: cambiare il modo in cui funzionano backup, import, sincronizzazione, copertine o serie.

## Approcci considerati
| | A. Elenco a gruppi | B. Profilo |
|---|---|---|
| Pro | Familiare, ogni voce ha un posto | Personale, obiettivo e sincronizzazione subito visibili |
| Contro | Asciutto | Più spazio in alto |

Scelta: A con il riquadro del profilo della B (mockup approvato il 17 novembre 2026).

## Disegno
**Altro**
- Etichetta «Account», poi il riquadro `[data-m=sync]`: iniziale, «Libreria di …» (come l'intestazione), «Collegato · email» oppure «Accedi per avere i libri su tutti i dispositivi», «N libri · M letti nel AAAA». A destra l'anello dell'obiettivo `[data-m=goal]` (fatti / obiettivo; senza obiettivo anello tratteggiato con «+»), sotto la riga «Obiettivo AAAA · Cambia» (o «Fissa un obiettivo per il AAAA»).
- I MIEI LIBRI: Carica libri `[data-m=carica]` (scheda `openCarica` esistente), Backup `[data-m=backup]` (con l'avviso corallo se è ora), Annulla una modifica `[data-m=annulla]`.
- STRUMENTI: Copertine e serie `[data-m=copertine]`, Invitati `[data-m=inv]` (solo l'amministratore collegato).
- In fondo: Privacy · Versione dell'app (`#i-ver`).

**Pagine interne** (in alto «‹ Altro» per tornare indietro, anche su Carica libri, Obiettivo, Accedi e Invitati quando si arriva da Altro, in fondo «Chiudi»; gli id dei pulsanti restano quelli di oggi)
- Backup: stato dell'ultimo backup ed «Esporta backup» (`#i-export`, `#i-status`).
- Annulla una modifica: elenco delle copie (`#u-list`).
- Copertine e serie: Cerca copertine mancanti, Rifai le copertine (edizioni italiane), Completa autori e copertine, Cerca le serie; sotto «Se qualcosa non va»: Verifica le ricerche (`#v-status`).
- Account (collegati): Il tuo nome `[data-m=nome]`, email, «Sincronizza ora», stato, «Riconnetti» come pulsante secondario, Privacy; in fondo, sotto «Uscita», «Esci da questo dispositivo» ed «Elimina il mio account». Non collegati: la scheda di accesso di oggi.

## Scelte mie (da far vedere a Diego)
- «Riconnetti» resta sempre visibile ma come pulsante secondario: l'app non sa dire con certezza quando la sincronizzazione è bloccata.
- Nel riquadro «Collegato» invece di «Sincronizzato»: lo stato vero si conosce solo dopo aver caricato il cloud; nella pagina Account c'è lo stato preciso.
- «Carica libri» da Altro usa la stessa scheda di «Carica i libri» della libreria vuota.

## Vincoli
Nessun file nuovo, peso minimo; test aggiornati e nuovo gruppo `altro`; 390x844 e 1366x860, chiaro e scuro.
