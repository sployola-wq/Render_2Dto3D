/** Read-only local inference can be retried after a transient transport failure.
 * Never retry cancellation or a validation failure, and never fabricate a result.
 */
export async function requestLocalAnalysis(bytes,mime,{signal,fetchImpl=fetch,pause=()=>new Promise(r=>setTimeout(r,400))}={}){
  for(let attempt=0;attempt<2;attempt++){
    signal?.throwIfAborted();let response;
    try{response=await fetchImpl('./api/analyze',{method:'POST',headers:{'Content-Type':mime},body:bytes,signal});}
    catch(error){if(signal?.aborted||error.name==='AbortError'||attempt)throw error;await pause();continue;}
    if([429,502,503].includes(response.status)&&attempt===0){await pause();continue;}
    const result=await response.json();if(!response.ok)throw new Error(result.error??'Falló la inferencia local.');return result;
  }
}
