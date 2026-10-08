const ARITHMETIC_RE = /^[0-9().%+\-*/\s×÷]+$/;

export function latestUserText(messages) {
  for (let i = (messages || []).length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== "user") continue;
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content)) {
      return message.content
        .filter((part) => part?.type === "text")
        .map((part) => part.text || "")
        .join(" ");
    }
  }
  return "";
}

export function normalizeArithmeticInput(value) {
  return String(value || "")
    .replace(/[×✕✖]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/\b(multiplied by|times)\b/gi, "*")
    .replace(/\b(divided by)\b/gi, "/")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractArithmeticExpression(value) {
  const normalized = normalizeArithmeticInput(value);
  if (ARITHMETIC_RE.test(normalized)) return normalized;
  const match = normalized.match(/(?:^|\D)(\d+(?:\.\d+)?(?:\s*[+\-*/%]\s*\d+(?:\.\d+)?|\s*\([^)]*\))+(?:\s*[+\-*/%]\s*\d+(?:\.\d+)?)*)/);
  return match?.[1]?.trim() || "";
}

export function firstStepToolChoice(userText) {
  const text = String(userText || "").trim();
  const lower = text.toLowerCase();

  if (/\b(what is|calculate|compute|solve|evaluate)\b/i.test(text) && /\d/.test(text)) {
    return { type: "tool", toolName: "calculator" };
  }
  if (extractArithmeticExpression(text) && /^[\s\d().%+\-*/×÷]+$/.test(text)) {
    return { type: "tool", toolName: "calculator" };
  }
  if (/\b(what time|current time|time is it|date today|today's date)\b/i.test(lower)) {
    return { type: "tool", toolName: "currentTime" };
  }
  if (/\b(weather|temperature|forecast|humidity|wind speed)\b/i.test(lower)) {
    return { type: "tool", toolName: "environmentLookup" };
  }
  if (/\b(open|go to|visit|click|tap|type|scroll|fill|select|navigate|log in|login|dashboard|website|browser)\b/i.test(lower)) {
    return { type: "tool", toolName: "realBrowserAgent" };
  }
  if (/\b(latest|today|current|news|search|research|look up|find out)\b/i.test(lower)) {
    return { type: "tool", toolName: "webSearch" };
  }
  return null;
}
