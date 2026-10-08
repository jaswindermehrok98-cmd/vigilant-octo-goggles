import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import Browserbase from "@browserbasehq/sdk";
import { z } from "zod";

const DEFAULT_ALLOWED = [
  "vercel.com",
  "github.com",
  "youtube.com",
  "linkedin.com",
  "web.whatsapp.com",
  "google.com",
  "accounts.google.com",
  "browserbase.com",
  "stagehand.dev",
  "npmjs.com",
  "stackoverflow.com",
  "developer.mozilla.org",
  "ai.google.dev",
  "ai-sdk.dev"
];

const dangerous = /\b(delete|remove|cancel|buy|purchase|checkout|pay|payment|transfer|send money|change password|close account|factory reset|wipe|format|publish|post publicly|send email|submit application)\b/i;

function allowedDomains() {
  const configured = (process.env.BROWSER_ALLOWED_DOMAINS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase().replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_ALLOWED;
}

function domainAllowed(hostname) {
  const host = hostname.toLowerCase().replace(/^\.+|\.+$/g, "");
  return allowedDomains().some((domain) => host === domain || host.endsWith("." + domain));
}

function safeHttpUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Only HTTPS browser navigation is allowed.");
  if (url.username || url.password) throw new Error("Browser URLs cannot contain credentials.");
  if (url.port && url.port !== "443") throw new Error("Non-standard ports are blocked.");
  if (!domainAllowed(url.hostname)) throw new Error("That domain is not in JARVIS's browser allowlist.");
  return url.toString();
}

function inferStartUrl(objective) {
  const text = objective.toLowerCase();
  const explicit = objective.match(/https?:\/\/[^\s]+/i)?.[0]?.replace(/[),.]+$/, "");
  if (explicit) return explicit;
  if (/\b(vercel|deployments?|deployment dashboard)\b/.test(text)) return "https://vercel.com/dashboard";
  if (/\b(github|repo|repository|pull request|issues?)\b/.test(text)) return "https://github.com/";
  if (/\b(whatsapp)\b/.test(text)) return "https://web.whatsapp.com/";
  if (/\b(linkedin)\b/.test(text)) return "https://www.linkedin.com/";
  if (/\b(youtube)\b/.test(text)) return "https://www.youtube.com/";
  if (/\b(google)\b/.test(text)) return "https://www.google.com/";
  return undefined;
}

function approvedByUser(objective) {
  return /\b(confirm|confirmed|i approve|i confirm|yes,? proceed)\b/i.test(objective);
}

async function getLiveViewUrl(apiKey, sessionId) {
  if (!apiKey || !sessionId) return "";
  try {
    const client = new Browserbase({ apiKey });
    const debug = await client.sessions.debug(sessionId);
    return debug.debuggerFullscreenUrl || debug.debuggerUrl || debug.pages?.[0]?.debuggerFullscreenUrl || "";
  } catch {
    return "";
  }
}

function summarizeObservation(items) {
  if (!Array.isArray(items) || !items.length) return "No actionable elements were observed.";
  return items.slice(0, 8).map((item, i) => {
    const what = item?.description || item?.method || item?.selector || "action";
    return String(i + 1) + ". " + String(what).slice(0, 240);
  }).join("\n");
}

export const browserAgentInput = z.object({
  objective: z.string().min(2).max(2500),
  startUrl: z.string().url().max(2000).optional(),
  sessionId: z.string().max(200).optional(),
  maxSteps: z.number().int().min(1).max(12).default(8)
});

export async function runBrowserAgent({ objective, startUrl, sessionId, maxSteps = 8 }) {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) return { ok: false, status: "needs-setup", error: "BROWSERBASE_API_KEY is not configured." };

  if (dangerous.test(objective) && !approvedByUser(objective)) {
    return {
      ok: false,
      status: "needs-approval",
      error: "This browser objective can create a destructive, financial, account-changing, or externally visible side effect. Ask the user for explicit confirmation before executing it."
    };
  }

  let browser;
  let stagehand;

  try {
    const contextId = process.env.BROWSERBASE_CONTEXT_ID?.trim();
    if (sessionId) {
      browser = await browserbase.connect({ apiKey, sessionId });
    } else {
      const launch = { apiKey, keepAlive: true };
      if (contextId) {
        launch.browserSettings = { context: { id: contextId, persist: true } };
      }
      browser = await browserbase.launch(launch);
    }

    stagehand = await Stagehand.create({ browser, cache: true });
    const page = (await browser.context.activePage()) || (await browser.context.newPage());

    const initialUrl = startUrl || inferStartUrl(objective);
    if (initialUrl) {
      await page.goto(safeHttpUrl(initialUrl), { waitUntil: "domcontentloaded" }).catch(async () => {
        await page.goto(safeHttpUrl(initialUrl));
      });
    }

    const events = [];
    let lastAction = "";
    let completed = false;

    for (let step = 1; step <= maxSteps; step += 1) {
      const currentUrl = await page.url().catch(() => "");
      const title = await page.title().catch(() => "");

      const observed = await page.observe({
        instruction: "Find the safest next actionable browser interaction that advances this objective: " + objective,
        onlyVisible: false,
        returnAction: true
      }).catch(() => []);

      events.push({
        step,
        phase: "OBSERVE",
        url: currentUrl,
        title,
        details: summarizeObservation(observed)
      });

      if (observed?.length) {
        await page.act(observed[0]);
        lastAction = String(observed[0]?.description || observed[0]?.method || "browser action").slice(0, 300);
      } else {
        await page.act("Perform the safest next single action needed to advance this objective: " + objective);
        lastAction = objective.slice(0, 300);
      }

      events.push({ step, phase: "ACT", details: lastAction });

      const verify = await page.extract({
        instruction:
          "Assess whether this browser objective is complete. Return true only when the requested outcome is visibly achieved: " +
          objective,
        schema: z.object({
          complete: z.boolean(),
          evidence: z.string().max(500),
          currentTask: z.string().max(300)
        }),
      }).catch(() => ({ complete: false, evidence: "Verification unavailable.", currentTask: "Continue objective." }));

      events.push({
        step,
        phase: "VERIFY",
        details: String(verify?.evidence || "").slice(0, 500),
        complete: Boolean(verify?.complete)
      });

      if (verify?.complete) {
        completed = true;
        break;
      }
    }

    const finalUrl = await page.url().catch(() => "");
    const finalTitle = await page.title().catch(() => "");
    const liveViewUrl = browser.sessionId
      ? await getLiveViewUrl(apiKey, browser.sessionId)
      : "";

    return {
      ok: completed,
      status: completed ? "complete" : "incomplete",
      objective,
      sessionId: browser.sessionId || sessionId || null,
      finalPage: { url: finalUrl, title: finalTitle },
      steps: events,
      liveViewUrl,
      note: completed
        ? "The browser outcome was observed and verified."
        : "The browser session remains available for another objective."
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      sessionId: browser?.sessionId || sessionId || null,
      error: error instanceof Error ? error.message.slice(0, 800) : "Browser agent failed."
    };
  } finally {
    try { await stagehand?.close(); } catch {}
  }
}
