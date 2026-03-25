# YSI Processor Live
> **A browser-first GitHub Pages app for YSI 2950 BioSample QC, replicate averaging, SD reporting, and export-ready results.**

YSI Processor Live is a static web app designed to run directly from **GitHub Pages**.

The user opens the page, uploads one or more `BioSample*.csv` files exported by the **YSI 2950**, and the analysis happens **locally in the browser**:

- no Python installation
- no virtual environment
- no command line
- no server-side upload

This repository also keeps the Python engine used to define and validate the analysis workflow, but the primary product is now the **live app**.

---

## Live Workflow

1. Open the GitHub Pages site
2. Drag and drop one or more `BioSample*.csv` files
3. Review grouped samples and replicate QC
4. Inspect mean, SD, raw CV, cleaned CV, and flagged replicates
5. Export results as CSV

Everything runs in the browser session.

---

## What Files Does the App Accept?

The app is built specifically for **YSI 2950 BioSample CSV exports**.

### Expected filename pattern

```text
BioSample*.csv
```

Examples:

```text
BioSample_15F000007_24-03-2026_19-49-25.csv
BioSample_run_02.csv
```

### Required columns

The uploaded CSV must contain these fields:

- `PlateSequenceName`
- `BatchName`
- `WellId`
- `ChemistryId`
- `Concentration`

### Optional fields used when present

- `CompletionState`
- `LocalCompletionTime`
- `SampleSequenceName`
- `Errors`

The app uses optional fields to improve filtering, traceability, and review context.

### Real example header

The BioSample exports already tested in this repository contain:

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

## How Samples and Replicates Are Grouped

The app treats rows as belonging to the same replicate group only when they share:

- `PlateSequenceName`
- `BatchName`
- `WellId`
- `ChemistryId`

This is important because it prevents accidental mixing of:

- different YSI runs or batches
- different wells
- different analytes such as glucose and lactate
- different plate sequences

---

## What the User Gets

After processing the uploaded files, the app calculates:

- **mean** for each grouped sample
- **standard deviation (SD)** for each grouped sample
- **raw CV%**
- **cleaned mean / SD / CV%** after excluding the recommended outlier
- **replicate-level anomaly flags**

The UI exposes:

- a summary table by sample
- a flagged replicate table
- an annotated measurement table
- a manifest of uploaded files and metadata

The user can export:

- `ysi_summary.csv`
- `ysi_measurements_annotated.csv`
- `ysi_outliers.csv`
- `ysi_file_manifest.csv`

---

## Outlier Detection Logic

The browser app uses the same analytical logic implemented for the Python engine:

- raw replicate-group **CV%**
- **modified z-score** based on MAD
- **IQR fences**
- **leave-one-out CV improvement**

This means the app does more than say “this well looks noisy”.

It tries to identify:

- whether the replicate group needs review
- whether one replicate is the most likely bad measurement
- whether removing that replicate improves the group to an acceptable CV

---

## Repository Layout

```text
ysi-processor/
├── index.html
├── assets/
│   ├── app.js
│   └── styles.css
├── ysi_toolkit/
│   ├── analysis.py
│   ├── io.py
│   ├── pipeline.py
│   └── ...
├── tests/
├── ysi_processor.py
└── README.md
```

### Browser app

- `index.html`: GitHub Pages entry point
- `assets/app.js`: in-browser BioSample parser, QC engine, rendering, and CSV export
- `assets/styles.css`: UI styling

### Python engine

- `ysi_toolkit/`: Python implementation of the processing logic
- `ysi_processor.py`: CLI entry point for offline validation and development
- `tests/`: Python tests for the engine

---

## Local Preview

If you want to preview the app locally without deploying:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Because the app is static, no build step is required.

---

## GitHub Pages Deployment

This repository is structured so the root can be published directly with GitHub Pages.

Typical setup:

1. Go to **Settings**
2. Open **Pages**
3. Set source to:
   - **Deploy from a branch**
   - branch: `main`
   - folder: `/ (root)`
4. Save

GitHub Pages will then serve `index.html` as the live app.

---

## Validation

The Python engine is still tested locally with:

```bash
./.venv/bin/python -m pytest -q
```

This keeps the analytical logic verifiable even though the primary user workflow is now browser-based.
