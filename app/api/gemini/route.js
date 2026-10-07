import { enforceSameOrigin, rateLimit, rateLimitResponse, readJsonBody, requireSession } from "../../../lib/security.js";
import { runGemini } from "../../../lib/google-gemini.js";
export const runtime="nodejs";
export const maxDuration=120;
export async function POST(request){
  const originError=enforceSameOrigin(request); if(originError)return originError;
  const authError=requireSession(request); if(authError)return authError;
  const limit=rateLimit(request,"gemini",15,5*60*1000); if(!limit.allowed)return rateLimitResponse(limit.retryAfter);
  try{
    const body=await readJsonBody(request,300000);
    const result=await runGemini({
      mode:body?.mode||"chat", prompt:body?.prompt||"", files:Array.isArray(body?.files)?body.files.slice(0,10):[],
      previousInteractionId:body?.previousInteractionId||null,
      search:Boolean(body?.search), urlContext:Boolean(body?.urlContext), codeExecution:Boolean(body?.codeExecution),
      maps:Boolean(body?.maps), imageSize:body?.imageSize||"1K", aspectRatio:body?.aspectRatio||"1:1"
    });
    return Response.json(result,{headers:{"cache-control":"no-store"}});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Gemini request failed."},{status:500});}
}