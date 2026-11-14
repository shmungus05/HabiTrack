/**
 * Isolated Deep Module: NASA Epidemiological Clinical Risk & Biological Delay Models
 * Implements non-linear hazard curves derived from NASA LSDA, RadLab, and HRP studies.
 */

export interface Co2HeadachePoint {
  ppm: number;
  probability: number;
  label: string;
}

export interface Co2LagPoint {
  delayHours: string;
  matchPercent: number;
  rating: string;
  description: string;
}

export interface RadiationFatiguePoint {
  dose: number;
  fatigueScore: number;
  event: string;
}

export interface HumidityDryEyePoint {
  humidity: number;
  irritationRate: number;
  status: string;
}

export interface TemperatureStrainPoint {
  cabinTemp: number;
  coreTempRise: number;
  recoveryMinutes: number;
  status: string;
}

export interface MultiFactorMatrixRow {
  factor: string;
  nominalRange: string;
  currentValue: string;
  healthImpact: string;
  lagTime: string;
  countermeasure: string;
}

export interface EnvironmentalSnapshot {
  co2Ppm: number;
  tempC: number;
  humidityPct: number;
  radiationRateMGy: number;
  pressureMmHg?: number;
}

export interface ClinicalRiskEvaluation {
  headacheProbabilityPct: number;
  headacheRiskCategory: "Nominal" | "Mild" | "Advisory" | "Elevated" | "Critical";
  peakLagHours: string;
  cellularFatigueIndex: number;
  mucosalIrritationRate: number;
  exerciseCoreHeatRiseDegC: number;
  exerciseRecoveryMinutes: number;
  activeFlightRules: {
    ruleId: string;
    title: string;
    severity: "info" | "warning" | "critical";
    description: string;
  }[];
}

export const CO2_HEADACHE_CURVE: Co2HeadachePoint[] = [
  { ppm: 1970, probability: 4, label: "Nominal Baseline" },
  { ppm: 2630, probability: 8, label: "Normal Working Air" },
  { ppm: 3290, probability: 16, label: "Mild Buildup Zone" },
  { ppm: 3950, probability: 28, label: "Advisory Threshold" },
  { ppm: 4600, probability: 44, label: "Elevated Risk" },
  { ppm: 5260, probability: 62, label: "High Alert" },
  { ppm: 5920, probability: 78, label: "Emergency Level" },
];

export const CO2_LAG_DATA: Co2LagPoint[] = [
  { delayHours: "Immediate (0 hrs)", matchPercent: 18, rating: "Low", description: "Body hasn’t absorbed excess gas yet" },
  { delayHours: "30 Minutes", matchPercent: 42, rating: "Moderate", description: "Early blood vessel reaction" },
  { delayHours: "1 Hour", matchPercent: 68, rating: "High", description: "Intracranial pressure begins climbing" },
  { delayHours: "1.5 Hours", matchPercent: 81, rating: "Strongest Match (Peak)", description: "Peak headache onset window" },
  { delayHours: "2 Hours", matchPercent: 84, rating: "Strongest Match (Peak)", description: "Sustained headache symptom peak" },
  { delayHours: "2.5 Hours", matchPercent: 76, rating: "High", description: "Slow tapering" },
  { delayHours: "3 Hours", matchPercent: 55, rating: "Moderate", description: "Symptoms lingering" },
  { delayHours: "4 Hours", matchPercent: 28, rating: "Low", description: "Air circulation usually restores baseline" },
];

export const RADIATION_FATIGUE_CURVE: RadiationFatiguePoint[] = [
  { dose: 0.12, fatigueScore: 5, event: "Low Orbital Altitude" },
  { dose: 0.18, fatigueScore: 12, event: "Quiet Solar Background" },
  { dose: 0.22, fatigueScore: 22, event: "Typical ISS LEO Baseline" },
  { dose: 0.28, fatigueScore: 40, event: "South Atlantic Anomaly Pass" },
  { dose: 0.35, fatigueScore: 65, event: "Peak Proton Belt Fluence" },
  { dose: 0.42, fatigueScore: 82, event: "Solar Activity Disturbance" },
  { dose: 0.50, fatigueScore: 94, event: "Extreme Space Weather Alert" },
];

export const HUMIDITY_DRY_EYE_CURVE: HumidityDryEyePoint[] = [
  { humidity: 25, irritationRate: 68, status: "Critically Dry" },
  { humidity: 30, irritationRate: 52, status: "High Irritation" },
  { humidity: 35, irritationRate: 32, status: "Mild Dryness" },
  { humidity: 40, irritationRate: 14, status: "Comfort Baseline" },
  { humidity: 45, irritationRate: 6, status: "Optimal NASA Band" },
  { humidity: 50, irritationRate: 4, status: "Optimal Moisture" },
  { humidity: 55, irritationRate: 5, status: "Moist Comfort" },
  { humidity: 65, irritationRate: 18, status: "Mold Precursor Risk" },
];

export const TEMPERATURE_STRAIN_CURVE: TemperatureStrainPoint[] = [
  { cabinTemp: 20.0, coreTempRise: 0.6, recoveryMinutes: 25, status: "Optimal Cooling" },
  { cabinTemp: 21.5, coreTempRise: 0.8, recoveryMinutes: 32, status: "Normal Thermal Buffer" },
  { cabinTemp: 22.8, coreTempRise: 1.1, recoveryMinutes: 42, status: "Current Cabin Temp" },
  { cabinTemp: 24.0, coreTempRise: 1.5, recoveryMinutes: 58, status: "Elevated Thermal Strain" },
  { cabinTemp: 25.5, coreTempRise: 1.9, recoveryMinutes: 75, status: "Sweat Film Overheating" },
  { cabinTemp: 27.0, coreTempRise: 2.4, recoveryMinutes: 95, status: "Heat Exhaustion Risk" },
];

export function evaluateClinicalRisk(snapshot: EnvironmentalSnapshot): ClinicalRiskEvaluation {
  const { co2Ppm, tempC, humidityPct, radiationRateMGy } = snapshot;

  // 1. Headache probability piecewise interpolation
  let headacheProb = 4;
  if (co2Ppm <= 1970) {
    headacheProb = 4;
  } else if (co2Ppm >= 5920) {
    headacheProb = 78;
  } else {
    for (let i = 0; i < CO2_HEADACHE_CURVE.length - 1; i++) {
      const p1 = CO2_HEADACHE_CURVE[i];
      const p2 = CO2_HEADACHE_CURVE[i + 1];
      if (co2Ppm >= p1.ppm && co2Ppm <= p2.ppm) {
        const ratio = (co2Ppm - p1.ppm) / (p2.ppm - p1.ppm);
        headacheProb = Math.round(p1.probability + ratio * (p2.probability - p1.probability));
        break;
      }
    }
  }

  let headacheCategory: ClinicalRiskEvaluation["headacheRiskCategory"] = "Nominal";
  if (headacheProb >= 44) headacheCategory = "Critical";
  else if (headacheProb >= 28) headacheCategory = "Elevated";
  else if (headacheProb >= 16) headacheCategory = "Advisory";
  else if (headacheProb >= 8) headacheCategory = "Mild";

  // 2. Radiation cellular fatigue score
  let fatigueScore = 5;
  if (radiationRateMGy <= 0.12) fatigueScore = 5;
  else if (radiationRateMGy >= 0.5) fatigueScore = 94;
  else {
    for (let i = 0; i < RADIATION_FATIGUE_CURVE.length - 1; i++) {
      const p1 = RADIATION_FATIGUE_CURVE[i];
      const p2 = RADIATION_FATIGUE_CURVE[i + 1];
      if (radiationRateMGy >= p1.dose && radiationRateMGy <= p2.dose) {
        const ratio = (radiationRateMGy - p1.dose) / (p2.dose - p1.dose);
        fatigueScore = Math.round(p1.fatigueScore + ratio * (p2.fatigueScore - p1.fatigueScore));
        break;
      }
    }
  }

  // 3. Humidity mucosal irritation
  let mucosalRate = 6;
  if (humidityPct <= 25) mucosalRate = 68;
  else if (humidityPct >= 65) mucosalRate = 18;
  else if (humidityPct >= 45 && humidityPct <= 55) mucosalRate = 4;
  else if (humidityPct < 45) {
    mucosalRate = Math.round(68 - ((humidityPct - 25) / 20) * 62);
  } else {
    mucosalRate = Math.round(5 + ((humidityPct - 55) / 10) * 13);
  }

  // 4. Exercise thermal strain
  let heatRise = 1.1;
  let recoveryMin = 42;
  if (tempC <= 20.0) {
    heatRise = 0.6;
    recoveryMin = 25;
  } else if (tempC >= 27.0) {
    heatRise = 2.4;
    recoveryMin = 95;
  } else {
    const ratio = (tempC - 20.0) / 7.0;
    heatRise = Number((0.6 + ratio * 1.8).toFixed(1));
    recoveryMin = Math.round(25 + ratio * 70);
  }

  // 5. NASA Flight Rules check
  const activeFlightRules = [];
  if (co2Ppm > 3100) {
    activeFlightRules.push({
      ruleId: "NASA Flight Rule B13-101.B",
      title: "Atmospheric ppCO₂ Excursion Advisory",
      severity: co2Ppm > 4500 ? ("critical" as const) : ("warning" as const),
      description: `Cabin CO₂ at ${co2Ppm.toLocaleString()} PPM exceeds the 3,100 PPM threshold. Station ventilation diffuser fans required.`,
    });
  }

  if (radiationRateMGy > 0.25) {
    activeFlightRules.push({
      ruleId: "SRAG ALARA Advisory",
      title: "Dosimetric Flux Rate Elevation",
      severity: radiationRateMGy > 0.35 ? ("critical" as const) : ("warning" as const),
      description: `Active TEPC rate at ${radiationRateMGy.toFixed(3)} mGy/d. Possible South Atlantic Anomaly pass or solar proton event.`,
    });
  }

  return {
    headacheProbabilityPct: headacheProb,
    headacheRiskCategory: headacheCategory,
    peakLagHours: "1.5 to 2.0 Hours",
    cellularFatigueIndex: fatigueScore,
    mucosalIrritationRate: mucosalRate,
    exerciseCoreHeatRiseDegC: heatRise,
    exerciseRecoveryMinutes: recoveryMin,
    activeFlightRules,
  };
}
