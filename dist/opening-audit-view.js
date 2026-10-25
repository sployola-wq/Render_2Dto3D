const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const openingBox=o=>o.axis==='h'?[o.from,o.c-o.thickness/2,o.to,o.c+o.thickness/2]:[o.c-o.thickness/2,o.from,o.c+o.thickness/2,o.to];
export function visualCases(data,review) {
  if(!data?.imageSha256||!review?.imageSha256||data.imageSha256!==review.imageSha256)return [];
  return review.cases.filter(c=>data.objects?.some(o=>o.id===c.objectId&&o.category===c.category&&o.bbox.every((v,i)=>Math.abs(v-c.bbox[i])<.01)));
}
export function auditRows(data,architecture,review) {
  return visualCases(data,review).map(c=>{
    const opening=architecture.openings.find(o=>o.objectIds.includes(c.objectId));
    const association=architecture.openingDiagnostics.find(d=>d.objectId===c.objectId)??(opening?{status:'integrated',reason:'legacy-association'}:architecture.unmatchedOpeningIds.includes(c.objectId)?{status:'pending',reason:'legacy-no-support'}:{status:'excluded',reason:'confidence-threshold'});
    return {...c,association,openingId:opening?.id};
  });
}
const reasonLabels={fragmentation:'Fragmentación','corner-support':'Encuentro de muros','axis-and-spurious-run':'Eje / línea fina','fragmentation-and-axis':'Fragmentación / eje','missing-reference-and-short-support':'Referencia / apoyo corto','corner-and-endpoint-offset':'Encuentro / extremos','short-corner-support':'Apoyo corto','missing-reference-and-two-corners':'Referencia / dos encuentros','spurious-run':'Línea fina del marco'};
export function auditPanelHTML(data,before,after,review) {
  const rows=auditRows(data,after,review);if(!rows.length)return '';
  const linked=rows.filter(r=>['integrated','merged'].includes(r.association.status)).length;
  const stats=a=>`<td>${a.stats.associatedOpenings}</td><td>${a.stats.unmatchedOpenings}</td><td>${a.stats.rejectedOpeningFragments}</td>`;
  return `<section class="opening-audit-report" aria-labelledby="auditHeading"><span class="eyebrow">ENSAYO 04 · ABERTURAS</span><h3 id="auditHeading">Cada caso, sobre el plano.</h3><p>${linked} de ${rows.length} propuestas revisadas tienen asociación. ${rows.filter(r=>r.geometryReview).length} ventanas mantienen revisión de geometría. Dos puertas omitidas se añadieron a la referencia; la revisión del agente requiere validación independiente.</p><div class="evaluation-table-wrap"><table class="opening-audit-table"><thead><tr><th>Método</th><th>Cuerpos 3D</th><th>Sin soporte</th><th>Fragmentos excluidos</th></tr></thead><tbody><tr><td>Anterior</td>${stats(before)}</tr><tr><td>Depurado</td>${stats(after)}</tr></tbody></table></div><p class="audit-warning">Tener soporte no garantiza el ancho o la alineación correctos. La ventana vertical de cocina sigue dividida por un tramo que la máscara considera sólido.</p><div class="evaluation-table-wrap"><table class="opening-audit-table"><thead><tr><th>Caso</th><th>Causa</th><th>Asociación</th><th>Detalle</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.category==='door'?'Puerta':'Ventana'} ${esc(r.objectId.replace('semantic-',''))}</td><td>${esc(reasonLabels[r.diagnosis]??r.diagnosis)}</td><td>${r.association.status==='merged'?'Agrupada':r.association.status==='integrated'?'Con soporte':r.association.status==='pending'?'Pendiente':'Fuera del umbral'}</td><td>${r.geometryReview?'<span class="audit-review-label">Revisar</span>':'—'}</td><td><button class="small-button" data-opening-case="${esc(r.objectId)}" aria-label="Ver ${esc(r.objectId)} en el plano">Ver 2D ↗</button></td></tr>`).join('')}</tbody></table></div><div class="evaluation-actions"><button id="inspectOpenings" class="outline-button">Ver aberturas en 2D ↗</button><button id="downloadOpeningAudit" class="outline-button">↓ Descargar auditoría</button></div></section>`;
}
export function drawOpeningAudit({canvas,source,data,reference,architecture,review,focus='all'}) {
  const cases=visualCases(data,review),objects=(data.objects??[]).filter(o=>['door','window'].includes(o.category));
  const selected=focus==='all'?objects.filter(o=>!cases.length||cases.some(c=>c.objectId===o.id)):objects.filter(o=>o.id===focus);
  const ids=new Set(selected.map(o=>o.id)),bodies=architecture.openings.filter(o=>o.objectIds.some(id=>ids.has(id)));
  const refs=(reference?.objects??[]).filter(o=>cases.some(c=>ids.has(c.objectId)&&c.referenceId===o.id));
  let left=0,top=0,width=source.width,height=source.height;
  if(focus!=='all'&&selected.length) {
    const boxes=[...selected.map(o=>o.bbox),...bodies.map(openingBox),...refs.map(o=>o.bbox)];
    const x0=Math.min(...boxes.map(b=>b[0])),x1=Math.max(...boxes.map(b=>b[2])),y0=Math.min(...boxes.map(b=>b[1])),y1=Math.max(...boxes.map(b=>b[3]));
    width=Math.min(source.width,Math.max(220,x1-x0+100));height=Math.min(source.height,Math.max(110,y1-y0+80));
    left=Math.max(0,Math.min(source.width-width,(x0+x1-width)/2));top=Math.max(0,Math.min(source.height-height,(y0+y1-height)/2));
  }
  canvas.width=Math.ceil(width);canvas.height=Math.ceil(height);
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
  ctx.drawImage(source,left,top,width,height,0,0,width,height);ctx.save();ctx.translate(-left,-top);
  const rectangle=(bbox,color,dash)=>{ctx.strokeStyle=color;ctx.lineWidth=focus==='all'?1.2:.8;ctx.setLineDash(dash);ctx.strokeRect(bbox[0],bbox[1],bbox[2]-bbox[0],bbox[3]-bbox[1]);};
  for(const o of refs)rectangle(o.bbox,'#567bac',[3,2]);
  for(const o of selected)rectangle(o.bbox,'#cf8734',[2,2]);
  for(const o of bodies) {
    rectangle(openingBox(o),'#1d8061',[]);
    if(focus!=='all')for(const support of o.supports??[]) {
      const x=o.axis==='h'?support.position:o.c,y=o.axis==='h'?o.c:support.position;
      ctx.fillStyle='#1d8061';ctx.beginPath();ctx.arc(x,y,1.4,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();ctx.setLineDash([]);
}
