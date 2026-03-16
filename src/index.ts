import "dotenv/config";
import { Transcriber } from "./transcriber";
import { ProPresenter } from "./propresenter";
import { TextFormatter } from "./formatter";

/* ── env helpers ───────────────────────────────────────── */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`ERROR: Missing required environment variable: ${name}`);
    console.error(`       Copy .env.example to .env and fill in all values.`);
    process.exit(1);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

/* ── config ────────────────────────────────────────────── */

const PROPRESENTER_BASE_URL = requireEnv("PROPRESENTER_BASE_URL");
const PROPRESENTER_MESSAGE_NAME = optionalEnv(
  "PROPRESENTER_MESSAGE_NAME",
  "Amharic Live Transcription API"
);
const PROPRESENTER_THEME_SLIDE = optionalEnv(
  "PROPRESENTER_THEME_SLIDE",
  "Lower 3rd Lyrics"
);
const WORDS_PER_LINE = parseInt(optionalEnv("WORDS_PER_LINE", "8"), 10);
const CLEAR_AFTER_SILENCE_MS = parseInt(
  optionalEnv("CLEAR_AFTER_SILENCE_MS", "4000"),
  10
);
const LANGUAGE_CODE = optionalEnv("LANGUAGE_CODE", "am-ET");

/* ── banner ────────────────────────────────────────────── */

console.log(`
╔══════════════════════════════════════════════╗
║        Amharic Live Transcriber              ║
╠══════════════════════════════════════════════╣
║  ProPresenter : ${PROPRESENTER_BASE_URL.slice(0, 27).padEnd(27)}║
║  Message      : ${PROPRESENTER_MESSAGE_NAME.slice(0, 27).padEnd(27)}║
║  Theme Slide  : ${PROPRESENTER_THEME_SLIDE.slice(0, 27).padEnd(27)}║
║  Language      : ${LANGUAGE_CODE.padEnd(26)}║
║  Words/Line    : ${String(WORDS_PER_LINE).padEnd(26)}║
║  Silence Clear : ${String(CLEAR_AFTER_SILENCE_MS).padEnd(23)} ms ║
╚══════════════════════════════════════════════╝
`);

/* ── components ────────────────────────────────────────── */

const pro = new ProPresenter({
  baseUrl: PROPRESENTER_BASE_URL,
  messageName: PROPRESENTER_MESSAGE_NAME,
  themeSlideName: PROPRESENTER_THEME_SLIDE,
});

const formatter = new TextFormatter(WORDS_PER_LINE);

const transcriber = new Transcriber({
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

let silenceTimer: ReturnType<typeof setTimeout> | null = null;

function resetSilenceTimer(): void {
  if (silenceTimer) clearTimeout(silenceTimer);
  silenceTimer = setTimeout(async () => {
    console.log("[silence] Clearing lower-third");
    formatter.clear();
    try {
      await pro.clearText();
    } catch {
      // ProPresenter may be unreachable — ignore
    }
  }, CLEAR_AFTER_SILENCE_MS);
}

/* ── event wiring ──────────────────────────────────────── */

transcriber.on("interim", async (text: string) => {
  const display = formatter.interim(text);
  resetSilenceTimer();
  try {
    await pro.showText(display);
  } catch {
    // swallow — will retry on next event
  }
  process.stdout.write(`\r[interim] ${display}  `);
});

transcriber.on("final", async (text: string) => {
  const display = formatter.update(text);
  resetSilenceTimer();
  try {
    await pro.showText(display);
  } catch {
    // swallow
  }
  console.log(`\n[final]   ${display}`);
});

transcriber.on("error", (err: Error) => {
  console.error("[error]  ", err.message);
});

transcriber.on("stopped", () => {
  console.log("[stopped] Transcriber stopped");
});

/* ── graceful shutdown ─────────────────────────────────── */

async function shutdown(): Promise<void> {
  console.log("\nShutting down…");
  transcriber.stop();
  if (silenceTimer) clearTimeout(silenceTimer);
  try {
    await pro.clearText();
  } catch {
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
  } catch (err: any) {
    console.warn(`[warn] Could not reach ProPresenter at ${PROPRESENTER_BASE_URL}`);
    console.warn(`       ${err.message}`);
    console.warn("       Continuing anyway — will retry on each push.\n");
  }

  // Find or create the message in ProPresenter
  try {
    const result = await pro.ensureMessage();
    const verb = result.created ? "Created" : "Found";
    console.log(
      `[ok] ${verb} message "${result.messageName}" (${result.messageId})` +
        (result.themeName ? `, theme: "${result.themeName}"` : "")
    );
  } catch (err: any) {
    console.error(`[error] Could not ensure message: ${err.message}`);
    console.error("        Create the message manually in ProPresenter.");
    process.exit(1);
  }

  console.log("[mic] Starting microphone capture (SoX)…");
  transcriber.start();
  console.log("[live] Listening for Amharic speech…\n");
})();
