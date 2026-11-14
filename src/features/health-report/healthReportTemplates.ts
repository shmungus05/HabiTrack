/**
 * Portable health report formatter.
 *
 * Emits semantic, normal-flow HTML for on-screen preview and the browser's
 * native print-to-PDF pipeline. Styles are inline so the printed artifact does
 * not depend on the app's Tailwind build.
 */

import type { HealthReport } from "./types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function generateHealthReportHtml(report: HealthReport): string {
  const { metadata } = report;

  const vitalsRows = report.vitalsSummary
    .map((row) => {
      const anomalous = row.status === "ANOMALOUS";
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${escapeHtml(row.parameter)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right;font-variant-numeric:tabular-nums;"><strong>${escapeHtml(row.value)}</strong> ${escapeHtml(row.unit)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${escapeHtml(row.baselineRange)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right;font-variant-numeric:tabular-nums;">${row.deviationSigma.toFixed(2)}σ</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;${anomalous ? "color:#b91c1c;font-weight:700;" : ""}">${escapeHtml(statusLabel(row.status))}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${escapeHtml(row.qualityStatus)}</td>
      </tr>`;
    })
    .join("");

  const environmentRows = report.environmentalSnapshot
    .map(
      (row) => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${escapeHtml(row.parameter)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right;font-variant-numeric:tabular-nums;"><strong>${escapeHtml(row.value)}</strong> ${escapeHtml(row.unit)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;${row.status === "ALERT" ? "color:#b91c1c;font-weight:700;" : ""}">${escapeHtml(statusLabel(row.status))}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${escapeHtml(row.qualityStatus)}</td>
      </tr>`,
    )
    .join("");

  const symptomRows =
    report.symptomHistory.length === 0
      ? `<tr><td colspan="5" style="padding:8px;color:#666;">No crew symptom reports were logged in this window.</td></tr>`
      : report.symptomHistory
          .map(
            (row) => `<tr>
              <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;">${escapeHtml(row.occurredAt)}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${escapeHtml(row.symptom)}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:center;">${row.severity}/5</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${escapeHtml(row.module)}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${escapeHtml(row.notes ?? "—")}${row.nonCausalFlag ? ' <em style="color:#92400e;">(non-causal guardrail applied)</em>' : ""}</td>
            </tr>`,
          )
          .join("");

  const eventBlocks =
    report.concordanceEvents.length === 0
      ? `<p style="color:#666;">No concordance events were evaluated for this window.</p>`
      : report.concordanceEvents
          .map(
            (event) => `<div class="health-report-card" style="border:1px solid #e5e5e5;border-left:3px solid #111;padding:10px 12px;margin:10px 0;break-inside:avoid;">
              <p style="margin:0;font-weight:700;">${escapeHtml(event.title)} · ${escapeHtml(event.severity)}</p>
              <p style="margin:4px 0 0;font-size:10pt;color:#444;">${escapeHtml(event.timeWindow)} · ${escapeHtml(event.eventId)}</p>
              <p style="margin:6px 0 0;font-size:10pt;">${escapeHtml(event.rationale)}</p>
            </div>`,
          )
          .join("");

  const flightRuleBlocks =
    report.verifiedFlightRules.length === 0
      ? `<p style="color:#666;">No flight rules were attached to this investigation.</p>`
      : report.verifiedFlightRules
          .map(
            (rule) => `<div class="health-report-card" style="border:1px solid #e5e5e5;padding:10px 12px;margin:10px 0;break-inside:avoid;">
              <p style="margin:0;font-weight:700;">${escapeHtml(rule.ruleId)} · ${escapeHtml(rule.title)}</p>
              <p style="margin:2px 0 6px;font-size:9pt;color:#555;word-break:break-all;">SHA-256: ${escapeHtml(rule.sha256Hash)}</p>
              <ul style="margin:0;padding-left:18px;font-size:10pt;">
                ${rule.checklistSteps
                  .map(
                    (step) =>
                      `<li style="margin:2px 0;">${step.verified ? "☑" : "☐"} ${step.stepNumber}. ${escapeHtml(step.instruction)}</li>`,
                  )
                  .join("")}
              </ul>
            </div>`,
          )
          .join("");

  const sourceRows = report.sourceReferences
    .map(
      (source) => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${escapeHtml(source.sourceName)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${escapeHtml(source.datasetIdentifier)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${escapeHtml(source.provenance)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${escapeHtml(source.doi ?? "—")}</td>
      </tr>`,
    )
    .join("");

  return `<article id="health-report-document" style="font-family:'JetBrains Mono',Consolas,monospace;color:#111;background:#fff;padding:4px;">
  <header style="border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px;">
    <p style="margin:0;font-size:9pt;letter-spacing:0.14em;text-transform:uppercase;color:#555;">HABITAT TRACE · Offline Clinical Decision Support</p>
    <h1 style="margin:4px 0 2px;font-size:18pt;line-height:1.2;">Clinical Health Report</h1>
    <p style="margin:0;font-size:9.5pt;color:#444;">${escapeHtml(metadata.reportId)} · generated ${escapeHtml(metadata.generatedAt)}</p>
  </header>

  <section class="health-report-card" style="border:1px solid #e5e5e5;padding:10px 12px;margin-bottom:14px;break-inside:avoid;">
    <h2 style="margin:0 0 6px;font-size:12pt;">1. Mission &amp; Crew</h2>
    <table style="width:100%;border-collapse:collapse;font-size:10pt;">
      <tbody>
        <tr><td style="padding:4px 0;color:#555;width:32%;">Mission</td><td style="padding:4px 0;">${escapeHtml(metadata.missionId)}</td></tr>
        <tr><td style="padding:4px 0;color:#555;">Astronaut</td><td style="padding:4px 0;">${escapeHtml(metadata.astronautId)} · ${escapeHtml(metadata.callsign)}</td></tr>
        <tr><td style="padding:4px 0;color:#555;">Crew role</td><td style="padding:4px 0;">${escapeHtml(metadata.crewRole)}</td></tr>
        <tr><td style="padding:4px 0;color:#555;">Window</td><td style="padding:4px 0;">${escapeHtml(metadata.timeWindow.start)} → ${escapeHtml(metadata.timeWindow.end)}</td></tr>
        <tr><td style="padding:4px 0;color:#555;">Mission days</td><td style="padding:4px 0;">${escapeHtml(metadata.timeWindow.missionDayRange)}</td></tr>
      </tbody>
    </table>
  </section>

  <section style="margin-bottom:14px;">
    <h2 style="margin:0 0 6px;font-size:12pt;">2. Vitals Summary</h2>
    <table style="width:100%;border-collapse:collapse;font-size:9.5pt;">
      <thead><tr style="background:#f5f5f5;">
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc;">Parameter</th>
        <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #ccc;">Value</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc;">Baseline (μ ± 2σ)</th>
        <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #ccc;">Δ</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc;">Status</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc;">Quality</th>
      </tr></thead>
      <tbody>${vitalsRows}</tbody>
    </table>
  </section>

  <section style="margin-bottom:14px;">
    <h2 style="margin:0 0 6px;font-size:12pt;">3. Environmental Snapshot</h2>
    <table style="width:100%;border-collapse:collapse;font-size:9.5pt;">
      <thead><tr style="background:#f5f5f5;">
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc;">Parameter</th>
        <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #ccc;">Value</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc;">Status</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc;">Quality</th>
      </tr></thead>
      <tbody>${environmentRows}</tbody>
    </table>
  </section>

  <section style="margin-bottom:14px;">
    <h2 style="margin:0 0 6px;font-size:12pt;">4. Symptom History</h2>
    <table style="width:100%;border-collapse:collapse;font-size:9.5pt;">
      <thead><tr style="background:#f5f5f5;">
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc;">Occurred (UTC)</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc;">Symptom</th>
        <th style="text-align:center;padding:6px 8px;border-bottom:1px solid #ccc;">Severity</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc;">Module</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc;">Notes</th>
      </tr></thead>
      <tbody>${symptomRows}</tbody>
    </table>
  </section>

  <section style="margin-bottom:14px;">
    <h2 style="margin:0 0 6px;font-size:12pt;">5. Concordance Events</h2>
    ${eventBlocks}
  </section>

  <section style="margin-bottom:14px;">
    <h2 style="margin:0 0 6px;font-size:12pt;">6. Verified Flight Rules</h2>
    ${flightRuleBlocks}
  </section>

  <section class="health-report-card" style="margin-bottom:14px;break-inside:avoid;">
    <h2 style="margin:0 0 6px;font-size:12pt;">7. Source References</h2>
    <table style="width:100%;border-collapse:collapse;font-size:9.5pt;">
      <thead><tr style="background:#f5f5f5;">
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc;">Source</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc;">Identifier</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc;">Provenance</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc;">DOI</th>
      </tr></thead>
      <tbody>${sourceRows}</tbody>
    </table>
  </section>

  <footer style="border-top:2px solid #111;padding-top:8px;">
    <p style="margin:0;font-size:9pt;line-height:1.5;"><strong>Epistemic disclaimer.</strong> ${escapeHtml(report.epistemicDisclaimer)}</p>
  </footer>
</article>`;
}