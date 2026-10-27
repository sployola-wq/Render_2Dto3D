/** Every asynchronous image belongs to one source, frame, discipline and revision. */
export function renderContext(model,domain,width,height){return Object.freeze({identity:model.asset?.identity??null,selection:model.selection,version:model.version,processedHash:model.processedHash,domain,width,height});}
export function sameRenderContext(a,b){return !!a?.identity&&['identity','selection','version','processedHash','domain','width','height'].every(key=>a[key]===b?.[key]);}
export function ownsGeometry(project,asset,width,height){return !!project&&project.sourceHash===asset?.identity&&project.drawing.width===width&&project.drawing.height===height;}
export const PRESENTATION_REVISION=2;
