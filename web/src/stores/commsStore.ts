/**
 * Deep-space communications simulator.
 *
 * Models the operational reality of long-duration flight: speed-of-light
 * one-way latency to the ground, periodic loss of signal, and an onboard
 * outbox that buffers downlink packets during LOS and drains FIFO on AOS.
 *
 * The store is deliberately decoupled from `fetch()`: local SQLite writes and
 * workstation interactions stay instant while only ground-bound packets wait
 * in the simulated queue.
 */

import { create } from "zustand";

export type CommsLinkState = "AOS" | "LOS";
export type PacketStatus = "PENDING_LOS" | "TRANSMITTING" | "DELIVERED";
export type PacketType = "SYMPTOM_REPORT" | "EVENT_ACK" | "DOSSIER_TRANSMIT";

export interface OutboxPacket {
  packetId: string;
  type: PacketType;
  title: string;
  payload: Record<string, unknown>;
  createdAt: string;
  latencySeconds: number;
  timeRemainingSeconds: number;
  pausedRemainingSeconds?: number;
  status: PacketStatus;
}

export interface CommsPreset {
  id: string;
  label: string;
  latencySeconds: number;
  detail: string;
}

export const COMMS_PRESETS: readonly CommsPreset[] = [
  {
    id: "iss",
    label: "ISS Orbit",
    latencySeconds: 0,
    detail: "Low Earth orbit relay · real-time",
  },
  {
    id: "gateway",
    label: "Lunar Gateway",
    latencySeconds: 1.3,
    detail: "Cislunar · 1.3 s one-way",
  },
  {
    id: "mars_opposition",
    label: "Mars Opposition",
    latencySeconds: 210,
    detail: "Closest approach ~0.4 AU · 3.5 min",
  },
  {
    id: "mars_conjunction",
    label: "Mars Conjunction",
    latencySeconds: 1290,
    detail: "Solar conjunction ~2.5 AU · 21.5 min",
  },
] as const;

export const MAX_LATENCY_SECONDS = 1440;

export const SPEED_MULTIPLIERS = [1, 10, 60, Infinity] as const;

const STORAGE_KEY = "wayfinder_comms_state";
const TICK_INTERVAL_MS = 250;
const DEFAULT_LATENCY_SECONDS = 210;

interface CommsState {
  linkState: CommsLinkState;
  latencySeconds: number;
  speedMultiplier: number;
  packets: OutboxPacket[];
  activePreset: string;

  setLinkState: (linkState: CommsLinkState) => void;
  setLatency: (seconds: number, presetLabel?: string) => void;
  setSpeedMultiplier: (multiplier: number) => void;
  enqueuePacket: (
    type: PacketType,
    title: string,
    payload: Record<string, unknown>,
  ) => OutboxPacket;
  flushDeliveredPackets: () => void;
  clearAllPackets: () => void;
  tick: (deltaSeconds: number) => void;
}

export function formatCommsDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0.0s";
  }
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)}m`;
}

function clampLatency(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    return MAX_LATENCY_SECONDS;
  }
  return Math.min(MAX_LATENCY_SECONDS, Math.max(0, seconds));
}

function hasActiveTransmission(packets: OutboxPacket[]): boolean {
  return packets.some((packet) => packet.status === "TRANSMITTING");
}

/**
 * Promote the oldest queued packet into transmission, preserving any remaining
 * spaceflight seconds it accumulated before an LOS pause.
 */
function promoteOldest(packets: OutboxPacket[], latencySeconds: number): OutboxPacket[] {
  if (hasActiveTransmission(packets)) {
    return packets;
  }
  let promoted = false;
  return packets.map((packet) => {
    if (promoted || packet.status !== "PENDING_LOS") {
      return packet;
    }
    promoted = true;
    const remaining =
      packet.pausedRemainingSeconds !== undefined
        ? packet.pausedRemainingSeconds
        : packet.latencySeconds || latencySeconds;
    return {
      ...packet,
      status: "TRANSMITTING" as const,
      timeRemainingSeconds: Math.max(0, remaining),
      pausedRemainingSeconds: undefined,
    };
  });
}

function deliverActiveAndAdvance(
  packets: OutboxPacket[],
  latencySeconds: number,
): OutboxPacket[] {
  const delivered = packets.map((packet) =>
    packet.status === "TRANSMITTING"
      ? {
          ...packet,
          status: "DELIVERED" as const,
          timeRemainingSeconds: 0,
          pausedRemainingSeconds: undefined,
        }
      : packet,
  );
  return promoteOldest(delivered, latencySeconds);
}

// ---------------------------------------------------------------------------
// localStorage persistence (structural changes only; ticks never persist)
// ---------------------------------------------------------------------------

interface PersistedCommsState {
  linkState: CommsLinkState;
  latencySeconds: number;
  activePreset: string;
  packets: OutboxPacket[];
}

function persist(state: CommsState): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const snapshot: PersistedCommsState = {
      linkState: state.linkState,
      latencySeconds: state.latencySeconds,
      activePreset: state.activePreset,
      packets: state.packets,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* Persistence is a convenience; never break the queue on quota errors. */
  }
}

function readPersistedState(): Partial<PersistedCommsState> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Partial<PersistedCommsState>;
    const linkState: CommsLinkState =
      parsed.linkState === "LOS" ? "LOS" : "AOS";
    const latencySeconds = clampLatency(
      typeof parsed.latencySeconds === "number"
        ? parsed.latencySeconds
        : DEFAULT_LATENCY_SECONDS,
    );
    const packets = Array.isArray(parsed.packets)
      ? parsed.packets
          .filter(
            (packet): packet is OutboxPacket =>
              Boolean(packet) &&
              typeof packet.packetId === "string" &&
              typeof packet.type === "string",
          )
          .map((packet) => ({
            ...packet,
            timeRemainingSeconds: Number.isFinite(packet.timeRemainingSeconds)
              ? packet.timeRemainingSeconds
              : 0,
            latencySeconds: Number.isFinite(packet.latencySeconds)
              ? packet.latencySeconds
              : latencySeconds,
          }))
      : [];
    return {
      linkState,
      latencySeconds,
      activePreset:
        typeof parsed.activePreset === "string" ? parsed.activePreset : "custom",
      packets,
    };
  } catch {
    return {};
  }
}

let packetSequence = 0;

function nextPacketId(): string {
  packetSequence += 1;
  return `PKT-${Date.now().toString(36).toUpperCase()}-${packetSequence
    .toString(36)
    .toUpperCase()}`;
}

const persisted = readPersistedState();

export const useCommsStore = create<CommsState>((set, get) => ({
  linkState: persisted.linkState ?? "AOS",
  latencySeconds: persisted.latencySeconds ?? DEFAULT_LATENCY_SECONDS,
  speedMultiplier: 1,
  activePreset: persisted.activePreset ?? "mars_opposition",
  packets: persisted.packets ?? [],

  setLinkState: (linkState: CommsLinkState) => {
    const state = get();
    if (state.linkState === linkState) {
      return;
    }

    if (linkState === "LOS") {
      // Freeze the in-flight packet exactly where it stopped.
      const packets = state.packets.map((packet) =>
        packet.status === "TRANSMITTING"
          ? {
              ...packet,
              status: "PENDING_LOS" as const,
              pausedRemainingSeconds: packet.timeRemainingSeconds,
            }
          : packet,
      );
      set({ linkState, packets });
    } else if (state.speedMultiplier === Infinity) {
      // Instant Delivery stays authoritative: drain instead of promoting.
      const packets = state.packets.map((packet) =>
        packet.status === "DELIVERED"
          ? packet
          : {
              ...packet,
              status: "DELIVERED" as const,
              timeRemainingSeconds: 0,
              pausedRemainingSeconds: undefined,
            },
      );
      set({ linkState, packets });
    } else {
      const packets = promoteOldest(state.packets, state.latencySeconds);
      set({ linkState, packets });
    }
    persist(get());
  },

  setLatency: (seconds: number, presetLabel?: string) => {
    const state = get();
    const latencySeconds = clampLatency(seconds);
    const queued = state.packets.map((packet) =>
      packet.status === "PENDING_LOS"
        ? {
            ...packet,
            latencySeconds,
            pausedRemainingSeconds:
              packet.pausedRemainingSeconds === undefined
                ? latencySeconds
                : packet.pausedRemainingSeconds,
          }
        : packet,
    );
    set({
      latencySeconds,
      activePreset: presetLabel ?? "custom",
      packets: queued,
    });
    persist(get());
  },

  setSpeedMultiplier: (multiplier: number) => {
    const isSupported =
      multiplier === 1 || multiplier === 10 || multiplier === 60 || multiplier === Infinity;
    if (!isSupported) {
      return;
    }
    if (multiplier === Infinity) {
      // Instant Delivery: drain the queue immediately.
      const packets = get().packets.map((packet) =>
        packet.status === "DELIVERED"
          ? packet
          : {
              ...packet,
              status: "DELIVERED" as const,
              timeRemainingSeconds: 0,
              pausedRemainingSeconds: undefined,
            },
      );
      set({ speedMultiplier: Infinity, packets });
      persist(get());
      return;
    }
    set({ speedMultiplier: multiplier });
  },

  enqueuePacket: (
    type: PacketType,
    title: string,
    payload: Record<string, unknown>,
  ): OutboxPacket => {
    const state = get();
    const instant = state.speedMultiplier === Infinity;
    const canStartNow =
      state.linkState === "AOS" && !hasActiveTransmission(state.packets);

    const packet: OutboxPacket = {
      packetId: nextPacketId(),
      type,
      title,
      payload,
      createdAt: new Date().toISOString(),
      latencySeconds: state.latencySeconds,
      timeRemainingSeconds: instant ? 0 : canStartNow ? state.latencySeconds : 0,
      pausedRemainingSeconds:
        instant || canStartNow ? undefined : state.latencySeconds,
      status: instant ? "DELIVERED" : canStartNow ? "TRANSMITTING" : "PENDING_LOS",
    };

    set({ packets: [...state.packets, packet] });
    persist(get());
    return packet;
  },

  flushDeliveredPackets: () => {
    const packets = get().packets.filter(
      (packet) => packet.status !== "DELIVERED",
    );
    set({ packets });
    persist(get());
  },

  clearAllPackets: () => {
    set({ packets: [] });
    persist(get());
  },

  tick: (deltaSeconds: number) => {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return;
    }
    const state = get();
    const activeIndex = state.packets.findIndex(
      (packet) => packet.status === "TRANSMITTING",
    );
    if (activeIndex === -1 || state.linkState !== "AOS") {
      return;
    }

    const multiplier = state.speedMultiplier;
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      return;
    }

    const active = state.packets[activeIndex];
    const remaining = Math.max(
      0,
      active.timeRemainingSeconds - deltaSeconds * multiplier,
    );

    let packets = state.packets.map((packet, index) =>
      index === activeIndex ? { ...packet, timeRemainingSeconds: remaining } : packet,
    );

    if (remaining <= 0) {
      packets = deliverActiveAndAdvance(packets, state.latencySeconds);
      set({ packets });
      persist(get());
      return;
    }

    set({ packets });
  },
}));

// ---------------------------------------------------------------------------
// Self-starting wall-clock ticker
// ---------------------------------------------------------------------------

let tickerId: ReturnType<typeof setInterval> | null = null;
let lastTickTime = Date.now();

export function startTicker(): void {
  if (typeof window === "undefined" || tickerId !== null) {
    return;
  }
  lastTickTime = Date.now();
  tickerId = setInterval(() => {
    const now = Date.now();
    const deltaSeconds = (now - lastTickTime) / 1000;
    lastTickTime = now;
    useCommsStore.getState().tick(deltaSeconds);
  }, TICK_INTERVAL_MS);
}

export function stopTicker(): void {
  if (tickerId !== null) {
    clearInterval(tickerId);
    tickerId = null;
  }
}

if (typeof window !== "undefined") {
  startTicker();
}

export function countPacketsByStatus(
  packets: OutboxPacket[],
  status: PacketStatus,
): number {
  return packets.filter((packet) => packet.status === status).length;
}
