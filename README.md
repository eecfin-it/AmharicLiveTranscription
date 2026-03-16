# Amharic Live Transcriber

Real-time Amharic speech transcription displayed as a lower-third overlay in ProPresenter 7.9+ via its HTTP API.

**Pipeline:** Microphone (SoX) → Google Cloud Speech-to-Text → Text Formatter → ProPresenter HTTP API

## Prerequisites

- **Node.js** 18+
- **SoX** — audio capture from microphone

  ```bash
  # macOS
  brew install sox

  # Ubuntu/Debian
  sudo apt install sox libsox-fmt-all
  ```

- **Google Cloud Speech-to-Text** — a service account with the Speech-to-Text API enabled
- **ProPresenter 7.9+** — with Network API enabled (Preferences → Network)

## Setup

1. **Clone and install**

   ```bash
   git clone <repo-url> && cd amharic-transcriber
   npm install
   ```

2. **Google Cloud credentials**

   - Create a service account in the [Google Cloud Console](https://console.cloud.google.com/)
   - Enable the **Cloud Speech-to-Text API**
   - Download the JSON key file and save it as `google-credentials.json` in the project root

3. **Enable ProPresenter Network API**

   - Open ProPresenter → Preferences → Network
   - Enable the Network API and note the port (default: `1025`)

4. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env`:

   | Variable | Description | Default |
   |----------|-------------|---------|
   | `GOOGLE_APPLICATION_CREDENTIALS` | Path to your Google JSON key file | `./google-credentials.json` |
   | `PROPRESENTER_BASE_URL` | ProPresenter API base URL | `http://127.0.0.1:1025` |
   | `PROPRESENTER_MESSAGE_NAME` | Name of the message (auto-created if missing) | `Amharic Live Transcription API` |
   | `PROPRESENTER_THEME_SLIDE` | Theme slide name to apply (looked up from all themes) | `Lower 3rd Lyrics` |
   | `WORDS_PER_LINE` | Max words per display line | `8` |
   | `CLEAR_AFTER_SILENCE_MS` | Clear text after N ms of silence | `4000` |
   | `LANGUAGE_CODE` | BCP-47 language code | `am-ET` |

## Usage

```bash
# Development (ts-node)
npm run dev

# Production
npm run build
npm start
```

On startup the app will:
1. Connect to ProPresenter and verify the API is reachable
2. Find or **auto-create** the message by `PROPRESENTER_MESSAGE_NAME`
3. Look up the theme slide by `PROPRESENTER_THEME_SLIDE` and apply it to the message
4. Start capturing audio from the default microphone via SoX
5. Stream audio to Google Cloud Speech-to-Text and push transcriptions to ProPresenter in real time

## How It Works

```
Microphone (16 kHz PCM via SoX)
  │
  ▼
Google Cloud Speech-to-Text (streaming, am-ET)
  │  interim results ──▶ formatter.interim() ──▶ ProPresenter showText()
  │  final results   ──▶ formatter.update()  ──▶ ProPresenter showText()
  │
  ▼
Silence timer (configurable) ──▶ ProPresenter clearText()
```

- **Interim results** update rapidly as speech is recognized (single line, last N words)
- **Final results** are committed to a rolling buffer and displayed as up to 2 lines
- After a configurable silence period, the lower-third is cleared
- The STT stream auto-restarts every 4.5 minutes (before Google's 5-minute limit)
- Reconnects automatically on gRPC stream-reset errors (code 11)
- Graceful shutdown on SIGINT/SIGTERM: stops mic, clears ProPresenter

## ProPresenter API Details

The app uses ProPresenter's HTTP API (tested on 7.15):

| Action | Method | Endpoint |
|--------|--------|----------|
| List messages | `GET` | `/v1/messages` |
| Create message | `POST` | `/v1/messages` |
| Update message text | `PUT` | `/v1/message/{uuid}` |
| Trigger message | `POST` | `/v1/message/{uuid}/trigger` |
| Clear message | `GET` | `/v1/message/{uuid}/clear` |
| List themes | `GET` | `/v1/themes` |
| Check version | `GET` | `/version` |

The message text is updated via PUT on every transcription event, then triggered to display. No manual message UUID or token setup is needed — the app handles everything.

## Available Theme Slides

To change the lower-third style, set `PROPRESENTER_THEME_SLIDE` in `.env` to any slide name from your ProPresenter themes. Common options from stock themes:

| Slide Name | Style |
|------------|-------|
| `Lower 3rd Lyrics` | Dark lower-third bar (Black theme) |
| `Lower 3rd Presentation Point` | Styled lower-third with accent |
| `Lower 3rd Scripture` | Scripture-formatted lower-third |
| `Two Lines` | Full-width two-line overlay |
| `Lyrics` | Full-screen lyrics style |

Browse all available slides: `curl http://localhost:1025/v1/themes | python3 -m json.tool`

## Custom Amharic Vocabulary (Speech Contexts)

Google Speech-to-Text supports **speech contexts** — hint phrases that boost recognition accuracy for domain-specific words. The app ships with common Amharic theological terms:

| Amharic | English |
|---------|---------|
| ኢየሱስ | Jesus |
| ክርስቶስ | Christ |
| እግዚአብሔር | God |
| መስቀል | Cross |
| ትንሣኤ | Resurrection |
| ወንጌል | Gospel |
| መንፈስ ቅዱስ | Holy Spirit |
| ጸሎት | Prayer |
| ቤተ ክርስቲያን | Church |
| መዝሙር | Hymn/Psalm |

To add your own terms, edit the `speechContexts` array in `src/index.ts`.

## ProPresenter Font Recommendation

For best rendering of Ge'ez (Ethiopic) script in ProPresenter, install one of:

- **Noto Sans Ethiopic** — [Google Fonts](https://fonts.google.com/noto/specimen/Noto+Sans+Ethiopic)
- **Abyssinica SIL** — [SIL International](https://software.sil.org/abyssinica/)

Install the font on the ProPresenter machine, then select it in your message's theme text properties.

## Project Structure

```
src/
├── index.ts         — entry point, env config, event wiring, silence timer
├── transcriber.ts   — Google Cloud STT streaming client with auto-restart
├── propresenter.ts  — ProPresenter HTTP API client (message CRUD, trigger, clear)
├── formatter.ts     — chunks Amharic text into display lines
└── types.d.ts       — type declarations for node-record-lpcm16
```

## Troubleshooting

- **"Could not reach ProPresenter"** — Ensure ProPresenter is running and the Network API is enabled in Preferences → Network. Verify the port matches `PROPRESENTER_BASE_URL`.
- **No audio / "spawn sox ENOENT"** — Install SoX: `brew install sox` (macOS) or `sudo apt install sox` (Linux).
- **"Invalid recognition config"** — The `default` STT model is used for `am-ET`. If you change `LANGUAGE_CODE`, the model may need adjusting in `src/transcriber.ts`.
- **English words in transcription** — Google STT for Amharic may produce some English when ambient noise is present. Speak clearly and close to the microphone for best results.
- **Stream restarts** — The STT stream auto-restarts every 4.5 minutes. This is normal and seamless — the mic stays active.

## License

MIT
