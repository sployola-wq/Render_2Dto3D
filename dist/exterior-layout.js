const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const median=a=>{a.sort((a,b)=>a-b);return a[Math.floor(a.length/2)];};
function columns(faces,b){
  const groups=[];
  for(const f of faces){const q=f.bbox;if(!q)continue;let g=groups.find(g=>{const x=Math.max(0,Math.min(g.x1,q[2])-Math.max(g.x0,q[0])),gap=Math.max(0,q[1]-g.y1,g.y0-q[3]);return x/Math.min(g.x1-g.x0,q[2]-q[0])>.65&&gap<b.height*.035;});if(!g)groups.push(g={x0:q[0],y0:q[1],x1:q[2],y1:q[3],cells:[]});g.x0=Math.min(g.x0,q[0]);g.y0=Math.min(g.y0,q[1]);g.x1=Math.max(g.x1,q[2]);g.y1=Math.max(g.y1,q[3]);g.cells.push(q);}
  let merged=true;while(merged){merged=false;outer:for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){const a=groups[i],c=groups[j],overlap=Math.max(0,Math.min(a.y1,c.y1)-Math.max(a.y0,c.y0)),ha=a.y1-a.y0,hc=c.y1-c.y0,gap=Math.max(0,a.x0-c.x1,c.x0-a.x1);if(overlap/Math.min(ha,hc)>.74&&Math.min(ha,hc)/Math.max(ha,hc)>.65&&gap<b.width*.04){a.x0=Math.min(a.x0,c.x0);a.x1=Math.max(a.x1,c.x1);a.y0=Math.min(a.y0,c.y0);a.y1=Math.max(a.y1,c.y1);a.cells.push(...c.cells);groups.splice(j,1);merged=true;break outer;}}}
  return groups.filter(g=>g.y1-g.y0>b.height*.095&&(g.x1-g.x0)*(g.y1-g.y0)>b.width*b.height*.002);
}
function divisions(cells,axis,tolerance){const values=[];for(const q of cells){const n=(q[axis]+q[axis+2])/2;if(!values.some(v=>Math.abs(v-n)<tolerance))values.push(n);}return clamp(values.length,1,5);}
/** A source-informed architectural proposal. Rear openings and terraces are
 * intentionally designed, never claimed to have been recovered from the image. */
export function proposeExteriorLayout(drawing,params,mpp){
  const b=drawing.bounds,W=b.width*mpp,D=params.depthMm/1000,levelCount=clamp(Math.round(params.facadeFloors??2),1,4),H=clamp(b.height*mpp,levelCount*2.7,levelCount*4),floor=H/levelCount,porch=clamp(D*.24,.8,2.2),upperRows=[];
  if(drawing.mask)for(let y=Math.round(b.y0+b.height*.15);y<b.y0+b.height*.38;y+=3){let x0=Infinity,x1=-Infinity;for(let x=Math.floor(b.x0);x<b.x1;x++)if(drawing.mask[y*drawing.width+x]){x0=Math.min(x0,x);x1=Math.max(x1,x);}if(x1>x0)upperRows.push([x0,x1]);}
  const upperX0=upperRows.length?median(upperRows.map(q=>q[0])):b.x0+b.width*.12,upperX1=upperRows.length?median(upperRows.map(q=>q[1])):b.x0+b.width*.78,upperWidth=clamp((upperX1-upperX0)*mpp,W*.50,W*.86),upperLeft=clamp((upperX0-b.x0)*mpp-W/2,-W/2+.12,W/2-upperWidth-.12);
  const levels=Array.from({length:levelCount},(_,i)=>({index:i,x0:i?upperLeft:-W/2+.16,x1:i?upperLeft+upperWidth:W/2-.16,y0:.16+i*floor,y1:.16+(i+1)*floor,zFront:-porch-(i?.18:0),zBack:-D+(i?clamp(D*.17,.6,1.25):0)})),openingGroups=columns((drawing.faces??[]).filter(f=>f.glass),b),openings=[];
  for(const g of openingGroups){const cy=(g.y0+g.y1)/2,index=clamp(Math.floor((b.y1-cy)/b.height*levelCount),0,levelCount-1),l=levels[index],cx=(g.x0+g.x1)/2,side=cx>b.x0+b.width*.88?'right':index&&cx<upperX0+(upperX1-upperX0)*.12?'left':'front',tall=index===0&&(g.y1-g.y0)>b.height/levelCount*.45&&g.y1>b.y1-b.height*.15,height=tall?floor*.76:floor*.47,y0=tall?l.y0+.06:l.y0+floor*.32,w=clamp((g.x1-g.x0)*mpp,.65,(l.x1-l.x0)*.46),x=clamp((cx-(b.x0+b.x1)/2)*mpp,l.x0+w/2+.18,l.x1-w/2-.18);
    openings.push({level:index,side,u:side==='front'?x:(l.zFront+l.zBack)/2,width:side==='front'?w:Math.min(1.15,(l.zFront-l.zBack)*.32),height,y0,cols:divisions(g.cells,0,Math.max(5,(g.x1-g.x0)*.12)),rows:tall?1:divisions(g.cells,1,Math.max(4,(g.y1-g.y0)*.15)),inferred:false,door:tall});
  }
  for(const l of levels){if(!openings.some(o=>o.level===l.index&&o.side==='front'))for(const f of [.26,.7])openings.push({level:l.index,side:'front',u:l.x0+(l.x1-l.x0)*f,width:(l.x1-l.x0)*.23,height:floor*.55,y0:l.y0+floor*.25,cols:2,rows:1,inferred:true});
    // Complete the two returns and the rear with aligned heads and restrained bays.
    for(const side of ['left','right'])for(const t of(l.index?[.55]:[.32,.75])){const z=l.zFront+(l.zBack-l.zFront)*t;if(openings.some(o=>o.level===l.index&&o.side===side&&Math.abs(o.u-z)<1.2))continue;openings.push({level:l.index,side,u:z,width:Math.min(1.25,(l.zFront-l.zBack)*.27),height:floor*.48,y0:l.y0+floor*.31,cols:2,rows:1,inferred:true});}
    for(const t of [.27,.73])openings.push({level:l.index,side:'back',u:l.x0+(l.x1-l.x0)*t,width:(l.x1-l.x0)*.25,height:l.index&&t>.5?floor*.58:floor*.76,y0:l.y0+(l.index&&t>.5?floor*.22:.06),cols:2,rows:1,inferred:true,door:!l.index||t<.5});
  }
  return {width:W,depth:D,height:H,floorHeight:floor,porch,levels,openings,groundY:.16,inferred:true,provenance:'source-facade-with-designed-returns',assumptions:['Propuesta arquitectónica con profundidad: aberturas frontales orientadas por la lámina.','Laterales, parte trasera, terraza y distribución de profundidad completados como diseño propuesto.','La fachada en perspectiva no determina las medidas ni la distribución oculta del proyecto real.']};
}
