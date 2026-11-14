/**
 * Communications controller: AOS/LOS switch, astrodynamic latency presets,
 * time-warp multipliers, and the ground outbox inspector.
 */

import {
  ArrowDownToLine,
  CheckCircle2,
  Clock3,
  Gauge,
  RadioTower,
  Trash2,
  X,
} from "lucide-react";
import { useEffect } from "react";

import { Badge, Button } from "../../components/ui";
import {
  COMMS_PRESETS,
  MAX_LATENCY_SECONDS,
  formatCommsDuration,
  useCommsStore,
  type OutboxPacket,
  type PacketStatus,
  type PacketType,
} from "../../stores/commsStore";

interface CommsModalProps {
  open: boolean;
  onClose: () => void;
}

const PACKET_STATUS_THEME: Record<PacketStatus, string> = {
  PENDING_LOS: "border-border bg-surface-elevated text-muted",
  TRANSMITTING: "border-border-strong bg-surface-subtle text-foreground",
  DELIVERED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

const PACKET_TYPE_THEME: Record<PacketType, string> = {
  SYMPTOM_REPORT: "text-foreground",
  EVENT_ACK: "text-secondary",
  DOSSIER_TRANSMIT: "text-accent-light",
};

function progressFor(packet: OutboxPacket): number {
  if (packet.status === "DELIVERED") {
    return 1;
  }
  if (packet.status !== "TRANSMITTING" || packet.latencySeconds <= 0) {
    return 0;
  }
  return Math.min(
    1,
    Math.max(0, 1 - packet.timeRemainingSeconds / packet.latencySeconds),
  );
}

function PacketRow({ packet }: { packet: OutboxPacket }) {
  const progress = progressFor(packet);
  return (
    <li className="rounded-lg border border-border bg-surface-elevated p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`font-mono text-[10px] font-semibold tracking-wider ${PACKET_TYPE_THEME[packet.type]}`}
            >
              {packet.type.replace(/_/g, " ")}
            </span>
            <span className="font-mono text-[10px] text-muted">
              {packet.packetId}
            </span>
          </div>
          <p className="mt-1 truncate text-xs font-medium text-foreground">
            {packet.title}
          </p>
          <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-muted">
            <Clock3 className="h-3 w-3" />
            {new Date(packet.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            })}
            {packet.status === "TRANSMITTING" ? (
              <>
                <span>·</span>
                <span>
                  {formatCommsDuration(packet.timeRemainingSeconds)} remaining
                </span>
              </>
            ) : null}
            {packet.status === "PENDING_LOS" ? (
              <>
                <span>·</span>
                <span>buffered {formatCommsDuration(packet.latencySeconds)}</span>
              </>
            ) : null}
          </p>
        </div>
        <span
          className={`badge border ${PACKET_STATUS_THEME[packet.status]}`}
        >
          {packet.status === "DELIVERED" ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : null}
          {packet.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-subtle">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${
            packet.status === "DELIVERED" ? "bg-emerald-400" : "bg-accent-light"
          }`}
          style={{ width: `${(progress * 100).toFixed(1)}%` }}
        />
      </div>

      <details className="mt-2 group">
        <summary className="cursor-pointer select-none text-[10px] font-medium uppercase tracking-wider text-muted hover:text-foreground">
          Payload
        </summary>
        <pre className="mt-1.5 max-h-40 overflow-auto rounded-md border border-border bg-canvas p-2 font-mono text-[10px] leading-relaxed text-secondary">
          {JSON.stringify(packet.payload, null, 2)}
        </pre>
      </details>
    </li>
  );
}

export function CommsModal({ open, onClose }: CommsModalProps) {
  const linkState = useCommsStore((state) => state.linkState);
  const latencySeconds = useCommsStore((state) => state.latencySeconds);
  const speedMultiplier = useCommsStore((state) => state.speedMultiplier);
  const activePreset = useCommsStore((state) => state.activePreset);
  const packets = useCommsStore((state) => state.packets);

  const setLinkState = useCommsStore((state) => state.setLinkState);
  const setLatency = useCommsStore((state) => state.setLatency);
  const setSpeedMultiplier = useCommsStore((state) => state.setSpeedMultiplier);
  const flushDeliveredPackets = useCommsStore(
    (state) => state.flushDeliveredPackets,
  );
  const clearAllPackets = useCommsStore((state) => state.clearAllPackets);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const deliveredCount = packets.filter(
    (packet) => packet.status === "DELIVERED",
  ).length;
  const queuedCount = packets.filter(
    (packet) => packet.status !== "DELIVERED",
  ).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Deep Space Communications Simulator"
        onClick={(event) => event.stopPropagation()}
        className="my-auto w-full max-w-4xl overflow-hidden rounded-lg border border-border-strong bg-surface shadow-elevated"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              <RadioTower className="h-3.5 w-3.5" />
              Ground Downlink Simulation
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Deep Space Communications
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Local writes stay instant; only ground-bound packets traverse the
              simulated link.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close communications controller"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-elevated text-muted transition-colors hover:border-border-strong hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[calc(100vh-12rem)] space-y-6 overflow-y-auto px-5 py-5">
          {/* Link state + presets */}
          <section className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-3">
              <span className="field-label">Link state</span>
              <div className="flex rounded-lg border border-border bg-canvas p-1">
                {(["AOS", "LOS"] as const).map((state) => (
                  <button
                    key={state}
                    type="button"
                    aria-pressed={linkState === state}
                    onClick={() => setLinkState(state)}
                    className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                      linkState === state
                        ? "bg-surface-subtle text-foreground border border-border-strong"
                        : "border border-transparent text-muted hover:text-foreground"
                    }`}
                  >
                    {state === "AOS"
                      ? "AOS · Acquisition"
                      : "LOS · Loss of Signal"}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-muted">
                {linkState === "LOS"
                  ? "Blackout in effect. New packets buffer locally until acquisition."
                  : queuedCount > 0
                    ? `${queuedCount} packet${queuedCount === 1 ? "" : "s"} draining FIFO on the active link.`
                    : "Link acquired. Outbox is empty."}
              </p>
            </div>

            <div className="space-y-3">
              <span className="field-label">Astrodynamic presets</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {COMMS_PRESETS.map((preset) => {
                  const active = activePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setLatency(preset.latencySeconds, preset.id)}
                      aria-pressed={active}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        active
                          ? "border-border-strong bg-surface-subtle text-foreground"
                          : "border-border bg-surface-elevated text-secondary hover:border-border-strong hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">
                          {preset.label}
                        </span>
                        <span className="font-mono text-[10px] text-muted">
                          {formatCommsDuration(preset.latencySeconds)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                        {preset.detail}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Latency + time warp */}
          <section className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-2 rounded-lg border border-border bg-surface-elevated p-4">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-2 font-medium text-secondary">
                  <Gauge className="h-3.5 w-3.5" />
                  One-way latency
                </span>
                <span className="font-semibold text-foreground">
                  {formatCommsDuration(latencySeconds)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={MAX_LATENCY_SECONDS}
                step={1}
                value={latencySeconds}
                onChange={(event) => setLatency(Number(event.target.value))}
                aria-label="One-way simulated latency in seconds"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-subtle"
              />
              <div className="flex justify-between font-mono text-[10px] text-faint">
                <span>0 s (LEO relay)</span>
                <span>1,440 s (24 min)</span>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-surface-elevated p-4">
              <span className="text-xs font-medium text-secondary">
                Simulation time warp
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {([1, 10, 60, Infinity] as const).map((multiplier) => {
                  const active = speedMultiplier === multiplier;
                  const label =
                    multiplier === Infinity ? "Instant" : `${multiplier}x`;
                  return (
                    <button
                      key={String(multiplier)}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSpeedMultiplier(multiplier)}
                      className={`rounded-md border px-2 py-2 text-[11px] font-semibold transition-colors ${
                        active
                          ? "border-border-strong bg-surface-subtle text-foreground"
                          : "border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] leading-relaxed text-muted">
                Instant Delivery drains the outbox immediately; 60x makes a Mars
                conjunction leg reviewable in ~21 seconds.
              </p>
            </div>
          </section>

          {/* Outbox */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <span className="field-label">Ground outbox</span>
                <Badge variant="default">{queuedCount} queued</Badge>
                <Badge variant="default">{deliveredCount} delivered</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={flushDeliveredPackets}
                  disabled={deliveredCount === 0}
                  leftIcon={<ArrowDownToLine className="h-3.5 w-3.5" />}
                >
                  Clear Delivered
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearAllPackets}
                  disabled={packets.length === 0}
                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Clear All
                </Button>
              </div>
            </div>

            {packets.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted">
                No packets in the outbox. Symptom reports, event
                acknowledgements, and dossiers will queue here.
              </div>
            ) : (
              <ul className="space-y-2">
                {packets.map((packet) => (
                  <PacketRow key={packet.packetId} packet={packet} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
