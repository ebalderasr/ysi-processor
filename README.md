# 🔬 YSI Data Processor — Google Colab Pipeline

Este repositorio contiene un **pipeline completo en Google Colab** para procesar datos crudos exportados del analizador bioquímico **YSI (Yellow Springs Instruments)** utilizados comúnmente en cultivos celulares CHO, bioprocesos y monitoreo metabólico.

El notebook realiza automáticamente:

### **⚙ Procesamiento de datos**
- Importa archivos CSV crudos exportados desde el YSI
- Agrupa réplicas técnicas por:
```

PlateSequenceName + WellId + ChemistryId

```
- Calcula estadísticos clave:
- Media
- Desviación estándar
- Coeficiente de variación (CV)
- Detección de outliers mediante Z-score

### **📁 Archivos generados**
| Archivo | Descripción |
|---------|-------------|
| `ysi_summary.csv` | Promedios y estadística por pozo y metabolito |
| `ysi_summary_wide.csv` | Una fila por pozo, columnas por metabolito |
| Gráficas STD | Visualización de variabilidad técnica entre corridas |

Todos los archivos se pueden descargar directamente desde el notebook.

---

## **▶ Cómo usarlo**

1. Abre el notebook en Google Colab
2. Ejecuta las celdas en orden
3. Sube tu archivo CSV crudo desde el YSI
4. Descarga los resultados procesados

_El usuario no necesita Python local, Tkinter ni instalar dependencias._

---

## **📍 Características importantes**

- No mezcla datos de corridas distintas (agrupa por `PlateSequenceName`)
- No convierte unidades (usa datos tal cual se miden)
- Permite visualizar variabilidad técnica por run
- Útil para cinética, fed-batch, y estudios de consumo metabólico

---

## **✔ Requisitos del archivo de entrada (formato YSI)**

Debe contener al menos estas columnas:

```

PlateSequenceName
WellId
ChemistryId
Concentration
Units

```

Ejemplo típico:

| PlateSequenceName | WellId  | ChemistryId | Concentration | Units |
|------------------|---------|-------------|---------------|-------|
| 20251114-T0-T3   | R24_A01 | Glucose     | 5.23          | g/L   |
| 20251114-T0-T3   | R24_A01 | Glucose     | 5.20          | g/L   |

---

## **📌 Próximas mejoras (planeadas)**

- Conversión opcional g/L ⇄ mM usando PM
- Cálculo de consumo específico (qGlc, qGln, qLac)
- Exportación directa para Opentrons / liquid handlers
- Normalización por VCD y viabilidad

---

## **🧪 Autor**

Desarrollado por Emiliano Balderas Ramírez con asistencia de ChatGPT.  
Repositorio con fines académicos y experimentales.

```
