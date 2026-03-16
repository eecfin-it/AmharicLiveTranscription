declare module "node-record-lpcm16" {
  import { Readable } from "stream";

  interface RecordingOptions {
    sampleRateHertz?: number;
    threshold?: number;
    silence?: string;
    recordProgram?: string;
    endOnSilence?: boolean;
  }

  interface Recording {
    stream(): Readable;
    stop(): void;
  }

  function record(options?: RecordingOptions): Recording;

  export { record, Recording, RecordingOptions };
}
