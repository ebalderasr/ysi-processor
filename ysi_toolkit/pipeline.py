from __future__ import annotations

import logging
from pathlib import Path

from .analysis import annotate_replicates, build_outlier_table, build_summary, prepare_measurements, resolve_columns
from .config import ProcessingConfig
from .io import build_file_manifest, discover_biosample_files, load_biosample_files
from .reporting import create_report_bundle

LOGGER = logging.getLogger(__name__)


def run_pipeline(config: ProcessingConfig) -> dict[str, Path]:
    """Execute the complete YSI QC processing pipeline."""
    files = discover_biosample_files(config.input_dir)
    if not files:
        raise FileNotFoundError(f"No BioSample*.csv files found in {config.input_dir}")

    raw = load_biosample_files(files)
    columns = resolve_columns(raw)
    measurements = prepare_measurements(raw, columns)
    annotated = annotate_replicates(measurements, config)
    summary = build_summary(annotated, config)
    outliers = build_outlier_table(annotated)
    manifest = build_file_manifest(raw)
    outputs = create_report_bundle(annotated, summary, outliers, manifest, config.output_dir, config)
    LOGGER.info("Processed %s replicate rows across %s groups", len(annotated), len(summary))
    return outputs
