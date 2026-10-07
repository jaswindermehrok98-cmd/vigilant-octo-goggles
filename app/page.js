"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

function textOf(message) {
  return (message?.parts || []).filter((part) => part.type === "text").map((part) => part.text).join("");
}
function mergeMemory(current, incoming) {
  const map = new Map(current.map((item) => [item.key + "\n" + item.value, item]));
  for (const item of incoming) map.set(item.key + "\n" + item.value, item);
  const list = Array.from(map.values()).slice(-100);
  while (JSON.stringify(list).length > 50000 && list.length > 1) list.shift();
  return list;
}

const NAV = [
  ["COMMAND", "command"],
  ["FLASH", "flash"],
  ["LIVE", "live"],
  ["CREATE", "create"],
  ["RESEARCH", "research"],
  ["WORKSPACE", "workspace"],
  ["MEMORY", "memory"]
];

const PRESETS = [
  ["TUTOR", "Teach me clearly, step-by-step, checking my understanding when useful."],
  ["CODER", "Act as a senior software engineer. Prefer robust, production-ready solutions."],
  ["RESEARCHER", "Be evidence-first. Use current sources and distinguish facts from inference."],
  ["CREATIVE", "Be inventive and visual. Give several strong directions rather than generic ideas."],
  ["JARVIS", "Act like a calm mission-control operator: anticipate, plan, act, verify."]
];

const FLASH_ACTIONS = [
  ["WEB", "web", "Search Google for the latest information about this topic.", "SEARCH"],
  ["URL", "url", "Read and analyze the URL I provide.", "URL CONTEXT"],
  ["CODE", "code", "Solve or analyze this using Python code execution where helpful.", "CODE LAB"],
  ["MAPS", "maps", "Find relevant places and directions using Google Maps grounding.", "MAP INTEL"],
  ["ANALYZE", "analyze", "Analyze the attached files deeply and explain the important findings.", "FILE ANALYSIS"],
  ["COMPARE", "compare", "Compare the attached files and identify differences, conflicts, and key takeaways.", "COMPARE FILES"]
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
      <div className="auth-orb"><div className="orb-ring ring-a" /><div className="orb-ring ring-b" /><div className="orb-ring ring-c" /><div className="orb-core">J</div></div>
      <section className="auth-panel">
        <span className="micro-label">STARK / PRIVATE NODE</span>
        <h1>JARVIS</h1>
        <p>Gemini-powered multimodal mission control. Secure authentication required.</p>
        <form onSubmit={unlock}>
          <label>ACCESS TOKEN<input type="password" value={token} maxLength={256} onChange={(e) => setToken(e.target.value)} placeholder="Enter access token" autoComplete="off" /></label>
          <button disabled={busy || !token.trim()}>{busy ? "VERIFYING…" : "INITIALIZE JARVIS ↗"}</button>
        </form>
        {error ? <div className="inline-error">{error}</div> : null}
      </section>
    </main>
  );
}

function Reactor({ active, speaking }) {
  return (
    <div className={"reactor " + (active ? "active" : "") + (speaking ? " speaking" : "")}>
      <div className="reactor-grid" />
      <div className="reactor-ring outer">{Array.from({ length: 12 }, (_, i) => <span key={i} style={{ transform: "rotate(" + i * 30 + "deg)" }} />)}</div>
      <div className="reactor-ring middle" />
      <div className="reactor-ring inner" />
      <div className="reactor-core"><div className="reactor-pulse" /><span>{speaking ? "VOICE ACTIVE" : active ? "PROCESSING" : "ONLINE"}</span></div>
    </div>
  );
}

function AudioPlayer({ dataUrl, label = "PLAY AUDIO" }) {
  return <audio controls src={dataUrl} style={{ width: "100%" }} aria-label={label} />;
}

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checked, setChecked] = useState(false);
  const [input, setInput] = useState("");
  const [memory, setMemory] = useState([]);
  const [mode, setMode] = useState("command");
  const [preset, setPreset] = useState("JARVIS");
  const [flashPrompt, setFlashPrompt] = useState("");
  const [flashResult, setFlashResult] = useState(null);
  const [working, setWorking] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [researchPrompt, setResearchPrompt] = useState("");
  const [research, setResearch] = useState(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageSize, setImageSize] = useState("1K");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [mediaResult, setMediaResult] = useState(null);
  const [voiceStyle, setVoiceStyle] = useState("calm, intelligent, warm, precise");
  const [voiceAudio, setVoiceAudio] = useState(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("STANDBY");
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [liveTranscript, setLiveTranscript] = useState([]);
  const [liveError, setLiveError] = useState("");
  const [canvasText, setCanvasText] = useState("");
  const [url, setUrl] = useState("");
  const [codePrompt, setCodePrompt] = useState("");
  const [mapPrompt, setMapPrompt] = useState("");
  const [geminiChat, setGeminiChat] = useState([]);

  const memoryRef = useRef([]);
  const statusRef = useRef("ready");
  const liveSocketRef = useRef(null);
  const liveStreamRef = useRef(null);
  const liveAudioContextRef = useRef(null);
  const liveProcessorRef = useRef(null);
  const outputContextRef = useRef(null);
  const outputTimeRef = useRef(0);

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    credentials: "same-origin",
    prepareSendMessagesRequest: ({ messages }) => ({ body: { messages: messages.slice(-40), memory: memoryRef.current } })
  }), []);
  const { messages, sendMessage, status, stop, error, clearError } = useChat({ transport });

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => {
    fetch("/api/auth", { credentials: "same-origin" })
      .then((r) => r.json().catch(() => ({}))).then((d) => setAuthenticated(Boolean(d.authenticated)))
      .catch(() => setAuthenticated(false)).finally(() => setChecked(true));
  }, []);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("jarvis-memory") || "[]");
      const list = Array.isArray(stored) ? mergeMemory([], stored) : [];
      memoryRef.current = list; setMemory(list);
    } catch {}
  }, []);
  useEffect(() => {
    const additions = [];
    for (const m of messages) for (const part of m.parts || []) {
      if (part.type === "tool-rememberLocally" && part.output?.memory) additions.push(part.output.memory);
    }
    if (!additions.length) return;
    const list = mergeMemory(memoryRef.current, additions);
    memoryRef.current = list; setMemory(list);
    try { localStorage.setItem("jarvis-memory", JSON.stringify(list)); } catch {}
  }, [messages]);

  const sendCommand = useCallback((value = input) => {
    const clean = value.trim();
    if (!clean || !["ready", "error"].includes(statusRef.current)) return;
    if (statusRef.current === "error") clearError();
    sendMessage({ text: clean }); setInput(""); setMode("command");
  }, [clearError, input, sendMessage]);

  async function callGemini(payload) {
    setWorking(true); setFlashResult(null);
    try {
      const response = await fetch("/api/gemini", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Gemini request failed.");
      setFlashResult(data);
      if (data.text) setCanvasText(data.text);
      return data;
    } catch (err) {
      setFlashResult({ error: err?.message || "Gemini request failed." });
      return null;
    } finally { setWorking(false); }
  }

  async function uploadFiles(event) {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    setUploading(true); setFlashResult(null);
    try {
      const uploaded = [];
      for (const file of selected.slice(0, 10)) {
        const form = new FormData();
        form.set("file", file);
        const response = await fetch("/api/gemini/files", { method: "POST", credentials: "same-origin", body: form });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Upload failed.");
        uploaded.push(data);
      }
      setFiles((current) => [...current, ...uploaded].slice(-10));
      setMode("workspace");
    } catch (err) { setFlashResult({ error: err?.message || "Upload failed." }); }
    finally { setUploading(false); event.target.value = ""; }
  }

  async function runFlash() {
    if (!flashPrompt.trim()) return;
    const persona = PRESETS.find((item) => item[0] === preset)?.[1] || PRESETS[4][1];
    const data = await callGemini({
      mode: "chat",
      prompt: persona + "\n\nUSER MISSION:\n" + flashPrompt,
      files,
      search: true
    });
    if (data) setGeminiChat((current) => [...current, { role: "user", text: flashPrompt }, { role: "assistant", text: data.text || "No text returned.", data }]);
  }

  async function runAction(type) {
    if (type === "web") { setMode("flash"); setFlashPrompt(""); return; }
    if (type === "url") { setMode("workspace"); return; }
    if (type === "code") {
      setMode("workspace");
      setFlashPrompt(codePrompt);
      await callGemini({ mode: "code", prompt: codePrompt || "Demonstrate a useful calculation and explain the result.", files, codeExecution: true });
      return;
    }
    if (type === "maps") {
      setMode("workspace");
      await callGemini({ mode: "maps", prompt: mapPrompt || "Find useful nearby places based on my request.", maps: true, search: true });
      return;
    }
    if (type === "analyze") {
      setMode("workspace");
      await callGemini({ mode: "analyze", prompt: "Analyze the attached files. Extract facts, explain them, and flag anything important.", files });
      return;
    }
    if (type === "compare") {
      setMode("workspace");
      await callGemini({ mode: "research", prompt: "Compare the attached files carefully. Give a source-grounded difference table.", files, search: true, urlContext: true });
    }
  }

  async function makeImage() {
    if (!imagePrompt.trim()) return;
    setWorking(true); setMediaResult(null);
    const data = await callGemini({ mode: "image", prompt: imagePrompt, files, search: true, imageSize, aspectRatio });
    if (data) setMediaResult(data);
  }

  async function makeVideo() {
    if (!imagePrompt.trim()) return;
    setWorking(true); setMediaResult(null);
    const data = await callGemini({ mode: "video", prompt: imagePrompt, files, aspectRatio });
    if (data) setMediaResult(data);
  }

  async function speakWithGemini(text = canvasText || flashResult?.text || "") {
    if (!text.trim()) return;
    setVoiceBusy(true); setVoiceStatus("SYNTHESIZING"); setVoiceAudio(null);
    try {
      const response = await fetch("/api/gemini/tts", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, style: voiceStyle })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})); throw new Error(data.error || "Gemini voice failed.");
      }
      const blob = await response.blob();
      setVoiceAudio(URL.createObjectURL(blob)); setVoiceStatus("READY");
    } catch (err) { setVoiceStatus("ERROR"); setFlashResult({ error: err?.message || "Voice failed." }); }
    finally { setVoiceBusy(false); }
  }

  function base64ToBytes(base64) {
    const binary = atob(base64); const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  function bytesToBase64(bytes) {
    let binary = ""; const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + chunk)));
    return btoa(binary);
  }
  function floatToPcm16(input, inputRate) {
    const outputRate = 16000;
    const ratio = inputRate / outputRate;
    const length = Math.max(1, Math.round(input.length / ratio));
    const output = new Int16Array(length);
    for (let i = 0; i < length; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.min(input.length, Math.floor((i + 1) * ratio));
      let sum = 0; let count = 0;
      for (let j = start; j < end; j++) { sum += input[j]; count++; }
      const sample = count ? sum / count : 0;
      output[i] = Math.max(-1, Math.min(1, sample)) * 0x7fff;
    }
    return new Uint8Array(output.buffer);
  }
  function playLivePcm(base64, sampleRate = 24000) {
    const ctx = outputContextRef.current || new AudioContext({ sampleRate });
    outputContextRef.current = ctx;
    const bytes = base64ToBytes(base64);
    const samples = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 32768;
    const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(ctx.destination);
    const now = ctx.currentTime;
    outputTimeRef.current = Math.max(outputTimeRef.current, now);
    source.start(outputTimeRef.current);
    outputTimeRef.current += buffer.duration;
  }

  async function startLive() {
    if (liveConnected) return;
    setLiveError(""); setLiveTranscript([]); setLiveText("");
    try {
      const tokenResponse = await fetch("/api/gemini/live", { method: "POST", credentials: "same-origin" });
      const tokenData = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok) throw new Error(tokenData.error || "Could not start Gemini Live.");
      const socket = new WebSocket("wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?access_token=" + encodeURIComponent(tokenData.token));
      liveSocketRef.current = socket;
      socket.onopen = async () => {
        socket.send(JSON.stringify({ setup: { model: "models/gemini-3.8-live", responseModalities: ["AUDIO"], inputAudioTranscription: {}, outputAudioTranscription: {}, systemInstruction: { parts: [{ text: "You are JARVIS. Be concise, warm, fast, precise, proactive, and helpful." }] } } }));
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        liveStreamRef.current = stream;
        const context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const processor = context.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (event) => {
          if (socket.readyState !== WebSocket.OPEN) return;
          const pcm = floatToPcm16(event.inputBuffer.getChannelData(0), context.sampleRate);
          socket.send(JSON.stringify({ realtimeInput: { audio: { data: bytesToBase64(pcm), mimeType: "audio/pcm;rate=16000" } } }));
        };
        source.connect(processor); processor.connect(context.destination);
        liveProcessorRef.current = { processor, source, context };
        setLiveConnected(true);
      };
      socket.onmessage = (event) => {
        const response = JSON.parse(event.data);
        const content = response.serverContent;
        const inputText = content?.inputTranscription?.text;
        const outputText = content?.outputTranscription?.text;
        if (inputText) { setLiveText(inputText); setLiveTranscript((current) => [...current.slice(-7), { role: "you", text: inputText }]); }
        if (outputText) { setLiveText(outputText); setLiveTranscript((current) => [...current.slice(-7), { role: "jarvis", text: outputText }]); }
        for (const part of content?.modelTurn?.parts || []) {
          if (part?.inlineData?.data) playLivePcm(part.inlineData.data, 24000);
        }
        if (content?.turnComplete) setLiveText("");
      };
      socket.onerror = () => setLiveError("Gemini Live connection error.");
      socket.onclose = () => { stopLive(); };
    } catch (err) { setLiveError(err?.message || "Live voice failed."); stopLive(); }
  }

  function stopLive() {
    try { liveSocketRef.current?.close(); } catch {}
    liveSocketRef.current = null;
    try { liveStreamRef.current?.getTracks().forEach((track) => track.stop()); } catch {}
    liveStreamRef.current = null;
    try {
      const item = liveProcessorRef.current;
      item?.source?.disconnect();
      item?.processor?.disconnect();
      item?.context?.close();
    } catch {}
    liveProcessorRef.current = null;
    setLiveConnected(false);
  }

  useEffect(() => () => stopLive(), []);

  async function startResearch() {
    if (!researchPrompt.trim()) return;
    setResearch({ status: "queued", text: "", id: null }); setWorking(true);
    try {
      const response = await fetch("/api/gemini/research", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: researchPrompt }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Research failed to start.");
      setResearch(data);
      pollResearch(data.id);
    } catch (err) { setResearch({ status: "error", text: err?.message || "Research failed." }); }
    finally { setWorking(false); }
  }
  async function pollResearch(id) {
    for (let i = 0; i < 90; i++) {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      const response = await fetch("/api/gemini/research?id=" + encodeURIComponent(id), { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setResearch({ id, status: "error", text: data.error || "Research lookup failed." }); return; }
      setResearch(data);
      if (["completed", "failed", "cancelled", "error"].includes(data.status)) return;
    }
  }

  async function handleUrl() {
    if (!url.trim()) return;
    setMode("workspace");
    await callGemini({ mode: "url", prompt: flashPrompt || "Summarize the URL and extract the important information.", search: true, urlContext: true, files: [] });
  }

  function clearMemory() {
    memoryRef.current = []; setMemory([]);
    try { localStorage.removeItem("jarvis-memory"); } catch {}
  }

  const state = status === "error" ? "ERROR" : status !== "ready" ? "PROCESSING" : liveConnected ? "LIVE" : "ONLINE";
  const last = [...messages].reverse().find((m) => m.role === "assistant");
  const modeTitle = NAV.find((item) => item[1] === mode)?.[0] || "COMMAND";

  if (!checked) return <main className="boot-screen"><Reactor active /><span>BOOTING JARVIS / GEMINI CORE…</span></main>;
  if (!authenticated) return <AuthGate onAuthenticated={() => setAuthenticated(true)} />;

  return (
    <main className="jarvis-shell">
      <div className="noise" />
      <header className="hud-top">
        <div className="brand-lockup"><div className="brand-mark">J</div><div><span className="micro-label">STARK / AI OPERATIONS</span><strong>JARVIS</strong></div></div>
        <div className="top-readouts"><span>CORE <b>GEMINI 3.8 FLASH</b></span><span>UPLINK <b className="live-dot">● LIVE</b></span><span>MEM <b>{memory.length}</b></span></div>
        <div className={"global-status " + state.toLowerCase()}><i /> {state}</div>
      </header>

      <div className="hud-body">
        <aside className="left-hud">
          <nav>{NAV.map(([label, value]) => <button key={value} className={mode === value ? "selected" : ""} onClick={() => setMode(value)}><span className="nav-glyph">{label.slice(0,2)}</span><span>{label}</span></button>)}</nav>
          <div className="left-footer"><button onClick={() => setMode("live")} className={liveConnected ? "voice-switch on" : "voice-switch"}><span className="equalizer"><i/><i/><i/><i/></span>{liveConnected ? "LIVE ACTIVE" : "LIVE VOICE"}</button><button onClick={clearMemory}>PURGE MEMORY</button></div>
        </aside>

        <section className="center-stage">
          <div className="scene-grid" />
          <div className="corner corner-a" /><div className="corner corner-b" /><div className="corner corner-c" /><div className="corner corner-d" />

          <section className="hero-hud">
            <div className="hero-copy">
              <span className="micro-label">GEMINI 3.8 / MULTIMODAL INTELLIGENCE</span>
              <h1>{mode === "command" ? "At your service." : modeTitle === "FLASH" ? "Think at speed." : modeTitle === "LIVE" ? "Talk naturally." : modeTitle === "CREATE" ? "Make something." : modeTitle === "RESEARCH" ? "Go deeper." : "Bring context."}</h1>
              <p>{mode === "command" ? "JARVIS orchestration plus Gemini's multimodal intelligence, grounded search, files, code, maps, live voice, research, and creative generation." : "One core, multiple experiences — switch modes without leaving mission control."}</p>
              <div className="mission-line"><span /> CURRENT DECK: <b>{modeTitle}</b></div>
            </div>
            <div className="hero-reactor"><Reactor active={working || status !== "ready" || liveConnected} speaking={liveConnected} /></div>
          </section>

          {mode === "command" ? (
            <section className="command-panel">
              <div className="panel-head"><div><span className="micro-label">JARVIS AGENT</span><h2>Command channel</h2></div><div className="tool-trace"><span>SEARCH</span><span>TOOLS</span><span>MEMORY</span></div></div>
              <div className="messages">
                {!messages.length ? <div className="empty-state"><div className="target-reticle"><span/><i/><b/></div><div><span className="micro-label">READY FOR INPUT</span><h3>Give JARVIS a mission.</h3><p>Or jump to FLASH, LIVE, CREATE, RESEARCH, WORKSPACE, or MEMORY.</p></div></div> : null}
                {messages.map((m) => <article key={m.id} className={"message-row " + m.role}><div className="message-avatar">{m.role === "user" ? "U" : "J"}</div><div className="message-body"><div className="message-meta"><span>{m.role === "user" ? "OPERATOR" : "JARVIS"}</span></div><div className="message-text">{textOf(m) || "Running tools…"}</div></div></article>)}
                {error ? <div className="error-bar"><span>MISSION ERROR</span><button onClick={() => sendCommand(input)}>RETRY ↗</button></div> : null}
              </div>
              <form className="command-input" onSubmit={(e) => { e.preventDefault(); sendCommand(); }}>
                <div className="prompt-mark">›</div><input value={input} maxLength={12000} onChange={(e) => setInput(e.target.value)} placeholder="Enter mission or ask JARVIS…" />
                {status !== "ready" && status !== "error" ? <button type="button" onClick={stop}>STOP</button> : null}
                <button type="submit" className="send-button" disabled={!["ready","error"].includes(status) || !input.trim()}>TRANSMIT ↗</button>
              </form>
            </section>
          ) : null}

          {mode === "flash" ? (
            <section className="experience-panel">
              <div className="section-head"><div><span className="micro-label">FLASH CORE</span><h2>Gemini command desk</h2></div><span className="model-badge">gemini-3.8-flash</span></div>
              <div className="preset-row">{PRESETS.map(([name]) => <button key={name} className={preset === name ? "chosen" : ""} onClick={() => setPreset(name)}>{name}</button>)}</div>
              <textarea value={flashPrompt} onChange={(e) => setFlashPrompt(e.target.value)} placeholder="Ask Gemini anything. Current events, reasoning, coding, analysis, planning…" />
              <div className="experience-actions"><button onClick={() => callGemini({ mode:"web", prompt:flashPrompt, files, search:true })}>SEARCH + ANSWER</button><button onClick={runFlash} disabled={working}>RUN FLASH ↗</button></div>
              {flashResult ? <ResultCard data={flashResult} onSpeak={() => speakWithGemini(flashResult.text)} canvas={canvasText} setCanvas={setCanvasText} voiceBusy={voiceBusy} /> : null}
              {geminiChat.length ? <div className="mini-history">{geminiChat.slice(-6).map((m, i) => <div key={i} className={m.role}><b>{m.role === "user" ? "YOU" : "FLASH"}</b><p>{m.text}</p></div>)}</div> : null}
            </section>
          ) : null}

          {mode === "live" ? (
            <section className="experience-panel live-panel">
              <div className="section-head"><div><span className="micro-label">GEMINI LIVE</span><h2>Real-time voice channel</h2></div><span className={"model-badge " + (liveConnected ? "live" : "")}>{liveConnected ? "CONNECTED" : "STANDBY"}</span></div>
              <div className="live-console"><Reactor active={liveConnected} speaking={liveConnected} /><div><div className="live-big">{liveConnected ? "Listening…" : "Push live."}</div><p>Gemini 3.8 Live supports low-latency audio conversation. Your browser mic is streamed as PCM and responses arrive as native audio.</p><div className="live-actions">{!liveConnected ? <button onClick={startLive}>START LIVE ↗</button> : <button className="danger-button" onClick={stopLive}>END SESSION</button>}</div>{liveError ? <div className="inline-error">{liveError}</div> : null}</div></div>
              <div className="live-transcript">{liveTranscript.length ? liveTranscript.map((item, i) => <div key={i}><b>{item.role === "you" ? "YOU" : "JARVIS"}</b><span>{item.text}</span></div>) : <span>TRANSCRIPT WILL APPEAR HERE</span>}</div>
            </section>
          ) : null}

          {mode === "create" ? (
            <section className="experience-panel">
              <div className="section-head"><div><span className="micro-label">GENERATIVE STUDIO</span><h2>Image / video / voice</h2></div><span className="model-badge">NANO BANANA / OMNI / TTS</span></div>
              <textarea value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} placeholder="Describe what you want to create…" />
              <div className="settings-row"><label>SIZE<select value={imageSize} onChange={(e) => setImageSize(e.target.value)}><option>512px</option><option>1K</option><option>2K</option><option>4K</option></select></label><label>RATIO<select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}><option>1:1</option><option>16:9</option><option>9:16</option><option>4:5</option><option>3:4</option><option>21:9</option></select></label><label>VOICE STYLE<input value={voiceStyle} onChange={(e) => setVoiceStyle(e.target.value)} /></label></div>
              <div className="experience-actions"><button onClick={makeImage} disabled={working}>GENERATE IMAGE</button><button onClick={makeVideo} disabled={working}>GENERATE VIDEO</button><button onClick={() => speakWithGemini(imagePrompt)} disabled={voiceBusy}>GENERATE VOICE</button></div>
              {mediaResult?.images?.map((item, i) => <img key={i} className="media-output" src={item.dataUrl} alt="Generated by JARVIS" />)}
              {mediaResult?.videos?.map((item, i) => <video key={i} className="media-output" src={item.dataUrl} controls />)}
              {voiceAudio ? <div className="audio-output"><span className="micro-label">GEMINI FLASH TTS / KORE</span><AudioPlayer dataUrl={voiceAudio} /></div> : null}
              {mediaResult?.error ? <div className="inline-error">{mediaResult.error}</div> : null}
            </section>
          ) : null}

          {mode === "research" ? (
            <section className="experience-panel">
              <div className="section-head"><div><span className="micro-label">DEEP RESEARCH</span><h2>Autonomous research</h2></div><span className="model-badge">DEEP RESEARCH</span></div>
              <textarea value={researchPrompt} onChange={(e) => setResearchPrompt(e.target.value)} placeholder="Give the researcher a complex question or investigation…" />
              <div className="experience-actions"><button onClick={startResearch} disabled={working}>START RESEARCH ↗</button></div>
              {research ? <div className="research-card"><div className="research-status">{String(research.status || "queued").toUpperCase()}</div><p>{research.text || "The research agent is running in the background. This may take several minutes."}</p>{research.text ? <button onClick={() => { setCanvasText(research.text); setMode("workspace"); }}>OPEN IN CANVAS</button> : null}</div> : null}
            </section>
          ) : null}

          {mode === "workspace" ? (
            <section className="experience-panel">
              <div className="section-head"><div><span className="micro-label">CONTEXT WORKSPACE</span><h2>Files, URLs & tools</h2></div><span className="model-badge">{files.length} FILES</span></div>
              <div className="upload-zone"><label><input type="file" multiple accept="image/*,audio/*,video/*,.pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={uploadFiles} />{uploading ? "UPLOADING…" : "ADD FILES ↗"}</label><div className="file-list">{files.map((f) => <span key={f.name}>{f.displayName}</span>)}</div></div>
              <div className="url-row"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/…" /><button onClick={handleUrl}>READ URL ↗</button></div>
              <div className="split-inputs"><textarea value={codePrompt} onChange={(e) => setCodePrompt(e.target.value)} placeholder="Code execution mission…" /><textarea value={mapPrompt} onChange={(e) => setMapPrompt(e.target.value)} placeholder="Maps mission…" /></div>
              <div className="flash-action-grid">{FLASH_ACTIONS.map(([tag, type, prompt, label]) => <button key={tag} onClick={() => { if(type==="code" && codePrompt){}; if(type==="maps" && mapPrompt){}; if(type==="url" && url){}; setFlashPrompt(prompt); runAction(type); }}><span>{tag}</span><strong>{label}</strong></button>)}</div>
              {flashResult ? <ResultCard data={flashResult} onSpeak={() => speakWithGemini(flashResult.text)} canvas={canvasText} setCanvas={setCanvasText} voiceBusy={voiceBusy} /> : null}
            </section>
          ) : null}

          {mode === "memory" ? (
            <section className="experience-panel">
              <div className="section-head"><div><span className="micro-label">LOCAL MEMORY</span><h2>Personal context</h2></div><button className="text-button" onClick={clearMemory}>PURGE ALL</button></div>
              <div className="memory-grid">{memory.length ? memory.map((item) => <div key={item.key + item.value}><span>{item.key}</span><p>{item.value}</p></div>) : <div className="empty-memory">No local memories yet.</div>}</div>
            </section>
          ) : null}
        </section>

        <aside className="right-hud">
          <section className="data-card telemetry"><div className="card-title"><span className="micro-label">TELEMETRY</span><b>LIVE</b></div><div className="telemetry-big">J-04</div><div className="meter-row"><span>CORE</span><i><b style={{width:"92%"}}/></i><em>FLASH</em></div><div className="meter-row"><span>FILES</span><i><b style={{width:Math.min(100,files.length*10)+"%"}}/></i><em>{files.length}</em></div><div className="meter-row"><span>VOICE</span><i><b style={{width:liveConnected?"100%":"12%"}}/></i><em>{liveConnected?"LIVE":"READY"}</em></div></section>
          <section className="data-card focus-card"><div className="card-title"><span className="micro-label">CAPABILITY STACK</span></div>{["Google Search","URL Context","Code Execution","Maps Grounding","Multimodal Files","Live Voice","Image / Video","Deep Research"].map((x) => <div className="cap-line" key={x}><span className="focus-dot" /><b>{x}</b><em>READY</em></div>)}</section>
          <section className="data-card voice-card"><div className="card-title"><span className="micro-label">VOICE ENGINE</span></div><div className="voice-wave">{Array.from({length:18},(_,i)=><i key={i} style={{"--delay":i*40+"ms","--height":(18+(i*13)%52)+"%"}}/>)}</div><strong>{voiceStatus}</strong><p>Gemini 3.8 Flash TTS for high-fidelity speech. Gemini Live for natural two-way conversation.</p>{voiceAudio ? <AudioPlayer dataUrl={voiceAudio} label="Gemini voice output" /> : null}</section>
        </aside>
      </div>

      <footer className="hud-footer"><span>SECURE LINK / PRIVATE NODE</span><span>APPROVAL BOUNDARY ACTIVE</span><span>GEMINI 3.8 FLASH</span></footer>
    </main>
  );
}

function ResultCard({ data, onSpeak, canvas, setCanvas, voiceBusy }) {
  return (
    <div className="result-card">
      <div className="result-head"><span className="micro-label">GEMINI OUTPUT</span><div><button onClick={onSpeak} disabled={voiceBusy}>{voiceBusy ? "SPEAKING…" : "SPEAK ↗"}</button>{data.text ? <button onClick={() => navigator.clipboard?.writeText(data.text)}>COPY</button> : null}</div></div>
      {data.text ? <div className="result-text">{data.text}</div> : null}
      {data.citations?.length ? <div className="citations"><b>SOURCES</b>{data.citations.map((c, i) => <a key={i} href={c.url} target="_blank" rel="noreferrer">{c.title}</a>)}</div> : null}
      {data.images?.map((item, i) => <img key={i} className="media-output" src={item.dataUrl} alt="Gemini output" />)}
      {data.videos?.map((item, i) => <video key={i} className="media-output" src={item.dataUrl} controls />)}
      <div className="canvas-box"><div className="micro-label">CANVAS</div><textarea value={canvas} onChange={(e)=>setCanvas(e.target.value)} /><button onClick={()=>navigator.clipboard?.writeText(canvas)}>COPY CANVAS</button></div>
    </div>
  );
}
