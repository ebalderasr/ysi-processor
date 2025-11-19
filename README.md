# 📌 `ysi-processor`

`ysi-processor` es un conjunto de scripts en Python para **procesar datos crudos exportados del analizador bioquímico YSI** (glucosa, lactato, glutamina y glutamato) y generar archivos limpios, agregados y formateados para análisis de cultivos celulares, cinética, bioprocesos, etc.

---

## 🧪 ¿Qué problema resuelve?

Los archivos exportados del YSI contienen **una fila por medición**, incluyendo réplicas técnicas. Este repositorio permite:

| Paso                                  | Acción                                                 | Resultado                                       |
| ------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| **1. Procesar archivo crudo del YSI** | Agrupa réplicas, calcula promedios, std, CV y outliers | `ysi_summary.csv` + `ysi_raw_with_outliers.csv` |
| **2. Convertir a formato horizontal** | Una fila por pozo, cada metabolito en columna          | `ysi_summary_wide.csv`                          |

---

## 📂 Estructura del repositorio

```
ysi-processor/
│
├── src/
│   ├── process_ysi.py              # Procesa archivos crudos del YSI
│   ├── ysi_summary_to_wide.py      # Pivotea a formato horizontal
│
├── notebooks/
│   ├── 01_YSI Data Processor.ipynb
│   ├── 02_YSI wide summary.ipynb
│
├── data/
│   ├── Data_test.csv               # Archivo de ejemplo (opcional)
│
├── README.md
├── .gitignore
```

---

## 🔧 Requerimientos

| Paquete   | Para qué se usa                             |
| --------- | ------------------------------------------- |
| `pandas`  | Lectura y agrupamiento de datos             |
| `numpy`   | Estadística y cálculo de z-score            |
| `tkinter` | Selección de archivo mediante ventana (GUI) |

Instalar dependencias:

```bash
pip install pandas numpy
```

Tkinter en Ubuntu:

```bash
sudo apt install python3-tk
```

---

## ▶ **Cómo ejecutar el procesamiento principal**

Ejecuta:

```bash
python src/process_ysi.py
```

Se abrirá una ventana para seleccionar un archivo **exportado directamente del YSI** (formato `.csv` crudo del equipo).

---

### 📥 **Entrada esperada**

Un archivo raw del YSI con columnas como:

| WellId | ChemistryId | Concentration | Units | PlateSequenceName | ... |
| ------ | ----------- | ------------- | ----- | ----------------- | --- |

Ejemplo:

```
R24_A01, Glucose, 5.23, g/L, 20251114-T0-T3
R24_A01, Glucose, 5.19, g/L, 20251114-T0-T3
R24_A01, Glucose, 5.20, g/L, 20251114-T0-T3
...
```

No requiere preprocesamiento manual.

---

### 📤 **Archivos que genera**

| Archivo                         | Descripción                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| **`ysi_summary.csv`**           | Una fila por (PlateSequenceName, WellId, ChemistryId) con media, std, CV, # réplicas |
| **`ysi_raw_with_outliers.csv`** | Todos los datos originales + columnas limpias + flag de outliers                     |

Ejemplo de `ysi_summary.csv`:

| PlateSequenceName | WellId  | ChemistryId | mean_value | std_value | cv_value | n_reps | outlier_count | units |
| ----------------- | ------- | ----------- | ---------- | --------- | -------- | ------ | ------------- | ----- |
| 20251114-T0-T3    | R24_A01 | Glucose     | 5.23       | 0.04      | 0.007    | 3      | 0             | g/L   |

---

## ▶ **Cómo convertir a formato horizontal**

Ejecutar:

```bash
python src/ysi_summary_to_wide.py
```

---

### 📤 **Salida**

Genera:

| PlateSequenceName | WellId  | Glucose | Lactate | Glutamine | Glutamate |
| ----------------- | ------- | ------- | ------- | --------- | --------- |
| 20251114-T0-T3    | R24_A01 | 5.23    | 0.40    | 5.10      | 2.03      |

Útil para:

* cinética de cultivos
* cálculos de consumo específico
* modelado metabólico

---

## ⚠ Notas importantes

* No convierte unidades (usa los datos tal cual vienen del YSI)
* Detecta outliers usando z-score (> 2)
* Acepta placas de 24 o 28 pozos siempre que exista `WellId`

Si necesitas conversión automática a mM o filtros por clones/tiempos, puedo incorporarlo.

---

## 🧬 Próximas mejoras (pendientes)

* Cálculo automático de tasas (qGlc, qLac)
* Integración con datos de VCD/viabilidad
* Interfaz gráfica completa
* Paquete instalable via `pip install ysi-processor`

---
