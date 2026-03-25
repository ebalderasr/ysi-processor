const REQUIRED_COLUMN_ALIASES = {
  plate: ["PlateSequenceName", "PlateName", "PlateSequence", "PlateID"],
  batch: ["BatchName", "Batch", "BatchID", "BatchId"],
  well: ["WellId", "WellID", "Well", "Position"],
  chemistry: ["ChemistryId", "ChemistryID", "Chemistry", "Analyte"],
  concentration: ["Concentration", "Result", "Value"],
};

const OPTIONAL_COLUMN_ALIASES = {
  state: ["CompletionState", "Status", "ResultState"],
  sample: ["SampleSequenceName", "SampleName", "SampleId", "SampleID"],
  timestamp: ["LocalCompletionTime", "DateTime", "Timestamp", "Date"],
  error: ["Errors", "Error", "ErrorMessage", "SensorStatus", "InstrumentStatus"],
};

const METADATA_COLUMNS = [
  "SourceFile",
  "BatchName",
  "PlateSequenceName",
  "SampleSequenceName",
  "LocalCompletionTime",
  "DateTime",
  "InstrumentName",
  "InstrumentId",
  "AnalyzerName",
  "Operator",
  "Lot",
  "SensorStatus",
  "CompletionState",
  "Errors",
  "Error",
  "ErrorMessage",
];

const state = {
  files: [],
  outputs: null,
};

const dom = {
  fileInput: document.getElementById("file-input"),
  processButton: document.getElementById("process-button"),
  loadDemoButton: document.getElementById("load-demo-button"),
  fileList: document.getElementById("file-list"),
  statusBox: document.getElementById("status-box"),
  manifestPreview: document.getElementById("manifest-preview"),
  dropzone: document.getElementById("dropzone"),
  cvThreshold: document.getElementById("cv-threshold"),
  modzThreshold: document.getElementById("modz-threshold"),
  iqrMultiplier: document.getElementById("iqr-multiplier"),
  consensusFlags: document.getElementById("consensus-flags"),
  kpiPanel: document.getElementById("kpi-panel"),
  kpiGrid: document.getElementById("kpi-grid"),
  chartPanel: document.getElementById("chart-panel"),
  cvChart: document.getElementById("cv-chart"),
  resultsPanel: document.getElementById("results-panel"),
  flagsPanel: document.getElementById("flags-panel"),
  detailPanel: document.getElementById("detail-panel"),
  summaryTable: document.getElementById("summary-table"),
  outliersTable: document.getElementById("outliers-table"),
  measurementsTable: document.getElementById("measurements-table"),
  summarySearch: document.getElementById("summary-search"),
  downloadSummary: document.getElementById("download-summary"),
  downloadMeasurements: document.getElementById("download-measurements"),
  downloadOutliers: document.getElementById("download-outliers"),
  downloadManifest: document.getElementById("download-manifest"),
  quickResultsPanel: document.getElementById("quick-results-panel"),
  quickResultsTable: document.getElementById("quick-results-table"),
  copyResultsBtn: document.getElementById("copy-results-btn"),
};

function initializeApp() {
  dom.fileInput.addEventListener("change", (event) => setFiles(Array.from(event.target.files || [])));
  dom.processButton.addEventListener("click", processFiles);
  dom.loadDemoButton.addEventListener("click", loadDemoGuide);
  dom.summarySearch.addEventListener("input", renderSummaryTable);
  dom.downloadSummary.addEventListener("click", () => downloadOutput("summary", "ysi_summary.csv"));
  dom.downloadMeasurements.addEventListener("click", () => downloadOutput("measurements", "ysi_measurements_annotated.csv"));
  dom.downloadOutliers.addEventListener("click", () => downloadOutput("outliers", "ysi_outliers.csv"));
  dom.downloadManifest.addEventListener("click", () => downloadOutput("manifest", "ysi_file_manifest.csv"));
  dom.copyResultsBtn.addEventListener("click", copyResultsTable);

  ["dragenter", "dragover"].forEach((eventName) => {
    dom.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dom.dropzone.classList.add("dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    dom.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dom.dropzone.classList.remove("dragging");
    });
  });
  dom.dropzone.addEventListener("drop", (event) => {
    const files = Array.from(event.dataTransfer?.files || []).filter((file) => file.name.toLowerCase().endsWith(".csv"));
    setFiles(files);
  });
}

function setFiles(files) {
  state.files = files;
  dom.fileList.innerHTML = "";
  if (!files.length) {
    dom.fileList.textContent = "";
    updateStatus("Waiting for BioSample files.");
    return;
  }

  files.forEach((file) => {
    const chip = document.createElement("span");
    chip.className = "file-chip";
    chip.textContent = `${file.name} (${formatNumber(file.size / 1024, 1)} KB)`;
    dom.fileList.appendChild(chip);
  });
  updateStatus(`${files.length} file(s) ready for processing.`);
}

function loadDemoGuide() {
  dom.manifestPreview.innerHTML = `
    <strong>Expected YSI export pattern</strong><br>
    Use one or more files named <code>BioSample*.csv</code>.<br>
    Required fields: <code>PlateSequenceName</code>, <code>BatchName</code>, <code>WellId</code>, <code>ChemistryId</code>, <code>Concentration</code>.
  `;
}

async function processFiles() {
  if (!state.files.length) {
    updateStatus("Choose at least one BioSample CSV file first.");
    return;
  }

  updateStatus("Reading files and computing replicate QC...");
  try {
    const config = getConfig();
    const rawRows = [];
    for (const file of state.files) {
      const text = await file.text();
      const rows = parseCsv(text).map((row) => ({ ...row, SourceFile: file.name }));
      rawRows.push(...rows);
    }

    if (!rawRows.length) {
      throw new Error("The selected files do not contain any data rows.");
    }

    const columns = resolveColumns(rawRows);
    const measurements = prepareMeasurements(rawRows, columns);
    const annotated = annotateReplicates(measurements, config);
    const summary = buildSummary(annotated, config);
    const outliers = buildOutlierTable(annotated);
    const manifest = buildManifest(rawRows);

    state.outputs = { measurements: annotated, summary, outliers, manifest, config };
    renderOutputs();
    updateStatus(`Processed ${annotated.length} measurements across ${summary.length} replicate groups.`);
  } catch (error) {
    console.error(error);
    updateStatus(error.message || "Processing failed.");
  }
}

function getConfig() {
  return {
    cvThreshold: Number(dom.cvThreshold.value || 5),
    modifiedZThreshold: Number(dom.modzThreshold.value || 3.5),
    iqrMultiplier: Number(dom.iqrMultiplier.value || 1.5),
    consensusMinFlags: Math.max(1, Number(dom.consensusFlags.value || 1)),
  };
}

function updateStatus(message) {
  dom.statusBox.textContent = message;
}

function resolveColumns(rows) {
  const sampleRow = rows[0] || {};
  const headers = Object.keys(sampleRow);
  const resolved = {};

  Object.entries(REQUIRED_COLUMN_ALIASES).forEach(([logicalName, aliases]) => {
    const match = aliases.find((alias) => headers.includes(alias));
    if (!match) {
      throw new Error(`Missing required column for "${logicalName}". Expected one of: ${aliases.join(", ")}`);
    }
    resolved[logicalName] = match;
  });

  Object.entries(OPTIONAL_COLUMN_ALIASES).forEach(([logicalName, aliases]) => {
    const match = aliases.find((alias) => headers.includes(alias));
    if (match) {
      resolved[logicalName] = match;
    }
  });

  return resolved;
}

function prepareMeasurements(rows, columns) {
  const concentrationKey = columns.concentration;
  const stateKey = columns.state;
  let filtered = rows
    .map((row) => ({ ...row, [concentrationKey]: Number(row[concentrationKey]) }))
    .filter((row) => Number.isFinite(row[concentrationKey]) && row[concentrationKey] >= 0);

  if (stateKey) {
    const anyComplete = filtered.some((row) => String(row[stateKey] || "").trim().toLowerCase() === "complete");
    if (anyComplete) {
      filtered = filtered.filter((row) => String(row[stateKey] || "").trim().toLowerCase() === "complete");
    }
  }

  const groupCounters = new Map();
  return filtered.map((row) => {
    const normalized = {
      PlateSequenceName: String(row[columns.plate] || "").trim(),
      BatchName: String(row[columns.batch] || "").trim(),
      WellId: String(row[columns.well] || "").trim(),
      ChemistryId: String(row[columns.chemistry] || "").trim(),
      Concentration: Number(row[concentrationKey]),
      SourceFile: row.SourceFile || "",
    };
    if (columns.sample) {
      normalized.SampleSequenceName = row[columns.sample] || "";
    }
    if (columns.timestamp) {
      normalized.Timestamp = row[columns.timestamp] || "";
    }
    if (stateKey) {
      normalized.CompletionState = row[stateKey] || "";
    }
    if (columns.error) {
      normalized.ErrorInfo = row[columns.error] || "";
    }

    const counterKey = groupKey(normalized);
    const nextIndex = (groupCounters.get(counterKey) || 0) + 1;
    groupCounters.set(counterKey, nextIndex);
    normalized.ReplicateIndex = nextIndex;
    return normalized;
  });
}

function annotateReplicates(measurements, config) {
  const groups = groupBy(measurements, (row) => groupKey(row));
  const annotated = [];
  Array.from(groups.values())
    .sort(sortGroups)
    .forEach((group) => {
      annotated.push(...annotateGroup(group, config));
    });
  return annotated;
}

function annotateGroup(group, config) {
  const values = group.map((row) => row.Concentration);
  const rawMean = mean(values);
  const rawStd = sampleStd(values);
  const rawCV = safeCv(rawMean, rawStd);
  const med = median(values);
  const mad = median(values.map((value) => Math.abs(value - med)));
  const modifiedZScores = mad > 0
    ? values.map((value) => 0.6745 * (value - med) / mad)
    : values.map(() => 0);

  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - config.iqrMultiplier * iqr;
  const upperFence = q3 + config.iqrMultiplier * iqr;
  const isModz = values.map((_, index) => values.length >= 3 && Math.abs(modifiedZScores[index]) > config.modifiedZThreshold);
  const isIqr = values.map((value) => values.length >= 3 && iqr > 0 && (value < lowerFence || value > upperFence));
  const leaveOneOutCV = values.map((_, index) => {
    if (values.length <= 2) {
      return Number.NaN;
    }
    const subset = values.filter((__, innerIndex) => innerIndex !== index);
    return safeCv(mean(subset), sampleStd(subset));
  });
  const improvements = leaveOneOutCV.map((value) => rawCV - value);
  const bestImprovement = improvements.reduce((best, value) => Number.isFinite(value) && value > best ? value : best, Number.NEGATIVE_INFINITY);
  const reviewSignal = Boolean(
    (Number.isFinite(rawCV) && rawCV > config.cvThreshold)
    || isModz.some(Boolean)
    || isIqr.some(Boolean)
  );

  const leaveOneOutCandidate = values.map((_, index) => (
    reviewSignal
    && Number.isFinite(bestImprovement)
    && improvements[index] === bestImprovement
    && improvements[index] > 0
    && leaveOneOutCV[index] <= config.cvThreshold
  ));

  let recommended = values.map((_, index) => reviewSignal && (
    Number(isModz[index]) + Number(isIqr[index]) + Number(leaveOneOutCandidate[index])
  ) >= Math.max(1, config.consensusMinFlags));

  if (recommended.filter(Boolean).length > 1) {
    const ranked = recommended
      .map((flag, index) => ({
        index,
        flag,
        score: Number(isModz[index]) + Number(isIqr[index]) + Number(leaveOneOutCandidate[index]),
        improvement: improvements[index],
        deviation: Math.abs(values[index] - med),
      }))
      .filter((entry) => entry.flag)
      .sort((left, right) => (
        right.score - left.score
        || numberOrNegInf(right.improvement) - numberOrNegInf(left.improvement)
        || right.deviation - left.deviation
      ));
    recommended = values.map(() => false);
    recommended[ranked[0].index] = true;
  }

  const cleanedValues = values.filter((_, index) => !recommended[index]);
  const cleanMean = cleanedValues.length ? mean(cleanedValues) : Number.NaN;
  const cleanStd = cleanedValues.length > 1 ? sampleStd(cleanedValues) : Number.NaN;
  const cleanCV = safeCv(cleanMean, cleanStd);

  return group.map((row, index) => ({
    ...row,
    RawMean: rawMean,
    RawStd: rawStd,
    RawCVPercent: rawCV,
    Median: med,
    MAD: mad,
    ModifiedZScore: modifiedZScores[index],
    IQRLowerFence: lowerFence,
    IQRUpperFence: upperFence,
    IsOutlierModifiedZ: isModz[index],
    IsOutlierIQR: isIqr[index],
    LeaveOneOutCVPercent: leaveOneOutCV[index],
    LeaveOneOutCVImprovement: improvements[index],
    IsLeaveOneOutCandidate: leaveOneOutCandidate[index],
    OutlierFlagScore: Number(isModz[index]) + Number(isIqr[index]) + Number(leaveOneOutCandidate[index]),
    RecommendedDiscard: recommended[index],
    CleanMean: cleanMean,
    CleanStd: cleanStd,
    CleanCVPercent: cleanCV,
    ReviewRequired: reviewSignal || recommended[index],
    ReplicateStatus: recommended[index] ? "discard" : "keep",
  }));
}

function buildSummary(annotated, config) {
  const groups = groupBy(annotated, (row) => groupKey(row));
  return Array.from(groups.values())
    .sort(sortGroups)
    .map((group) => {
      const first = group[0];
      const kept = group.filter((row) => !row.RecommendedDiscard);
      const discarded = group.filter((row) => row.RecommendedDiscard);
      const cleanValues = kept.map((row) => row.Concentration);
      const cleanMean = cleanValues.length ? mean(cleanValues) : Number.NaN;
      const cleanStd = cleanValues.length > 1 ? sampleStd(cleanValues) : Number.NaN;
      const cleanCV = safeCv(cleanMean, cleanStd);
      return {
        PlateSequenceName: first.PlateSequenceName,
        BatchName: first.BatchName,
        WellId: first.WellId,
        ChemistryId: first.ChemistryId,
        ReplicateCount: group.length,
        DiscardedReplicateCount: discarded.length,
        RecommendedDiscardReplicates: discarded.map((row) => row.ReplicateIndex).join(", "),
        RawMean: roundOrBlank(first.RawMean, 4),
        RawStd: roundOrBlank(first.RawStd, 4),
        RawCVPercent: roundOrBlank(first.RawCVPercent, 2),
        CleanMean: roundOrBlank(cleanMean, 4),
        CleanStd: roundOrBlank(cleanStd, 4),
        CleanCVPercent: roundOrBlank(cleanCV, 2),
        ReviewRequired: Boolean(first.ReviewRequired),
        OutlierDetected: discarded.length > 0,
        PassesCVThresholdAfterCleaning: Number.isFinite(cleanCV) && cleanCV <= config.cvThreshold,
        SampleSequenceNames: joinUnique(group.map((row) => row.SampleSequenceName).filter(Boolean)),
        Timestamps: joinUnique(group.map((row) => row.Timestamp).filter(Boolean)),
        SourceFiles: joinUnique(group.map((row) => row.SourceFile).filter(Boolean)),
      };
    });
}

function buildOutlierTable(annotated) {
  return annotated
    .filter((row) => row.RecommendedDiscard || row.ReviewRequired)
    .map((row) => ({
      PlateSequenceName: row.PlateSequenceName,
      BatchName: row.BatchName,
      WellId: row.WellId,
      ChemistryId: row.ChemistryId,
      ReplicateIndex: row.ReplicateIndex,
      Reason: formatReason(row),
      Concentration: roundOrBlank(row.Concentration, 4),
      ModifiedZScore: roundOrBlank(row.ModifiedZScore, 3),
      LeaveOneOutCVPercent: roundOrBlank(row.LeaveOneOutCVPercent, 2),
      LeaveOneOutCVImprovement: roundOrBlank(row.LeaveOneOutCVImprovement, 2),
      IsOutlierModifiedZ: row.IsOutlierModifiedZ,
      IsOutlierIQR: row.IsOutlierIQR,
      IsLeaveOneOutCandidate: row.IsLeaveOneOutCandidate,
      OutlierFlagScore: row.OutlierFlagScore,
      RecommendedDiscard: row.RecommendedDiscard,
      ReviewRequired: row.ReviewRequired,
      SourceFile: row.SourceFile,
    }));
}

function buildManifest(rawRows) {
  const groups = groupBy(rawRows, (row) => row.SourceFile || "");
  return Array.from(groups.entries()).map(([sourceFile, rows]) => {
    const manifestRow = { SourceFile: sourceFile, RowCount: rows.length };
    METADATA_COLUMNS.forEach((column) => {
      if (column !== "SourceFile") {
        const values = joinUnique(rows.map((row) => row[column]).filter((value) => value !== undefined && String(value).trim()));
        if (values) {
          manifestRow[column] = values;
        }
      }
    });
    return manifestRow;
  });
}

function renderOutputs() {
  const { summary, outliers, measurements, manifest, config } = state.outputs;

  dom.kpiPanel.classList.remove("hidden");
  dom.quickResultsPanel.classList.remove("hidden");
  dom.chartPanel.classList.remove("hidden");
  dom.resultsPanel.classList.remove("hidden");
  dom.flagsPanel.classList.remove("hidden");
  dom.detailPanel.classList.remove("hidden");

  const flaggedGroups = summary.filter((row) => row.ReviewRequired).length;
  const discardCount = summary.reduce((total, row) => total + Number(row.DiscardedReplicateCount || 0), 0);
  const kpis = [
    ["Replicate groups", summary.length],
    ["Flagged groups", flaggedGroups],
    ["Discard recommendations", discardCount],
    ["Measurements", measurements.length],
  ];
  dom.kpiGrid.innerHTML = "";
  kpis.forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "kpi-card";
    card.innerHTML = `<span class="kpi-label">${label}</span><span class="kpi-value">${value}</span>`;
    dom.kpiGrid.appendChild(card);
  });

  renderManifestPreview(manifest);
  renderQuickResults(summary, config);
  renderCvChart(summary, config);
  renderSummaryTable();
  renderTable(dom.outliersTable, outliers, { limit: 150 });
  renderTable(dom.measurementsTable, measurements.map(formatMeasurementRow), { limit: 300 });
}

function renderManifestPreview(manifest) {
  if (!manifest.length) {
    dom.manifestPreview.textContent = "No metadata manifest available.";
    return;
  }
  const first = manifest[0];
  dom.manifestPreview.innerHTML = `
    <strong>${manifest.length} file(s)</strong><br>
    First file: <code>${escapeHtml(first.SourceFile || "")}</code><br>
    Rows: <strong>${first.RowCount}</strong><br>
    Batch: <strong>${escapeHtml(first.BatchName || "n/a")}</strong><br>
    Plate: <strong>${escapeHtml(first.PlateSequenceName || "n/a")}</strong>
  `;
}

function renderCvChart(summary, config) {
  const topRows = [...summary]
    .sort((left, right) => numberOrNegInf(right.RawCVPercent) - numberOrNegInf(left.RawCVPercent))
    .slice(0, 20);
  const threshold = config?.cvThreshold ?? 5;
  const maxValue = Math.max(threshold * 1.1, ...topRows.flatMap((row) => [Number(row.RawCVPercent) || 0, Number(row.CleanCVPercent) || 0]));
  const thresholdPct = (threshold / maxValue * 100).toFixed(2);

  dom.cvChart.innerHTML = "";
  topRows.forEach((row) => {
    const chartRow = document.createElement("div");
    chartRow.className = "chart-bar-row";
    const label = `${row.WellId} · ${row.ChemistryId} · ${row.PlateSequenceName} · ${row.BatchName}`;
    const rawPct = Math.max(0, Number(row.RawCVPercent) || 0) / maxValue * 100;
    const cleanPct = Math.max(0, Number(row.CleanCVPercent) || 0) / maxValue * 100;
    chartRow.innerHTML = `
      <div class="chart-label">${escapeHtml(label)}</div>
      <div class="bar-track" title="Raw CV: ${row.RawCVPercent}%">
        <div class="bar-fill raw" style="width:${rawPct}%"></div>
        <div class="bar-track-threshold" style="left:${thresholdPct}%"></div>
      </div>
      <div class="bar-track" title="Cleaned CV: ${row.CleanCVPercent}%">
        <div class="bar-fill clean" style="width:${cleanPct}%"></div>
        <div class="bar-track-threshold" style="left:${thresholdPct}%"></div>
      </div>
    `;
    dom.cvChart.appendChild(chartRow);
  });
}

function renderSummaryTable() {
  if (!state.outputs) {
    return;
  }
  const query = dom.summarySearch.value.trim().toLowerCase();
  const rows = state.outputs.summary
    .filter((row) => !query || Object.values(row).some((value) => String(value).toLowerCase().includes(query)))
    .map((row) => ({
      ...row,
      ReviewRequired: renderFlag(Boolean(row.ReviewRequired), "Review"),
      OutlierDetected: renderFlag(Boolean(row.OutlierDetected), "Outlier"),
      PassesCVThresholdAfterCleaning: renderFlag(Boolean(row.PassesCVThresholdAfterCleaning), "Pass"),
    }));
  renderTable(dom.summaryTable, rows, { rawHtml: true, limit: 250 });
}

function formatMeasurementRow(row) {
  return {
    PlateSequenceName: row.PlateSequenceName,
    BatchName: row.BatchName,
    WellId: row.WellId,
    ChemistryId: row.ChemistryId,
    ReplicateIndex: row.ReplicateIndex,
    Concentration: roundOrBlank(row.Concentration, 4),
    RawMean: roundOrBlank(row.RawMean, 4),
    RawStd: roundOrBlank(row.RawStd, 4),
    RawCVPercent: roundOrBlank(row.RawCVPercent, 2),
    CleanMean: roundOrBlank(row.CleanMean, 4),
    CleanStd: roundOrBlank(row.CleanStd, 4),
    CleanCVPercent: roundOrBlank(row.CleanCVPercent, 2),
    ModifiedZScore: roundOrBlank(row.ModifiedZScore, 3),
    IsOutlierModifiedZ: row.IsOutlierModifiedZ,
    IsOutlierIQR: row.IsOutlierIQR,
    IsLeaveOneOutCandidate: row.IsLeaveOneOutCandidate,
    RecommendedDiscard: row.RecommendedDiscard,
    ReviewRequired: row.ReviewRequired,
    SourceFile: row.SourceFile,
  };
}

function renderTable(table, rows, options = {}) {
  const { rawHtml = false, limit = 200 } = options;
  if (!rows.length) {
    table.innerHTML = "<thead><tr><th>No rows</th></tr></thead><tbody><tr><td>No data available.</td></tr></tbody>";
    return;
  }
  const truncated = rows.length > limit;
  const visibleRows = rows.slice(0, limit);
  const columns = Object.keys(visibleRows[0]);
  const thead = `<thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>`;
  const tbodyRows = visibleRows.map((row) => {
    const cells = columns.map((column) => {
      const value = row[column];
      if (rawHtml) {
        return `<td>${value === undefined || value === null || value === "" ? "" : value}</td>`;
      }
      return `<td>${escapeHtml(formatCell(value))}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
  const truncationNote = truncated
    ? `<tfoot><tr><td colspan="${columns.length}" style="text-align:center;font-style:italic;color:#888;">Showing ${limit} of ${rows.length} rows. Download the CSV for the full dataset.</td></tr></tfoot>`
    : "";
  table.innerHTML = `${thead}<tbody>${tbodyRows}</tbody>${truncationNote}`;
}

function renderFlag(condition, label) {
  const className = condition ? "flag-chip flag-review" : "flag-chip flag-ok";
  const text = condition ? label : "OK";
  return `<span class="${className}">${escapeHtml(text)}</span>`;
}

function downloadOutput(kind, fileName) {
  if (!state.outputs) {
    return;
  }
  const rows = state.outputs[kind];
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows) {
  if (!rows.length) {
    return "";
  }
  const columns = Object.keys(rows[0]);
  const header = columns.join(",");
  const body = rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(",")).join("\n");
  return `${header}\n${body}`;
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const nextCharacter = normalized[index + 1];
    if (character === "\"") {
      if (inQuotes && nextCharacter === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if (character === "\n" && !inQuotes) {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += character;
    }
  }

  if (current.length || row.length) {
    row.push(current);
    rows.push(row);
  }

  const [header, ...dataRows] = rows.filter((entry) => entry.some((cell) => String(cell).trim() !== ""));
  if (!header) {
    return [];
  }

  const cleanHeader = header.map((column, index) => index === 0 ? String(column || "").replace(/^\uFEFF/, "") : column);

  return dataRows.map((cells) => {
    const item = {};
    cleanHeader.forEach((column, index) => {
      item[column] = cells[index] ?? "";
    });
    return item;
  });
}

function groupBy(items, keyFn) {
  const groups = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  });
  return groups;
}

function groupKey(row) {
  return [row.PlateSequenceName, row.BatchName, row.WellId, row.ChemistryId].join("||");
}

function sortGroups(left, right) {
  const a = left[0];
  const b = right[0];
  return (
    a.PlateSequenceName.localeCompare(b.PlateSequenceName)
    || a.BatchName.localeCompare(b.BatchName)
    || a.WellId.localeCompare(b.WellId)
    || a.ChemistryId.localeCompare(b.ChemistryId)
  );
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function sampleStd(values) {
  if (values.length <= 1) {
    return Number.NaN;
  }
  const avg = mean(values);
  const variance = values.reduce((total, value) => total + ((value - avg) ** 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function median(values) {
  if (!values.length) {
    return Number.NaN;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function quantile(values, q) {
  if (!values.length) {
    return Number.NaN;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function safeCv(avg, std) {
  if (!Number.isFinite(avg) || !Number.isFinite(std) || Math.abs(avg) < 1e-12) {
    return Number.NaN;
  }
  return Math.abs(std / avg) * 100;
}

function roundOrBlank(value, digits) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : "";
}

function joinUnique(values) {
  return [...new Set(values.filter((value) => String(value).trim() !== ""))].join(" | ");
}

function escapeCsv(value) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
}

function formatCell(value) {
  return value === undefined || value === null ? "" : String(value);
}

function formatNumber(value, digits = 2) {
  return Number(value).toFixed(digits);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function numberOrNegInf(value) {
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

// ─── Quick Results table ─────────────────────────────────────────────────────

function statusOrder(row) {
  if (!row.ReviewRequired) return 3;
  if (!row.PassesCVThresholdAfterCleaning) return 0;
  if (row.OutlierDetected) return 1;
  return 2;
}

function statusLabel(row) {
  if (!row.ReviewRequired) return "PASS";
  if (!row.PassesCVThresholdAfterCleaning) return "FAIL";
  if (row.OutlierDetected) return "CLEANED";
  return "REVIEW";
}

function statusBadgeHtml(row) {
  const label = statusLabel(row);
  const cls = { PASS: "status-pass", FAIL: "status-fail", CLEANED: "status-cleaned", REVIEW: "status-review" }[label];
  return `<span class="status-badge ${cls}">${label}</span>`;
}

function rowStatusClass(row) {
  return { PASS: "row-pass", FAIL: "row-fail", CLEANED: "row-cleaned", REVIEW: "row-review" }[statusLabel(row)];
}

function formatReason(row) {
  const flags = [];
  if (row.IsOutlierModifiedZ) flags.push("ModZ");
  if (row.IsOutlierIQR) flags.push("IQR");
  if (row.IsLeaveOneOutCandidate) flags.push("LOO");
  const base = flags.length ? flags.join(" + ") : "High CV";
  return row.RecommendedDiscard ? `${base} → Discard` : base;
}

function renderQuickResults(summary, config) {
  const threshold = config?.cvThreshold ?? 5;
  const sorted = [...summary].sort((a, b) => (
    statusOrder(a) - statusOrder(b)
    || String(a.WellId).localeCompare(String(b.WellId))
    || String(a.ChemistryId).localeCompare(String(b.ChemistryId))
  ));

  if (!sorted.length) {
    dom.quickResultsTable.innerHTML = "<thead><tr><th>No data</th></tr></thead><tbody><tr><td>No results available.</td></tr></tbody>";
    return;
  }

  const columns = ["Status", "Well", "Chemistry", "Plate", "Batch", "n", "Mean \u00b1 SD", "CV %"];
  const thead = `<thead><tr>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>`;

  const tbodyRows = sorted.map((row) => {
    const kept = row.ReplicateCount - (row.DiscardedReplicateCount || 0);
    const total = row.ReplicateCount;
    const cleanMean = Number(row.CleanMean);
    const cleanStd = Number(row.CleanStd);
    const cleanCV = Number(row.CleanCVPercent);

    const nCell = kept < total ? `${kept}/<span style="opacity:.6">${total}</span>` : String(total);
    const meanSd = Number.isFinite(cleanMean)
      ? `${cleanMean.toFixed(4)}<span class="sd-sep">\u00b1</span>${Number.isFinite(cleanStd) ? cleanStd.toFixed(4) : "\u2014"}`
      : "\u2014";
    const cvCell = Number.isFinite(cleanCV)
      ? `<span class="${cleanCV > threshold ? "cv-high" : "cv-ok"}">${cleanCV.toFixed(2)}</span>`
      : "\u2014";

    const cls = rowStatusClass(row);
    const cells = [
      statusBadgeHtml(row),
      escapeHtml(String(row.WellId)),
      escapeHtml(String(row.ChemistryId)),
      escapeHtml(String(row.PlateSequenceName)),
      escapeHtml(String(row.BatchName)),
      nCell,
      meanSd,
      cvCell,
    ].map((v) => `<td>${v}</td>`).join("");

    return `<tr class="${cls}">${cells}</tr>`;
  }).join("");

  dom.quickResultsTable.innerHTML = `${thead}<tbody>${tbodyRows}</tbody>`;
}

function copyResultsTable() {
  if (!state.outputs) return;
  const { summary, config } = state.outputs;
  const threshold = config?.cvThreshold ?? 5;
  const header = ["Well", "Chemistry", "Plate", "Batch", "n", "Mean", "\u00b1SD", "CV%", "Status"].join("\t");
  const rows = [...summary]
    .sort((a, b) => statusOrder(a) - statusOrder(b) || String(a.WellId).localeCompare(String(b.WellId)))
    .map((row) => {
      const kept = row.ReplicateCount - (row.DiscardedReplicateCount || 0);
      const total = row.ReplicateCount;
      return [
        row.WellId,
        row.ChemistryId,
        row.PlateSequenceName,
        row.BatchName,
        kept < total ? `${kept}/${total}` : String(total),
        Number.isFinite(Number(row.CleanMean)) ? Number(row.CleanMean).toFixed(4) : "",
        Number.isFinite(Number(row.CleanStd)) ? Number(row.CleanStd).toFixed(4) : "",
        Number.isFinite(Number(row.CleanCVPercent)) ? Number(row.CleanCVPercent).toFixed(2) : "",
        statusLabel(row),
      ].join("\t");
    });

  const text = [header, ...rows].join("\n");
  const btn = dom.copyResultsBtn;
  const orig = btn.textContent;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = orig; }, 2000);
  }).catch(() => {
    btn.textContent = "Copy failed";
    setTimeout(() => { btn.textContent = orig; }, 2000);
  });
}

initializeApp();
