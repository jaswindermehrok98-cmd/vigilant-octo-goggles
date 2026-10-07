import { enforceSameOrigin, rateLimit, rateLimitResponse, readJsonBody, requireSession } from "../../../lib/security.js";

export const runtime = "nodejs";
export const maxDuration = 40;

export async function GET(request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const authError = requireSession(request);
  if (authError) return authError;
  return Response.json(
    {
      configured: Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID),
      model: process.env.ELEVENLABS_MODEL_ID || "eleven_v4_turbo",
      voiceConfigured: Boolean(process.env.ELEVENLABS_VOICE_ID)
    },
    { headers: { "cache-control": "no-store" } }
  );
}

export async function POST(request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const authError = requireSession(request);
  if (authError) return authError;

  const limit = rateLimit(request, "speak", 20, 10 * 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  try {
    const body = await readJsonBody(request, 12000);
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, 3000) : "";
    if (!text) return Response.json({ error: "Text is required." }, { status: 400 });

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    if (!apiKey || !voiceId) {
      return Response.json(
        { error: "Voice is not configured. Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID." },
        { status: 503 }
      );
    }

    const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_v4_turbo";
    const response = await fetch(
      "https://api.elevenlabs.io/v1/text-to-speech/" +
        encodeURIComponent(voiceId) +
        "?output_format=mp3_44100_128",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "content-type": "application/json",
          accept: "audio/mpeg"
        },
        body: JSON.stringify({ text, model_id: modelId }),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(30000)])
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      let providerMessage = "";
      try {
        const parsed = JSON.parse(detail);
        providerMessage = parsed?.detail?.message || parsed?.detail?.status || parsed?.message || "";
      } catch {}
      return Response.json(
        { error: "ElevenLabs request failed (" + response.status + ").", detail: String(providerMessage).slice(0, 240) },
        { status: 502 }
      );
    }

    return new Response(await response.arrayBuffer(), {
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff"
      }
    });
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      return Response.json({ error: "Speech generation was cancelled or timed out." }, { status: 504 });
    }
    return Response.json({ error: "Speech generation failed." }, { status: 502 });
  }
}
