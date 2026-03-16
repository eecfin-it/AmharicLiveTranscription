"use strict";
/**
 * TextFormatter — chunks Amharic (or any space-separated) text into
 * display-friendly lines for a lower-third overlay.
 *
 * Amharic uses Ethiopic script but is space-separated like Latin text,
 * so word splitting on " " works correctly.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextFormatter = void 0;
class TextFormatter {
    constructor(wordsPerLine = 8) {
        this.buffer = [];
        this.wordsPerLine = wordsPerLine;
    }
    /**
     * Interim display — show the last N words on a single line.
     * Called rapidly as Google returns interim results.
     */
    interim(text) {
        const words = text.trim().split(/\s+/).filter(Boolean);
        const tail = words.slice(-this.wordsPerLine);
        return tail.join(" ");
    }
    /**
     * Commit a final result and return the last 2 lines (N words each)
     * built from the accumulated buffer.
     */
    update(text) {
        const words = text.trim().split(/\s+/).filter(Boolean);
        this.buffer.push(...words);
        const maxWords = this.wordsPerLine * 2;
        const tail = this.buffer.slice(-maxWords);
        const line1 = tail.slice(0, this.wordsPerLine).join(" ");
        const line2 = tail.slice(this.wordsPerLine).join(" ");
        return line2 ? `${line1}\n${line2}` : line1;
    }
    /** Reset the accumulated buffer. */
    clear() {
        this.buffer = [];
    }
}
exports.TextFormatter = TextFormatter;
//# sourceMappingURL=formatter.js.map