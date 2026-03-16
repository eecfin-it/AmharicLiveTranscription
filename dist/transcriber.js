"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transcriber = void 0;
const events_1 = require("events");
const speech_1 = require("@google-cloud/speech");
const node_record_lpcm16_1 = require("node-record-lpcm16");
const STREAM_LIMIT_MS = 4.5 * 60 * 1000; // 4.5 minutes — restart before Google's 5-min cap
class Transcriber extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.recording = null;
        this.recognizeStream = null;
        this.restartTimer = null;
        this.running = false;
        this.client = new speech_1.SpeechClient();
        this.config = config;
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        this.startRecording();
        this.startStream();
    }
    stop() {
        this.running = false;
        this.destroyStream();
        this.stopRecording();
        this.emit("stopped");
    }
    /* ── mic ─────────────────────────────────────────────── */
    startRecording() {
        this.recording = (0, node_record_lpcm16_1.record)({
            sampleRateHertz: this.config.sampleRateHertz ?? 16000,
            threshold: 0,
            silence: "10.0", // never auto-stop
            recordProgram: "sox",
            endOnSilence: false,
        });
    }
    stopRecording() {
        if (this.recording) {
            this.recording.stop();
            this.recording = null;
        }
    }
    /* ── STT stream ──────────────────────────────────────── */
    startStream() {
        const request = {
            config: {
                encoding: "LINEAR16",
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
            .on("data", (response) => {
            const result = response.results?.[0];
            if (!result?.alternatives?.[0])
                return;
            const transcript = result.alternatives[0].transcript;
            if (result.isFinal) {
                this.emit("final", transcript);
            }
            else {
                this.emit("interim", transcript);
            }
        })
            .on("error", (err) => {
            // gRPC code 11 = OUT_OF_RANGE — Google forces a stream reset
            if (err.code === 11 && this.running) {
                this.restart();
            }
            else {
                this.emit("error", err);
            }
        });
        // Pipe mic audio into the STT stream
        if (this.recording) {
            this.recording.stream().pipe(this.recognizeStream);
        }
        // Schedule a proactive restart before the 5-min hard limit
        this.restartTimer = setTimeout(() => {
            if (this.running)
                this.restart();
        }, STREAM_LIMIT_MS);
    }
    destroyStream() {
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
    restart() {
        this.destroyStream();
        // Mic stays running — only the STT stream is recycled
        this.startStream();
    }
}
exports.Transcriber = Transcriber;
//# sourceMappingURL=transcriber.js.map