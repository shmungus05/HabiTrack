/**
 * Isolated Deep Module: Spacecraft Compartment Topology & Sensor Allocation
 * Models key ISS modules and their ECLSS sensor allocations.
 */

export interface SpacecraftModule {
  id: string;
  name: string;
  function: string;
  primarySensors: string[];
  nominalCO2: number;
  nominalTemp: number;
  nominalHumidity: number;
  nominalRad: number;
}

export const ISS_COMPARTMENTS: SpacecraftModule[] = [
  {
    id: "node2",
    name: "Node 2 (Harmony)",
    function: "Crew Quarters & Forward Utility",
    primarySensors: ["MCA ppCO2-N2", "THC-Temp-2", "AQM-2"],
    nominalCO2: 3197,
    nominalTemp: 22.8,
    nominalHumidity: 43.9,
    nominalRad: 0.20,
  },
  {
    id: "destiny",
    name: "US Laboratory (Destiny)",
    function: "Primary Science Research Core",
    primarySensors: ["ARS-CO2-Dest", "Lab-THC-1", "TEPC-Radiation"],
    nominalCO2: 2950,
    nominalTemp: 22.1,
    nominalHumidity: 44.5,
    nominalRad: 0.19,
  },
  {
    id: "columbus",
    name: "Columbus Orbital Facility",
    function: "ESA European Research Module",
    primarySensors: ["COL-ECLSS-1", "COL-Temp-A", "RAM-04"],
    nominalCO2: 2880,
    nominalTemp: 22.4,
    nominalHumidity: 42.8,
    nominalRad: 0.18,
  },
  {
    id: "kibo",
    name: "JEM Kibo",
    function: "JAXA Japanese Experiment Module",
    primarySensors: ["JEM-ECLSS-CO2", "JEM-THC-1", "RAM-05"],
    nominalCO2: 2790,
    nominalTemp: 21.9,
    nominalHumidity: 45.1,
    nominalRad: 0.19,
  },
  {
    id: "node1",
    name: "Node 1 (Unity)",
    function: "Central Galley & Connecting Node",
    primarySensors: ["Unity-ARS-CO2", "Unity-THC-1", "RAM-02"],
    nominalCO2: 3040,
    nominalTemp: 23.0,
    nominalHumidity: 44.2,
    nominalRad: 0.21,
  },
  {
    id: "cupola",
    name: "Cupola Observation Module",
    function: "Earth Observation & Robotics Workstation",
    primarySensors: ["Cupola-THC-Aux", "RAM-08-Window"],
    nominalCO2: 2620,
    nominalTemp: 21.2,
    nominalHumidity: 39.5,
    nominalRad: 0.28,
  },
];
