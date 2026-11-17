# Benvenuto per gli invitati e prima schermata più leggera (v100)

Da una revisione con la skill UX & UI Design Critique (17 novembre 2026, 29/40). Diego ha scelto entrambe le proposte, da provare nell'anteprima prima di pubblicare. Gli invitati possono avere già una lista di libri oppure partire da zero, uno alla volta; Diego usa poco ricerca e ordinamento.

## Proposta 1: benvenuto
- **Libreria vuota**: tre strade. «Aggiungi il primo libro» (`#vuota-add`, apre Nuovo libro: cerca o scansiona), «Carica da un file» (`#carica-go`, Excel, CSV di Goodreads, backup) e, per chi non è collegato, «Accedi e riprendi i libri» (`#vuota-sync`, resta il primo). Da collegati il pulsante principale è «Aggiungi il primo libro»; resta la frase sui libri del cloud che arrivano da soli.
- **Errori in italiano semplice**: funzione pura `spiega(e)` (tratto `<regole>`) che traduce i codici più comuni (rete assente, indirizzo non autorizzato, link scaduto, email sbagliata, troppe richieste, accesso annullato, finestra bloccata, permesso negato, accesso da rifare, dati del browser bloccati) in una frase con la soluzione. Per un codice sconosciuto: «riprova tra poco (codice: …)». Usata nei messaggi di accesso, nome, invitati, sincronizzazione, eliminazione, uscita, ricerca in Nuovo libro e, tramite `libreriaHost.spiega`, in `cloud.js`. «Verifica le ricerche» mostra ancora i codici (è uno strumento di diagnosi).

## Proposta 2: prima schermata e Nuovo libro più leggeri
- **Telefono (sotto 1024 px)**: la riga con ricerca e «Ordina» è chiusa; un pulsante con la lente (`#cerca-apri`, 44 px, nella riga dell'obiettivo accanto al selettore della vista) la apre e mette il cursore nella ricerca. Resta aperta se c'è un testo cercato o un ordinamento diverso da «Recenti». La scorciatoia `/` la apre. Il computer non cambia.
- **Nuovo libro**: all'inizio solo la ricerca (titolo, autore o ISBN, «Cerca», «ISBN») e il link «Inserisci a mano» (`#a-mano`). I campi, lo stato e i pulsanti per salvare compaiono dopo il primo risultato scelto o con «Inserisci a mano». L'apertura con la fotocamera (`openAdd({ scan: true })`) resta com'è.

## Fuori ambito
Novità, Statistiche, scheda del libro, Altro.

## Prove
Gruppo di test `benvenuto` (libreria vuota, `spiega`, lente e ricerca, Nuovo libro). I test esistenti che riempiono Nuovo libro senza cercare toccano prima «Inserisci a mano». Anteprima su `mylibrary-2ea05--anteprima-roidf2ds.web.app` prima di pubblicare.
