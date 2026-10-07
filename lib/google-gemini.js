import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.JARVIS_MODEL || "gemini-3.8-flash";
const IMAGE_MODEL = process.env.JARVIS_IMAGE_MODEL || "gemini-3.1-flash-image";
const VIDEO_MODEL = process.env.JARVIS_VIDEO_MODEL || "gemini-omni-1.1-flash";
const TTS_MODEL = process.env.JARVIS_TTS_MODEL || "gemini-3.8-flash-tts";
const RESEARCH_AGENT = process.env.JARVIS_RESEARCH_AGENT || "deep-research-preview-04-2026";

function getClient() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}
function toInput(file) {
  const uri = String(file?.uri || "");
  const mime = String(file?.mimeType || "application/octet-stream");
  if (!uri) throw new Error("Invalid Gemini file reference.");
  const type = mime.startsWith("image/") ? "image" : mime.startsWith("audio/") ? "audio" : mime.startsWith("video/") ? "video" : "document";
  return { type, uri, mime_type: mime };
}
function toolsFor(mode, flags = {}) {
  const out = [];
  if (mode === "chat" || mode === "research" || mode === "web" || flags.search) out.push({ type: "google_search" });
  if (mode === "research" || mode === "url" || flags.urlContext) out.push({ type: "url_context" });
  if (mode === "code" || flags.codeExecution) out.push({ type: "code_execution" });
  if (mode === "maps" || flags.maps) out.push({ type: "google_maps" });
  return out;
}
function collect(interaction) {
  const result = { text: String(interaction?.output_text || ""), images: [], videos: [], audios: [], citations: [] };
  for (const step of interaction?.steps || []) for (const block of step?.content || []) {
    if (block?.type === "image" && block.data) result.images.push({ mimeType:block.mime_type||"image/png", dataUrl:"data:"+(block.mime_type||"image/png")+";base64,"+block.data });
    if (block?.type === "video" && block.data) result.videos.push({ mimeType:block.mime_type||"video/mp4", dataUrl:"data:"+(block.mime_type||"video/mp4")+";base64,"+block.data });
    if (block?.type === "audio" && block.data) result.audios.push({ mimeType:block.mime_type||"audio/wav", dataUrl:"data:"+(block.mime_type||"audio/wav")+";base64,"+block.data });
    for (const a of block?.annotations || []) if (a?.url) result.citations.push({ title:a.title||a.url, url:a.url });
  }
  if (interaction?.output_image?.data) result.images.push({ mimeType:interaction.output_image.mime_type||"image/png", dataUrl:"data:"+(interaction.output_image.mime_type||"image/png")+";base64,"+interaction.output_image.data });
  if (interaction?.output_video?.data) result.videos.push({ mimeType:interaction.output_video.mime_type||"video/mp4", dataUrl:"data:"+(interaction.output_video.mime_type||"video/mp4")+";base64,"+interaction.output_video.data });
  if (interaction?.output_audio?.data) result.audios.push({ mimeType:interaction.output_audio.mime_type||"audio/wav", dataUrl:"data:"+(interaction.output_audio.mime_type||"audio/wav")+";base64,"+interaction.output_audio.data });
  result.citations = result.citations.slice(0,20);
  return result;
}
export async function runGemini({ mode="chat", prompt="", files=[], previousInteractionId=null, search=false, urlContext=false, codeExecution=false, maps=false, imageSize="1K", aspectRatio="1:1" }) {
  const ai = getClient();
  const input = [...files.map(toInput), { type:"text", text:String(prompt).slice(0,20000) }];
  const interaction = await ai.interactions.create({
    model: mode === "image" ? IMAGE_MODEL : mode === "video" ? VIDEO_MODEL : MODEL,
    input,
    previous_interaction_id: previousInteractionId || undefined,
    tools: mode === "image" || mode === "video" ? toolsFor("chat",{search}) : toolsFor(mode,{search,urlContext,codeExecution,maps}),
    ...(mode === "chat" || mode === "web" || mode === "code" || mode === "maps" ? { generation_config: { thinking_level: process.env.JARVIS_THINKING_LEVEL || "low" } } : {}),
    ...(mode === "image" ? { response_format:{ type:"image", aspect_ratio:aspectRatio, image_size:imageSize } } : {}),
    ...(mode === "video" ? { response_format:{ type:"video", aspect_ratio:aspectRatio, resolution:"720p" } } : {})
  });
  return { id:interaction.id, model:mode === "image" ? IMAGE_MODEL : mode === "video" ? VIDEO_MODEL : MODEL, ...collect(interaction) };
}
export async function synthesizeSpeech(text, style="calm, intelligent, warm, precise") {
  const ai=getClient();
  const interaction=await ai.interactions.create({
    model:TTS_MODEL,
    input:[{ type:"user_input", content:[{ type:"text", text:String(text).slice(0,8000), annotations:[{ type:"speech_metadata", style }] }] }],
    response_format:{type:"audio"},
    generation_config:{speech_config:[{voice:process.env.JARVIS_GEMINI_VOICE||"Kore"}]}
  });
  if (!interaction.output_audio?.data) throw new Error("Gemini TTS returned no audio.");
  return { mimeType:interaction.output_audio.mime_type||"audio/wav", data:interaction.output_audio.data };
}
export async function uploadGeminiFile(file) {
  const ai=getClient();
  const bytes=new Uint8Array(await file.arrayBuffer());
  const uploaded=await ai.files.upload({file:new Blob([bytes],{type:file.type||"application/octet-stream"}),config:{mimeType:file.type||"application/octet-stream",displayName:file.name||"JARVIS upload"}});
  return { name:uploaded.name, uri:uploaded.uri, mimeType:uploaded.mimeType||file.type||"application/octet-stream", displayName:uploaded.displayName||file.name||"JARVIS upload", state:uploaded.state||"ACTIVE" };
}
export async function startResearch(prompt) {
  const ai=getClient();
  const interaction=await ai.interactions.create({agent:RESEARCH_AGENT,input:String(prompt).slice(0,12000),agent_config:{type:"deep-research",thinking_summaries:"auto",collaborative_planning:false},background:true});
  return {id:interaction.id,status:interaction.status||"queued",text:String(interaction.output_text||"")};
}
export async function getInteraction(id) {
  const ai=getClient();
  const interaction=await ai.interactions.get({id});
  return {id:interaction.id,status:interaction.status,...collect(interaction)};
}
