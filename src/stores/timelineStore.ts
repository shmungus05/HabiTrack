/**
 * Timeline view state: synchronized zoom range, LTTB decimation preference,
 * and the set of visible telemetry streams.
 */

import { create } from "zustand";

export const TELEMETRY_STREAMS = [
  "stream_eda_co2",
  "stream_eda_temp",
  "stream_eda_pressure",
  "stream_sim_hr",
  "stream_sim_hrv",
  "stream_sim_spo2",
  "stream_sim_temp",
] as const;

export type TelemetryStreamId = (typeof TELEMETRY_STREAMS)[number];

interface TimelineState {
  zoomRange: [string, string] | null;
  decimationEnabled: boolean;
  selectedStreams: string[];
  setZoomRange: (range: [string, string] | null) => void;
  toggleDecimation: () => void;
  setSelectedStreams: (streams: string[]) => void;
  toggleStream: (streamId: string) => void;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  zoomRange: null,
  decimationEnabled: true,
  selectedStreams: [...TELEMETRY_STREAMS],

  setZoomRange: (range) => set({ zoomRange: range }),

  toggleDecimation: () => set({ decimationEnabled: !get().decimationEnabled }),

  setSelectedStreams: (streams) => set({ selectedStreams: streams }),

  toggleStream: (streamId) => {
    const selected = get().selectedStreams;
    set({
      selectedStreams: selected.includes(streamId)
        ? selected.filter((item) => item !== streamId)
        : [...selected, streamId],
    });
  },
}));
