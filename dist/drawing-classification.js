/** Identity-bound local classification. The original image never leaves localhost. */
export async function classifyDrawingAsset(asset,canvas,{fetchImpl=fetch}={}){
  if(asset.kind==='dxf')return null;
  const blob=asset.kind==='image'?asset.file:await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)return null;
  try{
    let response;
    for(let attempt=0;attempt<2;attempt++){
      try{response=await fetchImpl('./api/classify',{method:'POST',headers:{'Content-Type':blob.type||'image/jpeg'},body:blob,signal:AbortSignal.timeout(90000)});}
      catch(error){if(attempt)throw error;}
      if(response?.ok||response&&![429,502,503,504].includes(response.status))break;
      if(!attempt)await new Promise(resolve=>setTimeout(resolve,800));
    }
    if(!response.ok)return null;
    const result=await response.json();return result.imageSha256===asset.identity?result:null;
  }catch{return null;}
}
