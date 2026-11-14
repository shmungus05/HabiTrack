/**
 * Declarative perspective gates.
 *
 * Use `<SurgeonOnly>` for diagnostic depth (raw telemetry, anomaly injection,
 * threshold sliders) and `<AstronautOnly>` for glanceable, low-cognitive-load
 * crew surfaces. Gates render their fallback rather than unmounting state, so
 * switching perspective never refetches or loses in-progress work.
 */

import type { ReactNode } from "react";

import { useRoleStore, type UserRole } from "../../stores/roleStore";

export interface RoleGateProps {
  allowedRoles: readonly UserRole[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoleGate({
  allowedRoles,
  fallback = null,
  children,
}: RoleGateProps) {
  const role = useRoleStore((state) => state.role);
  return allowedRoles.includes(role) ? <>{children}</> : <>{fallback}</>;
}

export interface PerspectiveGateProps {
  fallback?: ReactNode;
  children: ReactNode;
}

export function SurgeonOnly({ fallback = null, children }: PerspectiveGateProps) {
  return (
    <RoleGate allowedRoles={["flight_surgeon"]} fallback={fallback}>
      {children}
    </RoleGate>
  );
}

export function AstronautOnly({ fallback = null, children }: PerspectiveGateProps) {
  return (
    <RoleGate allowedRoles={["astronaut"]} fallback={fallback}>
      {children}
    </RoleGate>
  );
}

export interface UserRoleHelpers {
  role: UserRole;
  isAstronaut: boolean;
  isFlightSurgeon: boolean;
  setRole: (role: UserRole) => void;
  toggleRole: () => void;
}

/** Convenience hook for imperative branches inside a component. */
export function useUserRole(): UserRoleHelpers {
  const role = useRoleStore((state) => state.role);
  const setRole = useRoleStore((state) => state.setRole);
  const toggleRole = useRoleStore((state) => state.toggleRole);

  return {
    role,
    isAstronaut: role === "astronaut",
    isFlightSurgeon: role === "flight_surgeon",
    setRole,
    toggleRole,
  };
}
