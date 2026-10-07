import { enforceSameOrigin, requireSession } from "../../../lib/security.js";
import { uploadGeminiFile } from "../../../lib/google-gemini.js";
export const runtime="nodejs";
export const maxDuration=120;
export async function POST(request){
  const originError=enforceSameOrigin(request); if(originError)return originError;
  const authError=requireSession(request); if(authError)return authError;
  try{
    const form=await request.formData(); const file=form.get("file");
    if(!(file instanceof File)) return Response.json({error:"No file supplied."},{status:400});
    if(file.size>50*1024*1024) return Response.json({error:"File is too large (50MB max for this upload path)."}, {status:413});
    const uploaded=await uploadGeminiFile(file);
    return Response.json(uploaded,{headers:{"cache-control":"no-store"}});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"File upload failed."},{status:500});}
}