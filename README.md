# Amharic Live Transcriber

Real-time Amharic speech transcription displayed as a lower-third overlay in ProPresenter 7.9+ via its HTTP API.

## Overview

This application captures live audio from a microphone, sends it to Google Cloud Speech-to-Text for Amharic transcription, formats the recognized text into display-friendly lines, and pushes it to ProPresenter as a lower-third message overlay — all in real time. It is designed for live church services, conferences, or any event where Amharic speech needs to be transcribed and displayed on screen.

### How the Pipeline Works

```
┌─────────────┐     ┌──────────────────────┐     ┌───────────────┐     ┌──────────────┐
│  Microphone  │────▶│  Google Cloud STT     │────▶│  Text          │────▶│ ProPresenter  │
│  (SoX)       │     │  (Streaming API)      │     │  Formatter     │     │ (HTTP API)    │
└─────────────┘     └──────────────────────┘     └───────────────┘     └──────────────┘
   16kHz PCM            am-ET language              Word wrapping         Lower-third
   audio stream         Interim + Final results     2-line display        on screen
```

#### Stage 1: Microphone Capture (SoX)

The app uses [node-record-lpcm16](https://www.npmjs.com/package/node-record-lpcm16) with [SoX](https://sox.sourceforge.net/) to capture raw audio from the system's default microphone. Audio is recorded as **16-bit Linear PCM at 16kHz** — the format Google Cloud Speech-to-Text expects. The mic stream runs continuously and is never stopped during STT stream restarts, ensuring zero audio gaps.

#### Stage 2: Google Cloud Speech-to-Text (Streaming)

The raw PCM audio is piped into Google Cloud's `streamingRecognize` API configured for Amharic (`am-ET`). The API returns two types of results:

- **Interim results** — partial transcriptions that update rapidly as speech is recognized. These give the audience a sense of real-time captioning, even before a sentence is complete.
- **Final results** — confirmed transcriptions that won't change. These are committed to a buffer for display.

Key behaviors:
- **Auto-restart**: Google enforces a 5-minute limit on streaming sessions. The app proactively restarts the stream every 4.5 minutes, seamlessly reconnecting without dropping audio.
- **Error recovery**: On gRPC `OUT_OF_RANGE` errors (code 11, Google's stream reset), the app automatically reconnects.
- **Speech contexts**: The app sends hint phrases (Amharic theological vocabulary) to boost recognition accuracy for domain-specific words like ኢየሱስ (Jesus), ክርስቶስ (Christ), and እግዚአብሔር (God).

#### Stage 3: Text Formatter

The formatter takes raw transcription text and prepares it for display on screen:

- **Interim mode**: Shows the last N words (configurable via `WORDS_PER_LINE`) on a single line. This updates rapidly to show what's being said right now.
- **Final mode**: Commits words to a rolling buffer and displays the last 2 lines of N words each. This creates a stable, readable lower-third.
- Amharic (Ge'ez script) is space-separated like Latin text, so standard word splitting works correctly.

#### Stage 4: ProPresenter HTTP API

The formatted text is pushed to ProPresenter's HTTP API on every transcription event:

1. **PUT** `/v1/message/{uuid}` — updates the message body with the new transcript text
2. **POST** `/v1/message/{uuid}/trigger` — triggers the message to display on screen

When silence is detected (no speech for `CLEAR_AFTER_SILENCE_MS`), the app calls **GET** `/v1/message/{uuid}/clear` to remove the lower-third from screen.

On first startup, the app automatically:
- Creates the message in ProPresenter if it doesn't exist (by `PROPRESENTER_MESSAGE_NAME`)
- Looks up the configured theme slide by name (e.g. "Lower 3rd Lyrics") from all available themes
- Applies the theme to the message

No manual UUID copying or token setup is needed.

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

### 1. Clone and install

```bash
git clone <repo-url> && cd amharic-transcriber
npm install
```

### 2. Google Cloud credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable the **Cloud Speech-to-Text API**:
   - Navigate to APIs & Services → Library
   - Search for "Cloud Speech-to-Text API"
   - Click **Enable**
4. Create a service account:
   - Navigate to IAM & Admin → Service Accounts
   - Click **Create Service Account**
   - Give it a name (e.g. "amharic-transcriber")
   - Grant the role **Cloud Speech Client**
5. Generate a key:
   - Click on the service account → Keys → Add Key → Create new key → JSON
   - Download the JSON file and save it as `google-credentials.json` in the project root

### 3. Enable ProPresenter Network API

1. Open ProPresenter → **Preferences → Network**
2. Enable the **Network** toggle
3. Note the port number (default: `1025`)
4. The API will be available at `http://<machine-ip>:<port>`

To verify, open a browser and go to `http://localhost:1025/version` — you should see a JSON response with your ProPresenter version.

### 4. Configure environment

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

### 5. Verify your setup

Test each component individually before running:

```bash
# Test SoX can record audio (Ctrl+C to stop)
sox -d -r 16000 -c 1 -b 16 test.wav

# Test Google credentials
node -e "const s = require('@google-cloud/speech'); new s.SpeechClient().initialize().then(() => console.log('OK'))"

# Test ProPresenter API
curl http://localhost:1025/version
```

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
6. Clear the lower-third after `CLEAR_AFTER_SILENCE_MS` of silence
7. On Ctrl+C: stop the mic, clear the lower-third, and exit cleanly

## ProPresenter API Reference

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

## Available Theme Slides

To change the lower-third style, set `PROPRESENTER_THEME_SLIDE` in `.env` to any slide name from your ProPresenter themes. Common options from stock themes:

| Slide Name | Style |
|------------|-------|
| `Lower 3rd Lyrics` | Dark lower-third bar (Black theme) |
| `Lower 3rd Presentation Point` | Styled lower-third with accent |
| `Lower 3rd Scripture` | Scripture-formatted lower-third |
| `Two Lines` | Full-width two-line overlay |
| `Lyrics` | Full-screen lyrics style |

Browse all available slides:

```bash
curl http://localhost:1025/v1/themes | python3 -m json.tool
```

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
├── propresenter.ts  — ProPresenter HTTP API client (message CRUD, trigger, clear, theme lookup)
├── formatter.ts     — chunks Amharic text into display lines (interim + final modes)
└── types.d.ts       — type declarations for node-record-lpcm16
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Could not reach ProPresenter" | Ensure ProPresenter is running and Network API is enabled in Preferences → Network. Verify the port matches `PROPRESENTER_BASE_URL`. |
| No audio / "spawn sox ENOENT" | Install SoX: `brew install sox` (macOS) or `sudo apt install sox` (Linux). |
| "Invalid recognition config" | The `default` STT model is used for `am-ET`. If you change `LANGUAGE_CODE`, the model may need adjusting in `src/transcriber.ts`. |
| English words in transcription | Google STT for Amharic may produce some English with ambient noise. Speak clearly and close to the microphone. Add more speech context hints. |
| Stream restarts every ~4.5 min | This is normal. Google enforces a 5-minute streaming limit. The app restarts seamlessly without audio loss. |
| Lower-third flickers | Reduce `WORDS_PER_LINE` or increase `CLEAR_AFTER_SILENCE_MS` to stabilize display updates. |
| Theme not applied | Verify the slide name in `PROPRESENTER_THEME_SLIDE` exactly matches a slide in your ProPresenter themes (case-sensitive). Run `curl http://localhost:1025/v1/themes` to list all available slides. |

## License

MIT
