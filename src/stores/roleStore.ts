/**
 * Active-perspective store: onboard crew vs. ground flight surgeon.
 *
 * The perspective is a client-side operational toggle, not authentication.
 * It persists to `localStorage` so a shared workstation reopens in the last
 * operator's perspective without a login step or backend RBAC.
 */

import { create } from "zustand";

export type UserRole = "astronaut" | "flight_surgeon";

const STORAGE_KEY = "wayfinder_active_role";
const DEFAULT_ROLE: UserRole = "flight_surgeon";

/** Astronaut perspective is locked to the logged crewmember (Commander Vance). */
export const ASTRONAUT_LOCKED_COHORT_ID = "ASTRO-01";

function isUserRole(value: unknown): value is UserRole {
  return value === "astronaut" || value === "flight_surgeon";
}

function readPersistedRole(): UserRole {
  if (typeof window === "undefined") {
    return DEFAULT_ROLE;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isUserRole(stored) ? stored : DEFAULT_ROLE;
  } catch {
    return DEFAULT_ROLE;
  }
}

function persistRole(role: UserRole): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, role);
  } catch {
    /* Private-mode or quota failures must not break the perspective switch. */
  }
}

interface RoleState {
  role: UserRole;
  setRole: (role: UserRole) => void;
  toggleRole: () => void;
}

export const useRoleStore = create<RoleState>((set, get) => ({
  role: readPersistedRole(),

  setRole: (role: UserRole) => {
    if (!isUserRole(role) || get().role === role) {
      return;
    }
    persistRole(role);
    set({ role });
  },

  toggleRole: () => {
    const next: UserRole =
      get().role === "astronaut" ? "flight_surgeon" : "astronaut";
    persistRole(next);
    set({ role: next });
  },
}));

export function isAstronautPerspective(role: UserRole): boolean {
  return role === "astronaut";
}
