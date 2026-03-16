# Amharic Live Transcriber

Real-time Amharic speech transcription displayed as lower-third text in ProPresenter 7.9+.

**Pipeline:** Microphone (SoX) → Google Cloud Speech-to-Text → Text Formatter → ProPresenter HTTP API

## Prerequisites

- **Node.js** 18+
- **SoX** — audio capture

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

   - Create a service account in the Google Cloud Console
   - Enable the Cloud Speech-to-Text API
   - Download the JSON key file and save it as `google-credentials.json` in the project root

3. **ProPresenter message UUID**

   - In ProPresenter, create a Message (or use an existing one) for the lower-third
   - Open ProPresenter's API at `http://localhost:1025/v1/messages` in a browser
   - Find your message and copy its `id` (UUID)

4. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and fill in:

   | Variable                       | Description                            |
   | ------------------------------ | -------------------------------------- |
   | `GOOGLE_APPLICATION_CREDENTIALS` | Path to your Google JSON key file      |
   | `PROPRESENTER_HOST`            | ProPresenter machine IP (default 127.0.0.1) |
   | `PROPRESENTER_PORT`            | ProPresenter API port (default 1025)   |
   | `PROPRESENTER_MESSAGE_ID`      | UUID of the target Message             |
   | `WORDS_PER_LINE`               | Max words per display line (default 8) |
   | `CLEAR_AFTER_SILENCE_MS`       | Clear text after N ms of silence (default 4000) |
   | `LANGUAGE_CODE`                | BCP-47 language code (default am-ET)   |

## Usage

```bash
# Development (ts-node)
npm run dev

# Production
npm run build
npm start
```

## Custom Amharic Vocabulary (Speech Contexts)

Google Speech-to-Text supports **speech contexts** — hint phrases that boost recognition accuracy for domain-specific words. The app ships with common Amharic theological terms:

```
ኢየሱስ    (Jesus)
ክርስቶስ    (Christ)
እግዚአብሔር  (God)
መስቀል     (Cross)
ትንሣኤ     (Resurrection)
ወንጌል     (Gospel)
መንፈስ ቅዱስ (Holy Spirit)
ጸሎት      (Prayer)
ቤተ ክርስቲያን (Church)
መዝሙር     (Hymn/Psalm)
```

To add your own terms, edit the `speechContexts` array in `src/index.ts`.

## ProPresenter Font Recommendation

For best rendering of Ge'ez (Ethiopic) script in ProPresenter, use:

- **Noto Sans Ethiopic** — [Google Fonts](https://fonts.google.com/noto/specimen/Noto+Sans+Ethiopic)
- **Abyssinica SIL** — [SIL International](https://software.sil.org/abyssinica/)

Install the font on the ProPresenter machine, then select it in your Message template's text properties.

## Architecture

```
Microphone (16 kHz PCM via SoX)
  │
  ▼
Google Cloud Speech-to-Text (streaming, am-ET)
  │  interim results ──▶ formatter.interim() ──▶ ProPresenter showText()
  │  final results   ──▶ formatter.update()  ──▶ ProPresenter showText()
  │
  ▼
Silence timer ──▶ ProPresenter clearText()
```

The STT stream auto-restarts every 4.5 minutes (before Google's 5-minute limit) and reconnects on gRPC stream-reset errors.

## License

MIT
