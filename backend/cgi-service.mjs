import { assertDiscipline } from '../dist/discipline-analysis.js';
import { FINISH_PRESETS } from '../dist/blueprint-preprocess.js';

export class CGIError extends Error {
  constructor(status,code,message){super(message);this.status=status;this.code=code;}
}
export function renderPrompt({preset='oak',stylePrompt='',domain='interior'}) {
  if(typeof stylePrompt!=='string'||stylePrompt.length>2000)throw new CGIError(400,'INVALID_STYLE','Las instrucciones de acabado deben tener hasta 2.000 caracteres.');
  try{assertDiscipline(domain);}catch{throw new CGIError(400,'INVALID_DISCIPLINE','Selecciona una disciplina compatible.');}
  if(domain!=='interior')return [
    domain==='exterior'?'Create a realistic exterior architectural presentation from the supplied elevation or facade drawing. Preserve its projection, framing, silhouette, storey count, openings and visible facade details. Do not turn it into a floor plan or overhead cutaway.':domain==='mechanical'?'Create a technical mechanical product illustration from the supplied engineering drawing. Preserve its shaft axes, silhouette, proportions, visible bores and depicted components. When the input shows a section, render an open longitudinal cutaway retaining the depicted internal cavities, bearings, walls and section faces. Do not replace an internal section with a closed exterior shell. Distinguish unsectioned shafts from voids according to the drawing convention. Never interpret cross-hatching or callout lines as walls, rooms or furniture.':'Create a structural engineering visualization from the supplied frame drawing. Preserve member axes, connectivity and projection. Do not turn auxiliary dimension lines into members or invent connections.',
    'The output is a visual proposal, not validated CAD or an inference of hidden geometry. Do not invent dimensions, cavities, supports or unseen features. No decorative furniture, labels or watermark.',stylePrompt.trim()
  ].filter(Boolean).join('\n');
  return [
    'Transform the supplied architectural floor-plan image into a photorealistic architectural overhead CGI presentation, looking exactly straight down at 90 degrees.',
    'Preserve the complete image framing, orientation, outline, room layout, wall positions, openings and proportions. Do not crop, rotate, move walls, invent rooms, add doors, duplicate furniture or infer dimensions. Keep empty spaces empty unless the plan clearly shows furniture.',
    'Use realistic materials, restrained furnishings matching the original symbols, daylight and soft ambient occlusion. Show wall cutaways. No labels, text, diagnostic marks or watermarks.',
    FINISH_PRESETS[preset]?.prompt??FINISH_PRESETS.oak.prompt,
    stylePrompt.trim()
  ].filter(Boolean).join('\n');
}
export function outputSize(width,height){
  const ratio=width/height;if(ratio>3||ratio<1/3)throw new CGIError(400,'ASPECT_RATIO','El render IA admite proporciones entre 1:3 y 3:1. Usa el render técnico para esta lámina.');
  const factor=1536/Math.max(width,height);return `${Math.max(512,Math.round(width*factor/16)*16)}x${Math.max(512,Math.round(height*factor/16)*16)}`;
}
export function validateRenderRequest(body){
  if(!body||!/^[a-f0-9]{64}$/.test(body.sourceHash??'')||![body.width,body.height].every(n=>Number.isInteger(n)&&n>=64&&n<=1400))throw new CGIError(400,'INVALID_SOURCE','El plano de origen no tiene una identidad o dimensiones válidas.');
  if(typeof body.imageDataUrl!=='string'||body.imageDataUrl.length>14*1024*1024||!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(body.imageDataUrl))throw new CGIError(400,'INVALID_IMAGE','Se requiere una lámina PNG válida, de hasta 10 MB.');
  const bytes=Buffer.from(body.imageDataUrl.split(',')[1],'base64');
  if(bytes.length<24||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(16)!==body.width||bytes.readUInt32BE(20)!==body.height)throw new CGIError(400,'INVALID_IMAGE','La lámina PNG no coincide con las dimensiones indicadas.');
  return {image:bytes,prompt:renderPrompt(body),size:outputSize(body.width,body.height)};
}
export async function generateCGI(body,{apiKey=process.env.OPENAI_API_KEY,model=process.env.OPENAI_IMAGE_MODEL||'gpt-image-2.5-sunburst',fetchImpl=fetch,signal}={}){
  const input=validateRenderRequest(body);
  if(!apiKey||apiKey==='YOUR_OPENAI_API_KEY')throw new CGIError(503,'NOT_CONFIGURED','OpenAI no está configurado. Agrega OPENAI_API_KEY al archivo .env del servidor y reinícialo. El render técnico sigue disponible.');
  const response=await fetchImpl('https://api.openai.com/v1/images/edits',{
    method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({model,images:[{image_url:body.imageDataUrl}],prompt:input.prompt,size:input.size,quality:'high',output_format:'png',n:1}),
    signal:signal?AbortSignal.any([signal,AbortSignal.timeout(180000)]):AbortSignal.timeout(180000)
  });
  if(!response.ok){
    const status=response.status;
    // Provider error bodies may contain account information; never echo them to the browser.
    throw new CGIError(status===429?429:status===401||status===403?502:503,status===429?'RATE_LIMIT':status===401||status===403?'PROVIDER_ACCESS':'PROVIDER_ERROR',status===429?'OpenAI indica un límite de uso o cuota. No se ha reemplazado el render actual.':status===401||status===403?'Revisa la clave y el acceso al modelo de imágenes en OpenAI.':'El proveedor no pudo generar la imagen. Puedes reintentar; el render actual se conserva.');
  }
  const result=await response.json(),data=result.data?.[0]?.b64_json;
  if(typeof data!=='string'||data.length>40*1024*1024||!data.startsWith('iVBOR'))throw new CGIError(502,'NO_IMAGE','OpenAI no devolvió una imagen PNG utilizable. El render actual se conserva.');
  return {imageDataUrl:`data:image/png;base64,${data}`,sourceHash:body.sourceHash,provider:'OpenAI',model,geometryValidated:false};
}
