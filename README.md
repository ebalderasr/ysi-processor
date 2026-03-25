<div align="center">

# YSI Processor Live

### Replicate QC and statistics for YSI 2950 BioSample exports

<br>

**[→ Open the live app](https://ebalderasr.github.io/ysi-processor/)**

<br>

[![Stack](https://img.shields.io/badge/Stack-HTML_·_CSS_·_JavaScript-F97316?style=for-the-badge)]()
[![Mode](https://img.shields.io/badge/Mode-Runs_in_the_browser-0F766E?style=for-the-badge)]()
[![Engine](https://img.shields.io/badge/Engine-Python_CLI_available-155E75?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](./LICENSE)
[![Part of](https://img.shields.io/badge/Part_of-Host_Cell_Lab_Suite-b45309?style=for-the-badge)](https://github.com/ebalderasr)

</div>

---

## What is YSI Processor?

YSI Processor is a **live web app for analyzing YSI 2950 BioSample exports** directly in the browser. Upload one or more raw `BioSample*.csv` files and get:

- replicate groups with mean, SD, and CV per well and analyte
- automated outlier detection with discard recommendations
- a pivot table with one row per well and one column group per analyte
- CSV exports ready for reports or downstream analysis

It is designed for routine metabolite review in CHO and other mammalian cell culture workflows, particularly when glucose, lactate, glutamine, and glutamate readings drive feeding decisions or process tracking.

Everything runs locally in the browser. No data leaves your machine.

---

## Why it matters

YSI 2950 workflows typically involve repetitive manual review after each session:

- exporting raw CSVs and opening them in spreadsheets
- checking whether replicates from different plate sequences belong to the same sample
- calculating mean, SD, and CV by hand
- guessing which replicate caused a high CV
- reformatting everything for downstream reports

YSI Processor reduces that friction to a single CSV drop. The core question it answers is:

**Can I trust this reading, and if not, which replicate should I re-inspect?**

---

## How it works

### 1. Replicate grouping

Rows are grouped by **`BatchName` + `WellId` + `ChemistryId`**. This means all measurements of the same physical well across multiple plate sequences within the same batch are treated as replicates of the same sample — which is the correct behavior when running the same samples through multiple YSI plate sequences (e.g. routine run + MCR mid-cycle run).

`PlateSequenceName` is preserved as metadata and shown in the results table under **Plates**, but it does not fragment the replicate groups.

### 2. Outlier detection

Three independent tests run on each replicate group (minimum 3 replicates required):

| Test | Logic |
|---|---|
| **Modified Z-Score** | Uses median and MAD — robust to non-normal distributions. Flags if `\|0.6745 × (value − median) / MAD\|` exceeds the threshold. |
| **IQR Fence** | Flags values outside `Q1 − k × IQR` or `Q3 + k × IQR`. |
| **Leave-One-Out CV** | Tests whether removing each replicate reduces group CV below threshold. Only the candidate that gives the greatest improvement is flagged. |

A replicate is **recommended for discard** when it accumulates at least *N* flags (configurable via *Consensus signals*). When multiple replicates qualify, the one with the highest flag score, then best CV improvement, then largest deviation from the median is chosen.

### 3. Status labels

Each well+analyte group receives one of four statuses:

| Status | Meaning |
|---|---|
| **PASS** | CV below threshold, no flags |
| **CLEANED** | Outlier discarded; cleaned CV now passes |
| **REVIEW** | CV above threshold but no single outlier identified |
| **FAIL** | CV above threshold even after removing the worst replicate |

### 4. Results pivot table

The **Results** panel shows one row per well with column groups per analyte (Glucose, Lactate, Glutamine, Glutamate). Each group displays:

- `Mean` — cleaned mean after recommended discard
- `SD` — cleaned standard deviation
- `CV%` — highlighted in red if above threshold
- `Status` — color-coded badge

Rows with FAIL or REVIEW status appear first. The table can be copied for direct pasting into Excel.

### 5. Exports

| File | Contents |
|---|---|
| `ysi_summary.csv` | One row per replicate group with raw and cleaned statistics |
| `ysi_measurements_annotated.csv` | Replicate-level QC detail with all flag scores |
| `ysi_outliers.csv` | Only the rows that triggered review or discard |
| `ysi_file_manifest.csv` | Metadata summary of the uploaded files |

---

## How to use it

### Option 1 — Live app (recommended)

Open **[ebalderasr.github.io/ysi-processor](https://ebalderasr.github.io/ysi-processor/)** in any modern browser.

1. Set QC thresholds if needed (CV%, Modified Z, IQR multiplier, Consensus signals)
2. Drop one or more `BioSample*.csv` files onto the dropzone
3. Click **Process Files**
4. Review the KPI strip, Results pivot table, Variability Snapshot chart, and Flagged Replicates table
5. Copy the pivot table for Excel or download individual CSV exports

No installation required. Files are processed entirely in your browser session.

---

### Option 2 — Python CLI (local, batch processing)

The `ysi_toolkit` package provides a full Python backend with the same analysis logic. Useful for batch processing, integration into pipelines, or running from scripts.

**Requirements**

```bash
pip install -r requirements.txt
```

`requirements.txt`:
```
pandas
numpy
matplotlib
```

**Basic usage**

Place your `BioSample*.csv` files in a directory and run:

```bash
python ysi_processor.py --input ./data --output ./results
```

**All options**

```
--input            Directory with BioSample*.csv files  (default: current dir)
--output           Directory for output files            (default: current dir)
--cv               CV threshold for review               (default: 5.0)
--modified-z       Modified z-score threshold            (default: 3.5)
--iqr-multiplier   IQR fence multiplier                  (default: 1.5)
--consensus-min-flags  Minimum flags to recommend discard (default: 1)
--title            HTML report title
--verbose          Enable debug logging
```

**Example**

```bash
python ysi_processor.py \
  --input ./20260317-T2 \
  --output ./results \
  --cv 5.0 \
  --modified-z 3.5 \
  --verbose
```

**Outputs written to `--output`**

```
results/
├── ysi_summary.csv
├── ysi_measurements_annotated.csv
├── ysi_outliers.csv
├── ysi_file_manifest.csv
├── ysi_quality_report.html
├── ysi_cv_overview.png
└── ysi_flagged_replicates.png
```

---

## Input format

### Required columns

| Column | Accepted aliases | Description |
|---|---|---|
| `PlateSequenceName` | `PlateName`, `PlateID` | Plate run identifier |
| `BatchName` | `Batch`, `BatchID` | Experiment batch name |
| `WellId` | `WellID`, `Well`, `Position` | Sample position |
| `ChemistryId` | `ChemistryID`, `Chemistry`, `Analyte` | Analyte name |
| `Concentration` | `Result`, `Value` | Measured value |

### Optional columns

| Column | Accepted aliases | Use |
|---|---|---|
| `CompletionState` | `Status`, `ResultState` | If present, only `Complete` rows are used |
| `Units` | `Unit`, `MeasurementUnits` | Displayed in analyte column headers |
| `LocalCompletionTime` | `DateTime`, `Timestamp` | Included in exports |
| `Errors` | `Error`, `ErrorMessage` | Included in manifest |
| `SampleSequenceName` | `SampleName`, `SampleId` | Included in summary |

### Typical YSI 2950 export header

```
PlateSequenceName, BatchName, LocalCompletionTime, CompletionState,
WellId, ChemistryId, ProbeId, Concentration, Units, Endpoint,
SampleSize, InitialBaseline, Plateau, FinalBaseline, NetPlateau,
NetPlateauTempAdj, CrossNetPlateau, CrossNetPlateauTempAdj,
PlateauSlope, Temperature, Errors
```

---

## Features

| | |
|---|---|
| **No installation** | Runs fully client-side — no Python, no pip, no server |
| **Multi-file support** | Load several plate sequences in one session |
| **Cross-plate replicate grouping** | Groups by Batch + Well + Analyte; plate sequences merged correctly |
| **Three-method outlier detection** | Modified Z-Score · IQR Fence · Leave-One-Out CV |
| **Pivot results table** | One row per well, column groups per analyte with units |
| **Status badges** | PASS · CLEANED · REVIEW · FAIL with color-coded rows |
| **CV chart** | Variability snapshot for the top 20 wells |
| **Copy for Excel** | Pivot table copied as tab-separated text |
| **Four CSV exports** | Summary · Measurements · Outliers · Manifest |
| **Python CLI** | Same analysis engine available as a local command-line tool |

---

## Project structure

```
ysi-processor/
├── index.html              ← GitHub Pages entry point
├── assets/
│   ├── app.js              ← in-browser parser, analysis, rendering, export
│   └── styles.css          ← live app styles
├── ysi_toolkit/            ← Python analysis engine
│   ├── analysis.py         ← replicate grouping, outlier detection, summary
│   ├── pipeline.py         ← batch processing pipeline
│   ├── cli.py              ← command-line interface
│   ├── config.py           ← ProcessingConfig dataclass
│   ├── io.py               ← CSV reading and output writing
│   └── reporting.py        ← HTML report and chart generation
├── ysi_processor.py        ← CLI entry point
├── requirements.txt
├── demo_input/             ← sample input files
└── demo_output/            ← sample output files
```

---

## Author

**Emiliano Balderas Ramírez**
Bioengineer · PhD Candidate in Biochemical Sciences
Instituto de Biotecnología (IBt), UNAM

[![LinkedIn](https://img.shields.io/badge/LinkedIn-emilianobalderas-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/emilianobalderas/)
[![Email](https://img.shields.io/badge/Email-ebalderas%40live.com.mx-D14836?style=flat-square&logo=gmail&logoColor=white)](mailto:ebalderas@live.com.mx)

---

## Related — Host Cell Lab Suite

[**PulseGrowth**](https://github.com/ebalderasr/PulseGrowth) — growth kinetics and process timing for mammalian cell culture.

[**Clonalyzer 2**](https://github.com/ebalderasr/Clonalyzer-2) — fed-batch kinetics analysis for CHO cell cultures.

[**CellSplit**](https://github.com/ebalderasr/CellSplit) — passage planning and split calculations for adherent cell culture.

---

<div align="center"><i>YSI Processor — drop your BioSample CSV, get your replicate QC.</i></div>
