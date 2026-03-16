"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const transcriber_1 = require("./transcriber");
const propresenter_1 = require("./propresenter");
const formatter_1 = require("./formatter");
/* ── env helpers ───────────────────────────────────────── */
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        console.error(`ERROR: Missing required environment variable: ${name}`);
        console.error(`       Copy .env.example to .env and fill in all values.`);
        process.exit(1);
    }
    return value;
}
function optionalEnv(name, fallback) {
    return process.env[name] ?? fallback;
}
/* ── config ────────────────────────────────────────────── */
const PROPRESENTER_HOST = requireEnv("PROPRESENTER_HOST");
const PROPRESENTER_PORT = parseInt(requireEnv("PROPRESENTER_PORT"), 10);
const PROPRESENTER_MESSAGE_ID = requireEnv("PROPRESENTER_MESSAGE_ID");
const WORDS_PER_LINE = parseInt(optionalEnv("WORDS_PER_LINE", "8"), 10);
const CLEAR_AFTER_SILENCE_MS = parseInt(optionalEnv("CLEAR_AFTER_SILENCE_MS", "4000"), 10);
const LANGUAGE_CODE = optionalEnv("LANGUAGE_CODE", "am-ET");
/* ── banner ────────────────────────────────────────────── */
console.log(`
╔══════════════════════════════════════════════╗
║        Amharic Live Transcriber              ║
╠══════════════════════════════════════════════╣
║  ProPresenter : ${PROPRESENTER_HOST}:${String(PROPRESENTER_PORT).padEnd(27)}║
║  Message ID   : ${PROPRESENTER_MESSAGE_ID.slice(0, 27).padEnd(27)}║
║  Language      : ${LANGUAGE_CODE.padEnd(26)}║
║  Words/Line    : ${String(WORDS_PER_LINE).padEnd(26)}║
║  Silence Clear : ${String(CLEAR_AFTER_SILENCE_MS).padEnd(23)} ms ║
╚══════════════════════════════════════════════╝
`);
/* ── components ────────────────────────────────────────── */
const pro = new propresenter_1.ProPresenter({
    host: PROPRESENTER_HOST,
    port: PROPRESENTER_PORT,
    messageId: PROPRESENTER_MESSAGE_ID,
});
const formatter = new formatter_1.TextFormatter(WORDS_PER_LINE);
const transcriber = new transcriber_1.Transcriber({
    languageCode: LANGUAGE_CODE,
    speechContexts: [
        {
            phrases: [
                "ኢየሱስ",
                "ክርስቶስ",
                "እግዚአብሔር",
                "መስቀል",
                "ትንሣኤ",
                "ወንጌል",
                "መንፈስ ቅዱስ",
                "ጸሎት",
                "ቤተ ክርስቲያን",
                "መዝሙር",
            ],
            boost: 10,
        },
    ],
});
/* ── silence timer ─────────────────────────────────────── */
let silenceTimer = null;
function resetSilenceTimer() {
    if (silenceTimer)
        clearTimeout(silenceTimer);
    silenceTimer = setTimeout(async () => {
        console.log("[silence] Clearing lower-third");
        formatter.clear();
        try {
            await pro.clearText();
        }
        catch {
            // ProPresenter may be unreachable — ignore
        }
    }, CLEAR_AFTER_SILENCE_MS);
}
/* ── event wiring ──────────────────────────────────────── */
transcriber.on("interim", async (text) => {
    const display = formatter.interim(text);
    resetSilenceTimer();
    try {
        await pro.showText(display);
    }
    catch {
        // swallow — will retry on next event
    }
    process.stdout.write(`\r[interim] ${display}  `);
});
transcriber.on("final", async (text) => {
    const display = formatter.update(text);
    resetSilenceTimer();
    try {
        await pro.showText(display);
    }
    catch {
        // swallow
    }
    console.log(`\n[final]   ${display}`);
});
transcriber.on("error", (err) => {
    console.error("[error]  ", err.message);
});
transcriber.on("stopped", () => {
    console.log("[stopped] Transcriber stopped");
});
/* ── graceful shutdown ─────────────────────────────────── */
async function shutdown() {
    console.log("\nShutting down…");
    transcriber.stop();
    if (silenceTimer)
        clearTimeout(silenceTimer);
    try {
        await pro.clearText();
    }
    catch {
        // ignore
    }
    process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
/* ── start ─────────────────────────────────────────────── */
(async () => {
    // Connectivity check
    try {
        const version = await pro.ping();
        console.log(`[ok] ProPresenter connected — ${version}`);
    }
    catch (err) {
        console.warn(`[warn] Could not reach ProPresenter at ${PROPRESENTER_HOST}:${PROPRESENTER_PORT}`);
        console.warn(`       ${err.message}`);
        console.warn("       Continuing anyway — will retry on each push.\n");
    }
    console.log("[mic] Starting microphone capture (SoX)…");
    transcriber.start();
    console.log("[live] Listening for Amharic speech…\n");
})();
//# sourceMappingURL=index.js.map