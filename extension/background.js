const APP_URLS = [
  "http://localhost:5173/*",
  "http://localhost:5174/*",
  "http://127.0.0.1:5173/*",
  "http://127.0.0.1:5174/*"
];

async function sendToApp(payload) {
  const tabs = await chrome.tabs.query({ url: APP_URLS });
  const appTab = tabs.find((tab) => tab.id && !tab.discarded);
  if (appTab?.id) {
    await chrome.tabs.update(appTab.id, { active: true });
    if (appTab.windowId) await chrome.windows.update(appTab.windowId, { focused: true });
    await chrome.scripting.executeScript({
      target: { tabId: appTab.id },
      func: (data) => window.postMessage({ source: "echospeak-extension", ...data }, "*"),
      args: [payload]
    });
    await chrome.tabs.update(appTab.id, { active: true });
    if (appTab.windowId) await chrome.windows.update(appTab.windowId, { focused: true });
    return;
  }
  const target = new URL("http://localhost:5173/");
  target.searchParams.set("youtube", payload.youtube);
  target.searchParams.set("transcript", payload.transcript);
  await chrome.tabs.create({ url: target.toString(), active: true });
}

function getVideoId(url) {
  const match = url.match(/\/shorts\/([\w-]{11})/);
  return match?.[1] || null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "echospeak-import") {
    sendToApp({ youtube: message.youtube, transcript: message.transcript })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "echospeak-import-short") {
    const videoId = getVideoId(message.youtube);
    if (!videoId) {
      sendResponse({ ok: false, error: "Could not read the Shorts video ID." });
      return false;
    }
    const temporaryUrl = new URL(`https://www.youtube.com/watch?v=${videoId}`);
    temporaryUrl.searchParams.set("echospeakImport", "1");
    temporaryUrl.searchParams.set("echospeakSource", message.youtube);
    chrome.tabs.create({ url: temporaryUrl.toString(), active: false })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "echospeak-auto-result") {
    sendToApp({ youtube: message.youtube, transcript: message.transcript })
      .then(async () => {
        if (sender.tab?.id) await chrome.tabs.remove(sender.tab.id);
        sendResponse({ ok: true });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
