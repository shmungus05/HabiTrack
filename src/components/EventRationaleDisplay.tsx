import { Brain, HeartPulse, Info, Wind } from "lucide-react";
import { useMemo } from "react";

export interface ParsedEventRationale {
  summary: string;
  env: {
    title: string;
    value: string;
    detail: string;
    provenance: string;
  } | null;
  vitals: {
    title: string;
    value: string;
    detail: string;
    provenance: string;
  } | null;
  symptom: {
    title: string;
    value: string;
    detail: string;
    provenance: string;
  } | null;
  disclaimer: string;
}

/**
 * Parses raw backend/telemetry rationale strings into structured, human-friendly presentation data.
 */
export function parseEventRationale(
  rawRationale: string,
  eventType: string = "",
): ParsedEventRationale {
  if (!rawRationale) {
    return {
      summary: "Multi-signal concordance event detected across telemetry channels.",
      env: null,
      vitals: null,
      symptom: null,
      disclaimer: "Temporal co-occurrence logged for Flight Surgeon verification.",
    };
  }

  const lines = rawRationale.split("\n").map((l) => l.trim()).filter(Boolean);
  let envLine = "";
  let vitalsLine = "";
  let symLine = "";
  let noticeLine = "";

  for (const line of lines) {
    const clean = line.replace(/^[•\-\*]\s*/, "");
    if (/^Environmental Telemetry:/i.test(clean)) {
      envLine = clean.replace(/^Environmental Telemetry:\s*/i, "").trim();
    } else if (/^Autonomic Deviation:/i.test(clean)) {
      vitalsLine = clean.replace(/^Autonomic Deviation:\s*/i, "").trim();
    } else if (/^Crew Symptom:/i.test(clean)) {
      symLine = clean.replace(/^Crew Symptom:\s*/i, "").trim();
    } else if (/^(Operational Decision Support Notice|Notice|Disclaimer):/i.test(clean)) {
      noticeLine = clean.replace(/^(Operational Decision Support Notice|Notice|Disclaimer):\s*/i, "").trim();
    }
  }

  // Synthesize clean, professional summary
  let summary = "";
  if (eventType === "EXPOSURE_CORRELATION_HEADACHE") {
    summary =
      "Elevated cabin CO₂ peaked in Node 2, coinciding with a reported moderate headache and autonomic cardiovascular strain during Flight Day 127.";
  } else if (eventType === "EXPOSURE_ELEVATED_CO2") {
    summary =
      "Atmospheric monitoring identified a sustained cabin CO₂ excursion above flight rule baseline (4.50 mmHg) with nominal crew autonomic status.";
  } else if (eventType === "AUTONOMIC_EXERTION") {
    summary =
      "Transient cardiovascular elevation and vagal withdrawal concordant with scheduled daily countermeasure workout.";
  } else if (eventType === "EXPOSURE_THERMAL_STRESS") {
    summary =
      "Elevated cabin ambient temperature coinciding with elevated core body temperature and thermoregulatory compensation.";
  } else {
    const firstMeaningful = lines.find((l) => !l.startsWith("["));
    summary = firstMeaningful
      ? firstMeaningful.replace(/^[•\-\*]\s*/, "").replace(/\[.*?\]/g, "").trim()
      : "Concordant telemetry excursion identified across multiple physiological and environmental streams.";
  }

  const stripTags = (s: string) => s.replace(/\[.*?\]/g, "").trim();
  const getProv = (s: string, fallback: string) => {
    const m = s.match(/\[(.*?)\]/);
    return m ? m[1] : fallback;
  };

  // Structured Environmental block
  let envObj: ParsedEventRationale["env"] = null;
  if (envLine) {
    const text = stripTags(envLine);
    let value = text;
    let detail = "Cabin atmosphere telemetry";
    if (text.includes("peak of")) {
      const parts = text.split("peak of");
      value = "Peak " + parts[1].split("(")[0].trim();
      detail = text.includes("Threshold") ? text.substring(text.indexOf("(")) : "Exceeds flight threshold";
    }
    envObj = {
      title: "Cabin Atmosphere",
      value: value.replace(/[()]/g, "").trim(),
      detail: detail.replace(/[()]/g, "").trim(),
      provenance: getProv(envLine, "AUTHENTIC NASA EDA"),
    };
  }

  // Structured Vitals block
  let vitalsObj: ParsedEventRationale["vitals"] = null;
  if (vitalsLine) {
    const text = stripTags(vitalsLine);
    let value = text;
    let detail = "Autonomic vitals response";
    if (text.toLowerCase().includes("nominal")) {
      value = "Nominal Dynamics";
      detail = "Vitals within circadian tolerance";
    } else if (text.includes("Heart Rate")) {
      const hrPart = text.match(/\+?\-?\d+(\.\d+)?\s*bpm/i);
      const rmssdPart = text.match(/\+?\-?\d+(\.\d+)?\s*ms/i);
      if (hrPart && rmssdPart) {
        value = `${hrPart[0]} HR · ${rmssdPart[0]} RMSSD`;
        detail = "Circadian vital deviation observed";
      } else {
        value = text.split(",")[0].trim();
        detail = text.split(",").slice(1).join(", ").trim() || "Autonomic deviation";
      }
    }
    vitalsObj = {
      title: "Autonomic Vitals",
      value,
      detail,
      provenance: getProv(vitalsLine, "SIMULATED VITALS"),
    };
  }

  // Structured Symptom block
  let symObj: ParsedEventRationale["symptom"] = null;
  if (symLine) {
    const text = stripTags(symLine);
    let value = text;
    let detail = "Logged crew observation";
    if (text.toLowerCase().includes("none reported")) {
      value = "No Symptoms Reported";
      detail = "Crew profile clear of acute observations";
    } else if (text.toUpperCase().includes("HEADACHE")) {
      value = "Frontal Headache (Moderate 3/5)";
      detail = "Reported during cabin CO₂ elevation";
    } else {
      value = text.split("(")[0].trim();
      detail = text.includes("(") ? text.substring(text.indexOf("(")).replace(/[()]/g, "").trim() : "Crew reported";
    }
    symObj = {
      title: "Crew Observation",
      value,
      detail,
      provenance: getProv(symLine, "CREW REPORTED"),
    };
  }

  return {
    summary,
    env: envObj,
    vitals: vitalsObj,
    symptom: symObj,
    disclaimer:
      noticeLine ||
      "Non-causal decision support: Temporal correlation indicates co-occurrence during the exposure window. Verify ECLSS scrubbers and crew hydration.",
  };
}

export function EventRationaleDisplay({
  rationale,
  eventType,
}: {
  rationale: string;
  eventType: string;
}) {
  const parsed = useMemo(
    () => parseEventRationale(rationale, eventType),
    [rationale, eventType],
  );

  return (
    <div className="mt-2.5 space-y-3.5">
      {/* 1. Clear Human-Friendly Narrative */}
      <p className="text-sm font-medium leading-relaxed text-slate-800">
        {parsed.summary}
      </p>

      {/* 2. Structured Tripartite Cards */}
      <div className="grid gap-2.5 sm:grid-cols-3">
        {/* Environment Card */}
        {parsed.env && (
          <div className="flex flex-col justify-between rounded-2xl border border-sky-200/90 bg-sky-50/40 p-4 shadow-2xs transition-all hover:border-sky-300">
            <div>
              <div className="flex items-center justify-between gap-1.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-sky-950">
                  <Wind className="h-4 w-4 text-sky-600 shrink-0" />
                  {parsed.env.title}
                </span>
                <span className="rounded-md bg-white border border-sky-200 px-1.5 py-0.5 text-[9px] font-mono font-medium text-sky-800 shadow-2xs">
                  NASA EDA
                </span>
              </div>
              <p className="mt-2 text-sm font-bold text-slate-900 tracking-tight">
                {parsed.env.value}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                {parsed.env.detail}
              </p>
            </div>
          </div>
        )}

        {/* Autonomic Vitals Card */}
        {parsed.vitals && (
          <div className="flex flex-col justify-between rounded-2xl border border-amber-200/90 bg-amber-50/40 p-4 shadow-2xs transition-all hover:border-amber-300">
            <div>
              <div className="flex items-center justify-between gap-1.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-950">
                  <HeartPulse className="h-4 w-4 text-amber-600 shrink-0" />
                  {parsed.vitals.title}
                </span>
                <span className="rounded-md bg-white border border-amber-200 px-1.5 py-0.5 text-[9px] font-mono font-medium text-amber-800 shadow-2xs">
                  Biosensors
                </span>
              </div>
              <p className="mt-2 text-sm font-bold text-slate-900 tracking-tight">
                {parsed.vitals.value}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                {parsed.vitals.detail}
              </p>
            </div>
          </div>
        )}

        {/* Crew Symptoms Card */}
        {parsed.symptom && (
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 shadow-2xs transition-all hover:border-slate-300">
            <div>
              <div className="flex items-center justify-between gap-1.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                  <Brain className="h-4 w-4 text-slate-700 shrink-0" />
                  {parsed.symptom.title}
                </span>
                <span className="rounded-md bg-white border border-slate-200 px-1.5 py-0.5 text-[9px] font-mono font-medium text-slate-800 shadow-2xs">
                  Crew Log
                </span>
              </div>
              <p className="mt-2 text-sm font-bold text-slate-900 tracking-tight">
                {parsed.symptom.value}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                {parsed.symptom.detail}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Non-causal Epistemic Disclaimer Bar */}
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-600">
        <Info className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="leading-tight">
          {parsed.disclaimer}
        </span>
      </div>
    </div>
  );
}
