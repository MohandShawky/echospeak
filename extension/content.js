(() => {
  const buttonId = "echospeak-import-button";
  let lastUrl = location.href;

  function isVideoPage() {
    return location.pathname.startsWith("/watch") || location.pathname.startsWith("/shorts/");
  }

  function addButton() {
    if (document.getElementById(buttonId) || !isVideoPage()) return;
    const button = document.createElement("button");
    button.id = buttonId;
    button.type = "button";
    button.textContent = "Import to EchoSpeak";
    button.addEventListener("click", importTranscript);
    document.body.appendChild(button);
  }

  function clickByText(pattern) {
    const selectors = [
      "button[aria-label*='transcript' i]",
      "button[title*='transcript' i]",
      "ytd-video-description-transcript-section-renderer button",
      "button, yt-button-shape, tp-yt-paper-button, span, div"
    ];
    const candidates = selectors.flatMap((selector) => [...document.querySelectorAll(selector)]);
    const target = candidates.find((element) => {
      const text = (element.textContent || "").replace(/\s+/g, " ").trim();
      const label = `${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""}`.replace(/\s+/g, " ").trim();
      return pattern.test(text) || pattern.test(label);
    });
    if (target) {
      const clickable = target.closest("button, yt-button-shape, tp-yt-paper-button") || target;
      clickable.click();
      return true;
    }
    return false;
  }

  function openTranscriptPanel() {
    if (clickByText(/show transcript/i)) return;
    const transcriptButton = document.querySelector("ytd-video-description-transcript-section-renderer button");
    if (transcriptButton) {
      transcriptButton.click();
      return;
    }
    const expand = document.querySelector("ytd-text-inline-expander #expand, ytd-text-inline-expander tp-yt-paper-button, #description-inline-expander #expand, tp-yt-paper-button#expand, #expand");
    if (expand) expand.click();
    else clickByText(/^(…?more|show more|description)$/i);
    [400, 900, 1600, 2600].forEach((delay) => setTimeout(() => {
      const directButton = document.querySelector("ytd-video-description-transcript-section-renderer button");
      if (directButton) directButton.click();
      else clickByText(/show transcript/i);
    }, delay));
  }
  function extractTranscript() {
    const rows = [...document.querySelectorAll("transcript-segment-view-model, ytd-transcript-segment-renderer, .ytd-transcript-segment-renderer")];
    return rows.map((row) => {
      const timestamp = row.querySelector(".ytwTranscriptSegmentViewModelTimestamp, .segment-timestamp")?.textContent?.trim();
      const text = row.querySelector("span[role='text'], .segment-text")?.textContent?.trim();
      return timestamp && text ? `${timestamp}\n${text}` : null;
    }).filter(Boolean).join("\n\n");
  }

  function readTranscript({ automatic = false, sourceUrl = location.href } = {}) {
    if (!automatic) buttonState("Reading transcript…", true);
    openTranscriptPanel();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (attempts === 1 || attempts === 4 || attempts === 8) openTranscriptPanel();
      const transcript = extractTranscript();
      if (transcript) {
        clearInterval(timer);
        const type = automatic ? "echospeak-auto-result" : "echospeak-import";
        chrome.runtime.sendMessage({ type, youtube: sourceUrl, transcript });
        if (!automatic) {
          buttonState("Sent to EchoSpeak ✓", false);
          setTimeout(() => buttonState("Import to EchoSpeak", false), 2200);
        }
      } else if (attempts >= 24) {
        clearInterval(timer);
        if (!automatic) {
          buttonState("No transcript found", false);
          setTimeout(() => buttonState("Import to EchoSpeak", false), 3000);
        }
      }
    }, 500);
  }

  function importTranscript() {
    if (location.pathname.startsWith("/shorts/")) {
      buttonState("Opening transcript view…", true);
      chrome.runtime.sendMessage({ type: "echospeak-import-short", youtube: location.href });
      setTimeout(() => buttonState("Import to EchoSpeak", false), 2500);
      return;
    }
    readTranscript();
  }

  function buttonState(label, disabled) {
    const button = document.getElementById(buttonId);
    if (button) { button.textContent = label; button.disabled = disabled; }
  }

  const params = new URLSearchParams(location.search);
  if (params.get("echospeakImport") === "1") {
    setTimeout(() => readTranscript({ automatic: true, sourceUrl: params.get("echospeakSource") || location.href }), 1200);
  }

  new MutationObserver(() => {
    if (location.href !== lastUrl) { lastUrl = location.href; document.getElementById(buttonId)?.remove(); }
    addButton();
  }).observe(document.documentElement, { childList: true, subtree: true });
  addButton();
})();


