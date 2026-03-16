/**
 * TextFormatter — chunks Amharic (or any space-separated) text into
 * display-friendly lines for a lower-third overlay.
 *
 * Amharic uses Ethiopic script but is space-separated like Latin text,
 * so word splitting on " " works correctly.
 */
export declare class TextFormatter {
    private wordsPerLine;
    private buffer;
    constructor(wordsPerLine?: number);
    /**
     * Interim display — show the last N words on a single line.
     * Called rapidly as Google returns interim results.
     */
    interim(text: string): string;
    /**
     * Commit a final result and return the last 2 lines (N words each)
     * built from the accumulated buffer.
     */
    update(text: string): string;
    /** Reset the accumulated buffer. */
    clear(): void;
}
//# sourceMappingURL=formatter.d.ts.map