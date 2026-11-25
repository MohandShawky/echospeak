<<<<<<< HEAD
# echospeak
=======
# EchoSpeak — Shadowing Coach MVP

A React + JavaScript MVP for practicing English shadowing with YouTube videos and Shorts.

## Run locally

1. Install Node.js.
2. From this folder run `npm install`.
3. Run `npm run dev`.
4. Open the local URL shown by Vite.

## Implemented

- YouTube and YouTube Shorts URL parsing
- Embedded YouTube player
- Editable reference transcript area with timestamp parsing
- Recognizes timestamp-only lines and timestamp-plus-text lines, then excludes timestamps from feedback
- Microphone recording permission and session-only recording
- Browser speech recognition when supported
- Manual transcript input fallback
- Word-match score with missing and extra words
- Responsive dark learning interface
- Loading and error feedback for invalid links, permissions, and unsupported browsers

## Libraries and browser APIs

- React and React DOM: UI and component rendering
- Vite: development server and production build
- YouTube embed: video playback without downloading YouTube media
- MediaRecorder and getUserMedia: microphone capture
- SpeechRecognition/Web Speech API: optional browser speech-to-text
- CSS: custom responsive styling; no Tailwind or Bootstrap used in this MVP

The app intentionally does not scrape or download YouTube transcripts or audio. The learner can paste the transcript from YouTube’s “Show transcript” panel.



## Use the YouTube extension

The extension is in the `extension` folder. Start the app first, then load that folder from `chrome://extensions` with Developer mode enabled. On a YouTube watch page, click `Import to EchoSpeak`. The extension reads the transcript segments displayed by YouTube and opens the app with the video URL, timestamps, and transcript already filled in.
>>>>>>> a6e98fb (Initial EchoSpeak MVP)
