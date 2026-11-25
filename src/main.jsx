import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const SAMPLE_URL = "https://www.youtube.com/watch?v=ysz5S6PUM-U";
const SAMPLE_TRANSCRIPT =
  "The best way to improve your English is to practice a little every day.";
function getVideoId(value) {
  try {
    const u = new URL(value.trim());
    if (u.hostname.includes("youtu.be"))
      return u.pathname.slice(1).split("/")[0];
    if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2];
    return u.searchParams.get("v");
  } catch {
    return value.trim().match(/^[\w-]{11}$/)?.[0] ?? null;
  }
}
function words(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}
function tokenizeHeard(text) {
  return text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? [];
}
function normalizeLookupWord(value) {
  return String(value)
    .replace(/\u2019/g, String.fromCharCode(39))
    .replace(/[^A-Za-z'-]/g, String())
    .trim();
}
function parseTranscript(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const timestampOnly = /^(\d{1,2}:)?\d{1,2}:\d{2}(?:[,.]\d{3})?(?:\s*[-–—>]\s*(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[,.]\d{3})?)?\s*$/;
  const timestampWithText = /^(\d{1,2}:)?\d{1,2}:\d{2}(?:[,.]\d{3})?\s+(.+)$/;
  const segments = [];
  let current = null;
  for (const line of lines) {
    if (timestampOnly.test(line)) {
      if (current?.text) segments.push(current);
      current = { timestamp: line.split(/\s+/)[0], text: "" };
    } else {
      const match = line.match(timestampWithText);
      if (match) {
        if (current?.text) segments.push(current);
        current = { timestamp: match[0].slice(0, match[0].length - match[1].length).trim(), text: match[1] };
      } else if (current) {
        current.text += `${current.text ? " " : ""}${line}`;
      } else {
        segments.push({ timestamp: null, text: line });
      }
    }
  }
  if (current?.text) segments.push(current);
  return segments;
}
function timeToSeconds(value) {
  if (!value) return 0;
  const parts = value.replace(",", ".").split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}
function formatTime(value) {
  const seconds = Math.max(0, Math.round(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
function parseTimeInput(value) {
  const text = String(value).trim();
  if (!text) return 0;
  if (text.includes(":")) return timeToSeconds(text);
  return Math.max(0, Number(text) || 0);
}function compare(expected, heard) {
  const cleanExpected = parseTranscript(expected).map((segment) => segment.text).join(" ");
  const target = words(cleanExpected),
    actual = words(heard),
    set = new Set(actual),
    missing = target.filter((w) => !set.has(w)),
    extra = actual.filter((w) => !target.includes(w));
  return {
    score: target.length
      ? Math.round(((target.length - missing.length) / target.length) * 100)
      : 0,
    missing: [...new Set(missing)],
    extra: [...new Set(extra)],
  };
}

function App() {
  const imported = new URLSearchParams(window.location.search);
  const importedUrl = imported.get("youtube");
  const importedTranscript = imported.get("transcript");
  const [url, setUrl] = useState(importedUrl || SAMPLE_URL),
    [videoId, setVideoId] = useState(getVideoId(importedUrl || SAMPLE_URL)),
    [transcript, setTranscript] = useState(importedTranscript || SAMPLE_TRANSCRIPT),
    [heard, setHeard] = useState(""),
    [feedback, setFeedback] = useState(null),
    [recording, setRecording] = useState(false),
    [recordingUrl, setRecordingUrl] = useState(""),
    [selectedWord, setSelectedWord] = useState(""),
    [lookupVersion, setLookupVersion] = useState(0),
    [wordDefinition, setWordDefinition] = useState(null),
    [definitionLoading, setDefinitionLoading] = useState(false),
    [definitionError, setDefinitionError] = useState(""),
    [editHeard, setEditHeard] = useState(true),
    [error, setError] = useState("");
  const segments = useMemo(() => parseTranscript(transcript), [transcript]);
  const durationSeconds = useMemo(() => {
    const timestamps = segments.map((segment) => timeToSeconds(segment.timestamp)).filter((value) => value > 0);
    return timestamps.length ? Math.max(...timestamps) + 5 : 0;
  }, [segments]);
  const [rangeStartSeconds, setRangeStartSeconds] = useState(0);
  const [rangeEndSeconds, setRangeEndSeconds] = useState(0);
  const [startInput, setStartInput] = useState("0:00");
  const [endInput, setEndInput] = useState("0:00");
  useEffect(() => {
    if (!selectedWord) {
      setWordDefinition(null);
      setDefinitionError("");
      setDefinitionLoading(false);
      return undefined;
    }
    const lookupWord = normalizeLookupWord(selectedWord);
    if (!lookupWord) {
      setDefinitionError("This word could not be looked up.");
      setDefinitionLoading(false);
      return undefined;
    }
    const cached = definitionCache.current[lookupWord];
    if (cached) {
      setWordDefinition(cached);
      setDefinitionError("");
      setDefinitionLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setDefinitionLoading(true);
    setDefinitionError("");
    setWordDefinition(null);
    const dictionaryRequest = fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lookupWord)}`, { signal: controller.signal })
      .then((response) => {
        if (response.status === 404) throw new Error("not-found");
        if (!response.ok) throw new Error("service-error");
        return response.json();
      });
    const antonymRequest = fetch(`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(lookupWord)}&max=5`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : [])
      .catch((requestError) => {
        if (requestError.name === "AbortError") throw requestError;
        return [];
      });
    Promise.all([dictionaryRequest, antonymRequest])
      .then(([entries, antonymEntries]) => {
        const entry = entries[0];
        const meanings = entry?.meanings ?? [];
        const dictionaryAntonyms = meanings.flatMap((meaning) => (meaning.definitions ?? []).flatMap((item) => item.antonyms ?? []));
        const serviceAntonyms = antonymEntries.map((item) => item.word).filter(Boolean);
        const definitions = meanings.flatMap((meaning) => (meaning.definitions ?? []).slice(0, 2).map((item) => ({
          partOfSpeech: meaning.partOfSpeech,
          definition: item.definition,
          example: item.example,
        }))).slice(0, 4);
        const result = {
          word: entry?.word || selectedWord,
          phonetic: entry?.phonetic || entry?.phonetics?.find((item) => item.text)?.text || "",
          definitions,
          antonyms: [...new Set([...dictionaryAntonyms, ...serviceAntonyms])].slice(0, 5),
        };
        definitionCache.current[lookupWord] = result;
        setWordDefinition(result);
      })
      .catch((requestError) => {
        if (requestError.name === "AbortError") return;
        if (requestError.message === "not-found") {
          setDefinitionError("No dictionary entry was found for this word.");
        } else {
          setDefinitionError("The dictionary service is temporarily unavailable.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDefinitionLoading(false);
      });
    return () => controller.abort();
  }, [selectedWord, lookupVersion]);

  useEffect(() => {
    setRangeStartSeconds(0);
    setRangeEndSeconds(durationSeconds);
  }, [durationSeconds]);
  const selectedSegments = segments.filter((segment) => {
    if (!segment.timestamp || !durationSeconds) return true;
    const timestamp = timeToSeconds(segment.timestamp);
    return timestamp >= rangeStartSeconds && timestamp <= rangeEndSeconds;
  });
  const selectedText = selectedSegments.map((segment) => segment.text).join(" ");
  const startSeconds = rangeStartSeconds;
  const endSeconds = rangeEndSeconds;
  const recorder = useRef(null);
  const recordingChunks = useRef([]);
  const recordingUrlRef = useRef("");
  const recognition = useRef(null);
  const recordingActive = useRef(false);
  const recognizedText = useRef("");
  const waveformCanvas = useRef(null);
  const analyserRef = useRef(null);
  const audioContext = useRef(null);
  const animationFrame = useRef(null);
  const definitionCache = useRef({});

  useEffect(() => {
    function receiveImportedLesson(event) {
      if (event.source !== window || event.data?.source !== "echospeak-extension") return;
      const { youtube, transcript } = event.data;
      if (!youtube || !transcript) return;
      setUrl(youtube);
      setVideoId(getVideoId(youtube));
      setTranscript(transcript);
      setFeedback(null);
      setError("");
    }
    window.addEventListener("message", receiveImportedLesson);
    return () => window.removeEventListener("message", receiveImportedLesson);
  }, []);  const canRecognize = useMemo(
    () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    [],
  );
  useEffect(
    () => () => {
      recorder.current?.stop();
      recognition.current?.stop();
      if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    },
    [],
  );
  useEffect(() => {
    if (recording && analyserRef.current) drawWaveform(analyserRef.current);
  }, [recording]);

  function loadVideo(e) {
    e.preventDefault();
    const id = getVideoId(url);
    if (!id)
      return setError("Please enter a valid YouTube or YouTube Shorts link.");
    setVideoId(id);
    setError("");
    setFeedback(null);
  }
  function drawWaveform(analyser) {
    const canvas = waveformCanvas.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    const data = new Uint8Array(analyser.fftSize);
    const draw = () => {
      animationFrame.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(data);
      const width = canvas.width;
      const height = canvas.height;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = "#93e6c2";
      context.lineWidth = 2;
      context.beginPath();
      data.forEach((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height / 2 + ((value - 128) / 128) * (height * 0.42);
        index === 0 ? context.moveTo(x, y) : context.lineTo(x, y);
      });
      context.stroke();
    };
    draw();
  }

  function clearRecording() {
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    recordingUrlRef.current = "";
    setRecordingUrl("");
  }

  function restartRecognition() {
    if (!recordingActive.current || !recognition.current) return;
    try { recognition.current.start(); } catch { /* recognition is already starting */ }
  }

  async function startRecording() {
    setError("");
    setFeedback(null);
    setHeard("");
    recognizedText.current = "";
    if (!navigator.mediaDevices?.getUserMedia)
      return setError("Microphone recording is not supported in this browser.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      clearRecording();
      recordingChunks.current = [];
      recorder.current = new MediaRecorder(stream);
      recorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunks.current.push(event.data);
      };
      recorder.current.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordingChunks.current, { type: recorder.current?.mimeType || "audio/webm" });
        if (blob.size > 0) {
          const nextUrl = URL.createObjectURL(blob);
          recordingUrlRef.current = nextUrl;
          setRecordingUrl(nextUrl);
        }
      };
      recorder.current.start();
      recordingActive.current = true;
      setRecording(true);
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioContext.current = new AudioContextClass();
        const source = audioContext.current.createMediaStreamSource(stream);
        const analyser = audioContext.current.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        analyserRef.current = analyser;
      }
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (Recognition) {
        recognition.current = new Recognition();
        recognition.current.continuous = true;
        recognition.current.interimResults = true;
        recognition.current.lang = "en-US";
        recognition.current.onresult = (event) => {
          let interim = "";
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const text = event.results[index][0].transcript;
            if (event.results[index].isFinal) recognizedText.current += `${text} `;
            else interim += text;
          }
          setHeard(`${recognizedText.current}${interim}`.trim());
        };
        recognition.current.onerror = (event) => {
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            setError("Microphone or speech-recognition permission was denied.");
          } else if (recordingActive.current) {
            setTimeout(restartRecognition, 250);
          }
        };
        recognition.current.onend = () => {
          if (recordingActive.current) setTimeout(restartRecognition, 150);
        };
        recognition.current.start();
      }
    } catch {
      recordingActive.current = false;
      setError("Microphone permission was not granted. Please allow microphone access and try again.");
    }
  }

  function stopRecording() {
    recordingActive.current = false;
    recorder.current?.stop();
    recognition.current?.stop();
    if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    animationFrame.current = null;
    audioContext.current?.close();
    audioContext.current = null;
    setRecording(false);
    setEditHeard(false);
  }  function analyze() {
    if (!heard.trim())
      return setError(
        "Add what you said in the box first, or use a browser with speech recognition.",
      );
    setFeedback(compare(selectedText, heard));
    setError("");
  }
  return (
    <main className="shell">
      <header>
        <div className="brand">
          <b>◌</b> EchoSpeak
        </div>
        <small>SHADOWING COACH · MVP</small>
      </header>
      <section className="hero">
        <p>Practice out loud. Improve naturally.</p>
        <h1>
          Speak with the rhythm
          <br />
          <i>of real English.</i>
        </h1>
        <div>
          Use a YouTube clip, shadow the speaker, and get friendly feedback on
          the words you caught.
        </div>
      </section>
      <section className="workspace">
        <form className="url-form" onSubmit={loadVideo}>
          <label htmlFor="url">Paste a YouTube video or Shorts link</label>
          <div>
            <input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
            />
            <button>Load clip ↗</button>
          </div>
        </form>
        <div className="columns">
          <section className="card video-card">
            <h2>
              <span>01</span> Watch & shadow
            </h2>
            <div className="video">
              <iframe
                title="YouTube practice clip"
                src={`https://www.youtube.com/embed/${videoId}?rel=0${startSeconds ? `&start=${startSeconds}` : ""}${endSeconds > startSeconds ? `&end=${endSeconds}` : ""}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <p className="tip">
              ✦ <b>Try this:</b>&nbsp; Play once to listen. Then replay and
              speak along with the speaker.
            </p>
            <div className="range-controls">
              <div className="range-slider-wrap">
                <div className="range-slider" style={{ "--range-start": `${durationSeconds ? (rangeStartSeconds / durationSeconds) * 100 : 0}%`, "--range-end": `${durationSeconds ? (rangeEndSeconds / durationSeconds) * 100 : 100}%` }}>
                  <div className="range-track" />
                  <input aria-label="Practice start position" type="range" min="0" max={durationSeconds || 1} step="1" value={rangeStartSeconds} disabled={!durationSeconds} onChange={(e) => { const next = Math.min(Number(e.target.value), rangeEndSeconds - 1); setRangeStartSeconds(Math.max(0, next)); }} />
                  <input aria-label="Practice end position" type="range" min="0" max={durationSeconds || 1} step="1" value={rangeEndSeconds || durationSeconds || 1} disabled={!durationSeconds} onChange={(e) => { const next = Math.max(Number(e.target.value), rangeStartSeconds + 1); setRangeEndSeconds(Math.min(durationSeconds, next)); }} />
                </div>
                <div className="range-labels"><span>0:00</span><span>{formatTime(durationSeconds)}</span></div>
              </div>
              <div className="time-inputs">
                <label>Start <input value={startInput} onChange={(e) => setStartInput(e.target.value)} onBlur={() => setRangeStartSeconds(Math.min(Math.max(0, parseTimeInput(startInput)), Math.max(0, rangeEndSeconds - 1)))} aria-label="Start time" /></label>
                <label>End <input value={endInput} onChange={(e) => setEndInput(e.target.value)} onBlur={() => setRangeEndSeconds(Math.max(Math.min(durationSeconds, parseTimeInput(endInput)), rangeStartSeconds + 1))} aria-label="End time" /></label>
              </div>
            </div>
            <p className="range-summary">Practice range: {formatTime(rangeStartSeconds)} – {formatTime(rangeEndSeconds)} · {selectedSegments.length} phrase{selectedSegments.length === 1 ? "" : "s"}</p>
          </section>
          <section className="card transcript-card">
            <details className="transcript-disclosure">
              <summary>
                <span className="transcript-title"><span>02</span> Reference text</span>
                <span className="transcript-status">{transcript.trim() ? "READY" : "ADD TEXT"} <b>⌄</b></span>
              </summary>
              <div className="transcript-content">
                <p className="muted">
                  Stored automatically for comparison. Open this panel when you want to review or edit it.
                </p>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  aria-label="Reference transcript"
                />
                <div className="meta">
                  {words(segments.map((segment) => segment.text).join(" ")).length} words · {segments.length} practice phrases · Editable
                </div>
              </div>
            </details>
          </section>
        </div>        <section className="card record">
          <h2>
            <span>03</span> Record your attempt{" "}
            <em className={recording ? "active" : ""}>
              {recording ? "● RECORDING" : "● MIC READY"}
            </em>
          </h2>
          <div className="record-row">
            <p>
              Speak at the same time as the speaker, or pause the video and
              repeat the line.
              <br />
              <small>Your recording stays in this browser session.</small>
            </p>
            <div>
              {!recording ? (
                <button className="secondary" onClick={startRecording}>
                  ● Start recording
                </button>
              ) : (
                <button className="stop" onClick={stopRecording}>
                  ■ Stop recording
                </button>
              )}
              <button
                className="analyze"
                onClick={analyze}
                disabled={recording}
              >
                Analyze my speech →
              </button>
            </div>
          </div>
          {recording && (
            <div className="waveform-card">
              <canvas ref={waveformCanvas} width="520" height="72" aria-label="Live microphone waveform" />
              <span>Listening to your voice…</span>
            </div>
          )}
          {recordingUrl && (
            <div className="attempt-card">
              <div className="attempt-heading">
                <strong>Your last attempt</strong>
                <button className="discard" onClick={clearRecording}>Discard</button>
              </div>
              <audio controls src={recordingUrl} aria-label="Play your last recording" />
              <small>Listen back, then record again when you are ready.</small>
            </div>
          )}
          <div className="heard-heading">
            <div>
              <label htmlFor="heard">What the app heard</label>

            </div>
            {heard.trim() && (
              <button className="heard-toggle" type="button" onClick={() => setEditHeard((value) => !value)}>
                <span>✦</span> {editHeard ? "View word definitions" : "Edit heard text"}
              </button>
            )}
          </div>
          {editHeard || !heard.trim() ? (
            <textarea
              id="heard"
              value={heard}
              onChange={(e) => setHeard(e.target.value)}
              placeholder={
                canRecognize
                  ? "Your words will appear here while you speak…"
                  : "Type what you said here (speech recognition is unavailable)…"
              }
            />
          ) : (
            <div className="heard-words" aria-label="Click a word to see its definition">
              {heard.split(/(\s+)/).map((part, index) => {
                const match = part.match(/[A-Za-z]+(?:[’-][A-Za-z]+)*/);
                if (!match) return <span key={`${part}-${index}`}>{part}</span>;
                const word = match[0];
                return (
                  <button
                    type="button"
                    key={`${word}-${index}`}
                    className={selectedWord.toLowerCase() === word.toLowerCase() ? "heard-word selected" : "heard-word"}
                    onClick={() => { setSelectedWord(word); setLookupVersion((value) => value + 1); }}
                  >
                    {part}
                  </button>
                );
              })}
            </div>
          )}
          {selectedWord && (
            <div className="word-lookup" aria-live="polite">
              <div className="word-lookup-head">
                <div><strong>{wordDefinition?.word || selectedWord}</strong>{wordDefinition?.phonetic && <span>{wordDefinition.phonetic}</span>}</div>
                <button type="button" className="lookup-close" onClick={() => setSelectedWord("")}>Close</button>
              </div>
              {definitionLoading && <p className="muted">Looking up this word…</p>}
              {definitionError && <p className="error">{definitionError}</p>}
              {wordDefinition && !definitionLoading && (
                <>
                  <div className="word-definitions">
                    {wordDefinition.definitions.map((item, index) => (
                      <div className="word-definition" key={`${item.definition}-${index}`}>
                        <span>{item.partOfSpeech}</span>
                        <p>{item.definition}</p>
                        {item.example && <small>“{item.example}”</small>}
                      </div>
                    ))}
                  </div>
                  <div className="word-antonyms">
                    <b>Opposite</b>
                    <span>{wordDefinition.antonyms.length ? wordDefinition.antonyms.join(" · ") : "No common opposite listed."}</span>
                  </div>
                </>
              )}
            </div>
          )}
          {!canRecognize && (
            <small className="notice">
              Speech recognition is unavailable in this browser, but manual
              feedback still works.
            </small>
          )}
        </section>
        {(error || feedback) && (
          <section className="card feedback" aria-live="polite">
            {error && <p className="error">{error}</p>}
            {feedback && (
              <>
                <div className="feedback-head">
                  <h2>
                    <span>04</span> Your first check-in
                  </h2>
                  <strong>
                    {feedback.score}%<small> word match</small>
                  </strong>
                </div>
                <div className="feedback-grid">
                  <p>
                    <b>✓ MATCHED APPROACH</b>
                    <br />
                    {feedback.score >= 80
                      ? "Nice work — your words are close to the reference."
                      : "Good start. Listen once more, then try the line again."}
                  </p>
                  <p>
                    <b>! PRACTICE THESE WORDS</b>
                    <br />
                    {feedback.missing.length
                      ? feedback.missing.join(" · ")
                      : "No missing words detected."}
                  </p>
                </div>
                {feedback.extra.length > 0 && (
                  <small className="notice">
                    Extra or different words heard: {feedback.extra.join(", ")}
                  </small>
                )}
              </>
            )}
          </section>
        )}
      </section>
      <footer>
        Built for deliberate practice. <span>EchoSpeak / MVP 01</span>
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

















