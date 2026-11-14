/**
 * Strongly-typed domain models for HabiTrack Operational Library & Guides.
 * Grounded in official NASA Human Research Program (HRP) and NASA-STD-3001 standards.
 */

export type GuideCategory =
  | "exercise"
  | "sleep"
  | "medical"
  | "nutrition"
  | "adaptation";

export interface GuideChapter {
  time: string;
  seconds: number;
  title: string;
}

export interface GuideSafetyNotice {
  level: "WARNING" | "CAUTION" | "FLIGHT_RULE";
  ruleId?: string;
  text: string;
}

export interface LibraryGuide {
  id: string;
  nasaDocumentId: string; // e.g. "NASA-STD-3001-V2", "NASA-HRP-47065"
  title: string;
  category: GuideCategory;
  durationMinutes: number;
  sourceRepository: string; // e.g. "NASA Human Research Program (HRP)"
  summary: string;
  instructions: string[];
  safetyNotices: GuideSafetyNotice[];
  chapters: GuideChapter[];
  mediaType: "youtube" | "video_stream" | "simulation";
  mediaUrl: string; // Fast web stream URL (~mobile.mp4 or ~preview.mp4)
  thumbnailUrl?: string;
  relatedSymptomCodes?: string[]; // e.g. ["HEADACHE", "NAUSEA", "DIZZINESS"]
  verifiedBy: string; // e.g. "Expedition 71 Lead Flight Surgeon"
}

export interface NasaMediaItem {
  nasaId: string;
  title: string;
  description: string;
  mediaType: "video" | "image";
  dateCreated: string;
  center?: string;
  thumbnailUrl: string;
  collectionUrl: string;
  directMediaUrl?: string;
}
