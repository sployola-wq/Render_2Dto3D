// Geometry-only association. Annotations and visual audit decisions are never inputs.
const median=values=>{const a=[...values].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length?(a.length%2?a[m]:(a[m-1]+a[m])/2):0;};
const overlap=(a,b,c,d)=>Math.max(0,Math.min(b,d)-Math.max(a,c));
const dimensions=b=>({w:b[2]-b[0],h:b[3]-b[1],cx:(b[0]+b[2])/2,cy:(b[1]+b[3])/2});
const projected=(bbox,axis)=>axis==='h'?{from:bbox[0],to:bbox[2],c:(bbox[1]+bbox[3])/2,short:bbox[3]-bbox[1]}:{from:bbox[1],to:bbox[3],c:(bbox[0]+bbox[2])/2,short:bbox[2]-bbox[0]};
function density(mask,width,height,bbox) {
  if(!mask)return null;
  let count=0,total=0;
  for(let y=Math.max(0,Math.floor(bbox[1]));y<Math.min(height,Math.ceil(bbox[3]));y++)for(let x=Math.max(0,Math.floor(bbox[0]));x<Math.min(width,Math.ceil(bbox[2]));x++){count+=mask[y*width+x];total++;}
  return total?count/total:0;
}
function mergedBox(a,b){return [Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])];}
function groupFragments(objects,context) {
  const groups=[];
  for(const object of objects) {
    let group={id:object.id,category:object.category,bbox:[...object.bbox],objectIds:[object.id],confidence:object.confidence,reviewRequired:true};
    let changed=true;
    while(changed) {
      changed=false;
      for(let i=0;i<groups.length;i++) {
        const other=groups[i];if(other.category!==group.category)continue;
        const a=dimensions(group.bbox),b=dimensions(other.bbox),axis=a.w>=a.h?'h':'v';
        if((b.w>=b.h?'h':'v')!==axis)continue;
        const p=projected(group.bbox,axis),q=projected(other.bbox,axis),maxShort=Math.max(p.short,q.short),gap=Math.max(p.from-q.to,q.from-p.to,0);
        if(Math.abs(p.c-q.c)>Math.max(2,maxShort*.8))continue;
        const intervalOverlap=overlap(p.from,p.to,q.from,q.to);
        if(group.category==='door'&&intervalOverlap<Math.min(p.to-p.from,q.to-q.from)*.7)continue;
        if(gap>Math.max(maxShort*2,(p.to-p.from+q.to-q.from)*.35))continue;
        if(gap>0) {
          // A solid pier between close windows is not a fragmented opening.
          const from=Math.min(p.to,q.to),to=Math.max(p.from,q.from),c=(p.c+q.c)/2;
          const strip=axis==='h'?[from,c-maxShort/2,to,c+maxShort/2]:[c-maxShort/2,from,c+maxShort/2,to];
          const fill=density(context.mask,context.width,context.height,strip);
          if(fill===null||fill>.45)continue;
        }
        group={...group,bbox:mergedBox(group.bbox,other.bbox),objectIds:[...group.objectIds,...other.objectIds],confidence:Math.max(group.confidence??0,other.confidence??0)};
        groups.splice(i,1);changed=true;break;
      }
    }
    groups.push(group);
  }
  return groups;
}
export function associateOpeningsDetailed(objects,runs,context={}) {
  const proposals=objects.filter(o=>['door','window'].includes(o.category));
  const typical=context.typicalWallThickness??(median(runs.filter(r=>r.thickness>=2).map(r=>r.thickness))||4);
  const minimumSolid=Math.max(2,Math.floor(typical*.35)),solid=runs.filter(r=>r.thickness>=minimumSolid);
  const groups=groupFragments(proposals,context),openings=[],diagnostics=[];
  for(const group of groups) {
    const size=dimensions(group.bbox),long=Math.max(size.w,size.h),small=long<(group.category==='door'?Math.max(10,typical*1.4):Math.max(6,typical*.75));
    const emit=(status,reason,extra={})=>{
      for(const id of group.objectIds)diagnostics.push({objectId:id,category:group.category,status,reason,groupIds:[...group.objectIds],detectedBbox:proposals.find(o=>o.id===id).bbox,...extra});
    };
    if(small){emit('rejected','small-fragment');continue;}
    const axes=Math.max(size.w,size.h)/Math.max(1,Math.min(size.w,size.h))>=2?[size.w>=size.h?'h':'v']:['h','v'];
    const options=[];
    for(const axis of axes) {
      const p=projected(group.bbox,axis),length=p.to-p.from,mid=(p.from+p.to)/2;
      const nearby=solid.filter(r=>r.axis===axis&&Math.abs(r.c-p.c)<=Math.max(2,Math.min(r.thickness,typical)*.75,p.short*.6)&&r.to>=p.from-typical*8&&r.from<=p.to+typical*8);
      const centers=(nearby.length?nearby.map(r=>r.c):[p.c]).filter((c,i,a)=>a.findIndex(v=>Math.abs(v-c)<.5)===i);
      for(const c of centers) {
        const aligned=nearby.filter(r=>Math.abs(r.c-c)<=Math.max(2,r.thickness*.6));
        const localThickness=median(aligned.map(r=>r.thickness))||typical;
        const maxExtension=group.category==='window'?Math.max(localThickness*3,length*2):Math.max(localThickness*2.5,length*.3);
        const left=[],right=[];
        for(const run of aligned) {
          if(run.to<=mid&&run.to>=p.from-maxExtension)left.push({position:run.to,kind:'collinear',runId:run.id,axisCoordinate:run.c,thickness:run.thickness,penalty:0});
          if(run.from>=mid&&run.from<=p.to+maxExtension)right.push({position:run.from,kind:'collinear',runId:run.id,axisCoordinate:run.c,thickness:run.thickness,penalty:0});
        }
        for(const run of solid.filter(r=>r.axis!==axis)) {
          const crossGap=Math.max(run.from-c,c-run.to,0);
          if(crossGap>(run.thickness+localThickness)/2+3)continue;
          const tolerance=Math.max(2,(run.thickness+localThickness)/2);
          if(run.c<mid&&Math.abs(run.c-p.from)<=maxExtension+tolerance)left.push({position:run.c+run.thickness/2,kind:'corner',runId:run.id,thickness:run.thickness,penalty:crossGap*.2});
          if(run.c>mid&&Math.abs(run.c-p.to)<=maxExtension+tolerance)right.push({position:run.c-run.thickness/2,kind:'corner',runId:run.id,thickness:run.thickness,penalty:crossGap*.2});
        }
        for(const a of left)for(const b of right) {
          const span=b.position-a.position,thickness=(a.thickness+b.thickness)/2;
          if(span<Math.max(6,thickness*.9)||span>length*(group.category==='window'?3:2.2)||a.position>p.from+thickness||b.position<p.to-thickness)continue;
          // Both independent supports are necessary. No full-wall/no-gap shortcut.
          if(a.runId===b.runId)continue;
          const score=Math.abs(c-p.c)*4+Math.abs(a.position-p.from)+Math.abs(b.position-p.to)+a.penalty+b.penalty+Math.abs(a.thickness-b.thickness)*.3;
          options.push({axis,c,from:a.position,to:b.position,thickness,score,supports:[a,b],detectedSpan:{from:p.from,to:p.to}});
        }
      }
    }
    options.sort((a,b)=>a.score-b.score);
    const best=options[0];
    if(!best){emit('pending','insufficient-jamb-support');continue;}
    const alternative=options.find(o=>o.axis!==best.axis);
    if(alternative&&alternative.score<best.score+2){emit('pending','ambiguous-orientation');continue;}
    let {from,to}=best;
    if(group.category==='door') {
      // Keep semantic extents when a damaged parallel wall ends too far away;
      // actual corner supports can define the physical inner jamb face.
      if(best.supports[0].kind==='collinear'&&Math.abs(from-best.detectedSpan.from)>best.thickness*.6)from=best.detectedSpan.from;
      if(best.supports[1].kind==='collinear'&&Math.abs(to-best.detectedSpan.to)>best.thickness*.6)to=best.detectedSpan.to;
    }
    const collinear=best.supports.filter(s=>s.kind==='collinear');
    const center=collinear.length?collinear.reduce((n,s)=>n+s.axisCoordinate*s.thickness,0)/collinear.reduce((n,s)=>n+s.thickness,0):best.c;
    const opening={id:`opening-${group.objectIds.slice().sort().join('-')}`,objectIds:[...group.objectIds],category:group.category,axis:best.axis,c:center,from,to,thickness:best.thickness,confidence:group.confidence,wallId:best.supports.map(s=>s.runId).join('+'),supports:best.supports,supportSpan:{from:best.from,to:best.to},extentSource:group.category==='window'?'paired-jambs':'semantic-and-jambs',reviewRequired:true};
    // Resolve duplicates within a category only; a door cannot become a window.
    const duplicate=openings.find(o=>o.category===opening.category&&o.axis===opening.axis&&Math.abs(o.c-opening.c)<=Math.max(o.thickness,opening.thickness)&&overlap(o.from,o.to,opening.from,opening.to)>=Math.min(o.to-o.from,opening.to-opening.from)*.65);
    const reason=best.supports.some(s=>s.kind==='corner')?'corner-jambs':'paired-collinear-jambs';
    if(duplicate){duplicate.objectIds.push(...group.objectIds);emit('merged','duplicate-proposal',{openingId:duplicate.id,supports:best.supports});}
    else {openings.push(opening);emit('integrated',reason,{openingId:opening.id,supports:best.supports});}
  }
  // A fragment already contained in a supported opening adds provenance, not a
  // second frame. This never enlarges a hole or crosses an intervening pier.
  for(const diagnostic of diagnostics.filter(d=>d.status==='pending')) {
    const matches=openings.filter(o=>{
      if(o.category!==diagnostic.category)return false;
      const p=projected(diagnostic.detectedBbox,o.axis);
      return Math.abs(p.c-o.c)<=Math.max(o.thickness,p.short*.8)&&overlap(p.from,p.to,o.from,o.to)>=.8*(p.to-p.from);
    });
    if(matches.length===1){const opening=matches[0];opening.objectIds.push(diagnostic.objectId);diagnostic.status='merged';diagnostic.reason='contained-fragment';diagnostic.openingId=opening.id;diagnostic.supports=opening.supports;}
  }
  const conflicts=new Set();
  for(let i=0;i<openings.length;i++)for(let j=i+1;j<openings.length;j++) {
    const a=openings[i],b=openings[j];
    if(a.category!==b.category&&a.axis===b.axis&&Math.abs(a.c-b.c)<=Math.min(a.thickness,b.thickness)&&overlap(a.from,a.to,b.from,b.to)>=.75*Math.max(a.to-a.from,b.to-b.from)){conflicts.add(a.id);conflicts.add(b.id);}
  }
  for(const d of diagnostics)if(conflicts.has(d.openingId)){d.status='pending';d.reason='category-conflict';d.proposedOpeningId=d.openingId;delete d.openingId;}
  for(let i=openings.length-1;i>=0;i--)if(conflicts.has(openings[i].id))openings.splice(i,1);
  for(const opening of openings)for(const d of diagnostics.filter(d=>d.openingId===opening.id))d.groupIds=[...opening.objectIds];
  return {openings,unmatched:diagnostics.filter(d=>d.status==='pending').map(d=>d.objectId),rejected:diagnostics.filter(d=>d.status==='rejected').map(d=>d.objectId),diagnostics};
}
