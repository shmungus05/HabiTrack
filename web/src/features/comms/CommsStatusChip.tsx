/**
 * Ambient header chip: link state, latency, and outbox depth at a glance.
 * Clicking opens the communications controller.
 */

import { Satellite } from "lucide-react";
import { useState } from "react";

import {
  countPacketsByStatus,
  formatCommsDuration,
  useCommsStore,
} from "../../stores/commsStore";
import { CommsModal } from "./CommsModal";

export function CommsStatusChip() {
  const [isOpen, setIsOpen] = useState(false);
  const linkState = useCommsStore((state) => state.linkState);
  const latencySeconds = useCommsStore((state) => state.latencySeconds);
  const packets = useCommsStore((state) => state.packets);

  const transmitting = countPacketsByStatus(packets, "TRANSMITTING");
  const queued = countPacketsByStatus(packets, "PENDING_LOS");

  const realTime = linkState === "AOS" && latencySeconds === 0;
  const tone = linkState === "LOS" ? "rose" : realTime ? "emerald" : "amber";

  const palette = {
    emerald: "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10",
    amber: "border-amber-500/30 text-amber-300 hover:bg-amber-500/10",
    rose: "border-rose-500/30 text-rose-300 hover:bg-rose-500/10",
  }[tone];

  const dot = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
  }[tone];

  const label =
    linkState === "LOS"
      ? "LOS · Deep Space Silence"
      : realTime
        ? "AOS · Real-time"
        : `AOS · ${formatCommsDuration(latencySeconds)} Delay`;

  const count =
    linkState === "LOS"
      ? queued + transmitting
      : transmitting > 0
        ? transmitting
        : queued;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Open deep-space communications controller"
        aria-label={`Communications: ${label}`}
        className={`inline-flex items-center gap-2 rounded-md border bg-surface-elevated px-2.5 py-1 text-[11px] font-medium tracking-wide transition-colors ${palette}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dot} animate-pulse`} />
        <Satellite className="h-3 w-3" />
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{linkState}</span>
        {count > 0 ? (
          <span className="rounded border border-current px-1 font-mono text-[10px] opacity-80">
            {count}
          </span>
        ) : null}
      </button>

      {isOpen ? <CommsModal open onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}
