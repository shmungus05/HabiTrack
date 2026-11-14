/**
 * Active-perspective store: onboard crew vs. ground flight surgeon.
 *
 * The perspective is a client-side operational toggle, not authentication.
 * It persists to `localStorage` so a shared workstation reopens in the last
 * operator's perspective without a login step or backend RBAC.
 */

import { create } from "zustand";

export type UserRole = "astronaut" | "flight_surgeon";

const STORAGE_KEY = "habitrack_active_role";
const SELECTION_STORAGE_KEY = "habitrack_role_selected";
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

function readPersistedSelection(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(SELECTION_STORAGE_KEY) === "true";
  } catch {
    return false;
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

function persistSelection(selected: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (selected) {
      window.localStorage.setItem(SELECTION_STORAGE_KEY, "true");
    } else {
      window.localStorage.removeItem(SELECTION_STORAGE_KEY);
    }
  } catch {
    /* Ignore quota failures */
  }
}

interface RoleState {
  role: UserRole;
  hasSelectedRole: boolean;
  setRole: (role: UserRole) => void;
  selectRoleAndEnter: (role: UserRole) => void;
  openRoleSelector: () => void;
  toggleRole: () => void;
}

export const useRoleStore = create<RoleState>((set, get) => ({
  role: readPersistedRole(),
  hasSelectedRole: readPersistedSelection(),

  setRole: (role: UserRole) => {
    if (!isUserRole(role) || get().role === role) {
      return;
    }
    persistRole(role);
    set({ role });
  },

  selectRoleAndEnter: (role: UserRole) => {
    if (!isUserRole(role)) {
      return;
    }
    persistRole(role);
    persistSelection(true);
    set({ role, hasSelectedRole: true });
  },

  openRoleSelector: () => {
    set({ hasSelectedRole: false });
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
