/**
 * Isolated Deep Module: NASA EDA Telemetry Playback Engine
 * Encapsulates playback state, ticker timers, speed scaling, and sliding sparklines.
 */

import { useState, useEffect, useRef, useCallback } from "react";

export interface EdaTelemetryRecord {
  id: string;
  index: number;
  isoTime: string;
  displayTime: string;
  fullTimestamp: string;
  co2: number; // PPM
  temp: number; // °C
  humidity: number; // %
  radiation: number; // mGy/day
  module: string;
  telemetrySource: string;
  rawGroundCo2?: number;
}

export interface EdaDatasetPayload {
  metadata: {
    source: string;
    url: string;
    mission: string;
    mission_title: string;
    mission_description: string;
    downloadedAt: string;
    totalPoints: number;
    timeStep: string;
    samplingRange: string;
  };
  records: EdaTelemetryRecord[];
}

export interface SparklinePoint {
  index: number;
  val: number;
}

export interface EdaPlaybackState {
  isLoaded: boolean;
  isPlaying: boolean;
  speed: 1 | 2 | 5;
  currentIndex: number;
  totalRecords: number;
  currentRecord: EdaTelemetryRecord | null;
  metadata: EdaDatasetPayload["metadata"] | null;
  sparklines: {
    co2: SparklinePoint[];
    temp: SparklinePoint[];
    humidity: SparklinePoint[];
    radiation: SparklinePoint[];
  };
}

export interface EdaPlaybackControls {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: 1 | 2 | 5) => void;
  seek: (index: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
}

export function computeCo2MmHg(ppm: number, totalPressureMmHg: number = 758.0): number {
  return Number(((ppm / 1_000_000) * totalPressureMmHg).toFixed(2));
}

export function useEdaPlayback(): [EdaPlaybackState, EdaPlaybackControls] {
  const [data, setData] = useState<EdaDatasetPayload | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<1 | 2 | 5>(1);
  const timerRef = useRef<number | null>(null);

  // Fetch dataset from public folder
  useEffect(() => {
    let isMounted = true;
    fetch("/data/nasaEdaRealData.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json() as Promise<EdaDatasetPayload>;
      })
      .then((json) => {
        if (isMounted) {
          setData(json);
          // Default to middle index (e.g. 25) for immediate dynamic data
          if (json.records?.length > 25) {
            setCurrentIndex(25);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load authentic NASA EDA dataset:", err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const totalRecords = data?.records?.length ?? 0;

  // Playback timer ticker
  useEffect(() => {
    if (!isPlaying || totalRecords === 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const intervalMs = Math.max(250, Math.round(1800 / speed));
    timerRef.current = window.setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        return next >= totalRecords ? 0 : next;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, speed, totalRecords]);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const togglePlay = useCallback(() => setIsPlaying((p) => !p), []);
  const handleSetSpeed = useCallback((s: 1 | 2 | 5) => setSpeed(s), []);
  const seek = useCallback(
    (index: number) => {
      if (totalRecords === 0) return;
      const clamped = Math.max(0, Math.min(index, totalRecords - 1));
      setCurrentIndex(clamped);
    },
    [totalRecords],
  );
  const stepForward = useCallback(() => {
    seek(currentIndex + 1);
  }, [currentIndex, seek]);
  const stepBackward = useCallback(() => {
    seek(currentIndex - 1);
  }, [currentIndex, seek]);

  const currentRecord = data?.records?.[currentIndex] ?? null;

  // Compute 10-point moving-window sparklines
  const records = data?.records ?? [];
  const windowStart = Math.max(0, currentIndex - 9);
  const windowSlice = records.slice(windowStart, currentIndex + 1);

  const sparklines = {
    co2: windowSlice.map((r, i) => ({ index: i, val: r.co2 })),
    temp: windowSlice.map((r, i) => ({ index: i, val: r.temp })),
    humidity: windowSlice.map((r, i) => ({ index: i, val: r.humidity })),
    radiation: windowSlice.map((r, i) => ({ index: i, val: r.radiation })),
  };

  const state: EdaPlaybackState = {
    isLoaded: Boolean(data),
    isPlaying,
    speed,
    currentIndex,
    totalRecords,
    currentRecord,
    metadata: data?.metadata ?? null,
    sparklines,
  };

  const controls: EdaPlaybackControls = {
    play,
    pause,
    togglePlay,
    setSpeed: handleSetSpeed,
    seek,
    stepForward,
    stepBackward,
  };

  return [state, controls];
}
