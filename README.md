<div align="center">

# YSI Processor

### Browser-based YSI 2950 BioSample analysis for replicate QC, means, SD, and export

<br>

[![Stack](https://img.shields.io/badge/Stack-HTML_·_CSS_·_JavaScript-F97316?style=for-the-badge)]()
[![Mode](https://img.shields.io/badge/Mode-GitHub_Pages_Live_App-0F766E?style=for-the-badge)]()
[![Input](https://img.shields.io/badge/Input-BioSample_CSV-155E75?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](./LICENSE)

</div>

---

## What is YSI Processor?

YSI Processor is a **live web app for analyzing YSI 2950 BioSample exports** directly in the browser.  
The user opens the page, uploads one or more raw `BioSample*.csv` files, and gets:

- grouped technical replicates
- mean and standard deviation for each sample
- raw and cleaned CV
- replicate-level anomaly flags
- CSV exports for downstream analysis

The app is designed for routine metabolite review workflows in **CHO cell culture**, especially when glucose, lactate, and related readings are used for feeding decisions, troubleshooting, or daily process tracking.

There is **no backend and no server-side processing**. The selected files are processed locally in the browser session.

---

## Why it matters

YSI workflows often involve repetitive manual review:

- uploading raw exports into notebooks or ad hoc scripts
- checking whether replicates belong to the same sample or run
- calculating mean, SD, and CV by hand or in spreadsheets
- guessing which replicate is the bad one when one reading drifts
- reformatting results for downstream reports

YSI Processor reduces that friction by giving the user a single browser interface focused on the actual bench question:

**Can I trust this sample, and if not, which replicate should I inspect first?**

---

## How it works

### 1. Upload YSI BioSample files

The app accepts one or more `BioSample*.csv` files exported by the YSI software.

Required fields:

- `PlateSequenceName`
- `BatchName`
- `WellId`
- `ChemistryId`
- `Concentration`

Optional fields such as `CompletionState`, `LocalCompletionTime`, `SampleSequenceName`, and `Errors` are used when present.

### 2. Group replicates correctly

Rows are grouped only when they share the same:

- `PlateSequenceName`
- `BatchName`
- `WellId`
- `ChemistryId`

This prevents accidental mixing of:

- different YSI runs
- different batches
- different wells
- different analytes

### 3. Compute sample statistics

For each grouped sample, the app calculates:

- mean
- standard deviation
- replicate count
- raw CV%
- cleaned mean / SD / CV after excluding the recommended outlier

### 4. Flag suspicious replicates

The current live app combines:

- raw replicate-group CV
- modified z-score based on MAD
- IQR fences
- leave-one-out CV improvement

This allows the user to review not only **which sample is noisy**, but also **which replicate is the most likely source of the problem**.

### 5. Export results

The app can export:

- `ysi_summary.csv`
- `ysi_measurements_annotated.csv`
- `ysi_outliers.csv`
- `ysi_file_manifest.csv`

---

## Current feature set

| | |
|---|---|
| **Live browser workflow** | Use the tool directly from GitHub Pages without installation |
| **Local-only processing** | Uploaded files stay in the browser session |
| **Replicate grouping** | Groups by `PlateSequenceName + BatchName + WellId + ChemistryId` |
| **Sample statistics** | Mean, SD, replicate count, raw CV, and cleaned CV |
| **Replicate QC** | Flags likely outliers and recommends discards |
| **Metadata manifest** | Summarizes uploaded files and available metadata fields |
| **CSV export** | Export summary, outliers, annotated measurements, and manifest |
| **Local preview** | Run the exact same static app locally from the terminal |
| **Legacy notebook retained** | `process_ysi.ipynb` remains available for older Colab-based workflows |

---

## Input format

The app expects **YSI 2950 BioSample CSV exports**.

Typical filename pattern:

```text
BioSample*.csv
```

Example:

```text
BioSample_15F000007_24-03-2026_19-49-25.csv
```

Typical header:

```text
PlateSequenceName
BatchName
LocalCompletionTime
CompletionState
WellId
ChemistryId
ProbeId
Concentration
Units
Endpoint
SampleSize
InitialBaseline
Plateau
FinalBaseline
NetPlateau
NetPlateauTempAdj
CrossNetPlateau
CrossNetPlateauTempAdj
PlateauSlope
Temperature
Errors
```

---

## How to use it

### Option 1. Use the live app

Open:

```text
https://ebalderasr.github.io/ysi-processor/
```

Then:

1. Upload one or more `BioSample*.csv` files
2. Review the summary table and flagged replicates
3. Export the processed CSV outputs

This is the main intended workflow.

### Option 2. Run it locally from the terminal as a static app

Clone the repository and start a simple local web server:

```bash
git clone https://github.com/ebalderasr/ysi-processor.git
cd ysi-processor
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

This runs the same live app locally, without any build step.

### Option 3. Use the legacy notebook workflow

If you still want the older notebook-based approach, this repo keeps:

```text
process_ysi.ipynb
```

You can open it in Jupyter or Google Colab and follow the notebook flow.

---

## Project structure

```text
ysi-processor/
├── README.md
├── LICENSE
├── .nojekyll
├── index.html                ← GitHub Pages entry point
├── assets/
│   ├── app.js                ← in-browser parser, analysis, rendering, export
│   └── styles.css            ← live app styling
├── data/
│   └── Data_test.csv         ← sample input data
└── process_ysi.ipynb         ← legacy notebook workflow
```

---

## Deployment

The repository is configured to work as a **GitHub Pages site from `main` and the repository root**.

Expected Pages setup:

1. **Settings**
2. **Pages**
3. **Deploy from a branch**
4. Branch: `main`
5. Folder: `/ (root)`

GitHub Pages should serve `index.html` as the app entry point.

---

## Author

**Emiliano Balderas Ramírez**  
Bioengineer · PhD Candidate in Biochemical Sciences  
Instituto de Biotecnología (IBt), UNAM

[![LinkedIn](https://img.shields.io/badge/LinkedIn-emilianobalderas-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/emilianobalderas/)
[![Email](https://img.shields.io/badge/Email-ebalderas%40live.com.mx-D14836?style=flat-square&logo=gmail&logoColor=white)](mailto:ebalderas@live.com.mx)

---

## Related

[**CellSplit**](https://github.com/ebalderasr/CellSplit) — passage planning and split calculations for adherent cell culture workflows.

[**PulseGrowth**](https://github.com/ebalderasr/PulseGrowth) — browser-based growth kinetics and process timing for mammalian cell culture.

[**Clonalyzer 2**](https://github.com/ebalderasr/Clonalyzer-2) — browser-based analysis tools for clone and culture workflows.

---

<div align="center"><i>YSI Processor — upload, review, export.</i></div>
