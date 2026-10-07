import { enforceSameOrigin, rateLimit, rateLimitResponse, readJsonBody, requireSession } from "../../../lib/security.js";
import { getInteraction, startResearch } from "../../../lib/google-gemini.js";
export const runtime="nodejs"; export const maxDuration=120;
export async function POST(request){
 const originError=enforceSameOrigin(request); if(originError)return originError;
 const authError=requireSession(request); if(authError)return authError;
 const limit=rateLimit(request,"research",4,60*60*1000); if(!limit.allowed)return rateLimitResponse(limit.retryAfter);
 try{const body=await readJsonBody(request,20000); if(!body?.prompt)return Response.json({error:"Research prompt is required."},{status:400}); return Response.json(await startResearch(body.prompt));}
 catch(error){return Response.json({error:error instanceof Error?error.message:"Research start failed."},{status:500});}
}
export async function GET(request){
 const originError=enforceSameOrigin(request); if(originError)return originError;
 const authError=requireSession(request); if(authError)return authError;
 const id=new URL(request.url).searchParams.get("id"); if(!id)return Response.json({error:"Research id is required."},{status:400});
 try{return Response.json(await getInteraction(id),{headers:{"cache-control":"no-store"}});}catch(error){return Response.json({error:error instanceof Error?error.message:"Research lookup failed."},{status:500});}
}