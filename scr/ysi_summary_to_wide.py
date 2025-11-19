"""
===========================================================
YSI Summary → formato horizontal por pozo
Autor: ChatGPT

Descripción:
    - Selecciona archivo 'ysi_summary.csv'
    - Convierte datos largos a formato ancho
    - Resultado: una fila por (PlateSequenceName, WellId)
      con columnas:
        Glucose, Lactate, Glutamine, Glutamate
    - Guarda como 'ysi_summary_wide.csv'
===========================================================
"""

import pandas as pd
import tkinter as tk
from tkinter import filedialog


def ask_file():
    """Abre ventana de diálogo para seleccionar archivo CSV."""
    root = tk.Tk()
    root.withdraw()
    filepath = filedialog.askopenfilename(
        title="Selecciona el archivo ysi_summary.csv",
        filetypes=[("CSV Files", "*.csv"), ("All files", "*.*")]
    )
    return filepath


def convert_to_wide(filepath):
    """Convierte el archivo de formato largo a ancho."""
    
    df = pd.read_csv(filepath)
    df.columns = df.columns.str.strip()

    # Usamos el valor promedio como la columna principal
    # Si quieres usar std, cv o n_reps, también se puede agregar.
    wide = df.pivot_table(
        index=["PlateSequenceName", "WellId"],
        columns="ChemistryId",
        values="mean_value"
    ).reset_index()

    # Asegurar orden de las columnas si existen
    ordered_cols = [
        "PlateSequenceName", "WellId",
        "Glucose", "Lactate", "Glutamine", "Glutamate"
    ]
    # Añadir solo las columnas presentes
    wide = wide.reindex(columns=[c for c in ordered_cols if c in wide.columns])

    return wide


if __name__ == "__main__":
    print("\n============================================")
    print("  Convertidor YSI Summary → Formato Ancho")
    print("============================================\n")

    filepath = ask_file()

    if not filepath:
        print("No seleccionaste ningún archivo. Abortando.")
        exit()

    print(f"Archivo seleccionado:\n  {filepath}\n")

    wide = convert_to_wide(filepath)

    # Guardar resultado
    output = "ysi_summary_wide.csv"
    wide.to_csv(output, index=False)

    print(f"Archivo convertido guardado como: {output}\n")
