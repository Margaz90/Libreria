# Genera modello-libri.xlsx (v92), il modello da compilare per «Carica i libri».
# Uso: python3 design/modello-libri.py   (serve openpyxl)
# Le colonne e i titoli d'esempio devono restare uguali a COLONNE_MODELLO ed ESEMPI_MODELLO in app.js (il test `regole` lo controlla).
import datetime, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation

COLONNE = [  # (nome, larghezza, formato)
    ("Titolo", 34, None), ("Autore", 24, None), ("Stato", 13, None), ("Voto", 7, "0"),
    ("Data di inizio", 14, "DD/MM/YYYY"), ("Data di fine", 14, "DD/MM/YYYY"), ("Anno di lettura", 15, "0"),
    ("Pagine", 9, "0"), ("Anno di pubblicazione", 21, "0"), ("Genere", 16, None), ("ISBN", 17, "@"),
    ("Serie", 20, None), ("Numero nella serie", 18, "@"), ("Note", 36, None), ("Citazione", 36, None),
]
ESEMPI = [
    ["Esempio: Il nome della rosa", "Umberto Eco", "Letto", 5, datetime.date(2025, 1, 6), datetime.date(2025, 2, 3), None, 503, 1980, "Giallo storico", "9788845292613", None, None, "Da rileggere", None],
    ["Esempio: Il barone rampante", "Italo Calvino", "Da leggere", None, None, None, None, 280, 1957, "Narrativa", None, "I nostri antenati", "2", None, None],
]
RIGHE = 1000  # tendine e controlli fino a questa riga

wb = Workbook()
ws = wb.active
ws.title = "Libri"
grassetto, obbl = Font(bold=True), PatternFill("solid", fgColor="F4EAD8")
for i, (nome, larg, fmt) in enumerate(COLONNE, start=1):
    c = ws.cell(row=1, column=i, value=nome)
    c.font = grassetto
    c.alignment = Alignment(vertical="center")
    if nome in ("Titolo", "Autore"):
        c.fill = obbl
    lettera = c.column_letter
    ws.column_dimensions[lettera].width = larg
    if fmt:  # formato sulla colonna intera (non cella per cella: il file resta piccolo)
        ws.column_dimensions[lettera].number_format = fmt
for r, riga in enumerate(ESEMPI, start=2):
    for i, v in enumerate(riga, start=1):
        if v is not None:
            c = ws.cell(row=r, column=i, value=v)
            if COLONNE[i - 1][2]:
                c.number_format = COLONNE[i - 1][2]
ws.freeze_panes = "A2"

stato = DataValidation(type="list", formula1='"Da leggere,In lettura,Letto,Desiderato"', allow_blank=True,
                       errorTitle="Stato", error="Scegli Da leggere, In lettura, Letto o Desiderato.")
voto = DataValidation(type="whole", operator="between", formula1="1", formula2="5", allow_blank=True,
                      errorTitle="Voto", error="Il voto è un numero da 1 a 5.")
ws.add_data_validation(stato)
ws.add_data_validation(voto)
stato.add(f"C2:C{RIGHE}")
voto.add(f"D2:D{RIGHE}")

ist = wb.create_sheet("Istruzioni")
ist.column_dimensions["A"].width = 24
ist.column_dimensions["B"].width = 90
testo = [
    ("Come si usa", "Scrivi un libro per riga nel foglio «Libri», poi in MyLibrary tocca «Carica i libri» e scegli questo file."),
    ("", "Cancella le due righe che iniziano con «Esempio:» (se le lasci, l'app le salta)."),
    ("", "Solo Titolo e Autore sono obbligatori: le altre colonne si possono lasciare vuote."),
    ("Titolo", "Il titolo del libro."),
    ("Autore", "Nome e cognome. Con più autori, separali con una virgola."),
    ("Stato", "Da leggere, In lettura, Letto o Desiderato (lista dei desideri). Se lo lasci vuoto: Letto se c'è la data di fine o l'anno di lettura, In lettura se c'è solo la data di inizio, altrimenti Da leggere."),
    ("Voto", "Da 1 a 5 stelle, solo per i libri letti."),
    ("Data di inizio", "Quando hai iniziato a leggerlo (giorno/mese/anno)."),
    ("Data di fine", "Quando l'hai finito (giorno/mese/anno)."),
    ("Anno di lettura", "Se non ricordi la data di fine, scrivi solo l'anno in cui l'hai letto."),
    ("Pagine", "Il numero di pagine."),
    ("Anno di pubblicazione", "L'anno in cui è uscito il libro."),
    ("Genere", "Per esempio Giallo, Fantascienza, Saggio."),
    ("ISBN", "Il codice a 10 o 13 cifre sul retro del libro: aiuta a trovare copertina e trama."),
    ("Serie", "Il nome della serie, se il libro ne fa parte."),
    ("Numero nella serie", "Il numero del volume nella serie (anche 0,5)."),
    ("Note", "Quello che vuoi ricordare del libro."),
    ("Citazione", "Una frase che ti è piaciuta."),
    ("Dopo il caricamento", "L'app cerca da sola copertine e trame. Se un valore non è valido (per esempio voto 6) il libro si carica senza quel dato e l'app ti dice dove."),
]
for r, (a, b) in enumerate(testo, start=1):
    ist.cell(row=r, column=1, value=a).font = grassetto
    c = ist.cell(row=r, column=2, value=b)
    c.alignment = Alignment(wrap_text=True, vertical="top")

dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "modello-libri.xlsx")
wb.save(dest)
print("scritto", os.path.normpath(dest), os.path.getsize(dest), "byte")
