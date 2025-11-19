"""
===========================================================
YSI Data Processor
Autor: ChatGPT

Descripción:
    Procesa archivos CSV exportados del analizador YSI.
    - Solicita el archivo mediante ventana de diálogo
    - Agrupa réplicas técnicas por (PlateSequenceName, WellId, ChemistryId)
    - Calcula media, desviación estándar, coeficiente de variación (CV)
    - Detecta outliers usando z-score (> 2)
    - No convierte unidades, usa los datos tal cual
===========================================================
"""

import pandas as pd
import numpy as np
import tkinter as tk
from tkinter import filedialog


# ----------------------------------------------------------
# Función de detección de outliers
# ----------------------------------------------------------
def detect_outliers_zscore(values, threshold=2.0):
    """Devuelve una lista booleana indicando qué valores son outliers."""
    if len(values) < 3:
        return [False] * len(values)  # No detectar outliers con pocas réplicas

    mean = np.mean(values)
    std = np.std(values)
    if std == 0:
        return [False] * len(values)

    zscores = [(v - mean) / std for v in values]
    return [abs(z) > threshold for z in zscores]


# ----------------------------------------------------------
# Procesador principal del CSV
# ----------------------------------------------------------
def process_ysi_csv(filepath):
    """
    Procesa un archivo CSV del YSI y devuelve:
        - summary: resumen por grupo
        - df: datos originales con columnas extra

    Params
    -------
    filepath : str
        Ruta del archivo CSV exportado por el YSI.

    Returns
    -------
    summary, df
    """

    # Leer el CSV
    df = pd.read_csv(filepath)
    df.columns = df.columns.str.strip()

    # Asegurar que Concentration sea numérico
    df["Conc_clean"] = pd.to_numeric(df["Concentration"], errors="coerce")

    # Crear columna outlier (se llena después)
    df["is_outlier"] = False

    # Detectar outliers dentro de cada grupo
    for (plate, well, chem), group in df.groupby(["PlateSequenceName", "WellId", "ChemistryId"]):
        idx = group.index
        values = group["Conc_clean"].tolist()
        flags = detect_outliers_zscore(values)
        df.loc[idx, "is_outlier"] = flags

    # Resumen final por grupo
    summary = (
        df.groupby(["PlateSequenceName", "WellId", "ChemistryId"])
        .agg(
            mean_value=("Conc_clean", "mean"),
            std_value=("Conc_clean", "std"),
            cv_value=("Conc_clean", lambda x: np.std(x) / np.mean(x) if np.mean(x) != 0 else np.nan),
            n_reps=("Conc_clean", "count"),
            outlier_count=("is_outlier", "sum"),
            units=("Units", lambda x: list(set(x))[0]),
        )
        .reset_index()
    )

    return summary, df


# ----------------------------------------------------------
# Ventana de diálogo para seleccionar archivo
# ----------------------------------------------------------
def ask_file():
    root = tk.Tk()
    root.withdraw()  # Oculta ventana principal

    filepath = filedialog.askopenfilename(
        title="Selecciona el archivo CSV del YSI",
        filetypes=[("CSV Files", "*.csv"), ("All files", "*.*")]
    )
    return filepath


# ----------------------------------------------------------
# Programa principal
# ----------------------------------------------------------
if __name__ == "__main__":
    print("\n========================================")
    print(" Procesador YSI - Selecciona tu archivo ")
    print("========================================\n")

    filepath = ask_file()

    if not filepath:
        print("No seleccionaste ningún archivo. Abortando.")
        exit()

    print(f"Archivo seleccionado:\n  {filepath}\n")

    summary, raw = process_ysi_csv(filepath)

    # Guardar resultados
    summary_out = "ysi_summary.csv"
    raw_out = "ysi_raw_with_outliers.csv"

    summary.to_csv(summary_out, index=False)
    raw.to_csv(raw_out, index=False)

    print("Procesamiento completado.")
    print(f"Archivo resumen guardado como: {summary_out}")
    print(f"Archivo detallado guardado como: {raw_out}\n")
