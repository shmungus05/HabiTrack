/**
 * Vector PDF export for the clinical health report.
 *
 * `buildHealthReportPdfModel` is a pure projection of the report into table
 * sections and can be unit-tested without a browser. `downloadHealthReportPdf`
 * renders that model with lazily imported jsPDF/autoTable dependencies, so the
 * PDF engine never inflates the initial application bundle.
 */

import type { jsPDF as JsPdfDocument } from "jspdf";

import type { HealthReport } from "./types";

export type PdfColor = [number, number, number];

export interface PdfCell {
  text: string;
  color?: PdfColor;
  bold?: boolean;
  align?: "left" | "center" | "right";
}

export interface PdfSection {
  heading: string;
  columns: string[];
  rows: PdfCell[][];
  /** Per-column widths in mm, indexed to `columns`. Omit to auto-size. */
  widths?: number[];
}

const STATUS_COLORS: Record<string, PdfColor> = {
  NOMINAL: [4, 120, 87],
  SUSPECT: [180, 83, 9],
  CAUTION: [180, 83, 9],
  ANOMALOUS: [185, 28, 28],
  ALERT: [185, 28, 28],
};

function statusCell(status: string): PdfCell {
  return {
    text: status.charAt(0) + status.slice(1).toLowerCase(),
    color: STATUS_COLORS[status],
    bold: status === "ANOMALOUS" || status === "ALERT",
  };
}

function emptyRow(columns: number, message: string): PdfCell[] {
  return [
    { text: message },
    ...Array.from({ length: Math.max(0, columns - 1) }, () => ({ text: "" })),
  ];
}

/** Pure, deterministic table model. No jsPDF import, no DOM. */
export function buildHealthReportPdfModel(report: HealthReport): PdfSection[] {
  const { metadata } = report;

  const mission: PdfSection = {
    heading: "1. Mission & Crew",
    columns: ["Field", "Value"],
    widths: [45, 137],
    rows: [
      ["Report ID", metadata.reportId],
      ["Generated (UTC)", metadata.generatedAt],
      ["Mission", metadata.missionId],
      ["Astronaut", `${metadata.astronautId} · ${metadata.callsign}`],
      ["Crew role", metadata.crewRole],
      ["Window start", metadata.timeWindow.start],
      ["Window end", metadata.timeWindow.end],
      ["Mission days", metadata.timeWindow.missionDayRange],
    ].map(([label, value]) => [{ text: label }, { text: value }]),
  };

  const vitals: PdfSection = {
    heading: "2. Vitals Summary",
    columns: ["Parameter", "Value", "Baseline (μ ± 2σ)", "Δσ", "Status", "Quality"],
    widths: [44, 30, 42, 16, 26, 24],
    rows:
      report.vitalsSummary.length === 0
        ? [emptyRow(6, "No calibrated vital streams were available for this window.")]
        : report.vitalsSummary.map((row) => [
            { text: row.parameter },
            { text: `${row.value} ${row.unit}`.trim(), align: "right" },
            { text: row.baselineRange },
            { text: `${row.deviationSigma.toFixed(2)}σ`, align: "right" },
            statusCell(row.status),
            { text: row.qualityStatus },
          ]),
  };

  const environment: PdfSection = {
    heading: "3. Environmental Snapshot",
    columns: ["Parameter", "Value", "Status", "Quality"],
    widths: [74, 46, 32, 30],
    rows:
      report.environmentalSnapshot.length === 0
        ? [emptyRow(4, "No environmental telemetry was available for this window.")]
        : report.environmentalSnapshot.map((row) => [
            { text: row.parameter },
            { text: `${row.value} ${row.unit}`.trim(), align: "right" },
            statusCell(row.status),
            { text: row.qualityStatus },
          ]),
  };

  const symptoms: PdfSection = {
    heading: "4. Symptom History",
    columns: ["Occurred (UTC)", "Symptom", "Severity", "Module", "Notes"],
    widths: [34, 32, 18, 30, 68],
    rows:
      report.symptomHistory.length === 0
        ? [emptyRow(5, "No crew symptom reports were logged in this window.")]
        : report.symptomHistory.map((row) => [
            { text: row.occurredAt },
            { text: row.symptom },
            { text: `${row.severity}/5`, align: "center" },
            { text: row.module },
            {
              text: `${row.notes ?? "—"}${
                row.nonCausalFlag ? " (non-causal guardrail applied)" : ""
              }`,
            },
          ]),
  };

  const concordance: PdfSection = {
    heading: "5. Concordance Events",
    columns: ["Event", "Severity", "Window", "Rationale"],
    widths: [50, 24, 34, 74],
    rows:
      report.concordanceEvents.length === 0
        ? [emptyRow(4, "No concordance events were evaluated for this window.")]
        : report.concordanceEvents.map((event) => [
            { text: event.title },
            { text: event.severity },
            { text: event.timeWindow },
            { text: event.rationale },
          ]),
  };

  const flightRuleRows = report.verifiedFlightRules.flatMap((rule) =>
    (rule.checklistSteps.length > 0
      ? rule.checklistSteps
      : [
          {
            stepNumber: 0,
            instruction: "No checklist steps recorded.",
            verified: false,
          },
        ]
    ).map((step) => [
      { text: `${rule.ruleId} · ${rule.title}\nSHA-256: ${rule.sha256Hash}` },
      { text: step.stepNumber > 0 ? String(step.stepNumber) : "—", align: "center" as const },
      { text: step.instruction },
      {
        text: step.verified ? "[X]" : "[ ]",
        align: "center" as const,
        color: (step.verified ? STATUS_COLORS.NOMINAL : [100, 116, 139]) as PdfColor,
      },
    ]),
  );

  const flightRules: PdfSection = {
    heading: "6. Verified Flight Rules",
    columns: ["Rule", "Step", "Instruction", "Verified"],
    widths: [58, 12, 96, 16],
    rows:
      flightRuleRows.length === 0
        ? [emptyRow(4, "No flight rules were attached to this investigation.")]
        : flightRuleRows,
  };

  const sources: PdfSection = {
    heading: "7. Source References",
    columns: ["Source", "Identifier", "Provenance", "DOI"],
    widths: [58, 42, 42, 40],
    rows:
      report.sourceReferences.length === 0
        ? [emptyRow(4, "No source references were registered.")]
        : report.sourceReferences.map((source) => [
            { text: source.sourceName },
            { text: source.datasetIdentifier },
            { text: source.provenance },
            { text: source.doi ?? "—" },
          ]),
  };

  return [mission, vitals, environment, symptoms, concordance, flightRules, sources];
}

/** Safe, human-readable download name. */
export function healthReportPdfFilename(report: HealthReport): string {
  const safeId = report.metadata.reportId.replace(/[^a-zA-Z0-9_-]+/g, "_");
  return `HabiTrack_Health_Report_${safeId}.pdf`;
}

/** Render and download a vector PDF. Lazily loads jsPDF on first use. */
export async function downloadHealthReportPdf(report: HealthReport): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const tableMargin = { top: 20, right: margin, bottom: 24, left: margin };
  const sections = buildHealthReportPdfModel(report);

  // First-page title block
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("HABITRACK · OFFLINE CLINICAL DECISION SUPPORT", margin, 15);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text("Clinical Health Report", margin, 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(68, 68, 68);
  doc.text(
    `${report.metadata.reportId} · ${report.metadata.callsign} · ${report.metadata.missionId}`,
    margin,
    30,
  );

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generated ${report.metadata.generatedAt} · Window ${report.metadata.timeWindow.start} → ${report.metadata.timeWindow.end} · ${report.metadata.timeWindow.missionDayRange}`,
    margin,
    35,
  );

  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.5);
  doc.line(margin, 38, pageWidth - margin, 38);

  let cursorY = 44;

  for (const section of sections) {
    if (cursorY > pageHeight - 40) {
      doc.addPage();
      cursorY = tableMargin.top;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(section.heading, margin, cursorY);
    cursorY += 3;

    const columnStyles = section.widths
      ? Object.fromEntries(
          section.widths.map((width, index) => [index, { cellWidth: width }]),
        )
      : undefined;

    autoTable(doc, {
      startY: cursorY,
      head: [section.columns],
      body: section.rows.map((row) => row.map((cell) => cell.text)),
      margin: tableMargin,
      theme: "grid",
      showHead: "everyPage",
      rowPageBreak: "avoid",
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 2,
        textColor: [31, 41, 55],
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [51, 65, 85],
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles,
      didParseCell: (data: any) => {
        if (data.section !== "body") {
          return;
        }
        const cell = section.rows[data.row.index]?.[data.column.index];
        if (!cell) {
          return;
        }
        if (cell.color) {
          data.cell.styles.textColor = cell.color;
        }
        if (cell.bold) {
          data.cell.styles.fontStyle = "bold";
        }
        if (cell.align) {
          data.cell.styles.halign = cell.align;
        }
      },
    });

    const finalY = (doc as JsPdfDocument & {
      lastAutoTable?: { finalY: number };
    }).lastAutoTable?.finalY;
    cursorY = (finalY ?? cursorY) + 8;
  }

  // Footer on every page: disclaimer, page numbers, report id
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 17, pageWidth - margin, pageHeight - 17);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const disclaimer = doc.splitTextToSize(
      report.epistemicDisclaimer,
      pageWidth - margin * 2 - 34,
    ) as string[];
    doc.text(disclaimer, margin, pageHeight - 13);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 13, {
      align: "right",
    });
    doc.text(report.metadata.reportId, pageWidth - margin, pageHeight - 8, {
      align: "right",
    });
  }

  doc.save(healthReportPdfFilename(report));
}