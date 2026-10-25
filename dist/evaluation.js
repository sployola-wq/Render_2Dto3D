export const CATEGORY = {
  door: { label:'Puertas', color:'#c48a45' }, window:{label:'Ventanas',color:'#438eae'},
  bed:{label:'Camas',color:'#8a70b5'}, sofa:{label:'Sofás',color:'#b87b89'}, table:{label:'Mesas',color:'#b39965'},
  chair:{label:'Sillas',color:'#7d9d89'}, toilet:{label:'Inodoros',color:'#699b9e'}, sink:{label:'Lavamanos',color:'#539a9a'},
  bathtub:{label:'Bañeras',color:'#669ab7'}, stove:{label:'Cocinas',color:'#bc8267'}, refrigerator:{label:'Refrigeradores',color:'#879b9e'},
  wardrobe:{label:'Armarios',color:'#a58f73'}, cupboard:{label:'Muebles de guardado',color:'#a58f73'}, desk:{label:'Escritorios',color:'#a59975'},
  appliance:{label:'Electrodomésticos',color:'#b28771'},
  tv:{label:'Televisores',color:'#7d889a'}, washingmachine:{label:'Lavadoras',color:'#8fa5a2'}, aircondition:{label:'Climatización',color:'#a3abb4'},
};
export function bboxIou(a,b) {
  const intersection = Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0])) * Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
  const union = (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - intersection;
  return union > 0 ? intersection / union : 0;
}
export function matchObjects(predictions, references, threshold=.5) {
  const edges = predictions.map(p => references.map((r,j)=>({j,iou:bboxIou(p.bbox,r.bbox)})).filter(e=>e.iou>=threshold).sort((a,b)=>b.iou-a.iou));
  const assigned = new Map();
  const assign = (i,visited) => {
    for (const edge of edges[i]) {
      if (visited.has(edge.j)) continue;
      visited.add(edge.j);
      if (!assigned.has(edge.j) || assign(assigned.get(edge.j),visited)) {assigned.set(edge.j,i);return true;}
    }
    return false;
  };
  predictions.forEach((_,i)=>assign(i,new Set()));
  const used = new Set(assigned.values());
  return { matches:[...assigned].map(([j,i])=>({predictionId:predictions[i].id,referenceId:references[j].id,iou:bboxIou(predictions[i].bbox,references[j].bbox)})),
    falsePositiveIds:predictions.filter((_,i)=>!used.has(i)).map(o=>o.id),
    falseNegativeIds:references.filter((_,j)=>!assigned.has(j)).map(o=>o.id) };
}
export function wallMask(data) {
  const {width,height} = data, mask = new Uint8Array(width*height);
  for (const wall of data.walls??[]) {
    const x0 = wall.axis === 'h' ? wall.from : wall.c-wall.thickness/2;
    const x1 = wall.axis === 'h' ? wall.to : wall.c+wall.thickness/2;
    const y0 = wall.axis === 'h' ? wall.c-wall.thickness/2 : wall.from;
    const y1 = wall.axis === 'h' ? wall.c+wall.thickness/2 : wall.to;
    for(let y=Math.max(0,Math.ceil(y0-.5));y<Math.min(height,Math.ceil(y1-.5));y++)
      for(let x=Math.max(0,Math.ceil(x0-.5));x<Math.min(width,Math.ceil(x1-.5));x++) mask[y*width+x]=1;
  }
  for(const polygon of data.wallPolygons??[]) {
    const rings = [polygon.outer,...(polygon.holes??[])];
    const ymin=Math.max(0,Math.floor(Math.min(...polygon.outer.map(p=>p[1]))));
    const ymax=Math.min(height-1,Math.ceil(Math.max(...polygon.outer.map(p=>p[1]))));
    for(let y=ymin;y<=ymax;y++) {
      const intersections=[], scan=y+.5;
      for(const ring of rings) for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
        const [x0,y0]=ring[j], [x1,y1]=ring[i];
        if((y0>scan)!==(y1>scan)) intersections.push(x0+(scan-y0)*(x1-x0)/(y1-y0));
      }
      intersections.sort((a,b)=>a-b);
      for(let i=0;i+1<intersections.length;i+=2)
        for(let x=Math.max(0,Math.ceil(intersections[i]-.5));x<Math.min(width,Math.ceil(intersections[i+1]-.5));x++) mask[y*width+x]=1;
    }
  }
  return mask;
}
export function evaluatePrediction(prediction, reference, confidence=.35) {
  if(!prediction || !reference || prediction.imageSha256!==reference.imageSha256 || prediction.width!==reference.width || prediction.height!==reference.height) return null;
  const categories=reference.evaluation.objectCategories, rows=[];
  for(const category of categories) {
    const predictions=(prediction.objects??[]).filter(o=>o.category===category && o.confidence>=confidence);
    const references=reference.objects.filter(o=>o.category===category);
    const match=matchObjects(predictions,references,reference.evaluation.bboxIouThreshold);
    const tp=match.matches.length, fp=match.falsePositiveIds.length, fn=match.falseNegativeIds.length;
    rows.push({category,tp,fp,fn,predicted:predictions.length,expected:references.length,
      precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null,...match});
  }
  const predictedMask=wallMask(prediction), referenceMask=wallMask(reference);
  let intersection=0,union=0;
  for(let i=0;i<predictedMask.length;i++){if(predictedMask[i]&&referenceMask[i])intersection++;if(predictedMask[i]||referenceMask[i])union++;}
  const tp=rows.reduce((s,r)=>s+r.tp,0), fp=rows.reduce((s,r)=>s+r.fp,0), fn=rows.reduce((s,r)=>s+r.fn,0);
  return {scope:'single-image-initial-manual-reference',confidence,bboxIouThreshold:reference.evaluation.bboxIouThreshold,rows,
    wallIou:union?intersection/union:null,wallIntersectionPixels:intersection,wallUnionPixels:union,
    totals:{tp,fp,fn,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null},
    note:'Una imagen con referencia manual inicial; no estima precisión sobre otros planos.'};
}
