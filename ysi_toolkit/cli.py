from __future__ import annotations

import argparse
import logging
from pathlib import Path

from .config import ProcessingConfig
from .logging_utils import configure_logging
from .pipeline import run_pipeline

LOGGER = logging.getLogger(__name__)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Robust processor for YSI 2950 BioSample exports")
    parser.add_argument("--input", type=Path, default=Path("."), help="Directory containing BioSample*.csv files")
    parser.add_argument("--output", type=Path, default=Path("."), help="Directory where outputs will be written")
    parser.add_argument("--cv", type=float, default=5.0, help="CV threshold for review")
    parser.add_argument("--modified-z", type=float, default=3.5, help="Modified z-score threshold")
    parser.add_argument("--iqr-multiplier", type=float, default=1.5, help="IQR multiplier for outlier fences")
    parser.add_argument("--consensus-min-flags", type=int, default=1, help="Minimum outlier signals required to recommend discard")
    parser.add_argument("--title", type=str, default="YSI 2950 Quality Report", help="HTML report title")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    configure_logging(args.verbose)
    config = ProcessingConfig(
        input_dir=args.input,
        output_dir=args.output,
        cv_threshold=args.cv,
        modified_z_threshold=args.modified_z,
        iqr_multiplier=args.iqr_multiplier,
        consensus_min_flags=args.consensus_min_flags,
        report_title=args.title,
    )
    outputs = run_pipeline(config)
    LOGGER.info("Generated outputs:")
    for name, path in outputs.items():
        LOGGER.info("%s -> %s", name, path)
    return 0
