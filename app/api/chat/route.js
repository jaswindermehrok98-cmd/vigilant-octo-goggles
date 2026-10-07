import { createAgentUIStreamResponse } from "ai";
import { z } from "zod";
import { jarvis } from "../../../ai/agent.js";
import { enforceSameOrigin, rateLimit, rateLimitResponse, readJsonBody, requireSession } from "../../../lib/security.js";
export const runtime="nodejs"; export const maxDuration=120;
const memoryItem=z.object({key:z.string().min(1).max(80),value:z.string().min(1).max(500),createdAt:z.string().max(64).optional()});
const memoryList=z.array(memoryItem).max(100);
export async function POST(request){const originError=enforceSameOrigin(request);if(originError)return originError;const authError=requireSession(request);if(authError)return authError;const limit=rateLimit(request,"chat",20,5*60*1000);if(!limit.allowed)return rateLimitResponse(limit.retryAfter);try{const body=await readJsonBody(request,200000);if(!Array.isArray(body?.messages))return Response.json({error:"messages must be an array."},{status:400});const memories=memoryList.safeParse(body.memory||[]);if(!memories.success)return Response.json({error:"Invalid memory payload."},{status:400});return createAgentUIStreamResponse({agent:jarvis,uiMessages:body.messages.slice(-40),options:{memory:memories.data},abortSignal:request.signal,sendSources:true});}catch(error){const status=Number(error?.status)||400;return Response.json({error:status===413?"Request body too large.":"The agent request could not be processed."},{status});}}
