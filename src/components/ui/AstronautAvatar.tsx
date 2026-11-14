/**
 * Crew identity portraits.
 *
 * Photography sourced from NASA's public-domain image library and re-cropped
 * to a consistent head-and-shoulders square, background removed, and composited
 * on the console canvas so the cohort reads as one photo shoot. They are
 * illustrative stand-ins for the simulated Habitat Trace crew, not the crew itself.
 *
 *   ASTRO-01  jsc2023e000469_alt
 *   ASTRO-02  jsc2023e000234_alt
 *   ASTRO-03  jsc2022e007982_alt
 */

import React from "react";

export type AstronautAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface AstronautAvatarProps {
  astronautId: string;
  size?: AstronautAvatarSize;
  selected?: boolean;
  className?: string;
  /** When supplied the portrait becomes a labelled image instead of decoration. */
  label?: string;
}

const SIZE_PX: Record<AstronautAvatarSize, number> = {
  xs: 28,
  sm: 36,
  md: 44,
  lg: 64,
  xl: 88,
};

const RADIUS: Record<AstronautAvatarSize, string> = {
  xs: "rounded-md",
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-lg",
  xl: "rounded-lg",
};

interface CrewIdentity {
  accent: string;
  photo: string;
}

const CREW_IDENTITIES: Record<string, CrewIdentity> = {
  "ASTRO-01": { accent: "#0284c7", photo: "/avatars/astro-01.jpg" },
  "ASTRO-02": { accent: "#0891b2", photo: "/avatars/astro-02.jpg" },
  "ASTRO-03": { accent: "#059669", photo: "/avatars/astro-03.jpg" },
};

const DEFAULT_ACCENT = "#0284c7";

/** Per-crew accent used by portraits and any identity chrome around them. */
export function crewAccent(astronautId: string): string {
  return CREW_IDENTITIES[astronautId]?.accent ?? DEFAULT_ACCENT;
}

/** Unknown crew get a plain monogram tile — never invented artwork. */
function monogram(astronautId: string): string {
  const digits = astronautId.match(/\d+/g);
  if (digits?.length) {
    return digits.join("").slice(-3);
  }
  return astronautId.slice(-2).toUpperCase();
}

export function AstronautAvatar({
  astronautId,
  size = "md",
  selected = false,
  className = "",
  label,
}: AstronautAvatarProps) {
  const identity = CREW_IDENTITIES[astronautId];
  const accent = crewAccent(astronautId);
  const px = SIZE_PX[size];

  const selectedRing = selected
    ? "ring-2 ring-sky-500/70 ring-offset-2 ring-offset-canvas"
    : "";

  return (
    <span
      className={`relative inline-flex shrink-0 border border-border-strong ${RADIUS[size]} ${selectedRing} ${className}`}
      style={{ width: px, height: px }}
    >
      {identity ? (
        <img
          src={identity.photo}
          alt={label ?? ""}
          width={px}
          height={px}
          draggable={false}
          decoding="async"
          className={`h-full w-full object-cover ${RADIUS[size]}`}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`grid h-full w-full place-items-center bg-surface-subtle font-mono font-semibold text-secondary ${RADIUS[size]}`}
          style={{
            fontSize: Math.max(11, Math.round(px * 0.28)),
            boxShadow: `inset 0 -${Math.round(px * 0.4)}px ${Math.round(
              px * 0.5,
            )}px -${Math.round(px * 0.4)}px ${accent}`,
          }}
        >
          {monogram(astronautId)}
        </span>
      )}
    </span>
  );
}
