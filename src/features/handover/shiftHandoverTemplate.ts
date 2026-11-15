/**
 * Deterministic prose template for Flight Surgeon Shift Handover Briefing.
 *
 * Guarantees that even when offline or when the LLM generates prohibited causal language,
 * the flight surgeon receives an impeccably structured, source-cited markdown report.
 */

import type { ShiftHandoverBriefing } from "./types.ts";

export function renderDeterministicBriefingProse(briefing: ShiftHandoverBriefing): string {
  const { window, crew, pendingReviews, dataQuality, evidencePointers, focusPrompts, disclaimer } = briefing;

  const lines: string[] = [];

  // Header
  lines.push(`## Flight Surgeon Shift Handover Briefing (${window.hours}-Hour Window)`);
  lines.push("");

  // 1. Window Section
  const modeLabel = window.mode === "simulation" ? "Simulation Clock (MET)" : "Live UTC Flight Clock";
  lines.push(`### 1. Shift Window & Epoch`);
  lines.push(`- **Temporal Window**: ${window.startIso.replace("T", " ").slice(0, 19)} to ${window.endIso.replace("T", " ").slice(0, 19)} ${window.timezone}`);
  lines.push(`- **Clock Mode**: ${modeLabel} (${window.hours} hours observed)`);
  if (window.isClockMismatched) {
    lines.push(`- **Notice**: Mission clock discrepancy detected. Telemetry streams are anchored to real-time epoch.`);
  }
  lines.push("");

  // 2. What Changed Section
  lines.push(`### 2. Cohort Physiological & Environmental Observations`);
  if (crew.length === 0) {
    lines.push(`*No registered crewmembers logged in active cohort.*`);
  } else {
    for (const member of crew) {
      lines.push(`#### **${member.callsign}** (${member.crewRole}) — [astro-${member.astronautId}]`);
      if (member.changes.length === 0) {
        lines.push(`- All monitored biometrics remain nominal within circadian envelope. [stream-nominal-${member.astronautId}]`);
      } else {
        for (const ch of member.changes) {
          const deltaStr = ch.baselineDelta ? ` (${ch.baselineDelta})` : "";
          lines.push(`- **${ch.label}**: ${ch.value}${deltaStr} [${ch.sourceId}]`);
        }
      }
    }
  }
  lines.push("");

  // 3. Needs Review Section
  lines.push(`### 3. Pending Clinical Signatures & Reviews`);
  if (pendingReviews.length === 0) {
    lines.push(`- Zero pending clinical events or symptom reports requiring shift review. [status-nominal]`);
  } else {
    lines.push(`*Prioritized by clinical severity, epistemic uncertainty, and pending duration:*`);
    for (let i = 0; i < pendingReviews.length; i++) {
      const item = pendingReviews[i];
      const uncStr = item.uncertainty ? ` · Uncertainty: ${item.uncertainty}` : "";
      lines.push(
        `${i + 1}. **[${item.severity}]** ${item.title} — **${item.callsign}** (Age: ${item.ageHours}h${uncStr}) [${item.sourceId}]`
      );
    }
  }
  lines.push("");

  // 4. Data Quality Section
  lines.push(`### 4. Telemetry Integrity & Provenance Audit`);
  lines.push(
    `- **Measurement Quality**: ${dataQuality.valid} VALID · ${dataQuality.suspect} SUSPECT · ${dataQuality.stale} STALE · ${dataQuality.gap} GAP · ${dataQuality.imputed} IMPUTED records evaluated.`
  );
  if (dataQuality.importedSources.length > 0) {
    lines.push(`- **External Provenance**: Active feeds from ${dataQuality.importedSources.join(", ")}.`);
  }
  if (dataQuality.missingStreams.length > 0) {
    lines.push(`- **Missing / Silent Streams**: ${dataQuality.missingStreams.join(", ")}.`);
  } else {
    lines.push(`- **Stream Completeness**: All 5 primary cabin environmental streams active and reporting.`);
  }
  if (dataQuality.clockWarning) {
    lines.push(`- **Data Epoch Caveat**: ${dataQuality.clockWarning}`);
  }
  lines.push("");

  // 5. Evidence Pointers Section
  lines.push(`### 5. Grounded Flight Rules & NASA Research Corpi`);
  if (evidencePointers.length === 0) {
    lines.push(`- No specific flight rule thresholds exceeded during this shift window.`);
  } else {
    for (const ptr of evidencePointers) {
      const typeLabel = ptr.type === "flight_rule" ? "NASA Flight Rule" : "Human Research Program";
      lines.push(`- **[${ptr.id}]** ${ptr.title} (${typeLabel})`);
    }
  }
  lines.push("");

  // 6. Suggested Focus Section
  lines.push(`### 6. Suggested Operational Focus`);
  for (const prompt of focusPrompts) {
    lines.push(`- ${prompt}`);
  }
  lines.push("");

  // 7. Disclaimer Section
  lines.push(`### 7. Decision-Support Disclaimer`);
  lines.push(`> ${disclaimer}`);

  return lines.join("\n");
}
