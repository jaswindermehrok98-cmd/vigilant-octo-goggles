import { GoogleGenAI } from "@google/genai";
import { enforceSameOrigin, requireSession } from "../../../../lib/security.js";
export const runtime="nodejs"; export const maxDuration=20;
export async function POST(request){
 const originError=enforceSameOrigin(request); if(originError)return originError;
 const authError=requireSession(request); if(authError)return authError;
 try{
  if(!process.env.GEMINI_API_KEY) return Response.json({error:"GEMINI_API_KEY is not configured."},{status:503});
  const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
  const token=await ai.authTokens.create({
   config:{uses:1,expireTime:new Date(Date.now()+30*60*1000).toISOString(),newSessionExpireTime:new Date(Date.now()+60*1000).toISOString(),liveConnectConstraints:{model:"gemini-3.8-live",config:{sessionResumption:{},responseModalities:["AUDIO"]}}}
  });
  return Response.json({token:token.name,model:"gemini-3.8-live"},{headers:{"cache-control":"no-store"}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"Live token creation failed."},{status:500});}
}