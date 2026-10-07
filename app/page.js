"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

function textOf(message) {
  return (message?.parts || [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function toolParts(message) {
  return (message?.parts || [])
    .filter((part) => String(part.type || "").startsWith("tool-"))
    .map((part) => String(part.type).replace(/^tool-/, ""));
}

function mergeMemory(current, incoming) {
  const map = new Map(current.map((item) => [item.key + "\n" + item.value, item]));
  for (const item of incoming) map.set(item.key + "\n" + item.value, item);
  const list = Array.from(map.values()).slice(-100);
  while (JSON.stringify(list).length > 50000 && list.length > 1) list.shift();
  return list;
}

const actions = [
  ["MEETING", "Prepare a briefing for a software project kickoff meeting.", "PREP FOR MEETING"],
  ["INTEL", "Give me a current Daily Brief with the most important information.", "DAILY BRIEF"],
  ["WEB", "Search the web for the latest important technology news.", "WEB INTEL"],
  ["BROWSER", "Open and inspect https://developer.mozilla.org and summarize the homepage.", "BROWSER SCAN"],
  ["SYSTEM", "Inspect the JARVIS hosted runtime diagnostics and report health.", "SYSTEM SCAN"],
  ["WEATHER", "Get the current environment and weather in Amritsar.", "ENVIRONMENT"],
  ["RESEARCH", "Build a concise research pack on artificial intelligence for a school project.", "RESEARCH PACK"],
  ["DOCUMENT", "Create a structured one-page document about my current mission.", "DRAFT DOCUMENT"],
  ["MEMORY", "Remember locally that my preferred assistant name is JARVIS.", "SAVE MEMORY"],
  ["CALENDAR", "Draft a 30 minute calendar event for my next study session.", "DRAFT CALENDAR"],
  ["EMAIL", "Draft an email asking a teacher for project feedback.", "DRAFT EMAIL"],
  ["VOICE", "Test the voice channel by replying with a short confirmation.", "VOICE TEST"]
];

const navItems = [
  ["COMMAND", "command"],
  ["MISSIONS", "missions"],
  ["INTEL", "intel"],
  ["SYSTEM", "system"],
  ["MEMORY", "memory"]
];

function AuthGate({ onAuthenticated }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function unlock(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.trim() })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Authentication failed.");
      onAuthenticated();
    } catch (err) {
      setError(err?.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-grid" />
      <div className="auth-orb">
        <div className="orb-ring ring-a" />
        <div className="orb-ring ring-b" />
        <div className="orb-ring ring-c" />
        <div className="orb-core">J</div>
      </div>
      <section className="auth-panel">
        <span className="micro-label">STARK INDUSTRIES / PRIVATE NODE</span>
        <h1>JARVIS</h1>
        <p>Secure mission-control interface. Authentication required.</p>
        <form onSubmit={unlock}>
          <label>
            ACCESS TOKEN
            <input
              type="password"
              value={token}
              maxLength={256}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Enter access token"
              autoComplete="off"
            />
          </label>
          <button disabled={busy || !token.trim()}>{busy ? "VERIFYING…" : "INITIALIZE JARVIS ↗"}</button>
        </form>
        {error ? <div className="inline-error">{error}</div> : null}
      </section>
    </main>
  );
}

function ArcReactor({ active, speaking }) {
  return (
    <div className={"reactor " + (active ? "active" : "") + (speaking ? " speaking" : "")} aria-hidden="true">
      <div className="reactor-grid" />
      <div className="reactor-ring outer">
        {Array.from({ length: 12 }, (_, index) => <span key={index} style={{ transform: "rotate(" + index * 30 + "deg)" }} />)}
      </div>
      <div className="reactor-ring middle" />
      <div className="reactor-ring inner" />
      <div className="reactor-core">
        <div className="reactor-pulse" />
        <span>{speaking ? "SPEAKING" : active ? "PROCESSING" : "ONLINE"}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checked, setChecked] = useState(false);
  const [input, setInput] = useState("");
  const [memory, setMemory] = useState([]);
  const [voice, setVoice] = useState(false);
  const [voiceState, setVoiceState] = useState("OFF");
  const [voiceError, setVoiceError] = useState("");
  const [listening, setListening] = useState(false);
  const [activePanel, setActivePanel] = useState("command");
  const [showAllActions, setShowAllActions] = useState(false);

  const memoryRef = useRef([]);
  const statusRef = useRef("ready");
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const spokenRef = useRef("");
  const recognitionRef = useRef(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        credentials: "same-origin",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { messages: messages.slice(-40), memory: memoryRef.current }
        })
      }),
    []
  );

  const { messages, sendMessage, status, stop, error, clearError } = useChat({ transport });

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    fetch("/api/auth", { credentials: "same-origin" })
      .then((response) => response.json().catch(() => ({})))
      .then((data) => setAuthenticated(Boolean(data.authenticated)))
      .catch(() => setAuthenticated(false))
      .finally(() => setChecked(true));
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("jarvis-memory") || "[]");
      const list = Array.isArray(stored) ? mergeMemory([], stored) : [];
      memoryRef.current = list;
      setMemory(list);
    } catch {
      memoryRef.current = [];
    }
  }, []);

  useEffect(() => {
    const additions = [];
    for (const message of messages) {
      for (const part of message.parts || []) {
        if (part.type === "tool-rememberLocally" && part.output?.memory) additions.push(part.output.memory);
      }
    }
    if (!additions.length) return;
    const list = mergeMemory(memoryRef.current, additions);
    memoryRef.current = list;
    setMemory(list);
    try {
      localStorage.setItem("jarvis-memory", JSON.stringify(list));
    } catch {}
  }, [messages]);

  useEffect(() => {
    fetch("/api/speak", { credentials: "same-origin" })
      .then((response) => response.json().catch(() => ({})))
      .then((data) => {
        if (data?.configured) setVoiceState("READY");
        else setVoiceState("FALLBACK");
      })
      .catch(() => setVoiceState("FALLBACK"));
  }, []);

  const cleanupAudio = useCallback(() => {
    try { audioRef.current?.pause(); } catch {}
    audioRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const browserSpeak = useCallback((text) => {
    if (!("speechSynthesis" in window)) return false;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 3000));
      utterance.rate = 0.94;
      utterance.pitch = 0.88;
      utterance.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find((item) => /en[-_](IN|GB|US)/i.test(item.lang)) || voices.find((item) => /^en/i.test(item.lang));
      if (preferred) utterance.voice = preferred;
      utterance.onstart = () => setVoiceState("SPEAKING");
      utterance.onend = () => setVoiceState((current) => current === "ERROR" ? current : "READY");
      utterance.onerror = () => setVoiceState("ERROR");
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      return false;
    }
  }, []);

  const speakText = useCallback(async (text) => {
    const speech = text.trim();
    if (!speech) return;
    setVoiceError("");
    setVoiceState("LOADING");
    cleanupAudio();

    try {
      const response = await fetch("/api/speak", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: speech.slice(0, 3000) })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "ElevenLabs voice request failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audio.preload = "auto";
      audioRef.current = audio;
      audio.onplay = () => setVoiceState("SPEAKING");
      audio.onended = () => {
        cleanupAudio();
        setVoiceState("READY");
      };
      audio.onerror = () => {
        cleanupAudio();
        throw new Error("Audio playback failed.");
      };
      await audio.play();
    } catch (err) {
      cleanupAudio();
      const fallbackWorked = browserSpeak(speech);
      setVoiceState(fallbackWorked ? "FALLBACK" : "ERROR");
      setVoiceError(fallbackWorked ? "ElevenLabs unavailable — browser voice fallback active." : (err?.message || "Voice playback failed."));
    }
  }, [browserSpeak, cleanupAudio]);

  useEffect(() => () => {
    cleanupAudio();
    try { window.speechSynthesis?.cancel(); } catch {}
    try { recognitionRef.current?.stop(); } catch {}
  }, [cleanupAudio]);

  useEffect(() => {
    if (!voice || status !== "ready") return;
    const last = [...messages].reverse().find((message) => message.role === "assistant");
    const speech = textOf(last).trim();
    if (!speech || !last?.id || spokenRef.current === last.id) return;
    spokenRef.current = last.id;
    const timer = window.setTimeout(() => speakText(speech), 80);
    return () => window.clearTimeout(timer);
  }, [messages, status, voice, speakText]);

  function send(text = input) {
    const clean = text.trim();
    if (!clean || !["ready", "error"].includes(statusRef.current)) return;
    if (statusRef.current === "error") clearError();
    sendMessage({ text: clean });
    setInput("");
    setActivePanel("command");
  }

  function toggleVoice() {
    setVoice((current) => {
      const next = !current;
      if (next) {
        setVoiceError("");
        setVoiceState((currentState) => currentState === "OFF" ? "READY" : currentState);
        if ("speechSynthesis" in window) browserSpeak("Voice channel initialized.");
      } else {
        cleanupAudio();
        try { window.speechSynthesis?.cancel(); } catch {}
        setVoiceState("OFF");
      }
      return next;
    });
  }

  function startListening() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceError("Voice input is not supported by this browser.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => {
      setListening(true);
      setVoiceError("");
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((item) => item[0]?.transcript || "").join("");
      setInput(transcript);
    };
    recognition.onerror = (event) => {
      setVoiceError("Microphone input failed: " + (event.error || "unknown error") + ".");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try { recognition.start(); } catch {
      setListening(false);
      setVoiceError("Microphone could not be started.");
    }
  }

  function clearMemory() {
    memoryRef.current = [];
    setMemory([]);
    try { localStorage.removeItem("jarvis-memory"); } catch {}
  }

  const state = status === "error" ? "ERROR" : status !== "ready" ? "PROCESSING" : "ONLINE";
  const visibleActions = showAllActions ? actions : actions.slice(0, 8);
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const lastTools = lastAssistant ? toolParts(lastAssistant) : [];
  const navTitle = navItems.find((item) => item[1] === activePanel)?.[0] || "COMMAND";

  if (!checked) {
    return (
      <main className="boot-screen">
        <ArcReactor active />
        <span>INITIALIZING JARVIS CORE…</span>
      </main>
    );
  }

  if (!authenticated) return <AuthGate onAuthenticated={() => setAuthenticated(true)} />;

  return (
    <main className="jarvis-shell">
      <div className="noise" />
      <header className="hud-top">
        <div className="brand-lockup">
          <div className="brand-mark">J</div>
          <div>
            <span className="micro-label">STARK / AI OPERATIONS</span>
            <strong>JARVIS</strong>
          </div>
        </div>
        <div className="top-readouts">
          <span>NODE <b>J-04</b></span>
          <span>UPLINK <b className="live-dot">● LIVE</b></span>
          <span>LATENCY <b>LOCAL</b></span>
        </div>
        <div className={"global-status " + state.toLowerCase()}><i /> {state}</div>
      </header>

      <div className="hud-body">
        <aside className="left-hud">
          <nav>
            {navItems.map(([label, value]) => (
              <button key={value} className={activePanel === value ? "selected" : ""} onClick={() => setActivePanel(value)}>
                <span className="nav-glyph">{label.slice(0, 2)}</span>
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="left-footer">
            <button onClick={toggleVoice} className={"voice-switch " + (voice ? "on" : "")}>
              <span className="equalizer"><i /><i /><i /><i /></span>
              {voice ? "VOICE ACTIVE" : "VOICE OFF"}
            </button>
            <button onClick={clearMemory}>PURGE MEMORY</button>
          </div>
        </aside>

        <section className="center-stage">
          <div className="scene-grid" />
          <div className="corner corner-a" />
          <div className="corner corner-b" />
          <div className="corner corner-c" />
          <div className="corner corner-d" />

          <section className="hero-hud">
            <div className="hero-copy">
              <span className="micro-label">AUTONOMOUS MISSION CONTROL / MK-IV</span>
              <h1>At your service.</h1>
              <p>Research. Reason. Execute approved workflows. Verify outcomes.</p>
              <div className="mission-line"><span /> CURRENT MODE: <b>{navTitle}</b></div>
            </div>
            <div className="hero-reactor"><ArcReactor active={status !== "ready"} speaking={voiceState === "SPEAKING"} /></div>
          </section>

          <section className="quick-actions">
            <div className="section-head">
              <div>
                <span className="micro-label">COMMAND DECK</span>
                <h2>Available protocols</h2>
              </div>
              <button className="text-button" onClick={() => setShowAllActions((value) => !value)}>
                {showAllActions ? "SHOW LESS" : "VIEW ALL " + actions.length}
              </button>
            </div>
            <div className="action-grid">
              {visibleActions.map(([tag, prompt, label]) => (
                <button key={tag} className="action-card" onClick={() => send(prompt)}>
                  <span className="action-tag">{tag}</span>
                  <strong>{label}</strong>
                  <small>EXECUTE ↗</small>
                </button>
              ))}
            </div>
          </section>

          <section className="command-panel">
            <div className="panel-head">
              <div>
                <span className="micro-label">LIVE CHANNEL</span>
                <h2>Conversation</h2>
              </div>
              <div className="tool-trace">
                {lastTools.length ? lastTools.slice(0, 4).map((toolName) => <span key={toolName}>{toolName}</span>) : <span>NO ACTIVE TOOLS</span>}
              </div>
            </div>

            <div className="messages">
              {messages.length === 0 ? (
                <div className="empty-state">
                  <div className="target-reticle"><span /><i /><b /></div>
                  <div>
                    <span className="micro-label">READY FOR INPUT</span>
                    <h3>Give JARVIS a mission.</h3>
                    <p>Ask for research, a protocol, a system scan, a document, environmental data, or a voice response.</p>
                  </div>
                </div>
              ) : null}

              {messages.map((message) => {
                const text = textOf(message);
                return (
                  <article key={message.id} className={"message-row " + message.role}>
                    <div className="message-avatar">{message.role === "user" ? "U" : "J"}</div>
                    <div className="message-body">
                      <div className="message-meta">
                        <span>{message.role === "user" ? "OPERATOR" : "JARVIS"}</span>
                        {message.role === "assistant" && text ? <button onClick={() => speakText(text)}>{voiceState === "SPEAKING" ? "STOP" : "SPEAK ↗"}</button> : null}
                      </div>
                      <div className="message-text">{text || "Processing tool chain…"}</div>
                    </div>
                  </article>
                );
              })}

              {error ? (
                <div className="error-bar">
                  <span>MISSION ERROR</span>
                  <button onClick={() => send(input)}>RETRY ↗</button>
                </div>
              ) : null}
            </div>

            <form className="command-input" onSubmit={(event) => { event.preventDefault(); send(); }}>
              <div className="prompt-mark">›</div>
              <input value={input} maxLength={12000} onChange={(event) => setInput(event.target.value)} placeholder="Enter command or mission…" />
              <button type="button" className={"mic-button " + (listening ? "active" : "")} onClick={startListening} aria-label="Voice input">
                {listening ? "■" : "MIC"}
              </button>
              {status !== "ready" && status !== "error" ? <button type="button" className="stop-button" onClick={stop}>STOP</button> : null}
              <button type="submit" className="send-button" disabled={!["ready", "error"].includes(status) || !input.trim()}>TRANSMIT ↗</button>
            </form>
          </section>
        </section>

        <aside className="right-hud">
          <section className="data-card telemetry">
            <div className="card-title"><span className="micro-label">TELEMETRY</span><b>REALTIME</b></div>
            <div className="telemetry-big">J-04</div>
            <div className="meter-row"><span>CORE</span><i><b /></i><em>ONLINE</em></div>
            <div className="meter-row"><span>MEMORY</span><i><b style={{ width: Math.min(100, memory.length) + "%" }} /></i><em>{memory.length}</em></div>
            <div className="meter-row"><span>VOICE</span><i><b style={{ width: voice ? "100%" : "0%" }} /></i><em>{voiceState}</em></div>
          </section>

          <section className="data-card focus-card">
            <div className="card-title"><span className="micro-label">MISSION STATUS</span></div>
            <div className="focus-line"><span className="focus-dot" /><div><b>{state}</b><small>AGENT LOOP</small></div></div>
            <div className="focus-line"><span className="focus-dot" /><div><b>{messages.length}</b><small>MESSAGES</small></div></div>
            <div className="focus-line"><span className="focus-dot" /><div><b>{memory.length}</b><small>LOCAL MEMORIES</small></div></div>
          </section>

          <section className="data-card voice-card">
            <div className="card-title"><span className="micro-label">VOICE CHANNEL</span></div>
            <div className="voice-wave">
              {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--delay": (index * 40) + "ms", "--height": (18 + ((index * 13) % 52)) + "%" }} />)}
            </div>
            <strong>{voice ? voiceState : "VOICE STANDBY"}</strong>
            <p>{voice ? "ElevenLabs is preferred; browser speech activates automatically as a fallback." : "Enable voice to hear JARVIS responses."}</p>
            {voiceError ? <small className="voice-error">{voiceError}</small> : null}
          </section>
        </aside>
      </div>

      <footer className="hud-footer">
        <span>SECURE LINK / PRIVATE NODE</span>
        <span>APPROVAL BOUNDARY ACTIVE</span>
        <span>AI CORE 04</span>
      </footer>
    </main>
  );
}
