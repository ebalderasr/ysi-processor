# YSI Processor
> **Quality control and replicate review for YSI 2950 BioSample exports. Fast, traceable, and lab-ready.**

YSI Processor is a small Python tool for processing raw exports from the **YSI 2950 biochemical analyzer**, especially when samples are acquired with an autosampler in **24-well or 96-well plate layouts**.

It is designed for workflows where **glucose**, **lactate**, and other metabolite readings are used to support daily decisions in **CHO cell culture**, feeding strategy, and process monitoring.

---

## What is YSI Processor?

`ysi_processor.py` takes one or more raw `BioSample*.csv` files exported by the YSI software and converts them into:

- a replicate-level QC table
- a cleaned summary by plate, batch, well, and metabolite
- an outlier review table
- a metadata manifest
- an HTML report with visual QC outputs

The tool is intended to answer a practical bench-side question:

**Which technical replicate looks wrong, and can I trust this well before making a process decision?**

---

## Input Files

This project is built specifically for **YSI 2950 BioSample CSV exports**.

### Expected file pattern

The processor scans the input directory for files matching:

```text
BioSample*.csv
```

Examples:

```text
BioSample_15F000007_24-03-2026_19-49-25.csv
BioSample_plateA_run02.csv
```

### Expected file type

The input must be a **CSV exported directly from the YSI 2950 software**.

The current implementation expects the file to contain, at minimum, these columns:

- `PlateSequenceName`
- `BatchName`
- `WellId`
- `ChemistryId`
- `Concentration`

If present, the processor also uses optional columns such as:

- `CompletionState`
- `SampleSequenceName`
- `LocalCompletionTime`
- `Errors`
- other metadata fields that help with traceability

### Real header example

The BioSample files currently present in this repository contain this structure:

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

### How replicates are defined

This is important.

The tool considers measurements to belong to the same replicate group only when they share the same:

- `PlateSequenceName`
- `BatchName`
- `WellId`
- `ChemistryId`

This avoids accidentally mixing:

- different plates
- different YSI batches/runs
- different wells
- different analytes such as glucose and lactate

### What the file usually represents

In practice, a single BioSample export often contains:

- one acquisition batch from the YSI
- multiple wells from a plate
- more than one chemistry per well
- repeated technical measurements across matching identifiers

Each row is treated as an individual analytical measurement.  
The processor groups those rows into replicate sets and evaluates whether one measurement is inconsistent with the rest.

---

## Scientific QC Logic

YSI Processor does not rely only on a fixed CV threshold.

Instead, it combines multiple signals to decide whether a replicate should be reviewed or discarded:

- **Raw CV%** of the replicate group
- **Modified z-score** based on median absolute deviation (MAD)
- **IQR fences** for robust outlier detection
- **Leave-one-out CV improvement**, to test whether removing one replicate makes the group acceptable

This is useful because in real lab work:

- a bad pipetting event may affect only one replicate
- a bubble, sampling issue, or read instability may produce a single deviant value
- CV alone can tell you a group is noisy, but not always which replicate caused the problem

The processor therefore annotates each replicate individually and recommends discard only when there is enough evidence to justify it.

---

## What the Tool Produces

After processing, the output directory contains:

- `ysi_measurements_annotated.csv`
- `ysi_summary.csv`
- `ysi_outliers.csv`
- `ysi_file_manifest.csv`
- `ysi_cv_overview.png`
- `ysi_flagged_replicates.png`
- `ysi_quality_report.html`

### Output meanings

**`ysi_measurements_annotated.csv`**  
One row per raw measurement, with QC metrics added.  
Use this file when you want to inspect the exact replicate that was flagged.

**`ysi_summary.csv`**  
One row per unique combination of:

- `PlateSequenceName`
- `BatchName`
- `WellId`
- `ChemistryId`

This is the main working table for downstream analysis.

**`ysi_outliers.csv`**  
Focused table of replicate groups that require review, including candidate outliers.

**`ysi_file_manifest.csv`**  
File-level metadata summary for traceability across runs.

**`ysi_quality_report.html`**  
Quick visual report to inspect flagged wells and variability before/after cleaning.

---

## How to Use

### 1. Create a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Place your YSI files in an input directory

Example layout:

```text
ysi-processor/
├── data/
│   ├── BioSample_15F000007_24-03-2026_19-49-25.csv
│   └── BioSample_15F000007_25-03-2026_08-10-01.csv
└── demo_output/
```

### 3. Run the processor

```bash
python ysi_processor.py --input data --output demo_output --cv 5.0 --verbose
```

### 4. Review the results

Start with:

- `demo_output/ysi_summary.csv`
- `demo_output/ysi_outliers.csv`
- `demo_output/ysi_quality_report.html`

---

## CLI Options

- `--input`: directory containing `BioSample*.csv`
- `--output`: directory where reports and tables will be written
- `--cv`: CV threshold used to mark groups that require review
- `--modified-z`: threshold for robust modified z-score outlier detection
- `--iqr-multiplier`: IQR fence width
- `--consensus-min-flags`: minimum number of outlier signals required to recommend discard
- `--title`: custom title for the HTML report
- `--verbose`: enable logging

Example:

```bash
python ysi_processor.py \
  --input data \
  --output results \
  --cv 5.0 \
  --modified-z 3.5 \
  --iqr-multiplier 1.5 \
  --consensus-min-flags 1 \
  --verbose
```

---

## How to Interpret the Results

Some columns you will likely use often:

### In `ysi_measurements_annotated.csv`

- `ReplicateIndex`: position of the replicate inside its group
- `RawCVPercent`: variability of the full group before cleaning
- `ModifiedZScore`: robust outlier score
- `IsOutlierModifiedZ`: whether the replicate crosses the z-score threshold
- `IsOutlierIQR`: whether the replicate falls outside IQR fences
- `IsLeaveOneOutCandidate`: whether excluding that replicate improves the group CV
- `RecommendedDiscard`: whether the processor recommends removing it
- `ReplicateStatus`: `keep` or `discard`

### In `ysi_summary.csv`

- `ReplicateCount`: total technical replicates in the group
- `DiscardedReplicateCount`: number of recommended discards
- `RecommendedDiscardReplicates`: which replicate index should be reviewed
- `RawMean`, `RawStd`, `RawCVPercent`: original statistics
- `CleanMean`, `CleanStd`, `CleanCVPercent`: recalculated statistics after excluding recommended outliers
- `ReviewRequired`: whether the group deserves manual review
- `PassesCVThresholdAfterCleaning`: whether the cleaned group becomes acceptable

Practical interpretation:

- If `ReviewRequired = False`, the group is likely stable.
- If `ReviewRequired = True` but `RecommendedDiscard = False` for all rows, the group is noisy but not attributable to one clear replicate.
- If one replicate has `RecommendedDiscard = True`, that is the first value to inspect before deciding to repeat the sample.

---

## Typical Use Cases

YSI Processor is useful for:

- reviewing daily metabolite reads from CHO cultures
- spotting probable pipetting or sampling errors
- deciding whether a well should be repeated before data release
- cleaning technical replicates prior to trend analysis
- preserving metadata traceability across YSI runs
- preparing more reliable glucose/lactate series for feeding decisions

---

## Notes and Limitations

- The tool assumes the CSV comes from the YSI BioSample export format.
- `BatchName` is required to avoid mixing measurements from different runs.
- Outlier detection is a decision aid, not a substitute for scientific judgment.
- Very small replicate groups limit the strength of robust statistics.
- If a group is noisy but no single replicate is clearly abnormal, manual review is still necessary.
- Sensor or acquisition issues reported in `Errors` should always be checked alongside numerical QC flags.

---

## Architecture

- `ysi_processor.py`: CLI entry point
- `ysi_toolkit/io.py`: file discovery and ingestion
- `ysi_toolkit/analysis.py`: normalization, grouping, QC, and summary logic
- `ysi_toolkit/reporting.py`: CSV outputs, figures, and HTML report
- `ysi_toolkit/pipeline.py`: end-to-end orchestration
- `tests/`: unit tests with `pytest`

---

## Validation

The current codebase includes automated tests for:

- outlier recommendation on replicate groups
- cleaned summary generation after discard
- end-to-end pipeline output creation

Run them with:

```bash
./.venv/bin/python -m pytest -q
```
