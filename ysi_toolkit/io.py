from __future__ import annotations

import logging
from pathlib import Path
from typing import Iterable

import pandas as pd

LOGGER = logging.getLogger(__name__)


def discover_biosample_files(input_dir: Path) -> list[Path]:
    """Return all BioSample CSV files sorted by name."""
    return sorted(input_dir.glob("BioSample*.csv"))


def load_biosample_files(paths: Iterable[Path]) -> pd.DataFrame:
    """Load and concatenate YSI BioSample exports."""
    frames: list[pd.DataFrame] = []
    for path in paths:
        LOGGER.info("Reading %s", path)
        frame = pd.read_csv(path)
        frame.columns = [str(column).strip() for column in frame.columns]
        frame["SourceFile"] = path.name
        frames.append(frame)

    if not frames:
        raise FileNotFoundError("No BioSample*.csv files were found.")

    return pd.concat(frames, ignore_index=True)


def build_file_manifest(data: pd.DataFrame) -> pd.DataFrame:
    """Summarize file-level metadata that can support traceability."""
    metadata_candidates = [
        "SourceFile",
        "Date",
        "DateTime",
        "PlateSequenceName",
        "BatchName",
        "SampleSequenceName",
        "InstrumentName",
        "InstrumentId",
        "AnalyzerName",
        "Operator",
        "Batch",
        "Lot",
        "SensorStatus",
        "CompletionState",
        "Error",
        "ErrorMessage",
    ]
    present = [column for column in metadata_candidates if column in data.columns]
    if not present:
        return pd.DataFrame({"SourceFile": sorted(data["SourceFile"].dropna().unique())})

    aggregations = {
        column: _join_unique
        for column in present
        if column != "SourceFile"
    }
    manifest = data[present].groupby("SourceFile", dropna=False).agg(aggregations).reset_index()
    manifest["RowCount"] = data.groupby("SourceFile", dropna=False).size().values
    return manifest


def _join_unique(series: pd.Series) -> str:
    values = [str(value) for value in series.dropna().astype(str).unique() if str(value).strip()]
    return " | ".join(values[:10])
