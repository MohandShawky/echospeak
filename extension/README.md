# EchoSpeak Transcript Importer

This local Chrome extension adds an `Import to EchoSpeak` button to YouTube watch pages.

## Install locally

1. Start the EchoSpeak website with `npm run dev`.
2. Open Chrome and visit `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select this `extension` folder.
6. Open or refresh a YouTube video page.
7. Click YouTube's **Show transcript** if needed, then click **Import to EchoSpeak**.
8. The existing EchoSpeak tab is focused and updated with the timestamped transcript. If EchoSpeak is not open, the extension opens it automatically.

For Shorts, the extension automatically opens a temporary normal watch-page view, reads the transcript there, sends it to the existing EchoSpeak tab, and closes the temporary tab. The extension only reads transcript rows already exposed in the YouTube page. It does not download video or audio.

This is a local portfolio prototype. YouTube can change its page structure, so the importer may need selector updates in the future.


After changing extension files, return to chrome://extensions and click **Reload** on EchoSpeak Transcript Importer, then refresh YouTube.

