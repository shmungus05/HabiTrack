/**
 * Cohort state: registered astronauts, the active astronaut id, and loading
 * status. Astronaut switching is the single source of truth for all other
 * stores (notably the assistant drawer's isolation guard).
 */

import { create } from "zustand";

import { fetchAstronauts } from "../services/api";
import type { Astronaut } from "../types/api";

interface CohortState {
  astronauts: Astronaut[];
  activeAstronautId: string;
  isLoading: boolean;
  error: string | null;
  loadCohort: () => Promise<void>;
  selectAstronaut: (astronautId: string) => void;
}

export const useCohortStore = create<CohortState>((set, get) => ({
  astronauts: [],
  activeAstronautId: "ASTRO-01",
  isLoading: false,
  error: null,

  loadCohort: async () => {
    set({ isLoading: true, error: null });
    try {
      const astronauts = await fetchAstronauts();
      const active = get().activeAstronautId;
      const stillPresent = astronauts.some((item) => item.astronaut_id === active);
      set({
        astronauts,
        activeAstronautId: stillPresent ? active : (astronauts[0]?.astronaut_id ?? active),
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unable to load the crew cohort.",
      });
    }
  },

  selectAstronaut: (astronautId: string) => {
    if (get().activeAstronautId === astronautId) {
      return;
    }
    set({ activeAstronautId: astronautId });
  },
}));

export function getActiveAstronaut(state: CohortState): Astronaut | undefined {
  return state.astronauts.find(
    (astronaut) => astronaut.astronaut_id === state.activeAstronautId,
  );
}
