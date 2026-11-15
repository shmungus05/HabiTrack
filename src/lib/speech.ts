/**
 * web/src/lib/speech.ts: Push-to-Talk (PTT) speech recognition, real-time
 * audio waveform energy metering, and WebSocket audio streaming bridge
 * for Gemini 2.5 Flash Native Audio Dialog.
 */

export interface SpeechRecognitionResultPayload {
  transcript: string;
  isFinal: boolean;
  confidence?: number;
}

export interface AudioMeter {
  getEnergy: () => number; // 0.0 to 1.0 normalized
  stop: () => void;
}

/**
 * Probes browser Web Speech API availability.
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );
}

/**
 * Initializes a Push-to-Talk (PTT) speech recognition session with interim results.
 */
export class PushToTalkController {
  private recognition: any = null;
  private isListening = false;
  private onResultCb?: (payload: SpeechRecognitionResultPayload) => void;
  private onErrorCb?: (error: string) => void;
  private onEndCb?: () => void;

  constructor(
    onResult?: (payload: SpeechRecognitionResultPayload) => void,
    onError?: (error: string) => void,
    onEnd?: () => void
  ) {
    this.onResultCb = onResult;
    this.onErrorCb = onError;
    this.onEndCb = onEnd;

    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRec) {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";

      this.recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";
        let maxConfidence = 0.95;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            final += item[0].transcript;
            if (item[0].confidence) {
              maxConfidence = item[0].confidence;
            }
          } else {
            interim += item[0].transcript;
          }
        }

        const text = (final || interim).trim();
        if (text && this.onResultCb) {
          this.onResultCb({
            transcript: text,
            isFinal: Boolean(final),
            confidence: maxConfidence,
          });
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error !== "no-speech" && this.onErrorCb) {
          this.onErrorCb(event.error || "Speech recognition error");
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (this.onEndCb) this.onEndCb();
      };
    }
  }

  public start(): boolean {
    if (!this.recognition || this.isListening) return false;
    try {
      this.isListening = true;
      this.recognition.start();
      return true;
    } catch {
      this.isListening = false;
      return false;
    }
  }

  public stop(): void {
    if (!this.recognition || !this.isListening) return;
    try {
      this.recognition.stop();
    } catch {
      // Ignore stop errors
    } finally {
      this.isListening = false;
    }
  }

  public get active(): boolean {
    return this.isListening;
  }
}

/**
 * Connects to user microphone and creates a real-time RMS energy meter.
 */
export async function startAudioEnergyMeter(
  stream: MediaStream
): Promise<AudioMeter> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtx();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  return {
    getEnergy: () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      return Math.min(1.0, avg / 128.0);
    },
    stop: () => {
      try {
        source.disconnect();
        analyser.disconnect();
        if (audioCtx.state !== "closed") {
          audioCtx.close();
        }
      } catch {
        // Safe cleanup
      }
    },
  };
}

/**
 * WebSocket streaming bridge for live conversational dialog with Gemini 2.5 Flash Native Audio.
 */
export class GeminiAudioWebSocketClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private isConnected = false;
  private callbacks: {
    onReady?: (sessionId: string) => void;
    onDeltaText?: (text: string) => void;
    onAudioChunk?: (pcmBytes: ArrayBuffer) => void;
    onError?: (error: string) => void;
    onClose?: () => void;
  };

  constructor(callbacks: {
    onReady?: (sessionId: string) => void;
    onDeltaText?: (text: string) => void;
    onAudioChunk?: (pcmBytes: ArrayBuffer) => void;
    onError?: (error: string) => void;
    onClose?: () => void;
  }) {
    this.callbacks = callbacks;
  }

  public connect(apiKey: string, astronautId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/assistant/ws/audio`;

      try {
        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = "arraybuffer";

        this.ws.onopen = () => {
          this.isConnected = true;
          this.ws?.send(
            JSON.stringify({
              type: "init",
              api_key: apiKey,
              astronaut_id: astronautId,
              sample_rate_hz: 16000,
            })
          );
        };

        this.ws.onmessage = (event) => {
          if (typeof event.data === "string") {
            try {
              const payload = JSON.parse(event.data);
              if (payload.type === "ready") {
                this.callbacks.onReady?.(payload.session_id);
                resolve();
              } else if (payload.type === "delta_text") {
                this.callbacks.onDeltaText?.(payload.text);
              } else if (payload.type === "error") {
                this.callbacks.onError?.(payload.message);
              }
            } catch {
              // Ignore non-JSON strings
            }
          } else if (event.data instanceof ArrayBuffer) {
            this.callbacks.onAudioChunk?.(event.data);
            this.playPcmChunk(event.data);
          }
        };

        this.ws.onerror = () => {
          this.callbacks.onError?.("WebSocket audio connection failed");
          reject(new Error("WebSocket audio connection error"));
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.callbacks.onClose?.();
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  public sendText(text: string): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({ type: "text_query", text }));
    }
  }

  public sendAudioChunk(pcmChunk: ArrayBuffer): void {
    if (this.ws && this.isConnected) {
      this.ws.send(pcmChunk);
    }
  }

  private playPcmChunk(pcmData: ArrayBuffer): void {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioCtx({ sampleRate: 24000 });
      }
      const int16Array = new Int16Array(pcmData);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }
      const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();
    } catch {
      // Audio playback best-effort
    }
  }

  public disconnect(): void {
    if (this.ws) {
      try {
        this.ws.send(JSON.stringify({ type: "close" }));
        this.ws.close();
      } catch {
        // Safe close
      }
      this.ws = null;
      this.isConnected = false;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

/**
 * Checks if browser supports SpeechSynthesis API.
 */
export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Sanitizes markdown, tables, and raw code tokens for pleasant, natural voice playback.
 */
export function cleanTextForVoice(markdownText: string): string {
  if (!markdownText) return "";

  let cleaned = markdownText;

  // Remove markdown images and links: [Text](URL) -> Text
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]*\)/g, "");
  cleaned = cleaned.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Remove code blocks and inline code
  cleaned = cleaned.replace(/```[\s\S]*?```/g, "Code block omitted.");
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");

  // Remove Markdown table divider rows |---|---| or | :--- | :--- |
  cleaned = cleaned.replace(/^\s*\|?[\s-:]+\|[\s-:|]*$/gm, "");
  // Replace remaining table pipes with commas/spaces
  cleaned = cleaned.replace(/\|/g, ", ");

  // Remove headers (#, ##, ###)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");

  // Remove bold/italics markers (*, **, _, __)
  cleaned = cleaned.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1");

  // Remove bullet points / dashes at start of lines
  cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, "");
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, "");

  // Clean excessive whitespace, double commas, and newlines
  cleaned = cleaned.replace(/,\s*,/g, ",");
  cleaned = cleaned.replace(/\n{2,}/g, ". ");
  cleaned = cleaned.replace(/\n/g, " ");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  return cleaned;
}

export type VoicePersona = "nova" | "orion" | "athena" | "capcom" | "custom";

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  persona?: VoicePersona;
  voiceName?: string | null;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

let cachedVoices: SpeechSynthesisVoice[] = [];

/**
 * Returns available system voices, ensuring cache hydration.
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  if (cachedVoices.length === 0) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
  return cachedVoices;
}

// Pre-hydrate cache when voices change asynchronously in Chromium / WebKit
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

/**
 * Resolves the optimal voice and acoustics profile for a given persona.
 */
export function resolveVoiceForPersona(
  persona: VoicePersona = "nova",
  explicitVoiceName?: string | null
): { voice: SpeechSynthesisVoice | null; defaultPitch: number; defaultRate: number } {
  const voices = getAvailableVoices();
  if (voices.length === 0) {
    return { voice: null, defaultPitch: 1.0, defaultRate: 1.05 };
  }

  // Explicit voice name override
  if (explicitVoiceName) {
    const match = voices.find((v) => v.name === explicitVoiceName);
    if (match) {
      return { voice: match, defaultPitch: 1.0, defaultRate: 1.05 };
    }
  }

  const enVoices = voices.filter((v) => v.lang.startsWith("en"));
  const pool = enVoices.length > 0 ? enVoices : voices;

  switch (persona) {
    case "nova": {
      // Warm, natural female voice
      const match =
        pool.find(
          (v) =>
            (v.name.includes("Natural") &&
              (v.name.includes("Jenny") || v.name.includes("Aria") || v.name.includes("Female"))) ||
            v.name.includes("Samantha") ||
            v.name.includes("Jenny") ||
            v.name.includes("Aria") ||
            v.name.includes("Zira") ||
            v.name.includes("Victoria") ||
            v.name.includes("Karen") ||
            (v.name.includes("Google") && !v.name.toLowerCase().includes("male"))
        ) ||
        pool.find(
          (v) =>
            !v.name.toLowerCase().includes("male") &&
            !v.name.includes("David") &&
            !v.name.includes("Mark") &&
            !v.name.includes("Guy") &&
            !v.name.includes("Ryan")
        );
      return {
        voice: match || pool[0] || null,
        defaultPitch: 1.06,
        defaultRate: 1.02,
      };
    }

    case "orion": {
      // Calm, grounded, confident male voice
      const match = pool.find(
        (v) =>
          (v.name.includes("Natural") &&
            (v.name.includes("Guy") || v.name.includes("Ryan") || v.name.includes("Male"))) ||
          v.name.includes("Guy") ||
          v.name.includes("Ryan") ||
          v.name.includes("David") ||
          v.name.includes("Mark") ||
          (v.name.includes("Google") && v.name.includes("Male"))
      );
      return {
        voice: match || pool[0] || null,
        defaultPitch: 0.92,
        defaultRate: 1.0,
      };
    }

    case "athena": {
      // Refined British / European clear clinical tone
      const match = pool.find(
        (v) =>
          v.lang.includes("GB") ||
          v.name.includes("UK") ||
          v.name.includes("George") ||
          v.name.includes("Hazel") ||
          v.name.includes("Susan") ||
          v.name.includes("Oliver") ||
          v.name.includes("Stephanie")
      );
      return {
        voice: match || pool[0] || null,
        defaultPitch: 1.0,
        defaultRate: 1.04,
      };
    }

    case "capcom": {
      // Tactical spaceflight flight loop voice
      const match = pool.find(
        (v) =>
          v.name.includes("Guy") ||
          v.name.includes("David") ||
          v.name.includes("Male")
      );
      return {
        voice: match || pool[0] || null,
        defaultPitch: 0.88,
        defaultRate: 1.10,
      };
    }

    default:
      return { voice: pool[0] || null, defaultPitch: 1.0, defaultRate: 1.05 };
  }
}

let activeSpeechUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Procedurally plays Apollo/ISS Quindar communication beeps using the Web Audio API.
 * Intro beep: 2525 Hz for 250ms
 * Outro beep: 2475 Hz for 250ms
 */
export function playQuindarTone(type: "intro" | "outro" = "intro", volume = 0.08): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const frequency = type === "intro" ? 2525 : 2475;
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Smooth envelope attack and release
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
    gain.gain.setValueAtTime(volume, ctx.currentTime + 0.22);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);

    setTimeout(() => {
      try {
        if (ctx.state !== "closed") ctx.close();
      } catch {
        // Safe close
      }
    }, 400);
  } catch {
    // Audio best-effort
  }
}

/**
 * Procedurally plays a subtle radio comms chirp for push-to-talk button clicks.
 */
export function playCommsChirp(volume = 0.05): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);

    setTimeout(() => {
      try {
        if (ctx.state !== "closed") ctx.close();
      } catch {
        // Safe close
      }
    }, 200);
  } catch {
    // Best-effort
  }
}

/**
 * Synthesizes speech using the browser SpeechSynthesis engine.
 */
export function speakText(text: string, options: SpeakOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) {
      options.onError?.(new Error("Speech synthesis not supported"));
      resolve();
      return;
    }

    cancelSpeech();

    const clean = cleanTextForVoice(text);
    if (!clean) {
      resolve();
      return;
    }

    const { voice, defaultPitch, defaultRate } = resolveVoiceForPersona(
      options.persona ?? "nova",
      options.voiceName
    );

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = options.rate ?? defaultRate;
    utterance.pitch = options.pitch ?? defaultPitch;
    utterance.volume = options.volume ?? 1.0;

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      activeSpeechUtterance = utterance;
      options.onStart?.();
    };

    utterance.onend = () => {
      activeSpeechUtterance = null;
      options.onEnd?.();
      resolve();
    };

    utterance.onerror = (err) => {
      activeSpeechUtterance = null;
      options.onError?.(err);
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Instantly stops/cancels ongoing speech synthesis.
 */
export function cancelSpeech(): void {
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel();
      activeSpeechUtterance = null;
    } catch {
      // Safe cancel
    }
  }
}

/**
 * Checks if speech is currently being actively synthesized.
 */
export function isCurrentlySpeaking(): boolean {
  if (!isSpeechSynthesisSupported()) return false;
  return window.speechSynthesis.speaking;
}
