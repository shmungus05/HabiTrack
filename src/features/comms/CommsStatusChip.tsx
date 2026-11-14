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
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70",
    amber: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100/70",
    rose: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100/70",
  }[tone];

  const dot = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
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
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${palette}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dot} animate-pulse`} />
        <Satellite className="h-3 w-3" />
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{linkState}</span>
        {count > 0 ? (
          <span className="rounded border border-current px-1.5 font-mono text-[11px] opacity-85">
            {count}
          </span>
        ) : null}
      </button>

      {isOpen ? <CommsModal open onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}
