# EchoSpeak — Shadowing Coach

EchoSpeak is a React web application and browser extension for practicing English shadowing with YouTube videos. A learner chooses a video segment, speaks along with it, listens back to the attempt, and reviews what the browser recognized.

## Features

- YouTube and YouTube Shorts URL support
- Embedded YouTube video player
- Start and end practice range using a dual slider or manual `mm:ss` inputs
- Collapsible reference transcript that remains available for comparison
- Timestamp-aware transcript parsing
- Microphone recording with a live voice waveform
- Playback and discard controls for the latest recording
- Browser speech recognition when supported
- Manual text-entry fallback for unsupported browsers
- Word-match feedback showing missing and extra words
- Clickable recognized words with definitions, examples, pronunciation, and available antonyms
- Responsive dark interface
- YouTube transcript importer extension

## Run locally

1. Install Node.js.
2. Open a terminal in this folder.
3. Install dependencies:

   ```powershell
   npm install
   ```

4. Start the development server:

   ```powershell
   npm run dev
   ```

5. Open the local URL shown by Vite, usually `http://localhost:5173`.

To create a production build:

```powershell
npm run build
```

## Install the YouTube extension locally

1. Start EchoSpeak with `npm run dev`.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the project's `extension` folder.
6. Open a YouTube video and click **Import to EchoSpeak**.

The extension opens the transcript automatically when possible, reads the visible transcript segments, and sends the video URL, timestamps, and transcript to the local EchoSpeak tab. If the extension code changes, reload it from the browser's extensions page.

## Technology

- React and React DOM for the interface
- Vite for development and production builds
- Custom CSS; no Tailwind or Bootstrap
- YouTube iframe embed for video playback
- `MediaRecorder` and `getUserMedia` for microphone capture
- Web Speech API for optional browser speech-to-text
- Dictionary API for word definitions and examples
- Datamuse API for additional WordNet-based antonym results

## Important limitations

- Browser speech recognition is best supported in Chrome and Edge. Other browsers may record audio without producing live text.
- Speech recognition results are treated as possible word differences, not definitive pronunciation judgments.
- The app does not download YouTube audio or transcripts. It uses the embedded player and the transcript displayed by YouTube or supplied by the learner.
- Recordings are kept in the current browser session and are not uploaded by the MVP.
- Dictionary and antonym results depend on the external services being available and may not exist for every word or meaning.
