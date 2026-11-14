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

  constructor(
    private callbacks: {
      onReady?: (sessionId: string) => void;
      onDeltaText?: (text: string) => void;
      onAudioChunk?: (pcmBytes: ArrayBuffer) => void;
      onError?: (error: string) => void;
      onClose?: () => void;
    }
  ) {}

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
