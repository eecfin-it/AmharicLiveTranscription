import { EventEmitter } from "events";
export interface TranscriberConfig {
    languageCode: string;
    sampleRateHertz?: number;
    speechContexts?: Array<{
        phrases: string[];
        boost?: number;
    }>;
}
export declare interface Transcriber {
    on(event: "interim", listener: (text: string) => void): this;
    on(event: "final", listener: (text: string) => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: "stopped", listener: () => void): this;
}
export declare class Transcriber extends EventEmitter {
    private client;
    private config;
    private recording;
    private recognizeStream;
    private restartTimer;
    private running;
    constructor(config: TranscriberConfig);
    start(): void;
    stop(): void;
    private startRecording;
    private stopRecording;
    private startStream;
    private destroyStream;
    private restart;
}
//# sourceMappingURL=transcriber.d.ts.map