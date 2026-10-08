import { enforceSameOrigin, rateLimit, rateLimitResponse, readJsonBody, requireSession } from "../../../../lib/security.js";
import { synthesizeSpeech } from "../../../../lib/google-gemini.js";
export const runtime="nodejs"; export const maxDuration=45;
export async function POST(request){
 const originError=enforceSameOrigin(request); if(originError)return originError;
 const authError=requireSession(request); if(authError)return authError;
 const limit=rateLimit(request,"gemini-tts",15,10*60*1000); if(!limit.allowed)return rateLimitResponse(limit.retryAfter);
 try{
  const body=await readJsonBody(request,20000); const text=typeof body?.text==="string"?body.text.trim():"";
  if(!text)return Response.json({error:"Text is required."},{status:400});
  const audio=await synthesizeSpeech(text,typeof body?.style==="string"?body.style:"calm, intelligent, warm, precise");
  return new Response(Buffer.from(audio.data,"base64"),{headers:{"content-type":audio.mimeType,"cache-control":"no-store","x-content-type-options":"nosniff"}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"Gemini TTS failed."},{status:500});}
}