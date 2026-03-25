from __future__ import annotations

import logging
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

from .config import ProcessingConfig

LOGGER = logging.getLogger(__name__)


def create_report_bundle(
    measurements: pd.DataFrame,
    summary: pd.DataFrame,
    outliers: pd.DataFrame,
    manifest: pd.DataFrame,
    output_dir: Path,
    config: ProcessingConfig,
) -> dict[str, Path]:
    """Persist tables, figures and an HTML quality report."""
    output_dir.mkdir(parents=True, exist_ok=True)

    paths = {
        "measurements_csv": output_dir / "ysi_measurements_annotated.csv",
        "summary_csv": output_dir / "ysi_summary.csv",
        "outliers_csv": output_dir / "ysi_outliers.csv",
        "manifest_csv": output_dir / "ysi_file_manifest.csv",
        "cv_plot": output_dir / "ysi_cv_overview.png",
        "replicate_plot": output_dir / "ysi_flagged_replicates.png",
        "html_report": output_dir / "ysi_quality_report.html",
    }

    measurements.to_csv(paths["measurements_csv"], index=False)
    summary.to_csv(paths["summary_csv"], index=False)
    outliers.to_csv(paths["outliers_csv"], index=False)
    manifest.to_csv(paths["manifest_csv"], index=False)
    _plot_cv_overview(summary, paths["cv_plot"], config)
    _plot_flagged_replicates(measurements, paths["replicate_plot"])
    _write_html_report(summary, outliers, manifest, paths, config)
    return paths


def _plot_cv_overview(summary: pd.DataFrame, output_path: Path, config: ProcessingConfig) -> None:
    fig, ax = plt.subplots(figsize=(12, 6))
    if summary.empty:
        ax.text(0.5, 0.5, "No data available", ha="center", va="center")
        ax.axis("off")
    else:
        plot_df = summary.copy()
        plot_df["GroupLabel"] = (
            plot_df["PlateSequenceName"] + " | " + plot_df["BatchName"] + " | " + plot_df["WellId"] + " | " + plot_df["ChemistryId"]
        )
        plot_df = plot_df.sort_values("RawCVPercent", ascending=False).head(25)
        positions = range(len(plot_df))
        ax.bar(positions, plot_df["RawCVPercent"], label="Raw CV%", alpha=0.8, color="#c2410c")
        ax.bar(positions, plot_df["CleanCVPercent"], label="Clean CV%", alpha=0.8, color="#15803d")
        ax.axhline(config.cv_threshold, color="#1d4ed8", linestyle="--", linewidth=1.5, label="CV threshold")
        ax.set_xticks(list(positions))
        ax.set_xticklabels(plot_df["GroupLabel"], rotation=75, ha="right")
        ax.set_ylabel("CV (%)")
        ax.set_title("Top wells by variability before and after cleaning")
        ax.legend()
    fig.tight_layout()
    fig.savefig(output_path, dpi=200)
    plt.close(fig)


def _plot_flagged_replicates(measurements: pd.DataFrame, output_path: Path) -> None:
    flagged = measurements[measurements["ReviewRequired"]].copy()
    fig, ax = plt.subplots(figsize=(12, 6))
    if flagged.empty:
        ax.text(0.5, 0.5, "No flagged replicate groups", ha="center", va="center")
        ax.axis("off")
    else:
        flagged["GroupLabel"] = (
            flagged["PlateSequenceName"] + " | " + flagged["BatchName"] + " | " + flagged["WellId"] + " | " + flagged["ChemistryId"]
        )
        groups = list(flagged["GroupLabel"].drop_duplicates())
        position_map = {label: position for position, label in enumerate(groups)}
        flagged["PlotPosition"] = flagged["GroupLabel"].map(position_map).astype(float)
        flagged["PlotPosition"] += (flagged["ReplicateIndex"] - flagged["ReplicateIndex"].mean()) * 0.05
        colors = flagged["RecommendedDiscard"].map({True: "#b91c1c", False: "#2563eb"})
        ax.scatter(flagged["PlotPosition"], flagged["Concentration"], c=colors, alpha=0.9)
        ax.set_xticks(list(position_map.values()))
        ax.set_xticklabels(groups, rotation=75, ha="right")
        ax.set_ylabel("Concentration")
        ax.set_title("Flagged replicate groups")
    fig.tight_layout()
    fig.savefig(output_path, dpi=200)
    plt.close(fig)


def _write_html_report(
    summary: pd.DataFrame,
    outliers: pd.DataFrame,
    manifest: pd.DataFrame,
    paths: dict[str, Path],
    config: ProcessingConfig,
) -> None:
    top_flags = summary[summary["ReviewRequired"]].sort_values("RawCVPercent", ascending=False).head(20)
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{config.report_title}</title>
  <style>
    body {{ font-family: "DejaVu Sans", sans-serif; margin: 2rem auto; max-width: 1200px; color: #1f2937; }}
    h1, h2 {{ color: #111827; }}
    .kpis {{ display: flex; gap: 1rem; margin: 1rem 0 2rem; }}
    .card {{ background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 1rem 1.25rem; min-width: 180px; }}
    img {{ max-width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; }}
    table {{ border-collapse: collapse; width: 100%; margin: 1rem 0 2rem; }}
    th, td {{ border: 1px solid #e5e7eb; padding: 0.5rem; text-align: left; font-size: 0.92rem; }}
    th {{ background: #f3f4f6; }}
  </style>
</head>
<body>
  <h1>{config.report_title}</h1>
  <p>Automated QC report for YSI 2950 BioSample exports. Outlier recommendations combine modified z-score, IQR fences and leave-one-out CV improvement.</p>
  <div class="kpis">
    <div class="card"><strong>Total replicate groups</strong><br>{len(summary)}</div>
    <div class="card"><strong>Flagged groups</strong><br>{int(summary["ReviewRequired"].sum()) if not summary.empty else 0}</div>
    <div class="card"><strong>Discard recommendations</strong><br>{int(summary["DiscardedReplicateCount"].sum()) if not summary.empty else 0}</div>
    <div class="card"><strong>Input files</strong><br>{len(manifest)}</div>
  </div>
  <h2>Variability overview</h2>
  <img src="{paths["cv_plot"].name}" alt="CV overview">
  <h2>Flagged replicate concentrations</h2>
  <img src="{paths["replicate_plot"].name}" alt="Flagged replicates">
  <h2>Top flagged groups</h2>
  {top_flags.to_html(index=False) if not top_flags.empty else "<p>No flagged groups.</p>"}
  <h2>Recommended outliers</h2>
  {outliers.to_html(index=False) if not outliers.empty else "<p>No outliers were recommended for discard.</p>"}
  <h2>File manifest and metadata</h2>
  {manifest.to_html(index=False) if not manifest.empty else "<p>No file metadata detected.</p>"}
</body>
</html>
"""
    paths["html_report"].write_text(html, encoding="utf-8")
    LOGGER.info("HTML report written to %s", paths["html_report"])
