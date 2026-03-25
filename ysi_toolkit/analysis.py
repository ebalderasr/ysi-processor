from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd

from .config import ProcessingConfig

LOGGER = logging.getLogger(__name__)

REQUIRED_COLUMN_ALIASES: dict[str, list[str]] = {
    "plate": ["PlateSequenceName", "PlateName", "PlateSequence", "PlateID"],
    "batch": ["BatchName", "Batch", "BatchID", "BatchId"],
    "well": ["WellId", "WellID", "Well", "Position"],
    "chemistry": ["ChemistryId", "ChemistryID", "Chemistry", "Analyte"],
    "concentration": ["Concentration", "Result", "Value"],
}

OPTIONAL_COLUMN_ALIASES: dict[str, list[str]] = {
    "state": ["CompletionState", "Status", "ResultState"],
    "sample": ["SampleSequenceName", "SampleName", "SampleId", "SampleID"],
    "timestamp": ["DateTime", "Timestamp", "Date"],
    "error": ["Error", "ErrorMessage", "SensorStatus", "InstrumentStatus"],
}


def resolve_columns(data: pd.DataFrame) -> dict[str, str]:
    """Resolve canonical business columns from a raw YSI export."""
    resolved: dict[str, str] = {}
    for key, aliases in REQUIRED_COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in data.columns:
                resolved[key] = alias
                break
        if key not in resolved:
            raise ValueError(
                f"Required YSI column for '{key}' not found. "
                f"Accepted aliases: {', '.join(aliases)}"
            )

    for key, aliases in OPTIONAL_COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in data.columns:
                resolved[key] = alias
                break

    return resolved


def prepare_measurements(data: pd.DataFrame, columns: dict[str, str]) -> pd.DataFrame:
    """Normalize the raw export into a clean replicate-level table."""
    frame = data.copy()
    concentration = columns["concentration"]
    frame[concentration] = pd.to_numeric(frame[concentration], errors="coerce")
    frame = frame.dropna(subset=[concentration]).copy()
    negative_count = int((frame[concentration] < 0).sum())
    if negative_count:
        LOGGER.warning("Dropped %d row(s) with negative concentration values.", negative_count)
    frame = frame[frame[concentration] >= 0].copy()

    if "state" in columns:
        state_column = columns["state"]
        completed = frame[state_column].astype(str).str.casefold().eq("complete")
        if completed.any():
            frame = frame[completed].copy()

    for logical_name in ("plate", "batch", "well", "chemistry"):
        column = columns[logical_name]
        frame[column] = frame[column].astype(str).str.strip()

    group_cols = [columns["plate"], columns["batch"], columns["well"], columns["chemistry"]]
    frame["ReplicateIndex"] = frame.groupby(group_cols).cumcount() + 1
    frame.rename(
        columns={
            columns["plate"]: "PlateSequenceName",
            columns["batch"]: "BatchName",
            columns["well"]: "WellId",
            columns["chemistry"]: "ChemistryId",
            concentration: "Concentration",
        },
        inplace=True,
    )

    if "sample" in columns and columns["sample"] != "SampleSequenceName":
        frame.rename(columns={columns["sample"]: "SampleSequenceName"}, inplace=True)
    if "timestamp" in columns and columns["timestamp"] != "Timestamp":
        frame.rename(columns={columns["timestamp"]: "Timestamp"}, inplace=True)
    if "state" in columns and columns["state"] != "CompletionState":
        frame.rename(columns={columns["state"]: "CompletionState"}, inplace=True)

    return frame


def annotate_replicates(data: pd.DataFrame, config: ProcessingConfig) -> pd.DataFrame:
    """Compute replicate-level QC metrics and outlier recommendations."""
    group_cols = ["PlateSequenceName", "BatchName", "WellId", "ChemistryId"]
    annotated_groups = [
        _annotate_group(group.copy(), config)
        for _, group in data.groupby(group_cols, sort=True, dropna=False)
    ]
    annotated = pd.concat(annotated_groups, ignore_index=True)
    return annotated.sort_values(group_cols + ["ReplicateIndex"]).reset_index(drop=True)


def _annotate_group(group: pd.DataFrame, config: ProcessingConfig) -> pd.DataFrame:
    values = group["Concentration"].astype(float)
    mean = float(values.mean())
    std = float(values.std(ddof=1)) if len(values) > 1 else np.nan
    cv = _safe_cv(mean, std)

    median = float(values.median())
    mad = float(np.median(np.abs(values - median)))
    if mad > 0:
        modified_z = 0.6745 * (values - median) / mad
    else:
        modified_z = pd.Series(np.zeros(len(values)), index=group.index, dtype=float)

    q1 = float(values.quantile(0.25))
    q3 = float(values.quantile(0.75))
    iqr = q3 - q1
    lower = q1 - config.iqr_multiplier * iqr
    upper = q3 + config.iqr_multiplier * iqr

    is_modz = (
        modified_z.abs() > config.modified_z_threshold
        if len(values) >= 3
        else pd.Series(False, index=group.index, dtype=bool)
    )
    is_iqr = (
        (values < lower) | (values > upper)
        if len(values) >= 3 and iqr > 0
        else pd.Series(False, index=group.index, dtype=bool)
    )
    leave_one_out_cv = _leave_one_out_cv(values)
    improvement = cv - leave_one_out_cv
    best_improvement = float(improvement.max()) if not improvement.dropna().empty else np.nan
    review_signal = bool((cv > config.cv_threshold) or is_modz.any() or is_iqr.any())

    if review_signal and np.isfinite(best_improvement):
        loo_candidate = (
            improvement.eq(best_improvement)
            & leave_one_out_cv.le(config.cv_threshold)
            & improvement.gt(0)
        )
    else:
        loo_candidate = pd.Series(False, index=group.index, dtype=bool)

    flag_score = is_modz.astype(int) + is_iqr.astype(int) + loo_candidate.astype(int)
    recommended = review_signal & (flag_score >= max(1, config.consensus_min_flags))

    if recommended.sum() > 1:
        deviation = (values - median).abs()
        candidates = pd.DataFrame(
            {"score": flag_score, "improvement": improvement, "deviation": deviation},
            index=group.index,
        )
        top_idx = (
            candidates[recommended]
            .sort_values(["score", "improvement", "deviation"], ascending=False)
            .index[0]
        )
        recommended = pd.Series(False, index=group.index)
        recommended.loc[top_idx] = True

    cleaned = values[~recommended]
    cleaned_mean = float(cleaned.mean()) if not cleaned.empty else np.nan
    cleaned_std = float(cleaned.std(ddof=1)) if len(cleaned) > 1 else np.nan
    cleaned_cv = _safe_cv(cleaned_mean, cleaned_std)

    group["RawMean"] = mean
    group["RawStd"] = std
    group["RawCVPercent"] = cv
    group["Median"] = median
    group["MAD"] = mad
    group["ModifiedZScore"] = modified_z.astype(float)
    group["IQRLowerFence"] = lower
    group["IQRUpperFence"] = upper
    group["IsOutlierModifiedZ"] = is_modz.astype(bool)
    group["IsOutlierIQR"] = is_iqr.astype(bool)
    group["LeaveOneOutCVPercent"] = leave_one_out_cv.astype(float)
    group["LeaveOneOutCVImprovement"] = improvement.astype(float)
    group["IsLeaveOneOutCandidate"] = loo_candidate.astype(bool)
    group["OutlierFlagScore"] = flag_score.astype(int)
    group["RecommendedDiscard"] = recommended.astype(bool)
    group["CleanMean"] = cleaned_mean
    group["CleanStd"] = cleaned_std
    group["CleanCVPercent"] = cleaned_cv
    group["ReviewRequired"] = bool(review_signal or recommended.any())
    group["ReplicateStatus"] = np.where(recommended, "discard", "keep")
    return group


def build_summary(annotated: pd.DataFrame, config: ProcessingConfig) -> pd.DataFrame:
    """Build group-level summary with raw and cleaned statistics."""
    group_cols = ["PlateSequenceName", "BatchName", "WellId", "ChemistryId"]
    records: list[dict[str, Any]] = []
    for keys, group in annotated.groupby(group_cols, sort=True, dropna=False):
        kept = group.loc[~group["RecommendedDiscard"]]
        discarded = group.loc[group["RecommendedDiscard"]]
        record: dict[str, Any] = dict(zip(group_cols, keys))
        record["ReplicateCount"] = int(len(group))
        record["DiscardedReplicateCount"] = int(discarded.shape[0])
        record["RecommendedDiscardReplicates"] = _join_replicates(discarded["ReplicateIndex"])
        record["RawMean"] = round(float(group["RawMean"].iloc[0]), 4)
        record["RawStd"] = _round_nullable(group["RawStd"].iloc[0])
        record["RawCVPercent"] = _round_nullable(group["RawCVPercent"].iloc[0], 2)
        record["CleanMean"] = _round_nullable(kept["Concentration"].mean())
        record["CleanStd"] = _round_nullable(kept["Concentration"].std(ddof=1))
        record["CleanCVPercent"] = _round_nullable(_safe_cv(kept["Concentration"].mean(), kept["Concentration"].std(ddof=1)), 2)
        record["ReviewRequired"] = bool(group["ReviewRequired"].iloc[0])
        record["OutlierDetected"] = bool(discarded.shape[0] > 0)
        record["PassesCVThresholdAfterCleaning"] = bool(
            pd.notna(record["CleanCVPercent"]) and record["CleanCVPercent"] <= config.cv_threshold
        )
        if "SampleSequenceName" in group.columns:
            record["SampleSequenceNames"] = _join_unique(group["SampleSequenceName"])
        if "Timestamp" in group.columns:
            record["Timestamps"] = _join_unique(group["Timestamp"])
        if "SourceFile" in group.columns:
            record["SourceFiles"] = _join_unique(group["SourceFile"])
        records.append(record)

    return pd.DataFrame(records).sort_values(group_cols).reset_index(drop=True)


def build_outlier_table(annotated: pd.DataFrame) -> pd.DataFrame:
    """Return only replicate rows that should be reviewed or discarded."""
    columns = [
        "PlateSequenceName",
        "BatchName",
        "WellId",
        "ChemistryId",
        "ReplicateIndex",
        "Concentration",
        "ModifiedZScore",
        "LeaveOneOutCVPercent",
        "LeaveOneOutCVImprovement",
        "IsOutlierModifiedZ",
        "IsOutlierIQR",
        "IsLeaveOneOutCandidate",
        "OutlierFlagScore",
        "RecommendedDiscard",
        "ReviewRequired",
        "SourceFile",
    ]
    present = [column for column in columns if column in annotated.columns]
    outliers = annotated[(annotated["RecommendedDiscard"]) | (annotated["ReviewRequired"])].copy()
    return outliers[present].sort_values(
        ["PlateSequenceName", "BatchName", "WellId", "ChemistryId", "ReplicateIndex"]
    ).reset_index(drop=True)


def _leave_one_out_cv(values: pd.Series) -> pd.Series:
    result = pd.Series(np.nan, index=values.index, dtype=float)
    if len(values) <= 2:
        return result

    for idx in values.index:
        subset = values.drop(index=idx)
        std = subset.std(ddof=1) if len(subset) > 1 else np.nan
        result.loc[idx] = _safe_cv(subset.mean(), std)
    return result


def _safe_cv(mean: float, std: float) -> float:
    if pd.isna(mean) or pd.isna(std) or np.isclose(mean, 0.0):
        return np.nan
    return abs(float(std) / float(mean) * 100.0)


def _join_replicates(series: pd.Series) -> str:
    if series.empty:
        return ""
    return ", ".join(str(int(value)) for value in series.astype(int).tolist())


def _join_unique(series: pd.Series) -> str:
    values = [str(value) for value in pd.Series(series).dropna().astype(str).unique() if str(value).strip()]
    return " | ".join(values)


def _round_nullable(value: Any, digits: int = 4) -> float | None:
    if pd.isna(value):
        return None
    return round(float(value), digits)
