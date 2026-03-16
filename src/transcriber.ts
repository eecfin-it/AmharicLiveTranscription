import { EventEmitter } from "events";
import { SpeechClient, protos } from "@google-cloud/speech";
import { record, Recording } from "node-record-lpcm16";
import { Writable } from "stream";

const STREAM_LIMIT_MS = 4.5 * 60 * 1000; // 4.5 minutes — restart before Google's 5-min cap

type AudioEncoding =
  protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding;

export interface TranscriberConfig {
  languageCode: string;
  sampleRateHertz?: number;
  speechContexts?: Array<{ phrases: string[]; boost?: number }>;
}

export declare interface Transcriber {
  on(event: "interim", listener: (text: string) => void): this;
  on(event: "final", listener: (text: string) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  on(event: "stopped", listener: () => void): this;
}

export class Transcriber extends EventEmitter {
  private client: SpeechClient;
  private config: TranscriberConfig;
  private recording: Recording | null = null;
  private recognizeStream: Writable | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(config: TranscriberConfig) {
    super();
    this.client = new SpeechClient();
    this.config = config;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startRecording();
    this.startStream();
  }

  stop(): void {
    this.running = false;
    this.destroyStream();
    this.stopRecording();
    this.emit("stopped");
  }

  /* ── mic ─────────────────────────────────────────────── */

  private startRecording(): void {
    this.recording = record({
      sampleRateHertz: this.config.sampleRateHertz ?? 16000,
      threshold: 0,
      silence: "10.0", // never auto-stop
      recordProgram: "sox",
      endOnSilence: false,
    });
  }

  private stopRecording(): void {
    if (this.recording) {
      this.recording.stop();
      this.recording = null;
    }
  }

  /* ── STT stream ──────────────────────────────────────── */

  private startStream(): void {
    const request = {
      config: {
        encoding: "LINEAR16" as unknown as AudioEncoding,
        sampleRateHertz: this.config.sampleRateHertz ?? 16000,
        languageCode: this.config.languageCode,
        model: "latest_long",
        useEnhanced: true,
        enableAutomaticPunctuation: true,
        speechContexts: this.config.speechContexts ?? [],
      },
      interimResults: true,
    };

    this.recognizeStream = this.client
      .streamingRecognize(request)
      .on("data", (response: any) => {
        const result = response.results?.[0];
        if (!result?.alternatives?.[0]) return;
        const transcript: string = result.alternatives[0].transcript;
        if (result.isFinal) {
          this.emit("final", transcript);
        } else {
          this.emit("interim", transcript);
        }
      })
      .on("error", (err: any) => {
        // gRPC code 11 = OUT_OF_RANGE — Google forces a stream reset
        if (err.code === 11 && this.running) {
          this.restart();
        } else {
          this.emit("error", err);
        }
      });

    // Pipe mic audio into the STT stream
    if (this.recording) {
      this.recording.stream().pipe(this.recognizeStream as any);
    }

    // Schedule a proactive restart before the 5-min hard limit
    this.restartTimer = setTimeout(() => {
      if (this.running) this.restart();
    }, STREAM_LIMIT_MS);
  }

  private destroyStream(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.recognizeStream) {
      this.recognizeStream.removeAllListeners();
      this.recognizeStream.destroy();
      this.recognizeStream = null;
    }
  }

  private restart(): void {
    this.destroyStream();
    // Mic stays running — only the STT stream is recycled
    this.startStream();
  }
}
