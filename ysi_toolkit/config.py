from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(slots=True)
class ProcessingConfig:
    """Runtime configuration for YSI processing."""

    input_dir: Path
    output_dir: Path
    cv_threshold: float = 5.0
    modified_z_threshold: float = 3.5
    iqr_multiplier: float = 1.5
    consensus_min_flags: int = 1
    report_title: str = "YSI 2950 Quality Report"
