/**
 * Centralized typed API client for the WAYFINDER V3 FastAPI service.
 *
 * Requests are relative by default so the same bundle works behind the Vite
 * dev proxy and when served directly from FastAPI on port 8000.
 */

import type {
  AssistantResponse,
  Astronaut,
  Baselines,
  FlightRule,
  HealthEvent,
  HealthStatus,
  Measurement,
  ProviderStatusResponse,
  ReviewEventRequest,
  ReviewStatus,
  SeverityLevel,
  SymptomReport,
  SymptomReportRequest,
} from "../types/api";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "/api").replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    throw new ApiError(
      0,
      error instanceof Error
        ? `Unable to reach the WAYFINDER service: ${error.message}`
        : "Unable to reach the WAYFINDER service.",
    );
  }

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { detail?: unknown };
      if (typeof payload.detail === "string") {
        detail = payload.detail;
      }
    } catch {
      /* Non-JSON error body: keep the status line. */
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

export function fetchHealth(): Promise<HealthStatus> {
  return request<HealthStatus>("/health");
}

export function fetchAstronauts(): Promise<Astronaut[]> {
  return request<Astronaut[]>("/astronauts");
}

export function fetchAstronaut(astronautId: string): Promise<Astronaut> {
  return request<Astronaut>(`/astronauts/${encodeURIComponent(astronautId)}`);
}

export function fetchMeasurements(
  astronautId: string,
  windowHours = 336,
  maxPoints = 1000,
): Promise<Measurement[]> {
  return request<Measurement[]>(
    `/telemetry/measurements${query({
      astronaut_id: astronautId,
      window_hours: windowHours,
      max_points: maxPoints,
    })}`,
  );
}

export function fetchBaselines(astronautId: string): Promise<Baselines> {
  return request<Baselines>(
    `/telemetry/baselines${query({ astronaut_id: astronautId })}`,
  );
}

export function fetchEvents(
  astronautId?: string,
  severity?: SeverityLevel,
): Promise<HealthEvent[]> {
  return request<HealthEvent[]>(
    `/events${query({ astronaut_id: astronautId, severity })}`,
  );
}

export function reviewEvent(
  eventId: string,
  reviewStatus: ReviewStatus,
  reviewNotes?: string | null,
): Promise<HealthEvent> {
  const body: ReviewEventRequest = {
    review_status: reviewStatus,
    review_notes: reviewNotes ?? null,
  };
  return request<HealthEvent>(`/events/${encodeURIComponent(eventId)}/review`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchSymptoms(astronautId?: string): Promise<SymptomReport[]> {
  return request<SymptomReport[]>(`/symptoms${query({ astronaut_id: astronautId })}`);
}

export function submitSymptom(payload: SymptomReportRequest): Promise<SymptomReport> {
  return request<SymptomReport>("/symptoms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function explainEvent(
  eventId: string,
  astronautId: string,
): Promise<AssistantResponse> {
  return request<AssistantResponse>("/assistant/explain", {
    method: "POST",
    body: JSON.stringify({ event_id: eventId, astronaut_id: astronautId }),
  });
}

export function queryAssistant(
  text: string,
  topK = 5,
  astronautId?: string | null,
  concordanceEventId?: string | null,
): Promise<AssistantResponse> {
  return request<AssistantResponse>("/assistant/query", {
    method: "POST",
    body: JSON.stringify({
      query: text,
      top_k: topK,
      astronaut_id: astronautId ?? null,
      concordance_event_id: concordanceEventId ?? null,
    }),
  });
}

export function fetchFlightRules(
  subsystem?: string,
  severity?: string,
): Promise<FlightRule[]> {
  return request<FlightRule[]>(
    `/assistant/rules${query({ subsystem, severity })}`,
  );
}

export function fetchFlightRule(ruleId: string): Promise<FlightRule> {
  return request<FlightRule>(`/assistant/rules/${encodeURIComponent(ruleId)}`);
}

export function fetchProviderStatus(): Promise<ProviderStatusResponse> {
  return request<ProviderStatusResponse>("/assistant/provider-status");
}
