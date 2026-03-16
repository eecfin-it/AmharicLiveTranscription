# Amharic Live Transcriber

Real-time Amharic speech transcription displayed as a lower-third overlay in ProPresenter 7.9+.

## How It Works

```
Microphone (SoX)  →  Google Cloud STT  →  Text Formatter  →  ProPresenter
  16kHz PCM            am-ET streaming      Word wrapping       Lower-third
                       Interim + Final       2-line display      via HTTP API
```

1. **Mic** captures audio via SoX as 16kHz PCM
2. **Google Cloud Speech-to-Text** streams Amharic transcription (interim + final results). Auto-restarts every 4.5 min before Google's 5-min limit.
3. **Formatter** wraps text into display lines (configurable words per line)
4. **ProPresenter** receives text via HTTP API — message is auto-created with a theme on first run
5. **Silence timer** clears the lower-third after configurable idle period

## Prerequisites

- Node.js 18+
- SoX (`brew install sox` on macOS)
- Google Cloud service account with Speech-to-Text API enabled
- ProPresenter 7.9+ with Network API enabled (Preferences → Network)

## Setup

```bash
npm install
cp .env.example .env
```

Place your Google Cloud JSON key as `google-credentials.json` in the project root, then edit `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Google JSON key | `./google-credentials.json` |
| `PROPRESENTER_BASE_URL` | ProPresenter API URL | `http://127.0.0.1:1025` |
| `PROPRESENTER_MESSAGE_NAME` | Message name (auto-created) | `Amharic Live Transcription API` |
| `PROPRESENTER_THEME_SLIDE` | Theme slide name | `Lower 3rd Lyrics` |
| `WORDS_PER_LINE` | Words per display line | `8` |
| `CLEAR_AFTER_SILENCE_MS` | Silence before clearing | `4000` |
| `LANGUAGE_CODE` | BCP-47 language code | `am-ET` |

## Usage

```bash
npm run dev       # development (ts-node)
npm run build     # compile
npm start         # production (node)
```

## Speech Contexts

Amharic theological terms are boosted for recognition accuracy. Edit `speechContexts` in `src/index.ts` to add your own:

ኢየሱስ, ክርስቶስ, እግዚአብሔር, መስቀል, ትንሣኤ, ወንጌል, መንፈስ ቅዱስ, ጸሎት, ቤተ ክርስቲያን, መዝሙር

## Font Recommendation

Install **Noto Sans Ethiopic** or **Abyssinica SIL** on the ProPresenter machine for proper Ge'ez script rendering.

## License

MIT
