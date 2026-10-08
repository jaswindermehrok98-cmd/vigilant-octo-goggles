export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      ok: true,
      service: "JARVIS",
      version: "4.0.0",
      runtime: process.version,
      configured: {
        gemini: Boolean(process.env.GEMINI_API_KEY),
        tavily: Boolean(process.env.TAVILY_API_KEY),
        browserbase: Boolean(process.env.BROWSERBASE_API_KEY),
        browserbaseContext: Boolean(process.env.BROWSERBASE_CONTEXT_ID),
        elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID),
        browserless: Boolean(process.env.BROWSERLESS_TOKEN),
        auth: Boolean(process.env.JARVIS_ACCESS_TOKEN)
      },
      models: {
        agent: process.env.JARVIS_MODEL || "gemini-3.8-flash",
        image: process.env.JARVIS_IMAGE_MODEL || "gemini-3.1-flash-image",
        video: process.env.JARVIS_VIDEO_MODEL || "gemini-omni-1.1-flash",
        tts: process.env.JARVIS_TTS_MODEL || "gemini-3.8-flash-tts",
        live: "gemini-3.8-live"
      }
    },
    {
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff"
      }
    }
  );
}
