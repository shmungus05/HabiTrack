/**
 * Spacecraft Compartment Topology & Sensor Allocation Module
 *
 * Full 14-Module International Space Station (ISS) Architecture:
 * - ROS (Russian Orbital Segment - 6 Modules): Zvezda, Zarya, Nauka, Poisk, Rassvet, Prichal
 * - USOS (U.S. Orbital Segment - 8 Modules): Unity, Harmony, Destiny, Columbus, Kibo, Tranquility, Cupola, Quest Airlock
 *
 * Synchronized across Astronaut and Flight Surgeon perspectives with auto-detection per crew member.
 */

import { create } from "zustand";

export type OrbitalSegment = "ROS" | "USOS";

export interface SpacecraftModule {
  id: string;
  name: string;
  shortName: string;
  segment: OrbitalSegment;
  function: string;
  sensorLocations: string[];
  primarySensors?: string[];
  essentialSensorLocations?: string[];
  nominalCO2: number;
  nominalTemp: number;
  nominalPressure: number; // kPa
  nominalHumidity: number;
  nominalRad: number; // mGy/d
  locationOffsets?: Record<
    string,
    {
      co2Offset?: number;
      tempOffset?: number;
      radOffset?: number;
      pressureOffset?: number;
      humidityOffset?: number;
    }
  >;
}

export const ISS_14_MODULES: SpacecraftModule[] = [
  // =========================================================================
  // ROS – Russian Orbital Segment (6 Modules)
  // Calibrated against NASA EDA RR-1 Archival Flight Telemetry Loop Baselines
  // =========================================================================
  {
    id: "zvezda",
    name: "Zvezda Service Module",
    shortName: "Zvezda",
    segment: "ROS",
    function: "Russian Segment Life Support & Flight Control Core",
    sensorLocations: ["General cabin area", "Sleeping quarters", "Ventilation outlet"],
    nominalCO2: 2620,
    nominalTemp: 26.5,
    nominalPressure: 101.3,
    nominalHumidity: 68.0,
    nominalRad: 0.19,
    locationOffsets: {
      "General cabin area": { co2Offset: 0, tempOffset: 0, radOffset: 0 },
      "Sleeping quarters": { co2Offset: 240, tempOffset: -0.5, radOffset: -0.01, humidityOffset: 2.0 },
      "Ventilation outlet": { co2Offset: -160, tempOffset: -0.9, radOffset: 0, humidityOffset: -3.0 },
    },
  },
  {
    id: "zarya",
    name: "Zarya Functional Cargo Block (FGB)",
    shortName: "Zarya",
    segment: "ROS",
    function: "Station Power Distribution, Fuel Storage & Cargo Corridor",
    sensorLocations: ["General cabin area", "Storage area", "Ventilation outlet"],
    nominalCO2: 2540,
    nominalTemp: 25.6,
    nominalPressure: 101.3,
    nominalHumidity: 66.0,
    nominalRad: 0.19,
    locationOffsets: {
      "General cabin area": { co2Offset: 0, tempOffset: 0, radOffset: 0 },
      "Storage area": { co2Offset: -120, tempOffset: -0.8, radOffset: 0, humidityOffset: -2.5 },
      "Ventilation outlet": { co2Offset: -180, tempOffset: -0.5, radOffset: 0, humidityOffset: -3.0 },
    },
  },
  {
    id: "nauka",
    name: "Nauka Multipurpose Laboratory Module",
    shortName: "Nauka",
    segment: "ROS",
    function: "Primary Russian Scientific Research & Experiment Facilities",
    sensorLocations: ["Laboratory area", "Experiment workspace", "Ventilation outlet"],
    nominalCO2: 2510,
    nominalTemp: 25.8,
    nominalPressure: 101.3,
    nominalHumidity: 67.0,
    nominalRad: 0.19,
    locationOffsets: {
      "Laboratory area": { co2Offset: 0, tempOffset: 0, radOffset: 0 },
      "Experiment workspace": { co2Offset: 90, tempOffset: 0.3, radOffset: 0, humidityOffset: 1.0 },
      "Ventilation outlet": { co2Offset: -110, tempOffset: -0.5, radOffset: 0, humidityOffset: -2.0 },
    },
  },
  {
    id: "poisk",
    name: "Poisk Mini-Research Module 2 (MRM-2)",
    shortName: "Poisk",
    segment: "ROS",
    function: "EVA Airlock & Spacecraft Docking Compartment",
    sensorLocations: ["Main cabin area", "Airlock area", "Ventilation outlet"],
    nominalCO2: 2450,
    nominalTemp: 25.2,
    nominalPressure: 101.3,
    nominalHumidity: 64.0,
    nominalRad: 0.20,
    locationOffsets: {
      "Main cabin area": { co2Offset: 0, tempOffset: 0, radOffset: 0 },
      "Airlock area": { co2Offset: -150, tempOffset: -0.8, radOffset: 0.01, pressureOffset: -0.1 },
      "Ventilation outlet": { co2Offset: -190, tempOffset: -0.6, radOffset: 0, humidityOffset: -2.0 },
    },
  },
  {
    id: "rassvet",
    name: "Rassvet Mini-Research Module 1 (MRM-1)",
    shortName: "Rassvet",
    segment: "ROS",
    function: "Cargo Storage & Payload Science Stowage",
    sensorLocations: ["Main cabin area", "Storage area", "Ventilation outlet"],
    nominalCO2: 2440,
    nominalTemp: 25.4,
    nominalPressure: 101.3,
    nominalHumidity: 65.0,
    nominalRad: 0.19,
    locationOffsets: {
      "Main cabin area": { co2Offset: 0, tempOffset: 0, radOffset: 0 },
      "Storage area": { co2Offset: -80, tempOffset: -0.9, radOffset: 0, humidityOffset: -2.0 },
      "Ventilation outlet": { co2Offset: -150, tempOffset: -0.5, radOffset: 0, humidityOffset: -2.5 },
    },
  },
  {
    id: "prichal",
    name: "Prichal Nodal Module (UM)",
    shortName: "Prichal",
    segment: "ROS",
    function: "Multi-Port Spacecraft Docking Hub",
    sensorLocations: ["Main cabin area", "Docking interface area", "Ventilation outlet"],
    nominalCO2: 2400,
    nominalTemp: 24.8,
    nominalPressure: 101.3,
    nominalHumidity: 63.0,
    nominalRad: 0.20,
    locationOffsets: {
      "Main cabin area": { co2Offset: 0, tempOffset: 0, radOffset: 0 },
      "Docking interface area": { co2Offset: -110, tempOffset: -0.9, radOffset: 0.01, pressureOffset: -0.1 },
      "Ventilation outlet": { co2Offset: -150, tempOffset: -0.5, radOffset: 0, humidityOffset: -2.0 },
    },
  },

  // =========================================================================
  // USOS – U.S. Orbital Segment (8 Modules)
  // Grounded in authentic NASA Environmental Data Application (EDA) RR-1 Dataset
  // =========================================================================
  {
    id: "unity",
    name: "Unity (Node 1)",
    shortName: "Unity",
    segment: "USOS",
    function: "Central Connecting Node & Galley / Dining Corridor",
    sensorLocations: ["Central passage", "Connecting hatch area", "Ventilation outlet"],
    nominalCO2: 2580,
    nominalTemp: 26.4,
    nominalPressure: 101.3,
    nominalHumidity: 69.0,
    nominalRad: 0.19,
    locationOffsets: {
      "Central passage": { co2Offset: 0, tempOffset: 0, radOffset: 0 },
      "Connecting hatch area": { co2Offset: -80, tempOffset: -0.5, radOffset: 0 },
      "Ventilation outlet": { co2Offset: -160, tempOffset: -0.9, radOffset: 0, humidityOffset: -2.5 },
    },
  },
  {
    id: "harmony",
    name: "Harmony (Node 2)",
    shortName: "Harmony",
    segment: "USOS",
    function: "Forward Utility Node, Crew Quarters & Primary NASA EDA ECLSS Bay",
    sensorLocations: ["General cabin area", "Sleeping quarters", "Ventilation outlet"],
    // Exact baseline values from public/data/nasaEdaRealData.json (ISS Destiny / Harmony ECLSS Loop)
    nominalCO2: 2646,
    nominalTemp: 26.8,
    nominalPressure: 101.32,
    nominalHumidity: 70.0,
    nominalRad: 0.183,
    locationOffsets: {
      "General cabin area": { co2Offset: 0, tempOffset: 0, radOffset: 0 },
      "Sleeping quarters": { co2Offset: 260, tempOffset: -0.6, radOffset: 0, humidityOffset: 2.5 },
      "Ventilation outlet": { co2Offset: -210, tempOffset: -0.9, radOffset: 0, humidityOffset: -3.0 },
    },
  },
  {
    id: "destiny",
    name: "Destiny (US Laboratory)",
    shortName: "Destiny",
    segment: "USOS",
    function: "Primary U.S. Microgravity Research Facility & NASA EDA Core",
    sensorLocations: ["Laboratory area", "Experiment workspace", "Ventilation outlet"],
    // Exact baseline values from public/data/nasaEdaRealData.json (ISS Destiny / Harmony ECLSS Loop)
    nominalCO2: 2646,
    nominalTemp: 26.8,
    nominalPressure: 101.32,
    nominalHumidity: 70.0,
    nominalRad: 0.183,
    locationOffsets: {
      "Laboratory area": { co2Offset: 0, tempOffset: 0, radOffset: 0 },
      "Experiment workspace": { co2Offset: 90, tempOffset: 0.4, radOffset: 0 },
      "Ventilation outlet": { co2Offset: -120, tempOffset: -0.6, radOffset: 0, humidityOffset: -3.0 },
    },
  },
  {
    id: "columbus",
    name: "Columbus Orbital Facility",
    shortName: "Columbus",
    segment: "USOS",
    function: "ESA European Space Agency Science Research Module",
    sensorLocations: ["Laboratory area", "Experiment workspace", "Ventilation outlet"],
    nominalCO2: 2520,
    nominalTemp: 26.0,
    nominalPressure: 101.3,
    nominalHumidity: 67.5,
    nominalRad: 0.18,
    locationOffsets: {
      "Laboratory area": { co2Offset: 0, tempOffset: 0, radOffset: 0 },
      "Experiment workspace": { co2Offset: 70, tempOffset: 0.2, radOffset: 0 },
      "Ventilation outlet": { co2Offset: -90, tempOffset: -0.5, radOffset: 0, humidityOffset: -2.0 },
    },
  },
  {
    id: "kibo",
    name: "Kibo (Japanese Experiment Module)",
    shortName: "Kibo",
    segment: "USOS",
    function: "JAXA Japanese Space Agency Pressurized Research Laboratory",
    sensorLocations: ["Laboratory area", "Experiment workspace", "Ventilation outlet"],
    nominalCO2: 2490,
    nominalTemp: 25.8,
    nominalPressure: 101.3,
    nominalHumidity: 68.0,
    nominalRad: 0.19,
    locationOffsets: {
      "Laboratory area": { co2Offset: 0, tempOffset: 0, radOffset: 0 },
      "Experiment workspace": { co2Offset: 80, tempOffset: 0.2, radOffset: 0 },
      "Ventilation outlet": { co2Offset: -90, tempOffset: -0.5, radOffset: 0, humidityOffset: -2.5 },
    },
  },
  {
    id: "tranquility",
    name: "Tranquility (Node 3)",
    shortName: "Tranquility",
    segment: "USOS",
    function: "ECLSS Advanced Water Recovery, Waste Management & Exercise Gym",
    sensorLocations: ["General cabin area", "Exercise area", "Ventilation outlet"],
    nominalCO2: 2720,
    nominalTemp: 27.2,
    nominalPressure: 101.3,
    nominalHumidity: 68.5,
    nominalRad: 0.19,
    locationOffsets: {
      "General cabin area": { co2Offset: 0, tempOffset: 0, radOffset: 0 },
      "Exercise area": { co2Offset: 580, tempOffset: 1.2, radOffset: 0, humidityOffset: 3.5 },
      "Ventilation outlet": { co2Offset: -180, tempOffset: -1.0, radOffset: 0, humidityOffset: -2.5 },
    },
  },
  {
    id: "cupola",
    name: "Cupola Observation Module",
    shortName: "Cupola",
    segment: "USOS",
    function: "7-Window Earth Observation Dome & Canadarm2 Robotic Control",
    sensorLocations: ["Observation area", "Window area"],
    nominalCO2: 2420,
    nominalTemp: 24.6,
    nominalPressure: 101.3,
    nominalHumidity: 62.0,
    nominalRad: 0.24,
    locationOffsets: {
      "Observation area": { co2Offset: 0, tempOffset: 0, radOffset: -0.01 },
      "Window area": { co2Offset: -50, tempOffset: -0.8, radOffset: 0.03, humidityOffset: -2.0 },
    },
  },
  {
    id: "quest",
    name: "Quest Joint Airlock",
    shortName: "Quest Airlock",
    segment: "USOS",
    function: "Primary USOS Spacewalk EVA Staging & Depressurization Chamber",
    sensorLocations: ["Equipment preparation area", "Crew airlock area"],
    nominalCO2: 2380,
    nominalTemp: 24.2,
    nominalPressure: 101.2,
    nominalHumidity: 60.0,
    nominalRad: 0.20,
    locationOffsets: {
      "Equipment preparation area": { co2Offset: 0, tempOffset: 0, radOffset: 0 },
      "Crew airlock area": { co2Offset: -120, tempOffset: -0.8, radOffset: 0.02, pressureOffset: -0.1, humidityOffset: -3.0 },
    },
  },
];

// Backward-compatibility export alias
export const ISS_COMPARTMENTS = ISS_14_MODULES;

/**
 * Crew Member Physical Auto-Detected Stations
 * Auto-detection tracking identifies each astronaut's physical location on board the ISS.
 */
export const ASTRONAUT_DETECTED_LOCATIONS: Record<string, { moduleId: string; location: string }> = {
  "ASTRO-01": { moduleId: "harmony", location: "Sleeping quarters" },
  "ASTRO-02": { moduleId: "destiny", location: "Laboratory area" },
  "ASTRO-03": { moduleId: "tranquility", location: "Exercise area" },
};

export interface AstronautStationPosition {
  moduleId: string;
  moduleName: string;
  moduleShortName: string;
  segment: "USOS" | "ROS";
  location: string;
}

/**
 * Returns the auto-detected onboard compartment and sensor location for a given astronaut.
 * Used exclusively on astronaut cards, profile headers, and crew telemetry badges.
 */
export function getAstronautDetectedLocation(astronautId?: string): AstronautStationPosition {
  const target = (astronautId && ASTRONAUT_DETECTED_LOCATIONS[astronautId]) || {
    moduleId: "harmony",
    location: "Sleeping quarters",
  };
  const mod = ISS_14_MODULES.find((m) => m.id === target.moduleId) ?? ISS_14_MODULES[7];
  return {
    moduleId: target.moduleId,
    moduleName: mod.name,
    moduleShortName: mod.shortName,
    segment: mod.segment,
    location: target.location,
  };
}

export interface StationLocationState {
  selectedModuleId: string;
  selectedLocation: string;
  setSelectedModule: (moduleId: string) => void;
  setSelectedLocation: (location: string) => void;
  setManualModuleAndLocation: (moduleId: string, location: string) => void;
}

export const useStationLocationStore = create<StationLocationState>((set) => ({
  selectedModuleId: "harmony",
  selectedLocation: "General cabin area",

  setSelectedModule: (moduleId: string) => {
    const mod = ISS_14_MODULES.find((m) => m.id === moduleId) ?? ISS_14_MODULES[7];
    set({
      selectedModuleId: mod.id,
      selectedLocation: mod.sensorLocations[0],
    });
  },

  setSelectedLocation: (location: string) => {
    set({ selectedLocation: location });
  },

  setManualModuleAndLocation: (moduleId: string, location: string) => {
    set({ selectedModuleId: moduleId, selectedLocation: location });
  },
}));

/**
 * Computes localized real-time telemetry based on the active ISS module and sensor location,
 * overlaid with any live simulation anomalies.
 */
export function computeModuleTelemetry(
  moduleId: string,
  location: string,
  activeScenarios: string[] = [],
  activeScenario = "nominal",
) {
  const mod = ISS_14_MODULES.find((m) => m.id === moduleId) ?? ISS_14_MODULES[7];
  const locOffset = mod.locationOffsets?.[location] || {};

  let co2 = mod.nominalCO2 + (locOffset.co2Offset || 0);
  let temp = mod.nominalTemp + (locOffset.tempOffset || 0);
  let pressureKpa = mod.nominalPressure + (locOffset.pressureOffset || 0);
  let rad = mod.nominalRad + (locOffset.radOffset || 0);
  let humidity = mod.nominalHumidity + (locOffset.humidityOffset || 0);

  const hasCo2 = activeScenarios.includes("co2_spike") || activeScenario === "co2_spike";
  const hasThermal = activeScenarios.includes("thermal_overheat") || activeScenario === "thermal_overheat";
  const hasSaa = activeScenarios.includes("saa_transit") || activeScenario === "saa_transit";

  if (hasCo2) {
    co2 = 4350;
  }
  if (hasThermal) {
    temp = 27.4;
  }
  if (hasSaa) {
    rad = 0.480;
  }

  // Convert pressure in kPa to mmHg for downstream display math
  const pressureMmHg = pressureKpa * 7.50062;

  return {
    module: mod,
    location,
    co2,
    temp,
    pressureKpa,
    pressureMmHg,
    rad,
    humidity,
    hasCo2,
    hasThermal,
    hasSaa,
  };
}
