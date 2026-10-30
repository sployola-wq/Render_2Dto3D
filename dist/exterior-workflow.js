/** Building depth and sheet relief thickness are independent user settings. */
export const EXTERIOR_DEFAULTS=Object.freeze({exteriorMode:'volume',roofStyle:'auto',depthMm:6000,buildingDepthMm:6000,reliefDepthMm:300,exteriorWorkflowVersion:5});
const positive=(value,fallback)=>Number.isFinite(value)&&value>0?value:fallback;
export function restoreExteriorSettings(params,saved={}){
  const next={...EXTERIOR_DEFAULTS,...params};
  if(saved.exteriorWorkflowVersion!==EXTERIOR_DEFAULTS.exteriorWorkflowVersion){
    // Earlier defaults selected a picture relief or a conceptual building.
    // Migrate them to the reconstruction registered to the actual Step 2.
    const wasBuilding=saved.exteriorMode==='spatial';
    next.buildingDepthMm=positive(saved.buildingDepthMm,wasBuilding||saved.exteriorMode==='registered'?positive(saved.depthMm,6000):6000);
    next.reliefDepthMm=positive(saved.reliefDepthMm,saved.exteriorMode==='projection'?positive(saved.depthMm,300):300);
    next.exteriorMode=saved.exteriorWorkflowVersion===4&&['projection','spatial'].includes(saved.exteriorMode)?saved.exteriorMode:'volume';next.depthMm=next.exteriorMode==='projection'?positive(saved.depthMm,300):next.buildingDepthMm;
  }else if(next.exteriorMode==='projection'){
    next.depthMm=positive(next.depthMm,300);next.reliefDepthMm=next.depthMm;
  }else{
    next.exteriorMode=next.exteriorMode==='spatial'?'spatial':'volume';next.depthMm=positive(next.depthMm,6000);next.buildingDepthMm=next.depthMm;
  }
  next.exteriorWorkflowVersion=EXTERIOR_DEFAULTS.exteriorWorkflowVersion;
  return next;
}
export function switchExteriorMode(params,mode){
  if(!['volume','registered','spatial','projection'].includes(mode))throw new Error('Modo exterior no válido.');
  const next={...params,exteriorWorkflowVersion:EXTERIOR_DEFAULTS.exteriorWorkflowVersion};
  if(params.exteriorMode==='projection')next.reliefDepthMm=positive(params.depthMm,300);
  else next.buildingDepthMm=positive(params.depthMm,6000);
  next.exteriorMode=mode;next.depthMm=positive(mode!=='projection'?next.buildingDepthMm:next.reliefDepthMm,mode!=='projection'?6000:300);
  return next;
}
