from __future__ import annotations

import pandas as pd

from ysi_toolkit.analysis import annotate_replicates, build_summary
from ysi_toolkit.config import ProcessingConfig


def test_outlier_recommendation_identifies_bad_replicate() -> None:
    data = pd.DataFrame(
        {
            "PlateSequenceName": ["PlateA"] * 4,
            "BatchName": ["Batch-01"] * 4,
            "WellId": ["A01"] * 4,
            "ChemistryId": ["Glucose"] * 4,
            "Concentration": [1.00, 1.01, 0.99, 1.45],
            "ReplicateIndex": [1, 2, 3, 4],
            "SourceFile": ["BioSample001.csv"] * 4,
        }
    )
    annotated = annotate_replicates(data, ProcessingConfig(input_dir=".", output_dir="."))
    discarded = annotated.loc[annotated["RecommendedDiscard"], "ReplicateIndex"].tolist()
    assert discarded == [4]


def test_summary_uses_cleaned_statistics_after_discard() -> None:
    data = pd.DataFrame(
        {
            "PlateSequenceName": ["PlateA"] * 4,
            "BatchName": ["Batch-01"] * 4,
            "WellId": ["A01"] * 4,
            "ChemistryId": ["Lactate"] * 4,
            "Concentration": [2.00, 2.02, 1.98, 2.60],
            "ReplicateIndex": [1, 2, 3, 4],
            "SourceFile": ["BioSample001.csv"] * 4,
        }
    )
    config = ProcessingConfig(input_dir=".", output_dir=".", cv_threshold=5.0)
    annotated = annotate_replicates(data, config)
    summary = build_summary(annotated, config)
    row = summary.iloc[0]
    assert row["DiscardedReplicateCount"] == 1
    assert row["RecommendedDiscardReplicates"] == "4"
    assert row["CleanMean"] == 2.0
    assert bool(row["PassesCVThresholdAfterCleaning"]) is True
