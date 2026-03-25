from __future__ import annotations

from pathlib import Path

import pandas as pd

from ysi_toolkit.config import ProcessingConfig
from ysi_toolkit.pipeline import run_pipeline


def test_pipeline_writes_expected_outputs(tmp_path: Path) -> None:
    input_dir = tmp_path / "input"
    output_dir = tmp_path / "output"
    input_dir.mkdir()

    frame = pd.DataFrame(
        {
            "PlateSequenceName": ["Plate1", "Plate1", "Plate1", "Plate1"],
            "BatchName": ["Batch-Alpha", "Batch-Alpha", "Batch-Alpha", "Batch-Alpha"],
            "WellId": ["B03", "B03", "B03", "B03"],
            "ChemistryId": ["Glucose", "Glucose", "Glucose", "Glucose"],
            "Concentration": [5.0, 5.1, 5.0, 6.5],
            "CompletionState": ["Complete", "Complete", "Complete", "Complete"],
            "DateTime": ["2026-03-25 08:00:00"] * 4,
            "SensorStatus": ["OK"] * 4,
        }
    )
    frame.to_csv(input_dir / "BioSample001.csv", index=False)

    outputs = run_pipeline(ProcessingConfig(input_dir=input_dir, output_dir=output_dir))
    expected = {
        "measurements_csv",
        "summary_csv",
        "outliers_csv",
        "manifest_csv",
        "cv_plot",
        "replicate_plot",
        "html_report",
    }
    assert set(outputs) == expected
    for path in outputs.values():
        assert path.exists()
